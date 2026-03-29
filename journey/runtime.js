import { AppRegistry } from 'react-native';
import { createJourneyEvent, cloneJourneyEvent, JourneyEventKind, JourneyField, JOURNEY_MAX_EVENTS } from './schema';

const state = {
  activeConsumers: 0,
  capturing: false,
  currentRoute: null,
  debug: false,
  events: [],
  initialized: false,
  navigationCleanup: null,
  navigationTarget: null,
  statsListener: null,
  touchCaptureEnabled: true,
  wrapperInstalled: false,
};

const isFunction = (value) => typeof value === 'function';
const numericIdentifierPattern = /^\d+$/;
const getEventPayload = (event) => event?.nativeEvent || event || null;
const baseSetWrapperComponentProvider = AppRegistry && isFunction(AppRegistry.setWrapperComponentProvider)
  ? AppRegistry.setWrapperComponentProvider.bind(AppRegistry)
  : null;
let appRegistrySetterPatched = false;
let externalWrapperProvider = null;
let installingJourneyWrapperProvider = false;
let originalSetWrapperComponentProvider = baseSetWrapperComponentProvider;

const normalizeNavigationTarget = (target) => {
  if (!target) {
    return null;
  }

  if (typeof target === 'object' && 'current' in target) {
    return target.current || null;
  }

  return target;
};

const setCapturing = (value) => {
  state.capturing = Boolean(value);
};

const hasCurrentScreenEvent = () =>
  state.events.some((event) =>
    event[JourneyField.kind] === JourneyEventKind.screen
    && event[JourneyField.metadata]?.[JourneyField.screen] === state.currentRoute?.name
    && event[JourneyField.metadata]?.[JourneyField.action] === 'appear'
  );

const getJourneyRuntimeStats = () => ({
  activeConsumers: state.activeConsumers,
  bufferedEvents: state.events.length,
  capturing: state.capturing,
  currentRoute: state.currentRoute ? { ...state.currentRoute } : null,
  initialized: state.initialized,
  touchCaptureEnabled: state.touchCaptureEnabled,
  wrapperInstalled: state.wrapperInstalled,
});

const publishStats = () => {
  if (state.statsListener) {
    state.statsListener(getJourneyRuntimeStats());
  }
};

const configureRuntime = (options = {}) => {
  if (Object.prototype.hasOwnProperty.call(options, 'debug')) {
    state.debug = Boolean(options.debug);
  }

  if (Object.prototype.hasOwnProperty.call(options, 'onStats')) {
    state.statsListener = isFunction(options.onStats) ? options.onStats : null;
  }

  if (Object.prototype.hasOwnProperty.call(options, 'touchCapture')) {
    state.touchCaptureEnabled = options.touchCapture !== false;
  }

  publishStats();
};

const clearNavigationCleanup = () => {
  if (!state.navigationCleanup) {
    return;
  }

  if (isFunction(state.navigationCleanup)) {
    state.navigationCleanup();
  } else if (isFunction(state.navigationCleanup.remove)) {
    state.navigationCleanup.remove();
  }

  state.navigationCleanup = null;
};

const getRouteIdentity = (route) => {
  if (!route || typeof route.name !== 'string' || route.name.length === 0) {
    return null;
  }

  return {
    key: typeof route.key === 'string' ? route.key : undefined,
    name: route.name,
  };
};

const sameRoute = (left, right) => {
  if (!left || !right) {
    return false;
  }

  if (left.key && right.key) {
    return left.key === right.key;
  }

  return left.name === right.name;
};

const pushEvent = (event) => {
  if (!state.capturing) {
    return;
  }

  state.events.push(event);

  if (state.events.length > JOURNEY_MAX_EVENTS) {
    state.events.splice(0, state.events.length - JOURNEY_MAX_EVENTS);
  }

  if (state.debug && typeof console !== 'undefined' && isFunction(console.debug)) {
    console.debug('[hcaptcha] journey', event);
  }

  publishStats();
};

const createPassthroughWrapperProvider = () => () => {
  const React = require('react');

  return function JourneyPassthroughWrapper({ children }) {
    return React.createElement(React.Fragment, null, children);
  };
};

