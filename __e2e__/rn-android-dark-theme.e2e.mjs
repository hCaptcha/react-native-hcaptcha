import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'output', 'android-e2e');
const fixtureAppDir = process.env.HCAPTCHA_E2E_APP_DIR || path.join(os.tmpdir(), 'react-native-hcaptcha-android-e2e');
const fixtureAppName = 'RNHcaptchaE2E';
const fixturePackageName = 'com.hcaptcha.rne2e';
const metroPort = process.env.RCT_METRO_PORT || '8088';
const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || path.join(os.homedir(), 'Library', 'Android', 'sdk');
const adbPath = path.join(sdkRoot, 'platform-tools', 'adb');
const emulatorPath = path.join(sdkRoot, 'emulator', 'emulator');
const rnVersion = JSON.parse(await fs.readFile(path.join(repoRoot, 'node_modules', 'react-native', 'package.json'), 'utf8')).version;
const cliVersion = process.env.HCAPTCHA_E2E_CLI_VERSION || '20.1.2';
const preferredAvd = process.env.HCAPTCHA_E2E_AVD || 'Medium_Phone';
const screenshotPath = path.join(outputDir, 'android-dark-theme.png');
const metroLogPath = path.join(outputDir, 'metro.log');
const appLogPath = path.join(outputDir, 'run-android.log');

const fixtureAppSource = `import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Hcaptcha from '@hcaptcha/react-native-hcaptcha/Hcaptcha';

const siteKey = '10000000-ffff-ffff-ffff-000000000001';
const baseUrl = 'https://hcaptcha.com';

const WidgetCard = ({ label, theme }) => (
  <View style={styles.card}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.widgetFrame}>
      <Hcaptcha
        siteKey={siteKey}
        size="normal"
        theme={theme}
        url={baseUrl}
        style={styles.widget}
        onMessage={() => {}}
      />
    </View>
  </View>
);

const App = () => (
  <SafeAreaView style={styles.screen}>
    <Text style={styles.title}>RN hCaptcha theme e2e</Text>
    <WidgetCard label="Light theme" theme="light" />
    <WidgetCard label="Dark theme" theme="dark" />
  </SafeAreaView>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 16,
    gap: 24,
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  card: {
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  widgetFrame: {
    width: '100%',
    maxWidth: 360,
    height: 118,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  widget: {
    flex: 1,
    height: '100%',
  },
});

export default App;
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureFile = async (targetPath) => {
  try {
    await fs.access(targetPath);
  } catch (_) {
    throw new Error(`Required tool not found: ${targetPath}`);
  }
};

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.stdio || 'inherit',
      shell: false,
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdoutChunks.push(Buffer.from(chunk));
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderrChunks.push(Buffer.from(chunk));
      });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      const stdoutBuffer = Buffer.concat(stdoutChunks);
      const stderrBuffer = Buffer.concat(stderrChunks);
      const stdout = options.binary ? stdoutBuffer : stdoutBuffer.toString('utf8');
      const stderr = options.binary ? stderrBuffer : stderrBuffer.toString('utf8');

      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with code ${code}\n${stdout}\n${stderr}`));
      }
    });
  });

const startBackgroundProcess = (command, args, logFilePath, options = {}) => {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  const logChunks = [];
  const appendLog = (chunk) => {
    const text = chunk.toString();
    logChunks.push(text);
  };

  child.stdout.on('data', appendLog);
  child.stderr.on('data', appendLog);

  const flushLog = async () => {
    await fs.writeFile(logFilePath, logChunks.join(''), 'utf8');
  };

  const stop = async () => {
    if (!child.killed) {
      child.kill('SIGTERM');
      await sleep(1000);
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }
    await flushLog();
  };

  return { child, flushLog, stop };
};

const waitForPort = async (port, timeoutMs) => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const connected = await new Promise((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port: Number(port) });
      socket.once('connect', () => {
        socket.end();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
    });

    if (connected) {
      return;
    }

    await sleep(1000);
  }

  throw new Error(`Timed out waiting for localhost:${port}`);
};

