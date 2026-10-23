import { describe, test, render, expect, waitFor } from 'react-native-harness';
import { screen, userEvent } from '@react-native-harness/ui';
import React, { useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

import ConfirmHcaptcha, { Hcaptcha } from '@hcaptcha/react-native-hcaptcha';
import { authServer } from './PrewarmAuthApp';

// Replace only the remote SDK; exercise the published loader and native WebView bridge.
const sdk = `
  var widget, config, attempt = 0;
  window.hcaptcha = {
    render: function(id, options) {
      if (window.fixtureRenderFailures > 0) {
        window.fixtureRenderFailures--;
        setTimeout(function() { fetch('${authServer}/sdk-ready', { method: 'POST' }); }, 100);
        throw new Error('fixture render failure');
      }
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

const PrewarmFixture = ({ passiveSiteKey, theme, rqdata, verifyParams, delayedTokens = false, hideAfterToken = true, cancelAndRetry = false, captchaRef, inline = false, onEvent, sdkSource }) => {
  const localRef = useRef(null);
  const ref = captchaRef || localRef;
  const Component = inline ? Hcaptcha : ConfirmHcaptcha;
  const opens = useRef(0);
  const [status, setStatus] = useState('loading');
  const [loads, setLoads] = useState(0);
  const [presses, setPresses] = useState(0);
  const onMessage = (event) => {
    onEvent?.(event);
    if (event.nativeEvent.data === 'fixture-ready') {
      setStatus('ready');
      setLoads((count) => count + 1);
    } else if (event.markUsed) {
      setStatus(event.nativeEvent.data);
      event.markUsed();
      if (hideAfterToken) {
        ref.current[inline ? 'reset' : 'hide']();
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
      <Text testID={`presses-${presses}`}>Screen presses: {presses}</Text>
      <Button testID="execute" title="Screen 2" onPress={() => {
        setPresses((count) => count + 1);
        setStatus('verifying');
        ref.current.execute();
      }} />
      <Component
        ref={ref}
        prewarm
        passiveSiteKey={passiveSiteKey}
        theme={theme}
        rqdata={rqdata}
        verifyParams={verifyParams}
        siteKey="site-key"
        baseUrl={sdkSource ? authServer : 'https://hcaptcha.com'}
        url={sdkSource ? authServer : 'https://hcaptcha.com'}
        jsSrc={sdkSource || (delayedTokens ? `data:application/javascript,${encodeURIComponent('window.fixtureDelay = true;\n' + sdk)}#` : jsSrc)}
        sentry={false}
        onMessage={onMessage}
      />
    </View>
  );
};

const styles = StyleSheet.create({ container: { flex: 1, paddingTop: 80, paddingHorizontal: 24 } });

