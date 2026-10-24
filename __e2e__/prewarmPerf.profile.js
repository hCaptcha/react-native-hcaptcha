import { describe, test, render, expect, waitFor } from 'react-native-harness';
import { screen, userEvent } from '@react-native-harness/ui';
import React from 'react';
import PrewarmAuthApp, { authServer } from './PrewarmAuthApp';

const serverState = async () => (await fetch(`${authServer}/state`)).json();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checkpoint = async (name, metrics = {}) => {
  const response = await fetch(`${authServer}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...metrics }),
  });
  expect(response.ok).toBe(true);
};

const sampleFrames = () => {
  const gaps = [];
  let previous = global.performance.now();
  let frame;
  const sample = (time) => {
    gaps.push(time - previous);
    previous = time;
    frame = requestAnimationFrame(sample);
  };
  frame = requestAnimationFrame(sample);
  return () => {
    cancelAnimationFrame(frame);
    gaps.sort((a, b) => a - b);
    return {
      frames: gaps.length,
      p95Ms: gaps[Math.floor(gaps.length * 0.95)],
      maxMs: gaps[gaps.length - 1],
      over50Ms: gaps.filter((gap) => gap > 50).length,
      over250Ms: gaps.filter((gap) => gap > 250).length,
    };
  };
};

const authenticate = async (mode, tokenCount) => {
  await userEvent.press(await screen.findByTestId(mode));
  await waitFor(() => screen.findByTestId(`tokens-${tokenCount}`), { timeout: 15000 });
  await userEvent.type(await screen.findByTestId('password'), 'Test-pass-123');
  await waitFor(() => screen.findByTestId('password-valid'));
  await userEvent.press(await screen.findByTestId('submit'));
  await waitFor(() => screen.findByTestId('page-account'), { timeout: 20000 });
  await userEvent.press(await screen.findByTestId('logout'));
  await waitFor(() => screen.findByTestId('page-welcome'));
};

describe('prewarm performance and stalls (live SDK)', () => {
  test('compares cold and prewarmed screen-2 execution', async () => {
    await render(<React.Fragment />);
    const baseline = sampleFrames();
    await pause(3000);
    await checkpoint('baseline', { jsFrames: baseline() });
    for (let trial = 0; trial < 10; trial++) {
      const prewarm = trial % 2 === 0;
      await fetch(`${authServer}/reset`, { method: 'POST' });
      const measurements = { attempts: [], errors: [], consumeTokens: true };
      let frames = sampleFrames();
      const app = await render(<PrewarmAuthApp prewarm={prewarm} measurements={measurements} />);
      if (prewarm) {
        await waitFor(async () => expect((await serverState()).sdkReady).toBe(1), { timeout: 15000 });
      }
      if (trial === 0) {
        await checkpoint('prewarm-startup', { jsFrames: frames() });
        frames = sampleFrames();
      }
      await userEvent.type(await screen.findByTestId('email'), 'perf@example.test');
      await userEvent.press(await screen.findByTestId('signup'));
      await waitFor(() => screen.findByTestId('tokens-1'), { timeout: 15000 });
      expect(measurements.errors).toEqual([]);
      await checkpoint(prewarm ? 'warm-trial' : 'cold-trial', {
        trial,
        tokenMs: measurements.attempts[0].tokenMs,
        jsFrames: frames(),
        sdkLoads: (await serverState()).sdkLoads,
      });
      app.unmount();
      // Let native Modal dismissal finish before mounting the next trial.
      await pause(500);
    }
  });

  test('reuses one warmed WebView across 30 complete auth flows', async () => {
    await fetch(`${authServer}/reset`, { method: 'POST' });
    const measurements = { attempts: [], errors: [] };
    const app = await render(<PrewarmAuthApp measurements={measurements} />);
    await waitFor(async () => expect((await serverState()).sdkReady).toBe(1), { timeout: 15000 });
    await pause(3000);
    await checkpoint('stress-start');
    const idle = sampleFrames();
    await pause(5000);
    await checkpoint('warm-idle', { jsFrames: idle() });
    const frames = sampleFrames();
    await userEvent.type(await screen.findByTestId('email'), 'stress@example.test');
    for (let attempt = 0; attempt < 30; attempt++) {
      await authenticate(attempt === 0 ? 'signup' : 'login', attempt + 1);
      if ((attempt + 1) % 10 === 0) {
        await checkpoint(`stress-${attempt + 1}`);
      }
    }
    const state = await serverState();
    expect(state.sdkLoads).toBe(1);
    expect(state.sdkReady).toBe(1);
    expect(state.submissions).toHaveLength(30);
    expect(state.submissions.every((entry) => entry.verified)).toBe(true);
    expect(measurements.errors).toEqual([]);
    await checkpoint('stress-complete', {
      tokenMs: measurements.attempts.map((attempt) => attempt.tokenMs),
      jsFrames: frames(),
      sdkLoads: state.sdkLoads,
    });
    await pause(5000);
    await checkpoint('stress-settled');
    app.unmount();
    await pause(5000);
    await checkpoint('after-unmount');
  });

  test('bounds a stalled SDK load and recovers after cancellation', async () => {
    await fetch(`${authServer}/reset`, { method: 'POST' });
    const measurements = { attempts: [], errors: [] };
    await render(<PrewarmAuthApp slowSdk measurements={measurements} passiveSiteKey />);
    await userEvent.type(await screen.findByTestId('email'), 'timeout@example.test');
    await userEvent.press(await screen.findByTestId('signup'));
    await pause(16000);
    expect(measurements.errors).toHaveLength(1);
    expect(measurements.errors[0].description).toBe('loading timeout');
    await userEvent.press(await screen.findByTestId('cancel'));
    await fetch(`${authServer}/release-sdk`, { method: 'POST' });
    await pause(3000);
    expect(await screen.findByTestId('tokens-0')).toBeDefined();
    await authenticate('signup', 1);
    await checkpoint('timeout-recovered', { errors: measurements.errors });
  });

  test('recovers a terminated warm renderer without a stalled execute', async () => {
    await fetch(`${authServer}/reset`, { method: 'POST' });
    const measurements = { attempts: [], errors: [] };
    await render(<PrewarmAuthApp measurements={measurements} />);
    await waitFor(async () => expect((await serverState()).sdkReady).toBe(1), { timeout: 15000 });
    const response = await fetch(`${authServer}/crash-renderer`, { method: 'POST' });
    expect(await response.json()).toEqual({});
    await waitFor(async () => expect((await serverState()).sdkReady).toBe(2), { timeout: 15000 });
    await userEvent.type(await screen.findByTestId('email'), 'recover@example.test');
    await authenticate('signup', 1);
    expect(measurements.errors).toEqual([]);
    await checkpoint('renderer-recovered', { sdkLoads: (await serverState()).sdkLoads });
  });
});
