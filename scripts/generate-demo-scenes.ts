/**
 * Regenerates templates/platformer/game.json and templates/starter/game.json.
 * Running this overwrites those scenes, so edit them in the editor only if you
 * do not intend to regenerate.
 *
 *   npm run demo:scene
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createComponentByType,
  createNodeData,
  createSceneData,
  type ComponentData,
  type NodeData,
  type SceneData,
} from '../src/index';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

function component(type: string, overrides: Record<string, unknown> = {}): ComponentData {
  const instance = createComponentByType(type);
  if (!instance) throw new Error(`Unknown component type: ${type}`);
  return { ...instance.toJSON(), ...overrides };
}

function node(name: string, x: number, y: number, id?: string): NodeData {
  const data = createNodeData(name, [x, y]);
  if (id) data.id = id;
  return data;
}

function shape(
  name: string,
  x: number,
  y: number,
  options: Record<string, unknown>,
  id?: string,
): NodeData {
  const data = node(name, x, y, id);
  data.components.push(component('shape', options));
  return data;
}

function platform(name: string, x: number, y: number, width: number, id: string): NodeData {
  const data = node(name, x, y, id);
  data.zIndex = 2;
  data.components.push(
    component('shape', {
      width,
      height: 24,
      color: '#1d4a3a',
      strokeColor: '#3c7a5f',
      lineWidth: 2,
      cornerRadius: 7,
    }),
    component('box-collider', { size: [width, 24] }),
  );
  return data;
}

function coin(id: string, x: number, y: number, phase: number): NodeData {
  const data = node('Coin', x, y, id);
  data.zIndex = 4;
  data.components.push(
    component('shape', { shape: 'circle', radius: 13, color: '#ffcf5c', strokeColor: '#fff0b8', lineWidth: 2 }),
    component('circle-collider', { radius: 18, isTrigger: true }),
    component('collectible', { value: 10, requiredTag: 'player' }),
    component('oscillator', { amplitude: [0, -5], frequency: 1.4, phase }),
  );
  return data;
}

function hill(name: string, x: number, y: number, factor: [number, number], color: string, bumps: Array<[number, number, number]>): NodeData {
  const data = node(name, x, y);
  data.zIndex = -8;
  data.components.push(component('parallax', { factor }));
  for (const [offsetX, offsetY, radius] of bumps) {
    data.children.push(shape('Hill', offsetX, offsetY, { shape: 'circle', radius, color }));
  }
  return data;
}

function buildPlatformer(): SceneData {
  const scene = createSceneData('Skyward Run');
  scene.settings.background = '#0c1424';
  scene.settings.gravity = [0, 1800];
  scene.root.children = [];

  const camera = node('Main Camera', 640, 360, 'main-camera');
  camera.components.push(
    component('camera', {
      followId: 'player',
      offset: [0, -60],
      damping: 7,
      bounds: [0, 0, 2400, 720],
    }),
  );
  scene.root.children.push(camera);

  const glow = shape('Sky Glow', 1200, 280, { shape: 'circle', radius: 420, color: '#152640' }, 'sky-glow');
  glow.zIndex = -20;
  glow.components.push(component('parallax', { factor: [0.12, 0.2] }));
  scene.root.children.push(glow);

  const stars = node('Stars', 1200, 150, 'stars');
  stars.zIndex = -15;
  stars.components.push(component('parallax', { factor: [0.06, 0.08] }));
  const starPositions: Array<[number, number, number]> = [
    [-880, 40, 2], [-620, -50, 3], [-360, 90, 2], [-80, -20, 2],
    [180, 60, 3], [420, -70, 2], [660, 30, 2], [900, -40, 3], [1080, 80, 2],
  ];
  for (const [x, y, radius] of starPositions) {
    stars.children.push(shape('Star', x, y, { shape: 'circle', radius, color: '#a9c6f0', opacity: 0.75 }));
  }
  scene.root.children.push(stars);

  scene.root.children.push(hill('Hills Far', 1200, 560, [0.3, 0.5], '#16283f', [
    [-820, 20, 300], [-260, -10, 340], [360, 30, 300], [920, 50, 280],
  ]));
  scene.root.children.push(hill('Hills Near', 1200, 610, [0.55, 0.8], '#101d2f', [
    [-760, 40, 240], [-120, 10, 280], [540, 50, 250], [1040, 20, 220],
  ]));

  const ground = shape('Ground', 1200, 700, {
    width: 2400,
    height: 160,
    color: '#17372c',
    strokeColor: '#2f6b52',
    lineWidth: 0,
  }, 'ground');
  ground.components.push(component('box-collider', { size: [2400, 160] }));
  const grass = shape('Grass', 0, -78, { width: 2400, height: 8, color: '#2f6b52' });
  grass.zIndex = 1;
  ground.children.push(grass);
  scene.root.children.push(ground);

  const platforms: Array<[string, number, number, number]> = [
    ['Platform A', 430, 530, 220],
    ['Platform B', 780, 436, 200],
    ['Platform C', 1120, 520, 260],
    ['Platform D', 1480, 420, 200],
    ['Platform E', 1830, 530, 240],
    ['Platform F', 2140, 430, 180],
  ];
  platforms.forEach(([name, x, y, width], index) => {
    const id = `platform-${String.fromCharCode(97 + index)}`;
    scene.root.children.push(platform(name, x, y, width, id));
    scene.root.children.push(coin(`coin-${index * 2 + 1}`, x - 38, y - 38, index * 0.6));
    scene.root.children.push(coin(`coin-${index * 2 + 2}`, x + 38, y - 38, index * 0.6 + 0.8));
  });

  const player = node('Player', 140, 540, 'player');
  player.zIndex = 5;
  player.tags = ['player'];
  player.components.push(
    component('shape', {
      width: 30,
      height: 44,
      color: '#7ad7ff',
      strokeColor: '#d6f4ff',
      lineWidth: 2,
      cornerRadius: 9,
    }),
    component('rigidbody', { mass: 1, maxSpeed: 1600, drag: 0 }),
    component('box-collider', { size: [28, 42] }),
    component('platformer-controller'),
  );
  const visor = shape('Visor', 7, -7, { width: 11, height: 6, color: '#08202f', cornerRadius: 3 });
  visor.zIndex = 2;
  const scarf = shape('Scarf', -17, 6, { width: 10, height: 20, color: '#ff8a65', cornerRadius: 4 });
  scarf.zIndex = 1;
  player.children.push(visor, scarf);
  scene.root.children.push(player);

  const goal = shape('Goal', 2320, 560, { width: 8, height: 120, color: '#ff8a65' }, 'goal');
  goal.zIndex = 3;
  const flag = shape('Flag', 34, -46, { width: 60, height: 34, color: '#ffcf5c', cornerRadius: 4 });
  goal.children.push(flag);
  scene.root.children.push(goal);

  const groundCoinA = coin('coin-ground-a', 600, 575, 0.3);
  const groundCoinB = coin('coin-ground-b', 980, 575, 1.1);
  scene.root.children.push(groundCoinA, groundCoinB);

  const hud = node('HUD', 24, 20, 'hud');
  hud.screenSpace = true;
  hud.zIndex = 100;
  const score = node('Score', 0, 0, 'hud-score');
  score.zIndex = 1;
  score.components.push(
    component('text', { text: 'SCORE 0', size: 26, weight: '800', color: '#eaf4ff' }),
    component('counter-text', { event: 'collect', template: 'SCORE {value}', accumulate: true, startingValue: 0 }),
  );
  const hint = node('Hint', 0, 40, 'hud-hint');
  hint.components.push(
    component('text', {
      text: 'A/D or arrows to run  ·  SPACE to jump',
      size: 13,
      weight: '600',
      color: '#8ba3c7',
    }),
  );
  hud.children.push(score, hint);
  scene.root.children.push(hud);

  return scene;
}

function buildStarter(): SceneData {
  const scene = createSceneData('Hello UniTern');
  scene.settings.background = '#0f172a';
  scene.root.children = [];

  const camera = node('Main Camera', 480, 270, 'main-camera');
  scene.root.children.push(camera);

  const hud = node('HUD', 32, 28, 'hud');
  hud.screenSpace = true;
  hud.zIndex = 10;
  const title = node('Title', 0, 0, 'title');
  title.components.push(
    component('text', { text: 'Hello, UniTern', size: 34, weight: '800', color: '#eaf4ff' }),
  );
  const subtitle = node('Subtitle', 0, 48, 'subtitle');
  subtitle.components.push(
    component('text', {
      text: 'Open this scene in the editor, then press Play.',
      size: 14,
      weight: '600',
      color: '#93a9c6',
    }),
  );
  hud.children.push(title, subtitle);
  scene.root.children.push(hud);

  const spinner = node('Spinner', 480, 300, 'spinner');
  spinner.zIndex = 1;
  spinner.components.push(
    component('shape', {
      width: 120,
      height: 120,
      color: '#5b9dff',
      strokeColor: '#bcd7ff',
      lineWidth: 2,
      cornerRadius: 18,
    }),
    component('spinner', { degreesPerSecond: 45 }),
  );
  const dot = shape('Dot', 0, 0, { shape: 'circle', radius: 16, color: '#6ee7b7' });
  spinner.children.push(dot);
  scene.root.children.push(spinner);

  const floor = shape('Floor', 480, 520, {
    width: 960,
    height: 80,
    color: '#16243a',
    strokeColor: '#243a58',
    lineWidth: 2,
    cornerRadius: 10,
  }, 'floor');
  floor.components.push(component('box-collider', { size: [960, 80] }));
  scene.root.children.push(floor);

  return scene;
}

async function writeScene(relativePath: string, scene: SceneData): Promise<void> {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(scene, null, 2)}\n`);
  console.log(`wrote ${relativePath}`);
}

await writeScene('templates/platformer/game.json', buildPlatformer());
await writeScene('templates/starter/game.json', buildStarter());
