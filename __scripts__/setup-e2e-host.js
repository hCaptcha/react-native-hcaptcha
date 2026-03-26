#!/usr/bin/env node

const { execSync } = require('child_process');
const { platform: osPlatform } = require('os');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOST_DIR = path.join(ROOT, '__e2e__', 'host');
const E2E_DIR = path.join(ROOT, '__e2e__');

const pm = process.argv.includes('--pm') ? process.argv[process.argv.indexOf('--pm') + 1] : 'npm';
const targetPlatform = process.argv.includes('--platform')
  ? process.argv[process.argv.indexOf('--platform') + 1]
  : null;

if (fs.existsSync(HOST_DIR)) {
  console.log('Cleaning previous host app...');
  fs.rmSync(HOST_DIR, { recursive: true, force: true });
}

// 1. Scaffold the host app WITHOUT building native code
console.log('Generating host app at __e2e__/host/ ...');
execSync(
  `node __scripts__/generate-example.js --path __e2e__/host --pm ${pm} --skip-build`,
  { stdio: 'inherit', cwd: ROOT },
);

const hostTestsDir = path.join(HOST_DIR, '__tests__');
if (fs.existsSync(hostTestsDir)) {
  fs.rmSync(hostTestsDir, { recursive: true, force: true });
}

// 2. Install react-native-harness (must happen BEFORE native build so
//    HarnessUI TurboModule is compiled into the binary)
console.log('Installing react-native-harness in host app...');
const harnessPkgs = [
  'react-native-harness',
  '@react-native-harness/platform-android',
  '@react-native-harness/platform-apple',
  '@react-native-harness/ui',
].join(' ');

if (pm === 'yarn') {
  execSync(`yarn add --dev ${harnessPkgs}`, { stdio: 'inherit', cwd: HOST_DIR });
} else {
  execSync(`npm i --save-dev ${harnessPkgs}`, { stdio: 'inherit', cwd: HOST_DIR });
}

// Patch @react-native-harness/ui codegenConfig: the published package is
// missing ios.modulesProvider, so RN's codegen never registers HarnessUI in
// RCTModuleProviders.mm and the TurboModule can't be found at runtime on iOS.
const harnessUiPkgPath = path.join(HOST_DIR, 'node_modules', '@react-native-harness', 'ui', 'package.json');
if (fs.existsSync(harnessUiPkgPath)) {
  const harnessUiPkg = JSON.parse(fs.readFileSync(harnessUiPkgPath, 'utf8'));
  if (harnessUiPkg.codegenConfig && !harnessUiPkg.codegenConfig.ios) {
    harnessUiPkg.codegenConfig.ios = {
      modulesProvider: { HarnessUI: 'HarnessUI' },
    };
    fs.writeFileSync(harnessUiPkgPath, JSON.stringify(harnessUiPkg, null, 2) + '\n');
    console.log('Patched @react-native-harness/ui codegenConfig with ios.modulesProvider');
  }
}

// 3. Build native code for the target platform only
const buildIos = (!targetPlatform || targetPlatform === 'ios') && osPlatform() === 'darwin';
const buildAndroid = !targetPlatform || targetPlatform === 'android';

if (buildIos) {
  const gemfile = path.join(HOST_DIR, 'Gemfile');
  if (fs.existsSync(gemfile)) {
    const content = fs.readFileSync(gemfile, 'utf8');
    if (!content.includes("gem 'nkf'")) {
      fs.appendFileSync(gemfile, "\ngem 'nkf'\n");
    }
  }
  const podDir = path.join(HOST_DIR, 'ios');
  console.log('Running pod install...');
  execSync('bundle install', { stdio: 'inherit', cwd: podDir });
  execSync('bundle exec pod install', { stdio: 'inherit', cwd: podDir });

  console.log('Building iOS...');
  execSync('npx react-native build-ios --buildFolder build', { stdio: 'inherit', cwd: HOST_DIR });
}

if (buildAndroid) {
  const gradleDir = path.join(HOST_DIR, 'android');
  console.log('Building Android...');
  execSync('./gradlew assembleDebug', {
    stdio: 'inherit',
    cwd: gradleDir,
    env: { ...process.env, GRADLE_OPTS: '-Dorg.gradle.jvmargs="-Xmx4096m -XX:MaxMetaspaceSize=1024m"' },
  });

  ['assets', 'res'].forEach(dir =>
    fs.mkdirSync(path.join(HOST_DIR, 'android/app/src/main', dir), { recursive: true }),
  );
}

// 4. Copy harness configs and test files into host app
console.log('Copying harness configs and test files into host app...');
const filesToCopy = [
  ['rn-harness.config.mjs', 'rn-harness.config.mjs'],
  ['jest.harness.config.mjs', 'jest.harness.config.mjs'],
];
for (const [src, dest] of filesToCopy) {
  fs.copyFileSync(path.join(E2E_DIR, src), path.join(HOST_DIR, dest));
}

const hostE2eDir = path.join(HOST_DIR, '__e2e__');
fs.mkdirSync(hostE2eDir, { recursive: true });
const testFiles = fs.readdirSync(E2E_DIR).filter(f => f.endsWith('.harness.js') || f.endsWith('.harness.ts') || f.endsWith('.harness.tsx'));
for (const file of testFiles) {
  fs.copyFileSync(path.join(E2E_DIR, file), path.join(hostE2eDir, file));
}

const snapshotsDir = path.join(E2E_DIR, '__image_snapshots__');
fs.mkdirSync(snapshotsDir, { recursive: true });
fs.symlinkSync(snapshotsDir, path.join(hostE2eDir, '__image_snapshots__'));

console.log('E2E host app setup complete.');
