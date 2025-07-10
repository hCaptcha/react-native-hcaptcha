import React from 'react';
import { WebView } from 'react-native-webview';
import { StyleSheet, View, Linking, ActivityIndicator, TouchableWithoutFeedback } from 'react-native';
import { 
  BaseHcaptcha,
  COMMON_PROPS,
} from './BaseHcaptcha';

const Hcaptcha = (props) => {
  const {
    webViewRef,
    isLoading,
    reset,
    generateWebViewContent,
    handleMessage,
    baseUrl,
  } = BaseHcaptcha(props);

  const renderLoading = () => (
    <TouchableWithoutFeedback onPress={() => props.closableLoading && props.onMessage({ nativeEvent: { data: 'cancel' } })}>
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={props.loadingIndicatorColor} />
      </View>
    </TouchableWithoutFeedback>
  );

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(event) => {
          if (event.url.startsWith('https://www.hcaptcha.com')) {
            Linking.openURL(event.url);
            return false;
          }
          return true;
        }}
        mixedContentMode={'always'}
        onMessage={handleMessage}
        javaScriptEnabled
        injectedJavaScript={`(${String(function () {
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
        })})();`}
        style={[{ backgroundColor: 'transparent', width: '100%' }, props.style]}
        source={{
          html: generateWebViewContent(),
          baseUrl,
        }}
      />
      {props.showLoading && isLoading && renderLoading()}
    </View>
  );
};

Hcaptcha.defaultProps = COMMON_PROPS;

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Hcaptcha;