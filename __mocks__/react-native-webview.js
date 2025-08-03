// __mocks__/react-native-webview.js
import React from 'react';

let messageDataToSend = null;

export const setWebViewMessageData = (data) => {
  messageDataToSend = data;
};

const WebView = React.forwardRef((props, ref) => {
  const { onMessage } = props;

  React.useEffect(() => {
    if (messageDataToSend && onMessage) {
      onMessage({ nativeEvent: { data: messageDataToSend } });
      messageDataToSend = null;
    }
  }, [onMessage]);

  return React.createElement('WebView', { ...props, ref });
});

export default WebView;
