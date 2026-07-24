import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  LogBox,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ConfirmHcaptcha, { Hcaptcha } from '@hcaptcha/react-native-hcaptcha';

LogBox.ignoreLogs([
  "Deep imports from the 'react-native' package are deprecated",
  'SafeAreaView has been deprecated',
]);

const PASS_SITE_KEY = '10000000-ffff-ffff-ffff-000000000001';
const CHALLENGE_SITE_KEY = '00000000-0000-0000-0000-000000000000';
const BASE_URL = 'https://hcaptcha.com';

const now = () => (
  global.performance && typeof global.performance.now === 'function'
    ? global.performance.now()
    : Date.now()
);

const formatMs = value => `${Math.round(value)} ms`;

const PreloadMatrix = () => {
  const inlineRef = useRef(null);
  const legacyRef = useRef(null);
  const inlineMountStartedAt = useRef(now());
  const inlineExecuteStartedAt = useRef(null);
  const legacyExecuteStartedAt = useRef(null);
  const executeAfterMount = useRef(false);

  const [inlineKey, setInlineKey] = useState(0);
  const [inlineSiteKey, setInlineSiteKey] = useState(PASS_SITE_KEY);
  const [inlineStatus, setInlineStatus] = useState('loading');
  const [logs, setLogs] = useState(['App mounted; api.js preload started']);

  const appendLog = useCallback(message => {
    const timestamp = new Date().toISOString().slice(11, 23);
    setLogs(current => [`${timestamp}  ${message}`, ...current].slice(0, 6));
    console.log(`[hCaptcha matrix] ${message}`);
  }, []);

  const remountAndExecute = useCallback((siteKey, label) => {
    inlineRef.current = null;
    inlineMountStartedAt.current = now();
    inlineExecuteStartedAt.current = inlineMountStartedAt.current;
    executeAfterMount.current = true;
    setInlineStatus('loading + execute queued');
    setInlineSiteKey(siteKey);
    setInlineKey(current => current + 1);
    appendLog(`${label}: remounted and requested execute immediately`);
  }, [appendLog]);

  useEffect(() => {
    if (!executeAfterMount.current || !inlineRef.current) {
      return;
    }

    executeAfterMount.current = false;
    inlineRef.current.execute();
    appendLog('execute() called before onReady');
  }, [appendLog, inlineKey]);

  const onInlineReady = useCallback(() => {
    const elapsed = now() - inlineMountStartedAt.current;
    setInlineStatus(`ready in ${formatMs(elapsed)}`);
    appendLog(`inline ready: mount → ready ${formatMs(elapsed)}`);
  }, [appendLog]);

  const onInlineMessage = useCallback(event => {
    const data = event?.nativeEvent?.data || 'unknown';
    const elapsed = inlineExecuteStartedAt.current == null
      ? null
      : now() - inlineExecuteStartedAt.current;
    const timing = elapsed == null ? '' : ` after ${formatMs(elapsed)}`;

    if (data === 'open') {
      setInlineStatus(`challenge open${timing}`);
      appendLog(`inline open${timing}`);
      return;
    }

    if (event.success) {
      setInlineStatus(`token received${timing}`);
      appendLog(`inline token${timing}`);
      event.markUsed?.();
      return;
    }

    setInlineStatus(`${data}${timing}`);
    appendLog(`inline ${data}${timing}`);
  }, [appendLog]);

  const executeReadyWidget = useCallback(() => {
    inlineExecuteStartedAt.current = now();
    setInlineStatus('executing');
    appendLog('execute() called on mounted widget');
    inlineRef.current?.execute();
  }, [appendLog]);

  const resetInline = useCallback(() => {
    inlineRef.current?.reset();
    inlineExecuteStartedAt.current = null;
    setInlineStatus('reset; ready');
    appendLog('reset() called');
  }, [appendLog]);

  const closeInline = useCallback(() => {
    inlineRef.current?.close();
    setInlineStatus('close requested');
    appendLog('close() called');
  }, [appendLog]);

  const showLegacy = useCallback(() => {
    legacyExecuteStartedAt.current = now();
    appendLog('legacy show() called');
    legacyRef.current?.show();
  }, [appendLog]);

  const onLegacyMessage = useCallback(event => {
    const data = event?.nativeEvent?.data || 'unknown';
    const elapsed = legacyExecuteStartedAt.current == null
      ? null
      : now() - legacyExecuteStartedAt.current;
    const timing = elapsed == null ? '' : ` after ${formatMs(elapsed)}`;

    appendLog(`legacy ${event.success ? 'token' : data}${timing}`);
    if (event.success) {
      event.markUsed?.();
    }
    if (data !== 'open') {
      legacyRef.current?.hide();
    }
  }, [appendLog]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>hCaptcha preload matrix</Text>
        <Text testID="inline-status" style={styles.status}>
          Inline: {inlineStatus}
        </Text>
      </View>

      <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
        <View style={styles.buttonRow}>
          <ActionButton
            label="1. Execute ready"
            onPress={executeReadyWidget}
            testID="execute-ready"
          />
          <ActionButton
            label="2. Execute while loading"
            onPress={() => remountAndExecute(PASS_SITE_KEY, 'pass key')}
            testID="execute-loading"
          />
          <ActionButton
            label="3. Open challenge"
            onPress={() => remountAndExecute(CHALLENGE_SITE_KEY, 'challenge key')}
            testID="open-challenge"
          />
          <ActionButton label="4. Close" onPress={closeInline} testID="close-inline" />
          <ActionButton label="5. Reset" onPress={resetInline} testID="reset-inline" />
          <ActionButton label="6. Legacy modal" onPress={showLegacy} testID="legacy-modal" />
        </View>

        <Text style={styles.logTitle}>Newest events</Text>
        {logs.map((message, index) => (
          <Text key={`${index}-${message}`} style={styles.logLine}>
            {message}
          </Text>
        ))}
      </ScrollView>

      <View style={styles.inlinePanel}>
        <Hcaptcha
          key={`${inlineKey}-${inlineSiteKey}`}
          ref={inlineRef}
          autoExecute={false}
          siteKey={inlineSiteKey}
          url={BASE_URL}
          size="invisible"
          languageCode="en"
          onReady={onInlineReady}
          onMessage={onInlineMessage}
          showLoading
          loadingIndicatorColor="#5b66f7"
        />
      </View>

      <ConfirmHcaptcha
        ref={legacyRef}
        siteKey={PASS_SITE_KEY}
        baseUrl={BASE_URL}
        size="invisible"
        languageCode="en"
        onMessage={onLegacyMessage}
        showLoading
      />
    </SafeAreaView>
  );
};