const createComposedWrapperProvider = () => (appParameters) => {
  const React = require('react');
  const JourneyWrapper = require('./wrapper').default;
  const ExternalWrapper = externalWrapperProvider ? externalWrapperProvider(appParameters) : null;

  if (!ExternalWrapper) {
    return JourneyWrapper;
  }

  return function ComposedJourneyWrapper({ children }) {
    return React.createElement(
      ExternalWrapper,
      null,
      React.createElement(JourneyWrapper, null, children)
    );
  };
};

const patchWrapperProviderSetter = () => {
  if (appRegistrySetterPatched) {
    return true;
  }

  if (!AppRegistry || !isFunction(AppRegistry.setWrapperComponentProvider)) {
    return false;
  }

  originalSetWrapperComponentProvider = AppRegistry.setWrapperComponentProvider.bind(AppRegistry);
  AppRegistry.setWrapperComponentProvider = (provider) => {
    if (!installingJourneyWrapperProvider) {
      externalWrapperProvider = provider || null;
    }

    if (installingJourneyWrapperProvider || !state.touchCaptureEnabled) {
      return originalSetWrapperComponentProvider(provider);
    }

    installingJourneyWrapperProvider = true;
    try {
      return originalSetWrapperComponentProvider(createComposedWrapperProvider());
    } finally {
      installingJourneyWrapperProvider = false;
      state.wrapperInstalled = true;
      publishStats();
    }
  };
  appRegistrySetterPatched = true;
  return true;
};

const syncWrapperProvider = () => {
  const setterPatched = patchWrapperProviderSetter();

  if (!setterPatched) {
    publishStats();
    return;
  }

  if (!state.touchCaptureEnabled) {
    if (originalSetWrapperComponentProvider) {
      if (!state.wrapperInstalled && !externalWrapperProvider) {
        publishStats();
        return;
      }

      installingJourneyWrapperProvider = true;
      try {
        originalSetWrapperComponentProvider(externalWrapperProvider || createPassthroughWrapperProvider());
      } finally {
        installingJourneyWrapperProvider = false;
        state.wrapperInstalled = false;
        publishStats();
      }
    }
    return;
  }

  if (state.wrapperInstalled) {
    publishStats();
    return;
  }

  installingJourneyWrapperProvider = true;
  try {
    originalSetWrapperComponentProvider(createComposedWrapperProvider());
  } finally {
    installingJourneyWrapperProvider = false;
  }
  state.wrapperInstalled = true;
  publishStats();
};

export const initJourneyTracking = (options = {}) => {
  if (!state.initialized) {
    state.initialized = true;
    setCapturing(true);
  }

  configureRuntime(options);
  syncWrapperProvider();

  if (options.navigationContainerRef) {
    registerJourneyNavigationContainer(options.navigationContainerRef);
  }
};

export const registerJourneyNavigationContainer = (target) => {
  if (!state.initialized) {
    initJourneyTracking();
  }

  const navigationTarget = normalizeNavigationTarget(target);
  if (!navigationTarget || navigationTarget === state.navigationTarget) {
    return;
  }

  clearNavigationCleanup();
  state.navigationTarget = navigationTarget;
  publishStats();

  if (!isFunction(navigationTarget.addListener) || !isFunction(navigationTarget.getCurrentRoute)) {
    return;
  }

  const emitCurrentRoute = () => {
    const currentRoute = getRouteIdentity(navigationTarget.getCurrentRoute());
    if (!currentRoute || sameRoute(state.currentRoute, currentRoute)) {
      return;
    }

    if (state.currentRoute) {
      pushEvent(createJourneyEvent(JourneyEventKind.screen, 'Screen', {
        [JourneyField.id]: 'screen',
        [JourneyField.screen]: state.currentRoute.name,
        [JourneyField.action]: 'disappear',
      }));
    }

    pushEvent(createJourneyEvent(JourneyEventKind.screen, 'Screen', {
      [JourneyField.id]: 'screen',
      [JourneyField.screen]: currentRoute.name,
      [JourneyField.action]: 'appear',
    }));
    state.currentRoute = currentRoute;
    publishStats();
  };

  state.navigationCleanup = navigationTarget.addListener('state', emitCurrentRoute);
  emitCurrentRoute();
};

