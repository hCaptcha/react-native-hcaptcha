module.exports = {
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/'],
  modulePathIgnorePatterns: ['<rootDir>/react-native-hcaptcha/'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native'
      + '|@react-native'
      + '|@hcaptcha'
      + '|react-native-modal'
      + '|react-native-webview'
      + '|react-native-animatable'
    + ')/)',
  ],
  setupFiles: ['./jest.setup.js'],
};
