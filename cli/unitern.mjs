#!/usr/bin/env node
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageJson = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
const engineEntry = path.join(packageRoot, 'dist', 'engine', 'index.js');
const templatesDir = path.join(packageRoot, 'templates');

const HELP = `
UniTern ${packageJson.version} — lightweight 2D games for the web

Usage:
  unitern create <folder> [--template platformer|starter]
  unitern build [folder] [--out <dir>] [--minify | --no-minify]
  unitern dev [folder] [--port 5173]
  unitern serve [folder] [--port 4173]
  unitern editor [--port 5174]
  unitern doctor
  unitern version
  unitern help

Build output is a single self-contained dist/index.html file.
`;

function fail(message) {
  console.error(`\n  error: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const flags = { _: [], minify: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      flags._.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const equals = body.indexOf('=');
    if (equals >= 0) {
      flags[body.slice(0, equals)] = body.slice(equals + 1);
      continue;
    }
    if (body === 'no-minify') flags.minify = false;
    else if (body === 'minify') flags.minify = true;
    else if (['port', 'out', 'template', 'entry'].includes(body)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) fail(`--${body} needs a value`);
      flags[body] = value;
      i++;
    } else flags[body] = true;
  }
  return flags;
}

function parsePort(value, fallback) {
  const port = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`Invalid port: ${value}`);
  return port;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

function mimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
  }[extension] ?? 'application/octet-stream';
}

async function assertEngine() {
  try {
    await fs.access(engineEntry);
  } catch {
    fail(`Engine bundle not found at ${engineEntry}\n  Run "npm run build:engine" inside the UniTern package first.`);
  }
}

function renderHtml({ title, background, script, reload }) {
  const safeScript = script.replace(/<\/script/gi, '<\\/script');
  const reloadScript = reload
    ? `<script>
  (function () {
    var source = new EventSource('/__unitern_reload');
    source.onmessage = function () { location.reload(); };
  })();
</script>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; height: 100%; overflow: hidden; background: ${escapeHtml(background)}; }
  canvas#game { display: block; width: 100%; height: 100%; outline: none; touch-action: none; }
</style>
</head>
<body>
<canvas id="game" tabindex="0"></canvas>
<script>${safeScript}</script>
${reloadScript}
</body>
</html>
`;
}

async function readScene(scenePath) {
  let raw;
  try {
    raw = await fs.readFile(scenePath, 'utf8');
  } catch {
    fail(`No game.json found in ${path.dirname(scenePath)}`);
  }
  let scene;
  try {
    scene = JSON.parse(raw);
  } catch (error) {
    fail(`game.json is not valid JSON: ${error.message}`);
  }
  if (!scene || typeof scene !== 'object' || !scene.root || typeof scene.root !== 'object') {
    fail('game.json must contain a scene with a "root" node. Export one from the UniTern editor.');
  }
  return scene;
}

async function buildGame(projectDir, flags, options = {}) {
  const scenePath = path.join(projectDir, 'game.json');
  const entry = path.resolve(projectDir, flags.entry ?? 'src/main.ts');
  const outDir = path.resolve(projectDir, flags.out ?? 'dist');
  const scene = await readScene(scenePath);
  try {
    await fs.access(entry);
  } catch {
    fail(`Game entry not found: ${entry}`);
  }
  await assertEngine();

  let result;
  try {
    result = await build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      target: ['es2020'],
      minify: options.minify ?? (flags.minify !== false),
      sourcemap: false,
      legalComments: 'none',
      logLevel: 'silent',
      alias: { unitern: engineEntry },
    });
  } catch (error) {
    fail(`Build failed:\n${error.message}`);
  }

  const script = result.outputFiles[0].text;
  const title = typeof scene.name === 'string' && scene.name.trim() ? scene.name : 'UniTern Game';
  const background = scene.settings && typeof scene.settings.background === 'string'
    ? scene.settings.background
    : '#0b0e14';
  const html = renderHtml({ title, background, script, reload: options.reload === true });

  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'index.html');
  await fs.writeFile(outFile, html);
  return { outFile, html, bytes: Buffer.byteLength(html), scene };
}

async function listen(server, port) {
  await new Promise((resolve, reject) => {
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') reject(new Error(`Port ${port} is already in use`));
      else reject(error);
    });
    server.listen(port, '0.0.0.0', resolve);
  });
}

async function serveDirectory(rootDir, port, label) {
  const root = path.resolve(rootDir);
  try {
    await fs.access(path.join(root, 'index.html'));
  } catch {
    fail(`No index.html in ${root}. Build the project first.`);
  }
  const server = createServer(async (request, response) => {
    try {
      const urlPath = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/');
      const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const filePath = path.resolve(root, relative);
      if (filePath !== root && !filePath.startsWith(root + path.sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat || !stat.isFile()) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }
      response.writeHead(200, { 'Content-Type': mimeType(filePath), 'Cache-Control': 'no-store' });
      createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Internal error');
      console.error(error);
    }
  });
  try {
    await listen(server, port);
  } catch (error) {
    fail(error.message);
  }
  console.log(`\n  ${label}\n  http://localhost:${port}\n\n  Press Ctrl+C to stop.\n`);
}

async function projectStamp(directory) {
  let stamp = 0;
  const walk = async (current) => {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else {
        const stat = await fs.stat(full).catch(() => null);
        if (stat) stamp += stat.mtimeMs;
      }
    }
  };
  await walk(directory);
  return stamp;
}

