import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import hCaptchaLoaderInlineScript from '@hcaptcha/loader/inline';
import WebView from 'react-native-webview';
import { ActivityIndicator, Linking, Platform, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import ReactNativeVersion from 'react-native/Libraries/Core/ReactNativeVersion';

import md5 from './md5';
import hcaptchaPackage from './package.json';
import {
  clearJourneyEvents,
  disableJourneyConsumer,
  enableJourneyConsumer,
  peekJourneyEvents,
} from './journey';

const patchPostMessageJsCode = `(${String(function () {
  var originalPostMessage = window.ReactNativeWebView.postMessage;
  var patchedPostMessage = function (message, targetOrigin, transfer) {
    originalPostMessage(message, targetOrigin, transfer);
  };
  patchedPostMessage.toString = function () {
    return String(Object.hasOwnProperty).replace(
      'hasOwnProperty',
      'postMessage'
    );
  };
  window.ReactNativeWebView.postMessage = patchedPostMessage;
})})();`;

const HCAPTCHA_READY_EVENT = '__hcaptcha_ready__';
const HCAPTCHA_REQUEST_EVENT = '__hcaptcha_request__:';
const HCAPTCHA_LOAD_ERROR_EVENT = '__hcaptcha_load_error__:';

const serializeForInlineScript = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

const normalizeTheme = (value) => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_) {
      return value;
    }
  }

  return value;
};

const normalizeSize = (value) => {
  if (value == null) {
    return 'invisible';
  }

  return value === 'checkbox' ? 'normal' : value;
};

const getVersionPart = (value) => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 100
    ? value
    : null
);

const parseReactNativeVersion = (value) => {
  const candidate = value && typeof value === 'object' && value.version ? value.version : value;
  const major = getVersionPart(candidate?.major);
  const minor = getVersionPart(candidate?.minor);
  const patch = getVersionPart(candidate?.patch);

  if (major == null || minor == null || patch == null) {
    return null;
  }

  return { major, minor, patch };
};

const getReactNativeVersion = (value = Platform?.constants?.reactNativeVersion) =>
  parseReactNativeVersion(value) || parseReactNativeVersion(ReactNativeVersion?.version);

const buildDebugInfo = (debug, reactNativeVersion = Platform?.constants?.reactNativeVersion) => {
  const result = { ...(debug || {}) };

  try {
    const version = getReactNativeVersion(reactNativeVersion);
    if (version) {
      result[`rnver_${version.major}_${version.minor}_${version.patch}`] = true;
    }
    result['dep_' + md5(Object.keys(global).join(''))] = true;
    result['sdk_' + hcaptchaPackage.version.toString().replace(/\./g, '_')] = true;
  } catch (e) {
    console.log(e);
  }

  return result;
};

const buildVerifyData = ({
  phoneNumber,
  phonePrefix,
  rqdata,
  userJourney,
  verifyParams,
}) => {
  const normalizedVerifyParams = verifyParams || {};
  const data = {};
  const finalRqdata = normalizedVerifyParams.rqdata ?? rqdata ?? undefined;
  const finalPhonePrefix = normalizedVerifyParams.phonePrefix ?? phonePrefix ?? undefined;
  const finalPhoneNumber = normalizedVerifyParams.phoneNumber ?? phoneNumber ?? undefined;

  if (finalRqdata) {
    data.rqdata = finalRqdata;
  }
  if (finalPhonePrefix) {
    data.mfa_phoneprefix = finalPhonePrefix;
  }
  if (finalPhoneNumber) {
    data.mfa_phone = finalPhoneNumber;
  }
  if (Array.isArray(userJourney) && userJourney.length > 0) {
    data.userjourney = userJourney;
  }

  return data;
};

const buildVerifyInjectionScript = (payload, resetFirst = false, requestId) =>
  `try { ${resetFirst ? 'reset(); ' : ''}${requestId === undefined ? '' : `setRequest(${requestId}); `}setData(${serializeForInlineScript(payload)}); execute(); } catch (e) { window.ReactNativeWebView.postMessage((e && e.name) || 'error'); } true;`;

