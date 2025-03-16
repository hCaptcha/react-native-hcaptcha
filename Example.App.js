import React, { useState, useRef } from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import ConfirmHcaptcha from '@hcaptcha/react-native-hcaptcha';

// demo sitekey
const siteKey = '00000000-0000-0000-0000-000000000000';
const baseUrl = 'https://hcaptcha.com';

const App = () => {
  const [code, setCode] = useState(null);
  const captchaForm = useRef(null);

  const onMessage = event => {
    if (event && event.nativeEvent.data) {
      if (['cancel'].includes(event.nativeEvent.data)) {
        captchaForm.current.hide();
        setCode(event.nativeEvent.data);
      } else if (['error'].includes(event.nativeEvent.data)) {
        captchaForm.current.hide();
        setCode(event.nativeEvent.data);
        console.log('Verification failed', event.nativeEvent.data);
      } else if (event.nativeEvent.data === 'expired') {
        event.reset();
        console.log('Visual challenge expired, reset...', event.nativeEvent.data);
      } else if (event.nativeEvent.data === 'open') {
        console.log('Visual challenge opened');
      } else {
        console.log('Verified code from hCaptcha', event.nativeEvent.data);
        captchaForm.current.hide();
        event.markUsed();
        setCode(event.nativeEvent.data);
      }
    }
  };

  return (
    <View style={styles.container}>
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
        }}>
        <Text style={styles.paragraph}>Click to launch</Text>
      </TouchableOpacity>
      {code && (
        <Text style={{ alignSelf: 'center' }}>
          {`passcode or status: `}
          <Text style={{ color: 'darkviolet', fontWeight: 'bold', fontSize: 6 }}>
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
  paragraph: {
    margin: 24,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default App;
