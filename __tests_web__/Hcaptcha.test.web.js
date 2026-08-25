import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';

import Hcaptcha from '../Hcaptcha';

const SITE_KEY = '00000000-0000-0000-0000-000000000000';
const TOKEN = 'P0_eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.a-token-longer-than-thirty-five-chars';

const defaultProps = {
  siteKey: SITE_KEY,
  onMessage: () => {},
  showLoading: false,
};

/**
 * Renders and lets the mocked loader promise settle, so the widget is mounted.
 */
const renderAndLoad = async (props = {}) => {
  const result = render(<Hcaptcha {...defaultProps} {...props} />);
  await act(async () => {});
  return result;
};

beforeEach(() => {
  jest.useFakeTimers();
  global.__resetHcaptchaMock();
});

afterEach(() => {
  cleanup();
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('Hcaptcha on web', () => {
  it('renders a real DOM container rather than a WebView', async () => {
    await renderAndLoad();

    const container = screen.getByTestId('hcaptcha-container');
    expect(container).toBeTruthy();
    expect(container.tagName).toBe('DIV');
    expect(global.__hcaptcha.renderTarget).toBe(container);
  });

  it('matches the rendered DOM snapshot', async () => {
    const { container } = await renderAndLoad({ showLoading: true });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('configures the loader from the component props', async () => {
    await renderAndLoad({
      languageCode: 'de',
      jsSrc: 'https://example.test/1/api.js',
      endpoint: 'https://endpoint.test',
      assethost: 'https://assets.test',
      imghost: 'https://imgs.test',
      reportapi: 'https://report.test',
      sentry: true,
    });

    expect(global.__hcaptcha.lastLoaderConfig).toMatchObject({
      scriptSource: 'https://example.test/1/api.js',
      render: 'explicit',
      host: `${SITE_KEY}.react-native.hcaptcha.com`,
      hl: 'de',
      custom: false,
      sentry: true,
      endpoint: 'https://endpoint.test',
      assethost: 'https://assets.test',
      imghost: 'https://imgs.test',
      reportapi: 'https://report.test',
    });
  });

  it('renders the widget with the normalized size, theme and orientation', async () => {
    await renderAndLoad({ size: 'checkbox', theme: 'dark', orientation: 'landscape' });

    expect(global.__hcaptcha.renderConfig).toMatchObject({
      sitekey: SITE_KEY,
      size: 'normal',
      theme: 'dark',
      orientation: 'landscape',
    });
  });

  it('parses a stringified custom theme and flags it to the loader', async () => {
    await renderAndLoad({ theme: '{"palette":{"grey":{"100":"#fff"}}}' });

    expect(global.__hcaptcha.lastLoaderConfig.custom).toBe(true);
    expect(global.__hcaptcha.renderConfig.theme).toEqual({ palette: { grey: { 100: '#fff' } } });
  });

  it('sets verify data and executes once the widget is rendered', async () => {
    await renderAndLoad({
      rqdata: 'some-rqdata',
      phonePrefix: '44',
      phoneNumber: '+441234567890',
    });

    expect(global.__hcaptcha.setDataCalls).toEqual([
      {
        widgetId: 'test-widget-id',
        data: {
          rqdata: 'some-rqdata',
          mfa_phoneprefix: '44',
          mfa_phone: '+441234567890',
        },
      },
    ]);
    expect(global.__hcaptcha.executeCount).toBe(1);
  });

  it('prefers verifyParams over the legacy props', async () => {
    await renderAndLoad({
      rqdata: 'legacy',
      verifyParams: { rqdata: 'preferred' },
    });

    expect(global.__hcaptcha.setDataCalls[0].data).toEqual({ rqdata: 'preferred' });
  });

  it('delivers a token as a successful message carrying markUsed and reset', async () => {
    const onMessage = jest.fn();
    await renderAndLoad({ onMessage });

    act(() => {
      global.__hcaptcha.fire('callback', TOKEN);
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    const event = onMessage.mock.calls[0][0];
    expect(event.nativeEvent.data).toBe(TOKEN);
    expect(event.success).toBe(true);
    expect(typeof event.markUsed).toBe('function');
    expect(typeof event.reset).toBe('function');
  });

  it('reports the token as expired after the token timeout', async () => {
    const onMessage = jest.fn();
    await renderAndLoad({ onMessage });

    act(() => {
      global.__hcaptcha.fire('callback', TOKEN);
    });
    onMessage.mockClear();

    act(() => {
      jest.advanceTimersByTime(120000);
    });

    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      nativeEvent: { data: 'expired' },
      success: false,
    }));
  });

  it('does not report expiry once the token is marked used', async () => {
    const onMessage = jest.fn();
    await renderAndLoad({ onMessage });

    act(() => {
      global.__hcaptcha.fire('callback', TOKEN);
    });
    onMessage.mock.calls[0][0].markUsed();
    onMessage.mockClear();

    act(() => {
      jest.advanceTimersByTime(120000);
    });

    expect(onMessage).not.toHaveBeenCalled();
  });

  it('maps the open callback to a successful open message', async () => {
    const onMessage = jest.fn();
    await renderAndLoad({ onMessage });

    act(() => {
      global.__hcaptcha.fire('open-callback');
    });

    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      nativeEvent: { data: 'open' },
      success: true,
    }));
  });

  it('marks close, expiry and error callbacks as failures', async () => {
    const onMessage = jest.fn();
    await renderAndLoad({ onMessage });

    act(() => {
      global.__hcaptcha.fire('close-callback');
      global.__hcaptcha.fire('expired-callback', 'expired');
      global.__hcaptcha.fire('chalexpired-callback', 'challenge-expired');
      global.__hcaptcha.fire('error-callback', 'rate-limited');
    });

    expect(onMessage.mock.calls.map(([e]) => [e.nativeEvent.data, e.success])).toEqual([
      ['challenge-closed', false],
      ['expired', false],
      ['challenge-expired', false],
      ['rate-limited', false],
    ]);
  });

  it('resets the widget and re-executes when reset is called', async () => {
    const onMessage = jest.fn();
    await renderAndLoad({ onMessage });

    act(() => {
      global.__hcaptcha.fire('error-callback', 'rate-limited');
    });

    act(() => {
      onMessage.mock.calls[0][0].reset();
    });

    expect(global.__hcaptcha.resetCount).toBe(1);
    expect(global.__hcaptcha.setDataCalls).toHaveLength(2);
    expect(global.__hcaptcha.executeCount).toBe(2);
  });

  it('surfaces a loader failure and retries the API load on reset', async () => {
    const onMessage = jest.fn();
    global.__hcaptcha.loader.shouldFail = true;
    global.__hcaptcha.loader.error = new Error('script-error');

    render(<Hcaptcha {...defaultProps} onMessage={onMessage} />);
    await act(async () => {});

    expect(onMessage).toHaveBeenCalledTimes(1);
    const event = onMessage.mock.calls[0][0];
    expect(event.nativeEvent.data).toBe('script-error');
    expect(event.success).toBe(false);
    expect(global.__hcaptcha.loadCount).toBe(1);

    // A script-error hands back a retry, not a widget reset.
    global.__hcaptcha.loader.shouldFail = false;
    await act(async () => {
      event.reset();
    });

    expect(global.__hcaptcha.loadCount).toBe(2);
    expect(global.__hcaptcha.renderCount).toBe(1);
  });

  it('reports a loading timeout when the api.js request never settles', async () => {
    const onMessage = jest.fn();
    // An api.js fetch that hangs: no resolve, no reject, so nothing else can report.
    global.__hcaptcha.loader.hang = true;

    render(<Hcaptcha {...defaultProps} onMessage={onMessage} />);
    await act(async () => {});

    expect(onMessage).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(15000);
    });

    expect(onMessage).toHaveBeenCalledWith({
      nativeEvent: { data: 'error', description: 'loading timeout' },
    });
  });

  it('stops reporting a loading timeout once the loader has already failed', async () => {
    const onMessage = jest.fn();
    global.__hcaptcha.loader.shouldFail = true;
    global.__hcaptcha.loader.error = new Error('script-error');

    render(<Hcaptcha {...defaultProps} onMessage={onMessage} />);
    await act(async () => {});

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0][0].nativeEvent.data).toBe('script-error');

    // Parity with native: any delivered message clears the loading state, so the
    // timeout does not pile a second error on top.
    act(() => {
      jest.advanceTimersByTime(15000);
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it('does not report a loading timeout after the challenge opens', async () => {
    const onMessage = jest.fn();
    await renderAndLoad({ onMessage });

    act(() => {
      global.__hcaptcha.fire('open-callback');
    });
    onMessage.mockClear();

    act(() => {
      jest.advanceTimersByTime(15000);
    });

    expect(onMessage).not.toHaveBeenCalled();
  });

  it('removes the widget on unmount', async () => {
    const { unmount } = await renderAndLoad();

    unmount();

    expect(global.__hcaptcha.removeCount).toBe(1);
  });

  it('exposes the RN version marker from Platform constants only', async () => {
    // `react-native/Libraries/Core/ReactNativeVersion` does not exist on web; the debug
    // info must still be built without it.
    await renderAndLoad({ debug: { marker: true } });

    expect(window.marker).toBe(true);
    expect(window['dep_mocked-md5']).toBe(true);
    expect(window.sdk_4_1_0).toBe(true);
  });
});
