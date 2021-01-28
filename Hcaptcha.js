import React from 'react';
import WebView from 'react-native-webview';

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
				<script src="https://hcaptcha.com/1/api.js?render=explicit&hl=${languageCode || 'en'}&host={siteKey || 'missing-sitekey'}.react-native.hcaptcha.com"></script> 
				<script type="text/javascript"> 
				var onloadCallback = function() { };  
				var onDataCallback = function(response) { 
					window.ReactNativeWebView.postMessage(response);  
					setTimeout(function () {
						document.getElementById('captcha').style.display = 'none';
					}, 1500);
				};  
				var onCancel = function() {  
					window.ReactNativeWebView.postMessage("cancel"); 
					document.getElementById('captcha').style.display = 'none';
				}
				var onDataExpiredCallback = function(error) {  window.ReactNativeWebView.postMessage("expired"); };  
				var onDataErrorCallback = function(error) {  window.ReactNativeWebView.postMessage("error"); } 
				</script> 
				<style>
					.btn {
						background-color: #c60710; 
						color: #ffffff; padding: 8px 32px; margin-top: 8px; 
						border: none; border-radius: 25px; font-weight: bold;
					}
					.btn:active {
						outline: none;
					}
					.btn:focus {
						outline: none;
					}
				</style>
			</head>
			<body> 
				<div id="captcha">
					<div style="text-align: center; padding-top: 100px;">
					<div class="h-captcha" style="display: inline-block; height: auto;" 
						data-sitekey="${siteKey}" data-callback="onDataCallback"  
						data-expired-callback="onDataExpiredCallback"  
						data-error-callback="onDataErrorCallback">
					</div>
					<div>
						<button 
							onclick="onCancel()"
							class="btn" type="button">
							${cancelButtonText}
						</button> 
					</div>
					</div>
				</div>
			</body>
			</html>`;
		return originalForm;
	};
	return (
		<WebView
			originWhitelist={['*']}
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
