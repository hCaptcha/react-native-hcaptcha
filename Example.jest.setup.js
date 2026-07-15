import { jest } from '@jest/globals';

jest.mock('react-native-webview', () => {
  return {
    WebView: () => 'WebView',
  };
});

