import { describe, test, render, expect, waitFor } from 'react-native-harness';
import { screen } from '@react-native-harness/ui';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import Hcaptcha from '@hcaptcha/react-native-hcaptcha/Hcaptcha.js';

const siteKey = '10000000-ffff-ffff-ffff-000000000001';
const baseUrl = 'https://hcaptcha.com';

// Screenshots are cropped to this view. On a full-screen shot the widget is ~11% of the
// pixels and its light card is close enough to white that removing the widget entirely
// changed only ~0.6% of the screen - under the threshold below, so a missing widget passed.
const WIDGET_TEST_ID = 'hcaptcha-widget-frame';

// `render` resolves once React has committed and native has processed the view-creation
// commands; it does not wait for the WebView to fetch anything, so the widget is still blank
// at that point. Readiness is waited for separately, below.
const MOUNT_MS = 10000;

// Above the SDK's own 15s loading timeout on purpose: when the page never comes up we want the
// SDK to report `loading timeout` through onMessage and fail this test with that reason,
// rather than the harness killing the test first and leaving only "exceeded timeout".
const READY_MS = 20000;
const POLL_MS = 250;

// The token arrives with the checkmark, but the checkmark animates in. Rather than guess a
// settle delay, poll until two consecutive frames are identical. Best-effort: if the pixels
// never settle we screenshot anyway and let the diff decide, which keeps a never-quiet widget
// from turning into an unexplained timeout.
const PAINT_SETTLE_MS = 5000;

// `failureThresholdType: 'percent'` compares `differences / totalPixels` - a 0-1 ratio - so
// this is a fraction, not a percentage: 0.01 is 1% of the pixels. The previous value of 5
// meant 500%, which no image pair can exceed, so neither assertion below could ever fail.
// Measured on the full-screen baselines, a missing widget is ~0.6% of the screen and the
// wrong theme ~6%; cropped to the widget both are eight to nine times that, so 1% leaves room
// for antialiasing while catching either.
const FAILURE_THRESHOLD = 0.01;

const WidgetFixture = ({ theme, onMessage }) => (
  <View style={styles.container}>
    <View style={styles.widgetFrame} testID={WIDGET_TEST_ID}>
      <Hcaptcha
        siteKey={siteKey}
        size="normal"
        theme={theme}
        url={baseUrl}
        style={styles.widget}
        showLoading
        onMessage={onMessage}
      />
    </View>
  </View>
);

const sameBytes = (a, b) =>
  a != null &&
  b != null &&
  a.length === b.length &&
  a.every((byte, index) => byte === b[index]);

const screenshotWidget = async () =>
  screen.screenshot(await screen.findByTestId(WIDGET_TEST_ID));

const waitForStablePaint = async () => {
  const deadline = Date.now() + PAINT_SETTLE_MS;
  let previous = (await screenshotWidget())?.data;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const current = (await screenshotWidget())?.data;
    if (sameBytes(previous, current)) {
      return;
    }
    previous = current;
  }
};

// The SDK forwards a successful message longer than 35 characters as a token.
const isToken = (m) => m.success === true && m.nativeEvent.data.length > 35;

/**
 * Renders the widget and blocks until it has finished verifying.
 *
 * The test sitekey passes without a challenge, so the widget's final state - the checked
 * checkbox the baselines show - arrives together with the token. Waiting on anything earlier
 * is not enough: the SDK's internal ready event only means `hcaptcha.render()` returned, and
 * the iframe can still be blank on the network after it. Collected messages are also checked
 * for errors on every poll, so a failure ends the test with the SDK's own description instead
 * of diffing a screenshot of a spinner or a blank frame.
 */
const renderWidget = async (theme) => {
  const messages = [];

  await render(<WidgetFixture theme={theme} onMessage={(e) => messages.push(e)} />, {
    timeout: MOUNT_MS,
  });

  await waitFor(
    () => {
      const failure = messages.find((m) => m.success === false);
      if (failure) {
        const { description, data } = failure.nativeEvent;
        throw new Error(`hCaptcha reported: ${description || data}`);
      }
      if (!messages.some(isToken)) {
        throw new Error('hCaptcha has not issued a token yet');
      }
    },
    { timeout: READY_MS, interval: POLL_MS },
  );

  await waitForStablePaint();
};

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
    await renderWidget('light');

    const screenshot = await screenshotWidget();
    await expect(screenshot).toMatchImageSnapshot({
      name: 'hcaptcha-light',
      threshold: 0.15,
      failureThreshold: FAILURE_THRESHOLD,
      failureThresholdType: 'percent',
    });
  });

  test('dark widget matches baseline', async () => {
    await renderWidget('dark');

    const screenshot = await screenshotWidget();
    await expect(screenshot).toMatchImageSnapshot({
      name: 'hcaptcha-dark',
      threshold: 0.15,
      failureThreshold: FAILURE_THRESHOLD,
      failureThresholdType: 'percent',
    });
  });
});
