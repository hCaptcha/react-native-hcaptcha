// Domain oracle: request ownership and observable obligations, independent of React/SDK code.
export const CORE_ACTIONS = [
  'execute', 'hide', 'ready', 'success', 'error', 'edit',
  'replace', 'crash', 'timeout', 'consume', 'expire', 'destroy',
];
export const ACTIONS = [...CORE_ACTIONS, 'eventReset', 'initError', 'renderError', 'scriptError', 'reload', 'info', 'duplicateReady'];

export const initialModel = () => ({
  clock: 0, document: 1, phase: 'loading', deadline: 15000,
  visible: false, payload: 0, request: null, nextRequest: 0,
  attempts: [], calls: [], events: [], token: null, lifetime: 0, eventLifetime: null, failure: null,
});

export function eligible(state, command) {
  const action = typeof command === 'string' ? command : command.type;
  switch (action) {
    case 'ready': return state.phase === 'loading' || state.phase === 'timed-out' || (state.phase === 'failed' && state.failure !== 'renderError');
    case 'crash': return state.phase !== 'destroyed';
    case 'reload': return state.phase !== 'destroyed';
    case 'info':
    case 'initError':
    case 'renderError':
    case 'scriptError': return state.phase === 'loading';
    case 'duplicateReady': return state.phase === 'ready';
    case 'eventReset': return state.eventLifetime !== null;
    case 'success':
    case 'error': return command.attempt === undefined
      ? state.attempts.some((attempt) => !attempt.done)
      : Boolean(state.attempts[command.attempt] && !state.attempts[command.attempt].done);
    case 'timeout': return state.deadline !== null;
    case 'consume':
    case 'expire': return state.token?.status === 'held';
    case 'advance': return Number.isFinite(command.ms) && command.ms >= 0;
    default: return ACTIONS.includes(action);
  }
}

function replaceDocument(state) {
  if (state.phase === 'destroyed') {
    return;
  }
  state.document++;
  state.phase = 'loading';
  state.failure = null;
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
  state.eventLifetime = state.lifetime;
}

function advance(state, target) {
  const timers = [];
  if (state.deadline !== null && state.deadline <= target) {
    timers.push({ at: state.deadline, kind: 'timeout' });
  }
  if (state.token?.status === 'held' && state.token.expires <= target) {
    timers.push({ at: state.token.expires, kind: 'expired' });
  }
  timers.sort((left, right) => left.at - right.at);
  for (const timer of timers) {
    if (timer.kind === 'timeout') {
      if (state.request) {
        state.events.push({ kind: timer.kind });
        state.eventLifetime = state.lifetime;
      }
      state.phase = 'timed-out';
      state.deadline = null;
      state.request = null;
    } else {
      state.events.push({ kind: timer.kind });
      state.eventLifetime = state.lifetime;
      state.token.status = 'expired';
    }
  }
  state.clock = target;
}

export function transition(previous, command, options = {}) {
  if (!eligible(previous, command)) {
    throw new Error(`Ineligible action: ${JSON.stringify(command)}`);
  }
  const action = typeof command === 'string' ? command : command.type;
  const state = JSON.parse(JSON.stringify(previous));
  switch (action) {
    case 'execute':
      state.visible = true;
      if (!state.request) {
        state.request = { id: ++state.nextRequest, sent: false };
      }
      if (state.phase === 'destroyed') {
        state.phase = 'loading';
        replaceDocument(state);
      } else if (state.phase === 'timed-out') {
        replaceDocument(state);
      } else if (state.phase === 'failed') {
        state.phase = state.failure === 'renderError' ? 'ready' : 'loading';
        state.deadline = state.phase === 'loading' ? state.clock + 15000 : null;
      }
      dispatch(state);
      break;
    case 'eventReset':
      if (state.eventLifetime !== state.lifetime) {
        break;
      }
      // Retry is a fresh request; an older async result cannot satisfy it.
      state.request = null;
      return transition(state, 'execute', options);
    case 'hide':
      state.visible = false;
      state.request = null;
      break;
    case 'destroy':
      state.phase = 'destroyed';
      state.deadline = null;
      state.visible = false;
      state.request = null;
      state.token = null;
      state.lifetime++;
      break;
    case 'ready':
      state.phase = 'ready';
      state.deadline = null;
      dispatch(state);
      break;
    case 'duplicateReady': break;
    case 'initError':
    case 'renderError':
    case 'scriptError':
      if (state.request) {
        state.events.push({ kind: command.data || { initError: 'loader-error', renderError: 'TypeError', scriptError: 'script-error' }[action] });
        state.eventLifetime = state.lifetime;
      }
      state.phase = 'failed';
      state.failure = action;
      state.deadline = null;
      state.request = null;
      break;
    case 'info':
      state.events.push({ kind: command.data || 'fixture-info' });
      state.eventLifetime = state.lifetime;
      break;
    case 'success':
    case 'error': {
      const index = command.attempt ?? state.attempts.findIndex((attempt) => !attempt.done);
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
        state.events.push({ kind: command.data || 'network-error' });
      } else {
        state.events.push({ kind: 'token', id: index });
        state.token = { id: index, expires: state.clock + 120000, status: 'held' };
      }
      state.request = null;
      state.eventLifetime = state.lifetime;
      break;
    }
    case 'edit':
      state.payload = 1 - state.payload;
      if (options.legacyPayload) {
        replaceDocument(state);
      }
      break;
    case 'replace':
    case 'crash':
    case 'reload': replaceDocument(state); break;
    case 'timeout': advance(state, state.deadline); break;
    case 'consume': state.token.status = 'consumed'; break;
    case 'expire': advance(state, state.token.expires); break;
    case 'advance': advance(state, state.clock + command.ms); break;
  }
  return state;
}

export const projection = (state, passive) => ({
  mounted: state.phase !== 'destroyed',
  documents: state.document,
  visible: passive ? null : state.visible,
  calls: state.calls,
  events: state.events,
});

export function* boundedTraces(bound, actions = CORE_ACTIONS) {
  let level = [{ trace: [], state: initialModel() }];
  yield* level;
  for (let depth = 1; depth <= bound; depth++) {
    const next = [];
    for (const { trace, state } of level) {
      for (const action of actions) {
        if (eligible(state, action)) {
          next.push({ trace: [...trace, action], state: transition(state, action) });
        }
      }
    }
    yield* next;
    level = next;
  }
}
