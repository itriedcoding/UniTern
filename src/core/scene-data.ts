import { createComponentByType } from './registry';
import type { ComponentData } from './fields';

/**
 * Plain-data scene format. The editor edits this structure directly, and the
 * engine turns it into a live scene graph.
 */

export const SCENE_VERSION = 1;

export interface AssetData {
  id: string;
  name: string;
  type: 'image' | 'audio' | 'json';
  /** Usually a data URL so scenes stay self-contained. */
  src: string;
}

export interface SceneSettings {
  background: string;
  gravity: [number, number];
  fixedStep: number;
}

export interface NodeData {
  id: string;
  name: string;
  active: boolean;
  visible: boolean;
  screenSpace: boolean;
  tags: string[];
  position: [number, number];
  rotation: number;
  scale: [number, number];
  zIndex: number;
  components: ComponentData[];
  children: NodeData[];
}

export interface SceneData {
  version: number;
  name: string;
  settings: SceneSettings;
  assets: AssetData[];
  root: NodeData;
}

const DEFAULT_SETTINGS: SceneSettings = {
  background: '#0f1420',
  gravity: [0, 1800],
  fixedStep: 1 / 60,
};

export function createNodeData(name = 'Node', position: [number, number] = [0, 0]): NodeData {
  return {
    id: makeId('node'),
    name,
    active: true,
    visible: true,
    screenSpace: false,
    tags: [],
    position: [...position],
    rotation: 0,
    scale: [1, 1],
    zIndex: 0,
    components: [],
    children: [],
  };
}

export function makeId(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Build a fresh scene containing a root and a camera. */
export function createSceneData(name = 'Untitled'): SceneData {
  const root = createNodeData('Root');
  const cameraComponent = createComponentByType('camera')?.toJSON();
  if (cameraComponent) {
    const camera = createNodeData('Main Camera');
    camera.components.push(cameraComponent);
    root.children.push(camera);
  }
  return {
    version: SCENE_VERSION,
    name,
    settings: { ...DEFAULT_SETTINGS, gravity: [...DEFAULT_SETTINGS.gravity] },
    assets: [],
    root,
  };
}

export function emptySettings(): SceneSettings {
  return { ...DEFAULT_SETTINGS, gravity: [...DEFAULT_SETTINGS.gravity] };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function pair(value: unknown, fallback: [number, number]): [number, number] {
  if (Array.isArray(value) && value.length >= 2) {
    return [numberOr(value[0], fallback[0]), numberOr(value[1], fallback[1])];
  }
  return [...fallback];
}

function normalizeComponent(input: unknown): ComponentData | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  if (typeof record.type !== 'string' || record.type.length === 0) return null;
  return { ...record, type: record.type };
}

function normalizeNode(input: unknown, usedIds: Set<string>, depth: number): NodeData {
  const record = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  let id = typeof record.id === 'string' && record.id.length > 0 ? record.id : makeId('node');
  while (usedIds.has(id)) id = makeId('node');
  usedIds.add(id);

  const name = typeof record.name === 'string' && record.name.trim().length > 0 ? record.name.trim() : 'Node';
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === 'string' && tag.length > 0)
    : [];
  const components = Array.isArray(record.components)
    ? record.components.map(normalizeComponent).filter((component): component is ComponentData => component !== null)
    : [];

  const node: NodeData = {
    id,
    name,
    active: record.active !== false,
    visible: record.visible !== false,
    screenSpace: record.screenSpace === true,
    tags,
    position: pair(record.position, [0, 0]),
    rotation: numberOr(record.rotation, 0),
    scale: pair(record.scale, [1, 1]),
    zIndex: numberOr(record.zIndex, 0),
    components,
    children: [],
  };

  if (depth < 512 && Array.isArray(record.children)) {
    for (const child of record.children) {
      node.children.push(normalizeNode(child, usedIds, depth + 1));
    }
  }
  return node;
}

function normalizeAsset(input: unknown): AssetData | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  if (typeof record.src !== 'string' || record.src.length === 0) return null;
  const type = record.type === 'audio' || record.type === 'json' ? record.type : 'image';
  return {
    id: typeof record.id === 'string' && record.id.length > 0 ? record.id : makeId('asset'),
    name: typeof record.name === 'string' && record.name.length > 0 ? record.name : 'asset',
    type,
    src: record.src,
  };
}

/** Validate and repair arbitrary JSON into a scene the engine can load. */
export function normalizeScene(input: unknown): SceneData {
  const record = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const settingsRecord = (record.settings && typeof record.settings === 'object' ? record.settings : {}) as Record<
    string,
    unknown
  >;
  const usedIds = new Set<string>();
  const usedAssetIds = new Set<string>();

  const assets: AssetData[] = [];
  if (Array.isArray(record.assets)) {
    for (const raw of record.assets) {
      const asset = normalizeAsset(raw);
      if (!asset) continue;
      while (usedAssetIds.has(asset.id)) asset.id = makeId('asset');
      usedAssetIds.add(asset.id);
      assets.push(asset);
    }
  }

  const fixedStep = numberOr(settingsRecord.fixedStep, DEFAULT_SETTINGS.fixedStep);
  const gravityRecord = settingsRecord.gravity;

  return {
    version: SCENE_VERSION,
    name: typeof record.name === 'string' && record.name.trim().length > 0 ? record.name.trim() : 'Untitled',
    settings: {
      background:
        typeof settingsRecord.background === 'string' && settingsRecord.background.length > 0
          ? settingsRecord.background
          : DEFAULT_SETTINGS.background,
      gravity: pair(gravityRecord, DEFAULT_SETTINGS.gravity),
      fixedStep: Math.min(Math.max(fixedStep, 1 / 240), 1 / 10),
    },
    assets,
    root: normalizeNode(record.root, usedIds, 0),
  };
}

export function cloneSceneData(scene: SceneData): SceneData {
  return normalizeScene(JSON.parse(JSON.stringify(scene)));
}

export function countNodes(node: NodeData): number {
  let total = 1;
  for (const child of node.children) total += countNodes(child);
  return total;
}
