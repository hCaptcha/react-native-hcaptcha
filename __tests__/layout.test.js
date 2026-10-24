import React from 'react';
import { render } from '@testing-library/react-native';
import { ActivityIndicator, StyleSheet } from 'react-native';
import ConfirmHcaptcha from '../index';

// RN 0.88 removed the deprecated alias; retain the real StyleSheet implementation.
jest.mock('react-native', () => {
  const reactNative = jest.requireActual('react-native');
  const styleSheet = { ...reactNative.StyleSheet };
  delete styleSheet.absoluteFillObject;
  return Object.create(reactNative, { StyleSheet: { value: styleSheet } });
});

test.each(['overlay', 'backdrop', 'loading'])('%s fills its parent without absoluteFillObject', (layer) => {
  const component = render(<ConfirmHcaptcha siteKey="site-key" onMessage={jest.fn()} prewarm showLoading />);
  const nodes = {
    overlay: component.getByTestId('confirm-hcaptcha-prewarm', { includeHiddenElements: true }),
    backdrop: component.getByTestId('confirm-hcaptcha-backdrop', { includeHiddenElements: true }),
    loading: component.UNSAFE_getByType(ActivityIndicator).parent,
  };
  expect(StyleSheet.flatten(nodes[layer].props.style)).toMatchObject({
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
  });
});
