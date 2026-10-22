const { fork, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const host = path.join(root, '__e2e__', 'host');
const platform = process.argv[2];
const networkTest = process.argv.includes('jest.network.config.mjs');
if (networkTest) {
  process.env.SIMCTL_CHILD_HCAPTCHA_E2E_NETWORK = '1';
}
if (process.argv.includes('jest.perf.config.mjs') || networkTest) {
  process.env.HARNESS_BRIDGE_TIMEOUT ||= '600000';
}
if (!['android', 'ios'].includes(platform)) {
  throw new Error('Expected android or ios');
}

// Refresh JS without regenerating or rebuilding the native test host.
for (const file of ['Hcaptcha.js', 'index.js', 'md5.js', 'package.json', 'journey']) {
  fs.cpSync(path.join(root, file), path.join(host, 'react-native-hcaptcha', file), { recursive: true });
}
for (const file of fs.readdirSync(path.join(root, '__e2e__'))) {
  if (
    (file.endsWith('.js') && !['auth-server.js', 'native-metrics.js', 'network-proxy.js'].includes(file)) ||
    ['jest.perf.config.mjs', 'jest.network.config.mjs', 'rn-harness.config.mjs'].includes(file)
  ) {
    const destination = file.endsWith('.mjs') ? host : path.join(host, '__e2e__');
    fs.copyFileSync(path.join(root, '__e2e__', file), path.join(destination, file));
  }
}

const backend = fork(path.join(root, '__e2e__', 'auth-server.js'), [], {
  env: { ...process.env, HCAPTCHA_E2E_PLATFORM: platform },
});
let child;
const run = (command, args, cwd = root) =>
  new Promise((resolve, reject) => {
    child = spawn(command, args, { cwd, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))
    );
  });
process.on('exit', () => backend.kill());
process.once('SIGINT', () => {
  child?.kill('SIGINT');
  process.exit(130);
});
process.once('SIGTERM', () => {
  child?.kill('SIGTERM');
  process.exit(143);
});

(async () => {
  try {
    await new Promise((resolve, reject) => {
      backend.once('message', resolve);
      backend.once('error', reject);
      backend.once('exit', (code) => reject(new Error(`E2E backend exited with ${code}`)));
    });
    await run('npm', ['run', `test:e2e:install:${platform}`]);
    if (platform === 'android') {
      await run('adb', ['reverse', 'tcp:8766', 'tcp:8766']);
      await run('adb', ['shell', 'run-as', 'com.react_native_hcaptcha_example', 'rm', '-f', 'files/hcaptcha-network-proxy']);
      if (networkTest) {
        await run('adb', ['shell', 'run-as', 'com.react_native_hcaptcha_example', 'touch', 'files/hcaptcha-network-proxy']);
        await run('adb', ['shell', 'am', 'force-stop', 'com.react_native_hcaptcha_example']);
      }
    } else if (networkTest) {
      await run('xcrun', ['simctl', 'terminate', 'booted', 'org.reactjs.native.example.react-native-hcaptcha-example']).catch(() => {});
    }
    await run(
      process.execPath,
      [
        path.join(host, 'node_modules', 'react-native-harness', 'bin.js'),
        '--harnessRunner',
        platform,
        ...process.argv.slice(3),
      ],
      host
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (networkTest && platform === 'android') {
      await run('adb', ['shell', 'run-as', 'com.react_native_hcaptcha_example', 'rm', '-f', 'files/hcaptcha-network-proxy']);
      await run('adb', ['shell', 'am', 'force-stop', 'com.react_native_hcaptcha_example']);
    } else if (networkTest) {
      await run('xcrun', ['simctl', 'terminate', 'booted', 'org.reactjs.native.example.react-native-hcaptcha-example']).catch(() => {});
    }
    backend.kill();
  }
})();
