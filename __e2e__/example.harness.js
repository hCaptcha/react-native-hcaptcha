import React from 'react';
import { Platform } from 'react-native';
import { describe, test, render, expect, waitFor, spyOn, beforeEach, afterEach } from 'react-native-harness';
import { screen, userEvent } from '@react-native-harness/ui';
import App from '../App';
import AutopassExample from './ExampleAutopass';
import { authServer } from './PrewarmAuthApp';

async function saveScreenshot(phase) {
  const screenshot = await screen.screenshot();
  expect(screenshot).not.toBeNull();
  const saved = await fetch(`${authServer}/example-screenshot?phase=${phase}`, {
    method: 'POST', headers: { 'Content-Type': 'image/png' }, body: screenshot.data,
  });
  expect(saved.ok).toBe(true);
}

async function launchExample(log) {
  await waitFor(() => expect(screen.queryByTestId('confirm-hcaptcha-backdrop')).toBeNull(), { timeout: 10000 });
  const messages = log.mock.calls.length;
  // A dismissing native Modal can swallow a tap after its React children unmount.
  // Retry only until a new modal or app callback confirms that the tap arrived.
  await waitFor(async () => {
    if (screen.queryByTestId('confirm-hcaptcha-backdrop') || log.mock.calls.length > messages) {
      return;
    }
    await userEvent.press(await screen.findByTestId('example-launch'));
    expect(Boolean(screen.queryByTestId('confirm-hcaptcha-backdrop')) || log.mock.calls.length > messages).toBe(true);
  }, { timeout: 10000, interval: 500 });
}

describe('original repository example', () => {
  let log;
  beforeEach(() => { log = spyOn(console, 'log'); });
  afterEach(() => log.mockRestore());

  test('opens, dismisses, and reopens the live demo challenge', async () => {
    await render(<App />);
    for (const attempt of [1, 2]) {
      await launchExample(log);
      await waitFor(() => expect(log.mock.calls.filter(([message]) => message === 'Visual challenge opened')).toHaveLength(attempt), { timeout: 30000 });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await saveScreenshot('challenge');
      if (Platform.OS === 'android') {
        expect((await fetch(`${authServer}/android-back`, { method: 'POST' })).ok).toBe(true);
      } else {
        await userEvent.pressAt(10, 100);
      }
      await waitFor(() => expect(log.mock.calls.filter(([message]) => message === 'Verification failed')).toHaveLength(attempt), { timeout: 5000 });
      expect(log.mock.calls.at(-1)[1]).toBe(Platform.OS === 'android' ? 'cancel' : 'challenge-closed');
      expect(await screen.findByTestId('example-status')).toBeDefined();
      await new Promise((resolve) => setTimeout(resolve, 500)); // Native Modal fade-out.
    }
  });

  // Generated from Example.App.js; only the sitekey changes to the public auto-pass key.
  test('displays valid tokens and allows a second launch with the auto-pass key', async () => {
    await fetch(`${authServer}/reset`, { method: 'POST' });
    await render(<AutopassExample />);
    for (const attempt of [1, 2]) {
      await launchExample(log);
      await waitFor(() => expect(log.mock.calls.filter(([message]) => message === 'Verified code from hCaptcha')).toHaveLength(attempt), { timeout: 30000 });
      const token = log.mock.calls.filter(([message]) => message === 'Verified code from hCaptcha').at(-1)[1];
      expect(token).toBe('10000000-aaaa-bbbb-cccc-000000000001');
      expect(await screen.findByTestId('example-status')).toBeDefined();
      const verified = await fetch(`${authServer}/signup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `original-example-${attempt}@example.test`, password: 'Example-password-123', token }),
      });
      expect(verified.ok).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    expect(log.mock.calls.filter(([message]) => message === 'Verification failed')).toEqual([]);
    expect((await (await fetch(`${authServer}/state`)).json()).submissions.every((entry) => entry.verified)).toBe(true);
    await saveScreenshot('token');
  });
});
