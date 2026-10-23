# Upgrading from v4.1 to v5.0

Install v5 with `npm install @hcaptcha/react-native-hcaptcha@^5.0.0` or `yarn add @hcaptcha/react-native-hcaptcha@^5.0.0`.

`prewarm` defaults to `false`. Existing `ConfirmHcaptcha` integrations still mount on `show()` and unmount on `hide()`, using a native `Modal` unless `passiveSiteKey` is enabled. Prewarming requires an explicit opt-in. The shared lifecycle fixes below also apply without prewarming.

## Behavior shared by both modes

| Area | v4.1 | v5.0 and migration |
| --- | --- | --- |
| Legacy verification props | Changing top-level `rqdata`, `phonePrefix`, or `phoneNumber` changes the HTML source and reloads the SDK. | Preserved, including with `prewarm`. These fields remain serialized into the HTML. Keep them stable or move changing values to `verifyParams`. |
| `verifyParams` | Overrides legacy values when building the verification payload. | Preserved. Changes do not reload the SDK or start verification. The payload is read immediately before each execution; changes after dispatch apply to a later attempt. Even overridden legacy props still reload the SDK if they change. |
| Document replacement | Callbacks could survive a config change and become valid again after config A→B→A. | Config/source changes remount the WebView. Retired callbacks are ignored permanently. Pending verification waits for readiness of the replacement document. Without prewarm, each replacement document still automatically verifies, including after a completed token. With prewarm, replacement does not create a new request after completion. Do not depend on results from a retired document. |
| Loading deadline | Replacing `onMessage` restarted the 15-second timer, allowing repeated renders to postpone a timeout indefinitely. | Each document/load attempt has a 15-second deadline independent of callback changes. Timeout hides the loading indicator and sends `{ nativeEvent: { data: 'error', description: 'loading timeout' } }`. Keep timeout handling active during form edits. |
| Renderer termination | No automatic native renderer recovery. | iOS content-process termination and Android renderer loss recreate the WebView. An outstanding request resumes after readiness; old document callbacks are ignored. Recovery may repeat SDK execution for that request. |
| Repeated SDK readiness | Each readiness notification could start verification. | Duplicate readiness notifications for the same document are ignored. Use the public execution/retry methods to request another attempt. |
| Token expiry | Multiple received tokens could leave multiple expiry timers; timers captured the callback from token receipt. | One outstanding token-expiry timer per mounted instance. A newer token supersedes the old timer. Expiry uses the latest `onMessage` callback. Replace held token state when a new token arrives. |
| `markUsed()` | A token event exposes a function to suppress its 120-second expiry notification. | Preserved and bound to that token's timer. Calling an older token's `markUsed()` does not suppress a newer token's expiry. This acknowledges local consumption; it does not verify, invalidate, or extend a token on the server. |
| Retained `event.reset()` | Retained callbacks could inject old props and journey data or execute before a replacement document was ready. | Ordinary retry hooks use current props/journey data and wait for readiness. A retained token event is not a snapshot of the next attempt's payload. The `script-error` hook specifically retries SDK loading. |
| Native event objects | The wrapper decorated the native event object, including pooled events. | The wrapper copies the event and `nativeEvent` before adding public helpers. Do not rely on native-event object identity or custom fields leaking between events. Read `nativeEvent.data`, `success`, `reset`, and `markUsed` from the delivered event. |

Initialization props still replace the document: site key, URL/base URL, SDK source/endpoints, language, theme, size, orientation, background color, and debug config. Keep them stable while an attempt is active. The prewarm flag also changes document identity; configure it for the component's lifetime. Unmount/remount or changing `prewarm` requires the app to discard any held token and event hooks. In particular, leaving prewarm mode clears its existing token timer, and entering the default mount path can start automatic verification.

Without prewarm, a loading timeout still permits a pending verification to finish if initialization later succeeds. Token-expiry callbacks can still fire after the default component unmounts, as in v4.1. Applications using that lifecycle must retain a suitable handler or call the token's `markUsed()` when consumed.

## Opt-in prewarm contract

