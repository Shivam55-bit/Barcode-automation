import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { get as httpGet } from 'node:http';
import { mkdtempSync, existsSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { getDesktopDataDirectory } from '../barcode-automation-backend/src/runtimePaths';
import { apiService } from '../src/services/apiService';

test('desktop development reuses its existing store without leaking it into packaged or explicit QA profiles', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'barcodeflow-data-path-'));
  const profile = path.join(root, 'profile');
  const workspaceData = path.join(root, 'barcode-automation-backend', 'data');
  try {
    assert.equal(getDesktopDataDirectory(profile, root, false, {}), path.join(profile, 'data'));
    mkdirSync(workspaceData, { recursive: true });
    writeFileSync(path.join(workspaceData, 'users.json'), '[]');
    assert.equal(getDesktopDataDirectory(profile, root, false, {}), workspaceData);
    assert.equal(getDesktopDataDirectory(profile, root, true, {}), path.join(profile, 'data'));
    assert.equal(getDesktopDataDirectory(profile, root, false, { BARCODEFLOW_DATA_DIR: profile }), profile);
    const qaProfile = path.join(root, 'qa');
    assert.equal(getDesktopDataDirectory(profile, root, false, { BARCODEFLOW_USER_DATA_DIR: qaProfile, BARCODEFLOW_DATA_DIR: workspaceData }), path.join(qaProfile, 'data'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('API login displays server credential and approval messages instead of generic HTTP status text', async context => {
  for (const status of [401, 403]) {
    const message = status === 401 ? 'Invalid email address or password.' : 'Administrator approval is pending.';
    const mocked = context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ success: false, message }), { status }));
    await assert.rejects(apiService.auth.login({ email: 'qa@example.invalid', password: 'synthetic-test-only' }), { message });
    mocked.mock.restore();
  }
});

test('DESK-001: private backend starts on an assigned loopback port with isolated writable data', { timeout: 20000 }, async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'barcodeflow-backend-'));
  const dataDir = path.join(root, 'profile', 'data');
  const workspace = fileURLToPath(new URL('../', import.meta.url));
  const child = fork(path.join(workspace, 'server.ts'), [], {
    cwd: root, execArgv: ['--import', import.meta.resolve('tsx')],
    env: { ...process.env, PORT: '0', NODE_ENV: 'production', BARCODEFLOW_DESKTOP: '1', BARCODEFLOW_DATA_DIR: dataDir, BARCODEFLOW_DIST_DIR: path.join(workspace, 'dist') },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let logs = '';
  child.stdout?.on('data', chunk => { logs += chunk; });
  child.stderr?.on('data', chunk => { logs += chunk; });
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Backend readiness not reported: ${logs}`)), 10000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Backend exited ${code}: ${logs}`)); });
      child.on('message', (message: any) => {
        if (message.type === 'backend-ready') { clearTimeout(timer); resolve(message.port); }
      });
    });
    assert.ok(port > 0 && port !== 3001);
    const health = await fetch(`http://127.0.0.1:${port}/api/health`).then(response => response.json());
    assert.equal(health.status, 'online');
    const endpoint = `http://127.0.0.1:${port}/api/health`;
    assert.equal((await fetch(endpoint, { headers: { Origin: 'https://foreign.example.invalid' } })).status, 403);
    const forgedHostStatus = await new Promise<number | undefined>((resolve, reject) => {
      httpGet(endpoint, { headers: { Host: `foreign.example.invalid:${port}` } }, response => {
        response.resume();
        resolve(response.statusCode);
      }).once('error', reject);
    });
    assert.equal(forgedHostStatus, 403);
    assert.equal((await fetch(endpoint, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    const sameOrigin = await fetch(endpoint, { headers: { Origin: `http://127.0.0.1:${port}` } });
    assert.equal(sameOrigin.status, 200);
    assert.equal(sameOrigin.headers.get('access-control-allow-origin'), `http://127.0.0.1:${port}`);
    assert.ok(existsSync(path.join(dataDir, 'templates.json')), 'Store must be written to the explicit profile, not cwd');
    assert.equal(existsSync(path.join(root, 'barcode-automation-backend')), false);
    const html = await fetch(`http://127.0.0.1:${port}/`).then(response => response.text());
    assert.match(html, /<div id="root"/);
    const post = (route: string, body: any) => fetch(`http://127.0.0.1:${port}/api/auth/${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.deepEqual(JSON.parse(readFileSync(path.join(dataDir, 'users.json'), 'utf8')), []);
    assert.equal((await post('login', { email: 'superadmin@gmail.com', password: 'superadmin@gmail.com' })).status, 401);
    assert.equal((await post('login', { email: 'superadmin@gmail.com' })).status, 400);
    const credentials = { email: 'initial-admin@example.invalid', password: 'Regression only: long password ' };
    const registered = await post('register', { ...credentials, name: 'Initial Administrator' });
    assert.equal(registered.status, 201);
    const registration = await registered.json();
    assert.equal(registration.user.role, 'Super Admin');
    assert.equal(registration.user.isApproved, true);
    assert.equal(registration.user.passwordHash, undefined);
    const stored = JSON.parse(readFileSync(path.join(dataDir, 'users.json'), 'utf8'))[0];
    assert.match(stored.passwordHash, /^scrypt\$/);
    assert.equal(stored.password, undefined);
    assert.equal((await post('login', { ...credentials, password: credentials.password.trim() })).status, 401);
    const login = await post('login', credentials);
    assert.equal(login.status, 200);
    assert.equal((await login.json()).user.passwordHash, undefined);
    const updatedPassword = 'Different regression-only password ';
    const updated = await fetch(`http://127.0.0.1:${port}/api/users/${registration.user.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: updatedPassword }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).user.passwordHash, undefined);
    assert.equal((await post('login', credentials)).status, 401);
    assert.equal((await post('login', { ...credentials, password: updatedPassword })).status, 200);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await exited;
    }
    rmSync(root, { recursive: true, force: true });
  }
});