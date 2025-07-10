// jest.config.js
// https://github.com/necolas/react-native-web/discussions/1967
module.exports = {
  projects: [
    {
      displayName: 'web',
      moduleNameMapper: {
        // alias react-native
        '^react-native$': 'react-native-web',
        '^react-native-webview$': 'react-native-web-webview',
      },
      // store DOM snapshots
      snapshotResolver: '<rootDir>/__tests__/__snapshots__/resolver.web.js',
      // use jsdom
      testEnvironment: 'jsdom',
      testMatch: [
        // all multi-platform tests
        '<rootDir>/__tests__/*.test.js',
        // DOM-only tests
        '<rootDir>/__tests__/*-test.web.js'
      ],
      moduleFileExtensions: ['web.js', 'js', 'json', 'node'],
      setupFiles: [
        "<rootDir>/__mocks__/react-native.js",
        "<rootDir>/__mocks__/web.js"
      ]
    },
    {
      displayName: 'native',
      // store React Native snapshots
      snapshotResolver: '<rootDir>/__tests__/__snapshots__/resolver.native.js',
      // use Node.js
      testEnvironment: 'node',
      testMatch: [
        // all multi-platform tests
        '<rootDir>/__tests__/*.test.js',
        // RN-only tests
        '<rootDir>/__tests__/*-test.native.js'
      ],
      preset: "react-native",
      setupFiles: [
        "<rootDir>/__mocks__/react-native.js"
      ]
    }
  ]
}