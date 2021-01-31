import React from 'react';
import WebView from 'react-native-webview';
import { Linking } from 'react-native';

const patchPostMessageJsCode = `(${String(function () {
	var originalPostMessage = window.ReactNativeWebView.postMessage;
	var patchedPostMessage = function (message, targetOrigin, transfer) {
		originalPostMessage(message, targetOrigin, transfer);
	};
	patchedPostMessage.toString = function () {
		return String(Object.hasOwnProperty).replace('hasOwnProperty', 'postMessage');
	};
	window.ReactNativeWebView.postMessage = patchedPostMessage
})})();`;

/**
 * 
 * @param {*} onMessage: callback after receiving response, error, or when user cancels
 * @param {*} siteKey: your hCaptcha sitekey
 * @param {*} style: custom style
 * @param {*} url: base url
 * @param {*} languageCode: can be found at https://docs.hcaptcha.com/languages
 * @param {*} cancelButtonText: title of cancel button
 */
const Hcaptcha = ({ onMessage, siteKey, style, url, languageCode, cancelButtonText = 'Cancel' }) => {
	const generateTheWebViewContent = siteKey => {
		const originalForm =
			`<!DOCTYPE html>
			<html>
			<head> 
				<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="X-UA-Compatible" content="ie=edge"> 
				<script src="https://hcaptcha.com/1/api.js?render=explicit&onload=onloadCallback&hl=${languageCode || 'en'}&host=${siteKey || 'missing-sitekey'}.react-native.hcaptcha.com" async defer></script> 
				<script type="text/javascript"> 
				var onloadCallback = function() {

			        try {
			          console.log("challenge onload starting");
			          hcaptcha.render("submit", {
			            sitekey: "${siteKey || ''}",
			            size: "invisible",
			            "callback": onDataCallback,
			            "close-callback": onCancel,
			            "expired-callback": onDataExpiredCallback,
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
					// setTimeout(function () {
					// 	document.getElementById('captcha').style.display = 'none';
					// }, 1500);
				};  
				var onCancel = function() {  
					window.ReactNativeWebView.postMessage("cancel"); 
					// document.getElementById('captcha').style.display = 'none';
				}
				var onDataExpiredCallback = function(error) {  window.ReactNativeWebView.postMessage("expired"); };  
				var onDataErrorCallback = function(error) {  window.ReactNativeWebView.postMessage("error"); } 
				</script> 
			</head>
			<body> 
			    <div id="submit"></div>
			</body>
			</html>`;
		return originalForm;
	};
	return (
		<WebView
			originWhitelist={['*']}
                        onShouldStartLoadWithRequest={event => {
                             if (event.url.slice(0,24) === 'https://www.hcaptcha.com') {
                                Linking.openURL(event.url)
                                return false
                             }
                            return true
                        }}
			mixedContentMode={'always'}
			onMessage={onMessage}
			javaScriptEnabled
			injectedJavaScript={patchPostMessageJsCode}
			automaticallyAdjustContentInsets
			style={[{ backgroundColor: 'transparent', width: '100%' }, style]}
			source={{
				html: generateTheWebViewContent(siteKey),
				baseUrl: `${url}`,
			}}
		/>
	);
}

export default Hcaptcha;
