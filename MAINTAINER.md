### Release steps

1. Pick the right version number:

**Note:** we use [SemVer format](https://semver.org/):

MAJOR: breaking change.
MINOR: new feature(s), backwards compatible.
PATCH: bugfix only.

2. Prepare a PR:

- bump [`package.json's`](./package.json) version
- run `npm i` to update `package-lock.json`
- commit `package.json` and `package-lock.json`
- open the PR for review
- once the PR is approved and merged to master:
 - set the tag on master matching your version: git tag `vM.M.P`
 - draft a new release https://github.com/hCaptcha/react-native-hcaptcha/releases
- once the release is created, CI will release the new version to https://www.npmjs.com/package/@hcaptcha/react-native-hcaptcha?activeTab=versions

### Generate test app

For `expo` test app

- `cd react-native-hcaptcha`
- `yarn example --expo
- `yarn android` or `npm run android`

For `react-native` test app

- `cd react-native-hcaptcha`
- `yarn example`
- `yarn android` or `npm run android`

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

Solution: `yarn add ../react-native-hcaptcha`

Yarn 2.10.x and above doesn't require `file:` scheme prefix https://stackoverflow.com/questions/40102686/how-to-install-package-with-local-path-by-yarn-it-couldnt-find-package