export default {
  preset: 'react-native-harness',
  testMatch: ['<rootDir>/__e2e__/**/*.harness.{js,ts,tsx}'],
  // Each case waits for the WebView to load (10s) and then settles for another 10s before
  // screenshotting, so it needs well over Jest's 5s default or it is killed mid-test.
  testTimeout: 60000,
};
