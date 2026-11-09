import {
  createSceneData,
  fileToDataUrl,
  normalizeScene,
  type AssetData,
  type SceneData,
} from '../src/index';
import { EditorState } from './state';
import { Viewport, type ViewportStatus } from './viewport';
import { renderHierarchy } from './panels/hierarchy';
import { renderInspector } from './panels/inspector';
import { renderAssets } from './panels/assets';
import { buildStandaloneHtml, downloadFile, safeFileName, toSceneJson } from './export';
import type { EditorContext } from './context';
import { el, formatNumber, svgIcon } from './dom';
import { toolbarButton, iconButton } from './ui';

interface ShellRefs {
  root: HTMLElement;
  hierarchyBody: HTMLElement;
  inspectorBody: HTMLElement;
  assetsBody: HTMLElement;
  viewportHost: HTMLElement;
  sceneName: HTMLInputElement;
  dirtyDot: HTMLElement;
  sceneFile: HTMLInputElement;
  assetFile: HTMLInputElement;
  toastHost: HTMLElement;
  addNodeButton: HTMLButtonElement;
  importAssetButton: HTMLButtonElement;
  newButton: HTMLButtonElement;
  openButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  demoButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  gridButton: HTMLButtonElement;
  snapButton: HTMLButtonElement;
  playButton: HTMLButtonElement;
  statusSelection: HTMLElement;
  statusCursor: HTMLElement;
  statusZoom: HTMLElement;
  statusFps: HTMLElement;
  statusMode: HTMLElement;
}

function panel(title: string, extra: HTMLElement | null, bodyClass: string): { element: HTMLElement; body: HTMLElement } {
  const body = el('div', { class: `panel-body ${bodyClass}` });
  const header = el('div', { class: 'panel-header' }, el('span', { class: 'panel-title', text: title }), extra ?? el('span'));
  const element = el('div', { class: 'panel' }, header, body);
  return { element, body };
}

function buildShell(): ShellRefs {
  const root = el('div', { class: 'editor' });

  const sceneName = el('input', {
    class: 'scene-name',
    attrs: { type: 'text', spellcheck: 'false', 'aria-label': 'Scene name' },
  });
  sceneName.value = 'Untitled';
  const dirtyDot = el('span', { class: 'scene-dot' });

  const newButton = toolbarButton('New', 'plus', () => newScene());
  const openButton = toolbarButton('Open', 'open', () => openScene());
  const saveButton = toolbarButton('Save', 'save', () => saveScene());
  const exportButton = toolbarButton('Export', 'download', () => exportGame());
  const demoButton = toolbarButton('Demo', 'spark', () => loadDemo());

  const undoButton = iconButton('undo', 'Undo (Ctrl+Z)', () => state.undo());
  const redoButton = iconButton('redo', 'Redo (Ctrl+Shift+Z)', () => state.redo());
  const gridButton = iconButton('grid', 'Toggle grid', () => toggleGrid(), { active: true });
  const snapButton = iconButton('magnet', 'Toggle snap to grid', () => toggleSnap(), { active: true });
  const playButton = toolbarButton('Play', 'play', () => togglePlay(), 'primary');
  playButton.classList.add('play-button');

  const topbar = el(
    'header',
    { class: 'topbar' },
    el(
      'div',
      { class: 'brand' },
      el('span', { class: 'brand-mark', text: 'U' }),
      el('div', { class: 'brand-text' }, 'UniTern', el('small', { text: '2D engine editor' })),
    ),
    el('div', { class: 'scene-field' }, dirtyDot, sceneName),
    el(
      'div',
      { class: 'topbar-group' },
      newButton,
      openButton,
      saveButton,
      exportButton,
      demoButton,
    ),
    el('div', { class: 'topbar-spacer' }),
    el('div', { class: 'topbar-group' }, undoButton, redoButton),
    el('div', { class: 'topbar-group' }, gridButton, snapButton),
    playButton,
  );

  const addNodeButton = iconButton('plus', 'Add node', () => addNode());
  const hierarchy = panel('Hierarchy', addNodeButton, 'hierarchy-body');

  const importAssetButton = iconButton('plus', 'Import image', () => importAssets());
  const inspector = panel('Inspector', null, 'inspector-body');
  const assets = panel('Assets', importAssetButton, 'assets-body');
  const inspectorPanel = el('aside', { class: 'panel inspector-panel' }, inspector.element, assets.element);

  const viewportHost = el('main', { class: 'viewport-host' });

  const statusSelection = el('span', { class: 'status-item', text: 'Root' });
  const statusCursor = el('span', { class: 'status-item status-cursor', text: '—' });
  const statusZoom = el('span', { class: 'status-item', text: '100%' });
  const statusFps = el('span', { class: 'status-item', text: '— fps' });
  const statusMode = el('span', { class: 'status-item status-mode', text: 'Editing' });
  const statusbar = el(
    'footer',
    { class: 'statusbar' },
    statusMode,
    el('span', { class: 'status-sep' }),
    statusSelection,
    el('span', { class: 'status-spacer' }),
    statusCursor,
    el('span', { class: 'status-sep' }),
    statusZoom,
    el('span', { class: 'status-sep' }),
    statusFps,
    el('span', { class: 'status-sep' }),
    el('span', { class: 'status-item status-hint', text: 'F frame · Del delete · Ctrl+D duplicate · Space pan' }),
  );

  const sceneFile = el('input', { attrs: { type: 'file', accept: '.json,application/json', hidden: true } });
  const assetFile = el('input', { attrs: { type: 'file', accept: 'image/*', multiple: true, hidden: true } });
  const toastHost = el('div', { class: 'toast-host' });

  root.append(topbar, hierarchy.element, viewportHost, inspectorPanel, statusbar, sceneFile, assetFile, toastHost);
  return {
    root,
    hierarchyBody: hierarchy.body,
    inspectorBody: inspector.body,
    assetsBody: assets.body,
    viewportHost,
    sceneName,
    dirtyDot,
    sceneFile,
    assetFile,
    toastHost,
    addNodeButton,
    importAssetButton,
    newButton,
    openButton,
    saveButton,
    exportButton,
    demoButton,
    undoButton,
    redoButton,
    gridButton,
    snapButton,
    playButton,
    statusSelection,
    statusCursor,
    statusZoom,
    statusFps,
    statusMode,
  };
}

