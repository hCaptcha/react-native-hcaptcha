### Release steps

1. Pick the right version number:

**Note:** we use [SemVer format](https://semver.org/):

MAJOR: breaking change.
MINOR: new feature(s), backwards compatible.
PATCH: bugfix only.

2. Prepare a PR:

- bump [`package.json's`](./package.json) version
- run `npm i` to update `package-lock.json`
- update debug strings in tests, e.g. replace sdk_3_0_0 with sdk_3_0_1
- update [`MAINTAINER.md`](./MAINTAINER.md) if release or verification steps changed
- verify:
  - `npm test`
  - `npm run lint`
  - `npm run test:e2e:android` on a booted Android emulator
  - `npm run test:e2e:ios` on a booted iOS simulator
- commit `package.json` and `package-lock.json`
- commit any maintainer or release-documentation updates in the same PR
- open the PR for review
- once the PR is approved and merged to master:
 - set the tag on master matching your version: `git tag vM.m.p`
 - push the tag: `git push origin vM.m.p`
 - draft a new release https://github.com/hCaptcha/react-native-hcaptcha/releases
 - summarize functional changes in the release notes, including:
   - safer WebView config handling for HTML-facing props
   - `ConfirmHcaptcha` forwarding of `phonePrefix` and `phoneNumber`
   - `checkbox` size alias normalization to `normal`
   - expanded unit coverage and local Android theme E2E coverage
- once the release is created, CI will release the new version to https://www.npmjs.com/package/@hcaptcha/react-native-hcaptcha?activeTab=versions

3. Post-release verification:

- confirm the GitHub release published successfully
- confirm npm lists the new version:
  - `npm view @hcaptcha/react-native-hcaptcha version`
- smoke-test install in a disposable app if the release changed packaging or generated assets

### Generate test app

For `expo` test app

- `cd react-native-hcaptcha`
- `yarn example --expo
- `yarn android` or `npm run android`

For `react-native` test app

- `cd react-native-hcaptcha`
- `yarn example`
- `yarn android` or `npm run android`

For native E2E, generate and build the host once with `npm run test:e2e:setup` (requires Node 22.11+, Android SDK, and Xcode/CocoaPods for iOS). Use `-- --platform android` or `-- --platform ios` to build one platform. Setup recreates `__e2e__/host`.

Boot the selected device, then run the prewarm suites:

```sh
HARNESS_AVD_NAME=Medium_Phone npm run test:e2e:android -- --testPathPattern 'authFlow|prewarm'
HARNESS_IOS_DEVICE='iPhone 17 Pro' HARNESS_IOS_VERSION=26.0 npm run test:e2e:ios -- --testPathPattern 'authFlow|prewarm'
```

Use the names and runtime versions installed locally. The runner refreshes the host's JS, installs the existing native binary, starts a disposable backend on `127.0.0.1:8766`, forwards that port on Android, and stops the backend on exit. The generated host and harness use Metro port `18081`, avoiding the common Docker/Metro port. Run platforms sequentially because they share backend state. The live suites require internet access.

`__e2e__/PrewarmAuthApp.js` is a three-screen signup/login app: email entry, credentials, and account confirmation. It keeps one captcha mounted at the root, executes on the credentials screen, stores a token snapshot while the user edits, submits it to the backend, then logs out and repeats login using the same WebView. The backend redirects `/1/api.js` to the live SDK and verifies tokens through hCaptcha's `siteverify` API using its public test secret. The local base URL avoids mixed-content restrictions in WKWebView.

The suites cover visible/passive presentation, one SDK load across both auth attempts, delayed submission, successful server verification, cancellation before SDK readiness, and retry after rejected credentials. Public test keys auto-pass; visual challenge solving is outside these tests. `prewarm.harness.js` separately uses an SDK fixture to assert native widget reuse, payload updates without a reload, and document replacement after a theme change.

The bridge copies pooled native events before attaching token hooks, preventing a previous token's `markUsed` from leaking onto an `open` or error event. Keep cached tokens as `{ token: event.nativeEvent.data, markUsed: event.markUsed }` and discard them after backend consumption, including rejected credentials.

For latency and stall profiling on the same booted devices:

```sh
HARNESS_AVD_NAME=Medium_Phone npm run test:e2e:perf:android
HARNESS_IOS_DEVICE='iPhone 17 Pro' HARNESS_IOS_VERSION=26.0 npm run test:e2e:perf:ios
```

The profile alternates five cold and five prewarmed screen-2 executions, runs 30 signup/login cycles in one warm WebView, checks idle JS frames and memory, holds an SDK request through its loading timeout, and deliberately terminates the test renderer to verify recovery. A small observer wraps the live SDK's `render()` to detect readiness; it does not replace token generation or server verification. These longer suites run serially with a ten-minute bridge deadline.

`--testPathPattern prewarmEdges` selects lifecycle tests: actual app background/resume, 125-second token expiry, expiry while an auth response is held, navigation away during submission, cancellation after the live SDK produces a token, renderer termination during pending verification, and switching prewarm/presentation modes with a pending request. The deferred-token observer holds the SDK's real callback for ten seconds to expose cancellation and renderer races. iOS renderer fault injection terminates WebContent processes belonging to the disposable harness simulator, including any retained by Safari during background tests.

Results are written to `output/prewarm-perf-android.json` and `output/prewarm-perf-ios.json`. Frame gaps measure the React Native JS thread; Android additionally records cumulative native rendering stats. Android memory is summed PSS; iOS memory is summed RSS for the app and its simulator WebKit processes, so the totals are not directly comparable. Debug emulators and public test keys do not establish production device frame rates, challenge latency, battery use, or long-term leak freedom.

For transport failures, rebuild the generated host with the network hooks, then run:

```sh
HARNESS_AVD_NAME=Medium_Phone npm run test:e2e:network:android
HARNESS_IOS_DEVICE='iPhone 17 Pro' HARNESS_IOS_VERSION=26.0 npm run test:e2e:network:ios
```

These four cases cover offline prewarm, execute queued while offline, and interrupted challenge execution plus background/resume in both presentation modes. An app-scoped WebView proxy closes existing TLS connections and rejects new connections; it does not decrypt TLS, replace the SDK, change host networking, or simulate OS reachability events. The harness/control backend stays connected. Network tests are excluded from performance profiles so proxy overhead cannot affect their measurements.

The execution cases use the public key from `https://accounts.hcaptcha.com/demo`, assert `network-error`, restore transport, and reopen a challenge in the same warmed SDK. No visual challenge is solved. They finish backend verification using the public auto-pass test key. Recovered visible challenge screenshots are saved as `output/prewarm-network-{android,ios}.png`; Android uses compositor capture because software View snapshots can omit accelerated canvas content. The iOS proxy hook requires iOS 17+ and is enabled only for the network runner. Android's app-private flag is removed after the run and before normal runs.

For iOS instead the last step do:

- `pushd ios; env USE_HERMES=0 pod install; popd`
- `yarn ios` or `npm run ios`

### Known issues

Problem:
```
Error: Unable to resolve module @hcaptcha/react-native-hcaptcha from App.js: @hcaptcha/react-native-hcaptcha could not be found within the project or in these directories:
  node_modules
```

Solution:

NPM cannot correctly install local moduels. Check
https://github.com/facebook/react-native/issues/29977 for more details use `yarn`

---

Problem:

`yarn` starts but never finishes during last module install like this
```
...
[2/4] 🚚  Fetching packages...
[#####################################################################] 943/944
```

Solution:

Never create example project inside `react-native-hcaptcha` because it will copy recursively `react-native-hcaptcha` inside examples' `node_modules`

---

Problem:

```
...
* What went wrong:
A problem occurred evaluating project ':unimodules_react-native-adapter'.
> Project with path ':unimodules-core' could not be found in project ':unimodules_react-native-adapter'.
```

Solution: https://github.com/unimodules/react-native-unimodules/issues/156

---

Problem:

```
...
Starting a Gradle Daemon (subsequent builds will be faster)
java.lang.NoClassDefFoundError: Could not initialize class org.codehaus.groovy.vmplugin.v7.Java7
```

Solution: make sure that you use Java 1.8 or above

---

Problem:

Gradle finished with error:
```
...
* What went wrong:
Could not initialize class org.codehaus.groovy.runtime.InvokerHelper
```

Solution: modify `./android/gradle/wrapper/gradle-wrapper.properties` and update gradle version in `distributionUrl` property

Problem:

Gradle finished with error:

```
...
> No toolchains found in the NDK toolchains folder for ABI with prefix: arm-linux-androideabi
```

Solution: updade `com.android.tools.build:gradle` version in `./android/build.gradle`

---

Problem:

Infinite error logs like:

```
WARN     Sending `didSendNetworkData` with no listeners registered.
WARN     Sending `didReceiveNetworkResponse` with no listeners registered.
WARN     Sending `didReceiveNetworkData` with no listeners registered.
WARN     Sending `didCompleteNetworkResponse` with no listeners registered.
ERROR    Invariant Violation: No callback found with cbID xxxxx and callID yyyyy for module <unknown>. Args: '[zzzz]'

```

Solution: delete `node_modules` in `react-native-hcaptcha`.

This issue is related to mismatched `react-native` versions in the test app vs. `react-native-hcaptcha`

---

Problem:

Xcode failed to build with:

> ...
> Framework 'hermes' not found

Solution: `env USE_HERMES=0 pod install` or add `:hermes_enabled => false` into `use_react_native!` call in `ios/Podfile`

---

Problem:
```
> yarn add file:../react-native-hcaptcha
Usage Error: The file:../react-native-hcaptcha string didn't match the required format (package-name@range). Did you perhaps forget to explicitly reference the package name?
```

Solution: `yarn add @hcaptcha/react-native-hcaptcha@file:../react-native-hcaptcha`

Yarn 2.10.x and above doesn't require `file:` scheme prefix https://stackoverflow.com/questions/40102686/how-to-install-package-with-local-path-by-yarn-it-couldnt-find-package
