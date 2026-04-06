import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ConfirmHcaptcha, { initJourneyTracking } from '@hcaptcha/react-native-hcaptcha';

// demo sitekey
const siteKey = '00000000-0000-0000-0000-000000000000';
const baseUrl = 'https://hcaptcha.com';

initJourneyTracking({
  debug: true,
  onStats: (stats) => {
    console.log('[journey-stats]', JSON.stringify(stats));
  },
});

const App = () => {
  const [code, setCode] = useState(null);
  const [warmups, setWarmups] = useState(0);
  const captchaForm = useRef(null);

  const onMessage = (event) => {
    if (!event?.nativeEvent?.data) {
      return;
    }

    if (event.nativeEvent.data === 'open') {
      console.log('Visual challenge opened');
      return;
    }

    if (event.success) {
      setCode(event.nativeEvent.data);
      captchaForm.current.hide();
      event.markUsed();
      console.log('Verified code from hCaptcha', event.nativeEvent.data);
      return;
    }

    if (event.nativeEvent.data === 'challenge-expired') {
      event.reset();
      console.log('Visual challenge expired, reset...', event.nativeEvent.data);
      return;
    }

    setCode(event.nativeEvent.data);
    captchaForm.current.hide();
    console.log('Verification failed', event.nativeEvent.data);
  };

  return (
    <View style={styles.container}>
      <ConfirmHcaptcha
        ref={captchaForm}
        baseUrl={baseUrl}
        languageCode="en"
        onMessage={onMessage}
        siteKey={siteKey}
        userJourney={true}
      />
      <TouchableOpacity
        nativeID="warmup-touch"
        onPress={() => {
          setWarmups((value) => value + 1);
        }}
        testID="warmup-touch"
      >
        <Text style={styles.paragraph}>Preverify: {warmups} taps here</Text>
      </TouchableOpacity>
      <TouchableOpacity
        nativeID="launch-captcha"
        onPress={() => {
          captchaForm.current.show();
        }}
        testID="launch-captcha"
      >
        <Text style={styles.paragraph}>Tap to launch</Text>
      </TouchableOpacity>
      {code && (
        <Text style={styles.codeContainer}>
          {'passcode or status: '}
          <Text style={styles.codeText}>
            {code}
          </Text>
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  codeContainer: {
    alignSelf: 'center',
  },
  codeText: {
    color: 'darkviolet',
    fontSize: 6,
    fontWeight: 'bold',
  },
  container: {
    backgroundColor: '#ecf0f1',
    flex: 1,
    justifyContent: 'center',
    padding: 8,
  },
  paragraph: {
    fontSize: 18,
    fontWeight: 'bold',
    margin: 24,
    textAlign: 'center',
  },
});

export default App;