const LegacyColdStart = ({ onContinue, startedAt }) => {
  const legacyRef = useRef(null);
  const startedRef = useRef(false);
  const [status, setStatus] = useState('mounting legacy widget');

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    legacyRef.current?.show();
  }, []);

  const onMessage = useCallback(event => {
    const data = event?.nativeEvent?.data || 'unknown';
    const timing = ` after ${formatMs(now() - startedAt)}`;

    if (data === 'open') {
      setStatus(`challenge open${timing}`);
      return;
    }

    if (event.success) {
      setStatus(`token received${timing}`);
      event.markUsed?.();
    } else {
      setStatus(`${data}${timing}`);
    }
    legacyRef.current?.hide();
  }, [startedAt]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.modeScreen}>
        <Text style={styles.title}>Legacy cold-start result</Text>
        <Text testID="legacy-cold-status" style={styles.status}>
          {status}
        </Text>
        <Text style={styles.description}>
          This path mounted no inline WebView and made no api.js request before the test began.
        </Text>
        <ActionButton
          label="Continue to preload matrix"
          onPress={onContinue}
          testID="continue-preload"
        />
      </View>

      <ConfirmHcaptcha
        ref={legacyRef}
        siteKey={PASS_SITE_KEY}
        baseUrl={BASE_URL}
        size="invisible"
        languageCode="en"
        onMessage={onMessage}
        showLoading
      />
    </SafeAreaView>
  );
};

const App = () => {
  const legacyStartedAt = useRef(null);
  const [mode, setMode] = useState(null);

  if (mode === 'legacy') {
    return (
      <LegacyColdStart
        startedAt={legacyStartedAt.current}
        onContinue={() => setMode('preload')}
      />
    );
  }

  if (mode === 'preload') {
    return <PreloadMatrix />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.modeScreen}>
        <Text style={styles.title}>Choose a clean-start path</Text>
        <Text style={styles.description}>
          Select legacy first to measure the old flow before any hCaptcha WebView or api.js preload exists.
        </Text>
        <View style={styles.buttonRow}>
          <ActionButton
            label="Legacy cold start"
            onPress={() => {
              legacyStartedAt.current = now();
              setMode('legacy');
            }}
            testID="legacy-cold-start"
          />
          <ActionButton
            label="Preload matrix"
            onPress={() => setMode('preload')}
            testID="preload-matrix"
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const ActionButton = ({ label, onPress, testID }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    testID={testID}
  >
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#f5f6fa',
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  modeScreen: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#1f2430',
    fontSize: 20,
    fontWeight: '700',
  },
  status: {
    color: '#3b438a',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  description: {
    color: '#4e5565',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    marginTop: 10,
  },
  controls: {
    flexGrow: 0,
    maxHeight: 290,
  },
  controlsContent: {
    padding: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    backgroundColor: '#3341c7',
    borderRadius: 8,
    minWidth: '47%',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  logTitle: {
    color: '#1f2430',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  logLine: {
    color: '#4e5565',
    fontFamily: 'Courier',
    fontSize: 10,
    marginTop: 3,
  },
  inlinePanel: {
    backgroundColor: '#ffffff',
    borderColor: '#d9dce8',
    borderTopWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
  },
});

export default App;