describe('native WebView prewarm', () => {
  for (const variant of ['overlay', 'passive', 'inline']) {
    test(`defers idle render failure and recovers through event.reset (${variant})`, async () => {
      await fetch(`${authServer}/reset`, { method: 'POST' });
      const ref = React.createRef();
      const events = [];
      await render(<PrewarmFixture key={`render-retry-${variant}`} captchaRef={ref}
        inline={variant === 'inline'} passiveSiteKey={variant === 'passive'} onEvent={(event) => events.push(event)}
        sdkSource={`data:application/javascript,${encodeURIComponent('window.fixtureRenderFailures = 2;\n' + sdk)}#`} />);
      await waitFor(async () => {
        const state = await (await fetch(`${authServer}/state`)).json();
        expect(state.sdkReady).toBe(1);
      });
      expect(events).toHaveLength(0);
      ref.current.execute();
      await waitFor(() => expect(events.filter((event) => event.nativeEvent.data === 'Error')).toHaveLength(1));
      const error = events.find((event) => event.nativeEvent.data === 'Error');
      ref.current[variant === 'inline' ? 'reset' : 'hide']();
      error.reset();
      await waitFor(() => expect(events.filter((event) => event.markUsed)).toHaveLength(1));
      expect(await screen.findByTestId('loads-1')).toBeDefined();
    });

    test(`event.reset retries a held token after hide (${variant})`, async () => {
      const ref = React.createRef();
      const events = [];
      await render(<PrewarmFixture key={`hidden-reset-${variant}`} captchaRef={ref}
        inline={variant === 'inline'} passiveSiteKey={variant === 'passive'} delayedTokens
        onEvent={(event) => events.push(event)} />);
      await waitFor(() => screen.findByTestId('loads-1'));
      ref.current.execute();
      await waitFor(() => expect(events.filter((event) => event.markUsed)).toHaveLength(1), { timeout: 10000 });
      const token = events.find((event) => event.markUsed);
      token.reset();
      await waitFor(() => expect(events.filter((event) => event.nativeEvent.data === 'open')).toHaveLength(2));
      if (variant === 'overlay') {
        // A restored challenge must intercept touches intended for the form below it.
        await userEvent.press(await screen.findByTestId('execute'));
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(await screen.findByTestId('presses-0')).toBeDefined();
      }
      await waitFor(() => expect(events.filter((event) => event.markUsed)).toHaveLength(2), { timeout: 10000 });
      expect(await screen.findByTestId('loads-1')).toBeDefined();
    });

    test(`destroys while the SDK HTTP request is blocked (${variant})`, async () => {
      await fetch(`${authServer}/reset`, { method: 'POST' });
      const ref = React.createRef();
      const events = [];
      const props = { captchaRef: ref, inline: variant === 'inline', passiveSiteKey: variant === 'passive',
        onEvent: (event) => events.push(event) };
      const fixture = await render(<PrewarmFixture key={`loading-${variant}`} {...props}
        sdkSource={`${authServer}/slow/1/api.js`} />);
      await waitFor(async () => {
        const state = await (await fetch(`${authServer}/state`)).json();
        expect(state.sdkLoads).toBe(1);
      }, { timeout: 15000 });
      ref.current.execute();
      ref.current.destroy();
      await waitFor(() => expect(screen.queryByTestId('confirm-hcaptcha-prewarm')).toBeNull());
      await fetch(`${authServer}/release-sdk`, { method: 'POST' });
      await fixture.rerender(<PrewarmFixture key={`loading-${variant}`} {...props} />);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(events).toHaveLength(0);
      ref.current.execute();
      await waitFor(() => screen.findByTestId('loads-1'), { timeout: 15000 });
      await waitFor(() => expect(events.filter((event) => event.markUsed)).toHaveLength(1));
    });

    for (const phase of ['ready', 'pending', 'held']) {
      test(`destroys and recreates the WebView (${variant}, ${phase})`, async () => {
        const ref = React.createRef();
        const events = [];
        await render(<PrewarmFixture key={`destroy-${variant}-${phase}`} captchaRef={ref}
          inline={variant === 'inline'} passiveSiteKey={variant === 'passive'}
          delayedTokens={phase === 'pending'} hideAfterToken={false} onEvent={(event) => events.push(event)} />);
        await waitFor(() => screen.findByTestId('loads-1'), { timeout: 15000 });
        if (phase !== 'ready') {
          ref.current.execute();
          await waitFor(() => expect(events.some((event) => event.nativeEvent.data === 'open')).toBe(true));
        }
        if (phase === 'held') {
          await waitFor(() => expect(events.filter((event) => event.markUsed)).toHaveLength(1));
        }
        ref.current.destroy();
        ref.current.destroy();
        await waitFor(() => expect(screen.queryByTestId('confirm-hcaptcha-prewarm')).toBeNull());
        const count = events.length;
        await new Promise((resolve) => setTimeout(resolve, phase === 'pending' ? 2500 : 100));
        expect(events).toHaveLength(count);
        for (const loads of [2, 3]) {
          const tokens = events.filter((event) => event.markUsed).length;
          ref.current[variant === 'inline' ? 'execute' : 'show']();
          await waitFor(() => screen.findByTestId(`loads-${loads}`), { timeout: 15000 });
          await waitFor(() => expect(events.filter((event) => event.markUsed)).toHaveLength(tokens + 1), { timeout: 10000 });
          ref.current.destroy();
        }
      });
    }
  }

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
