import { Node } from './node';
import { createComponent } from './registry';
import type { ComponentData } from './fields';
import { SCENE_VERSION, type NodeData, type SceneData, type SceneSettings } from './scene-data';

export interface BuiltScene {
  root: Node;
  settings: SceneSettings;
}

function warn(message: string): void {
  // eslint-disable-next-line no-console
  console.warn(`[unitern] ${message}`);
}

function instantiateNode(data: NodeData, usedIds: Set<string>): Node {
  let id = data.id;
  while (usedIds.has(id)) id = `${id}-1`;
  usedIds.add(id);

  const node = new Node(data.name, id);
  node.active = data.active;
  node.visible = data.visible;
  node.screenSpace = data.screenSpace;
  node.tags = [...data.tags];
  node.position.set(data.position[0], data.position[1]);
  node.rotation = data.rotation;
  node.scale.set(data.scale[0], data.scale[1]);
  node.zIndex = data.zIndex;

  for (const componentData of data.components) {
    const component = createComponent(componentData);
    if (!component) {
      warn(`unknown component type "${componentData.type}" on node "${data.name}"`);
      continue;
    }
    node.addComponent(component);
  }

  for (const child of data.children) node.add(instantiateNode(child, usedIds));
  return node;
}

/** Turn scene data into a live node tree (not attached to a world yet). */
export function buildScene(scene: SceneData): BuiltScene {
  const usedIds = new Set<string>();
  return {
    root: instantiateNode(scene.root, usedIds),
    settings: {
      background: scene.settings.background,
      gravity: [scene.settings.gravity[0], scene.settings.gravity[1]],
      fixedStep: scene.settings.fixedStep,
    },
  };
}

function serializeComponent(component: Node['components'][number]): ComponentData {
  return component.toJSON();
}

export function serializeNode(node: Node): NodeData {
  return {
    id: node.id,
    name: node.name,
    active: node.active,
    visible: node.visible,
    screenSpace: node.screenSpace,
    tags: [...node.tags],
    position: [node.position.x, node.position.y],
    rotation: node.rotation,
    scale: [node.scale.x, node.scale.y],
    zIndex: node.zIndex,
    components: node.components.map(serializeComponent),
    children: node.children.map(serializeNode),
  };
}

export function serializeScene(
  root: Node,
  options: { name?: string; settings?: SceneSettings; assets?: SceneData['assets'] } = {},
): SceneData {
  return {
    version: SCENE_VERSION,
    name: options.name ?? 'Untitled',
    settings: options.settings ?? { background: '#0f1420', gravity: [0, 1800], fixedStep: 1 / 60 },
    assets: options.assets ?? [],
    root: serializeNode(root),
  };
}
