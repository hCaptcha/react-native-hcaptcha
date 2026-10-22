import { describe, test, render, expect, waitFor } from 'react-native-harness';
import { screen, userEvent } from '@react-native-harness/ui';
import React from 'react';
import PrewarmAuthApp, { authServer } from './PrewarmAuthApp';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const serverState = async () => (await fetch(`${authServer}/state`)).json();

describe('prewarm lifecycle edges (live SDK)', () => {
  for (const expired of [false, true]) {
    test(`retains the multi-screen flow across background/resume (expired=${expired})`, async () => {
      await fetch(`${authServer}/reset`, { method: 'POST' });
      const measurements = { attempts: [], errors: [], appStates: [] };
      await render(<PrewarmAuthApp passiveSiteKey measurements={measurements} />);
      await userEvent.type(await screen.findByTestId('email'), 'resume@example.test');
      await userEvent.press(await screen.findByTestId('signup'));
      await waitFor(() => screen.findByTestId('tokens-1'), { timeout: 15000 });
      const response = await fetch(`${authServer}/background?ms=${expired ? 125000 : 2500}`, { method: 'POST' });
      expect(response.ok).toBe(true);
      await waitFor(() => expect(measurements.appStates[measurements.appStates.length - 1]).toBe('active'));
      expect(measurements.appStates).toContain('background');
      expect(await screen.findByTestId('page-credentials')).toBeDefined();
      if (expired) {
        await waitFor(() => expect(measurements.errors.some((event) => event.data === 'expired')).toBe(true));
        await userEvent.press(await screen.findByTestId('cancel'));
        await userEvent.press(await screen.findByTestId('signup'));
        await waitFor(() => screen.findByTestId('tokens-2'), { timeout: 15000 });
      }
      await userEvent.type(await screen.findByTestId('password'), 'Resume-pass-123');
      await waitFor(() => screen.findByTestId('password-valid'));
      await userEvent.press(await screen.findByTestId('submit'));
      await waitFor(() => screen.findByTestId('page-account'), { timeout: 20000 });
      const state = await serverState();
      expect(state.sdkLoads).toBe(1);
      expect(state.submissions).toHaveLength(1);
      expect(state.submissions[0].verified).toBe(true);
      if (!expired) {
        expect(measurements.errors).toEqual([]);
      }
    });
  }

  test('does not execute when a timed-out SDK eventually loads', async () => {
    await fetch(`${authServer}/reset`, { method: 'POST' });
    const measurements = { attempts: [], errors: [] };
    await render(<PrewarmAuthApp slowSdk passiveSiteKey hideOnError={false} measurements={measurements} />);
    await userEvent.type(await screen.findByTestId('email'), 'timeout@example.test');
    await userEvent.press(await screen.findByTestId('signup'));
    await waitFor(() => expect(measurements.errors).toHaveLength(1), { timeout: 18000 });
    await fetch(`${authServer}/release-sdk`, { method: 'POST' });
    await pause(5000);
    expect(await screen.findByTestId('tokens-0')).toBeDefined();
    expect(measurements.errors).toHaveLength(1);
    await userEvent.press(await screen.findByTestId('retry-captcha'));
    await waitFor(() => screen.findByTestId('tokens-1'), { timeout: 15000 });
    expect((await serverState()).sdkLoads).toBe(1);
  });

  for (const interruption of ['cancel', 'renderer crash', 'prewarm mode change', 'presentation change']) {
    test(`recovers when verification is pending during ${interruption}`, async () => {
      await fetch(`${authServer}/reset`, { method: 'POST' });
      const measurements = { attempts: [], errors: [] };
      const app = await render(<PrewarmAuthApp
        deferredToken
        passiveSiteKey={interruption !== 'prewarm mode change'}
        prewarm={interruption !== 'prewarm mode change'}
        measurements={measurements}
      />);
      await userEvent.type(await screen.findByTestId('email'), 'pending@example.test');
      await userEvent.press(await screen.findByTestId('signup'));
      await waitFor(async () => expect((await serverState()).tokensIssued).toBe(1), { timeout: 15000 });
      if (interruption === 'cancel') {
        await userEvent.press(await screen.findByTestId('cancel'));
        // The observer deliberately delivers a real SDK token after reset.
        await pause(11000);
        expect(await screen.findByTestId('tokens-0')).toBeDefined();
        expect(await screen.findByTestId('page-welcome')).toBeDefined();
        await userEvent.press(await screen.findByTestId('signup'));
      } else if (interruption === 'renderer crash') {
        const response = await fetch(`${authServer}/crash-renderer`, { method: 'POST' });
        expect(response.ok).toBe(true);
      } else {
        await app.rerender(<PrewarmAuthApp deferredToken measurements={measurements} />);
      }
      await waitFor(() => screen.findByTestId('tokens-1'), { timeout: 25000 });
      await userEvent.type(await screen.findByTestId('password'), 'Pending-pass-123');
      await waitFor(() => screen.findByTestId('password-valid'));
      await userEvent.press(await screen.findByTestId('submit'));
      await waitFor(() => screen.findByTestId('page-account'), { timeout: 20000 });
      const state = await serverState();
      expect(state.sdkLoads).toBe(['cancel', 'presentation change'].includes(interruption) ? 1 : 2);
      expect(state.tokensIssued).toBe(interruption === 'presentation change' ? 1 : 2);
      expect(state.submissions).toHaveLength(1);
      expect(state.submissions[0].verified).toBe(true);
      expect(measurements.errors).toEqual([]);
    });
  }

  for (const expired of [false, true]) {
    test(`handles a delayed auth response after ${expired ? 'token expiry' : 'navigation away'}`, async () => {
      await fetch(`${authServer}/reset`, { method: 'POST' });
      const measurements = { attempts: [], errors: [], appStates: [] };
      await render(<PrewarmAuthApp passiveSiteKey measurements={measurements} />);
      await userEvent.type(await screen.findByTestId('email'), 'delayed@example.test');
      await userEvent.press(await screen.findByTestId('signup'));
      await waitFor(() => screen.findByTestId('tokens-1'), { timeout: 15000 });
      await userEvent.type(await screen.findByTestId('password'), 'Delayed-pass-123');
      await waitFor(() => screen.findByTestId('password-valid'));
      await fetch(`${authServer}/hold-auth`, { method: 'POST' });
      await userEvent.press(await screen.findByTestId('submit'));
      await waitFor(async () => expect((await serverState()).submissions).toHaveLength(1));
      if (expired) {
        const response = await fetch(`${authServer}/background?ms=125000`, { method: 'POST' });
        expect(response.ok).toBe(true);
        await waitFor(() => expect(measurements.errors.some((event) => event.data === 'expired')).toBe(true));
        expect(await screen.findByTestId('page-credentials')).toBeDefined();
      } else {
        await userEvent.press(await screen.findByTestId('cancel'));
      }
      await fetch(`${authServer}/release-auth`, { method: 'POST' });
      if (expired) {
        await waitFor(() => screen.findByTestId('page-account'));
      } else {
        await pause(1000);
        expect(await screen.findByTestId('page-welcome')).toBeDefined();
      }
      expect((await serverState()).submissions[0].verified).toBe(true);
    });
  }
});