const getHcaptchaHost = (host, siteKey) => {
  if (host) {
    return host;
  } else if (siteKey) {
    return `${siteKey}.react-native.hcaptcha.com`;
  } else {
    return 'missing-sitekey.react-native.hcaptcha.com';
  }
};

function buildHcaptchaLoaderConfig({
  scriptSource,
  siteKey,
  hl,
  theme,
  host,
  sentry,
  endpoint,
  assethost,
  imghost,
  reportapi,
}) {
  return {
    scriptSource: scriptSource || 'https://hcaptcha.com/1/api.js',
    render: 'explicit',
    host: getHcaptchaHost(host, siteKey),
    hl,
    custom: typeof theme === 'object',
    sentry,
    endpoint,
    assethost,
    imghost,
    reportapi,
  };
}

/**
 *
 * @param {*} onMessage: callback after receiving response, error, or when user cancels
 * @param {*} siteKey: your hCaptcha sitekey
 * @param {string} size: The size of the widget, can be 'invisible', 'compact' or 'normal'. 'checkbox' is kept as a legacy alias for 'normal'. Default: 'invisible'
 * @param {*} style: custom style
 * @param {*} url: base url
 * @param {*} languageCode: can be found at https://docs.hcaptcha.com/languages
 * @param {*} showLoading: loading indicator for webview till hCaptcha web content loads
 * @param {*} closableLoading: allow user to cancel hcaptcha during loading by touch loader overlay
 * @param {*} loadingIndicatorColor: color for the ActivityIndicator
 * @param {*} backgroundColor: backgroundColor which can be injected into HTML to alter css backdrop colour
 * @param {string|object} theme: can be 'light', 'dark', 'contrast' or custom theme object
 * @param {string} rqdata: see Enterprise docs
 * @param {boolean} sentry: sentry error reporting
 * @param {string} jsSrc: The url of api.js. Default: https://js.hcaptcha.com/1/api.js (Override only if using first-party hosting feature.)
 * @param {string} endpoint: Point hCaptcha JS Ajax Requests to alternative API Endpoint. Default: https://api.hcaptcha.com (Override only if using first-party hosting feature.)
 * @param {string} reportapi: Point hCaptcha Bug Reporting Request to alternative API Endpoint. Default: https://accounts.hcaptcha.com (Override only if using first-party hosting feature.)
 * @param {string} assethost: Points loaded hCaptcha assets to a user defined asset location, used for proxies. Default: https://newassets.hcaptcha.com (Override only if using first-party hosting feature.)
 * @param {string} imghost: Points loaded hCaptcha challenge images to a user defined image location, used for proxies. Default: https://imgs.hcaptcha.com (Override only if using first-party hosting feature.)
 * @param {string} host: hCaptcha SDK host identifier. null value means that it will be generated by SDK
 * @param {object} debug: debug information
 * @param {string} orientation: hCaptcha challenge orientation
 * @param {string} phonePrefix: Optional phone country calling code (without '+'), e.g., "44". Used in MFA flows.
 * @param {string} phoneNumber: Optional full phone number in E.164 format ("+44123..."), for use in MFA.
 * @param {boolean} userJourney: Enable automatic user journey injection
 * @param {object} verifyParams: Verification payload overrides
 * @param {boolean} prewarm: Load the SDK on mount and defer verification until execute()
 */
