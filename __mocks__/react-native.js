import React from 'react';

// Native-specific mocks from global.js
jest.mock('react-native-modal', () => {
  const React = require('react');
  const Modal = (props) => <div {...props} />;
  return Modal;
});

jest.mock('react-native-webview', () => {
  const React = require('react');
  const WebView = React.forwardRef((props, ref) => <div ref={ref} {...props} />);
  return { WebView };
});

jest.mock('react-native/Libraries/Core/ReactNativeVersion', () => {
  return { version: { major: 0, minor: 73, patch: 0 } };
});

jest.mock('../md5', () => () => 'mocked-md5');

export const AppRegistry = {
  registerComponent: jest.fn(),
  runApplication: jest.fn(),
};

export const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => style,
};

export const Dimensions = {
  get: jest.fn(() => ({
    window: { width: 0, height: 0 },
    screen: { width: 0, height: 0 },
  })),
};

export const ActivityIndicator = (props) => <div {...props} />;
export const View = (props) => <div {...props} />;
export const Linking = {
  openURL: jest.fn(),
};
export const TouchableWithoutFeedback = (props) => <div {...props} />;
export const SafeAreaView = (props) => <div {...props} />;
export const Platform = { OS: 'web' };