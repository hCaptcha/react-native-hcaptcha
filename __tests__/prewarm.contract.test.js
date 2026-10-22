import fs from 'fs';
import path from 'path';
import { isDeepStrictEqual } from 'util';
import { act } from '@testing-library/react-native';
import { ACTIONS, boundedTraces, eligible, initialModel, projection, transition } from '../__test-utils__/prewarm-model';
import { PrewarmDriver } from '../__test-utils__/prewarm-driver';

const BOUND = 5;
const MODES = [false, true];
const ledger = { bound: BOUND, alphabet: ACTIONS, bounded: [], stateful: [], metamorphic: [], boundaries: [], regressions: [], failures: [] };
const exercised = new Map();

function recordScenario(trace, passive, options, passed) {
  const scenario = { passive, cold: Boolean(options.cold), showAlias: Boolean(options.showAlias),
    legacyPayload: Boolean(options.legacyPayload), trace };
  const key = JSON.stringify(scenario);
  const entry = exercised.get(key) || { ...scenario, passed, families: [] };
  entry.families = [...new Set([...entry.families, options.family || 'bounded'])];
  exercised.set(key, entry);
}

async function runTrace(trace, passive, options = {}) {
  const driver = new PrewarmDriver(passive, options);
  let state = initialModel();
  let result;
  try {
    for (let index = 0; index <= trace.length; index++) {
      if (index) {
        const action = trace[index - 1];
        if (!eligible(state, action)) {
          result = { ineligible: true };
          return result;
        }
        state = transition(state, action, options);
        try {
          await driver.step(action);
        } catch (error) {
          result = { failure: { trace: trace.slice(0, index), passive, fields: ['driver'], error: error.message } };
          return result;
        }
      }
      const expected = projection(state, passive);
      const actual = driver.snapshot();
      if (!isDeepStrictEqual(actual, expected)) {
        const fields = Object.keys(expected).filter((key) => !isDeepStrictEqual(actual[key], expected[key]));
        result = { failure: { trace: trace.slice(0, index), passive, fields,
          actual: JSON.parse(JSON.stringify(actual)), expected } };
        return result;
      }
    }
    result = { actual: driver.snapshot() };
    return result;
  } finally {
    await driver.dispose();
    if (result && !result.ineligible) {
      recordScenario(result.failure?.trace || trace, passive, options, !result.failure);
    }
  }
}

function statefulTrace(seed, length) {
  let state = initialModel();
  const trace = [];
  let random = seed;
  for (let step = 0; step < length; step++) {
    random = (1664525 * random + 1013904223) % 4294967296;
    const actions = ACTIONS.filter((action) => eligible(state, action));
    const action = actions[random % actions.length];
    trace.push(action);
    state = transition(state, action);
  }
  return trace;
}

