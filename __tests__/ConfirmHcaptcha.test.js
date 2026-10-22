import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { BackHandler, Modal, SafeAreaView } from 'react-native';

import Hcaptcha, { HCAPTCHA_READY_EVENT } from '../Hcaptcha';
import ConfirmHcaptcha from '../index';
import { getLastInjectJavaScriptMock, resetWebViewMockState } from 'react-native-webview';
import {
  __unsafeResetJourneyRuntime,
  emitJourneyEvent,
  initJourneyTracking,
  peekJourneyEvents,
} from '../journey';

describe('ConfirmHcaptcha', () => {
  const getModal = (component) => component.UNSAFE_getByType(Modal);
  const getHcaptchaChild = (component) => component.UNSAFE_getByType(Hcaptcha);
  const getInstance = (component) => component.UNSAFE_getByType(ConfirmHcaptcha).instance;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    resetWebViewMockState();
    __unsafeResetJourneyRuntime();
  });

  it('renders ConfirmHcaptcha with minimum props after show() is called', () => {
    const component = render(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
      />
    );
    const instance = getInstance(component);

    act(() => {
      instance.show();
    });

    expect(component).toMatchSnapshot();
  });

  it('forwards every shared prop to the embedded Hcaptcha component', () => {
    const onMessage = jest.fn();
    const debug = { customDebug: true };
    const component = render(
      <ConfirmHcaptcha
        size="compact"
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        orientation="landscape"
        onMessage={onMessage}
        showLoading={true}
        closableLoading={true}
        backgroundColor="rgba(0.1, 0.1, 0.1, 0.4)"
        loadingIndicatorColor="#999999"
        theme="light"
        rqdata='{"some":"data"}'
        sentry={true}
        jsSrc="https://all.props/api-endpoint"
        endpoint="https://all.props/endpoint"
        reportapi="https://all.props/reportapi"
        assethost="https://all.props/assethost"
        imghost="https://all.props/imghost"
        host="all-props-host"
        debug={debug}
        phonePrefix="44"
        phoneNumber="+44123456789"
      />
    );
    const instance = getInstance(component);

    act(() => {
      instance.show();
    });

    expect(getHcaptchaChild(component).props).toMatchObject({
      size: 'compact',
      siteKey: '00000000-0000-0000-0000-000000000000',
      url: 'https://hcaptcha.com',
      languageCode: 'en',
      orientation: 'landscape',
      onMessage,
      showLoading: true,
      closableLoading: true,
      backgroundColor: 'rgba(0.1, 0.1, 0.1, 0.4)',
      loadingIndicatorColor: '#999999',
      theme: 'light',
      rqdata: '{"some":"data"}',
      sentry: true,
      jsSrc: 'https://all.props/api-endpoint',
      endpoint: 'https://all.props/endpoint',
      reportapi: 'https://all.props/reportapi',
      assethost: 'https://all.props/assethost',
      imghost: 'https://all.props/imghost',
      host: 'all-props-host',
      debug,
      phonePrefix: '44',
      phoneNumber: '+44123456789',
    });
  });

  it('renders nothing until show() is called', () => {
    const component = render(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
      />
    );

    expect(component.toJSON()).toBeNull();
  });

  it.each([false, true])('prewarms without executing and reuses the WebView (passiveSiteKey=%s)', (passiveSiteKey) => {
    const onMessage = jest.fn();
    const component = render(
      <ConfirmHcaptcha siteKey="site-key" onMessage={onMessage} prewarm passiveSiteKey={passiveSiteKey} />
    );
    const instance = getInstance(component);
    const webView = component.UNSAFE_getByType('WebView');
    const html = webView.props.source.html;
    const inject = getLastInjectJavaScriptMock();

    act(() => webView.props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    expect(inject).not.toHaveBeenCalled();
    expect(onMessage).not.toHaveBeenCalled();
    expect(component.UNSAFE_queryByType(Modal)).toBeNull();
    if (!passiveSiteKey) {
      expect(component.getByTestId('confirm-hcaptcha-prewarm', { includeHiddenElements: true }).props).toMatchObject({
        pointerEvents: 'none',
        accessibilityElementsHidden: true,
      });
    }

    act(() => instance.execute());
    expect(inject).toHaveBeenCalledTimes(1);
    expect(inject).toHaveBeenLastCalledWith(expect.stringContaining('setData({}); execute();'));
    expect(component.UNSAFE_getByType('WebView')).toBe(webView);
    expect(webView.props.source.html).toBe(html);
    if (!passiveSiteKey) {
      expect(component.getByTestId('confirm-hcaptcha-prewarm').props.pointerEvents).toBe('auto');
    }

    act(() => instance.show());
    expect(inject).toHaveBeenCalledTimes(1);
    act(() => instance.hide());
    expect(inject).toHaveBeenLastCalledWith(expect.stringContaining('try { reset(); }'));
    expect(component.UNSAFE_getByType('WebView')).toBe(webView);
    act(() => instance.show());
    expect(inject).toHaveBeenLastCalledWith(expect.stringContaining('reset(); setRequest(2); setData({}); execute();'));
    expect(webView.props.source.html).toBe(html);
  });

  it.each([false, true])('queues execute until ready and cancels it on hide (cancel=%s)', (cancel) => {
    const component = render(<ConfirmHcaptcha siteKey="site-key" onMessage={jest.fn()} prewarm />);
    const instance = getInstance(component);
    const inject = getLastInjectJavaScriptMock();
    act(() => instance.execute());
    if (cancel) {
      act(() => instance.hide());
    }
    expect(inject).not.toHaveBeenCalled();
    act(() => component.UNSAFE_getByType('WebView').props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    expect(inject).toHaveBeenCalledTimes(cancel ? 0 : 1);
  });

  it.each(['backdrop', 'back_button'])('cancels a prewarmed challenge via %s', (source) => {
    const remove = jest.fn();
    const subscribe = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove });
    const onMessage = jest.fn();
    const component = render(<ConfirmHcaptcha siteKey="site-key" onMessage={onMessage} prewarm />);
    const instance = getInstance(component);
    expect(subscribe).not.toHaveBeenCalled();
    act(() => instance.execute());
    const onBack = subscribe.mock.calls[0][1];
    act(() => {
      if (source === 'backdrop') {
        fireEvent.press(component.getByTestId('confirm-hcaptcha-backdrop'));
      } else {
        expect(onBack()).toBe(true);
      }
    });
    expect(onMessage).toHaveBeenCalledWith({ nativeEvent: { data: 'cancel' } });
    expect(component.getByTestId('confirm-hcaptcha-prewarm', { includeHiddenElements: true }).props.pointerEvents).toBe('none');
    component.unmount();
    expect(remove).toHaveBeenCalled();
  });

  it('cancels execute when hide is called in the same batch', () => {
    const component = render(<ConfirmHcaptcha siteKey="site-key" onMessage={jest.fn()} prewarm />);
    const instance = getInstance(component);
    act(() => component.UNSAFE_getByType('WebView').props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    act(() => {
      instance.execute();
      instance.hide();
    });
    expect(getLastInjectJavaScriptMock()).not.toHaveBeenCalledWith(expect.stringContaining('execute();'));
  });

  it('retries a timed-out load while the prewarmed overlay remains visible', () => {
    jest.useFakeTimers();
    const component = render(<ConfirmHcaptcha siteKey="site-key" onMessage={jest.fn()} prewarm />);
    const instance = getInstance(component);
    act(() => instance.execute());
    act(() => jest.advanceTimersByTime(15000));
    const oldWebView = component.UNSAFE_getByType('WebView');
    act(() => instance.execute());
    const webView = component.UNSAFE_getByType('WebView');
    expect(webView).not.toBe(oldWebView);
    act(() => webView.props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledTimes(1);
    component.unmount();
    jest.useRealTimers();
  });

  it.each(['prewarm', 'passiveSiteKey'])('preserves pending verification when %s is enabled', (prop) => {
    const props = { siteKey: 'site-key', onMessage: jest.fn(), prewarm: prop !== 'prewarm' };
    const component = render(<ConfirmHcaptcha {...props} />);
    act(() => getInstance(component).execute());
    component.rerender(<ConfirmHcaptcha {...props} {...{ [prop]: true }} />);
    act(() => component.UNSAFE_getByType('WebView').props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    expect(getLastInjectJavaScriptMock()).toHaveBeenCalledWith(expect.stringContaining('execute();'));
  });

  it.each([false, true])('keeps prefetched token expiry active after hide (markUsed=%s)', (markUsed) => {
    jest.useFakeTimers();
    const onMessage = jest.fn();
    const component = render(<ConfirmHcaptcha siteKey="site-key" onMessage={onMessage} prewarm />);
    const instance = getInstance(component);
    const webView = component.UNSAFE_getByType('WebView');
    act(() => webView.props.onMessage({ nativeEvent: { data: HCAPTCHA_READY_EVENT } }));
    act(() => instance.execute());
    act(() => webView.props.onMessage({ nativeEvent: { data: '10000000-aaaa-bbbb-cccc-000000000001' } }));
    act(() => instance.hide());
    if (markUsed) {
      onMessage.mock.calls[0][0].markUsed();
    }
    act(() => jest.advanceTimersByTime(120000));
    expect(onMessage).toHaveBeenCalledTimes(markUsed ? 1 : 2);
    if (!markUsed) {
      expect(onMessage).toHaveBeenLastCalledWith(expect.objectContaining({
        nativeEvent: { data: 'expired' },
        success: false,
      }));
    }
    jest.useRealTimers();
  });

  it('applies wrapper-only props to the modal and backdrop container', () => {
    const component = render(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        hasBackdrop={true}
        backgroundColor="rgba(0.1, 0.1, 0.1, 0.4)"
      />
    );
    const instance = getInstance(component);

    act(() => {
      instance.show();
    });

    const modal = getModal(component);
    const backdrop = component.getByTestId('confirm-hcaptcha-backdrop');
    const safeAreaView = component.UNSAFE_getByType(SafeAreaView);

    expect(modal.props.animationType).toBe('fade');
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.visible).toBe(true);
    expect(backdrop.props.style).toEqual([
      expect.objectContaining({
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      }),
      { backgroundColor: 'rgba(0.1, 0.1, 0.1, 0.4)' },
    ]);
    expect(safeAreaView.props.style).toEqual(
      expect.objectContaining({
        flex: 1,
        justifyContent: 'center',
        overflow: 'hidden',
      })
    );
  });

  it('mounts the challenge off-screen when passiveSiteKey is enabled and omits the internal backdrop when hasBackdrop is false', () => {
    const component = render(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        passiveSiteKey={true}
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        hasBackdrop={false}
        backgroundColor="rgba(0.1, 0.1, 0.1, 0.4)"
      />
    );
    const instance = getInstance(component);

    act(() => {
      instance.show();
    });

    const hiddenContainer = component.UNSAFE_getByProps({ pointerEvents: 'none' });
    const safeAreaView = component.UNSAFE_getByType(SafeAreaView);

    expect(component.UNSAFE_queryByType(Modal)).toBeNull();
    expect(component.queryByTestId('confirm-hcaptcha-backdrop')).toBeNull();
    expect(hiddenContainer.props.style).toEqual(
      expect.objectContaining({
        height: 1,
        left: 0,
        opacity: 0,
        position: 'absolute',
        top: 0,
        width: 1,
      })
    );
    expect(safeAreaView.props.style).toEqual(
      expect.objectContaining({
        flex: 1,
        justifyContent: 'center',
        overflow: 'hidden',
      })
    );
  });

  it('uses SafeAreaView by default and a plain View wrapper when useSafeAreaView is false', () => {
    const defaultWrapper = render(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
      />
    );
    const defaultInstance = getInstance(defaultWrapper);

    act(() => {
      defaultInstance.show();
    });

    expect(defaultWrapper.UNSAFE_queryByType(SafeAreaView)).not.toBeNull();

    const plainViewWrapper = render(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        useSafeAreaView={false}
      />
    );
    const plainViewInstance = getInstance(plainViewWrapper);

    act(() => {
      plainViewInstance.show();
    });

    expect(plainViewWrapper.UNSAFE_queryByType(SafeAreaView)).toBeNull();
  });

  it('show() and hide() toggle modal visibility, and hide(source) emits cancel', () => {
    const onMessage = jest.fn();
    const component = render(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        onMessage={onMessage}
      />
    );
    const instance = getInstance(component);

    act(() => {
      instance.show();
    });

    expect(getModal(component).props.visible).toBe(true);

    act(() => {
      instance.hide();
    });

    expect(component.toJSON()).toBeNull();
    expect(onMessage).not.toHaveBeenCalled();

    act(() => {
      instance.show();
    });

    act(() => {
      instance.hide('backdrop');
    });

    expect(component.toJSON()).toBeNull();
    expect(onMessage).toHaveBeenCalledWith({ nativeEvent: { data: 'cancel' } });
  });

  it('stopEvents() clears the current shared buffer without tearing down global capture', () => {
    initJourneyTracking();
    const component = render(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        userJourney={true}
      />
    );
    const instance = getInstance(component);

    act(() => {
      instance.show();
    });

    emitJourneyEvent('click', 'View', { id: 'before-stop', ac: 'tap' });
    expect(peekJourneyEvents()).toHaveLength(1);

    act(() => {
      instance.stopEvents();
    });

    expect(getHcaptchaChild(component).props.userJourney).toBe(false);
    expect(peekJourneyEvents()).toEqual([]);

    emitJourneyEvent('click', 'View', { id: 'after-stop', ac: 'tap' });
    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        k: 'click',
        v: 'View',
        m: { id: 'after-stop', ac: 'tap' },
      }),
    ]);
  });

  it('re-enables journeys after stopEvents() when the prop is explicitly reconfigured', () => {
    initJourneyTracking();
    const component = render(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        userJourney={true}
      />
    );
    const instance = getInstance(component);

    act(() => {
      instance.show();
    });

    expect(getHcaptchaChild(component).props.userJourney).toBe(true);

    act(() => {
      instance.stopEvents();
    });

    expect(getHcaptchaChild(component).props.userJourney).toBe(false);

    component.rerender(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        userJourney={false}
      />
    );
    component.rerender(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        userJourney={true}
      />
    );

    expect(getHcaptchaChild(component).props.userJourney).toBe(true);
  });

  it('keeps the shared buffer active when one of two simultaneous consumers unmounts', () => {
    const onStats = jest.fn();
    const firstRef = React.createRef();
    const secondRef = React.createRef();

    initJourneyTracking({ onStats });
    const component = render(
      <>
        <ConfirmHcaptcha
          ref={firstRef}
          siteKey="00000000-0000-0000-0000-000000000000"
          baseUrl="https://hcaptcha.com"
          languageCode="en"
          userJourney={true}
        />
        <ConfirmHcaptcha
          ref={secondRef}
          siteKey="00000000-0000-0000-0000-000000000001"
          baseUrl="https://hcaptcha.com"
          languageCode="en"
          userJourney={true}
        />
      </>
    );

    expect(onStats).toHaveBeenLastCalledWith(expect.objectContaining({
      activeConsumers: 2,
    }));

    emitJourneyEvent('click', 'View', { id: 'before-unmount', ac: 'tap' });

    component.rerender(
      <ConfirmHcaptcha
        ref={secondRef}
        siteKey="00000000-0000-0000-0000-000000000001"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        userJourney={true}
      />
    );

    expect(onStats).toHaveBeenLastCalledWith(expect.objectContaining({
      activeConsumers: 1,
    }));

    emitJourneyEvent('click', 'View', { id: 'after-unmount', ac: 'tap' });
    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        m: { id: 'before-unmount', ac: 'tap' },
      }),
      expect.objectContaining({
        m: { id: 'after-unmount', ac: 'tap' },
      }),
    ]);
  });

  it('clears the shared buffer when one of two simultaneous consumers calls stopEvents, but capture continues for the other', () => {
    const onStats = jest.fn();
    const firstRef = React.createRef();
    const secondRef = React.createRef();

    initJourneyTracking({ onStats });
    render(
      <>
        <ConfirmHcaptcha
          ref={firstRef}
          siteKey="00000000-0000-0000-0000-000000000000"
          baseUrl="https://hcaptcha.com"
          languageCode="en"
          userJourney={true}
        />
        <ConfirmHcaptcha
          ref={secondRef}
          siteKey="00000000-0000-0000-0000-000000000001"
          baseUrl="https://hcaptcha.com"
          languageCode="en"
          userJourney={true}
        />
      </>
    );

    emitJourneyEvent('click', 'View', { id: 'before-stop', ac: 'tap' });

    act(() => {
      firstRef.current.stopEvents();
    });

    expect(onStats).toHaveBeenLastCalledWith(expect.objectContaining({
      activeConsumers: 1,
    }));
    expect(peekJourneyEvents()).toEqual([]);

    emitJourneyEvent('click', 'View', { id: 'after-stop', ac: 'tap' });
    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        m: { id: 'after-stop', ac: 'tap' },
      }),
    ]);
  });

  it('backdrop and back-button handlers call hide(source) and emit cancel events', () => {
    const onMessage = jest.fn();
    const component = render(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        onMessage={onMessage}
      />
    );
    const instance = getInstance(component);

    act(() => {
      instance.show();
    });

    act(() => {
      fireEvent.press(component.getByTestId('confirm-hcaptcha-backdrop'));
    });

    expect(onMessage).toHaveBeenCalledWith({ nativeEvent: { data: 'cancel' } });
    expect(component.toJSON()).toBeNull();

    onMessage.mockClear();

    act(() => {
      instance.show();
    });

    act(() => {
      getModal(component).props.onRequestClose();
    });

    expect(onMessage).toHaveBeenCalledWith({ nativeEvent: { data: 'cancel' } });
    expect(component.toJSON()).toBeNull();
  });
});
