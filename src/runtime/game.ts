import { AssetStore } from '../assets/assets';
import { AudioManager } from '../audio/audio';
import { normalizeScene, type SceneData } from '../core/scene-data';
import { Input } from '../input/input';
import { Renderer } from '../render/renderer';
import { World } from '../core/world';

export interface GameOptions {
  canvas: HTMLCanvasElement;
  scene: SceneData;
  autoResize?: boolean;
  debugPhysics?: boolean;
  /** Called once assets have loaded and the scene is running. */
  onReady?: () => void;
}

export interface GameStats {
  fps: number;
  frameTime: number;
  drawCalls: number;
}

/**
 * Boots a scene into a canvas and runs the frame loop.
 *
 * ```ts
 * const game = new Game({ canvas, scene });
 * await game.load();
 * game.start();
 * ```
 */
export class Game {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: Renderer;
  readonly world = new World();
  readonly input: Input;
  readonly audio = new AudioManager();
  assets: AssetStore;
  scene: SceneData;
  autoResize: boolean;
  debugPhysics: boolean;

  running = false;
  paused = false;
  stats: GameStats = { fps: 0, frameTime: 0, drawCalls: 0 };

  private raf = 0;
  private lastTime = 0;
  private fpsAccumulator = 0;
  private fpsFrames = 0;
  private readonly onReady: (() => void) | undefined;
  private resizeObserver: ResizeObserver | null = null;
  private readonly handleWindowResize = (): void => this.resize();

  constructor(options: GameOptions) {
    this.canvas = options.canvas;
    this.scene = normalizeScene(options.scene);
    this.autoResize = options.autoResize !== false;
    this.debugPhysics = options.debugPhysics === true;
    this.onReady = options.onReady;

    if (!this.canvas.hasAttribute('tabindex')) this.canvas.tabIndex = 0;
    this.canvas.style.outline = 'none';
    this.renderer = new Renderer(this.canvas);
    this.input = new Input({
      canvas: this.canvas,
      toWorld: (x, y) => this.renderer.screenToWorld(x, y),
    });
    this.assets = new AssetStore(this.scene.assets);

    this.world.input = this.input;
    this.world.audio = this.audio;
    this.world.assets = this.assets;
    this.world.loadScene(this.scene);
    this.resize();
    this.attachResizeHandling();
  }

  private attachResizeHandling(): void {
    if (!this.autoResize || typeof window === 'undefined') return;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
    } else {
      window.addEventListener('resize', this.handleWindowResize);
    }
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    const width = this.canvas.clientWidth || parent?.clientWidth || this.canvas.width || 960;
    const height = this.canvas.clientHeight || parent?.clientHeight || this.canvas.height || 540;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.renderer.resize(width, height, dpr);
    this.world.viewport.width = width;
    this.world.viewport.height = height;
  }

  /** Preload scene assets. Call before `start()` for correct first frames. */
  async load(): Promise<void> {
    await this.assets.preload();
    this.world.assets = this.assets;
    this.resize();
    this.onReady?.();
  }

  /** Replace the running scene. Keeps input, audio and the renderer. */
  async restart(scene: SceneData = this.scene): Promise<void> {
    const wasRunning = this.running;
    this.stop();
    const normalized = normalizeScene(scene);
    const assetsChanged = JSON.stringify(normalized.assets) !== JSON.stringify(this.scene.assets);
    this.scene = normalized;
    if (assetsChanged) {
      this.assets = new AssetStore(normalized.assets);
      this.world.assets = this.assets;
      await this.assets.preload();
    }
    this.world.loadScene(normalized);
    this.world.render(this.renderer, this.debugPhysics);
    if (wasRunning) this.start();
  }

  start(): void {
    if (this.running || typeof requestAnimationFrame === 'undefined') return;
    this.running = true;
    this.paused = false;
    this.world.paused = false;
    this.resize();
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.paused = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.input.endFrame();
  }

  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.world.paused = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.world.paused = false;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0), 0.1) : 0;

    this.world.update(dt);
    this.world.render(this.renderer, this.debugPhysics);

    this.fpsAccumulator += dt;
    this.fpsFrames++;
    if (this.fpsAccumulator >= 0.5) {
      this.stats.fps = this.fpsFrames / this.fpsAccumulator;
      this.stats.frameTime = dt;
      this.stats.drawCalls = this.renderer.drawCalls;
      this.fpsAccumulator = 0;
      this.fpsFrames = 0;
    }

    this.raf = requestAnimationFrame(this.tick);
  };

  destroy(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.handleWindowResize);
    this.input.dispose();
    this.audio.destroy();
    this.world.destroy();
  }
}
