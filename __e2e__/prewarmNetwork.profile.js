import { describe, test, render, expect, waitFor } from 'react-native-harness';
import { screen, userEvent } from '@react-native-harness/ui';
import React from 'react';
import PrewarmAuthApp, { authServer } from './PrewarmAuthApp';

const networkState = async () => (await fetch(`${authServer}/network-state`)).json();
const offline = async (value) => {
  const response = await fetch(`${authServer}/network?offline=${value}`, { method: 'POST' });
  expect(response.ok).toBe(true);
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('prewarm transport failures (live SDK)', () => {
  for (const queued of [false, true]) {
    test(`recovers an offline prewarm (executeQueued=${queued})`, async () => {
      await waitFor(async () => expect((await networkState()).proxyReady).toBe(true), { timeout: 10000 });
      await fetch(`${authServer}/reset`, { method: 'POST' });
      await offline(true);
      const measurements = { attempts: [], errors: [] };
      await render(<PrewarmAuthApp networkTest passiveSiteKey measurements={measurements} />);
      await userEvent.type(await screen.findByTestId('email'), 'network@example.test');
      if (queued) {
        await userEvent.press(await screen.findByTestId('signup'));
      }
      await waitFor(async () => expect((await networkState()).blocked).toContain('js.hcaptcha.com'), { timeout: 10000 });
      await waitFor(() => expect(measurements.errors.length).toBeGreaterThan(0), { timeout: 20000 });
      const failures = measurements.errors.length;
      await pause(2000);
      expect(measurements.errors).toHaveLength(failures);
      expect(await screen.findByTestId('tokens-0')).toBeDefined();
      await offline(false);
      await userEvent.press(await screen.findByTestId(queued ? 'retry-captcha' : 'signup'));
      await waitFor(() => screen.findByTestId('tokens-1'), { timeout: 20000 });
      await userEvent.type(await screen.findByTestId('password'), 'Network-pass-123');
      await waitFor(() => screen.findByTestId('password-valid'));
      await userEvent.press(await screen.findByTestId('submit'));
      await waitFor(() => screen.findByTestId('page-account'), { timeout: 20000 });
      const state = await (await fetch(`${authServer}/state`)).json();
      expect(state.submissions).toHaveLength(1);
      expect(state.submissions[0].verified).toBe(true);
      console.log('Offline prewarm recovery:', JSON.stringify({ queued, network: await networkState(), errors: measurements.errors }));
    });
  }

  for (const passiveSiteKey of [true, false]) {
    test(`recovers a warm challenge execution after network loss and background/resume (passiveSiteKey=${passiveSiteKey})`, async () => {
      await waitFor(async () => expect((await networkState()).proxyReady).toBe(true), { timeout: 10000 });
      await fetch(`${authServer}/reset`, { method: 'POST' });
      const measurements = { attempts: [], errors: [], appStates: [], opens: 0 };
      // Public key from https://accounts.hcaptcha.com/demo; do not solve the challenge.
      const props = { passiveSiteKey, measurements, siteKey: 'a5f74b19-9e45-40e0-b45d-47ff91b7a6c2', host: 'accounts.hcaptcha.com' };
      const app = await render(<PrewarmAuthApp {...props} />);
      await userEvent.type(await screen.findByTestId('email'), 'challenge-network@example.test');
      await waitFor(async () => expect((await (await fetch(`${authServer}/state`)).json()).sdkReady).toBe(1), { timeout: 15000 });
      await pause(3000);
      expect(measurements.errors).toEqual([]);
      await offline(true);
      await userEvent.press(await screen.findByTestId('signup'));
      const resumed = await fetch(`${authServer}/background?ms=2500`, { method: 'POST' });
      expect(resumed.ok).toBe(true);
      expect(measurements.appStates).toContain('background');
      await waitFor(async () => expect((await networkState()).blocked.length).toBeGreaterThan(0), { timeout: 15000 });
      await waitFor(() => expect(measurements.errors.length).toBeGreaterThan(0), { timeout: 45000 });
      expect(await screen.findByTestId('tokens-0')).toBeDefined();
      const opens = measurements.opens;
      await offline(false);
      await userEvent.press(await screen.findByTestId('retry-captcha'));
      await waitFor(() => expect(measurements.opens).toBeGreaterThan(opens), { timeout: 20000 });
      expect((await (await fetch(`${authServer}/state`)).json()).sdkLoads).toBe(1);
      console.log('Challenge network recovery:', JSON.stringify({ network: await networkState(), errors: measurements.errors, opens: measurements.opens }));
      if (!passiveSiteKey) {
        await pause(1500);
        const screenshot = await screen.screenshot();
        expect(screenshot).not.toBeNull();
        const saved = await fetch(`${authServer}/network-screenshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/png' },
          body: screenshot.data,
        });
        expect(saved.ok).toBe(true);
      }
      // Finish the form with an auto-pass test key after confirming challenge recovery.
      await app.rerender(<PrewarmAuthApp passiveSiteKey={passiveSiteKey} measurements={measurements} />);
      await waitFor(() => screen.findByTestId('tokens-1'), { timeout: 15000 });
      await userEvent.type(await screen.findByTestId('password'), 'Network-pass-123');
      await waitFor(() => screen.findByTestId('password-valid'));
      await userEvent.press(await screen.findByTestId('submit'));
      await waitFor(() => screen.findByTestId('page-account'), { timeout: 20000 });
      expect((await (await fetch(`${authServer}/state`)).json()).submissions[0].verified).toBe(true);
    });
  }
});