export const enableJourneyConsumer = () => {
  if (!state.initialized) {
    initJourneyTracking();
  }

  const wasInactive = state.activeConsumers === 0;
  state.activeConsumers += 1;
  setCapturing(true);

  if (wasInactive && state.currentRoute && !hasCurrentScreenEvent()) {
    pushEvent(createJourneyEvent(JourneyEventKind.screen, 'Screen', {
      [JourneyField.id]: 'screen',
      [JourneyField.screen]: state.currentRoute.name,
      [JourneyField.action]: 'appear',
    }));
  }

  publishStats();
};

export const disableJourneyConsumer = () => {
  if (state.activeConsumers > 0) {
    state.activeConsumers -= 1;
  }

  publishStats();
};

export const emitJourneyEvent = (kind, view, metadata = {}) => {
  pushEvent(createJourneyEvent(kind, view, metadata));
};

export const peekJourneyEvents = () => state.events.map(cloneJourneyEvent);

export const drainJourneyEvents = () => {
  const snapshot = peekJourneyEvents();
  clearJourneyEvents();
  return snapshot;
};

export const clearJourneyEvents = () => {
  state.events.length = 0;
  publishStats();
};

const readIdentifierFromProps = (props) => {
  if (!props || typeof props !== 'object') {
    return null;
  }

  return props.nativeID || props.testID || props.accessibilityLabel || null;
};

const readIdentifierFromNode = (node) => {
  let current = node;

  while (current) {
    const identifier = readIdentifierFromProps(current.memoizedProps)
      || readIdentifierFromProps(current.pendingProps)
      || readIdentifierFromProps(current.stateNode?.props);

    if (identifier) {
      return String(identifier);
    }

    current = current.return;
  }

  return null;
};

const readIdentifierFromNodeList = (value) => {
  if (!value) {
    return null;
  }

  const nodes = Array.isArray(value) ? value : [value];
  for (const node of nodes) {
    const identifier = readIdentifierFromNode(node);
    if (identifier) {
      return identifier;
    }
  }

  return null;
};

const getIdentifierRank = (value) => {
  if (!value || value === 'unknown') {
    return 0;
  }

  return numericIdentifierPattern.test(String(value)) ? 1 : 2;
};

export const resolveJourneyIdentifier = (event, fallbackIdentifier) => {
  const payload = getEventPayload(event);
  const directIdentifier = readIdentifierFromProps(payload);
  const fiberIdentifier = readIdentifierFromNodeList(event?._targetInst)
    || readIdentifierFromNodeList(event?._dispatchInstances)
    || readIdentifierFromNodeList(payload?._targetInst)
    || readIdentifierFromNodeList(payload?._dispatchInstances);
  const targetIdentifier = payload && payload.target != null ? String(payload.target) : null;
  const candidates = [
    fallbackIdentifier,
    directIdentifier ? String(directIdentifier) : null,
    fiberIdentifier,
    targetIdentifier,
    'unknown',
  ];

  let bestIdentifier = 'unknown';

  for (const candidate of candidates) {
    if (getIdentifierRank(candidate) > getIdentifierRank(bestIdentifier)) {
      bestIdentifier = candidate;
    }
  }

  return bestIdentifier;
};

export const isJourneyCapturing = () => state.capturing && state.touchCaptureEnabled && state.activeConsumers > 0;

export const __unsafeResetJourneyRuntime = () => {
  clearNavigationCleanup();
  if (AppRegistry && baseSetWrapperComponentProvider) {
    AppRegistry.setWrapperComponentProvider = baseSetWrapperComponentProvider;
  }
  appRegistrySetterPatched = false;
  externalWrapperProvider = null;
  installingJourneyWrapperProvider = false;
  originalSetWrapperComponentProvider = baseSetWrapperComponentProvider;
  state.activeConsumers = 0;
  state.capturing = false;
  state.currentRoute = null;
  state.debug = false;
  state.events = [];
  state.initialized = false;
  state.navigationTarget = null;
  state.statsListener = null;
  state.touchCaptureEnabled = true;
  state.wrapperInstalled = false;
};
