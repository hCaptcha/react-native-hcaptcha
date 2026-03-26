import { AppRegistry } from 'react-native';
import { createJourneyEvent, cloneJourneyEvent, JourneyEventKind, JourneyField, JOURNEY_MAX_EVENTS } from './schema';

const state = {
  activeConsumers: 0,
  capturing: false,
  currentRoute: null,
  events: [],
  initialized: false,
  navigationCleanup: null,
  navigationTarget: null,
  wrapperInstalled: false,
};

const isFunction = (value) => typeof value === 'function';

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
};

const installWrapperProvider = () => {
  if (state.wrapperInstalled || !AppRegistry || !isFunction(AppRegistry.setWrapperComponentProvider)) {
    return;
  }

  AppRegistry.setWrapperComponentProvider(() => require('./wrapper').default);
  state.wrapperInstalled = true;
};

export const initJourneyTracking = (options = {}) => {
  if (!state.initialized) {
    state.initialized = true;
    setCapturing(true);
    installWrapperProvider();
  }

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

  if (wasInactive && state.currentRoute) {
    pushEvent(createJourneyEvent(JourneyEventKind.screen, 'Screen', {
      [JourneyField.id]: 'screen',
      [JourneyField.screen]: state.currentRoute.name,
      [JourneyField.action]: 'appear',
    }));
  }
};

export const disableJourneyConsumer = () => {
  if (state.activeConsumers > 0) {
    state.activeConsumers -= 1;
  }

  if (state.activeConsumers === 0) {
    clearJourneyEvents();
    setCapturing(false);
  }
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
};

const readIdentifierFromProps = (props) => {
  if (!props || typeof props !== 'object') {
    return null;
  }

  return props.nativeID || props.testID || props.accessibilityLabel || null;
};

export const resolveJourneyIdentifier = (nativeEvent) => {
  const targetInst = nativeEvent?._targetInst;
  let current = targetInst;

  while (current) {
    const identifier = readIdentifierFromProps(current.memoizedProps);
    if (identifier) {
      return String(identifier);
    }
    current = current.return;
  }

  if (nativeEvent && nativeEvent.target != null) {
    return String(nativeEvent.target);
  }

  return 'unknown';
};

export const isJourneyCapturing = () => state.capturing;

export const __unsafeResetJourneyRuntime = () => {
  clearNavigationCleanup();
  state.activeConsumers = 0;
  state.capturing = false;
  state.currentRoute = null;
  state.events = [];
  state.initialized = false;
  state.navigationTarget = null;
  state.wrapperInstalled = false;
};
