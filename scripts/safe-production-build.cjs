// Build an isolated source copy with synthetic credentials. Never load .env.local.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const directory = fs.mkdtempSync(path.join(path.dirname(root), 'openui-production-check-'));
const directories = ['app', 'components', 'hooks', 'lib', 'prisma', 'prompts', 'public', 'redux', 'theme'];
const files = ['package.json', 'package-lock.json', 'next.config.ts', 'prisma.config.ts', 'proxy.ts', 'tsconfig.json', 'next-env.d.ts', 'postcss.config.mjs', 'components.json'];
for (const name of directories) fs.cpSync(path.join(root, name), path.join(directory, name), { recursive: true });
for (const name of files) if (fs.existsSync(path.join(root, name))) fs.copyFileSync(path.join(root, name), path.join(directory, name));
// Reuse installed dependencies without copying user data. The containing root lets
// Turbopack resolve this Windows junction; application code/config stays identical.
fs.symlinkSync(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
const configPath = path.join(directory, 'next.config.ts');
const config = fs.readFileSync(configPath, 'utf8');
if (!config.includes('root: __dirname,')) throw new Error('Build root configuration changed; review isolation before running.');
fs.writeFileSync(configPath, config.replace('root: __dirname,', 'root: ' + JSON.stringify(path.dirname(root)) + ','));

const env = {};
for (const name of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMFILES', 'ProgramFiles', 'ProgramFiles(x86)']) if (process.env[name]) env[name] = process.env[name];
Object.assign(env, {
  NODE_ENV: 'production', CI: '1', NEXT_TELEMETRY_DISABLED: '1',
  DATABASE_URL: 'postgresql://build:build@127.0.0.1:1/build',
  DIRECT_URL: 'postgresql://build:build@127.0.0.1:1/build',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'synthetic-build-only-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'synthetic-build.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'synthetic-build',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'synthetic-build.firebasestorage.app',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:synthetic',
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: 'G-SYNTHETIC',
  OPENUI_PROVIDER_KEYS_SECRET: Buffer.alloc(32, 7).toString('base64'),
});
const log = fs.createWriteStream(path.join(root, 'reports', 'production-readiness-build.log'));
console.log('Isolated build directory: ' + directory);
console.log('No environment files, SQLite data, uploads, .openui, or production credentials copied.');
const npm = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
if (!fs.existsSync(npm)) throw new Error('Cannot locate npm CLI; no build attempted.');
const child = cp.spawn(process.execPath, [npm, 'run', 'build'], { cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'] });
for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { process.stdout.write(chunk); log.write(chunk); });
child.on('error', () => { console.error('Isolated build process failed to start.'); process.exitCode = 1; log.end(); });
child.on('close', code => {
  log.end();
  fs.writeFileSync(path.join(root, 'reports', 'production-readiness-build.json'), JSON.stringify({ directory, exitCode: code, syntheticCredentialsOnly: true, realEnvironmentFilesCopied: false, applicationSourceChanges: false, isolationConfigDifference: 'Turbopack filesystem root widened only in isolated copy to resolve the existing dependency junction', command: 'npm run build', deployed: false }, null, 2) + '\n');
  process.exitCode = code === 0 ? 0 : 1;
});
