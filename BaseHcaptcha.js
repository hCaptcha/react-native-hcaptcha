import React, { useEffect, useMemo, useRef, useState } from 'react';
import md5 from './md5';
import hcaptchaPackage from './package.json';

export const patchPostMessageJsCode = `(${String(function () {
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

export const buildHcaptchaApiUrl = (jsSrc, siteKey, hl, theme, host, sentry, endpoint, assethost, imghost, reportapi, orientation) => {
  let url = `${jsSrc || 'https://hcaptcha.com/1/api.js'}?render=explicit&onload=onloadCallback`;

  let effectiveHost;
  if (host) {
    effectiveHost = encodeURIComponent(host);
  } else {
    effectiveHost = (siteKey || 'missing-sitekey') + '.react-native.hcaptcha.com';
  }

  const params = {
    host: effectiveHost,
    hl,
    custom: typeof theme === 'object',
    sentry,
    endpoint,
    assethost,
    imghost,
    reportapi,
    orientation
  };

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url += `&${key}=${encodeURIComponent(value)}`;
    }
  });

  return url;
};

export const useDebugInfo = (debug) => useMemo(() => {
  const result = debug || {};
  try {
    const {major, minor, patch} = ReactNativeVersion.version;
    result[`rnver_${major}_${minor}_${patch}`] = true;
    result['dep_' + md5(Object.keys(global).join(''))] = true;
    result['sdk_' + hcaptchaPackage.version.toString().replace(/\./g, '_')] = true;
  } catch (e) {
    console.error(e);
  }
  return result;
}, [debug]);

export const generateWebViewContent = (debugInfo, apiUrl, siteKey, theme, size, backgroundColor, rqdata) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <script type="text/javascript">
    Object.entries(${JSON.stringify(debugInfo)}).forEach(function (entry) { window[entry[0]] = entry[1] })
  </script>
  <script src="${apiUrl}" async defer></script>
  <script type="text/javascript">
    var onloadCallback = function() {
      try {
        hcaptcha.render("hcaptcha-container", getRenderConfig("${siteKey || ''}", ${theme}, "${size || 'invisible'}"));
      } catch (e) {
        window.ReactNativeWebView.postMessage("error");
      }
      try {
        hcaptcha.execute(getExecuteOpts());
      } catch (e) {
        window.ReactNativeWebView.postMessage("error");
      }
    };
    // ... rest of the script content from original ...
  </script>
</head>
<body>
  <div id="hcaptcha-container"></div>
</body>
</html>`;

export const COMMON_PROPS = {
  onMessage: () => {},
  siteKey: null,
  size: 'invisible',
  style: {},
  url: '',
  languageCode: null,
  showLoading: true,
  closableLoading: false,
  loadingIndicatorColor: '#000000',
  backgroundColor: '#ffffff',
  theme: null,
  rqdata: null,
  sentry: false,
  jsSrc: null,
  endpoint: null,
  reportapi: null,
  assethost: null,
  imghost: null,
  host: null,
  debug: null,
  orientation: null
};

export const BaseHcaptcha = (props) => {
  const {
    onMessage,
    siteKey,
    size,
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
  } = props;

  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const debugInfo = useDebugInfo(debug);
  
  const apiUrl = useMemo(() => 
    buildHcaptchaApiUrl(jsSrc, siteKey, languageCode, theme, host, sentry, endpoint, assethost, imghost, reportapi, orientation),
    [jsSrc, siteKey, languageCode, theme, host, sentry, endpoint, assethost, imghost, reportapi, orientation]
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      isLoading && onMessage({ nativeEvent: { data: 'error', description: 'loading timeout' } });
    }, 15000);
    return () => clearTimeout(timeoutId);
  }, [isLoading, onMessage]);

  const reset = () => webViewRef.current?.injectJavaScript('onloadCallback();');

  return {
    webViewRef,
    isLoading,
    setIsLoading,
    debugInfo,
    apiUrl,
    reset,
    generateWebViewContent: () => generateWebViewContent(debugInfo, apiUrl, siteKey, theme, size, backgroundColor, rqdata)
  };
};