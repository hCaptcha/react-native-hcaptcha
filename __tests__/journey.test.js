import React from 'react';
import { AppRegistry, Text, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import JourneyWrapper from '../journey/wrapper';
import {
  __unsafeResetJourneyRuntime,
  clearJourneyEvents,
  disableJourneyConsumer,
  drainJourneyEvents,
  enableJourneyConsumer,
  emitJourneyEvent,
  initJourneyTracking,
  peekJourneyEvents,
  registerJourneyNavigationContainer,
  resolveJourneyIdentifier,
} from '../journey';

describe('journey runtime', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    __unsafeResetJourneyRuntime();
  });

  it('installs the wrapper provider once and buffers events before the first consumer mounts', () => {
    const wrapperSpy = jest.spyOn(AppRegistry, 'setWrapperComponentProvider');

    initJourneyTracking();
    initJourneyTracking();
    emitJourneyEvent('click', 'View', { id: 'screen', ac: 'tap' });

    expect(wrapperSpy).toHaveBeenCalledTimes(1);
    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        k: 'click',
        v: 'View',
        m: { id: 'screen', ac: 'tap' },
      }),
    ]);
  });

  it('composes wrapper providers registered after journey tracking initializes', () => {
    const installedProviders = [];
    jest.spyOn(AppRegistry, 'setWrapperComponentProvider').mockImplementation((provider) => {
      installedProviders.push(provider);
    });

    initJourneyTracking();

    const ExternalWrapper = ({ children }) => (
      <View testID="external-wrapper">{children}</View>
    );

    AppRegistry.setWrapperComponentProvider(() => ExternalWrapper);
    enableJourneyConsumer();

    const provider = installedProviders[installedProviders.length - 1];
    const ComposedWrapper = provider({ rootTag: 1 });
    const component = render(
      <ComposedWrapper>
        <Text>child</Text>
      </ComposedWrapper>
    );

    expect(component.getByTestId('external-wrapper')).toBeTruthy();

    const wrappers = component.UNSAFE_getAllByType(View);
    fireEvent(wrappers[1], 'touchStart', {
      nativeEvent: { pageX: 7, pageY: 8, target: 70 },
    });
    fireEvent(wrappers[1], 'touchEnd', {
      nativeEvent: { pageX: 7, pageY: 8, target: 70 },
    });

    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        k: 'click',
        v: 'View',
        m: { id: '70', ac: 'tap', x: 7, y: 8 },
      }),
    ]);
  });

  it('captures initial and subsequent navigation transitions', () => {
    const listeners = new Set();
    const route = { current: { key: 'home-key', name: 'Home' } };
    const navigation = {
      addListener: jest.fn((eventName, listener) => {
        expect(eventName).toBe('state');
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
      getCurrentRoute: jest.fn(() => route.current),
    };

    initJourneyTracking();
    registerJourneyNavigationContainer(navigation);

    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        k: 'screen',
        v: 'Screen',
        m: { id: 'screen', sc: 'Home', ac: 'appear' },
      }),
    ]);

    clearJourneyEvents();
    route.current = { key: 'settings-key', name: 'Settings' };
    listeners.forEach((listener) => listener());

    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        m: { id: 'screen', sc: 'Home', ac: 'disappear' },
      }),
      expect.objectContaining({
        m: { id: 'screen', sc: 'Settings', ac: 'appear' },
      }),
    ]);
  });

  it('re-emits the current screen when a consumer restarts on the same route', () => {
    const navigation = {
      addListener: jest.fn((eventName, listener) => {
        expect(eventName).toBe('state');
        return () => listener;
      }),
      getCurrentRoute: jest.fn(() => ({ key: 'home-key', name: 'Home' })),
    };

    initJourneyTracking();
    registerJourneyNavigationContainer(navigation);
    clearJourneyEvents();

    enableJourneyConsumer();
    disableJourneyConsumer();
    enableJourneyConsumer();

    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        k: 'screen',
        v: 'Screen',
        m: { id: 'screen', sc: 'Home', ac: 'appear' },
      }),
    ]);
  });

  it('does not duplicate the current screen when a consumer restarts and the route is already buffered', () => {
    const navigation = {
      addListener: jest.fn((eventName, listener) => {
        expect(eventName).toBe('state');
        return () => listener;
      }),
      getCurrentRoute: jest.fn(() => ({ key: 'home-key', name: 'Home' })),
    };

    initJourneyTracking();
    registerJourneyNavigationContainer(navigation);

    expect(peekJourneyEvents()).toHaveLength(1);

    enableJourneyConsumer();
    disableJourneyConsumer();
    enableJourneyConsumer();

    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        k: 'screen',
        v: 'Screen',
        m: { id: 'screen', sc: 'Home', ac: 'appear' },
      }),
    ]);
  });

  it('does not emit automatic touch events until a journey consumer is enabled', () => {
    initJourneyTracking();
    const component = render(
      <JourneyWrapper>
        <Text>child</Text>
      </JourneyWrapper>
    );

    const wrapper = component.UNSAFE_getByType(View);
    fireEvent(wrapper, 'touchStart', {
      nativeEvent: { pageX: 5, pageY: 6, target: 21 },
    });
    fireEvent(wrapper, 'touchEnd', {
      nativeEvent: { pageX: 5, pageY: 6, target: 21 },
    });

    expect(peekJourneyEvents()).toEqual([]);

    enableJourneyConsumer();

    fireEvent(wrapper, 'touchStart', {
      nativeEvent: { pageX: 5, pageY: 6, target: 21 },
    });
    fireEvent(wrapper, 'touchEnd', {
      nativeEvent: { pageX: 5, pageY: 6, target: 21 },
    });

    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        k: 'click',
        v: 'View',
        m: { id: '21', ac: 'tap', x: 5, y: 6 },
      }),
    ]);
  });

  it('does not emit drag events for a stationary long press', () => {
    initJourneyTracking();
    enableJourneyConsumer();
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1000;
    nowSpy.mockImplementation(() => now);
    const component = render(
      <JourneyWrapper>
        <Text>child</Text>
      </JourneyWrapper>
    );

    const wrapper = component.UNSAFE_getByType(View);
    fireEvent(wrapper, 'touchStart', {
      nativeEvent: { pageX: 5, pageY: 6, target: 23 },
    });

    now = 1401;

    fireEvent(wrapper, 'touchEnd', {
      nativeEvent: { pageX: 5, pageY: 6, target: 23 },
    });

    expect(peekJourneyEvents()).toEqual([]);
  });

  it('rounds captured touch coordinates to integers', () => {
    initJourneyTracking();
    enableJourneyConsumer();
    const component = render(
      <JourneyWrapper>
        <Text>child</Text>
      </JourneyWrapper>
    );

    const wrapper = component.UNSAFE_getByType(View);
    fireEvent(wrapper, 'touchStart', {
      nativeEvent: { pageX: 5.4, pageY: 6.6, target: 22 },
    });
    fireEvent(wrapper, 'touchEnd', {
      nativeEvent: { pageX: 5.4, pageY: 6.6, target: 22 },
    });

    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        m: { id: '22', ac: 'tap', x: 5, y: 7 },
      }),
    ]);
  });

  it('emits drag events from the automatic wrapper when movement exceeds threshold', () => {
    initJourneyTracking();
    enableJourneyConsumer();
    const component = render(
      <JourneyWrapper>
        <Text>child</Text>
      </JourneyWrapper>
    );

    const wrapper = component.UNSAFE_getByType(View);
    fireEvent(wrapper, 'touchStart', {
      nativeEvent: { pageX: 0, pageY: 0, target: 30 },
    });
    fireEvent(wrapper, 'touchEnd', {
      nativeEvent: { pageX: 20, pageY: 20, target: 30 },
    });

    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        k: 'drag',
        v: 'View',
        m: { id: '30', ac: 'drag_start', x: 20, y: 20 },
      }),
      expect.objectContaining({
        k: 'drag',
        v: 'View',
        m: expect.objectContaining({ id: '30', ac: 'drag_end', x: 20, y: 20 }),
      }),
    ]);
  });

  it('emits scroll-shaped drag events when movement is axis-dominant', () => {
    initJourneyTracking();
    enableJourneyConsumer();
    const component = render(
      <JourneyWrapper>
        <Text>child</Text>
      </JourneyWrapper>
    );

    const wrapper = component.UNSAFE_getByType(View);
    fireEvent(wrapper, 'touchStart', {
      nativeEvent: { pageX: 0, pageY: 0, target: 40 },
    });
    fireEvent(wrapper, 'touchMove', {
      nativeEvent: { pageX: 35, pageY: 3, target: 40 },
    });
    fireEvent(wrapper, 'touchEnd', {
      nativeEvent: { pageX: 55, pageY: 4, target: 40 },
    });

    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        k: 'drag',
        v: 'ScrollView',
        m: { id: '40', ac: 'scroll_start', x: 35, y: 3, val: 'horizontal:right' },
      }),
      expect.objectContaining({
        k: 'drag',
        v: 'ScrollView',
        m: expect.objectContaining({ id: '40', ac: 'scroll_end', x: 55, y: 4 }),
      }),
    ]);
  });

  it('upgrades numeric targets to semantic identifiers when richer metadata becomes available', () => {
    initJourneyTracking();
    enableJourneyConsumer();
    const component = render(
      <JourneyWrapper>
        <Text>child</Text>
      </JourneyWrapper>
    );

    const wrapper = component.UNSAFE_getByType(View);
    fireEvent(wrapper, 'touchStart', {
      nativeEvent: { pageX: 0, pageY: 0, target: 41 },
    });
    fireEvent(wrapper, 'touchMove', {
      nativeEvent: {
        pageX: 25,
        pageY: 2,
        target: 41,
        _dispatchInstances: {
          pendingProps: { testID: 'checkout-cta' },
          return: null,
        },
      },
    });
    fireEvent(wrapper, 'touchEnd', {
      nativeEvent: { pageX: 30, pageY: 4, target: 41 },
    });

    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        m: { id: 'checkout-cta', ac: 'scroll_start', x: 25, y: 2, val: 'horizontal:right' },
      }),
      expect.objectContaining({
        m: expect.objectContaining({ id: 'checkout-cta', ac: 'scroll_end' }),
      }),
    ]);
  });

  it('reads semantic identifiers from the synthetic event when nativeEvent lacks fiber metadata', () => {
    initJourneyTracking();
    enableJourneyConsumer();
    const component = render(
      <JourneyWrapper>
        <Text>child</Text>
      </JourneyWrapper>
    );

    const wrapper = component.UNSAFE_getByType(View);
    fireEvent(wrapper, 'touchStart', {
      nativeEvent: { pageX: 0, pageY: 0, target: 42 },
    });
    fireEvent(wrapper, 'touchMove', {
      _dispatchInstances: {
        pendingProps: { nativeID: 'launch-captcha' },
        return: null,
      },
      nativeEvent: {
        pageX: 25.2,
        pageY: 2.2,
        target: 42,
      },
    });
    fireEvent(wrapper, 'touchEnd', {
      nativeEvent: { pageX: 30.1, pageY: 4.4, target: 42 },
    });

    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        m: { id: 'launch-captcha', ac: 'scroll_start', x: 25, y: 2, val: 'horizontal:right' },
      }),
      expect.objectContaining({
        m: expect.objectContaining({ id: 'launch-captcha', ac: 'scroll_end', x: 30, y: 4 }),
      }),
    ]);
  });

  it('prefers semantic identifiers over numeric fallbacks during resolution', () => {
    expect(resolveJourneyIdentifier({
      target: 99,
      _dispatchInstances: {
        pendingProps: { nativeID: 'primary-action' },
        return: null,
      },
    })).toBe('primary-action');
  });

  it('resolves identifiers from the synthetic event before falling back to native numeric targets', () => {
    expect(resolveJourneyIdentifier({
      _dispatchInstances: {
        pendingProps: { testID: 'warmup-touch' },
        return: null,
      },
      nativeEvent: {
        target: 99,
      },
    })).toBe('warmup-touch');
  });

  it('retains the last 50 events in the ring buffer', () => {
    initJourneyTracking();

    for (let index = 0; index < 60; index += 1) {
      emitJourneyEvent('click', 'View', { id: `event-${index}`, ac: 'tap' });
    }

    const events = peekJourneyEvents();
    expect(events).toHaveLength(50);
    expect(events[0].m.id).toBe('event-10');
    expect(events[49].m.id).toBe('event-59');
  });

  it('peek keeps buffered events while drain returns and clears them', () => {
    initJourneyTracking();
    emitJourneyEvent('click', 'View', { id: 'peeked', ac: 'tap' });

    expect(peekJourneyEvents()).toHaveLength(1);
    expect(peekJourneyEvents()).toHaveLength(1);
    expect(drainJourneyEvents()).toEqual([
      expect.objectContaining({
        k: 'click',
        v: 'View',
        m: { id: 'peeked', ac: 'tap' },
      }),
    ]);
    expect(peekJourneyEvents()).toEqual([]);
  });

  it('keeps buffering after the last consumer disables', () => {
    initJourneyTracking();

    enableJourneyConsumer();
    disableJourneyConsumer();
    emitJourneyEvent('click', 'View', { id: 'idle-event', ac: 'tap' });

    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        k: 'click',
        v: 'View',
        m: { id: 'idle-event', ac: 'tap' },
      }),
    ]);
  });

  it('publishes runtime stats and optional debug logs', () => {
    const onStats = jest.fn();
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    initJourneyTracking({ debug: true, onStats });
    emitJourneyEvent('click', 'View', { id: 'screen', ac: 'tap' });
    enableJourneyConsumer();
    disableJourneyConsumer();

    expect(debugSpy).toHaveBeenCalledWith('[hcaptcha] journey', expect.objectContaining({
      k: 'click',
      v: 'View',
    }));
    expect(onStats).toHaveBeenLastCalledWith(expect.objectContaining({
      activeConsumers: 0,
      bufferedEvents: 1,
      capturing: true,
      initialized: true,
      touchCaptureEnabled: true,
      wrapperInstalled: true,
    }));
  });

  it('supports disabling touch capture while keeping the rest of journey tracking enabled', () => {
    const wrapperSpy = jest.spyOn(AppRegistry, 'setWrapperComponentProvider');
    const navigation = {
      addListener: jest.fn(() => () => {}),
      getCurrentRoute: jest.fn(() => ({ key: 'home-key', name: 'Home' })),
    };

    initJourneyTracking({ navigationContainerRef: navigation, touchCapture: false });
    enableJourneyConsumer();

    expect(wrapperSpy).not.toHaveBeenCalled();
    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        k: 'screen',
        v: 'Screen',
        m: { id: 'screen', sc: 'Home', ac: 'appear' },
      }),
    ]);

    const component = render(
      <JourneyWrapper>
        <Text>child</Text>
      </JourneyWrapper>
    );

    const wrapper = component.UNSAFE_getByType(View);
    fireEvent(wrapper, 'touchStart', {
      nativeEvent: { pageX: 9, pageY: 10, target: 90 },
    });
    fireEvent(wrapper, 'touchEnd', {
      nativeEvent: { pageX: 9, pageY: 10, target: 90 },
    });

    expect(peekJourneyEvents()).toEqual([
      expect.objectContaining({
        k: 'screen',
        v: 'Screen',
        m: { id: 'screen', sc: 'Home', ac: 'appear' },
      }),
    ]);
  });
});
