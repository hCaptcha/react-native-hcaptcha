import React from 'react';
import vm from 'vm';
import { act, render, waitFor } from '@testing-library/react-native';
import { ActivityIndicator, Linking, TouchableWithoutFeedback } from 'react-native';

import Hcaptcha, { HCAPTCHA_READY_EVENT } from '../Hcaptcha';
import { __unsafeResetJourneyRuntime, emitJourneyEvent, initJourneyTracking, peekJourneyEvents } from '../journey';
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
  const getLoaderConfig = (component) => getSerializedConfig(component).loaderConfig;
  const getInlineScripts = (component) =>
    [...getWebViewHtml(component).matchAll(/<script type="text\/javascript">([\s\S]*?)<\/script>/g)]
      .map((match) => match[1]);

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useRealTimers();
    resetWebViewMockState();
    __unsafeResetJourneyRuntime();
  });

  it('renders Hcaptcha with minimum props', () => {
    const component = render(<Hcaptcha url="https://hcaptcha.com" />);

    expect(component).toMatchSnapshot();
  });

  it('maps every Hcaptcha prop into WebView props and serialized config', () => {
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
    const loaderConfig = getLoaderConfig(component);
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
    expect(config.orientation).toBe('landscape');
    expect(config.verifyData).toBeUndefined();
    expect(config.debugInfo).toMatchObject({
      customDebug: 'enabled',
      'dep_mocked-md5': true,
      sdk_5_0_0: true,
    });

    expect(loaderConfig).toMatchObject({
      scriptSource: 'https://all.props/api-endpoint',
      render: 'explicit',
      host: 'all-props-host',
      hl: 'fr',
      sentry: true,
      endpoint: 'https://all.props/endpoint',
      assethost: 'https://all.props/assethost',
      imghost: 'https://all.props/imghost',
      reportapi: 'https://all.props/reportapi',
      custom: false,
    });
    expect(loaderConfig.orientation).toBeUndefined();
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

  it('normalizes object and JSON-string themes into object config and custom loader config', () => {
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
      expect(getLoaderConfig(component).custom).toBe(true);
    });
  });

  it('loads hCaptcha through the loader and signals RN when the widget is ready', async () => {
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
      },
      hcaptcha: {
        execute: executeMock,
        render: renderMock,
        setData: jest.fn(),
      },
      window: null,
    };

    sandbox.window = sandbox;
    sandbox.window.ReactNativeWebView = { postMessage: postMessageMock };

    const context = vm.createContext(sandbox);
    const [configScript, loaderScript, runtimeScript] = getInlineScripts(component);

    vm.runInContext(configScript, context);
    vm.runInContext(loaderScript, context);
    vm.runInContext(runtimeScript, context);

    expect(context.hCaptchaLoaderConfig).toEqual(config.loaderConfig);
    expect(typeof context.onloadCallback).toBe('function');

    await waitFor(() => expect(renderMock).toHaveBeenCalled());

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
    expect(postMessageMock).toHaveBeenCalledWith(HCAPTCHA_READY_EVENT);
    expect(sandbox.hcaptcha.setData).not.toHaveBeenCalled();
    expect(executeMock).not.toHaveBeenCalled();

    const renderConfig = renderMock.mock.calls[0][1];
    renderConfig['open-callback']();
    expect(context.document.body.style.backgroundColor).toBe(config.backgroundColor);
    expect(postMessageMock).toHaveBeenCalledWith('open');
  });

  it('uses the published loader contract and forwards terminal failures after retries', async () => {
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        languageCode="fr"
        theme={{ palette: { mode: 'dark' } }}
        sentry={false}
        jsSrc="https://proxy.example/1/api.js"
        endpoint="https://proxy.example/api"
        reportapi="https://proxy.example/report"
        assethost="https://proxy.example/assets"
        imghost="https://proxy.example/images"
        host="mobile.example"
        orientation="landscape"
      />
    );
    const appendedScripts = [];
    const postMessageMock = jest.fn();
    const sandbox = {
      console: {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      document: {
        URL: 'https://hcaptcha.com',
        body: { style: {} },
        createElement: jest.fn(() => ({})),
        head: {
          appendChild: jest.fn((script) => appendedScripts.push(script)),
        },
      },
      setTimeout,
      clearTimeout,
      window: null,
    };

    sandbox.window = sandbox;
    sandbox.window.ReactNativeWebView = { postMessage: postMessageMock };
    sandbox.document.defaultView = sandbox;
    sandbox.document.head.ownerDocument = sandbox.document;

    const context = vm.createContext(sandbox);
    const [configScript, , runtimeScript] = getInlineScripts(component);
    const actualLoaderModule = jest.requireActual('@hcaptcha/loader/inline');
    const loaderSource = actualLoaderModule.default || actualLoaderModule;

    vm.runInContext(configScript, context);
    context.hcaptchaConfig.loaderConfig.retryDelay = 0;
    vm.runInContext(loaderSource, context);
    vm.runInContext(runtimeScript, context);

    expect(appendedScripts).toHaveLength(1);
    const apiUrl = new URL(appendedScripts[0].src);
    expect(`${apiUrl.origin}${apiUrl.pathname}`).toBe('https://proxy.example/1/api.js');
    expect(Object.fromEntries(apiUrl.searchParams.entries())).toEqual({
      assethost: 'https://proxy.example/assets',
      custom: 'true',
      endpoint: 'https://proxy.example/api',
      hl: 'fr',
      host: 'mobile.example',
      imghost: 'https://proxy.example/images',
      onload: 'hCaptchaOnLoad',
      render: 'explicit',
      reportapi: 'https://proxy.example/report',
      sentry: 'false',
    });
    expect(apiUrl.searchParams.has('orientation')).toBe(false);
    expect(context.hcaptchaConfig.orientation).toBe('landscape');

    appendedScripts[0].onerror(new Error('first failure'));
    await waitFor(() => expect(appendedScripts).toHaveLength(2));
    expect(postMessageMock).not.toHaveBeenCalled();

    appendedScripts[1].onerror(new Error('second failure'));
    await waitFor(() => expect(appendedScripts).toHaveLength(3));
    expect(postMessageMock).not.toHaveBeenCalled();

    appendedScripts[2].onerror(new Error('terminal failure'));
    await waitFor(() => expect(postMessageMock).toHaveBeenCalledWith('__hcaptcha_load_error__:"script-error"'));
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
    const loaderConfig = getLoaderConfig(component);

    expect(html).toContain('var hcaptchaConfig = ');
    expect(html).toContain('hcaptcha.setData(hcaptchaWidgetId, data || {});');
    expect(html).toContain(`window.ReactNativeWebView.postMessage("${HCAPTCHA_READY_EVENT}");`);
    expect(html).not.toContain('<script src=');
    expect(html).not.toContain('</script><script>alert("site")</script>');
    expect(html).toContain('\\u003c/script\\u003e\\u003cscript\\u003ealert(\\"site\\")\\u003c/script\\u003e');
    expect(html).toContain('\\u003c/script\\u003e\\u003cscript\\u003ealert(\\"debug\\")\\u003c/script\\u003e');

    expect(config.siteKey).toBe('site"</script><script>alert("site")</script>');
    expect(config.backgroundColor).toBe('red\';window.ReactNativeWebView.postMessage("bg");//');
    expect(config.verifyData).toBeUndefined();
    expect(config.theme).toEqual(theme);
    expect(config.debugInfo['</script><script>alert("debug")</script>']).toBe('</script><script>alert("value")</script>');

    expect(loaderConfig.scriptSource).toBe('https://example.com/api.js?x=</script><script>alert("src")</script>');
    expect(loaderConfig.hl).toBe('en"</script><script>alert("lang")</script>');
    expect(loaderConfig.host).toBe('host"</script><script>alert("host")</script>');
    expect(loaderConfig.endpoint).toBe('https://example.com/endpoint?</script><script>alert("endpoint")</script>');
    expect(loaderConfig.reportapi).toBe('https://example.com/reportapi?</script><script>alert("reportapi")</script>');
    expect(loaderConfig.assethost).toBe('https://example.com/assethost?</script><script>alert("asset")</script>');
    expect(loaderConfig.imghost).toBe('https://example.com/imghost?</script><script>alert("image")</script>');
    expect(config.orientation).toBe('landscape"</script><script>alert("orientation")</script>');
    expect(loaderConfig.orientation).toBeUndefined();
    expect(loaderConfig.sentry).toBe(true);
    expect(loaderConfig.custom).toBe(true);
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
      success: false,
      reset: expect.any(Function),
    });
  });

  it('bounds loading time despite onMessage callback changes during form edits', () => {
    jest.useFakeTimers();
    const onMessage = jest.fn();
    const ref = React.createRef();
    const component = render(<Hcaptcha ref={ref} siteKey="site-key" onMessage={(event) => onMessage(event)} prewarm />);
    act(() => ref.current.execute());
    for (let second = 0; second < 16; second++) {
      act(() => jest.advanceTimersByTime(1000));
      component.rerender(<Hcaptcha ref={ref} siteKey="site-key" onMessage={(event) => onMessage(event)} prewarm />);
    }
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      nativeEvent: { data: 'error', description: 'loading timeout' },
    }));
  });

  it.each([false, true])('preserves late SDK behavior after a loading timeout (prewarm=%s)', (prewarm) => {
    jest.useFakeTimers();
    const ref = React.createRef();
    const component = render(<Hcaptcha ref={ref} siteKey="site-key" onMessage={jest.fn()} prewarm={prewarm} />);
    if (prewarm) {
      act(() => ref.current.execute());
    }
    act(() => jest.advanceTimersByTime(15000));
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledTimes(prewarm ? 0 : 1);
    act(() => ref.current.execute());
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledTimes(1);
  });

  it('ignores a token delivered after cancellation', () => {
    const ref = React.createRef();
    const onMessage = jest.fn();
    const component = render(<Hcaptcha ref={ref} siteKey="site-key" onMessage={onMessage} prewarm />);
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    act(() => ref.current.execute());
    act(() => ref.current.reset());
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: LONG_TOKEN } }));
    expect(onMessage).not.toHaveBeenCalled();
  });

  it.each(['null', '{', '{"requestId":99,"data":"network-error"}', '{"requestId":1,"data":{}}',
    '{"requestId":1,"data":"network-error","error":"true"}', '{"requestId":1,"data":"network-error","error":{}}'])('ignores invalid/stale request envelopes without cancelling verification (%s)', (payload) => {
    const ref = React.createRef();
    const onMessage = jest.fn();
    const component = render(<Hcaptcha ref={ref} siteKey="site-key" onMessage={onMessage} prewarm />);
    const send = (data) => act(() => getWebView(component).props.onMessage({ nativeEvent: { data } }));
    send(HCAPTCHA_READY_EVENT);
    act(() => ref.current.execute());
    send(`__hcaptcha_request__:${payload}`);
    expect(onMessage).not.toHaveBeenCalled();
    act(() => ref.current.execute());
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledTimes(1);
    send(`__hcaptcha_request__:${JSON.stringify({ requestId: 1, data: LONG_TOKEN })}`);
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0][0].nativeEvent.data).toBe(LONG_TOKEN);
  });

  it.each([false, true].flatMap((prewarm) => [false, true].map((readOnly) => ({ prewarm, readOnly }))))('isolates pooled native events (prewarm=$prewarm, readOnly=$readOnly)', ({ prewarm, readOnly }) => {
    const ref = React.createRef();
    const onMessage = jest.fn((event) => {
      if (event.markUsed) {
        event.markUsed();
        ref.current.reset();
      }
    });
    const component = render(<Hcaptcha ref={ref} siteKey="site-key" onMessage={onMessage} prewarm={prewarm} />);
    const nativeEvent = { data: HCAPTCHA_READY_EVENT };
    const prototype = { persist: jest.fn() };
    const event = Object.create(prototype);
    if (readOnly) {
      Object.defineProperty(prototype, 'nativeEvent', { get: () => nativeEvent });
    } else {
      event.nativeEvent = nativeEvent;
    }
    const send = (data) => {
      event.nativeEvent.data = data;
      act(() => getWebView(component).props.onMessage(event));
    };
    send(HCAPTCHA_READY_EVENT);
    act(() => ref.current.execute());
    send(LONG_TOKEN);
    expect(event.markUsed).toBeUndefined();
    expect(onMessage.mock.calls[0][0].persist).toBe(event.persist);
    act(() => ref.current.execute());
    event.markUsed = jest.fn(); // A previous handler can leave custom fields on the pool.
    send('open');
    expect(onMessage.mock.calls[1][0].markUsed).toBeUndefined();
    expect(onMessage.mock.calls[0][0].nativeEvent.data).toBe(LONG_TOKEN);
    send(LONG_TOKEN);
    expect(onMessage).toHaveBeenCalledTimes(3);
    expect(onMessage.mock.calls[2][0].markUsed).toEqual(expect.any(Function));
  });

  it.each([false, true])('expires only the replacement token using the current callback (markOldUsed=%s)', (markOldUsed) => {
    jest.useFakeTimers();
    const first = jest.fn();
    const latest = jest.fn();
    const component = render(<Hcaptcha siteKey="site-key" onMessage={first} />);
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: LONG_TOKEN } }));
    const markFirstUsed = first.mock.calls[0][0].markUsed;
    act(() => jest.advanceTimersByTime(60000));
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: LONG_TOKEN } }));
    if (markOldUsed) {
      markFirstUsed();
    }
    component.rerender(<Hcaptcha siteKey="site-key" onMessage={latest} />);
    act(() => jest.advanceTimersByTime(60000));
    expect(first).toHaveBeenCalledTimes(2);
    expect(latest).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(60000));
    expect(latest).toHaveBeenCalledTimes(1);
    expect(latest).toHaveBeenCalledWith(expect.objectContaining({ nativeEvent: { data: 'expired' } }));
  });

  it('cleans up held token expiry when the prewarmed component unmounts', () => {
    jest.useFakeTimers();
    const ref = React.createRef();
    const onMessage = jest.fn();
    const component = render(<Hcaptcha ref={ref} siteKey="site-key" onMessage={onMessage} prewarm />);
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    act(() => ref.current.execute());
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: LONG_TOKEN } }));
    const oldProps = getWebView(component).props;
    component.unmount();
    act(() => {
      oldProps.onLoadStart();
      oldProps.onMessage({ nativeEvent: { data: LONG_TOKEN } });
    });
    act(() => jest.advanceTimersByTime(120000));
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it.each(['onContentProcessDidTerminate', 'onRenderProcessGone'])('reloads after %s and queues verification until ready', (event) => {
    const ref = React.createRef();
    const component = render(<Hcaptcha ref={ref} siteKey="site-key" onMessage={jest.fn()} prewarm />);
    const oldProps = getWebView(component).props;
    act(() => oldProps.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    act(() => oldProps[event]());
    act(() => oldProps.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    act(() => ref.current.execute());
    expect(getLastInjectJavaScriptMock()).not.toHaveBeenCalled();
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledTimes(1);
  });

  it('queues event.reset while a terminated renderer is recovering', () => {
    const ref = React.createRef();
    const onMessage = jest.fn();
    const component = render(<Hcaptcha ref={ref} siteKey="site-key" onMessage={onMessage} prewarm />);
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    act(() => ref.current.execute());
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: LONG_TOKEN } }));
    const reset = onMessage.mock.calls[0][0].reset;
    act(() => getWebView(component).props.onContentProcessDidTerminate());
    act(reset);
    expect(getLastInjectJavaScriptMock()).not.toHaveBeenCalled();
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledTimes(1);
  });

  it('retries a held event with current verification props', () => {
    const onMessage = jest.fn();
    const props = { siteKey: 'site-key', onMessage };
    const component = render(<Hcaptcha {...props} verifyParams={{ rqdata: 'old' }} />);
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: 'error' } }));
    const reset = onMessage.mock.calls[0][0].reset;
    component.rerender(<Hcaptcha {...props} verifyParams={{ rqdata: 'current' }} />);
    act(reset);
    expect(getLastInjectJavaScriptMock()).toHaveBeenLastCalledWith(expect.stringContaining('"rqdata":"current"'));
  });

  it.each([['siteKey', 'new-value'], ['url', 'new-value'], ['theme', 'new-value'], ['prewarm', false]])('waits for the new document when %s changes', (prop, value) => {
    const ref = React.createRef();
    const props = { ref, siteKey: 'site-key', onMessage: jest.fn(), prewarm: true };
    const component = render(<Hcaptcha {...props} />);
    const oldWebView = getWebView(component);
    const oldProps = oldWebView.props;
    act(() => oldProps.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    component.rerender(<Hcaptcha {...props} {...{ [prop]: value }} />);
    const webView = getWebView(component);
    expect(webView).not.toBe(oldWebView);
    act(() => ref.current.execute());
    act(() => {
      oldProps.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } });
      oldProps.onMessage({ nativeEvent: { data: LONG_TOKEN } });
      oldProps.onContentProcessDidTerminate();
    });
    expect(getWebView(component)).toBe(webView);
    expect(props.onMessage).not.toHaveBeenCalled();
    expect(getLastInjectJavaScriptMock()).not.toHaveBeenCalled();
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledTimes(1);
  });

  it.each([false, true].flatMap((prewarm) => [
    ['rqdata', 'rqdata'],
    ['phoneNumber', 'mfa_phone'],
    ['phonePrefix', 'mfa_phoneprefix'],
  ].map(([prop, wireKey]) => ({ prewarm, prop, wireKey }))))('reloads for legacy $prop changes (prewarm=$prewarm)', ({ prewarm, prop, wireKey }) => {
    const ref = React.createRef();
    const props = { ref, siteKey: 'site-key', onMessage: jest.fn(), prewarm };
    const component = render(<Hcaptcha {...props} {...{ [prop]: 'old' }} />);
    const webView = getWebView(component);
    act(() => webView.props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    component.rerender(<Hcaptcha {...props} {...{ [prop]: 'new' }} />);
    expect(getWebView(component)).not.toBe(webView);
    act(() => ref.current.execute());
    expect(getLastInjectJavaScriptMock()).not.toHaveBeenCalled();
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledTimes(1);
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining(`"${wireKey}":"new"`));
  });

  it.each([false, true])('preserves execution after a completed token and legacy prop reload (prewarm=%s)', (prewarm) => {
    const ref = React.createRef();
    const props = { ref, siteKey: 'site-key', onMessage: jest.fn(), prewarm };
    const component = render(<Hcaptcha {...props} rqdata="old" />);
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    if (prewarm) {
      act(() => ref.current.execute());
    }
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: LONG_TOKEN } }));
    props.onMessage.mock.calls.at(-1)[0].markUsed();
    component.rerender(<Hcaptcha {...props} rqdata="new" />);
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledTimes(prewarm ? 0 : 1);
    if (prewarm) {
      act(() => ref.current.execute());
    }
    expect(getLastInjectJavaScriptMock()).toHaveBeenLastCalledWith(expect.stringContaining('"rqdata":"new"'));
  });

  it('recreates a timed-out WebView on execute and waits for the new SDK', () => {
    jest.useFakeTimers();
    const ref = React.createRef();
    const onMessage = jest.fn();
    const component = render(<Hcaptcha ref={ref} siteKey="site-key" onMessage={onMessage} prewarm />);
    const oldWebView = getWebView(component);
    act(() => jest.advanceTimersByTime(15000));
    expect(onMessage).not.toHaveBeenCalled();
    act(() => ref.current.execute());
    const webView = getWebView(component);
    expect(webView).not.toBe(oldWebView);
    expect(getLastInjectJavaScriptMock()).not.toHaveBeenCalled();
    act(() => webView.props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(15000));
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('does not emit a loading timeout after the widget becomes ready in passive flows', () => {
    jest.useFakeTimers();
    const onMessage = jest.fn();
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        onMessage={onMessage}
      />
    );

    act(() => {
      getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } });
      jest.advanceTimersByTime(15000);
    });

    expect(onMessage).not.toHaveBeenCalledWith({
      nativeEvent: {
        data: 'error',
        description: 'loading timeout',
      },
    });
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('execute();'));
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

    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    act(reset);
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('reset(); setData('));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('execute();'));

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

  it('injects fresh verify data only after the widget signals readiness', () => {
    initJourneyTracking();
    emitJourneyEvent('click', 'View', { id: 'before-ready', ac: 'tap', x: 1, y: 2 });
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        userJourney={true}
      />
    );

    emitJourneyEvent('click', 'View', { id: 'after-mount', ac: 'tap', x: 3, y: 4 });

    act(() => {
      getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } });
    });

    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('"id":"before-ready"'));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('"id":"after-mount"'));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.not.stringContaining('reset();'));
  });

  it.each([false, true])('executes prewarmed verification with current payload and journeys (readyFirst=%s)', (readyFirst) => {
    initJourneyTracking();
    const ref = React.createRef();
    const props = { ref, siteKey: 'site-key', onMessage: jest.fn(), prewarm: true, userJourney: true };
    const component = render(<Hcaptcha {...props} verifyParams={{ rqdata: 'initial' }} />);
    const html = getWebViewHtml(component);
    const ready = () => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } });
    if (readyFirst) {
      act(ready);
    }
    component.rerender(<Hcaptcha {...props} verifyParams={{ rqdata: 'latest' }} />);
    emitJourneyEvent('click', 'View', { id: 'screen-two', ac: 'tap' });
    expect(getWebViewHtml(component)).toBe(html);
    act(() => ref.current.execute());
    if (!readyFirst) {
      expect(getLastInjectJavaScriptMock()).not.toHaveBeenCalled();
      act(ready);
    }
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledTimes(1);
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('"rqdata":"latest"'));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('"id":"screen-two"'));
    act(ready);
    act(() => ref.current.execute());
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledTimes(1);
  });

  it('retries an idle prewarm load failure when execute is called', () => {
    const ref = React.createRef();
    const onMessage = jest.fn();
    const component = render(<Hcaptcha ref={ref} siteKey="site-key" onMessage={onMessage} prewarm />);
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: 'script-error' } }));
    act(() => ref.current.execute());
    expect(getLastInjectJavaScriptMock()).toHaveBeenLastCalledWith('loadApiScript(); true;');
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    expect(getLastInjectJavaScriptMock()).toHaveBeenLastCalledWith(expect.stringContaining('setData({}); execute();'));
  });

  it('waits for readiness again after a prewarmed WebView reload', () => {
    const ref = React.createRef();
    const component = render(<Hcaptcha ref={ref} siteKey="site-key" onMessage={jest.fn()} prewarm />);
    act(() => getWebView(component).props.onLoadStart());
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    act(() => getWebView(component).props.onLoadStart());
    act(() => ref.current.execute());
    expect(getLastInjectJavaScriptMock()).not.toHaveBeenCalled();
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('preserves readiness across the initial native load event (late=%s)', (late) => {
    const ref = React.createRef();
    const component = render(<Hcaptcha ref={ref} siteKey="site-key" onMessage={jest.fn()} prewarm />);
    const props = getWebView(component).props;
    if (!late) {
      act(props.onLoadStart);
    }
    act(() => props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    if (late) {
      act(props.onLoadStart);
    }
    act(() => ref.current.execute());
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledTimes(1);
  });

  it('preserves a loader failure when the initial native load event arrives late', () => {
    const ref = React.createRef();
    const component = render(<Hcaptcha ref={ref} siteKey="site-key" onMessage={jest.fn()} prewarm />);
    const props = getWebView(component).props;
    act(() => props.onMessage({ nativeEvent: { data: 'script-error' } }));
    act(props.onLoadStart);
    act(() => ref.current.execute());
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith('loadApiScript(); true;');
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

  it.each([false, true])('restarts the API loader and pending verification after a script load error (prewarm=%s)', (prewarm) => {
    const ref = React.createRef();
    const onMessage = jest.fn();
    const component = render(
      <Hcaptcha
        ref={ref}
        prewarm={prewarm}
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        onMessage={onMessage}
      />
    );

    if (prewarm) {
      act(() => ref.current.execute());
    }
    act(() => {
      getWebView(component).props.onMessage({ nativeEvent: { data: 'script-error' } });
    });

    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      reset: expect.any(Function),
      nativeEvent: expect.objectContaining({ data: 'script-error' }),
    }));

    const [{ reset }] = onMessage.mock.calls[0];

    act(() => {
      reset();
    });

    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith('loadApiScript(); true;');
    act(() => getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    expect(getLastInjectJavaScriptMock()).toHaveBeenLastCalledWith(expect.stringContaining('setData({}); execute();'));
  });

  it('uses verifyParams over legacy props and injects buffered journey data', () => {
    initJourneyTracking();
    emitJourneyEvent('click', 'View', { id: 'screen', ac: 'tap', x: 1, y: 2 });

    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        rqdata="legacy"
        phonePrefix="11"
        phoneNumber="+111"
        userJourney={true}
        verifyParams={{
          rqdata: 'preferred',
          phonePrefix: '44',
          phoneNumber: '+44123',
        }}
      />
    );

    expect(getSerializedConfig(component).verifyData).toBeUndefined();

    act(() => {
      getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } });
    });

    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('"rqdata":"preferred"'));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('"mfa_phoneprefix":"44"'));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('"mfa_phone":"+44123"'));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('"userjourney"'));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('"id":"screen"'));
  });

  it('injects legacy rqdata and phone fields into the final verify payload', () => {
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        onMessage={jest.fn()}
        rqdata='{"some":"data"}'
        phonePrefix="44"
        phoneNumber="+441234567890"
      />
    );

    act(() => {
      getWebView(component).props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } });
    });

    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('"rqdata":"{\\"some\\":\\"data\\"}"'));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('"mfa_phoneprefix":"44"'));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('"mfa_phone":"+441234567890"'));
  });

  it('preserves buffered journey events after error and cancel messages', () => {
    initJourneyTracking();
    emitJourneyEvent('click', 'View', { id: 'preserved', ac: 'tap' });
    const onMessage = jest.fn();
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        onMessage={onMessage}
        userJourney={true}
      />
    );

    act(() => {
      getWebView(component).props.onMessage({ nativeEvent: { data: 'challenge-closed' } });
      getWebView(component).props.onMessage({ nativeEvent: { data: 'webview-error' } });
    });

    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        k: 'click',
        v: 'View',
        m: { id: 'preserved', ac: 'tap' },
      }),
    ]);
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

  it('opens sms links externally, normalising the challenge link shape', async () => {
    const openURL = jest.spyOn(Linking, 'openURL');
    const onMessage = jest.fn();
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        onMessage={onMessage}
      />
    );

    // The shape the challenge emits, with the empty leading query parameter.
    openURL.mockResolvedValueOnce(true);
    const successfulSms = getWebView(component).props.onShouldStartLoadWithRequest({
      url: 'sms:+15550001111?&body=Do%20not%20share%20the%20code%3A%20aaaa-bbbb-cccc',
    });

    expect(successfulSms).toBe(false);
    expect(openURL).toHaveBeenCalledWith(
      'sms:+15550001111?body=Do%20not%20share%20the%20code%3A%20aaaa-bbbb-cccc'
    );

    openURL.mockRejectedValueOnce(new Error('sms unavailable'));
    const failedSms = getWebView(component).props.onShouldStartLoadWithRequest({
      url: 'sms:+15550002222',
    });

    expect(failedSms).toBe(false);

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith({
        nativeEvent: {
          data: 'sms-open-failed',
          // The rejection message embeds the URL, which carries the one-time code, so it is
          // deliberately not forwarded.
          description: 'Could not open the messaging app',
        },
        success: false,
      });
    });
  });

  it('handles target="_blank" links through onOpenWindow', () => {
    // The challenge opens its sms link with target="_blank", which never reaches
    // onShouldStartLoadWithRequest on Android.
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const component = render(
      <Hcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        url="https://hcaptcha.com"
        onMessage={jest.fn()}
      />
    );

    getWebView(component).props.onOpenWindow({
      nativeEvent: { targetUrl: 'sms:+15550001111?&body=code%3A%20aaaa-bbbb-cccc' },
    });
    expect(openURL).toHaveBeenCalledWith('sms:+15550001111?body=code%3A%20aaaa-bbbb-cccc');

    getWebView(component).props.onOpenWindow({
      nativeEvent: { targetUrl: 'https://www.hcaptcha.com/privacy' },
    });
    expect(openURL).toHaveBeenCalledWith('https://www.hcaptcha.com/privacy');

    getWebView(component).props.onOpenWindow({
      nativeEvent: { targetUrl: 'https://example.com/other' },
    });
    expect(openURL).toHaveBeenCalledWith('https://example.com/other');
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
