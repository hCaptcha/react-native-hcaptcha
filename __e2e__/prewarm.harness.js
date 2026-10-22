import { describe, test, render, expect, waitFor } from 'react-native-harness';
import { screen, userEvent } from '@react-native-harness/ui';
import React, { useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

import ConfirmHcaptcha from '@hcaptcha/react-native-hcaptcha';

// Replace only the remote SDK; exercise the published loader and native WebView bridge.
const sdk = `
  var widget, config, attempt = 0;
  window.hcaptcha = {
    render: function(id, options) {
      config = options;
      widget = (window.fixtureWidgetCount || 0) + 1;
      window.fixtureWidgetCount = widget;
      window.ReactNativeWebView.postMessage('fixture-ready');
      return widget;
    },
    setData: function(id, data) { window.fixtureData = data; },
    reset: function() {},
    execute: function(id, options) {
      attempt++;
      config['open-callback']();
      var token = 'fixture-token-widget-' + widget + '-attempt-' + attempt + '-' + (window.fixtureData.rqdata || '000000000000');
      if (options && options.async) {
        return new Promise(function(resolve) {
          setTimeout(function() { resolve({ response: token }); }, window.fixtureDelay ? attempt * 2000 : 0);
        });
      }
      config.callback(token);
    }
  };
  window.hCaptchaOnLoad();
`;
const jsSrc = `data:application/javascript,${encodeURIComponent(sdk)}#`;

const PrewarmFixture = ({ passiveSiteKey, theme, rqdata, verifyParams, delayedTokens = false, hideAfterToken = true, cancelAndRetry = false }) => {
  const ref = useRef(null);
  const opens = useRef(0);
  const [status, setStatus] = useState('loading');
  const [loads, setLoads] = useState(0);
  const onMessage = (event) => {
    if (event.nativeEvent.data === 'fixture-ready') {
      setStatus('ready');
      setLoads((count) => count + 1);
    } else if (event.markUsed) {
      setStatus(event.nativeEvent.data);
      event.markUsed();
      if (hideAfterToken) {
        ref.current.hide();
      }
    } else if (event.nativeEvent.data === 'open') {
      if (cancelAndRetry && ++opens.current === 1) {
        setTimeout(() => {
          ref.current.hide();
          setTimeout(() => {
            setStatus('verifying');
            ref.current.execute();
          }, 0);
        }, 100);
      }
    } else {
      console.warn('Native SDK fixture:', event.nativeEvent.data);
      setStatus(event.nativeEvent.data);
    }
  };

  return (
    <View style={styles.container}>
      <Text testID={status}>{status}</Text>
      <Text testID={`loads-${loads}`}>SDK loads: {loads}</Text>
      <Button testID="execute" title="Screen 2" onPress={() => {
        setStatus('verifying');
        ref.current.execute();
      }} />
      <ConfirmHcaptcha
        ref={ref}
        prewarm
        passiveSiteKey={passiveSiteKey}
        theme={theme}
        rqdata={rqdata}
        verifyParams={verifyParams}
        siteKey="site-key"
        baseUrl="https://hcaptcha.com"
        jsSrc={delayedTokens ? `data:application/javascript,${encodeURIComponent('window.fixtureDelay = true;\n' + sdk)}#` : jsSrc}
        sentry={false}
        onMessage={onMessage}
      />
    </View>
  );
};

const styles = StyleSheet.create({ container: { flex: 1, paddingTop: 80, paddingHorizontal: 24 } });

describe('native WebView prewarm', () => {
  for (const passiveSiteKey of [false, true]) {
    test(`loads while hidden and reuses the widget (passiveSiteKey=${passiveSiteKey})`, async () => {
      await render(<PrewarmFixture key={String(passiveSiteKey)} passiveSiteKey={passiveSiteKey} />);
      await waitFor(() => screen.findByTestId('ready'), { timeout: 15000 });
      for (const attempt of [1, 2]) {
        await userEvent.press(await screen.findByTestId('execute'));
        await waitFor(() => screen.findByTestId(`fixture-token-widget-1-attempt-${attempt}-000000000000`), { timeout: 5000 });
      }
      expect(await screen.findByTestId('execute')).toBeDefined();
    });

    test(`rejects a cancelled outcome after re-execute (passiveSiteKey=${passiveSiteKey})`, async () => {
      await render(<PrewarmFixture key={`cancel-${passiveSiteKey}`} passiveSiteKey={passiveSiteKey} delayedTokens cancelAndRetry />);
      await waitFor(() => screen.findByTestId('ready'), { timeout: 15000 });
      await userEvent.press(await screen.findByTestId('execute'));
      await new Promise((resolve) => setTimeout(resolve, 2500));
      expect(await screen.findByTestId('verifying')).toBeDefined();
      await waitFor(() => screen.findByTestId('fixture-token-widget-1-attempt-2-000000000000'), { timeout: 5000 });
      expect(await screen.findByTestId('loads-1')).toBeDefined();
    });

    test(`preserves a held token across presentation change (passiveSiteKey=${passiveSiteKey})`, async () => {
      const fixture = await render(<PrewarmFixture key={`presentation-${passiveSiteKey}`} passiveSiteKey={passiveSiteKey} hideAfterToken={false} />);
      await waitFor(() => screen.findByTestId('ready'), { timeout: 15000 });
      await userEvent.press(await screen.findByTestId('execute'));
      await waitFor(() => screen.findByTestId('fixture-token-widget-1-attempt-1-000000000000'));
      await fixture.rerender(<PrewarmFixture key={`presentation-${passiveSiteKey}`} passiveSiteKey={!passiveSiteKey} hideAfterToken={false} />);
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(await screen.findByTestId('fixture-token-widget-1-attempt-1-000000000000')).toBeDefined();
      expect(await screen.findByTestId('loads-1')).toBeDefined();
    });
  }

  test('recreates the native document after a theme change', async () => {
    const fixture = await render(<PrewarmFixture key="theme" passiveSiteKey />);
    await waitFor(() => screen.findByTestId('loads-1'), { timeout: 15000 });
    await userEvent.press(await screen.findByTestId('execute'));
    await waitFor(() => screen.findByTestId('fixture-token-widget-1-attempt-1-000000000000'));
    await fixture.rerender(<PrewarmFixture key="theme" passiveSiteKey theme="dark" />);
    await waitFor(() => screen.findByTestId('loads-2'), { timeout: 15000 });
    await userEvent.press(await screen.findByTestId('execute'));
    await waitFor(() => screen.findByTestId('fixture-token-widget-1-attempt-1-000000000000'));
    expect(await screen.findByTestId('loads-2')).toBeDefined();
  });

  for (const legacy of [false, true]) {
    test(`updates verification data with the expected reload behavior (legacy=${legacy})`, async () => {
      const initial = legacy ? { rqdata: 'initial' } : { verifyParams: { rqdata: 'initial' } };
      const updated = legacy ? { rqdata: 'current-000000000000' } : { verifyParams: { rqdata: 'current-000000000000' } };
      const fixture = await render(<PrewarmFixture key={`payload-${legacy}`} passiveSiteKey {...initial} />);
      await waitFor(() => screen.findByTestId('loads-1'), { timeout: 15000 });
      await fixture.rerender(<PrewarmFixture key={`payload-${legacy}`} passiveSiteKey {...updated} />);
      const loads = legacy ? 2 : 1;
      await waitFor(() => screen.findByTestId(`loads-${loads}`), { timeout: 15000 });
      await userEvent.press(await screen.findByTestId('execute'));
      await waitFor(() => screen.findByTestId('fixture-token-widget-1-attempt-1-current-000000000000'));
      expect(await screen.findByTestId(`loads-${loads}`)).toBeDefined();
    });
  }
});
