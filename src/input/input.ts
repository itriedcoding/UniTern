import { Vec2 } from '../core/math';

export interface InputOptions {
  canvas?: HTMLCanvasElement | null;
  target?: EventTarget | null;
  /** Keys whose browser default is suppressed while the canvas has focus. */
  preventDefaultKeys?: string[];
  /** Maps canvas-relative CSS pixels to world coordinates. */
  toWorld?: ((x: number, y: number) => { x: number; y: number }) | null;
}

export interface PointerState {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  down: boolean;
  pressed: boolean;
  released: boolean;
}

const DEFAULT_PREVENT = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

/** Keyboard and pointer state for one game instance. */
export class Input {
  private target: EventTarget | null;
  private canvas: HTMLCanvasElement | null;
  private preventDefaultKeys: Set<string>;
  private keysDown = new Set<string>();
  private keysPressed = new Set<string>();
  private keysReleased = new Set<string>();
  private toWorld: ((x: number, y: number) => { x: number; y: number }) | null;
  private disposed = false;
  private listeners: Array<[EventTarget, string, EventListener]> = [];

  readonly pointer: PointerState = {
    x: 0,
    y: 0,
    worldX: 0,
    worldY: 0,
    down: false,
    pressed: false,
    released: false,
  };

  constructor(options: InputOptions = {}) {
    this.canvas = options.canvas ?? null;
    this.target = options.target ?? (typeof window !== 'undefined' ? window : null);
    this.preventDefaultKeys = new Set(options.preventDefaultKeys ?? DEFAULT_PREVENT);
    this.toWorld = options.toWorld ?? null;
    this.bind();
  }

  setWorldMapper(mapper: ((x: number, y: number) => { x: number; y: number }) | null): void {
    this.toWorld = mapper;
  }

  private bind(): void {
    const target = this.target;
    if (!target) return;
    this.add(target, 'keydown', ((event: KeyboardEvent) => {
      if (this.shouldIgnore(event)) return;
      if (this.preventDefaultKeys.has(event.code) && this.isCanvasFocused()) event.preventDefault();
      if (!this.keysDown.has(event.code)) {
        this.keysDown.add(event.code);
        this.keysPressed.add(event.code);
      }
    }) as EventListener);
    this.add(target, 'keyup', ((event: KeyboardEvent) => {
      if (this.keysDown.has(event.code)) {
        this.keysDown.delete(event.code);
        this.keysReleased.add(event.code);
      }
    }) as EventListener);
    this.add(target, 'blur', (() => {
      this.keysDown.clear();
      this.keysPressed.clear();
      this.keysReleased.clear();
    }) as EventListener);

    const canvas = this.canvas;
    if (canvas) {
      this.add(canvas, 'pointermove', ((event: PointerEvent) => {
        this.updatePointerPosition(event);
      }) as EventListener);
      this.add(canvas, 'pointerdown', ((event: PointerEvent) => {
        this.updatePointerPosition(event);
        if (!this.pointer.down) {
          this.pointer.down = true;
          this.pointer.pressed = true;
        }
        canvas.setPointerCapture?.(event.pointerId);
        canvas.focus?.();
      }) as EventListener);
      this.add(canvas, 'pointerup', ((event: PointerEvent) => {
        this.updatePointerPosition(event);
        if (this.pointer.down) {
          this.pointer.down = false;
          this.pointer.released = true;
        }
        canvas.releasePointerCapture?.(event.pointerId);
      }) as EventListener);
      this.add(canvas, 'pointerleave', (() => {
        if (this.pointer.down) {
          this.pointer.down = false;
          this.pointer.released = true;
        }
      }) as EventListener);
    }
  }

  private add(target: EventTarget, type: string, listener: EventListener): void {
    target.addEventListener(type, listener);
    this.listeners.push([target, type, listener]);
  }

  private isCanvasFocused(): boolean {
    if (!this.canvas || typeof document === 'undefined') return false;
    const active = document.activeElement;
    return active === this.canvas || active === document.body || active === null;
  }

  private shouldIgnore(event: KeyboardEvent): boolean {
    if (!(event.target instanceof HTMLElement)) return false;
    const tag = event.target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable;
  }

  private updatePointerPosition(event: PointerEvent): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * canvas.clientWidth;
    const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * canvas.clientHeight;
    this.pointer.x = x;
    this.pointer.y = y;
    if (this.toWorld) {
      const world = this.toWorld(x, y);
      this.pointer.worldX = world.x;
      this.pointer.worldY = world.y;
    }
  }

  isDown(...codes: string[]): boolean {
    return codes.some((code) => this.keysDown.has(code));
  }

  isPressed(...codes: string[]): boolean {
    return codes.some((code) => this.keysPressed.has(code));
  }

  isReleased(...codes: string[]): boolean {
    return codes.some((code) => this.keysReleased.has(code));
  }

  axis(negative: string[], positive: string[]): number {
    const left = negative.some((code) => this.keysDown.has(code)) ? 1 : 0;
    const right = positive.some((code) => this.keysDown.has(code)) ? 1 : 0;
    return right - left;
  }

  get worldPointer(): Vec2 {
    return new Vec2(this.pointer.worldX, this.pointer.worldY);
  }

  /** Clear one-frame state. Called automatically by the world. */
  endFrame(): void {
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.pointer.pressed = false;
    this.pointer.released = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const [target, type, listener] of this.listeners) {
      target.removeEventListener(type, listener);
    }
    this.listeners = [];
    this.keysDown.clear();
    this.keysPressed.clear();
    this.keysReleased.clear();
  }
}
