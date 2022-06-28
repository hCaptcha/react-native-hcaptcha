import * as React from 'react';
import { Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import ConfirmHcaptcha from '@hcaptcha/react-native-hcaptcha';

// demo sitekey
const siteKey = '00000000-0000-0000-0000-000000000000';
const baseUrl = 'https://hcaptcha.com';

export default class App extends React.Component {
  state = {
    code: null,
  };
  onMessage = event => {
    if (event && event.nativeEvent.data) {
      if (['cancel'].includes(event.nativeEvent.data)) {
        // do not call this.captchaForm.hide(); function in this condition. Otherwise app will crash.
        this.setState({ code: event.nativeEvent.data});
        return;
      } else if (['error', 'expired'].includes(event.nativeEvent.data)) {
        this.captchaForm.hide();
        this.setState({ code: event.nativeEvent.data});
        return;
      } else {
        console.log('Verified code from hCaptcha', event.nativeEvent.data);
        this.setState({ code: event.nativeEvent.data });
        setTimeout(() => {
          this.captchaForm.hide();
          // do whatever you want here
        }, 1000);
      }
    }
  };

  render() {
    let { code } = this.state;
    return (
      <View style={styles.container}>
        <ConfirmHcaptcha
          ref={_ref => (this.captchaForm = _ref)}
          siteKey={siteKey}
          baseUrl={baseUrl}
          languageCode="en"
          onMessage={this.onMessage}
        />
        <TouchableOpacity
          onPress={() => {
            this.captchaForm.show();
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
  }
}

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

