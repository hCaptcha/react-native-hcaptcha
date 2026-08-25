import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hCaptchaLoader } from '@hcaptcha/loader';
import { ActivityIndicator, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';

import {
  buildDebugInfo,
  buildHcaptchaLoaderConfig,
  buildRenderConfig,
  buildVerifyData,
  LOADING_TIMEOUT,
  normalizeSize,
  normalizeTheme,
  TOKEN_MIN_LENGTH,
  TOKEN_TIMEOUT,
} from './hcaptchaShared';
import {
  clearJourneyEvents,
  disableJourneyConsumer,
  enableJourneyConsumer,
  peekJourneyEvents,
} from './journey';

/**
 * Web implementation of the hCaptcha component.
 *
 * On native the widget is isolated inside a WebView and the two sides talk over
 * `postMessage` / `injectJavaScript`. On web the host page *is* a browser, so the
 * widget is rendered straight into the document with `@hcaptcha/loader` — the same
 * loader the native HTML uses — and the message channel collapses into direct calls.
 *
 * The `onMessage` contract is deliberately identical to the native one: every event is
 * delivered as `{ nativeEvent: { data } }` carrying `success`, `reset` and, for tokens,
 * `markUsed`. That keeps `index.js`, the public API and the type definitions unchanged.
 */
const Hcaptcha = ({
  onMessage,
  size,
  siteKey,
  style,
  languageCode,
  showLoading,
  closableLoading,
  loadingIndicatorColor,
  theme,
  rqdata,
  sentry,
  jsSrc,
  endpoint,
  reportapi,
  assethost,
  imghost,
  host,
  debug,
  orientation,
  phonePrefix,
  phoneNumber,
  userJourney,
  verifyParams,
  _journeyManagedExternally,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const isLoadingRef = useRef(true);
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const hasRenderedRef = useRef(false);
  const journeyEnabled = Boolean(userJourney);
  const hasJourneyConsumerRef = useRef(false);
  // Declared up front: `emit` and the widget callbacks are mutually recursive with the
  // loader, so both are reached through refs that are populated further down.
  const emitRef = useRef(null);
  const callbacksRef = useRef(null);

  const normalizedTheme = useMemo(() => normalizeTheme(theme), [theme]);
  const normalizedSize = useMemo(() => normalizeSize(size), [size]);

  const loaderConfig = useMemo(
    () => buildHcaptchaLoaderConfig({
      scriptSource: jsSrc,
      siteKey,
      hl: languageCode,
      theme: normalizedTheme,
      host,
      sentry,
      endpoint,
      assethost,
      imghost,
      reportapi,
    }),
    [jsSrc, siteKey, languageCode, normalizedTheme, host, sentry, endpoint, assethost, imghost, reportapi]
  );

  const debugInfo = useMemo(() => buildDebugInfo(debug), [debug]);

  // The native build exposes these as globals inside its WebView, where hCaptcha reads
  // them. On web the widget runs in the host document, so they go on `window` instead.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    Object.entries(debugInfo || {}).forEach(([key, value]) => {
      window[key] = value;
    });
  }, [debugInfo]);

  // Latest verify inputs, read at execute time rather than captured at render time so
  // journey events buffered after mount are still included.
  const verifyInputsRef = useRef(null);
  verifyInputsRef.current = { phoneNumber, phonePrefix, rqdata, verifyParams };

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const getApi = () => (typeof window === 'undefined' ? null : window.hcaptcha);

  const applyVerifyData = useCallback((resetFirst = false) => {
    const api = getApi();
    const widgetId = widgetIdRef.current;

    if (!api || widgetId == null) {
      return;
    }

    const { phoneNumber: pn, phonePrefix: pp, rqdata: rq, verifyParams: vp } = verifyInputsRef.current;

    try {
      if (resetFirst) {
        api.reset(widgetId);
      }
      api.setData(widgetId, buildVerifyData({
        phoneNumber: pn,
        phonePrefix: pp,
        rqdata: rq,
        userJourney: journeyEnabled ? peekJourneyEvents() : undefined,
        verifyParams: vp,
      }));
      api.execute(widgetId);
    } catch (e) {
      emitRef.current((e && e.name) || 'error');
    }
  }, [journeyEnabled]);

  const reset = useCallback(() => applyVerifyData(true), [applyVerifyData]);

  const loadApiScript = useCallback(() => {
    hCaptchaLoader(loaderConfig)
      .then(() => {
        const api = getApi();
        const container = containerRef.current;

        if (!api || !container || hasRenderedRef.current) {
          return;
        }

        try {
          widgetIdRef.current = api.render(container, buildRenderConfig({
            siteKey: siteKey || '',
            theme: normalizedTheme,
            size: normalizedSize,
            orientation,
            callbacks: callbacksRef.current,
          }));
          hasRenderedRef.current = true;
          applyVerifyData();
        } catch (e) {
          emitRef.current((e && e.name) || 'error');
        }
      })
      .catch((error) => {
        emitRef.current((error && error.message) || (error && error.name) || 'error');
      });
  }, [loaderConfig, siteKey, normalizedTheme, normalizedSize, orientation, applyVerifyData]);

  const retryApiLoad = useCallback(() => {
    hasRenderedRef.current = false;
    widgetIdRef.current = null;
    loadApiScript();
  }, [loadApiScript]);

  /**
   * Mirrors the native `onMessage` handler exactly: same loading-state side effect,
   * same `reset` selection, same token detection, same expiry timer.
   */
  const emit = useCallback((data, description) => {
    isLoadingRef.current = false;
    setIsLoading(false);

    const event = { nativeEvent: { data } };
    if (description !== undefined) {
      event.nativeEvent.description = description;
    }

    event.reset = data === 'script-error' ? retryApiLoad : reset;
    event.success = true;

    if (data === 'open') {
      // No extra handling; parity with native.
    } else if (typeof data === 'string' && data.length > TOKEN_MIN_LENGTH) {
      const expiredTokenTimerId = setTimeout(
        () => onMessageRef.current({ nativeEvent: { data: 'expired' }, success: false, reset }),
        TOKEN_TIMEOUT
      );
      event.markUsed = () => clearTimeout(expiredTokenTimerId);
      if (journeyEnabled) {
        clearJourneyEvents();
      }
    } else /* error */ {
      event.success = false;
    }

    onMessageRef.current(event);
  }, [journeyEnabled, reset, retryApiLoad]);

  emitRef.current = emit;

  callbacksRef.current = {
    onData: (response) => emitRef.current(response),
    onCancel: () => emitRef.current('challenge-closed'),
    onOpen: () => emitRef.current('open'),
    onDataExpired: (error) => emitRef.current(error || 'expired'),
    onChalExpired: (error) => emitRef.current(error || 'challenge-expired'),
    onDataError: (error) => emitRef.current(error || 'error'),
  };

  useEffect(() => {
    if (_journeyManagedExternally || !journeyEnabled || hasJourneyConsumerRef.current) {
      return undefined;
    }

    enableJourneyConsumer();
    hasJourneyConsumerRef.current = true;

    return () => {
      if (hasJourneyConsumerRef.current) {
        disableJourneyConsumer();
        hasJourneyConsumerRef.current = false;
      }
    };
  }, [_journeyManagedExternally, journeyEnabled]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (isLoadingRef.current) {
        onMessageRef.current({ nativeEvent: { data: 'error', description: 'loading timeout' } });
      }
    }, LOADING_TIMEOUT);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    loadApiScript();

    return () => {
      const api = getApi();
      const widgetId = widgetIdRef.current;

      if (api && widgetId != null && typeof api.remove === 'function') {
        try {
          api.remove(widgetId);
        } catch (e) {
          // The widget may already be gone; nothing actionable here.
        }
      }

      widgetIdRef.current = null;
      hasRenderedRef.current = false;
    };
    // Re-running on every config change would tear down an in-flight challenge, so the
    // widget is created once per mount — matching the native WebView, which is also only
    // built from the initial props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderLoading = () => (
    <TouchableWithoutFeedback onPress={() => closableLoading && onMessageRef.current({ nativeEvent: { data: 'cancel' } })}>
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={loadingIndicatorColor} />
      </View>
    </TouchableWithoutFeedback>
  );

  return (
    <View style={styles.container}>
      <View ref={containerRef} style={[styles.widget, style]} testID="hcaptcha-container" />
      {showLoading && isLoading && renderLoading()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  widget: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flex: 1,
    justifyContent: 'center',
    width: '100%',
  },
});

export default Hcaptcha;
export { buildDebugInfo, buildVerifyData, HCAPTCHA_READY_EVENT } from './hcaptchaShared';