const state = new EditorState(createSceneData('Untitled'));
const app = document.getElementById('app');
if (!app) throw new Error('Editor root element is missing');
const shell = buildShell();
app.append(shell.root);

const viewport = new Viewport(shell.viewportHost, state, {
  onStatus: (status) => updateStatus(status),
  onPlayChange: () => refreshToolbar(),
});

const ctx: EditorContext = {
  state,
  viewport,
  refresh,
  refreshToolbar,
  toast,
  importAssets,
  openScene,
  saveScene,
  exportGame,
};

function refresh(): void {
  renderHierarchy(shell.hierarchyBody, ctx);
  renderInspector(shell.inspectorBody, ctx);
  renderAssets(shell.assetsBody, ctx);
  refreshToolbar();
}

function refreshToolbar(): void {
  shell.undoButton.disabled = !state.canUndo;
  shell.redoButton.disabled = !state.canRedo;
  shell.gridButton.classList.toggle('is-active', viewport.gridVisible);
  shell.snapButton.classList.toggle('is-active', viewport.snapToGrid);
  shell.dirtyDot.classList.toggle('is-dirty', state.dirty);

  const label = viewport.playing ? 'Stop' : 'Play';
  shell.playButton.replaceChildren(svgIcon(viewport.playing ? 'stop' : 'play', 15), el('span', { text: label }));
  shell.playButton.classList.toggle('is-playing', viewport.playing);

  if (document.activeElement !== shell.sceneName) shell.sceneName.value = state.scene.name;
  const selected = state.findNode(state.selectedId);
  shell.statusSelection.textContent = selected ? selected.name : 'Nothing selected';
  shell.statusMode.textContent = viewport.playing ? 'Playing' : 'Editing';
  shell.statusMode.classList.toggle('is-playing', viewport.playing);
  document.title = `${state.dirty ? '• ' : ''}${state.scene.name} — UniTern Editor`;
}

function updateStatus(status: ViewportStatus): void {
  shell.statusZoom.textContent = `${Math.round(status.zoom * 100)}%`;
  shell.statusFps.textContent = `${Math.round(status.fps)} fps`;
  shell.statusCursor.textContent = status.cursor
    ? `${formatNumber(status.cursor.x, 1)}, ${formatNumber(status.cursor.y, 1)}`
    : '—';
  shell.statusFps.classList.toggle('is-dim', status.playing && status.fps === 0);
}

function toast(message: string, tone: 'info' | 'error' = 'info'): void {
  const node = el('div', { class: `toast toast-${tone}`, text: message });
  shell.toastHost.append(node);
  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 240);
  }, 2400);
}

function addNode(): void {
  const center = viewport.center();
  const x = Math.round(center.x / viewport.gridSize) * viewport.gridSize;
  const y = Math.round(center.y / viewport.gridSize) * viewport.gridSize;
  state.addNode(state.selectedId, [x, y]);
}

function toggleGrid(): void {
  viewport.gridVisible = !viewport.gridVisible;
  refreshToolbar();
}

function toggleSnap(): void {
  viewport.snapToGrid = !viewport.snapToGrid;
  refreshToolbar();
}

