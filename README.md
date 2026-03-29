
[![npm](https://img.shields.io/npm/v/@hcaptcha/react-native-hcaptcha)](https://www.npmjs.com/package/@hcaptcha/react-native-hcaptcha)
[![ci](https://github.com/hCaptcha/react-native-hcaptcha/actions/workflows/tests.yaml/badge.svg)](https://github.com/hCaptcha/react-native-hcaptcha/actions/workflows/tests.yaml)

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

Also, please note the following special message strings that can be returned via `onMessage` for [error cases](https://docs.hcaptcha.com/configuration#error-codes)

The event returned by `onMessage` with `success === true` will be a passcode.

In practice, you should always provide `onMessage`. Without it, your app will not receive tokens, errors, or cancel events.

### Basic modal usage

```js
import React, { useRef } from 'react';
import ConfirmHcaptcha from '@hcaptcha/react-native-hcaptcha';

export default function Example() {
  const captchaRef = useRef(null);

  const onMessage = (event) => {
    if (!event?.nativeEvent?.data) {
      return;
    }

    if (event.success) {
      const token = event.nativeEvent.data;
      event.markUsed?.();
      captchaRef.current?.hide();
      return;
    }

    if (event.nativeEvent.data === 'challenge-closed') {
      captchaRef.current?.hide();
    }
  };

  return (
    <ConfirmHcaptcha
      ref={captchaRef}
      siteKey="your-site-key"
      baseUrl="https://hcaptcha.com"
      onMessage={onMessage}
    />
  );
}
```

### Verification payloads with `verifyParams`

Use `verifyParams` for request data passed to `hcaptcha.setData(...)` immediately before each verification attempt.

```js
<ConfirmHcaptcha
  ref={captchaRef}
  siteKey="your-site-key"
  baseUrl="https://hcaptcha.com"
  onMessage={onMessage}
  verifyParams={{
    rqdata: enterpriseRqdata,
    phonePrefix: '44',
    phoneNumber: '+44123456789',
  }}
/>
```

Legacy top-level `rqdata`, `phonePrefix`, and `phoneNumber` props still work, but `verifyParams` takes precedence and should be preferred for new code.

### User Journeys (Enterprise)

Journey capture is opt-in at the captcha level through `userJourney={true}`.

By default, a captcha instance with `userJourney={true}` will:

- attach the current shared journey buffer to its verification payload as `userjourney`
- initialize the journey runtime on first use if needed
- enable automatic app-wide touch capture while at least one `userJourney` captcha instance is mounted

Use `initJourneyTracking()` when you want to:

- start journey tracking before the captcha component mounts
- register a React Navigation container for automatic screen tracking
- enable runtime debug/stats hooks
- disable automatic touch capture with `touchCapture: false` while keeping the rest of User Journeys enabled

```js
import ConfirmHcaptcha, {
  initJourneyTracking,
  registerJourneyNavigationContainer,
} from '@hcaptcha/react-native-hcaptcha';

initJourneyTracking({
  touchCapture: true,
});

// If you use React Navigation, register the container once the ref exists.
registerJourneyNavigationContainer(navigationRef);

<ConfirmHcaptcha
  ref={captchaRef}
  siteKey="your-site-key"
  baseUrl="https://hcaptcha.com"
  onMessage={onMessage}
  userJourney={true}
/>
```

If you are already holding a navigation container ref at init time, you can pass it directly:

```js
initJourneyTracking({
  navigationContainerRef: navigationRef,
});
```

If you want to use the inline component with journeys enabled:

```js
import { Hcaptcha, initJourneyTracking } from '@hcaptcha/react-native-hcaptcha';

initJourneyTracking();

<Hcaptcha
  siteKey="your-site-key"
  url="https://hcaptcha.com"
  onMessage={onMessage}
  userJourney={true}
/>
```

If you want `userJourney` verification payloads and navigation tracking, but do not want automatic app-wide touch capture:

```js
initJourneyTracking({
  navigationContainerRef: navigationRef,
  touchCapture: false,
});
```

Automatic journey capture currently records:

- React Navigation screen transitions
- Basic taps
- Basic drag gestures
- Scroll-like gestures inferred from axis-dominant touch movement

Automatic journey capture intentionally does **not** record:

- text input contents
- search queries
- text lengths or typed characters
- visible button text as control identifiers

### Inline component usage

If you want to manage the surrounding UI yourself, use the inline component:

```js
import { Hcaptcha } from '@hcaptcha/react-native-hcaptcha';

<Hcaptcha
  siteKey="your-site-key"
  url="https://hcaptcha.com"
  onMessage={onMessage}
/>
```

### Handling the post-issuance expiration lifecycle

This extension is a lightweight wrapper, and does not currently attempt to manage post-verification state in the same way as the web JS API, e.g. with an on-expire callback.

In particular, if you do **not** plan to immediately consume the passcode returned by submitting it to your backend, you should start a timer to let your application state know that a new passcode is required when it expires.

By default, this value is 120 seconds. So, an `expired` error will be emitted to `onMessage` if you haven't called `event.markUsed()`.

Once you've utilized hCaptcha's token, call `markUsed` on the event object in `onMessage`:

```js
  const onMessage = event => {
    if (event && event.nativeEvent.data) {
      if (event.nativeEvent.data === 'open') {
        // hCaptcha shown
      } else if (event.success) {
        captchaForm.current.hide();
        const token = event.nativeEvent.data;
        // utilize token and call markUsed once you are done with it
        event.markUsed();
      } else if (event.nativeEvent.data === 'challenge-closed') {
        captchaForm.current.hide();
      } else {
        // handle rest errors
      }
    }
  };

  const captchaForm = useRef(null);

  return (
    <ConfirmHcaptcha
      ref={captchaForm}
      siteKey={siteKey}
      languageCode="en"
      onMessage={onMessage}
    />
  );
```

### Handling errors and retry

If your app encounters an `error` event, you can reset the hCaptcha SDK flow by calling `event.reset()` to perform another attempt at verification.

`event.reset()` rebuilds the verification payload from the current props and the current buffered journey immediately before retrying.

## Dependencies

1. [react-native-webview](https://github.com/react-native-community/react-native-webview)


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


## Notes

- The UI defaults to the "invisible" mode of the JS SDK, i.e. no checkbox is displayed.
- If you need to test displaying the challenge modal, set your sitekey to "Always Challenge" mode in the hCaptcha dashboard.
- You can `import { Hcaptcha } from '@hcaptcha/react-native-hcaptcha';` to customize the UI yourself.
- hCaptcha loading is restricted to a 15-second timeout; an `error` will be sent via `onMessage` if it fails to load due to network issues.

## Journey Capture Caveats

- Call `initJourneyTracking()` once and do it early. Events that happen before initialization are not captured.
- Automatic app-wide touch capture is enabled by default while at least one captcha instance with `userJourney={true}` is mounted.
- Automatic touch capture uses React Native's public `AppRegistry.setWrapperComponentProvider(...)` API.
- This SDK composes with wrapper providers registered after it initializes by intercepting future calls to `setWrapperComponentProvider(...)`.
- React Native does not expose a getter for wrapper providers that were already registered before this SDK initialized. If another library installs a wrapper provider first, call `initJourneyTracking()` earlier or use `touchCapture: false` to avoid conflicts.
- If you start with `touchCapture: false`, this SDK deliberately does not patch `AppRegistry`. If another library registers a wrapper provider during that disabled window and you later re-enable touch capture, hCaptcha cannot recover that earlier provider automatically. If you may toggle touch capture on later, initialize hCaptcha first or keep `touchCapture` enabled from the start.
- Navigation capture is only automatic when you register a React Navigation container ref through `initJourneyTracking({ navigationContainerRef })` or `registerJourneyNavigationContainer(ref)`.
- `userJourney={true}` controls whether the current buffered journey is attached to that captcha's verification request. It also enables automatic touch capture by default unless you disable that with `initJourneyTracking({ touchCapture: false })`.
- The journey buffer is app-global and shared across captcha instances in the same process. This is intentional for the single-app, single-user case.
- `ConfirmHcaptcha.stopEvents()` clears the shared buffered journey and detaches that `ConfirmHcaptcha` instance from journey attachment until you explicitly reconfigure it, for example by toggling `userJourney` off and back on.
- Global journey capture can continue after `stopEvents()` if journey tracking was initialized, so later app events may still accumulate in the shared buffer for other consumers.
- Successful verification clears the buffered journey. Error and cancel flows do not.
- Automatic control identifiers are best-effort and prefer non-content metadata like `nativeID`, `testID`, and `accessibilityLabel`. If none are available, events may fall back to native view tags or `"unknown"`.

## MFA Phone Support

The SDK supports phone prefix and phone number parameters for MFA (Multi-Factor Authentication) flows. You can pass these parameters as props:

```js
// Using phone prefix (country code without '+')
<ConfirmHcaptcha
  siteKey="your-site-key"
  phonePrefix="44"
  onMessage={onMessage}
/>

// Using phone number (full E.164 format)
<ConfirmHcaptcha
  siteKey="your-site-key"
  phoneNumber="+44123456789"
  onMessage={onMessage}
/>
```

For new code, prefer:

```js
<ConfirmHcaptcha
  siteKey="your-site-key"
  baseUrl="https://hcaptcha.com"
  verifyParams={{
    phonePrefix: '44',
    phoneNumber: '+44123456789',
  }}
  onMessage={onMessage}
/>
```

## Properties

| **Name** | **Type** | **Description** |
|:---|:---|:---|
| siteKey _(required)_ | string | The hCaptcha siteKey |
| size | string | The size of the widget, can be 'invisible', 'compact' or 'normal'. `checkbox` is also accepted as a legacy alias for `normal`. Default: 'invisible' |
| onMessage | Function (see [here](https://github.com/react-native-webview/react-native-webview/blob/master/src/WebViewTypes.ts#L299)) | Required. Runs after receiving a response, error, or when user cancels. |
| languageCode | string | Default language for hCaptcha; overrides phone defaults. A complete list of supported languages and their codes can be found [here](https://docs.hcaptcha.com/languages/) |
| showLoading | boolean | Whether to show a loading indicator while the hCaptcha web content loads |
| closableLoading | boolean | Allow user to cancel hcaptcha during loading by touch loader overlay |
| loadingIndicatorColor | string | Color of the ActivityIndicator |
| backgroundColor | string | The background color code that will be applied to the main HTML element |
| theme | string\|object | The theme can be 'light', 'dark', 'contrast' or a custom theme object (see Enterprise docs) |
| rqdata | string | **Deprecated**: Use `rqdata` in `HCaptchaVerifyParams` instead. Will be removed in future releases. See Enterprise docs. |
| verifyParams | object | Verification payload overrides passed to `hcaptcha.setData(...)` immediately before verification. Supports `rqdata`, `phonePrefix`, and `phoneNumber`. |
| userJourney | boolean | When `true`, attaches the current shared journey buffer to the verification payload as `userjourney`. It also enables automatic touch capture by default while a `userJourney` captcha instance is mounted. Use `initJourneyTracking({ touchCapture: false })` to keep User Journeys enabled without automatic touch capture. |
| sentry | boolean | sentry error reporting (see Enterprise docs) |
| jsSrc | string | The url of api.js. Default: https://js.hcaptcha.com/1/api.js (Override only if using first-party hosting feature.) |
| endpoint | string | Point hCaptcha JS Ajax Requests to alternative API Endpoint. Default: https://api.hcaptcha.com (Override only if using first-party hosting feature.) |
| reportapi | string | Point hCaptcha Bug Reporting Request to alternative API Endpoint. Default: https://accounts.hcaptcha.com (Override only if using first-party hosting feature.) |
| assethost | string | Points loaded hCaptcha assets to a user defined asset location, used for proxies. Default: https://newassets.hcaptcha.com (Override only if using first-party hosting feature.) |
| imghost | string | Points loaded hCaptcha challenge images to a user defined image location, used for proxies. Default: https://imgs.hcaptcha.com (Override only if using first-party hosting feature.) |
| host | string | hCaptcha SDK host identifier. null value means that it will be generated by SDK |
| url _(inline component only)_ | string | The url domain defined on your hCaptcha. You generally will not need to change this. |
| style _(inline component only)_ | ViewStyle (see [here](https://reactnative.dev/docs/view-style-props)) | The webview style |
| baseUrl _(modal component only)_ | string | The url domain defined on your hCaptcha. You generally will not need to change this. |
| passiveSiteKey _(modal component only)_ | boolean | Indicates whether the passive mode is enabled; when true, the modal won't be shown at all |
| hasBackdrop _(modal component only)_ | boolean | Defines if the modal backdrop is shown (true by default). If `hasBackdrop=false`, `backgroundColor` will apply only after the hCaptcha visual challenge is presented. |
| orientation | string | This specifies the "orientation" of the challenge. It can be `portrait`, `landscape`. Default: `portrait` |
| phonePrefix | string | Optional phone country calling code (without '+'), e.g., "44". Used in MFA flows. |
| phoneNumber | string | Optional full phone number in E.164 format ("+44123..."), for use in MFA. |

## Journey API

### `initJourneyTracking(options?)`

Installs automatic journey collection once for the app process.

Options:

- `navigationContainerRef`: optional React Navigation container ref to register immediately
- `touchCapture`: optional boolean, defaults to `true`. When `false`, keeps User Journeys enabled but disables automatic app-wide touch capture
- `debug`: optional boolean to log emitted journey events to `console.debug`
- `onStats`: optional callback for runtime diagnostics in tests or app instrumentation

### `registerJourneyNavigationContainer(ref)`

Registers or replaces the React Navigation container used for automatic screen tracking.

### `ConfirmHcaptcha.stopEvents()`

Clears the current shared journey buffer and detaches that `ConfirmHcaptcha` instance from journey attachment until it is explicitly reconfigured. A simple way to re-enable it is to toggle `userJourney` off and back on.


## Status

Fully functional, but additional releases will be made in the near term.

Changes within the same major release are expected to be additive, i.e. non-breaking.

## License

MIT License. (C) 2021 hCaptcha.

Credits: Originally forked from xuho and filipepiresg's Google reCAPTCHA v2 work. (MIT license)
