import React, { useRef, useState } from 'react';
import { AppRegistry, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ConfirmHcaptcha from './index';

// demo sitekey
// Swap in hCaptcha's always-pass test key '10000000-ffff-ffff-ffff-000000000001'
// to exercise the token path without solving a visual challenge.
const siteKey = '00000000-0000-0000-0000-000000000000';
const baseUrl = 'https://hcaptcha.com';

const App = () => {
  const [code, setCode] = useState(null);
  const captchaForm = useRef(null);

  const onMessage = event => {
    if (event && event.nativeEvent.data) {
      if (event.nativeEvent.data === 'open') {
        console.log('Visual challenge opened');
      } else if (event.success) {
        setCode(event.nativeEvent.data);
        captchaForm.current.hide();
        event.markUsed();
        console.log('Verified code from hCaptcha', event.nativeEvent.data);
      } else if (event.nativeEvent.data === 'challenge-expired') {
        event.reset();
        console.log('Visual challenge expired, reset...', event.nativeEvent.data);
      } else /* other errors */ {
        setCode(event.nativeEvent.data);
        captchaForm.current.hide();
        console.log('Verification failed', event.nativeEvent.data);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>hCaptcha · React Native Web</Text>
      <ConfirmHcaptcha
        ref={captchaForm}
        siteKey={siteKey}
        baseUrl={baseUrl}
        languageCode="en"
        onMessage={onMessage}
      />
      <TouchableOpacity
        onPress={() => {
          captchaForm.current.show();
        }}
        testID="launch-button">
        <Text style={styles.paragraph}>Click to launch</Text>
      </TouchableOpacity>
      {code && (
        <Text style={styles.codeContainer} testID="result">
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
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    padding: 8,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  paragraph: {
    margin: 24,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  codeContainer: {
    alignSelf: 'center',
  },
  codeText: {
    color: 'darkviolet',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

AppRegistry.registerComponent('HcaptchaWebExample', () => App);
AppRegistry.runApplication('HcaptchaWebExample', {
  rootTag: document.getElementById('root'),
});

export default App;
