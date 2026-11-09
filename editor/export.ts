import type { SceneData } from '../src/index';

export function downloadFile(filename: string, contents: string, mime = 'application/json'): void {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'game';
}

export function toSceneJson(scene: SceneData): string {
  return `${JSON.stringify(scene, null, 2)}\n`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Bundle the current scene and the engine runtime into a single HTML file. */
export async function buildStandaloneHtml(scene: SceneData): Promise<string> {
  const response = await fetch(new URL('./unitern.runtime.js', document.baseURI));
  if (!response.ok) {
    throw new Error('Engine runtime file is missing. Run "npm run build:runtime" and try again.');
  }
  const runtime = await response.text();
  if (runtime.length < 1000) {
    throw new Error('Engine runtime file looks incomplete. Rebuild it with "npm run build:runtime".');
  }
  const title = escapeHtml(scene.name || 'UniTern Game');
  const background = escapeHtml(scene.settings.background || '#0b0e14');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; height: 100%; background: ${background}; overflow: hidden; }
  canvas { display: block; width: 100%; height: 100%; }
  #unitern-status {
    position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    color: #cfe0f5; font: 500 15px/1.5 ui-sans-serif, system-ui, sans-serif;
    background: ${background}; text-align: center; padding: 24px;
  }
  #unitern-status[hidden] { display: none; }
</style>
</head>
<body>
<canvas id="unitern-game" tabindex="0"></canvas>
<div id="unitern-status">Loading…</div>
<script>window.__UNITERN_SCENE__ = ${scriptSafeJson(scene)};</script>
<script>${runtime}</script>
<script>
(function () {
  var scene = window.__UNITERN_SCENE__;
  var canvas = document.getElementById('unitern-game');
  var status = document.getElementById('unitern-status');
  function fail(error) {
    if (!status) return;
    status.hidden = false;
    status.textContent = 'Could not start the game: ' + (error && error.message ? error.message : error);
  }
  try {
    var game = new UniTern.Game({ canvas: canvas, scene: scene, autoResize: true });
    game.load().then(function () {
      if (status) status.remove();
      game.start();
      canvas.focus();
    }).catch(fail);
  } catch (error) {
    fail(error);
  }
})();
</script>
</body>
</html>
`;
}
