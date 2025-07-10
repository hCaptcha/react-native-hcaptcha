import React from 'react';
import { WebView } from 'react-native-web-webview';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
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
  } = BaseHcaptcha({ ...props, isWeb: true });

  const renderLoading = () => (
    <View style={styles.loadingOverlay}>
      <ActivityIndicator size="large" color={props.loadingIndicatorColor} />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        javaScriptEnabled
        mixedContentMode={'always'}
        onMessage={handleMessage}
        injectedJavaScript={""}
        style={{
          backgroundColor: 'transparent',
          width: '100%',
          ...props.style
        }}
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
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
});

export default Hcaptcha;