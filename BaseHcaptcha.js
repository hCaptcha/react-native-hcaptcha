import React, { useEffect, useMemo, useRef, useState } from 'react';
import md5 from './md5';
import hcaptchaPackage from './package.json';
import ReactNativeVersion from 'react-native/Libraries/Core/ReactNativeVersion';



// Hook: debugInfo
export function useHCaptchaDebug(debug) {
  return useMemo(() => {
    const info = { ...debug };
    try {
      const { major, minor, patch } = ReactNativeVersion.version;
      info[`rnver_${major}_${minor}_${patch}`] = true;
      info['dep_' + md5(Object.keys(global).join(''))] = true;
      info['sdk_' + hcaptchaPackage.version.replace(/\./g, '_')] = true;
    } catch {
      // ignore
    }
    return info;
  }, [debug]);
}

// Hook: build html & baseUrl
export function useHCaptchaHtml(props, debugInfo, isWeb = false) {
  return useMemo(() => {
    const {
      jsSrc, siteKey, size = 'invisible', languageCode: hl, theme, host,
      sentry, endpoint, assethost, imghost, reportapi,
      orientation, backgroundColor = 'transparent', rqdata, url
    } = props;

    // Build API URL
    let apiUrl = `${jsSrc || 'https://hcaptcha.com/1/api.js'}?render=explicit&onload=onloadCallback`;
    const effectiveHost = host
      ? encodeURIComponent(host)
      : `${siteKey || 'missing-sitekey'}.react-native.hcaptcha.com`;
    const params = { host: effectiveHost, hl, custom: typeof theme === 'object', sentry, endpoint, assethost, imghost, reportapi, orientation };
    Object.entries(params).forEach(([k, v]) => v != null && (apiUrl += `&${k}=${encodeURIComponent(v)}`));

    // Prepare arguments for JavaScript injection
    const themeArg = typeof theme === 'string' ? `"${theme}"` : (theme ? JSON.stringify(theme) : 'null');
    const rqdataArg = rqdata ? (typeof rqdata === 'string' ? `"${rqdata}"` : JSON.stringify(rqdata)) : 'null';

    // Platform-specific postMessage implementation
    const postMessageImpl = isWeb 
      ? `// Web environment - use parent postMessage
        if (window.parent && window.parent.postMessage) {
          window.parent.postMessage(message, '*');
        } else {
          console.warn('No parent postMessage available:', message);
        }`
      : `// React Native environment  
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(message);
        } else {
          console.warn('No ReactNativeWebView postMessage available:', message);
        }`;

    // Generate HTML
    const html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <script>
          Object.entries(${JSON.stringify(debugInfo)}).forEach(([k,v]) => window[k] = v);
          
          // Platform-specific postMessage function
          function postMessage(message) {
            ${postMessageImpl}
          }
          
          window.onloadCallback = function() {
            try {
              const renderConfig = {
                sitekey: '${siteKey}',
                size: '${size}',
                callback: onData,
                'error-callback': onErr,
                'close-callback': onClose,
                'open-callback': onOpen,
                'expired-callback': onExpire
              };
              ${themeArg !== 'null' ? `renderConfig.theme = ${themeArg};` : ''}
              
              hcaptcha.render('hcaptcha-container', renderConfig);
              
              ${rqdataArg !== 'null' ? `hcaptcha.execute({ rqdata: ${rqdataArg} });` : 'hcaptcha.execute();'}
            } catch(e) {
              postMessage('error:' + e.message);
            }
          };
          
          function onData(response) { 
            postMessage(response); 
          }
          function onErr(error) { 
            postMessage('error:' + error); 
          }
          function onClose() { 
            postMessage('challenge-closed'); 
          }
          function onOpen() { 
            postMessage('open'); 
          }
          function onExpire() { 
            postMessage('expired'); 
          }
        </script>
        <script src="${apiUrl}" async defer></script>
      </head>
      <body style="margin:0;background:${backgroundColor}">
        <div id="hcaptcha-container"></div>
      </body>
      </html>`;

    return { html, baseUrl: url };
  }, [props, debugInfo, isWeb]);
}

// Hook: handlers & loading state
export function useHCaptchaHandlers(onMessage, showLoading) {
  const [isLoading, setIsLoading] = useState(true);
  const webRef = useRef(null);
  const reset = () => webRef.current?.injectJavaScript('window.onloadCallback();');

  const handleMessage = (e) => {
    const data = e.nativeEvent?.data;
    
    // Ensure data is a string for web compatibility
    const dataStr = typeof data === 'string' ? data : String(data || '');
    
    if (dataStr === 'open') {
      setIsLoading(false);
      return;
    }
    const ev = { ...e, reset, success: !(dataStr.startsWith('error') || dataStr === 'challenge-closed') };
    onMessage?.(ev);
  };

  useEffect(() => {
    if (!showLoading) return;
    const id = setTimeout(() => {
      isLoading && onMessage?.({ nativeEvent: { data: 'error:timeout' } });
    }, 15000);
    return () => clearTimeout(id);
  }, [isLoading, showLoading, onMessage]);

  return { webRef, isLoading, reset, handleMessage };
}

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
    showLoading,
    closableLoading,
    loadingIndicatorColor,
    backgroundColor,
    debug,
    isWeb = false,
  } = props;

  const debugInfo = useHCaptchaDebug(debug);
  const { html, baseUrl } = useHCaptchaHtml(props, debugInfo, isWeb);
  const { webRef, isLoading, reset, handleMessage } = useHCaptchaHandlers(onMessage, showLoading);

  return {
    webViewRef: webRef,
    isLoading,
    debugInfo,
    baseUrl,
    reset,
    generateWebViewContent: () => html,
    handleMessage
  };
};