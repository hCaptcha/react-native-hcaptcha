import { jest } from '@jest/globals';

jest.mock('@hcaptcha/loader/inline', () => (
  'window.hCaptchaLoader = function(config) { window.hCaptchaLoaderConfig = config; return Promise.resolve(window.hcaptcha); };'
), { virtual: true });

jest.mock('react-native-webview', () => {
  return {
    WebView: () => 'WebView',
  };
});
