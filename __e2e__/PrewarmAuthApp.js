import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Button, Keyboard, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import ConfirmHcaptcha from '@hcaptcha/react-native-hcaptcha';

export const authServer = 'http://127.0.0.1:8766';

export default function PrewarmAuthApp({ passiveSiteKey = false, slowSdk = false, deferredToken = false, prewarm = true, hideOnError = true, networkTest = false, siteKey = '10000000-ffff-ffff-ffff-000000000001', host, measurements }) {
  const captchaRef = useRef(null);
  const tokenRef = useRef(null);
  const flowRef = useRef(0);
  const sourceNonce = useRef(Date.now()).current;
  const [page, setPage] = useState('welcome');
  const [mode, setMode] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tokenCount, setTokenCount] = useState(0);
  const [status, setStatus] = useState('Security check prewarming');
  const [submitting, setSubmitting] = useState(false);
  let sdkPrefix = '';
  if (slowSdk) {
    sdkPrefix = '/slow';
  } else if (networkTest) {
    sdkPrefix = `/network/${sourceNonce}`;
  } else if (deferredToken) {
    sdkPrefix = '/deferred';
  } else if (measurements) {
    sdkPrefix = '/measured';
  }
  const titles = {
    welcome: 'Your next chapter starts here',
    credentials: mode === 'signup' ? 'Create your account' : 'Welcome back',
    account: 'You’re in',
  };

  const verify = useCallback(() => {
    setStatus('Verifying');
    measurements?.attempts.push({ startedAt: global.performance.now() });
    captchaRef.current.execute();
  }, [measurements]);

  useEffect(() => {
    if (page === 'credentials') {
      verify();
    }
  }, [page, verify]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => measurements?.appStates?.push(state));
    return () => subscription.remove();
  }, [measurements]);

  const onMessage = (event) => {
    if (event.markUsed) {
      if (measurements?.consumeTokens) {
        event.markUsed();
      }
      if (measurements) {
        const attempt = measurements.attempts[measurements.attempts.length - 1];
        attempt.tokenMs = global.performance.now() - attempt.startedAt;
      }
      tokenRef.current = {
        token: event.nativeEvent.data,
        markUsed: event.markUsed,
      };
      setTokenCount((count) => count + 1);
      setStatus('Token ready');
      captchaRef.current.hide();
    } else if (event.nativeEvent.data === 'open') {
      if (measurements) {
        measurements.opens = (measurements.opens || 0) + 1;
      }
    } else {
      console.warn('Auth fixture captcha:', event.nativeEvent.data);
      measurements?.errors.push({ data: event.nativeEvent.data, description: event.nativeEvent.description });
      tokenRef.current = null;
      setStatus(event.nativeEvent.data);
      if (hideOnError) {
        captchaRef.current.hide();
      }
    }
  };

  const leave = () => {
    flowRef.current++;
    captchaRef.current.hide();
    tokenRef.current?.markUsed();
    tokenRef.current = null;
    setPassword('');
    setSubmitting(false);
    setPage('welcome');
  };

  const submit = async () => {
    Keyboard.dismiss();
    const token = tokenRef.current;
    const flow = flowRef.current;
    setSubmitting(true);
    try {
      const response = await fetch(`${authServer}/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          token: token.token,
        }),
      });
      const result = await response.json();
      // The backend may consume the captcha even when credentials are rejected.
      token.markUsed();
      if (flow !== flowRef.current) {
        return;
      }
      tokenRef.current = null;
      if (!response.ok) {
        measurements?.authErrors?.push(result.error);
        setPassword('');
        setStatus(result.error);
        return;
      }
      setPage('account');
    } catch (error) {
      if (flow === flowRef.current) {
        token.markUsed();
        tokenRef.current = null;
        setStatus(error.message);
      }
    } finally {
      if (flow === flowRef.current) {
        setSubmitting(false);
      }
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.root}>
        <View style={styles.content}>
          <Text style={styles.brand}>Acorn</Text>
          <Text testID={`page-${page}`} style={styles.title}>
            {titles[page]}
          </Text>
          {page === 'welcome' && (
            <>
              <Text>Email address</Text>
              <TextInput
                testID="email"
                accessibilityLabel="Email address"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {['signup', 'login'].map((action) => (
                <Button
                  key={action}
                  testID={action}
                  title={action === 'signup' ? 'Create account' : 'Log in'}
                  disabled={!email.includes('@')}
                  onPress={() => {
                    Keyboard.dismiss();
                    setMode(action);
                    setPage('credentials');
                  }}
                />
              ))}
            </>
          )}
          {page === 'credentials' && (
            <>
              <Text>{email}</Text>
              <Text testID={password.length >= 8 ? 'password-valid' : 'password-invalid'}>Password</Text>
              <TextInput
                testID="password"
                accessibilityLabel="Password"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
              <Button
                testID="submit"
                title={submitting ? 'Submitting…' : 'Continue'}
                disabled={!tokenRef.current || password.length < 8 || submitting}
                onPress={submit}
              />
              <Button testID="cancel" title="Back" onPress={leave} />
              <Button
                testID="retry-captcha"
                title="Retry security check"
                disabled={Boolean(tokenRef.current) || submitting || status === 'Verifying'}
                onPress={verify}
              />
            </>
          )}
          {page === 'account' && (
            <>
              <Text testID="account-email">{email}</Text>
              <Text>Your account is ready.</Text>
              <Button testID="logout" title="Log out" onPress={leave} />
            </>
          )}
          <Text testID={`tokens-${tokenCount}`}>{status}</Text>
        </View>
      </SafeAreaView>
      <ConfirmHcaptcha
        ref={captchaRef}
        prewarm={prewarm}
        passiveSiteKey={passiveSiteKey}
        siteKey={siteKey}
        host={host}
        baseUrl={authServer}
        jsSrc={`${authServer}${sdkPrefix}/1/api.js`}
        showLoading
        closableLoading
        onMessage={onMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f7faf8' },
  content: { flex: 1, padding: 28, gap: 18 },
  brand: { fontSize: 20, fontWeight: '700', color: '#236b49' },
  title: { fontSize: 28, fontWeight: '600', marginVertical: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#9aada2',
    borderRadius: 8,
    padding: 12,
    color: '#162d20',
  },
});
