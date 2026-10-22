// Domain oracle: request ownership and observable obligations, independent of React/SDK code.
export const ACTIONS = [
  'execute', 'hide', 'ready', 'success', 'error', 'edit',
  'replace', 'crash', 'timeout', 'consume', 'expire',
];

export const initialModel = () => ({
  clock: 0, document: 1, phase: 'loading', deadline: 15000,
  visible: false, payload: 0, request: null, nextRequest: 0,
  attempts: [], calls: [], events: [], token: null,
});

export function eligible(state, action) {
  switch (action) {
    case 'ready': return state.phase !== 'ready';
    case 'success':
    case 'error': return state.attempts.some((attempt) => !attempt.done);
    case 'timeout': return state.deadline !== null;
    case 'consume':
    case 'expire': return state.token !== null && !state.token.used;
    default: return ACTIONS.includes(action);
  }
}

function replaceDocument(state) {
  state.document++;
  state.phase = 'loading';
  state.deadline = state.clock + 15000;
  if (state.request) {
    state.request.sent = false;
  }
}

function dispatch(state) {
  if (state.phase !== 'ready' || !state.request || state.request.sent) {
    return;
  }
  state.request.sent = true;
  state.calls.push({ rqdata: state.payload ? 'override-B' : 'legacy-A' });
  state.attempts.push({ document: state.document, request: state.request.id, done: false });
}

function advance(state, target) {
  const timers = [];
  if (state.deadline !== null && state.deadline <= target) {
    timers.push({ at: state.deadline, kind: 'timeout' });
  }
  if (state.token && !state.token.used && state.token.expires <= target) {
    timers.push({ at: state.token.expires, kind: 'expired' });
  }
  timers.sort((left, right) => left.at - right.at);
  for (const timer of timers) {
    state.events.push({ kind: timer.kind });
    if (timer.kind === 'timeout') {
      state.phase = 'timed-out';
      state.deadline = null;
      state.request = null;
    } else {
      state.token.used = true;
    }
  }
  state.clock = target;
}

export function transition(previous, action) {
  if (!eligible(previous, action)) {
    throw new Error(`Ineligible action: ${action}`);
  }
  const state = JSON.parse(JSON.stringify(previous));
  switch (action) {
    case 'execute':
      state.visible = true;
      if (!state.request) {
        state.request = { id: ++state.nextRequest, sent: false };
      }
      if (state.phase === 'timed-out') {
        replaceDocument(state);
      }
      dispatch(state);
      break;
    case 'hide':
      state.visible = false;
      state.request = null;
      break;
    case 'ready':
      state.phase = 'ready';
      state.deadline = null;
      dispatch(state);
      break;
    case 'success':
    case 'error': {
      const index = state.attempts.findIndex((attempt) => !attempt.done);
      const attempt = state.attempts[index];
      attempt.done = true;
      if (attempt.document !== state.document) {
        break;
      }
      const ownsRequest = state.request?.id === attempt.request;
      if (!ownsRequest) {
        break;
      }
      if (action === 'error') {
        state.events.push({ kind: 'network-error' });
      } else {
        state.events.push({ kind: 'token', id: index });
        state.token = { id: index, expires: state.clock + 120000, used: false };
      }
      state.request = null;
      break;
    }
    case 'edit': state.payload = 1 - state.payload; break;
    case 'replace':
    case 'crash': replaceDocument(state); break;
    case 'timeout': advance(state, state.deadline); break;
    case 'consume': state.token.used = true; break;
    case 'expire': advance(state, state.token.expires); break;
  }
  return state;
}

export const projection = (state, passive) => ({
  documents: state.document,
  visible: passive ? null : state.visible,
  calls: state.calls,
  events: state.events,
});

export function* boundedTraces(bound) {
  let level = [{ trace: [], state: initialModel() }];
  yield* level;
  for (let depth = 1; depth <= bound; depth++) {
    const next = [];
    for (const { trace, state } of level) {
      for (const action of ACTIONS) {
        if (eligible(state, action)) {
          next.push({ trace: [...trace, action], state: transition(state, action) });
        }
      }
    }
    yield* next;
    level = next;
  }
}
