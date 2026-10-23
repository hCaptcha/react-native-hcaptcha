import React from 'react';
import { act, render } from '@testing-library/react-native';
import { BackHandler, Linking } from 'react-native';
import ConfirmHcaptcha, { Hcaptcha } from '../index';
import { HCAPTCHA_READY_EVENT } from '../Hcaptcha';
import { getLastInjectJavaScriptMock } from 'react-native-webview';
import { __unsafeResetJourneyRuntime, initJourneyTracking } from '../journey';

const CASES = [{ Component: ConfirmHcaptcha, name: 'wrapper' }, { Component: Hcaptcha, name: 'inline' }].flatMap((component) =>
  [false, true].map((prewarm) => ({ ...component, prewarm })));
const TOKEN = '10000000-aaaa-bbbb-cccc-000000000001';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  __unsafeResetJourneyRuntime();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  __unsafeResetJourneyRuntime();
});

test.each(CASES)('destroy clears timers, back handling, and journey ownership ($name, prewarm=$prewarm)', ({ Component, prewarm }) => {
  const ref = React.createRef();
  const onMessage = jest.fn();
  const onStats = jest.fn();
  const remove = jest.fn();
  jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
  initJourneyTracking({ onStats });
  const props = { ref, prewarm, onMessage, siteKey: 'site', userJourney: true };
  const component = render(<Component {...props} />);
  act(() => ref.current.execute());
  const retired = component.UNSAFE_getByType('WebView').props;
  act(() => retired.onMessage({ nativeEvent: { data: 'script-error' } }));
  const scriptError = onMessage.mock.calls.at(-1)[0];
  act(() => {
    ref.current.destroy();
    ref.current.destroy();
  });
  expect(component.UNSAFE_queryByType('WebView')).toBeNull();
  expect(onStats).toHaveBeenLastCalledWith(expect.objectContaining({ activeConsumers: 0 }));
  if (Component === ConfirmHcaptcha && prewarm) {
    expect(remove).toHaveBeenCalled();
  }
  component.rerender(<Component {...props} siteKey="updated" prewarm={!prewarm} />);
  component.rerender(<Component {...props} siteKey="updated" />);
  act(() => {
    scriptError.reset();
    jest.advanceTimersByTime(120001);
  });
  expect(component.UNSAFE_queryByType('WebView')).toBeNull();
  expect(onMessage).toHaveBeenCalledTimes(1);
  act(() => ref.current.execute());
  expect(onStats).toHaveBeenLastCalledWith(expect.objectContaining({ activeConsumers: 1 }));
  let current = component.UNSAFE_getByType('WebView').props;
  act(() => current.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
  const inject = getLastInjectJavaScriptMock();
  const calls = inject.mock.calls.length;
  act(() => scriptError.reset());
  expect(inject).toHaveBeenCalledTimes(calls);
  current = component.UNSAFE_getByType('WebView').props;
  act(() => current.onMessage({ nativeEvent: { data: TOKEN } }));
  const token = onMessage.mock.calls.at(-1)[0];
  act(() => ref.current.destroy());
  act(() => token.reset());
  expect(component.UNSAFE_queryByType('WebView')).toBeNull();
  act(() => jest.advanceTimersByTime(120001));
  expect(onMessage).toHaveBeenCalledTimes(2);
});

test.each(CASES)('destroy suppresses a delayed external-link failure ($name, prewarm=$prewarm)', async ({ Component, prewarm }) => {
  const ref = React.createRef();
  const onMessage = jest.fn();
  let rejectLink;
  jest.spyOn(Linking, 'openURL').mockReturnValue(new Promise((resolve, reject) => { rejectLink = reject; }));
  const component = render(<Component ref={ref} prewarm={prewarm} siteKey="site" onMessage={onMessage} />);
  act(() => ref.current.execute());
  const retired = component.UNSAFE_getByType('WebView').props;
  expect(retired.onShouldStartLoadWithRequest({ url: 'sms:123' })).toBe(false);
  act(() => ref.current.destroy());
  act(() => ref.current.execute());
  await act(async () => rejectLink(new Error('retired link')));
  expect(onMessage).not.toHaveBeenCalled();
  expect(retired.onShouldStartLoadWithRequest({ url: 'https://www.hcaptcha.com/privacy' })).toBe(false);
  expect(Linking.openURL).toHaveBeenCalledTimes(1);
});

test.each([1, 3])('destroy cancels token timers retained by %s default-mode hide cycles', (cycles) => {
  const ref = React.createRef();
  const onMessage = jest.fn();
  const component = render(<ConfirmHcaptcha ref={ref} siteKey="site" onMessage={onMessage} />);
  for (let cycle = 0; cycle < cycles; cycle++) {
    act(() => ref.current.show());
    act(() => component.UNSAFE_getByType('WebView').props.onMessage({ nativeEvent: { data: TOKEN } }));
    act(() => ref.current.hide());
  }
  expect(onMessage).toHaveBeenCalledTimes(cycles);
  act(() => ref.current.destroy());
  act(() => jest.advanceTimersByTime(120001));
  expect(onMessage).toHaveBeenCalledTimes(cycles);
  expect(component.UNSAFE_queryByType('WebView')).toBeNull();
});