| Operation | Behavior |
| --- | --- |
| Mount with `prewarm` | Load the WebView and SDK immediately without fetching a token. Initialization errors can reach `onMessage` before `show()`/`execute()`. SDK readiness is internal and is not a public `onMessage` event. |
| `ConfirmHcaptcha.show()` / `.execute()` | Equivalent methods returning `void`, not promises. Show the overlay unless passive and request verification. Calls before readiness queue one request; repeated calls while that request is pending do not create another execution. A call after completion requests a new token. |
| `ConfirmHcaptcha.hide()` | Hide the overlay and cancel pending verification while retaining the WebView. Late tokens/errors from cancelled attempts cannot complete a later request. Calling `hide()` without a source remains silent; backdrop/back-button dismissal emits `cancel`. |
| `ConfirmHcaptcha.destroy()` / `Hcaptcha.destroy()` | Silently cancel verification and loading/token-expiry timers and unmount the native WebView. Safe to repeat, including while loading, verifying, hidden, or holding a token. Prop changes do not recreate it. The next wrapper `show()`/`execute()` or inline `execute()` recreates the WebView and queues verification. Retained `event.reset()` hooks become inert; inline `reset()` does not recreate it. Journey consumers detach until recreation. Works with and without prewarm. |
| Presentation | A persistent app-level overlay replaces the native `Modal` in prewarm mode. Mount it after navigation/content in a full-screen root `View`. It covers its parent, has no native modal fade transition, and cannot appear above another native `Modal`. Hidden/passive views do not intercept touches or appear in accessibility traversal. |
| `passiveSiteKey` | Keeps verification hidden. Switching presentation while prewarm remains enabled preserves the WebView and any held token's original expiry deadline. It does not start another verification after a token has been delivered. |
| Loading timeout | Cancel queued verification after 15 seconds. Initialization may still finish, but cannot fulfill that cancelled request. Call `execute()` again to retry. A retry of a timed-out document recreates the WebView. |
| Delayed token submission | The latest token expires locally 120 seconds after receipt, including while hidden. Retain the token with its `markUsed` callback, submit it with the form, and acknowledge consumption. Discard it and execute again for a new backend attempt or after expiry. |
| Unmount | Release the warmed WebView and cancel its token-expiry timer. Do not expect an expiry notification after unmount in prewarm mode. Keeping it mounted retains WebView/SDK memory unless `destroy()` is called. OS/runtime memory caches may outlive the native view. |
| SDK result delivery | Prewarm uses `hcaptcha.execute(widgetId, { async: true })` and filters results by execution ownership. Public token/error data remain strings; internal request envelopes are decoded before `onMessage`. A custom `jsSrc` or SDK test double must support this promise API, resolving `{ response: token }` or rejecting an error string. |

`open` still has `success === true`; it is not a token. Use `event.markUsed` to identify token events, or handle `open` before testing `success`. The existing `expired`, SDK error, `challenge-closed`, and wrapper `cancel` messages remain part of error/cancellation handling.

## Migration steps

1. Upgrade the package and review the shared changes above, even if leaving `prewarm` disabled. Remove assumptions about duplicate expiry notifications, stale callbacks, native event identity, or callback changes extending loading deadlines.
2. Move changing verification data into `verifyParams`. Remove the corresponding changing top-level props; passing both still permits the legacy props to reload the document.

   ```jsx
   // v4-compatible legacy props: changes reload the SDK, also in v5.
   <ConfirmHcaptcha rqdata={rqdata} phonePrefix={prefix} phoneNumber={phone} />

   // Use this for a prewarmed flow with changing verification data.
   <ConfirmHcaptcha
     verifyParams={{ rqdata, phonePrefix: prefix, phoneNumber: phone }}
   />
   ```

   Both forms retain the same payload mapping: `rqdata`, `mfa_phoneprefix`, and `mfa_phone`. `verifyParams` retains precedence. Commit the desired props before calling `execute()`; updating payload props does not restart an already dispatched request. If the app intentionally needs a full reload, remount the captcha with a new React `key` and start verification after the new ref mounts.

3. To enable prewarm, mount one `ConfirmHcaptcha prewarm` at the app root and keep it mounted across screens. Use a stable `prewarm` value. Call `execute()` when the verification screen loads; existing `show()` callers can remain unchanged. Call `destroy()` when finished to release its WebView without losing the ref. A later execute reloads the SDK. If retaining a token after destruction, track its expiry yourself: destruction stops local expiry notifications but does not revoke the token. Handle initialization errors from app startup. See the [multi-step example](README.md#prewarming-a-multi-step-flow).
4. Store each token and its own `markUsed` callback together. Clear that record on expiry, cancellation, a new attempt, or unmount. Use a fresh token for a retry after the backend has consumed the previous token, including rejected credentials. `markUsed()` only suppresses the local expiry notification; backend verification remains required.
5. Distinguish cancellation from retry. On the wrapper, `hide()` cancels; ordinary `event.reset()` retries verification with current data. On inline `Hcaptcha`, `ref.current.reset()` cancels/resets without executing, while `ref.current.execute()` verifies. After an idle `script-error`, its `event.reset()` reloads the SDK; explicitly execute if no request was pending.

The inline `Hcaptcha` export now supports an imperative ref with `execute()`, `reset()`, and `destroy()` and accepts `prewarm`. It does not manage an overlay; its parent controls layout/visibility. Without prewarm, inline mounting still requests verification automatically. After explicit destruction, prop updates alone never restart it; call `execute()`.
