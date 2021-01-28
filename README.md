# react-native-hcaptcha

hCaptcha Wrapper in React Native (Android and iOS)


## Add it to your project

1. Install package
- Using NPM
   `npm install react-native-hcaptcha` 
- Using Yarn
   `yarn add react-native-hcaptcha`
2. Import package
`import ConfirmHcaptcha from 'react-native-hcaptcha';`


## Dependencies

1. [react-native-modal](https://github.com/react-native-community/react-native-modal)

2. [react-native-webview](https://github.com/react-native-community/react-native-webview)


## Usage

See demo in [Snack link](https://snack.expo.io/coming/soon) (coming soon)

or Example.App.js example in repo.


```javascript
import React from 'react';
import ConfirmHcaptcha from 'react-native-hcaptcha';
const siteKey = 'you_site_key';
const baseUrl = 'base_url';
class App extends React.Component  {
    onMessage = event => {
         if (event && event.nativeEvent.data) {
            if (['cancel', 'error', 'expired'].includes(event.nativeEvent.data)) {
                this.captchaForm.hide();
                return;
            } else {
                console.log('Verified code from hCaptcha', event.nativeEvent.data);
                setTimeout(() => {
                    this.captchaForm.hide();
                    // do whatever you want here
                }, 1000);
            }
        }
    };
    render() {
        return (
            <View style={styles.container}>
                <ConfirmHcaptcha
                    ref={_ref => this.captchaForm = _ref}
                    siteKey={siteKey}
                    baseUrl={baseUrl}
                    languageCode='en'
                    onMessage={this.onMessage}
                />
                <Button
                    onPress={() => {
                        this.captchaForm.show();
                    }}
                    title='Click'
                    style={{ width: 120, backgroundColor: 'darkviolet' }}
                    textColor='#fff'
                />
            </View>
        );
    }
}
```

### Note
You can `import Hcaptcha from 'react-native-hcaptcha/Hcaptcha';` to customize the UI yourself. 


## DEMO

### iOS
![iOS](https://coming.soon) (gif coming soon)

### Android
![Android](https://coming.soon) (gif coming soon)



## Props

- **`siteKey`** _(String)_ - The hCaptcha sitekey
- **`baseUrl`** _(String)_ The url domain defined on your hCaptcha.
- **`onMessage`** _(Function)_ - The callback function that runs after receiving a response, error, or when user cancels.
- **`languageCode`** _(String)_ - Default language for hCaptcha. Overrides browser defaults. Can be found at [this link](https://docs.hcaptcha.com/languages)
- **`cancelButtonText`** _(String)_ - Title of cancel button.


## Status

This is a preview release. Remaining TODOs:

- Replace `api.js` params with more flexible constructor.
- Support `rqdata` and other hCaptcha Enterprise features.


## License

MIT License. (C) 2021 hCaptcha.

Credits: Forked from xuho and filipepiresg's Google reCAPTCHA v2 work, MIT licensed.