async function togglePlay(): Promise<void> {
  if (viewport.playing) {
    viewport.stop();
    return;
  }
  await viewport.play();
  if (viewport.playing) shell.playButton.blur();
}

function newScene(): void {
  if (state.dirty && !window.confirm('Discard unsaved changes and start a new scene?')) return;
  state.reset(createSceneData('Untitled'));
  requestAnimationFrame(() => viewport.frameAll());
  toast('New scene created');
}

function openScene(): void {
  shell.sceneFile.click();
}

function saveScene(): void {
  downloadFile(`${safeFileName(state.scene.name)}.unitern.json`, toSceneJson(state.scene));
  state.markSaved();
  toast('Scene saved');
}

async function exportGame(): Promise<void> {
  try {
    toast('Bundling game…');
    const html = await buildStandaloneHtml(state.scene);
    downloadFile(`${safeFileName(state.scene.name)}.html`, html, 'text/html');
    toast('Standalone game exported');
  } catch (error) {
    console.error(error);
    toast(error instanceof Error ? error.message : 'Could not export the game', 'error');
  }
}

function importAssets(): void {
  shell.assetFile.click();
}

async function loadDemo(): Promise<void> {
  try {
    const response = await fetch(new URL('./demo-scene.json', document.baseURI));
    if (!response.ok) throw new Error('Demo scene file is missing');
    const scene = normalizeScene(await response.json() as SceneData);
    if (state.dirty && !window.confirm('Discard unsaved changes and open the demo scene?')) return;
    state.reset(scene);
    requestAnimationFrame(() => viewport.frameAll());
    toast('Demo scene loaded');
  } catch (error) {
    console.error(error);
    toast('Could not load the demo scene', 'error');
  }
}

shell.sceneName.addEventListener('focus', () => state.beginTransaction());
shell.sceneName.addEventListener('input', () => {
  state.scene.name = shell.sceneName.value.trim() || 'Untitled';
  state.touch('view');
  refreshToolbar();
});
shell.sceneName.addEventListener('blur', () => {
  shell.sceneName.value = state.scene.name;
  setTimeout(() => state.endTransaction(), 0);
});
shell.sceneName.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') shell.sceneName.blur();
});

shell.sceneFile.addEventListener('change', async () => {
  const file = shell.sceneFile.files?.[0];
  shell.sceneFile.value = '';
  if (!file) return;
  try {
    const scene = normalizeScene(JSON.parse(await file.text()));
    if (state.dirty && !window.confirm('Discard unsaved changes and open this scene?')) return;
    state.reset(scene);
    requestAnimationFrame(() => viewport.frameAll());
    toast(`Opened ${scene.name}`);
  } catch (error) {
    console.error(error);
    toast('Could not open that scene file', 'error');
  }
});

shell.assetFile.addEventListener('change', async () => {
  const files = Array.from(shell.assetFile.files ?? []);
  shell.assetFile.value = '';
  if (files.length === 0) return;
  const assets: AssetData[] = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      assets.push({
        id: `asset-${Math.random().toString(36).slice(2, 10)}`,
        name: file.name,
        type: 'image',
        src: await fileToDataUrl(file),
      });
    } catch (error) {
      console.error(error);
      toast(`Could not import ${file.name}`, 'error');
    }
  }
  if (assets.length === 0) return;
  state.addAssets(assets);
  toast(`Imported ${assets.length} asset${assets.length === 1 ? '' : 's'}`);
});

state.subscribe((reason) => {
  if (reason === 'full') refresh();
  else refreshToolbar();
});

window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  const inField =
    target !== null &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
  const modifier = event.ctrlKey || event.metaKey;

  if (event.code === 'Space' && !inField && !viewport.playing) {
    event.preventDefault();
    viewport.setSpaceDown(true);
    return;
  }
  if (inField) return;

  if (modifier && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveScene();
    return;
  }
  if (modifier && event.key.toLowerCase() === 'o') {
    event.preventDefault();
    openScene();
    return;
  }
  if (modifier && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    if (event.shiftKey) state.redo();
    else state.undo();
    return;
  }
  if (modifier && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    state.redo();
    return;
  }
  if (modifier && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    if (state.selectedId) state.duplicateNode(state.selectedId);
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (state.selectedId && state.selectedId !== state.scene.root.id) {
      event.preventDefault();
      state.removeNode(state.selectedId);
    }
    return;
  }
  if (event.key.toLowerCase() === 'f') {
    viewport.focusSelection();
    return;
  }
  if (event.key === 'Escape') {
    if (viewport.playing) viewport.stop();
    else state.select(null);
  }
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') viewport.setSpaceDown(false);
});

window.addEventListener('blur', () => viewport.setSpaceDown(false));

window.addEventListener('beforeunload', (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

refresh();
refreshToolbar();
requestAnimationFrame(() => viewport.frameAll());
