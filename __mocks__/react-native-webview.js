// __mocks__/react-native-webview.js
import React from 'react';

let messageDataToSend = null;
let lastInjectJavaScriptMock = null;

export const setWebViewMessageData = (data) => {
  messageDataToSend = data;
};

export const getLastInjectJavaScriptMock = () => lastInjectJavaScriptMock;

export const resetWebViewMockState = () => {
  messageDataToSend = null;
  lastInjectJavaScriptMock = null;
};

const WebView = React.forwardRef((props, ref) => {
  const { onMessage } = props;
  const injectJavaScript = React.useMemo(() => jest.fn(), []);

  lastInjectJavaScriptMock = injectJavaScript;

  React.useImperativeHandle(ref, () => ({
    injectJavaScript,
  }), [injectJavaScript]);

  React.useEffect(() => {
    if (messageDataToSend && onMessage) {
      onMessage({ nativeEvent: { data: messageDataToSend } });
      messageDataToSend = null;
    }
  }, [onMessage]);

  return React.createElement('WebView', { ...props, ref });
});

export default WebView;
