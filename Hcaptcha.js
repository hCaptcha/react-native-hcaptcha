import React, { useEffect, useMemo, useRef, useState } from 'react';
import WebView from 'react-native-webview';
import { ActivityIndicator, Linking, Platform, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';

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

const getReactNativeVersion = (value = Platform?.constants?.reactNativeVersion) => {
  const candidate = value && typeof value === 'object' && value.version ? value.version : value;
  const major = getVersionPart(candidate?.major);
  const minor = getVersionPart(candidate?.minor);
  const patch = getVersionPart(candidate?.patch);

  if (major == null || minor == null || patch == null) {
    return null;
  }

  return { major, minor, patch };
};

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

const buildVerifyInjectionScript = (payload, resetFirst = false) =>
  `try { ${resetFirst ? 'reset(); ' : ''}setData(${serializeForInlineScript(payload)}); execute(); } catch (e) { window.ReactNativeWebView.postMessage((e && e.name) || 'error'); } true;`;

const buildHcaptchaApiUrl = (jsSrc, siteKey, hl, theme, host, sentry, endpoint, assethost, imghost, reportapi, orientation) => {
  var url = `${jsSrc || 'https://hcaptcha.com/1/api.js'}?render=explicit&onload=onloadCallback`;

  let effectiveHost;
  if (host) {
    effectiveHost = encodeURIComponent(host);
  } else {
    effectiveHost = (siteKey || 'missing-sitekey') + '.react-native.hcaptcha.com';
  }

  for (let [key, value] of Object.entries({ host: effectiveHost, hl, custom: typeof theme === 'object', sentry, endpoint, assethost, imghost, reportapi, orientation })) {
    if (value) {
      url += `&${key}=${encodeURIComponent(value)}`;
    }
  }

  return url;
};

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
 */
const Hcaptcha = ({
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
  _journeyManagedExternally,
}) => {
  const tokenTimeout = 120000;
  const loadingTimeout = 15000;
  const [isLoading, setIsLoading] = useState(true);
  const journeyEnabled = Boolean(userJourney);
  const hasJourneyConsumerRef = useRef(false);
  const normalizedTheme = useMemo(() => normalizeTheme(theme), [theme]);
  const normalizedSize = useMemo(() => normalizeSize(size), [size]);
  const apiUrl = useMemo(
    () => buildHcaptchaApiUrl(jsSrc, siteKey, languageCode, normalizedTheme, host, sentry, endpoint, assethost, imghost, reportapi, orientation),
    [jsSrc, siteKey, languageCode, normalizedTheme, host, sentry, endpoint, assethost, imghost, reportapi, orientation]
  );

  const debugInfo = useMemo(
    () => buildDebugInfo(debug),
    [debug]
  );

  const serializedWebViewConfig = useMemo(
    () => serializeForInlineScript({
      apiUrl,
      backgroundColor: backgroundColor ?? '',
      debugInfo,
      siteKey: siteKey || '',
      size: normalizedSize,
      theme: normalizedTheme,
    }),
    [apiUrl, backgroundColor, debugInfo, normalizedSize, normalizedTheme, siteKey]
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
          var loadApiScript = function() {
            var script = document.createElement('script');
            script.async = true;
            script.defer = true;
            script.src = hcaptchaConfig.apiUrl;
            document.head.appendChild(script);
          };
          var hcaptchaWidgetId = null;
          var setData = function(data) {
            hcaptcha.setData(hcaptchaWidgetId, data || {});
          };
          var execute = function() {
            hcaptcha.execute(hcaptchaWidgetId);
          };
          var reset = function() {
            hcaptcha.reset(hcaptchaWidgetId);
          };
          var onloadCallback = function() {
            try {
              console.log("challenge onload starting");
              hcaptchaWidgetId = hcaptcha.render("hcaptcha-container", getRenderConfig(hcaptchaConfig.siteKey, hcaptchaConfig.theme, hcaptchaConfig.size));
              window.ReactNativeWebView.postMessage("${HCAPTCHA_READY_EVENT}");
              // have loaded by this point; render is sync.
              console.log("challenge render complete");
            } catch (e) {
              console.log("challenge failed to render:", e);
              window.ReactNativeWebView.postMessage(e.name);
            }
          };
          var onDataCallback = function(response) {
            window.ReactNativeWebView.postMessage(response);
          };
          var onCancel = function() {
            window.ReactNativeWebView.postMessage("challenge-closed");
          };
          var onOpen = function() {
            document.body.style.backgroundColor = hcaptchaConfig.backgroundColor;
            window.ReactNativeWebView.postMessage("open");
            console.log("challenge opened");
          };
          var onDataExpiredCallback = function(error) { window.ReactNativeWebView.postMessage(error); };
          var onChalExpiredCallback = function(error) { window.ReactNativeWebView.postMessage(error); };
          var onDataErrorCallback = function(error) {
            console.warn("challenge error callback fired");
            window.ReactNativeWebView.postMessage(error);
          };
          const getRenderConfig = function(siteKey, theme, size) {
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
      if (isLoading) {
        onMessage({ nativeEvent: { data: 'error', description: 'loading timeout' } });
      }
    }, loadingTimeout);

    return () => clearTimeout(timeoutId);
  }, [isLoading, onMessage]);

  const webViewRef = useRef(null);
  const injectVerifyData = (resetFirst = false) => {
    if (!webViewRef.current) {
      return;
    }

    webViewRef.current.injectJavaScript(buildVerifyInjectionScript(buildVerifyData({
      phoneNumber,
      phonePrefix,
      rqdata,
      userJourney: journeyEnabled ? peekJourneyEvents() : undefined,
      verifyParams,
    }), resetFirst));
  };

  // This shows ActivityIndicator till webview loads hCaptcha images
  const renderLoading = () => (
    <TouchableWithoutFeedback onPress={() => closableLoading && onMessage({ nativeEvent: { data: 'cancel' } })}>
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={loadingIndicatorColor} />
      </View>
    </TouchableWithoutFeedback>
  );

  const reset = () => {
    injectVerifyData(true);
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(event) => {
          if (event.url.slice(0, 24) === 'https://www.hcaptcha.com') {
            Linking.openURL(event.url);
            return false;
          } else if (event.url.toLowerCase().startsWith('sms:')) {
            Linking.openURL(event.url).catch((err) => {
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
        onMessage={(e) => {
          if (e.nativeEvent.data === HCAPTCHA_READY_EVENT) {
            injectVerifyData();
            return;
          }

          e.reset = reset;
          e.success = true;
          if (e.nativeEvent.data === 'open') {
            setIsLoading(false);
          } else if (e.nativeEvent.data.length > 35) {
            const expiredTokenTimerId = setTimeout(() => onMessage({ nativeEvent: { data: 'expired' }, success: false, reset }), tokenTimeout);
            e.markUsed = () => clearTimeout(expiredTokenTimerId);
            if (journeyEnabled) {
              clearJourneyEvents();
            }
          } else /* error */ {
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
};

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
