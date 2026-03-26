import React from 'react';
import vm from 'vm';
import { act, render, waitFor } from '@testing-library/react-native';
import { ActivityIndicator, Linking, TouchableWithoutFeedback } from 'react-native';

import Hcaptcha from '../Hcaptcha';
import {
  getLastInjectJavaScriptMock,
  resetWebViewMockState,
  setWebViewMessageData,
} from 'react-native-webview';

const LONG_TOKEN = '10000000-aaaa-bbbb-cccc-000000000001';

describe('Hcaptcha', () => {
  const getWebView = (component) => component.UNSAFE_getByType('WebView');
  const getWebViewHtml = (component) => getWebView(component).props.source.html;
  const getSerializedConfig = (component) => {
    const match = getWebViewHtml(component).match(/var hcaptchaConfig = (.*?);\n\s*Object\.entries/s);

    expect(match).not.toBeNull();

    return JSON.parse(match[1]);
  };
  const getApiQueryParams = (component) =>
    Object.fromEntries(new URL(getSerializedConfig(component).apiUrl).searchParams.entries());
  const getInlineScripts = (component) =>
    [...getWebViewHtml(component).matchAll(/<script type="text\/javascript">([\s\S]*?)<\/script>/g)]
      .map((match) => match[1]);

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useRealTimers();
    resetWebViewMockState();
  });

  it('renders Hcaptcha with minimum props', () => {
    const component = render(<Hcaptcha url="https://hcaptcha.com" />);

    expect(component).toMatchSnapshot();
  });

  it('maps every Hcaptcha prop into WebView props, serialized config, and query params', () => {
    const style = { borderWidth: 2 };
    const debug = { customDebug: 'enabled' };
    const onMessage = jest.fn();
    const component = render(
      <Hcaptcha
        onMessage={onMessage}
        size="normal"
        siteKey="00000000-0000-0000-0000-000000000000"
        style={style}
        url="https://base.url"
        languageCode="fr"
        showLoading={true}
        closableLoading={true}
        loadingIndicatorColor="#123456"
        backgroundColor="rgba(0.1, 0.1, 0.1, 0.4)"
        theme="contrast"
        rqdata='{"some":"data"}'
        sentry={true}
        jsSrc="https://all.props/api-endpoint"
        endpoint="https://all.props/endpoint"
        reportapi="https://all.props/reportapi"
        assethost="https://all.props/assethost"
        imghost="https://all.props/imghost"
        host="all-props-host"
        debug={debug}
        orientation="landscape"
        phonePrefix="44"
        phoneNumber="+441234567890"
      />
    );

    const webView = getWebView(component);
    const config = getSerializedConfig(component);
    const query = getApiQueryParams(component);
    const activityIndicator = component.UNSAFE_getByType(ActivityIndicator);

    expect(webView.props.source.baseUrl).toBe('https://base.url');
    expect(webView.props.style).toEqual([
      { backgroundColor: 'transparent', width: '100%' },
      style,
    ]);
    expect(webView.props.originWhitelist).toEqual(['*']);
    expect(webView.props.mixedContentMode).toBe('always');
    expect(webView.props.javaScriptEnabled).toBe(true);
    expect(webView.props.automaticallyAdjustContentInsets).toBe(true);
    expect(webView.props.injectedJavaScript).toContain('window.ReactNativeWebView.postMessage = patchedPostMessage;');
    expect(activityIndicator.props.color).toBe('#123456');

    expect(config.siteKey).toBe('00000000-0000-0000-0000-000000000000');
    expect(config.size).toBe('normal');
    expect(config.backgroundColor).toBe('rgba(0.1, 0.1, 0.1, 0.4)');
    expect(config.theme).toBe('contrast');
    expect(config.rqdata).toBe('{"some":"data"}');
    expect(config.phonePrefix).toBe('44');
    expect(config.phoneNumber).toBe('+441234567890');
    expect(config.debugInfo).toMatchObject({
      customDebug: 'enabled',
      rnver_0_0_0: true,
      'dep_mocked-md5': true,
      sdk_3_0_1: true,
    });

    expect(query).toMatchObject({
      render: 'explicit',
      onload: 'onloadCallback',
      host: 'all-props-host',
      hl: 'fr',
      sentry: 'true',
      endpoint: 'https://all.props/endpoint',
      assethost: 'https://all.props/assethost',
      imghost: 'https://all.props/imghost',
      reportapi: 'https://all.props/reportapi',
      orientation: 'landscape',
    });
    expect(query.custom).toBeUndefined();
  });

  it('normalizes the legacy checkbox size alias to the JS SDK normal size', () => {
    const component = render(
      <Hcaptcha
        size="checkbox"
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
      />
    );

    expect(getSerializedConfig(component).size).toBe('normal');
  });

  it('normalizes object and JSON-string themes into object config and custom=true query params', () => {
    const customTheme = {
      palette: {
        mode: 'dark',
        primary: { main: '#26C6DA' },
      },
    };

    [
      customTheme,
      JSON.stringify(customTheme),
    ].forEach((theme) => {
      const component = render(
        <Hcaptcha
          siteKey="00000000-0000-0000-0000-000000000000"
          url="https://hcaptcha.com"
          languageCode="en"
          theme={theme}
        />
      );

      expect(getSerializedConfig(component).theme).toEqual(customTheme);
      expect(getApiQueryParams(component).custom).toBe('true');
    });
  });

  it('loads the external api script dynamically and preserves the onload render/execute flow', () => {
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        languageCode="en"
        theme={JSON.stringify({ palette: { mode: 'dark' } })}
        rqdata='{"some":"data"}'
        phonePrefix="44"
        phoneNumber="+441234567890"
      />
    );
    const config = getSerializedConfig(component);
    const appendedScripts = [];
    const renderMock = jest.fn(() => 'widget-id');
    const executeMock = jest.fn();
    const postMessageMock = jest.fn();
    const sandbox = {
      console: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      document: {
        body: { style: {} },
        createElement: jest.fn(() => ({})),
        head: {
          appendChild: jest.fn((node) => {
            appendedScripts.push(node);
          }),
        },
      },
      hcaptcha: {
        render: renderMock,
        execute: executeMock,
      },
      window: null,
    };

    sandbox.window = sandbox;
    sandbox.window.ReactNativeWebView = { postMessage: postMessageMock };

    const context = vm.createContext(sandbox);
    const [bootstrapScript, runtimeScript] = getInlineScripts(component);

    vm.runInContext(bootstrapScript, context);
    vm.runInContext(runtimeScript, context);

    expect(appendedScripts).toHaveLength(1);
    expect(appendedScripts[0]).toMatchObject({
      async: true,
      defer: true,
      src: config.apiUrl,
    });
    expect(typeof context.onloadCallback).toBe('function');
    expect(new URL(appendedScripts[0].src).searchParams.get('onload')).toBe('onloadCallback');

    context.onloadCallback();

    expect(renderMock).toHaveBeenCalledWith('hcaptcha-container', expect.objectContaining({
      sitekey: '00000000-0000-0000-0000-000000000000',
      size: 'invisible',
      theme: { palette: { mode: 'dark' } },
      callback: expect.any(Function),
      'close-callback': expect.any(Function),
      'open-callback': expect.any(Function),
      'expired-callback': expect.any(Function),
      'chalexpired-callback': expect.any(Function),
      'error-callback': expect.any(Function),
    }));
    expect(executeMock).toHaveBeenCalledWith({
      rqdata: '{"some":"data"}',
      mfa_phoneprefix: '44',
      mfa_phone: '+441234567890',
    });

    const renderConfig = renderMock.mock.calls[0][1];
    renderConfig['open-callback']();
    expect(context.document.body.style.backgroundColor).toBe(config.backgroundColor);
    expect(postMessageMock).toHaveBeenCalledWith('open');
  });

  it('serializes every HTML-facing prop safely before embedding it', () => {
    const theme = {
      palette: {
        mode: '</script><script>alert("theme")</script>',
      },
    };
    const component = render(
      <Hcaptcha
        siteKey={'site"</script><script>alert("site")</script>'}
        url="https://hcaptcha.com"
        languageCode={'en"</script><script>alert("lang")</script>'}
        backgroundColor={'red\';window.ReactNativeWebView.postMessage("bg");//'}
        theme={theme}
        rqdata={'";window.ReactNativeWebView.postMessage("rqdata");//</script><script>alert("rqdata")</script>'}
        sentry={true}
        jsSrc={'https://example.com/api.js?x=</script><script>alert("src")</script>'}
        endpoint={'https://example.com/endpoint?</script><script>alert("endpoint")</script>'}
        reportapi={'https://example.com/reportapi?</script><script>alert("reportapi")</script>'}
        assethost={'https://example.com/assethost?</script><script>alert("asset")</script>'}
        imghost={'https://example.com/imghost?</script><script>alert("image")</script>'}
        host={'host"</script><script>alert("host")</script>'}
        debug={{
          '</script><script>alert("debug")</script>': '</script><script>alert("value")</script>',
        }}
        orientation={'landscape"</script><script>alert("orientation")</script>'}
        phonePrefix={'44";window.ReactNativeWebView.postMessage("prefix");//'}
        phoneNumber={'+44123\');window.ReactNativeWebView.postMessage("phone");//'}
      />
    );

    const html = getWebViewHtml(component);
    const config = getSerializedConfig(component);
    const query = getApiQueryParams(component);

    expect(html).toContain('var hcaptchaConfig = ');
    expect(html).toContain('const rqdata = hcaptchaConfig.rqdata;');
    expect(html).toContain('const phonePrefix = hcaptchaConfig.phonePrefix;');
    expect(html).toContain('const phoneNumber = hcaptchaConfig.phoneNumber;');
    expect(html).not.toContain('<script src=');
    expect(html).not.toContain('</script><script>alert("site")</script>');
    expect(html).not.toContain('const rqdata = ";window.ReactNativeWebView.postMessage("rqdata")');
    expect(html).toContain('\\u003c/script\\u003e\\u003cscript\\u003ealert(\\"site\\")\\u003c/script\\u003e');
    expect(html).toContain('\\u003c/script\\u003e\\u003cscript\\u003ealert(\\"debug\\")\\u003c/script\\u003e');

    expect(config.siteKey).toBe('site"</script><script>alert("site")</script>');
    expect(config.backgroundColor).toBe('red\';window.ReactNativeWebView.postMessage("bg");//');
    expect(config.rqdata).toBe('";window.ReactNativeWebView.postMessage("rqdata");//</script><script>alert("rqdata")</script>');
    expect(config.phonePrefix).toBe('44";window.ReactNativeWebView.postMessage("prefix");//');
    expect(config.phoneNumber).toBe('+44123\');window.ReactNativeWebView.postMessage("phone");//');
    expect(config.theme).toEqual(theme);
    expect(config.debugInfo['</script><script>alert("debug")</script>']).toBe('</script><script>alert("value")</script>');

    expect(query.hl).toBe('en"</script><script>alert("lang")</script>');
    expect(query.host).toBe(encodeURIComponent('host"</script><script>alert("host")</script>'));
    expect(query.endpoint).toBe('https://example.com/endpoint?</script><script>alert("endpoint")</script>');
    expect(query.reportapi).toBe('https://example.com/reportapi?</script><script>alert("reportapi")</script>');
    expect(query.assethost).toBe('https://example.com/assethost?</script><script>alert("asset")</script>');
    expect(query.imghost).toBe('https://example.com/imghost?</script><script>alert("image")</script>');
    expect(query.orientation).toBe('landscape"</script><script>alert("orientation")</script>');
    expect(query.sentry).toBe('true');
    expect(query.custom).toBe('true');
  });

  it('does not render a loading overlay when showLoading is false', () => {
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        showLoading={false}
      />
    );

    expect(component.UNSAFE_queryByType(TouchableWithoutFeedback)).toBeNull();
    expect(component.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
  });

  it('only allows dismissing the loading overlay when closableLoading is true', () => {
    const onMessage = jest.fn();
    const nonClosable = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        showLoading={true}
        closableLoading={false}
        onMessage={onMessage}
      />
    );
    const nonClosableTouchTarget = nonClosable.UNSAFE_getByType(TouchableWithoutFeedback);

    act(() => {
      nonClosableTouchTarget.props.onPress();
    });

    expect(onMessage).not.toHaveBeenCalled();

    const closable = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        showLoading={true}
        closableLoading={true}
        onMessage={onMessage}
      />
    );
    const closableTouchTarget = closable.UNSAFE_getByType(TouchableWithoutFeedback);

    act(() => {
      closableTouchTarget.props.onPress();
    });

    expect(onMessage).toHaveBeenCalledWith({ nativeEvent: { data: 'cancel' } });
  });

  it('emits a loading timeout while the challenge is still loading', () => {
    jest.useFakeTimers();
    const onMessage = jest.fn();

    render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        onMessage={onMessage}
      />
    );

    act(() => {
      jest.advanceTimersByTime(15000);
    });

    expect(onMessage).toHaveBeenCalledWith({
      nativeEvent: {
        data: 'error',
        description: 'loading timeout',
      },
    });
  });

  it('forwards open messages, marks them as successful, and hides the loading overlay', async () => {
    const onMessage = jest.fn();
    setWebViewMessageData('open');
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        showLoading={true}
        onMessage={onMessage}
      />
    );

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        reset: expect.any(Function),
        nativeEvent: expect.objectContaining({ data: 'open' }),
      }));
    });

    expect(component.UNSAFE_queryByType(TouchableWithoutFeedback)).toBeNull();
  });

  it('forwards token messages with reset and markUsed hooks', async () => {
    jest.useFakeTimers();
    const onMessage = jest.fn();
    setWebViewMessageData(LONG_TOKEN);

    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        onMessage={onMessage}
      />
    );

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        reset: expect.any(Function),
        markUsed: expect.any(Function),
        nativeEvent: expect.objectContaining({ data: LONG_TOKEN }),
      }));
    });

    const [{ reset, markUsed }] = onMessage.mock.calls[0];

    reset();
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith('onloadCallback();');

    act(() => {
      getWebView(component).props.onMessage({ nativeEvent: { data: 'open' } });
    });

    markUsed();
    act(() => {
      jest.advanceTimersByTime(120000);
    });

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      success: true,
      nativeEvent: expect.objectContaining({ data: 'open' }),
    }));
  });

  it('emits an expired message when a forwarded token is not marked used', async () => {
    jest.useFakeTimers();
    const onMessage = jest.fn();
    setWebViewMessageData(LONG_TOKEN);

    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        onMessage={onMessage}
      />
    );

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledTimes(1);
    });

    act(() => {
      getWebView(component).props.onMessage({ nativeEvent: { data: 'open' } });
    });

    act(() => {
      jest.advanceTimersByTime(120000);
    });

    expect(onMessage).toHaveBeenNthCalledWith(3, {
      nativeEvent: { data: 'expired' },
      success: false,
      reset: expect.any(Function),
    });
  });

  it('marks short non-open messages as errors', async () => {
    const onMessage = jest.fn();
    setWebViewMessageData('webview-error');

    render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        onMessage={onMessage}
      />
    );

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        reset: expect.any(Function),
        nativeEvent: expect.objectContaining({ data: 'webview-error' }),
      }));
    });
  });

  it('opens hcaptcha links externally and blocks navigation in the WebView', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
      />
    );

    const shouldStart = getWebView(component).props.onShouldStartLoadWithRequest({
      url: 'https://www.hcaptcha.com/privacy',
    });

    expect(shouldStart).toBe(false);
    expect(openURL).toHaveBeenCalledWith('https://www.hcaptcha.com/privacy');
  });

  it('opens sms links externally and reports failures back through onMessage', async () => {
    const openURL = jest.spyOn(Linking, 'openURL');
    const onMessage = jest.fn();
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        onMessage={onMessage}
      />
    );

    openURL.mockResolvedValueOnce(true);
    const successfulSms = getWebView(component).props.onShouldStartLoadWithRequest({
      url: 'sms:+15551234567',
    });

    expect(successfulSms).toBe(false);
    expect(openURL).toHaveBeenCalledWith('sms:+15551234567');

    openURL.mockRejectedValueOnce(new Error('sms unavailable'));
    const failedSms = getWebView(component).props.onShouldStartLoadWithRequest({
      url: 'sms:+15557654321',
    });

    expect(failedSms).toBe(false);

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith({
        nativeEvent: {
          data: 'sms-open-failed',
          description: 'sms unavailable',
        },
        success: false,
      });
    });
  });

  it('allows non-hcaptcha, non-sms navigations to continue inside the WebView', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
      />
    );

    const shouldStart = getWebView(component).props.onShouldStartLoadWithRequest({
      url: 'https://example.com/path',
    });

    expect(shouldStart).toBe(true);
    expect(openURL).not.toHaveBeenCalled();
  });
});
