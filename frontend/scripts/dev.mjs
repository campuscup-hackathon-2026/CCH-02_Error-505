import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(frontendDir, '..');
const backendDir = path.join(repoRoot, 'backend');
const backendPort = Number(process.env.BACKEND_PORT || 8000);
const backendHealthUrl = `http://127.0.0.1:${backendPort}/health`;
const require = createRequire(import.meta.url);
const vitePackageRoot = path.dirname(path.dirname(path.dirname(require.resolve('vite'))));
const viteCli = path.join(vitePackageRoot, 'bin', 'vite.js');

let backendProcess;
let viteProcess;

async function backendIsHealthy() {
  try {
    const response = await fetch(backendHealthUrl, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

function stopBackend() {
  if (!backendProcess?.pid || backendProcess.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(backendProcess.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    backendProcess.kill('SIGTERM');
  }
}

async function startBackendIfNeeded() {
  if (await backendIsHealthy()) {
    console.log(`Backend is already healthy at ${backendHealthUrl}`);
    return;
  }

  const venvPython = process.platform === 'win32'
    ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
    : path.join(backendDir, '.venv', 'bin', 'python');
  const pythonCommand = existsSync(venvPython) ? venvPython : (process.platform === 'win32' ? 'python' : 'python3');
  const pythonArgs = ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', String(backendPort)];

  console.log(`Starting backend at ${backendHealthUrl}`);
  backendProcess = spawn(pythonCommand, pythonArgs, {
    cwd: backendDir,
    stdio: 'inherit',
    windowsHide: true,
  });

  backendProcess.once('error', (error) => {
    console.error(`Could not start the backend: ${error.message}`);
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await backendIsHealthy()) return;
    if (backendProcess.exitCode !== null) {
      throw new Error(`Backend exited with code ${backendProcess.exitCode}. Check the Python environment and backend dependencies.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Backend did not become healthy at ${backendHealthUrl} within 30 seconds.`);
}

try {
  await startBackendIfNeeded();
  viteProcess = spawn(process.execPath, [viteCli, '--host', '0.0.0.0', ...process.argv.slice(2)], {
    cwd: frontendDir,
    stdio: 'inherit',
    windowsHide: true,
  });

  const exitCode = await new Promise((resolve, reject) => {
    viteProcess.once('error', reject);
    viteProcess.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    process.once('SIGINT', () => viteProcess.kill('SIGINT'));
    process.once('SIGTERM', () => viteProcess.kill('SIGTERM'));
  });
  stopBackend();
  process.exitCode = exitCode;
} catch (error) {
  console.error(error.message);
  stopBackend();
  process.exitCode = 1;
}