const ensureFixtureApp = async () => {
  const packageJsonPath = path.join(fixtureAppDir, 'package.json');

  let needsInit = false;
  try {
    const parsed = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    if (parsed.name !== fixtureAppName) {
      needsInit = true;
    }
  } catch (_) {
    needsInit = true;
  }

  if (needsInit) {
    await fs.rm(fixtureAppDir, { recursive: true, force: true });
    await run('npx', [
      '--yes',
      `@react-native-community/cli@${cliVersion}`,
      'init',
      fixtureAppName,
      '--directory',
      fixtureAppDir,
      '--pm',
      'npm',
      '--version',
      rnVersion,
      '--skip-git-init',
      '--install-pods',
      'false',
      '--package-name',
      fixturePackageName,
    ], { cwd: repoRoot });
  }

  await fs.writeFile(path.join(fixtureAppDir, 'App.js'), fixtureAppSource, 'utf8');
  await fs.rm(path.join(fixtureAppDir, 'App.tsx'), { force: true });
  await run('npm', [
    'install',
    `@hcaptcha/react-native-hcaptcha@file:${repoRoot}`,
    'react-native-modal',
    'react-native-webview',
  ], { cwd: fixtureAppDir });
};

const adb = async (...args) => run(adbPath, args, { cwd: repoRoot, stdio: 'pipe' });

const getBootedEmulatorId = async () => {
  const { stdout } = await adb('devices');
  const emulatorLine = stdout
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('emulator-') && line.endsWith('\tdevice'));

  return emulatorLine ? emulatorLine.split('\t')[0] : null;
};

const getAvailableAvd = async () => {
  const { stdout } = await run(emulatorPath, ['-list-avds'], { cwd: repoRoot, stdio: 'pipe' });
  const avds = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (avds.includes(preferredAvd)) {
    return preferredAvd;
  }

  if (avds.length === 0) {
    throw new Error('No Android Virtual Device found. Create one before running the RN E2E test.');
  }

  return avds[0];
};

const waitForBootCompleted = async (deviceId) => {
  const started = Date.now();

  while (Date.now() - started < 240000) {
    const { stdout } = await adb('-s', deviceId, 'shell', 'getprop', 'sys.boot_completed');
    if (stdout.trim() === '1') {
      return;
    }
    await sleep(2000);
  }

  throw new Error(`Timed out waiting for Android emulator ${deviceId} to boot.`);
};

const ensureEmulator = async () => {
  const runningId = await getBootedEmulatorId();
  if (runningId) {
    return { deviceId: runningId, stop: async () => {} };
  }

  const avd = await getAvailableAvd();
  const args = ['-avd', avd, '-netfast', '-no-snapshot'];

  if (process.env.CI) {
    args.push('-no-window', '-no-audio', '-gpu', 'swiftshader_indirect', '-no-boot-anim');
  }

  const emulator = startBackgroundProcess(emulatorPath, args, path.join(outputDir, 'emulator.log'));

  let deviceId = null;
  const started = Date.now();
  while (Date.now() - started < 120000 && !deviceId) {
    deviceId = await getBootedEmulatorId();
    if (!deviceId) {
      await sleep(2000);
    }
  }

  if (!deviceId) {
    await emulator.stop();
    throw new Error('Android emulator did not appear in adb devices.');
  }

  await waitForBootCompleted(deviceId);
  await adb('-s', deviceId, 'shell', 'settings', 'put', 'global', 'window_animation_scale', '0');
  await adb('-s', deviceId, 'shell', 'settings', 'put', 'global', 'transition_animation_scale', '0');
  await adb('-s', deviceId, 'shell', 'settings', 'put', 'global', 'animator_duration_scale', '0');

  return {
    deviceId,
    stop: async () => {
      await adb('-s', deviceId, 'emu', 'kill').catch(() => {});
      await emulator.stop();
    },
  };
};

