import {
  AssetStore,
  Collider2D,
  Game,
  Node,
  Rect,
  Renderer,
  ShapeRenderer,
  SpriteRenderer,
  TextRenderer,
  Vec2,
  World,
  buildScene,
  clamp,
  renderNodeTree,
  type SceneData,
} from '../src/index';
import type { EditorState } from './state';

export interface ViewportStatus {
  zoom: number;
  fps: number;
  cursor: { x: number; y: number } | null;
  playing: boolean;
}

export interface ViewportCallbacks {
  onStatus(status: ViewportStatus): void;
  onPlayChange(playing: boolean): void;
}

interface PanDrag {
  mode: 'pan';
  startX: number;
  startY: number;
  viewX: number;
  viewY: number;
}

interface MoveDrag {
  mode: 'move';
  nodeId: string;
  startWorld: Vec2;
  startPosition: [number, number];
  parentInverse: { transformVector(vector: { x: number; y: number }): { x: number; y: number } } | null;
}

type DragState = PanDrag | MoveDrag | null;

/** The central editing canvas: renders the scene, handles picking and play mode. */
export class Viewport {
  readonly element: HTMLElement;
  readonly editCanvas: HTMLCanvasElement;
  readonly playCanvas: HTMLCanvasElement;

  gridVisible = true;
  snapToGrid = true;
  gridSize = 32;
  playing = false;

  private readonly state: EditorState;
  private readonly callbacks: ViewportCallbacks;
  private readonly renderer: Renderer;
  private readonly world = new World();
  private assets = new AssetStore();
  private assetsKey = '';
  private view = { position: new Vec2(0, 0), zoom: 1, rotation: 0 };
  private treeVersion = -1;
  private raf = 0;
  private game: Game | null = null;
  private drag: DragState = null;
  private spaceDown = false;
  private pointer = { x: 0, y: 0, inside: false };
  private fps = 60;
  private lastFrame = performance.now();
  private statusTimer = 0;

  constructor(host: HTMLElement, state: EditorState, callbacks: ViewportCallbacks) {
    this.state = state;
    this.callbacks = callbacks;
    this.element = document.createElement('div');
    this.element.className = 'viewport';
    this.editCanvas = document.createElement('canvas');
    this.editCanvas.className = 'viewport-canvas';
    this.editCanvas.tabIndex = 0;
    this.playCanvas = document.createElement('canvas');
    this.playCanvas.className = 'viewport-canvas';
    this.playCanvas.tabIndex = 0;
    this.playCanvas.style.display = 'none';
    this.element.append(this.editCanvas, this.playCanvas);
    host.append(this.element);

    this.renderer = new Renderer(this.editCanvas);
    this.world.assets = this.assets;
    this.bindEvents();
    this.raf = requestAnimationFrame(this.frame);
    this.syncTree();
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.stop();
    this.raf = 0;
  }

  setSpaceDown(value: boolean): void {
    this.spaceDown = value;
    this.updateCursor();
  }

  center(): Vec2 {
    return new Vec2(this.view.position.x, this.view.position.y);
  }

  private get viewWidth(): number {
    return this.editCanvas.clientWidth || 800;
  }

  private get viewHeight(): number {
    return this.editCanvas.clientHeight || 600;
  }

