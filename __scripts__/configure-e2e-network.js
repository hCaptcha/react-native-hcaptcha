const fs = require('fs');
const path = require('path');

module.exports = (host) => {
  // Keep the disposable harness off the common Docker/Metro port.
  for (const file of [
    '@react-native-harness/cli/dist/bundlers/metro.js',
    '@react-native-harness/cli/dist/platforms/android/index.js',
    '@react-native-harness/bundler-metro/dist/constants.js',
    '@react-native-harness/platform-android/dist/runner.js',
  ]) {
    const target = path.join(host, 'node_modules', file);
    if (fs.existsSync(target)) {
      fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(/\b8081\b/g, '18081'));
    }
  }
  const swiftPath = path.join(host, 'ios/react_native_hcaptcha_example/AppDelegate.swift');
  if (fs.existsSync(swiftPath)) {
    let swift = fs.readFileSync(swiftPath, 'utf8').replace('127.0.0.1:8081', '127.0.0.1:18081');
    if (!swift.includes('HCAPTCHA_E2E_NETWORK')) {
      swift = swift.replace('import UIKit', 'import UIKit\nimport Network\nimport WebKit');
      swift = swift.replace('    let delegate = ReactNativeDelegate()', `    if #available(iOS 17.0, *), ProcessInfo.processInfo.environment["HCAPTCHA_E2E_NETWORK"] == "1" {
      var proxy = ProxyConfiguration(httpCONNECTProxy: .hostPort(host: "127.0.0.1", port: 8766))
      proxy.excludedDomains = ["127.0.0.1", "localhost"]
      WKWebsiteDataStore.default().proxyConfigurations = [proxy]
    }
    let delegate = ReactNativeDelegate()`);
    }
    fs.writeFileSync(swiftPath, swift);
  }
  const kotlinPath = path.join(host, 'android/app/src/main/java/com/react_native_hcaptcha_example/MainApplication.kt');
  const gradlePath = path.join(host, 'android/app/build.gradle');
  const gradle = fs.readFileSync(gradlePath, 'utf8');
  if (!gradle.includes('androidx.webkit:webkit')) {
    const webviewProps = fs.readFileSync(path.join(host, 'node_modules/react-native-webview/android/gradle.properties'), 'utf8');
    const version = webviewProps.match(/ReactNativeWebView_webkitVersion=(.+)/)[1];
    fs.writeFileSync(gradlePath, gradle.replace('dependencies {', `dependencies {\n    implementation("androidx.webkit:webkit:${version}")`));
  }
  fs.rmSync(path.join(host, 'android/app/src/main/res/values/harness-port.xml'), { force: true });
  const propertiesPath = path.join(host, 'android/gradle.properties');
  const properties = fs.readFileSync(propertiesPath, 'utf8');
  if (!properties.includes('reactNativeDevServerPort=')) {
    fs.appendFileSync(propertiesPath, '\nreactNativeDevServerPort=18081\n');
  }
  let kotlin = fs.readFileSync(kotlinPath, 'utf8');
  if (!kotlin.includes('hcaptcha-network-proxy')) {
    kotlin = kotlin.replace('import android.app.Application', `import android.app.Application
import androidx.core.content.ContextCompat
import androidx.webkit.ProxyConfig
import androidx.webkit.ProxyController
import java.io.File
import java.net.HttpURLConnection
import java.net.URL`);
    kotlin = kotlin.replace('    loadReactNative(this)', `    loadReactNative(this)
    if (File(filesDir, "hcaptcha-network-proxy").exists()) {
      ProxyController.getInstance().setProxyOverride(
        ProxyConfig.Builder().addProxyRule("127.0.0.1:8766").build(),
        ContextCompat.getMainExecutor(this),
      ) {
        Thread {
          val connection = URL("http://127.0.0.1:8766/proxy-ready").openConnection() as HttpURLConnection
          connection.requestMethod = "POST"
          connection.inputStream.close()
          connection.disconnect()
        }.start()
      }
    }`);
    fs.writeFileSync(kotlinPath, kotlin);
  }
};
