// Web (react-native-web) test project.
//
// Kept separate from the native config in package.json — and pointed at its own
// `__tests_web__` directory — so the native suite, the reassure perf runs and the e2e
// harness are all untouched by web testing.
module.exports = {
  displayName: 'web',
  verbose: true,
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/__tests_web__/**/*.test.web.js'],
  // `react-native` resolves to `react-native-web`, exactly as a consumer's bundler
  // would alias it.
  moduleNameMapper: {
    '^react-native$': 'react-native-web',
  },
  // Makes `./Hcaptcha` resolve to `Hcaptcha.web.js` and `./reactNativeVersion` to
  // `reactNativeVersion.web.js`, mirroring platform-extension resolution in bundlers.
  moduleFileExtensions: ['web.js', 'js', 'json', 'node'],
  setupFiles: ['<rootDir>/__mocks__/web.js'],
  // A generated `__e2e__/host` app carries its own node_modules (including a second
  // copy of React), which Jest would otherwise resolve into.
  modulePathIgnorePatterns: ['<rootDir>/__e2e__/'],
  testPathIgnorePatterns: ['/node_modules/'],
};