  private localPoint(event: PointerEvent | WheelEvent): { x: number; y: number } {
    const rect = this.editCanvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / Math.max(rect.width, 1)) * this.viewWidth,
      y: ((event.clientY - rect.top) / Math.max(rect.height, 1)) * this.viewHeight,
    };
  }

  private screenToWorld(x: number, y: number): Vec2 {
    const zoom = this.view.zoom;
    return new Vec2(
      this.view.position.x + (x - this.viewWidth / 2) / zoom,
      this.view.position.y + (y - this.viewHeight / 2) / zoom,
    );
  }

  private bindEvents(): void {
    const canvas = this.editCanvas;
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', () => {
      this.pointer.inside = false;
    });
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('pointerenter', () => {
      this.pointer.inside = true;
    });
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.playing) return;
    const point = this.localPoint(event);
    this.editCanvas.focus();
    this.editCanvas.setPointerCapture(event.pointerId);

    if (event.button === 1 || event.button === 2 || event.altKey || this.spaceDown) {
      event.preventDefault();
      this.drag = {
        mode: 'pan',
        startX: point.x,
        startY: point.y,
        viewX: this.view.position.x,
        viewY: this.view.position.y,
      };
      this.updateCursor();
      return;
    }
    if (event.button !== 0) return;

    const world = this.screenToWorld(point.x, point.y);
    const selected = this.state.selectedId ? this.world.findById(this.state.selectedId) : null;
    if (selected && !selected.screenSpace) {
      const bounds = nodeBounds(selected, this.renderer);
      if (bounds && bounds.contains(world)) {
        this.beginMove(selected, world);
        return;
      }
    }
    const hit = this.pick(world);
    if (!hit) {
      this.state.select(null);
      return;
    }
    this.state.select(hit.id);
    this.beginMove(hit, world);
  };

  private beginMove(node: Node, world: Vec2): void {
    this.state.beginTransaction();
    const parentInverse = node.parent ? node.parent.worldMatrix.invert() : null;
    this.drag = {
      mode: 'move',
      nodeId: node.id,
      startWorld: world,
      startPosition: [node.position.x, node.position.y],
      parentInverse,
    };
    this.updateCursor();
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (this.playing) return;
    const point = this.localPoint(event);
    this.pointer.x = point.x;
    this.pointer.y = point.y;
    this.pointer.inside = true;
    const drag = this.drag;
    if (!drag) {
      this.updateCursor();
      return;
    }
    if (drag.mode === 'pan') {
      this.view.position.x = drag.viewX - (point.x - drag.startX) / this.view.zoom;
      this.view.position.y = drag.viewY - (point.y - drag.startY) / this.view.zoom;
      return;
    }
    const current = this.screenToWorld(point.x, point.y);
    const deltaX = current.x - drag.startWorld.x;
    const deltaY = current.y - drag.startWorld.y;
    const local = drag.parentInverse
      ? drag.parentInverse.transformVector({ x: deltaX, y: deltaY })
      : { x: deltaX, y: deltaY };
    let x = drag.startPosition[0] + local.x;
    let y = drag.startPosition[1] + local.y;
    if (this.snapToGrid && this.gridSize > 0) {
      x = Math.round(x / this.gridSize) * this.gridSize;
      y = Math.round(y / this.gridSize) * this.gridSize;
    }
    const data = this.state.findNode(drag.nodeId);
    if (!data) return;
    data.position = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
    this.state.touch('view');
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.playing) return;
    if (this.editCanvas.hasPointerCapture?.(event.pointerId)) {
      this.editCanvas.releasePointerCapture(event.pointerId);
    }
    if (this.drag?.mode === 'move') this.state.endTransaction();
    this.drag = null;
    this.updateCursor();
  };

  private onWheel = (event: WheelEvent): void => {
    if (this.playing) return;
    event.preventDefault();
    const point = this.localPoint(event);
    const before = this.screenToWorld(point.x, point.y);
    const factor = Math.exp(-event.deltaY * 0.0015);
    const zoom = clamp(this.view.zoom * factor, 0.1, 6);
    this.view.zoom = zoom;
    this.view.position.x = before.x - (point.x - this.viewWidth / 2) / zoom;
    this.view.position.y = before.y - (point.y - this.viewHeight / 2) / zoom;
  };

  private updateCursor(): void {
    if (this.playing) {
      this.editCanvas.style.cursor = 'default';
      return;
    }
    if (this.drag?.mode === 'pan' || this.spaceDown || this.drag?.mode === 'move') {
      this.editCanvas.style.cursor = 'grabbing';
    } else {
      this.editCanvas.style.cursor = 'default';
    }
  }

  private syncTree(): void {
    if (this.treeVersion === this.state.version) return;
    this.treeVersion = this.state.version;
    const built = buildScene(this.state.scene);
    this.world.clear();
    this.world.add(built.root);
    this.world.backgroundColor = this.state.scene.settings.background;
    this.syncAssets();
  }

  private syncAssets(): void {
    const key = JSON.stringify(this.state.scene.assets);
    if (key === this.assetsKey) return;
    this.assetsKey = key;
    this.assets = new AssetStore(this.state.scene.assets);
    this.world.assets = this.assets;
    void this.assets.preload();
  }

  focusSelection(): void {
    this.syncTree();
    const node = this.state.selectedId ? this.world.findById(this.state.selectedId) : null;
    const bounds = node ? nodeBounds(node, this.renderer) : null;
    if (bounds && bounds.width > 0 && bounds.height > 0) {
      this.fit(bounds);
      return;
    }
    if (node) {
      this.view.position.copy(node.worldPosition);
    }
  }

  frameAll(): void {
    this.syncTree();
    const bounds = treeBounds(this.world.root, this.renderer);
    if (bounds && bounds.width > 0 && bounds.height > 0) this.fit(bounds);
    else {
      this.view.position.set(0, 0);
      this.view.zoom = 1;
    }
  }

  private fit(bounds: Rect): void {
    const padding = 0.78;
    this.view.position.set(bounds.centerX, bounds.centerY);
    this.view.zoom = clamp(
      Math.min((this.viewWidth * padding) / Math.max(bounds.width, 1), (this.viewHeight * padding) / Math.max(bounds.height, 1)),
      0.1,
      2.5,
    );
  }

  async play(): Promise<void> {
    if (this.playing) return;
    this.playing = true;
    this.editCanvas.style.display = 'none';
    this.playCanvas.style.display = 'block';
    this.callbacks.onPlayChange(true);
    this.updateCursor();
    const game = new Game({ canvas: this.playCanvas, scene: this.state.scene, autoResize: true });
    this.game = game;
    try {
      await game.load();
      if (this.game !== game) return;
      game.start();
      this.playCanvas.focus();
    } catch (error) {
      console.error('[unitern] could not start play mode', error);
      this.stop();
    }
  }

  stop(): void {
    this.game?.destroy();
    this.game = null;
    if (!this.playing) return;
    this.playing = false;
    this.playCanvas.style.display = 'none';
    this.editCanvas.style.display = 'block';
    this.callbacks.onPlayChange(false);
    this.updateCursor();
  }

  private pick(point: Vec2): Node | null {
    const candidates: Array<{ node: Node; bounds: Rect; order: number }> = [];
    let order = 0;
    const walk = (node: Node): void => {
      if (!node.active || !node.visible || node.screenSpace) return;
      const bounds = nodeBounds(node, this.renderer);
      if (bounds) candidates.push({ node, bounds, order: order++ });
      for (const child of node.children) walk(child);
    };
    walk(this.world.root);
    candidates.sort((a, b) => a.node.zIndex - b.node.zIndex || a.order - b.order);
    for (let i = candidates.length - 1; i >= 0; i--) {
      if (candidates[i].bounds.contains(point)) return candidates[i].node;
    }
    return null;
  }

  private frame = (now: number): void => {
    const delta = Math.min(Math.max(now - this.lastFrame, 0), 0.1);
    this.lastFrame = now;
    if (delta > 0) this.fps = this.fps * 0.9 + (1 / delta) * 0.1;

    if (!this.playing) {
      this.syncTree();
      this.draw();
    }

    this.statusTimer += delta;
    if (this.statusTimer >= 0.1) {
      this.statusTimer = 0;
      this.callbacks.onStatus({
        zoom: this.view.zoom,
        fps: this.playing ? this.game?.stats.fps ?? 0 : this.fps,
        cursor: this.pointer.inside && !this.playing ? this.screenToWorld(this.pointer.x, this.pointer.y) : null,
        playing: this.playing,
      });
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = this.viewWidth;
    const height = this.viewHeight;
    if (this.renderer.width !== Math.round(width) || this.renderer.height !== Math.round(height) || this.renderer.dpr !== dpr) {
      this.renderer.resize(width, height, dpr);
    }
    this.renderer.beginFrame(this.view, {
      background: this.state.scene.settings.background,
      clear: true,
    });
    if (this.gridVisible) this.drawGrid();
    renderNodeTree(this.world.root, this.renderer);
    this.drawSelection();
    this.renderer.endFrame();
  }

  private drawGrid(): void {
    const zoom = this.view.zoom;
    let step = this.gridSize;
    while (step * zoom < 14) step *= 2;
    while (step * zoom > 96) step /= 2;
    const left = this.view.position.x - this.viewWidth / (2 * zoom);
    const right = this.view.position.x + this.viewWidth / (2 * zoom);
    const top = this.view.position.y - this.viewHeight / (2 * zoom);
    const bottom = this.view.position.y + this.viewHeight / (2 * zoom);
    const startX = Math.floor(left / step) * step;
    const startY = Math.floor(top / step) * step;
    const lineWidth = 1 / zoom;
    const limit = 400;

    let index = 0;
    for (let x = startX; x <= right && index < limit; x += step, index++) {
      const major = Math.round(x / step) % 5 === 0;
      this.renderer.drawLine({
        x1: x,
        y1: top,
        x2: x,
        y2: bottom,
        color: major ? 'rgba(148,178,214,0.13)' : 'rgba(148,178,214,0.055)',
        lineWidth,
      });
    }
    index = 0;
    for (let y = startY; y <= bottom && index < limit; y += step, index++) {
      const major = Math.round(y / step) % 5 === 0;
      this.renderer.drawLine({
        x1: left,
        y1: y,
        x2: right,
        y2: y,
        color: major ? 'rgba(148,178,214,0.13)' : 'rgba(148,178,214,0.055)',
        lineWidth,
      });
    }
    this.renderer.drawLine({ x1: left, y1: 0, x2: right, y2: 0, color: 'rgba(91,157,255,0.30)', lineWidth });
    this.renderer.drawLine({ x1: 0, y1: top, x2: 0, y2: bottom, color: 'rgba(91,157,255,0.30)', lineWidth });
  }

  private drawSelection(): void {
    const id = this.state.selectedId;
    if (!id) return;
    const node = this.world.findById(id);
    if (!node) return;
    const zoom = this.view.zoom;
    const bounds = nodeBounds(node, this.renderer);
    if (bounds) {
      this.renderer.drawRect({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        color: 'rgba(91,157,255,0.06)',
        strokeColor: '#5b9dff',
        lineWidth: 1.5 / zoom,
      });
      const center = node.worldPosition;
      this.renderer.drawCircle({
        x: center.x,
        y: center.y,
        radius: 3 / zoom,
        color: '#5b9dff',
        strokeColor: '#0b0e14',
        lineWidth: 1 / zoom,
      });
      this.renderer.drawText({
        text: node.name,
        x: bounds.x,
        y: bounds.y - 8 / zoom,
        size: 11 / zoom,
        color: '#bcd7ff',
        weight: '600',
        baseline: 'bottom',
      });
    } else {
      const center = node.worldPosition;
      const arm = 7 / zoom;
      this.renderer.drawLine({ x1: center.x - arm, y1: center.y, x2: center.x + arm, y2: center.y, color: '#5b9dff', lineWidth: 1 / zoom });
      this.renderer.drawLine({ x1: center.x, y1: center.y - arm, x2: center.x, y2: center.y + arm, color: '#5b9dff', lineWidth: 1 / zoom });
      this.renderer.drawText({
        text: node.name,
        x: center.x + 10 / zoom,
        y: center.y - 10 / zoom,
        size: 11 / zoom,
        color: '#bcd7ff',
        weight: '600',
        baseline: 'bottom',
      });
    }
  }
}

