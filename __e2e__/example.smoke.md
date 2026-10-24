# Original example smoke test

`example.harness.js` mounts the repository's `Example.App.js` on real native hosts. The example's only changes are test IDs on its existing launch control and status text. SDK loading, WebView messages, token handling, `hide()`, and `markUsed()` use the real components.

Both Android 13 and iOS 26 passed two cases, each with two launches:

| Case | Checks |
| --- | --- |
| Original demo sitekey | Press the original launch control, observe `open`, capture the rendered challenge, dismiss, assert the displayed status, and launch again. Android uses the system Back action (`cancel`); iOS taps outside the challenge (`challenge-closed`). |
| Public auto-pass sitekey | Generate a copy of the example with only its sitekey changed. Receive and display a token, run the original hide/mark-used handler, verify the returned token through the backend's real `siteverify` call, and launch again. Both tokens verify successfully. |

No SDK, WebView, or event callbacks are mocked. A console spy observes the original event handler; native UI queries confirm that its status is rendered. Screenshots were inspected on both platforms. Visual puzzles are opened and dismissed, not solved; completed verification uses hCaptcha's public integration-test key and secret.

The tests wait 500 ms after dismissal for the default native Modal fade-out. Initial immediate-reopen probes hit that animation; the settled UI flow passes. Android uses software rendering after the host-GPU emulator produced black captures. These are functional checks, not performance measurements or rapid-reopen stress tests.

Run after creating/building the native host:

```sh
npm run test:e2e:android -- --testPathPattern example.harness
npm run test:e2e:ios -- --testPathPattern example.harness
```

Results: `output/hcaptcha-original-example-{android,ios}.log`.
Challenge captures: `output/example-{android,ios}.png`.
Token/status captures: `output/example-token-{android,ios}.png`.
