import { describe, expect, it } from 'vitest';
import {
  buildScene,
  createComponentByType,
  createNodeData,
  createSceneData,
  encodeField,
  getComponentConstructor,
  isComponentTypeRegistered,
  listComponentSchemas,
  normalizeScene,
  serializeScene,
  countNodes,
  Node,
  World,
} from '../src/index';

function sampleScene() {
  const scene = createSceneData('Sample');
  const hero = createNodeData('Hero', [120, 300]);
  hero.tags.push('player');
  hero.scale = [1, 1];
  hero.components.push(
    { type: 'sprite', assetId: 'hero-art', width: 64, height: 64, anchor: [0.5, 1], opacity: 0.9, flipX: true, flipY: false, zIndex: 4 },
    { type: 'rigidbody', bodyType: 'dynamic', velocity: [0, 0], gravityScale: 1, drag: 0.2, mass: 2, maxSpeed: 900 },
    { type: 'box-collider', size: [28, 60], offset: [0, -30], isTrigger: false, layer: 1, mask: 65535 },
    { type: 'platformer-controller', moveSpeed: 280, groundAcceleration: 2000, airAcceleration: 1200, jumpVelocity: 640, coyoteTime: 0.12, jumpBufferTime: 0.1, jumpCutMultiplier: 0.4, maxFallSpeed: 1000 },
    { type: 'animator', frameWidth: 64, frameHeight: 64, columns: 4, frames: 8, fps: 12, loop: true, playing: true, startFrame: 0 },
  );
  scene.root.children.push(hero);

  const coin = createNodeData('Coin', [200, 280]);
  coin.components.push(
    { type: 'shape', shape: 'circle', width: 24, height: 24, radius: 12, cornerRadius: 0, color: '#ffcc44', strokeColor: '#00000000', lineWidth: 0, opacity: 1, zIndex: 1 },
    { type: 'circle-collider', radius: 14, offset: [0, 0], isTrigger: true, layer: 1, mask: 65535 },
    { type: 'collectible', value: 25, requiredTag: 'player', destroyOnCollect: true, sound: false },
    { type: 'oscillator', amplitude: [0, 8], frequency: 2, phase: 0.5 },
  );
  scene.root.children.push(coin);

  const hud = createNodeData('HUD', [24, 24]);
  hud.screenSpace = true;
  hud.components.push(
    { type: 'text', text: 'SCORE 0', size: 20, color: '#ffffff', weight: '700', align: 'left', lineHeight: 0, opacity: 1, zIndex: 100 },
    { type: 'counter-text', event: 'collect', template: 'SCORE {value}', accumulate: true, startingValue: 0 },
  );
  scene.root.children.push(hud);

  scene.assets.push({ id: 'hero-art', name: 'hero.png', type: 'image', src: 'data:image/png;base64,AAAA' });
  scene.settings.background = '#101820';
  scene.settings.gravity = [0, 2200];
  return scene;
}

