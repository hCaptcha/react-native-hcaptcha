import React, { useMemo, useCallback } from 'react';
import WebView from 'react-native-webview';
import { Linking, StyleSheet, View, ActivityIndicator } from 'react-native';

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

/**
 *
 * @param {*} onMessage: callback after receiving response, error, or when user cancels
 * @param {*} siteKey: your hCaptcha sitekey
 * @param {*} style: custom style
 * @param {*} url: base url
 * @param {*} languageCode: can be found at https://docs.hcaptcha.com/languages
 * @param {*} cancelButtonText: title of cancel button
 * @param {*} showLoading: loading indicator for webview till hCaptcha web content loads
 * @param {*} loadingIndicatorColor: color for the ActivityIndicator
 * @param {*} backgroundColor: backgroundColor which can be injected into HTML to alter css backdrop colour
 */
const Hcaptcha = ({
  onMessage,
  siteKey,
  style,
  url,
  languageCode,
  cancelButtonText = 'Cancel',
  showLoading = false,
  loadingIndicatorColor = null,
  backgroundColor,
}) => {
  const generateTheWebViewContent = useMemo(
    () =>
      `<!DOCTYPE html>
			<html>
			<head> 
				<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="X-UA-Compatible" content="ie=edge"> 
				<script src="https://hcaptcha.com/1/api.js?render=explicit&onload=onloadCallback&hl=${
          languageCode || 'en'
        }&host=${
        siteKey || 'missing-sitekey'
      }.react-native.hcaptcha.com" async defer></script> 
				<script type="text/javascript"> 
				var onloadCallback = function() {
			        try {
			          console.log("challenge onload starting");
			          hcaptcha.render("submit", {
			            sitekey: "${siteKey || ''}",
			            size: "invisible",
			            "callback": onDataCallback,
			            "close-callback": onCancel,
			            "open-callback": onOpen,
			            "expired-callback": onDataExpiredCallback,
			            "chalexpired-callback": onChalExpiredCallback,
			            "error-callback": onDataErrorCallback
			          });
			          // have loaded by this point; render is sync.
			          console.log("challenge render complete");
			        } catch (e) {
			          console.log("challenge failed to render");
					  window.ReactNativeWebView.postMessage("error");
			        }

			        try {
			          console.log("showing challenge");
			          hcaptcha.execute();
			        } catch (e) {
			          console.log("failed to show challenge");
					  window.ReactNativeWebView.postMessage("error");
			        }

				};  
				var onDataCallback = function(response) {
					window.ReactNativeWebView.postMessage(response);  
				};  
				var onCancel = function() {
					window.ReactNativeWebView.postMessage("cancel"); 
				}
				var onOpen = function() {
					// NOTE: disabled for simplicity.
					// window.ReactNativeWebView.postMessage("open");
					console.log("challenge opened");
				}
				var onDataExpiredCallback = function(error) {  window.ReactNativeWebView.postMessage("expired"); };
				var onChalExpiredCallback = function(error) {  window.ReactNativeWebView.postMessage("cancel"); };
				var onDataErrorCallback = function(error) {
					console.log("challenge error callback fired");
					window.ReactNativeWebView.postMessage("error");
				}
				</script>
			</head>
			<body style="background-color: ${backgroundColor};"> 
			    <div id="submit"></div>
			</body>
	    </html>`,
    [siteKey, languageCode]
  );

  // This shows ActivityIndicator till webview loads hCaptcha images
  const renderLoading = useCallback(
    () => (
      <View style={[styles.loadingOverlay]}>
        <ActivityIndicator size="large" color={loadingIndicatorColor} />
      </View>
    ),
    [loadingIndicatorColor]
  );

  return (
    <WebView
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={(event) => {
        if (event.url.slice(0, 24) === 'https://www.hcaptcha.com') {
          Linking.openURL(event.url);
          return false;
        }
        return true;
      }}
      mixedContentMode={'always'}
      onMessage={onMessage}
      javaScriptEnabled
      injectedJavaScript={patchPostMessageJsCode}
      automaticallyAdjustContentInsets
      style={[{ backgroundColor: 'transparent', width: '100%' }, style]}
      source={{
        html: generateTheWebViewContent,
        baseUrl: `${url}`,
      }}
      renderLoading={renderLoading}
      startInLoadingState={showLoading}
    />
  );
};

const styles = StyleSheet.create({
  loadingOverlay: {
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});

export default Hcaptcha;
