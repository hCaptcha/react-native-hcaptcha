#!/usr/bin/env node

const { execSync, spawnSync } = require('child_process');
const { platform } = require('os');
const fs = require('fs');
const path = require('path');

// Function to display help message
function showHelp() {
  console.log(`
Usage: ${path.basename(process.argv[1])} [options]

Options:
  --expo        Use expo-cli (default: false)
  --template <value>  Specify the project template
  --name <value>    Specify the project name (required)
  -h, --help      Show this help message
`);
  process.exit(1);
}

// Simple argument parser function
function parseArgs(args) {
  const options = {
    cliName: 'react-native',
    projectName: 'react_native_hcaptcha_example',
    projectRelativeProjectPath: '../react-native-hcaptcha-example',
    packageManager: 'yarn',
    projectTemplate: undefined,
    frameworkVersion: undefined,
  };

  const argHandlers = {
    '--expo': () => options.cliName = 'expo',
    '--template': (value) => options.projectTemplate = value,
    '--name': (value) => {
      options.projectName = value.replace(/[^a-zA-Z0-9]/g, '_');
      options.projectRelativeProjectPath = path.join('..', value);
    },
    '--path': (value) => {
      options.projectRelativeProjectPath = value;
    },
    '--pm': (value) => options.packageManager = value,
    '-h': showHelp,
    '--help': showHelp
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];

    if (argHandlers[arg]) {
      const handler = argHandlers[arg];
      if (typeof handler === 'function') {
        const nextArg = args[i + 1];
        // Check if the next argument is not another flag
        if (typeof handler === 'function' && (nextArg && !nextArg.startsWith('--'))) {
          handler(nextArg);
          i++; // Skip next argument as it is consumed
        } else if (handler === showHelp) {
          handler();
        } else {
          console.error(`Error: ${arg} requires a value.`);
          showHelp();
        }
      }
    } else {
      console.error(`Unknown option: ${arg}`);
      showHelp();
    }
  }

  if (!options.projectName) {
    console.error('Error: --name is required.');
    showHelp();
  }

  return options;
}

function cleanupEnvPathNode() {
  process.env.PATH = process.env.PATH.split(':')
    .filter(dir => !dir.includes('node_modules/.bin'))
    .join(':');
  console.log(`env=${JSON.stringify(process.env)}`);
}

// Function to build the create command
function buildCreateCommand({ cliName, projectRelativeProjectPath, projectName, projectTemplate, packageManager, frameworkVersion }) {
  let createCommand = ['npx', cliName, 'init', projectName, '--directory', projectRelativeProjectPath];

  if (projectTemplate) {
    createCommand.push('--template', projectTemplate);
  }

  if (cliName === 'expo') {
    createCommand.push(`--${packageManager}`);
  } else if (cliName.includes('react-native')) {
    createCommand.push('--pm', packageManager);

    if (frameworkVersion) {
      createCommand.push('--version', frameworkVersion);
    }

    // createCommand.push('--skip-install');
  } else {
    console.error('Error: unsupporte cliName');
    showHelp();
  }

  createCommand.push('--verbose');

  return createCommand;
}

function checkHcaptchaLinked() {
  return false; // https://stackoverflow.com/a/47403470/902217
}

// Main function that takes parsed arguments and runs the necessary setup
function main({ cliName, projectRelativeProjectPath, projectName, projectTemplate, packageManager, frameworkVersion }) {
  cleanupEnvPathNode();

  console.warn(`Warning! Example project will be generated in '${path.dirname(process.cwd())}' os='${platform()}'`);

  // Build the command to initialize the project
  const createCommand = buildCreateCommand({ cliName, projectRelativeProjectPath, projectName, projectTemplate, packageManager, frameworkVersion });

  // Run the project initialization command
  console.log(`Running command: ${createCommand}`);
  execSync(createCommand.join(' '), { stdio: 'inherit', shell: true, env: { ...process.env, USE_HERMES: 0 } });

  const projectPath = path.join(process.cwd(), projectRelativeProjectPath);
  const packageManagerOptions = { stdio: 'inherit', cwd: projectPath };

  // Copy App.js
  fs.unlinkSync(path.join(projectPath, 'App.tsx'))
  fs.copyFileSync('Example.App.js', path.join(projectPath, 'App.js'));
  fs.copyFileSync('Example.jest.config.js', path.join(projectPath, 'jest.config.js'));
  fs.copyFileSync('Example.jest.setup.js', path.join(projectPath, 'jest.setup.js'));

  // Install dependencies
  const isHcaptchaLinked = checkHcaptchaLinked();
  const mainPackage = '@hcaptcha/react-native-hcaptcha'
  const mainPackagePath = `${path.dirname(projectRelativeProjectPath)}/react-native-hcaptcha`
  const peerPackages = 'react-native-modal react-native-webview';
  const devPackages = 'typescript @babel/preset-env react-shallow-renderer';

  console.warn('Installing dependencies...');
  if (packageManager === 'yarn') {
    execSync(`yarn add @hcaptcha/react-native-hcaptcha@file:${mainPackagePath}`, packageManagerOptions);
    execSync(`yarn add --dev ${devPackages}`, packageManagerOptions);
    execSync(`yarn add ${peerPackages}`, packageManagerOptions);
  } else {
    // https://github.com/facebook/react-native/issues/29977 - react-native doesn't work with symlinks so `cp` instead
    // fs.symlinkSync(mainPackagePath, path.join(projectPath, 'react-native-hcaptcha'), 'dir');
    execSync(`cp -r ${mainPackagePath} ${projectPath}`);
    execSync(`npm i --save file:./react-native-hcaptcha`, packageManagerOptions);
    execSync(`npm i --save --dev ${devPackages}`, packageManagerOptions);
    execSync(`npm i --save ${peerPackages}`, packageManagerOptions);
  }

  if (isHcaptchaLinked) {
    execSync(`${packageManager} link ${mainPackage}`, packageManagerOptions);
  }

  // iOS: pod install
  if (platform() === 'darwin') {
    const podOptions = { stdio: 'inherit', cwd: path.join(projectPath, 'ios'), env: { ...process.env, USE_HERMES: 0 } };
    execSync('bundle install', podOptions);
    execSync('bundle exec pod install', podOptions);
  }

  // Android
  const gradleOptions = {
    stdio: 'inherit', cwd: path.join(projectPath, 'android'),
    env: { ...process.env, GRADLE_OPTS: '-Dorg.gradle.jvmargs="-Xmx4096m -XX:MaxMetaspaceSize=1024m"' }
  };
  execSync('./gradlew assemble', gradleOptions);

  ['assets', 'res'].map(dir => fs.mkdirSync(path.join(projectPath, 'android/app/src/main', dir), { recursive: true }));

  console.log('Setup complete.');
}

main(parseArgs(process.argv));