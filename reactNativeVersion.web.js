// react-native-web does not ship `react-native/Libraries/Core/ReactNativeVersion`,
// and bundlers fail to resolve that path once `react-native` is aliased to
// `react-native-web`. On web `Platform.constants.reactNativeVersion` is the only
// version source, and `getReactNativeVersion` already reads it first.
export default null;
