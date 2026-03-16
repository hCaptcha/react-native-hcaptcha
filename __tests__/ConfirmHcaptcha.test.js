import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SafeAreaView } from 'react-native';

import Hcaptcha from '../Hcaptcha';
import ConfirmHcaptcha from '../index';

describe('ConfirmHcaptcha', () => {
  const getModal = (component) => component.UNSAFE_getByType('Modal');
  const getHcaptchaChild = (component) => component.UNSAFE_getByType(Hcaptcha);
  const getInstance = (component) => component.UNSAFE_getByType(ConfirmHcaptcha).instance;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('renders ConfirmHcaptcha with minimum props', () => {
    const component = render(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
      />
    );

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
    const modal = getModal(component);
    const safeAreaView = component.UNSAFE_getByType(SafeAreaView);

    expect(modal.props.useNativeDriver).toBe(true);
    expect(modal.props.hideModalContentWhileAnimating).toBe(true);
    expect(modal.props.isVisible).toBe(false);
    expect(modal.props.hasBackdrop).toBe(true);
    expect(modal.props.coverScreen).toBe(true);
    expect(modal.props.animationIn).toBe('fadeIn');
    expect(modal.props.animationOut).toBe('fadeOut');
    expect(safeAreaView.props.style).toEqual([
      expect.objectContaining({
        flex: 1,
        justifyContent: 'center',
        overflow: 'hidden',
      }),
      { backgroundColor: 'rgba(0.1, 0.1, 0.1, 0.4)' },
    ]);
  });

  it('disables modal backdrop/screen coverage when passiveSiteKey is enabled and omits wrapper backdrop color when hasBackdrop is false', () => {
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
    const modal = getModal(component);
    const safeAreaView = component.UNSAFE_getByType(SafeAreaView);

    expect(modal.props.style).toEqual([
      expect.objectContaining({ margin: 0, display: 'none' }),
      { display: 'none' },
    ]);
    expect(modal.props.hasBackdrop).toBe(false);
    expect(modal.props.coverScreen).toBe(false);
    expect(safeAreaView.props.style).toEqual([
      expect.objectContaining({
        flex: 1,
        justifyContent: 'center',
        overflow: 'hidden',
      }),
      {},
    ]);
  });

  it('uses SafeAreaView by default and a plain View wrapper when useSafeAreaView is false', () => {
    const defaultWrapper = render(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
      />
    );

    expect(defaultWrapper.UNSAFE_queryByType(SafeAreaView)).not.toBeNull();

    const plainViewWrapper = render(
      <ConfirmHcaptcha
        siteKey="00000000-0000-0000-0000-000000000000"
        baseUrl="https://hcaptcha.com"
        languageCode="en"
        useSafeAreaView={false}
      />
    );

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

    expect(getModal(component).props.isVisible).toBe(true);

    act(() => {
      instance.hide();
    });

    expect(getModal(component).props.isVisible).toBe(false);
    expect(onMessage).not.toHaveBeenCalled();

    act(() => {
      instance.show();
    });

    act(() => {
      instance.hide('backdrop');
    });

    expect(getModal(component).props.isVisible).toBe(false);
    expect(onMessage).toHaveBeenCalledWith({ nativeEvent: { data: 'cancel' } });
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
      getModal(component).props.onBackdropPress();
    });

    expect(onMessage).toHaveBeenCalledWith({ nativeEvent: { data: 'cancel' } });
    expect(getModal(component).props.isVisible).toBe(false);

    onMessage.mockClear();

    act(() => {
      instance.show();
    });

    act(() => {
      getModal(component).props.onBackButtonPress();
    });

    expect(onMessage).toHaveBeenCalledWith({ nativeEvent: { data: 'cancel' } });
    expect(getModal(component).props.isVisible).toBe(false);
  });
});
