import React from 'react';
import { WebView } from 'react-native-web-webview';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { BaseHcaptcha, COMMON_PROPS, generateWebViewContent } from './BaseHcaptcha';

const Hcaptcha = (props) => {
  const {
    webViewRef,
    isLoading,
    setIsLoading,
    reset,
    generateWebViewContent
  } = BaseHcaptcha(props);

  const handleMessage = (event) => {
    const data = event.nativeEvent.data;
    const messageEvent = {
      nativeEvent: { data },
      reset,
      markUsed: () => {}
    };

    if (data === 'open') {
      setIsLoading(false);
    } else if (data.length > 16) {
      const timer = setTimeout(() => 
        props.onMessage({ ...messageEvent, nativeEvent: { data: 'expired' } }), 
        120000
      );
      messageEvent.markUsed = () => clearTimeout(timer);
    }
    
    props.onMessage(messageEvent);
  };

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        javaScriptEnabled
        mixedContentMode={'always'}
        onMessage={handleMessage}
        style={[{ backgroundColor: 'transparent', width: '100%' }, props.style]}
        source={{
          html: generateWebViewContent(),
          baseUrl: props.url,
        }}
      />
      {props.showLoading && isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={props.loadingIndicatorColor} />
        </View>
      )}
    </View>
  );
};

Hcaptcha.defaultProps = COMMON_PROPS;

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});

export default Hcaptcha;