const crop = (png, leftRatio, topRatio, rightRatio, bottomRatio) => {
  const left = Math.floor(png.width * leftRatio);
  const top = Math.floor(png.height * topRatio);
  const width = Math.floor(png.width * rightRatio) - left;
  const height = Math.floor(png.height * bottomRatio) - top;
  const cropped = new PNG({ width, height });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = ((top + y) * png.width + (left + x)) * 4;
      const targetIndex = (y * width + x) * 4;
      cropped.data[targetIndex] = png.data[sourceIndex];
      cropped.data[targetIndex + 1] = png.data[sourceIndex + 1];
      cropped.data[targetIndex + 2] = png.data[sourceIndex + 2];
      cropped.data[targetIndex + 3] = png.data[sourceIndex + 3];
    }
  }

  return cropped;
};

const getAverageLuminance = (png) => {
  let total = 0;
  let count = 0;

  for (let index = 0; index < png.data.length; index += 4) {
    if (png.data[index + 3] === 0) {
      continue;
    }

    total += 0.2126 * png.data[index] + 0.7152 * png.data[index + 1] + 0.0722 * png.data[index + 2];
    count += 1;
  }

  return total / count;
};

const captureScreenshot = async (deviceId) => {
  const { stdout } = await run(adbPath, ['-s', deviceId, 'exec-out', 'screencap', '-p'], {
    cwd: repoRoot,
    stdio: 'pipe',
    binary: true,
  });
  const buffer = stdout;
  await fs.writeFile(screenshotPath, buffer);
  return PNG.sync.read(buffer);
};

const waitForThemeDifference = async (deviceId) => {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const screenshot = await captureScreenshot(deviceId);
    const lightCrop = crop(screenshot, 0.12, 0.33, 0.88, 0.40);
    const darkCrop = crop(screenshot, 0.12, 0.62, 0.88, 0.69);
    const lightLuminance = getAverageLuminance(lightCrop);
    const darkLuminance = getAverageLuminance(darkCrop);

    if (darkLuminance < lightLuminance - 25) {
      await fs.writeFile(path.join(outputDir, 'light-crop.png'), PNG.sync.write(lightCrop));
      await fs.writeFile(path.join(outputDir, 'dark-crop.png'), PNG.sync.write(darkCrop));

      return { lightLuminance, darkLuminance };
    }

    await sleep(5000);
  }

  throw new Error('Timed out waiting for the dark widget to render darker than the light widget.');
};

const runAndroidApp = async (deviceId) => {
  const env = {
    ...process.env,
    ANDROID_HOME: sdkRoot,
    ANDROID_SDK_ROOT: sdkRoot,
    RCT_METRO_PORT: metroPort,
    REACT_NATIVE_PACKAGER_HOSTNAME: '127.0.0.1',
  };

  return run('npx', [
    'react-native',
    'run-android',
    '--deviceId',
    deviceId,
    '--port',
    metroPort,
    '--no-packager',
  ], {
    cwd: fixtureAppDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
};

const main = async () => {
  await fs.mkdir(outputDir, { recursive: true });
  await ensureFile(adbPath);
  await ensureFile(emulatorPath);
  await ensureFixtureApp();

  const env = {
    ...process.env,
    ANDROID_HOME: sdkRoot,
    ANDROID_SDK_ROOT: sdkRoot,
    RCT_METRO_PORT: metroPort,
  };

  const metro = startBackgroundProcess('npx', ['react-native', 'start', '--port', metroPort], metroLogPath, {
    cwd: fixtureAppDir,
    env,
  });

  let emulatorStop = async () => {};

  try {
    await waitForPort(metroPort, 120000);

    const emulator = await ensureEmulator();
    emulatorStop = emulator.stop;

    const runResult = await runAndroidApp(emulator.deviceId);
    await fs.writeFile(appLogPath, `${runResult.stdout}\n${runResult.stderr}`, 'utf8');

    const metrics = await waitForThemeDifference(emulator.deviceId);
    console.log(JSON.stringify({
      artifacts: {
        screenshot: screenshotPath,
        lightCrop: path.join(outputDir, 'light-crop.png'),
        darkCrop: path.join(outputDir, 'dark-crop.png'),
        metroLog: metroLogPath,
        runAndroidLog: appLogPath,
      },
      metrics,
    }, null, 2));
  } finally {
    await metro.stop();
    await emulatorStop();
  }
};

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
