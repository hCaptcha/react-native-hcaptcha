import React from 'react';
import { WebView } from 'react-native-webview';
import { ActivityIndicator, Linking, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { 
  BaseHcaptcha,
  COMMON_PROPS,
  patchPostMessageJsCode,
  generateWebViewContent,
} from './BaseHcaptcha';

const Hcaptcha = (props) => {
  const {
    webViewRef,
    isLoading,
    setIsLoading,
    reset,
    generateWebViewContent
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
        onMessage={(e) => {
          const event = {...e, reset};
          if (e.nativeEvent.data === 'open') {
            setIsLoading(false);
          } else if (e.nativeEvent.data.length > 16) {
            const timer = setTimeout(() => 
              props.onMessage({ nativeEvent: { data: 'expired' }, reset }), 
              120000
            );
            event.markUsed = () => clearTimeout(timer);
          }
          props.onMessage(event);
        }}
        javaScriptEnabled
        injectedJavaScript={patchPostMessageJsCode}
        style={[{ backgroundColor: 'transparent', width: '100%' }, props.style]}
        source={{
          html: generateWebViewContent(),
          baseUrl: props.url,
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
  },
});

export default Hcaptcha;