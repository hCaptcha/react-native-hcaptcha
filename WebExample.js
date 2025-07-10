import React from 'react';
import { AppRegistry, Text, View, TouchableOpacity } from 'react-native';
import ConfirmHcaptcha from './index';

const siteKey = '00000000-0000-0000-0000-000000000000';
const baseUrl = 'https://hcaptcha.com';

// Simple test without importing the library first
class WebExampleApp extends React.Component {
  onMessage = event => {
    console.log('onMessage', event);
  };

  render() {
    return (
      <View style={{ padding: 20, backgroundColor: '#f5f5f5', height: '100vh' }}>
        <Text style={{ fontSize: 24, textAlign: 'center', marginBottom: 20 }}>
          React Native hCaptcha - Web Demo
        </Text>
        
        <ConfirmHcaptcha
          ref={_ref => (this.captchaForm = _ref)}
          siteKey={siteKey}
          baseUrl={baseUrl}
          languageCode="en"
          onMessage={this.onMessage}
        />

        <TouchableOpacity
          style={{ 
            backgroundColor: '#00838F', 
            padding: 15, 
            borderRadius: 8,
            alignItems: 'center',
            marginTop: 20
          }}
          onPress={() => {
            console.log('Button pressed');
            this.captchaForm.show();
          }}>
          <Text style={{ color: 'white', fontSize: 18 }}>Test Button</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

// Register and run the web app
AppRegistry.registerComponent('WebExample', () => WebExampleApp);
AppRegistry.runApplication('WebExample', {
  rootTag: document.getElementById('root'),
});