/** World-space bounds of everything drawable on a node. */
export function nodeBounds(node: Node, renderer?: Renderer): Rect | null {
  let union: Rect | null = null;
  const merge = (rect: Rect): void => {
    union = union ? union.union(rect) : rect;
  };
  for (const component of node.components) {
    if (!component.enabled) continue;
    if (component instanceof ShapeRenderer) {
      const halfWidth = component.shape === 'circle' ? component.radius : component.width / 2;
      const halfHeight = component.shape === 'circle' ? component.radius : component.height / 2;
      merge(transformRect(node, -halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2));
    } else if (component instanceof SpriteRenderer) {
      const size = component.getSize();
      merge(
        transformRect(
          node,
          -component.anchor.x * size.x,
          -component.anchor.y * size.y,
          size.x,
          size.y,
        ),
      );
    } else if (component instanceof TextRenderer) {
      const width = renderer ? Math.max(component.measureWidth(renderer), 8) : Math.max(component.text.length * component.size * 0.6, 8);
      const height = Math.max(component.measureHeight(), component.size);
      const offsetX = component.align === 'center' ? -width / 2 : component.align === 'right' ? -width : 0;
      merge(transformRect(node, offsetX, 0, width, height));
    } else if (component instanceof Collider2D) {
      merge(component.worldBounds());
    }
  }
  return union;
}

function transformRect(node: Node, left: number, top: number, width: number, height: number): Rect {
  const matrix = node.worldMatrix;
  const corners = [
    matrix.transformPoint({ x: left, y: top }),
    matrix.transformPoint({ x: left + width, y: top }),
    matrix.transformPoint({ x: left + width, y: top + height }),
    matrix.transformPoint({ x: left, y: top + height }),
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const corner of corners) {
    minX = Math.min(minX, corner.x);
    minY = Math.min(minY, corner.y);
    maxX = Math.max(maxX, corner.x);
    maxY = Math.max(maxY, corner.y);
  }
  return new Rect(minX, minY, maxX - minX, maxY - minY);
}

function treeBounds(root: Node, renderer?: Renderer): Rect | null {
  let union: Rect | null = null;
  const walk = (node: Node): void => {
    if (!node.active || !node.visible) return;
    const bounds = nodeBounds(node, renderer);
    if (bounds) union = union ? union.union(bounds) : bounds;
    for (const child of node.children) walk(child);
  };
  walk(root);
  return union;
}

export function sceneBounds(scene: SceneData): Rect | null {
  const built = buildScene(scene);
  return treeBounds(built.root);
}