async function minimize(failure) {
  let trace = failure.trace;
  for (let width = Math.ceil(trace.length / 2); width; width--) {
    for (let index = 0; index + width <= trace.length;) {
      const candidate = [...trace.slice(0, index), ...trace.slice(index + width)];
      const result = await runTrace(candidate, failure.passive, { family: 'reduction' });
      if (!result.ineligible && result.failure?.fields.join() === failure.fields.join()) {
        trace = result.failure.trace;
        index = 0;
      } else {
        index++;
      }
    }
  }
  return (await runTrace(trace, failure.passive, { family: 'reduction' })).failure;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
afterAll(() => {
  const output = path.join(__dirname, '..', 'output');
  fs.mkdirSync(output, { recursive: true });
  ledger.uniqueScenarios = [...exercised.values()];
  fs.writeFileSync(path.join(output, 'prewarm-contract-results.json'), JSON.stringify(ledger, null, 2));
});

test.each(MODES)('bounded exhaustive domain (passiveSiteKey=%s)', async (passive) => {
  const scenarios = [...boundedTraces(BOUND)];
  const failures = [];
  const byDepth = Array(BOUND + 1).fill(0);
  const excluded = Object.fromEntries(ACTIONS.map((action) => [action, 0]));
  for (const { trace, state } of scenarios) {
    byDepth[trace.length]++;
    if (trace.length < BOUND) {
      const suffixes = (ACTIONS.length ** (BOUND - trace.length) - 1) / (ACTIONS.length - 1);
      for (const action of ACTIONS.filter((candidate) => !eligible(state, candidate))) {
        excluded[action] += suffixes;
      }
    }
    const result = await runTrace(trace, passive);
    if (result.failure) {
      failures.push(result.failure);
    }
  }
  const candidates = Array.from({ length: BOUND + 1 }, (_, depth) => ACTIONS.length ** depth).reduce((sum, count) => sum + count, 0);
  ledger.bounded.push({ passive, candidates, eligible: scenarios.length, exercised: scenarios.length,
    excludedByPreconditions: candidates - scenarios.length, byDepth, excludedByFirstIllegalAction: excluded, failed: failures.length });
  expect(Object.values(excluded).reduce((sum, count) => sum + count, 0)).toBe(candidates - scenarios.length);
  ledger.failures.push(...failures);
  expect(failures).toEqual([]);
}, 180000);

test.each(MODES)('deterministic stateful traces (passiveSiteKey=%s)', async (passive) => {
  const failures = [];
  const traces = Array.from({ length: 64 }, (_, index) => statefulTrace(index + 1, 32));
  for (const trace of traces) {
    const result = await runTrace(trace, passive, { family: 'stateful' });
    if (result.failure) {
      failures.push(await minimize(result.failure));
    }
  }
  ledger.stateful.push({ passive, seeds: [1, 64], length: 32, eligible: traces.length,
    exercised: new Set(traces.map((trace) => trace.join())).size, completedWithoutViolation: traces.length - failures.length,
    stoppedAtViolation: failures.length });
  ledger.failures.push(...failures);
  expect(failures).toEqual([]);
}, 180000);

const METAMORPHIC_BASES = [
  ['execute', 'ready', 'success', 'hide', 'execute', 'success', 'consume'],
  ['ready', 'edit', 'execute', 'error', 'execute', 'success', 'expire'],
  ['execute', 'replace', 'ready', 'success', 'hide'],
  ['execute', 'timeout', 'ready', 'execute', 'success'],
  ['ready', 'execute', 'crash', 'ready', 'success', 'success'],
];

test.each(MODES)('metamorphic alias, idempotence, edit cancellation and payload encoding (passiveSiteKey=%s)', async (passive) => {
  for (const trace of METAMORPHIC_BASES) {
    const baseline = await runTrace(trace, passive, { family: 'metamorphic' });
    const alias = await runTrace(trace, passive, { family: 'metamorphic', showAlias: true });
    const duplicated = trace.flatMap((action) => action === 'execute' ? [action, action] : [action]);
    const repeated = await runTrace(duplicated, passive, { family: 'metamorphic' });
    const edits = trace.flatMap((action) => [action, 'edit', 'edit']);
    const edited = await runTrace(edits, passive, { family: 'metamorphic' });
    const legacyTrace = trace.flatMap((action) => action === 'edit' ? [action, 'ready'] : [action]);
    const legacy = await runTrace(legacyTrace, passive, { family: 'metamorphic', legacyPayload: true });
    expect(baseline.failure).toBeUndefined();
    expect(alias.actual).toEqual(baseline.actual);
    expect(repeated.actual).toEqual(baseline.actual);
    expect(edited.actual).toEqual(baseline.actual);
    expect(legacy.failure).toBeUndefined();
    expect(legacy.actual.documents).toBe(baseline.actual.documents + trace.filter((action) => action === 'edit').length);
    expect({ ...legacy.actual, documents: baseline.actual.documents }).toEqual(baseline.actual);
    ledger.metamorphic.push({ passive, relation: 'show-alias', trace });
    ledger.metamorphic.push({ passive, relation: 'execute-idempotence', trace, transformed: duplicated });
    ledger.metamorphic.push({ passive, relation: 'edit-involution', trace, transformed: edits });
    ledger.metamorphic.push({ passive, relation: 'legacy-payload-equivalence', trace, transformed: legacyTrace });
  }
}, 30000);

test.each(MODES)('metamorphic readiness ordering and cold/warm equivalence (passiveSiteKey=%s)', async (passive) => {
  for (const actions of [['success'], ['error'], ['success', 'consume']]) {
    const first = await runTrace(['execute', 'ready', ...actions], passive, { family: 'metamorphic' });
    const second = await runTrace(['ready', 'execute', ...actions], passive, { family: 'metamorphic' });
    expect(first.failure).toBeUndefined();
    expect(second.failure).toBeUndefined();
    expect(second.actual).toEqual(first.actual);
    ledger.metamorphic.push({ passive, relation: 'readiness-commutation', trace: ['execute', 'ready', ...actions],
      transformed: ['ready', 'execute', ...actions] });

    const cold = new PrewarmDriver(passive, { cold: true });
    try {
      expect(cold.documents).toHaveLength(0);
      for (const action of ['execute', 'ready', ...actions]) {
        await cold.step(action);
      }
      expect(cold.snapshot()).toEqual(first.actual);
      recordScenario(['execute', 'ready', ...actions], passive, { family: 'metamorphic', cold: true }, true);
      ledger.metamorphic.push({ passive, relation: 'cold-warm-equivalence', trace: ['execute', 'ready', ...actions] });
    } finally {
      await cold.dispose();
    }
  }
}, 30000);

test('metamorphic presentation and renderer-fault invariance', async () => {
  for (const trace of METAMORPHIC_BASES) {
    const visible = await runTrace(trace, false, { family: 'metamorphic' });
    const passive = await runTrace(trace, true, { family: 'metamorphic' });
    expect(visible.failure).toBeUndefined();
    expect(passive.failure).toBeUndefined();
    expect({ ...visible.actual, visible: null }).toEqual(passive.actual);
    ledger.metamorphic.push({ relation: 'presentation-invariance', trace });
  }
  for (const passive of MODES) {
    for (const trace of METAMORPHIC_BASES.filter((base) => base.includes('replace') || base.includes('crash'))) {
      const swapped = trace.map((action) => {
        if (action === 'crash') { return 'replace'; }
        if (action === 'replace') { return 'crash'; }
        return action;
      });
      const baseline = await runTrace(trace, passive, { family: 'metamorphic' });
      const fault = await runTrace(swapped, passive, { family: 'metamorphic' });
      expect(baseline.failure).toBeUndefined();
      expect(fault.failure).toBeUndefined();
      expect(fault.actual).toEqual(baseline.actual);
      ledger.metamorphic.push({ passive, relation: 'fault-equivalence', trace, transformed: swapped });
    }
  }
}, 30000);

const LOAD_BOUNDARIES = MODES.flatMap((passive) => [14999, 15000, 15001].map((ms) => ({ passive, ms })));
test.each(LOAD_BOUNDARIES)('loading deadline at $ms ms (passiveSiteKey=$passive)', async ({ passive, ms }) => {
  const driver = new PrewarmDriver(passive);
  try {
    await driver.step('execute');
    act(() => jest.advanceTimersByTime(ms));
    driver.configure({ verifyParams: { rqdata: 'override-B' } });
    await driver.step('ready');
    expect(driver.events).toEqual(ms < 15000 ? [] : [{ kind: 'timeout' }]);
    expect(driver.calls).toEqual(ms < 15000 ? [{ rqdata: 'override-B' }] : []);
    await driver.step('execute');
    expect(driver.calls).toEqual([{ rqdata: 'override-B' }]);
    ledger.boundaries.push({ kind: 'loading', passive, ms });
    recordScenario(['execute', `wait:${ms}`, 'edit', 'ready', 'execute'], passive, { family: 'boundary' }, true);
  } finally {
    await driver.dispose();
  }
});

const TOKEN_BOUNDARIES = MODES.flatMap((passive) => [false, true].flatMap((used) =>
  [119999, 120000, 120001].map((ms) => ({ passive, used, ms }))));
test.each(TOKEN_BOUNDARIES)('token deadline at $ms ms (used=$used, passiveSiteKey=$passive)', async ({ passive, used, ms }) => {
  const driver = new PrewarmDriver(passive);
  try {
    for (const action of ['ready', 'execute', 'success', 'hide']) {
      await driver.step(action);
    }
    if (used) {
      await driver.step('consume');
    }
    const heldToken = driver.tokens[0].nativeEvent.data;
    driver.configure({ verifyParams: { rqdata: 'override-B' } });
    act(() => jest.advanceTimersByTime(ms));
    const events = [{ kind: 'token', id: 0 }];
    if (!used && ms >= 120000) {
      events.push({ kind: 'expired' });
    }
    expect(driver.events).toEqual(events);
    expect(driver.tokens[0].nativeEvent.data).toBe(heldToken);
    expect(driver.calls).toEqual([{ rqdata: 'legacy-A' }]);
    ledger.boundaries.push({ kind: 'token', passive, used, ms });
    recordScenario(['ready', 'execute', 'success', 'hide', ...(used ? ['consume'] : []), 'edit', `wait:${ms}`],
      passive, { family: 'boundary' }, true);
  } finally {
    await driver.dispose();
  }
});

test.each(MODES)('unmount cancels timers and rejects retained native callbacks (passiveSiteKey=%s)', async (passive) => {
  const driver = new PrewarmDriver(passive);
  try {
    for (const action of ['ready', 'execute', 'success']) {
      await driver.step(action);
    }
    const receive = driver.current.receive;
    await act(async () => { driver.component.unmount(); });
    act(() => {
      jest.advanceTimersByTime(120001);
      receive({ nativeEvent: { data: driver.attempts[0].token } });
    });
    expect(driver.events).toEqual([{ kind: 'token', id: 0 }]);
    ledger.boundaries.push({ kind: 'unmount', passive });
    recordScenario(['ready', 'execute', 'success', 'unmount', 'wait:120001', 'retained-token'], passive, { family: 'boundary' }, true);
  } finally {
    await driver.dispose();
  }
});

const REGRESSIONS = MODES.flatMap((passive) => [
  { passive, defect: 'cancelled attempt owns no later request', trace: ['ready', 'execute', 'hide', 'execute', 'success'] },
  { passive, defect: 'cancelled attempt errors cannot invalidate a later token', trace: ['ready', 'execute', 'hide', 'execute', 'error', 'success'] },
  { passive, defect: 'returning to config A rejects callbacks from document A', trace: ['ready', 'execute', 'replace', 'replace', 'success'] },
  { passive, defect: 'returning to config A rejects old document errors', trace: ['ready', 'execute', 'replace', 'replace', 'error'] },
]);

test.each(REGRESSIONS)('regression: $defect (passiveSiteKey=$passive)', async ({ passive, defect, trace }) => {
  const regression = { passive, defect, trace, completed: false };
  ledger.regressions.push(regression);
  const result = await runTrace(trace, passive, { family: 'regression' });
  Object.assign(regression, { completed: true, contractHolds: !result.failure, failure: result.failure });
  expect(result.failure).toBeUndefined();
});

test.each(MODES)('presentation changes preserve a held token without verification (passiveSiteKey=%s)', async (passive) => {
  const regression = { passive, defect: 'presentation change starts unsolicited verification', completed: false,
    trace: ['ready', 'execute', 'success', 'togglePresentation', 'ready'] };
  ledger.regressions.push(regression);
  const driver = new PrewarmDriver(passive);
  try {
    for (const action of ['ready', 'execute', 'success']) {
      await driver.step(action);
    }
    driver.configure({ passiveSiteKey: !passive });
    await driver.step('ready');
    Object.assign(regression, { completed: true, actual: driver.snapshot(), contractHolds: driver.calls.length === 1 });
    recordScenario(['ready', 'execute', 'success', 'togglePresentation', 'ready'], passive, { family: 'regression' }, driver.calls.length === 1);
    ledger.metamorphic.push({ passive, relation: 'held-token-presentation-invariance', contractHolds: driver.calls.length === 1 });
    expect(driver.calls).toHaveLength(1);
    expect(driver.documents).toHaveLength(1);
    act(() => jest.advanceTimersByTime(120000));
    expect(driver.events).toEqual([{ kind: 'token', id: 0 }, { kind: 'expired' }]);
  } finally {
    await driver.dispose();
  }
});

const QUEUED_OUTCOMES = MODES.flatMap((passive) => ['success', 'error'].map((outcome) => ({ passive, outcome })));
test.each(QUEUED_OUTCOMES)('rejects a queued native $outcome after cancel/re-execute (passiveSiteKey=$passive)', async ({ passive, outcome }) => {
  const driver = new PrewarmDriver(passive);
  try {
    await driver.step('ready');
    await driver.step('execute');
    const document = driver.current;
    document.outbox = [];
    await driver.step(outcome);
    expect(document.outbox).toHaveLength(1);
    const message = document.outbox[0];
    document.outbox = null;
    await driver.step('hide');
    await driver.step('execute');
    act(() => document.receive({ nativeEvent: { data: message } }));
    expect(driver.events).toEqual([]);
    await driver.step('success');
    expect(driver.events).toEqual([{ kind: 'token', id: 1 }]);
    expect(driver.documents).toHaveLength(1);
    expect(driver.calls).toHaveLength(2);
    ledger.boundaries.push({ kind: 'queued-native-outcome', passive, outcome });
    recordScenario(['ready', 'execute', `queue:${outcome}`, 'hide', 'execute', `deliver:${outcome}`, 'success'],
      passive, { family: 'boundary' }, true);
  } finally {
    await driver.dispose();
  }
});

test.each(MODES)('supports cancel/re-execute in one React batch (passiveSiteKey=%s)', async (passive) => {
  const driver = new PrewarmDriver(passive);
  try {
    await driver.step('ready');
    await driver.step('execute');
    await act(async () => {
      driver.ref.current.hide();
      driver.ref.current.execute();
    });
    driver.refresh();
    expect(driver.snapshot().visible).toBe(passive ? null : true);
    await driver.step('success');
    expect(driver.events).toEqual([]);
    await driver.step('success');
    expect(driver.events).toEqual([{ kind: 'token', id: 1 }]);
    ledger.boundaries.push({ kind: 'batched-cancel-execute', passive });
    recordScenario(['ready', 'execute', 'batch:hide+execute', 'success', 'success'], passive, { family: 'boundary' }, true);
  } finally {
    await driver.dispose();
  }
});
