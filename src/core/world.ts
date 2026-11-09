import type { AssetStore } from '../assets/assets';
import type { AudioManager } from '../audio/audio';
import type { Input } from '../input/input';
import { PhysicsSystem } from '../physics/physics-system';
import type { Collider2D } from '../physics/collider';
import { renderNodeTree } from '../render/scene-renderer';
import type { Renderer } from '../render/renderer';
import { Script } from './component';
import { EventBus } from './event-bus';
import { clamp, Vec2 } from './math';
import { Node } from './node';
import { buildScene, type BuiltScene } from './scene';
import { normalizeScene, type SceneData } from './scene-data';

export interface CameraState {
  position: Vec2;
  zoom: number;
  rotation: number;
}

export interface ContactEvent {
  a: Collider2D;
  b: Collider2D;
  normal: Vec2;
  depth: number;
}

export interface CollectEvent {
  value: number;
  node: Node;
}

export interface WorldEvents {
  'collision:enter': ContactEvent;
  'collision:exit': ContactEvent;
  'trigger:enter': ContactEvent;
  'trigger:exit': ContactEvent;
  collect: CollectEvent;
  [event: string]: unknown;
}

export interface WorldOptions {
  gravity?: Vec2 | [number, number];
  fixedStep?: number;
  maxSubSteps?: number;
  background?: string;
}

/** The simulation: a node tree, a clock, a camera and a physics solver. */
export class World {
  readonly root = new Node('Root');
  readonly events = new EventBus<WorldEvents>();
  readonly physics = new PhysicsSystem(this);

  gravity = new Vec2(0, 1800);
  fixedStep = 1 / 60;
  maxSubSteps = 5;
  timeScale = 1;
  paused = false;
  time = 0;
  fixedTime = 0;
  frame = 0;
  backgroundColor = '#0f1420';
  camera: CameraState = { position: new Vec2(), zoom: 1, rotation: 0 };
  viewport = { width: 1280, height: 720 };

  input: Input | null = null;
  audio: AudioManager | null = null;
  assets: AssetStore | null = null;

  private accumulator = 0;
  private destroyed = false;

  constructor(options: WorldOptions = {}) {
    this.root.attachToWorld(this);
    if (options.gravity) {
      if (options.gravity instanceof Vec2) this.gravity.copy(options.gravity);
      else this.gravity.set(options.gravity[0], options.gravity[1]);
    }
    if (options.fixedStep !== undefined) this.fixedStep = clamp(options.fixedStep, 1 / 240, 1 / 10);
    if (options.maxSubSteps !== undefined) this.maxSubSteps = Math.max(1, Math.floor(options.maxSubSteps));
    if (options.background) this.backgroundColor = options.background;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  add<T extends Node>(node: T): T {
    this.root.add(node);
    return node;
  }

  remove(node: Node): void {
    this.root.remove(node);
  }

  findById(id: string): Node | null {
    return this.root.findById(id);
  }

  findByName(name: string): Node | null {
    return this.root.findByName(name);
  }

  findByTag(tag: string): Node[] {
    return this.root.findByTag(tag);
  }

  addEventListener<K extends keyof WorldEvents>(event: K, listener: (payload: WorldEvents[K]) => void): () => void {
    return this.events.on(event, listener);
  }

  /** Replace the scene, resetting clock and camera. */
  loadScene(scene: SceneData): SceneData {
    const normalized = normalizeScene(scene);
    this.clear();
    const built: BuiltScene = buildScene(normalized);
    this.root.add(built.root);
    this.applySettings(normalized);
    this.resetClock();
    this.physics.reset();
    return normalized;
  }

  private applySettings(scene: SceneData): void {
    this.gravity.set(scene.settings.gravity[0], scene.settings.gravity[1]);
    this.fixedStep = clamp(scene.settings.fixedStep, 1 / 240, 1 / 10);
    this.backgroundColor = scene.settings.background;
    this.camera.position.set(0, 0);
    this.camera.zoom = 1;
    this.camera.rotation = 0;
  }

  resetClock(): void {
    this.time = 0;
    this.fixedTime = 0;
    this.frame = 0;
    this.accumulator = 0;
  }

  /** Remove every node from the world. */
  clear(): void {
    for (const child of [...this.root.children]) child.destroy();
    this.physics.reset();
  }

  private collectScripts(): Script[] {
    const scripts: Script[] = [];
    const walk = (node: Node): void => {
      if (!node.active || node.destroyed) return;
      for (const component of node.components) {
        if (component.enabled && component instanceof Script && component.node.activeInHierarchy) {
          scripts.push(component);
        }
      }
      for (const child of node.children) walk(child);
    };
    walk(this.root);
    return scripts;
  }

  /** Advance the simulation. `dt` is clamped to avoid huge catch-up steps. */
  update(dt: number): void {
    if (this.destroyed || this.paused) {
      this.input?.endFrame();
      return;
    }
    const frameDt = Math.min(Math.max(dt, 0), 0.1) * Math.max(this.timeScale, 0);
    const scripts = this.collectScripts();
    for (const script of scripts) script.startIfNeeded();

    this.accumulator += frameDt;
    let steps = 0;
    while (this.accumulator + 1e-9 >= this.fixedStep && steps < this.maxSubSteps) {
      this.accumulator -= this.fixedStep;
      this.fixedTime += this.fixedStep;
      steps++;
      for (const script of scripts) {
        if (!script.node.destroyed) script.fixedUpdate(this.fixedStep);
      }
      this.physics.step(this.fixedStep);
    }
    if (steps >= this.maxSubSteps) this.accumulator = 0;

    this.time += frameDt;
    this.frame++;

    for (const script of scripts) {
      if (!script.node.destroyed) script.update(frameDt);
    }
    for (const script of scripts) {
      if (!script.node.destroyed) script.lateUpdate(frameDt);
    }

    this.input?.endFrame();
  }

  render(renderer: Renderer, debugPhysics = false): void {
    renderer.beginFrame(this.camera, { background: this.backgroundColor, clear: true });
    renderNodeTree(this.root, renderer);
    if (debugPhysics) this.physics.debugDraw(renderer);
    renderer.endFrame();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.clear();
    this.events.clear();
    this.input = null;
    this.audio = null;
    this.assets = null;
  }
}