const Hcaptcha = forwardRef(({
  onMessage,
  size,
  siteKey,
  style,
  url,
  languageCode,
  showLoading,
  closableLoading,
  loadingIndicatorColor,
  backgroundColor,
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
  prewarm = false,
  _journeyManagedExternally,
  _onRequestChange,
  _onTokenTimerChange,
}, ref) => {
  const tokenTimeout = 120000;
  const loadingTimeout = 15000;
  const [isLoading, setIsLoading] = useState(true);
  const [webViewGeneration, setWebViewGeneration] = useState(0);
  const [destroyed, setDestroyed] = useState(false);
  const destroyedRef = useRef(false);
  const lifetimeRef = useRef({});
  const lifetime = lifetimeRef.current;
  const isLoadingRef = useRef(true);
  const journeyEnabled = Boolean(userJourney);
  const hasJourneyConsumerRef = useRef(false);
  const readyRef = useRef(false);
  const loadStartedRef = useRef(false);
  const executeRequestedRef = useRef(!prewarm);
  const requestIdRef = useRef(0);
  const prewarmRef = useRef(prewarm);
  const hasExecutedRef = useRef(false);
  const loadFailedRef = useRef(false);
  const webViewRef = useRef(null);
  const documentRef = useRef(null);
  const loadingTimerRef = useRef(null);
  const tokenTimerRef = useRef(null);
  const clearTokenTimer = useCallback(() => {
    clearTimeout(tokenTimerRef.current);
    _onTokenTimerChange?.(tokenTimerRef.current, false);
  }, [_onTokenTimerChange]);
  const onMessageRef = useRef(onMessage);
  const resetRef = useRef(null);
  const mountedRef = useRef(true);
  onMessageRef.current = onMessage;
  prewarmRef.current = prewarm;
  const setExecuteRequested = useCallback((requested) => {
    executeRequestedRef.current = requested;
    _onRequestChange?.(requested);
  }, [_onRequestChange]);
  // Retained reset hooks follow renders, but cannot cross explicit destruction.
  const reset = useCallback(() => {
    if (mountedRef.current && lifetimeRef.current === lifetime) {
      resetRef.current();
    }
  }, [lifetime]);
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

  const debugInfo = useMemo(
    () => buildDebugInfo(debug),
    [debug]
  );

  const serializedWebViewConfig = useMemo(
    () => serializeForInlineScript({
      loaderConfig,
      backgroundColor: backgroundColor ?? '',
      debugInfo,
      phoneNumber: phoneNumber ?? null,
      phonePrefix: phonePrefix ?? null,
      orientation: orientation ?? null,
      rqdata: rqdata ?? null,
      siteKey: siteKey || '',
      size: normalizedSize,
      theme: normalizedTheme,
    }),
    [loaderConfig, backgroundColor, debugInfo, normalizedSize, normalizedTheme, orientation, phoneNumber, phonePrefix, rqdata, siteKey]
  );

  const generateTheWebViewContent = useMemo(
    () =>
     `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <script type="text/javascript">
          var hcaptchaConfig = ${serializedWebViewConfig};
          Object.entries(hcaptchaConfig.debugInfo || {}).forEach(function (entry) { window[entry[0]] = entry[1] });
        </script>
        <script type="text/javascript">
          ${hCaptchaLoaderInlineScript}
        </script>
        <script type="text/javascript">
          var getErrorData = function(error) {
            return typeof error === 'string' ? error : (error && error.message) || (error && error.name) || 'error';
          };
          var postLoadError = function(error) {
            window.ReactNativeWebView.postMessage("${HCAPTCHA_LOAD_ERROR_EVENT}" + JSON.stringify(getErrorData(error)));
          };
          var loadApiScript = function() {
            if (typeof window.hCaptchaLoader !== 'function') {
              postLoadError('error');
              return;
            }

            window.hCaptchaLoader(hcaptchaConfig.loaderConfig).then(onloadCallback).catch(postLoadError);
          };
          var hcaptchaWidgetId = null;
          var hcaptchaRequestId = null;
          var setRequest = function(requestId) {
            hcaptchaRequestId = requestId;
          };
          var postRequestMessage = function(data, requestId, error) {
            window.ReactNativeWebView.postMessage(requestId === null ? data :
              "${HCAPTCHA_REQUEST_EVENT}" + JSON.stringify({ requestId: requestId, data: data, error: Boolean(error) }));
          };
          var postCallback = function(data) {
            if (hcaptchaRequestId === null) {
              window.ReactNativeWebView.postMessage(data);
            }
          };
          var setData = function(data) {
            hcaptcha.setData(hcaptchaWidgetId, data || {});
          };
          var execute = function() {
            if (hcaptchaRequestId === null) {
              hcaptcha.execute(hcaptchaWidgetId);
            } else {
              var requestId = hcaptchaRequestId;
              hcaptcha.execute(hcaptchaWidgetId, { async: true }).then(function(result) {
                postRequestMessage(result.response, requestId);
              }, function(error) {
                postRequestMessage(getErrorData(error), requestId, true);
              });
            }
          };
          var reset = function() {
            hcaptcha.reset(hcaptchaWidgetId);
          };
          var onloadCallback = function() {
            try {
              console.log("challenge onload starting");
              hcaptchaWidgetId = hcaptcha.render("hcaptcha-container", getRenderConfig(hcaptchaConfig.siteKey, hcaptchaConfig.theme, hcaptchaConfig.size, hcaptchaConfig.orientation));
              window.ReactNativeWebView.postMessage("${HCAPTCHA_READY_EVENT}");
              // have loaded by this point; render is sync.
              console.log("challenge render complete");
            } catch (e) {
              console.log("challenge failed to render:", e);
              postLoadError(e.name || 'error');
            }
          };
          var onDataCallback = function(response) {
            postCallback(response);
          };
          var onCancel = function() {
            postCallback("challenge-closed");
          };
          var onOpen = function() {
            document.body.style.backgroundColor = hcaptchaConfig.backgroundColor;
            postRequestMessage("open", hcaptchaRequestId);
            console.log("challenge opened");
          };
          var onDataExpiredCallback = function(error) { postCallback(error); };
          var onChalExpiredCallback = function(error) { postCallback(error); };
          var onDataErrorCallback = function(error) {
            console.warn("challenge error callback fired");
            postCallback(error);
          };
          const getRenderConfig = function(siteKey, theme, size, orientation) {
            var config = {
              sitekey: siteKey,
              size: size,
              callback: onDataCallback,
              "close-callback": onCancel,
              "open-callback": onOpen,
              "expired-callback": onDataExpiredCallback,
              "chalexpired-callback": onChalExpiredCallback,
              "error-callback": onDataErrorCallback
            };
            if (theme) {
              config.theme = theme;
            }
            if (orientation) {
              config.orientation = orientation;
            }
            return config;
          };
          loadApiScript();
        </script>
      </head>
      <body>
        <div id="hcaptcha-container"></div>
      </body>
      </html>`,
    [serializedWebViewConfig]
  );

  useEffect(() => {
    if (destroyed || _journeyManagedExternally || !journeyEnabled || hasJourneyConsumerRef.current) {
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
  }, [destroyed, _journeyManagedExternally, journeyEnabled]);

  const startLoadingTimeout = useCallback(() => {
    clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => {
      if (isLoadingRef.current) {
        const notify = !prewarmRef.current || executeRequestedRef.current;
        isLoadingRef.current = false;
        loadFailedRef.current = 'timeout';
        if (prewarmRef.current) {
          setExecuteRequested(false);
        }
        setIsLoading(false);
        if (notify) {
          onMessageRef.current({ nativeEvent: { data: 'error', description: 'loading timeout' }, success: false, reset });
        }
      }
    }, loadingTimeout);
  }, [reset, setExecuteRequested]);

  const documentKey = useMemo(() => JSON.stringify([serializedWebViewConfig, url, webViewGeneration, prewarm]), [serializedWebViewConfig, url, webViewGeneration, prewarm]);
  const documentId = useMemo(() => ({ key: documentKey }), [documentKey]);
  useLayoutEffect(() => {
    if (destroyed) {
      return;
    }
    documentRef.current = documentId;
    loadStartedRef.current = false;
    readyRef.current = false;
    hasExecutedRef.current = false;
    loadFailedRef.current = false;
    if (!prewarm) {
      setExecuteRequested(true);
    }
    isLoadingRef.current = true;
    setIsLoading(true);
    startLoadingTimeout();
  }, [destroyed, documentId, prewarm, setExecuteRequested, startLoadingTimeout]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      documentRef.current = null;
      clearTimeout(loadingTimerRef.current);
    };
  }, []);

  useEffect(() => () => {
    if (prewarm) {
      clearTokenTimer();
    }
  }, [prewarm, clearTokenTimer]);

  const injectVerifyData = (resetFirst = false) => {
    if (!webViewRef.current) {
      return;
    }

    hasExecutedRef.current = true;
    webViewRef.current.injectJavaScript(buildVerifyInjectionScript(buildVerifyData({
      phoneNumber,
      phonePrefix,
      rqdata,
      userJourney: journeyEnabled ? peekJourneyEvents() : undefined,
      verifyParams,
    }), resetFirst, prewarm ? ++requestIdRef.current : undefined));
  };

  // This shows ActivityIndicator till webview loads hCaptcha images
  const renderLoading = () => (
    <TouchableWithoutFeedback onPress={() => closableLoading && onMessage({ nativeEvent: { data: 'cancel' } })}>
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={loadingIndicatorColor} />
      </View>
    </TouchableWithoutFeedback>
  );

  resetRef.current = () => {
    setExecuteRequested(true);
    if (readyRef.current) {
      injectVerifyData(true);
    } else if (loadFailedRef.current) {
      retryApiLoad();
    }
  };

  const reloadWebView = () => {
    if (!mountedRef.current || documentRef.current !== documentId) {
      return;
    }
    documentRef.current = null;
    readyRef.current = false;
    hasExecutedRef.current = false;
    isLoadingRef.current = true;
    setIsLoading(true);
    startLoadingTimeout();
    // WKWebView.reload() can lose inline HTML after its content process dies.
    setWebViewGeneration((generation) => generation + 1);
  };

  const retryApiLoad = () => {
    if (!webViewRef.current || documentRef.current !== documentId) {
      return;
    }

    const timedOut = loadFailedRef.current === 'timeout';
    loadFailedRef.current = false;
    if (timedOut) {
      reloadWebView();
    } else {
      isLoadingRef.current = true;
      setIsLoading(true);
      startLoadingTimeout();
      webViewRef.current.injectJavaScript('loadApiScript(); true;');
    }
  };

  useImperativeHandle(ref, () => ({
    execute: () => {
      destroyedRef.current = false;
      setDestroyed(false);
      if (executeRequestedRef.current && !loadFailedRef.current) {
        return;
      }
      setExecuteRequested(true);
      if (readyRef.current) {
        injectVerifyData(hasExecutedRef.current);
      } else if (loadFailedRef.current) {
        retryApiLoad();
      }
    },
    reset: () => {
      if (destroyedRef.current) {
        return;
      }
      setExecuteRequested(false);
      if (readyRef.current) {
        webViewRef.current?.injectJavaScript("try { reset(); } catch (e) { window.ReactNativeWebView.postMessage((e && e.name) || 'error'); } true;");
      }
    },
    destroy: () => {
      setExecuteRequested(false);
      destroyedRef.current = true;
      lifetimeRef.current = {};
      documentRef.current = null;
      readyRef.current = false;
      loadFailedRef.current = false;
      isLoadingRef.current = false;
      clearTimeout(loadingTimerRef.current);
      clearTokenTimer();
      setDestroyed(true);
      setWebViewGeneration((generation) => generation + 1);
    },
  }));

  if (destroyed) {
    return null;
  }

  return (
    <View style={styles.container}>
      <WebView
        key={documentKey}
        ref={webViewRef}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(event) => {
          if (documentRef.current !== documentId) {
            return false;
          }
          if (event.url.slice(0, 24) === 'https://www.hcaptcha.com') {
            Linking.openURL(event.url);
            return false;
          } else if (event.url.toLowerCase().startsWith('sms:')) {
            Linking.openURL(event.url).catch((err) => {
              if (documentRef.current !== documentId) {
                return;
              }
              onMessage({
                nativeEvent: {
                  data: 'sms-open-failed',
                  description: err.message,
                },
                success: false,
              });
            });
            return false;
          }

          return true;
        }}
        mixedContentMode={'always'}
        onContentProcessDidTerminate={reloadWebView}
        onRenderProcessGone={reloadWebView}
        onLoadStart={() => {
          if (documentRef.current !== documentId) {
            return;
          }
          // Android can deliver the initial load event after SDK readiness.
          if (!loadStartedRef.current) {
            loadStartedRef.current = true;
            return;
          }
          reloadWebView();
        }}
        onMessage={(event) => {
          if (documentRef.current !== documentId) {
            return;
          }
          // Native events can be pooled with custom fields from an earlier token.
          const e = Object.create(Object.getPrototypeOf(event), Object.getOwnPropertyDescriptors({
            ...event,
            nativeEvent: { ...event.nativeEvent },
          }));
          let requestError = false;
          let requestMessage = false;
          let loadError = false;
          if (e.nativeEvent.data.startsWith(HCAPTCHA_LOAD_ERROR_EVENT)) {
            try {
              const data = JSON.parse(e.nativeEvent.data.slice(HCAPTCHA_LOAD_ERROR_EVENT.length));
              if (typeof data !== 'string') {
                return;
              }
              e.nativeEvent.data = data;
              loadError = true;
            } catch (_) {
              return;
            }
          }
          if (!loadError && e.nativeEvent.data.startsWith(HCAPTCHA_REQUEST_EVENT)) {
            let message;
            try {
              message = JSON.parse(e.nativeEvent.data.slice(HCAPTCHA_REQUEST_EVENT.length));
            } catch (_) {
              return;
            }
            if (!message || !executeRequestedRef.current || message.requestId !== requestIdRef.current || typeof message.data !== 'string' || (message.error !== undefined && typeof message.error !== 'boolean')) {
              return;
            }
            e.nativeEvent.data = message.data;
            requestError = Boolean(message.error);
            requestMessage = true;
          }
          e.markUsed = undefined;

          if (!loadError && !requestMessage && e.nativeEvent.data === HCAPTCHA_READY_EVENT) {
            clearTimeout(loadingTimerRef.current);
            isLoadingRef.current = false;
            setIsLoading(false);
            if (!readyRef.current) {
              readyRef.current = true;
              loadFailedRef.current = false;
              if (executeRequestedRef.current) {
                injectVerifyData();
              }
            }
            return;
          }

          if (loadError || (!requestMessage && (e.nativeEvent.data === 'script-error' || (!readyRef.current && e.nativeEvent.data === 'error')))) {
            const notify = !prewarm || executeRequestedRef.current;
            clearTimeout(loadingTimerRef.current);
            isLoadingRef.current = false;
            setIsLoading(false);
            readyRef.current = false;
            loadFailedRef.current = true;
            e.reset = reset;
            e.success = false;
            if (prewarm) {
              setExecuteRequested(false);
            }
            if (notify) {
              onMessage(e);
            }
            return;
          }
          e.reset = reset;
          e.success = true;
          if (!requestError && e.nativeEvent.data === 'open') {
            clearTimeout(loadingTimerRef.current);
            isLoadingRef.current = false;
            setIsLoading(false);
          } else if ((!prewarm || readyRef.current) && !requestError && e.nativeEvent.data.length > 35) {
            if (prewarm && !executeRequestedRef.current) {
              return;
            }
            setExecuteRequested(false);
            clearTimeout(loadingTimerRef.current);
            isLoadingRef.current = false;
            setIsLoading(false);
            clearTokenTimer();
            const expiredTokenTimerId = setTimeout(() => {
              _onTokenTimerChange?.(expiredTokenTimerId, false);
              onMessageRef.current({ nativeEvent: { data: 'expired' }, success: false, reset });
            }, tokenTimeout);
            tokenTimerRef.current = expiredTokenTimerId;
            _onTokenTimerChange?.(expiredTokenTimerId, true);
            e.markUsed = () => {
              clearTimeout(expiredTokenTimerId);
              _onTokenTimerChange?.(expiredTokenTimerId, false);
            };
            if (journeyEnabled) {
              clearJourneyEvents();
            }
          } else /* error */ {
            if (readyRef.current) {
              setExecuteRequested(false);
            }
            e.success = false;
          }
          onMessage(e);
        }}
        javaScriptEnabled
        injectedJavaScript={patchPostMessageJsCode}
        automaticallyAdjustContentInsets
        style={[styles.webview, style]}
        source={{
          html: generateTheWebViewContent,
          baseUrl: `${url}`,
        }}
      />
      {showLoading && isLoading && renderLoading()}
    </View>
  );
});

Hcaptcha.displayName = 'Hcaptcha';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  webview: {
    backgroundColor: 'transparent',
    width: '100%',
  },
});

export default Hcaptcha;
export { buildDebugInfo, buildVerifyData, HCAPTCHA_READY_EVENT };
