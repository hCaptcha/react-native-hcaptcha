/* global AbortSignal */
import { fork } from 'child_process';
import { once } from 'events';
import path from 'path';
import { waitFor } from '@testing-library/react-native';

let server;
let baseUrl;
const post = (route) => fetch(`${baseUrl}/${route}`, { method: 'POST' }).then((response) => response.json());

beforeAll(async () => {
  server = fork(path.join(__dirname, '../__e2e__/auth-server.js'), [], {
    env: { ...process.env, HCAPTCHA_E2E_PORT: '0' },
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  const [address] = await Promise.race([
    once(server, 'message'),
    once(server, 'exit').then(([code]) => { throw new Error(`Auth server exited before readiness: ${code}`); }),
  ]);
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server.exitCode !== null) {
    return;
  }
  const exited = once(server, 'exit');
  server.kill();
  await exited;
});

test.each(['before requests', 'after requests', 'after reset'])('SDK gate release: %s', async (order) => {
  await post('reset');
  if (order !== 'after requests') {
    await post('release-sdk');
  }
  if (order === 'after reset') {
    await post('reset');
  }
  let completed = 0;
  const requests = [1, 2].map(() => fetch(`${baseUrl}/slow/1/api.js`, {
    signal: AbortSignal.timeout(3000),
  }).then(async (response) => {
    completed++;
    expect(await response.text()).toContain('https://js.hcaptcha.com/1/api.js');
    return response.status;
  }));
  const release = order === 'before requests' ? Promise.resolve() : (async () => {
    await waitFor(async () => {
      const state = await (await fetch(`${baseUrl}/state`)).json();
      expect(state.sdkLoads).toBe(2);
    }, { timeout: 2000 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(completed).toBe(0);
    await post('release-sdk');
  })();
  const results = await Promise.all([...requests, release]);
  expect(results.slice(0, 2)).toEqual([200, 200]);
  await post('release-sdk');
  const future = await fetch(`${baseUrl}/slow/1/api.js`, { signal: AbortSignal.timeout(3000) });
  expect(future.status).toBe(200);
  expect(await future.text()).toContain('https://js.hcaptcha.com/1/api.js');
});
