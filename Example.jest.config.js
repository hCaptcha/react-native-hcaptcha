module.exports = {
  preset: 'react-native',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    "node_modules/(?!(react-native"
      + "|@react-native"
      + "|@hcaptcha"
      + "|react-native-modal"
      + "|react-native-webview"
      + "|react-native-animatable"
    + ")/)",
  ],
}
