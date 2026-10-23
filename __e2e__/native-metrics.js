const { execFile } = require('child_process');
const { promisify } = require('util');

const exec = promisify(execFile);

async function nativeMetrics(platform) {
  if (platform === 'android') {
    const { stdout } = await exec('adb', ['shell', 'ps', '-A', '-o', 'PID,ARGS']);
    const processes = stdout
      .split('\n')
      .filter((line) => /com\.react_native_hcaptcha_example|webview.*sandboxed_process/.test(line));
    const memory = await Promise.all(
      processes.map(async (line) => {
        const [, pid, name] = line.match(/^\s*(\d+)\s+(.+)$/);
        const result = await exec('adb', ['shell', 'dumpsys', 'meminfo', pid]);
        const match = result.stdout.match(/TOTAL PSS:\s+(\d+)/);
        return { pid: Number(pid), name, pssKb: match ? Number(match[1]) : null };
      })
    );
    const frames = await exec('adb', ['shell', 'dumpsys', 'gfxinfo', 'com.react_native_hcaptcha_example']);
    return {
      processes: memory,
      pssKb: memory.reduce((total, process) => total + (process.pssKb || 0), 0),
      nativeFrames: frames.stdout.match(/Total frames rendered:.*|Janky frames:.*|\d+th percentile:.*/g),
    };
  }
  const { stdout } = await exec('ps', ['-axo', 'pid=,ppid=,rss=,command=']);
  const processes = stdout
    .split('\n')
    .map((line) => line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/))
    .filter(Boolean);
  const app = processes.find((entry) => entry[4].includes('/react_native_hcaptcha_example.app/'));
  const memory = processes.filter(
    (entry) =>
      entry === app || (entry[2] === app?.[2] && /WebKit\.(WebContent|Networking|GPU)/.test(entry[4]))
  );
  return {
    processes: memory.map((entry) => ({ pid: Number(entry[1]), name: entry[4], rssKb: Number(entry[3]) })),
    rssKb: memory.reduce((total, entry) => total + Number(entry[3]), 0),
  };
}

async function crashRenderer(platform) {
  const memory = await nativeMetrics(platform);
  if (platform === 'ios') {
    const renderers = memory.processes.filter((process) => process.name.includes('WebKit.WebContent'));
    if (!renderers.length) {
      throw new Error('Test WebKit renderer not found');
    }
    // Safari used for backgrounding can leave another renderer in this simulator.
    await exec('kill', ['-9', ...renderers.map((renderer) => String(renderer.pid))]);
    return;
  }
  const app = memory.processes.find((process) => process.name === 'com.react_native_hcaptcha_example');
  await exec('adb', ['forward', 'tcp:9223', `localabstract:webview_devtools_remote_${app.pid}`]);
  const targets = await (await fetch('http://127.0.0.1:9223/json')).json();
  const WebSocket = require('./host/node_modules/ws');
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:9223/devtools/page/${targets[0].id}`);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error('Renderer crash timed out'));
    }, 5000);
    const done = () => {
      clearTimeout(timeout);
      socket.close();
      resolve();
    };
    socket.onopen = () => socket.send(JSON.stringify({ id: 1, method: 'Page.crash' }));
    socket.onclose = done;
    socket.onerror = (event) => {
      clearTimeout(timeout);
      reject(new Error(`WebView debugger connection failed: ${event.message}`));
    };
    socket.onmessage = (event) => {
      if (/crashed/i.test(event.data)) {
        done();
      }
    };
  });
}

async function backgroundApp(platform, duration) {
  let simulator;
  if (platform === 'android') {
    await exec('adb', ['shell', 'input', 'keyevent', 'KEYCODE_HOME']);
  } else {
    const { stdout } = await exec('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']);
    const devices = Object.values(JSON.parse(stdout).devices).flat().filter((device) =>
      !process.env.HARNESS_IOS_DEVICE || device.name === process.env.HARNESS_IOS_DEVICE
    );
    if (devices.length !== 1) {
      throw new Error('Expected one booted test simulator');
    }
    simulator = devices[0].udid;
    await exec('xcrun', ['simctl', 'launch', simulator, 'com.apple.mobilesafari']);
  }
  await new Promise((resolve) => setTimeout(resolve, duration));
  if (platform === 'android') {
    await exec('adb', ['shell', 'am', 'start', '-n', 'com.react_native_hcaptcha_example/.MainActivity']);
  } else {
    await exec('xcrun', ['simctl', 'launch', simulator, 'org.reactjs.native.example.react-native-hcaptcha-example']);
    await exec('xcrun', ['simctl', 'terminate', simulator, 'com.apple.mobilesafari']);
  }
}

module.exports = { nativeMetrics, crashRenderer, backgroundApp };
