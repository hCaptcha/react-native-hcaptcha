import { describe, test, render, expect, waitFor } from 'react-native-harness';
import { screen, userEvent } from '@react-native-harness/ui';
import React from 'react';
import PrewarmAuthApp, { authServer } from './PrewarmAuthApp';

describe('live SDK multi-screen auth flow', () => {
  for (const passiveSiteKey of [false, true]) {
    test(`signs up and logs in after destroying the warmed WebView (passiveSiteKey=${passiveSiteKey})`, async () => {
      await fetch(`${authServer}/reset`, { method: 'POST' });
      await render(<PrewarmAuthApp destroyOnLeave destroyAfterToken passiveSiteKey={passiveSiteKey} />);
      await userEvent.type(await screen.findByTestId('email'), 'destroy@example.test');
      for (const [attempt, mode] of ['signup', 'login'].entries()) {
        await userEvent.press(await screen.findByTestId(mode));
        await waitFor(() => screen.findByTestId(`tokens-${attempt + 1}`), { timeout: 30000 });
        await waitFor(() => expect(screen.queryByTestId('confirm-hcaptcha-prewarm')).toBeNull());
        await userEvent.type(await screen.findByTestId('password'), 'Destroy-password-123');
        await waitFor(() => screen.findByTestId('password-valid'));
        await userEvent.press(await screen.findByTestId('submit'));
        await waitFor(() => screen.findByTestId('page-account'), { timeout: 20000 });
        const state = await (await fetch(`${authServer}/state`)).json();
        expect(state.sdkLoads).toBe(attempt + 1);
        expect(state.submissions).toHaveLength(attempt + 1);
        expect(state.submissions.every((submission) => submission.verified)).toBe(true);
        await userEvent.press(await screen.findByTestId('logout'));
        await waitFor(() => expect(screen.queryByTestId('confirm-hcaptcha-prewarm')).toBeNull());
      }
    });
  }

  for (const passiveSiteKey of [false, true]) {
    test(`prewarms, signs up, and logs in without reloading (passiveSiteKey=${passiveSiteKey})`, async () => {
      await fetch(`${authServer}/reset`, { method: 'POST' });
      await render(<PrewarmAuthApp passiveSiteKey={passiveSiteKey} />);
      await waitFor(
        async () => {
          const state = await (await fetch(`${authServer}/state`)).json();
          expect(state.sdkLoads).toBe(1);
          expect(state.submissions).toEqual([]);
        },
        { timeout: 15000 }
      );
      await userEvent.type(await screen.findByTestId('email'), 'eli@example.test');
      expect(await screen.findByTestId('tokens-0')).toBeDefined();

      for (const [attempt, mode] of ['signup', 'login'].entries()) {
        await userEvent.press(await screen.findByTestId(mode));
        await waitFor(() => screen.findByTestId(`tokens-${attempt + 1}`), {
          timeout: 30000,
        });
        await userEvent.type(await screen.findByTestId('password'), 'Example-password-123');
        await waitFor(() => screen.findByTestId('password-valid'));
        // A user can edit the form after receiving the token, before submitting it.
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const beforeSubmit = await (await fetch(`${authServer}/state`)).json();
        expect(beforeSubmit.submissions).toHaveLength(attempt);
        expect(beforeSubmit.sdkLoads).toBe(1);

        await userEvent.press(await screen.findByTestId('submit'));
        await waitFor(() => screen.findByTestId('page-account'), {
          timeout: 20000,
        });
        const state = await (await fetch(`${authServer}/state`)).json();
        expect(state.submissions[attempt]).toEqual({
          route: `/${mode}`,
          email: 'eli@example.test',
          token: '10000000-aaaa-bbbb-cccc-000000000001',
          verified: true,
        });
        expect(state.sdkLoads).toBe(1);
        await userEvent.press(await screen.findByTestId('logout'));
        await waitFor(() => screen.findByTestId('page-welcome'));
      }
    });
  }

  test('cancels queued verification and reuses the warmed SDK on retry', async () => {
    await fetch(`${authServer}/reset`, { method: 'POST' });
    await render(<PrewarmAuthApp slowSdk passiveSiteKey />);
    await userEvent.type(await screen.findByTestId('email'), 'cancel@example.test');
    await userEvent.press(await screen.findByTestId('signup'));
    await userEvent.press(await screen.findByTestId('cancel'));
    await fetch(`${authServer}/release-sdk`, { method: 'POST' });
    await waitFor(async () => {
      const state = await (await fetch(`${authServer}/state`)).json();
      expect(state.sdkReady).toBe(1);
    }, { timeout: 30000 });
    expect(await screen.findByTestId('page-welcome')).toBeDefined();
    expect(await screen.findByTestId('tokens-0')).toBeDefined();
    await userEvent.press(await screen.findByTestId('signup'));
    await waitFor(() => screen.findByTestId('tokens-1'), { timeout: 30000 });
    const state = await (await fetch(`${authServer}/state`)).json();
    expect(state.sdkLoads).toBe(1);
    expect(state.submissions).toEqual([]);
  });

  test('fetches a fresh token after the backend rejects credentials', async () => {
    await fetch(`${authServer}/reset`, { method: 'POST' });
    const measurements = { attempts: [], errors: [], authErrors: [] };
    await render(<PrewarmAuthApp passiveSiteKey measurements={measurements} />);
    await userEvent.type(await screen.findByTestId('email'), 'retry@example.test');
    for (const [mode, password, tokenCount] of [['signup', 'Password-123', 1], ['login', 'Password', 2]]) {
      await userEvent.press(await screen.findByTestId(mode));
      await waitFor(() => screen.findByTestId(`tokens-${tokenCount}`), { timeout: 15000 });
      await userEvent.type(await screen.findByTestId('password'), password);
      await waitFor(() => screen.findByTestId('password-valid'));
      await userEvent.press(await screen.findByTestId('submit'));
      if (mode === 'signup') {
        await waitFor(() => screen.findByTestId('page-account'), { timeout: 20000 });
        await userEvent.press(await screen.findByTestId('logout'));
      } else {
        await waitFor(() => expect(measurements.authErrors).toEqual(['Invalid credentials']), { timeout: 20000 });
      }
    }
    await userEvent.press(await screen.findByTestId('retry-captcha'));
    await waitFor(() => expect(measurements.attempts).toHaveLength(3));
    await waitFor(() => screen.findByTestId('tokens-3'), { timeout: 15000 });
    await userEvent.type(await screen.findByTestId('password'), 'Password-123');
    await waitFor(() => screen.findByTestId('password-valid'));
    await userEvent.press(await screen.findByTestId('submit'));
    await waitFor(() => screen.findByTestId('page-account'), { timeout: 20000 });
    const state = await (await fetch(`${authServer}/state`)).json();
    expect(state.sdkLoads).toBe(1);
    expect(state.submissions).toHaveLength(3);
    expect(state.submissions.every((submission) => submission.verified)).toBe(true);
    expect(measurements.errors).toEqual([]);
  });
});