async function commandCreate(flags) {
  const name = flags._[0];
  if (!name) fail('Usage: unitern create <folder> [--template platformer|starter]');
  const templateName = flags.template ?? 'platformer';
  const source = path.join(templatesDir, templateName);
  try {
    await fs.access(source);
  } catch {
    fail(`Unknown template "${templateName}". Available: platformer, starter`);
  }
  const target = path.resolve(process.cwd(), name);
  const existing = await fs.readdir(target).catch(() => null);
  if (existing && existing.length > 0) fail(`Directory ${target} already exists and is not empty`);
  await fs.mkdir(target, { recursive: true });
  await fs.cp(source, target, {
    recursive: true,
    filter: (entry) => {
      const base = path.basename(entry);
      return base !== 'dist' && base !== 'node_modules' && base !== '.unitern-build.json';
    },
  });
  console.log(`\n  Created ${templateName} project in ${target}\n`);
  console.log(`  cd ${name}`);
  console.log('  unitern dev\n');
}

async function commandBuild(flags) {
  const projectDir = path.resolve(flags._[0] ?? process.cwd());
  const result = await buildGame(projectDir, flags);
  console.log(`\n  Built ${path.relative(process.cwd(), result.outFile) || result.outFile}`);
  console.log(`  ${(result.bytes / 1024).toFixed(1)} kB self-contained HTML — open it in a browser.\n`);
}

async function commandDev(flags) {
  const projectDir = path.resolve(flags._[0] ?? process.cwd());
  const port = parsePort(flags.port, 5173);
  await buildGame(projectDir, flags, { reload: true, minify: false });

  const clients = new Set();
  let lastStamp = await projectStamp(projectDir);
  const server = createServer(async (request, response) => {
    if ((request.url ?? '').startsWith('/__unitern_reload')) {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      response.write('retry: 800\n\n');
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }
    try {
      const result = await buildGame(projectDir, flags, { reload: true, minify: false });
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(result.html);
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(`Build failed:\n${error instanceof Error ? error.message : String(error)}`);
    }
  });
  try {
    await listen(server, port);
  } catch (error) {
    fail(error.message);
  }

  setInterval(async () => {
    const stamp = await projectStamp(projectDir);
    if (stamp === lastStamp) return;
    lastStamp = stamp;
    for (const client of clients) client.write('data: reload\n\n');
    console.log('  change detected — reloading browser');
  }, 400).unref();

  console.log(`\n  UniTern dev server\n  http://localhost:${port}\n\n  Watching for changes. Press Ctrl+C to stop.\n`);
}

async function commandServe(flags) {
  const projectDir = path.resolve(flags._[0] ?? process.cwd());
  const port = parsePort(flags.port, 4173);
  await serveDirectory(path.join(projectDir, 'dist'), port, 'UniTern game preview');
}

async function commandEditor(flags) {
  const port = parsePort(flags.port, 5174);
  const editorDir = path.join(packageRoot, 'dist', 'editor');
  try {
    await fs.access(path.join(editorDir, 'index.html'));
  } catch {
    fail('Editor build not found. Run "npm run build" in the UniTern package first.');
  }
  await serveDirectory(editorDir, port, 'UniTern editor');
}

async function commandDoctor() {
  const checks = [];
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push([nodeMajor >= 18, `Node.js ${process.versions.node} (needs >= 18)`]);
  checks.push([await exists(engineEntry), 'Engine bundle (dist/engine/index.js)']);
  checks.push([await exists(path.join(packageRoot, 'dist', 'types', 'index.d.ts')), 'Type declarations']);
  checks.push([await exists(path.join(packageRoot, 'dist', 'editor', 'index.html')), 'Editor build']);
  checks.push([await exists(path.join(packageRoot, 'dist', 'editor', 'unitern.runtime.js')), 'Editor runtime bundle']);
  checks.push([await exists(path.join(templatesDir, 'platformer', 'game.json')), 'Platformer demo scene']);
  checks.push([await exists(path.join(templatesDir, 'starter', 'game.json')), 'Starter scene']);
  checks.push([await exists(engineEntry), 'esbuild available for game builds']);

  console.log(`\n  UniTern ${packageJson.version} doctor\n`);
  let ok = true;
  for (const [passed, label] of checks) {
    console.log(`  ${passed ? '✓' : '✗'} ${label}`);
    if (!passed) ok = false;
  }
  console.log(ok ? '\n  All checks passed.\n' : '\n  Some checks failed. Run "npm run build".\n');
  if (!ok) process.exitCode = 1;
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0] ?? 'help';
  const flags = parseArgs(argv.slice(1));

  switch (command) {
    case 'create':
      await commandCreate(flags);
      break;
    case 'build':
      await commandBuild(flags);
      break;
    case 'dev':
      await commandDev(flags);
      break;
    case 'serve':
      await commandServe(flags);
      break;
    case 'editor':
      await commandEditor(flags);
      break;
    case 'doctor':
      await commandDoctor();
      break;
    case 'version':
    case '--version':
    case '-v':
      console.log(packageJson.version);
      break;
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP);
      break;
    default:
      console.error(`Unknown command "${command}"`);
      console.log(HELP);
      process.exit(1);
  }
}

try {
  await main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
