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

Full examples for expo and react-native, as well as debugging guides, are in [MAINTAINER.md](./MAINTAINER.md)

## Demo

See live demo in [Snack](https://snack.expo.io/rTUn6wTjW).

## Usage

See [Example.App.js](./Example.App.js) example in repo for a fully worked example implementation.

For users familiar with the hCaptcha JS API, calling `show()` in this wrapper triggers an `hcaptcha.execute()` call.

This means that if you are an Enterprise user with a 99.9% passive or purely passive sitekey configured, no additional work is required to get the expected behavior: either a visual challenge will be shown or a token will be returned immediately via `onMessage`, in accordance with your configuration.

Also, please note the following special message strings that can be returned via `onMessage`:

| name | purpose |
| --- | --- |
| expired | passcode response expired and the user must re-verify |
| error | there was an error displaying the challenge |
| cancel | the user closed the challenge, or did not answer before session expired |


Any other string returned by `onMessage` will be a passcode.

### Handling the post-issuance expiration lifecycle

This extension is a lightweight wrapper, and does not currently attempt to manage post-verification state in the same way as the web JS API, e.g. with an on-expire callback.

In particular, if you do **not** plan to immediately consume the passcode returned by submitting it to your backend, you should start a timer to let your application state know that a new passcode is required when it expires.

By default, this value is 120 seconds. Thus, you would want code similar to the following in your app when handling `onMessage` responses that return a passcode:

```
this.timeoutCheck = setTimeout(() => {
   this.setPasscodeExpired();
   }, 120000);
```

## Dependencies

1. [react-native-modal](https://github.com/react-native-community/react-native-modal)

2. [react-native-webview](https://github.com/react-native-community/react-native-webview)


## Building on iOS

### Required frameworks/libraries

Your app must have the following frameworks/libraries linked:

- libswiftWebKit.tbd
- JavaScriptCore.framework

### Flipper version

You must have a recent version of flipper to build this app. If you have upgraded React Native recently, your Flipper version may be out of date. This will cause compilation errors.

Your Podfile should be updated to something like:

```
  # Enables Flipper.
  #
  # Note that if you have use_frameworks! enabled, Flipper will not work and
  # you should disable these next few lines.
  use_flipper!({ 'Flipper-Folly' => '2.5.3', 'Flipper' => '0.87.0', 'Flipper-RSocket' => '1.3.1' })
  post_install do |installer|
    flipper_post_install(installer)
  end
```

If you encounter build-time errors related to Flipper.


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
- **`showLoading`** _(Bool)_ - show loading indicator for webview till hCaptcha web content loads?
- **`loadingIndicatorColor`** _(String)_ - color for the ActivityIndicator
- **`backgroundColor`** _(String)_ - background color used in HTML
- **`theme`** _(String|Object)_ - theme for hcaptcha can be 'light', 'dark', 'contrast' or custom theme object (see Enterprise docs)

## Status

Fully functional, but additional releases will be made in the near term. 
Changes within the same major release are expected to be additive, i.e. non-breaking.

TODOs:

- Replace `api.js` params with more flexible constructor.
- Support `rqdata` and other hCaptcha Enterprise features.


## License

MIT License. (C) 2021 hCaptcha.

Credits: Originally forked from xuho and filipepiresg's Google reCAPTCHA v2 work. (MIT license)
