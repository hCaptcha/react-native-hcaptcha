import jest from 'jest';

jest.mock('react-native-webview', () => {
  return {
    WebView: () => 'WebView',
  };
});

