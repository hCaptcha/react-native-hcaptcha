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
    packageManager: 'yarn', // npm is broken https://github.com/facebook/react-native/issues/29977
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
  let createCommand = [cliName, 'init', projectName, '--directory', projectRelativeProjectPath];

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

    createCommand.push('--skip-install');
  } else {
    console.error('Error: unsupporte cliName');
    showHelp();
  }

  createCommand.push('--verbose');

  return createCommand;
}

// Function to check if hCaptcha is linked
function checkHcaptchaLinked() {
  // 
  return false;
}

// Main function that takes parsed arguments and runs the necessary setup
function main({ cliName, projectRelativeProjectPath, projectName, projectTemplate, packageManager, frameworkVersion }) {
  cleanupEnvPathNode();

  console.warn(`Warning! Example project will be generated in '${path.dirname(__dirname)}' directory`);

  // Build the command to initialize the project
  const createCommand = buildCreateCommand({ cliName, projectRelativeProjectPath, projectName, projectTemplate, packageManager, frameworkVersion });

  // Run the project initialization command
  console.log(`Running command: ${createCommand}`);
  execSync(createCommand.join(' '), { stdio: 'inherit', shell: true });

  const projectPath = path.join(process.cwd(), projectRelativeProjectPath);
  const packageManagerOptions = { stdio: 'inherit', cwd: projectPath };

  // Copy App.js
  fs.readdirSync(projectPath)
    .filter(file => file.startsWith('App.'))
    .forEach(file => fs.unlinkSync(path.join(projectPath, file)));
  fs.copyFileSync('Example.App.js', `${projectPath}/App.js`);

  // Install dependencies
  const isHcaptchaLinked = checkHcaptchaLinked();
  const mainPackage = '@hcaptcha/react-native-hcaptcha'
  const mainPackagePath = `${path.dirname(projectRelativeProjectPath)}/react-native-hcaptcha`
  const peerPackages = 'react-native-modal react-native-webview';

  console.warn('Installing dependencies...');
  if (packageManager === 'yarn') {
    execSync(`yarn add ${mainPackagePath}`, packageManagerOptions);
    execSync(`yarn add ${peerPackages}`, packageManagerOptions);
  } else {
    execSync(`npm i --save ${mainPackagePath}`, packageManagerOptions);
    execSync(`npm i --save ${peerPackages}`, packageManagerOptions);
  }

  if (isHcaptchaLinked) {
    execSync(`${packageManager} link ${mainPackage}`, packageManagerOptions);
  }

  // Handle iOS-specific setup if running on macOS
  if (platform() === 'darwin') {
    const podOptions = { stdio: 'inherit', cwd: path.join(projectPath, 'ios'), env: { ...process.env, USE_HERMES: 0 } };
    execSync('bundle install', podOptions);
    execSync('bundle exec pod install', podOptions);
  }

  console.log('Setup complete.');
}

main(parseArgs(process.argv));