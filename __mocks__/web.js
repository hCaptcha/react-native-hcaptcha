// Web-specific mocks
jest.mock('react-native-modal', () => {
  const React = require('react');
  const Modal = (props) => {
    // Filter out React Native-specific props that don't belong on DOM elements
    const {
      useNativeDriver,
      hideModalContentWhileAnimating,
      deviceHeight,
      deviceWidth,
      animationIn,
      animationOut,
      onBackdropPress,
      onBackButtonPress,
      isVisible,
      hasBackdrop,
      coverScreen,
      children,
      style,
      ...validDOMProps
    } = props;

    // Only render if visible
    if (!isVisible) {
      return null;
    }

    return React.createElement('div', {
      ...validDOMProps,
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        ...style
      },
      onClick: onBackdropPress
    }, children);
  };
  return Modal;
});

// Remove React mock - let React work normally in web environment

jest.mock('react-native/Libraries/Core/ReactNativeVersion', () => {
  global.ReactNativeVersion = { version: { major: 0, minor: 73, patch: 0 } };
  return global.ReactNativeVersion;
});

jest.mock('../md5', () => () => 'mocked-md5');

// Web WebView mock (from react-native-web-webview.js)
jest.mock('react-native-web-webview', () => {
  const React = require('react');
  return {
    WebView: React.forwardRef((props, ref) => {
      // Filter out React Native WebView-specific props
      const {
        originWhitelist,
        javaScriptEnabled,
        mixedContentMode,
        onMessage,
        injectedJavaScript,
        source,
        onShouldStartLoadWithRequest,
        children,
        style,
        ...validDOMProps
      } = props;

      // Simulate WebView load completion and hCaptcha events
      React.useEffect(() => {
        if (onMessage) {
          // Simulate initial load
          setTimeout(() => {
            onMessage({
              nativeEvent: { data: 'open' }
            });
          }, 1000);
          
          // Simulate hCaptcha completion after a delay
          setTimeout(() => {
            onMessage({
              nativeEvent: { data: 'h-captcha-response-token-here' }
            });
          }, 3000);
        }
      }, [onMessage]);

      return React.createElement('div', {
        ref,
        ...validDOMProps,
        style: {
          width: '100%',
          height: '100%',
          border: '1px solid #ccc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          ...style
        }
      }, children || 'hCaptcha WebView (Mock)');
    }),
    unstable_createElement: (type, props, children) => React.createElement(type, props, children),
  };
});