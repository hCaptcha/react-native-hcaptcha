import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Modal, SafeAreaView } from 'react-native';

import Hcaptcha from '../Hcaptcha';
import ConfirmHcaptcha from '../index';
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
