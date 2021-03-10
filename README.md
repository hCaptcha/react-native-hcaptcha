# react-native-hcaptcha

hCaptcha wrapper for React Native (Android and iOS)


## Installation

1. Install package:
- Using NPM
   `npm install @hcaptcha/react-native-hcaptcha` 
- Using Yarn
   `yarn add @hcaptcha/react-native-hcaptcha`
2. Import package:
`import ConfirmHcaptcha from '@hcaptcha/react-native-hcaptcha';`


## Demo

See live demo in [Snack](https://snack.expo.io/rTUn6wTjW).

## Usage

See [Example.App.js](./Example.App.js) example in repo for a fully worked example implementation.

In particular, note the following special message strings that will be returned via onMessage:

| name | purpose |
| --- | --- |
| expired | passcode response expired and the user must re-verify |
| error | there was an error displaying the challenge |
| cancel | the user closed the challenge, or did not answer before session expired |


Any other string returned by onMessage will be a passcode.


## Dependencies

1. [react-native-modal](https://github.com/react-native-community/react-native-modal)

2. [react-native-webview](https://github.com/react-native-community/react-native-webview)


## Localization

Make sure the value you pass to `languageCode` is the one the user has set in your app if you allow them to override the system defaults.

Otherwise, you should pass in the preferred device locale, e.g. fetched from `getLocales()` if using [react-native-localize](https://github.com/zoontek/react-native-localize).


### Note
You can `import Hcaptcha from '@hcaptcha/react-native-hcaptcha/Hcaptcha';` to customize the UI yourself. 


## Properties

- **`siteKey`** _(String)_ - The hCaptcha sitekey
- **`baseUrl`** _(String)_ The url domain defined on your hCaptcha. You generally will not need to change this.
- **`onMessage`** _(Function)_ - The callback function that runs after receiving a response, error, or when user cancels.
- **`languageCode`** _(String)_ - Default language for hCaptcha. Overrides phone defaults. A complete list of supported
languages and their codes can be found at [this link](https://docs.hcaptcha.com/languages)


## Status

Fully functional, but additional releases will be made in the near term. 
Changes within the same major release are expected to be additive, i.e. non-breaking.

TODOs:

- Replace `api.js` params with more flexible constructor.
- Support `rqdata` and other hCaptcha Enterprise features.


## License

MIT License. (C) 2021 hCaptcha.

Credits: Originally forked from xuho and filipepiresg's Google reCAPTCHA v2 work. (MIT license)
