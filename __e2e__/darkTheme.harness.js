import { describe, test, render, expect } from 'react-native-harness';
import { screen } from '@react-native-harness/ui';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import Hcaptcha from '@hcaptcha/react-native-hcaptcha/Hcaptcha.js';

const siteKey = '10000000-ffff-ffff-ffff-000000000001';
const baseUrl = 'https://hcaptcha.com';

const WEBVIEW_LOAD_MS = 10000;

const WidgetFixture = ({ theme }) => (
  <View style={styles.container}>
    <View style={styles.widgetFrame}>
      <Hcaptcha
        siteKey={siteKey}
        size="normal"
        theme={theme}
        url={baseUrl}
        style={styles.widget}
        onMessage={() => {}}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
  },
  widgetFrame: {
    width: 360,
    height: 118,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  widget: {
    flex: 1,
    height: '100%',
  },
});

describe('hCaptcha theme rendering', () => {
  test('light widget matches baseline', async () => {
    await render(<WidgetFixture theme="light" />, { timeout: WEBVIEW_LOAD_MS });
    await new Promise((r) => setTimeout(r, WEBVIEW_LOAD_MS));

    const screenshot = await screen.screenshot();
    await expect(screenshot).toMatchImageSnapshot({
      name: 'hcaptcha-light',
      threshold: 0.15,
      failureThreshold: 5,
      failureThresholdType: 'percent',
    });
  });

  test('dark widget matches baseline', async () => {
    await render(<WidgetFixture theme="dark" />, { timeout: WEBVIEW_LOAD_MS });
    await new Promise((r) => setTimeout(r, WEBVIEW_LOAD_MS));

    const screenshot = await screen.screenshot();
    await expect(screenshot).toMatchImageSnapshot({
      name: 'hcaptcha-dark',
      threshold: 0.15,
      failureThreshold: 5,
      failureThresholdType: 'percent',
    });
  });
});