describe('scene serialization', () => {
  it('round-trips every registered component through a live world', () => {
    const scene = sampleScene();
    const first = serializeScene(buildScene(normalizeScene(scene)).root, {
      name: scene.name,
      settings: scene.settings,
      assets: scene.assets,
    });
    const second = serializeScene(buildScene(normalizeScene(first)).root, {
      name: first.name,
      settings: first.settings,
      assets: first.assets,
    });
    expect(second).toEqual(first);

    const hero = first.root.children.find((node) => node.name === 'Hero');
    expect(hero).toBeDefined();
    expect(hero!.tags).toEqual(['player']);
    expect(hero!.components.map((component) => component.type)).toEqual([
      'sprite',
      'rigidbody',
      'box-collider',
      'platformer-controller',
      'animator',
    ]);
    const body = hero!.components.find((component) => component.type === 'rigidbody')!;
    expect(body.mass).toBe(2);
    expect(body.drag).toBe(0.2);
  });

  it('instantiates a playable world with physics and behaviours', () => {
    const scene = normalizeScene(sampleScene());
    const world = new World();
    world.loadScene(scene);

    expect(world.gravity.y).toBe(2200);
    expect(world.backgroundColor).toBe('#101820');
    expect(world.root.children).toHaveLength(1); // Root
    const sceneRoot = world.root.children[0];
    expect(countNodes(scene.root)).toBe(5);
    expect(sceneRoot.findByName('Hero')).not.toBeNull();
    expect(sceneRoot.findByTag('player')).toHaveLength(1);
    expect(sceneRoot.findByName('HUD')?.screenSpace).toBe(true);
    world.destroy();
  });

  it('repairs malformed scene data', () => {
    const repaired = normalizeScene({
      name: '  ',
      settings: { background: '', gravity: ['nope', 5], fixedStep: 99 },
      assets: [{ id: 'a', type: 'image', src: 'data:image/png;base64,AA' }, { nope: true }],
      root: {
        id: 'dup',
        name: 'Root',
        position: ['x', Infinity],
        scale: [0, 'bad'],
        components: [{ type: 'sprite' }, { type: 42 }, null],
        children: [{ id: 'dup', name: '', children: [{ id: 'dup' }] }],
      },
    });

    expect(repaired.name).toBe('Untitled');
    expect(repaired.settings.background).toBe('#0f1420');
    expect(repaired.settings.gravity).toEqual([0, 5]);
    expect(repaired.settings.fixedStep).toBeLessThanOrEqual(1 / 10);
    expect(repaired.root.position.every(Number.isFinite)).toBe(true);
    expect(repaired.root.scale).toEqual([0, 1]);
    expect(repaired.root.components).toHaveLength(1);
    expect(repaired.assets).toHaveLength(1);
    const ids = new Set<string>();
    const walk = (node: typeof repaired.root) => {
      ids.add(node.id);
      node.children.forEach(walk);
    };
    walk(repaired.root);
    expect(ids.size).toBe(3);
  });

  it('keeps unknown component types in data but skips them when building', () => {
    const scene = normalizeScene({
      root: {
        name: 'Root',
        components: [{ type: 'from-the-future', someValue: 7 }],
      },
    });
    expect(scene.root.components[0].type).toBe('from-the-future');
    const built = buildScene(scene);
    expect(built.root.components).toHaveLength(0);
  });

  it('serializes live runtime changes', () => {
    const root = new Node('Root');
    const child = new Node('Child');
    child.position.set(4, 9);
    child.rotation = 1.5;
    child.addComponent(createComponentByType('text')!);
    root.add(child);
    const data = serializeScene(root);
    expect(data.root.children[0].position).toEqual([4, 9]);
    expect(data.root.children[0].rotation).toBe(1.5);
    expect(data.root.children[0].components[0].text).toBe('Text');
  });
});

describe('component schemas', () => {
  it('are unique, registered and self-consistent with class defaults', () => {
    const schemas = listComponentSchemas();
    expect(schemas.length).toBeGreaterThanOrEqual(12);
    const types = new Set<string>();
    for (const schema of schemas) {
      expect(types.has(schema.type)).toBe(false);
      types.add(schema.type);
      expect(isComponentTypeRegistered(schema.type)).toBe(true);

      const ctor = getComponentConstructor(schema.type);
      expect(ctor).toBeDefined();
      const instance = new ctor!();
      const serialized = instance.toJSON();
      expect(serialized.type).toBe(schema.type);
      // Fresh instances must match declared defaults, otherwise the inspector
      // and serializer disagree about what a new component contains.
      for (const field of schema.fields) {
        expect({
          key: field.key,
          value: serialized[field.key],
        }).toEqual({ key: field.key, value: encodeField(field, schema.defaults[field.key]) });
      }
    }
  });

  it('lists the documented built-in component types', () => {
    const types = listComponentSchemas().map((schema) => schema.type);
    expect(types).toEqual(
      expect.arrayContaining([
        'camera',
        'sprite',
        'shape',
        'text',
        'animator',
        'rigidbody',
        'box-collider',
        'circle-collider',
        'platformer-controller',
        'oscillator',
        'spinner',
        'parallax',
        'collectible',
        'counter-text',
      ]),
    );
  });
});
