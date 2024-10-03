jest.mock('react-native-webview', () => {
  return {
    WebView: () => 'WebView',
  };
});

