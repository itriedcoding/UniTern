import { Rect, type Vec2Like } from '../core/math';

export interface View {
  position: Vec2Like;
  zoom: number;
  rotation: number;
}

export interface FrameOptions {
  clear?: boolean;
  background?: string;
}

export interface SpriteDrawOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  anchorX?: number;
  anchorY?: number;
  opacity?: number;
  flipX?: boolean;
  flipY?: boolean;
  /** Sprite-sheet region inside the image, in image pixels. */
  frame?: Rect | null;
}

export interface RectDrawOptions {
  x?: number;
  y?: number;
  width: number;
  height: number;
  color: string;
  opacity?: number;
  strokeColor?: string;
  lineWidth?: number;
  radius?: number;
}

export interface CircleDrawOptions {
  x?: number;
  y?: number;
  radius: number;
  color: string;
  opacity?: number;
  strokeColor?: string;
  lineWidth?: number;
}

export interface LineDrawOptions {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  lineWidth?: number;
  opacity?: number;
}

export interface TextDrawOptions {
  text: string;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  font?: string;
  weight?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  lineHeight?: number;
  opacity?: number;
  maxWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
}

function naturalSize(image: CanvasImageSource): { width: number; height: number } {
  const source = image as unknown as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  return {
    width: source.naturalWidth ?? source.width ?? 0,
    height: source.naturalHeight ?? source.height ?? 0,
  };
}

/** Canvas 2D renderer with a pannable/zoomable world camera. */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;
  dpr = 1;
  drawCalls = 0;
  private view: View = { position: { x: 0, y: 0 }, zoom: 1, rotation: 0 };
  private inFrame = false;

  constructor(canvas: HTMLCanvasElement, context?: CanvasRenderingContext2D | null) {
    const ctx = context ?? canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create a 2D canvas context');
    this.canvas = canvas;
    this.ctx = ctx;
  }

  resize(cssWidth: number, cssHeight: number, dpr = 1): void {
    const width = Math.max(1, Math.round(cssWidth));
    const height = Math.max(1, Math.round(cssHeight));
    const ratio = Math.max(0.1, dpr);
    this.width = width;
    this.height = height;
    this.dpr = ratio;
    this.canvas.width = Math.max(1, Math.round(width * ratio));
    this.canvas.height = Math.max(1, Math.round(height * ratio));
  }

  beginFrame(view: View, options: FrameOptions = {}): void {
    if (this.inFrame) this.endFrame();
    const { ctx } = this;
    this.view = { position: { x: view.position.x, y: view.position.y }, zoom: view.zoom, rotation: view.rotation };
    this.drawCalls = 0;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    if (options.clear !== false) {
      ctx.fillStyle = options.background ?? '#000000';
      ctx.fillRect(0, 0, this.width, this.height);
    }
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(view.zoom, view.zoom);
    if (view.rotation !== 0) ctx.rotate(-view.rotation);
    ctx.translate(-view.position.x, -view.position.y);
    this.inFrame = true;
  }

  endFrame(): void {
    if (!this.inFrame) return;
    this.ctx.restore();
    this.inFrame = false;
  }

  /** @internal Used by the scene renderer for screen-space UI nodes. */
  pushScreenSpace(): void {
    this.ctx.save();
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  /** @internal */
  popScreenSpace(): void {
    this.ctx.restore();
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const zoom = this.view.zoom === 0 ? 1 : this.view.zoom;
    const dx = (screenX - this.width / 2) / zoom;
    const dy = (screenY - this.height / 2) / zoom;
    const rotation = this.view.rotation;
    if (rotation === 0) {
      return { x: this.view.position.x + dx, y: this.view.position.y + dy };
    }
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
      x: this.view.position.x + dx * cos - dy * sin,
      y: this.view.position.y + dx * sin + dy * cos,
    };
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const zoom = this.view.zoom === 0 ? 1 : this.view.zoom;
    const dx = worldX - this.view.position.x;
    const dy = worldY - this.view.position.y;
    const rotation = this.view.rotation;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return {
      x: this.width / 2 + (dx * cos + dy * sin) * zoom,
      y: this.height / 2 + (-dx * sin + dy * cos) * zoom,
    };
  }

  /** World-space rectangle currently visible through the camera. */
  visibleWorldRect(): Rect {
    const zoom = this.view.zoom === 0 ? 1 : this.view.zoom;
    const halfWidth = this.width / (2 * zoom);
    const halfHeight = this.height / (2 * zoom);
    return new Rect(
      this.view.position.x - halfWidth,
      this.view.position.y - halfHeight,
      halfWidth * 2,
      halfHeight * 2,
    );
  }

  drawSprite(image: CanvasImageSource | null | undefined, options: SpriteDrawOptions = {}): void {
    if (!image) return;
    const { ctx } = this;
    const natural = naturalSize(image);
    const width = options.width && options.width > 0 ? options.width : natural.width;
    const height = options.height && options.height > 0 ? options.height : natural.height;
    if (width <= 0 || height <= 0) return;
    const anchorX = options.anchorX ?? 0.5;
    const anchorY = options.anchorY ?? 0.5;
    const frame = options.frame;

    ctx.save();
    ctx.translate(options.x ?? 0, options.y ?? 0);
    if (options.rotation) ctx.rotate(options.rotation);
    ctx.scale(options.flipX ? -1 : 1, options.flipY ? -1 : 1);
    ctx.globalAlpha *= options.opacity ?? 1;
    const drawWidth = frame ? frame.width : width;
    const drawHeight = frame ? frame.height : height;
    const offsetX = -anchorX * drawWidth;
    const offsetY = -anchorY * drawHeight;
    if (frame) {
      ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, offsetX, offsetY, drawWidth, drawHeight);
    } else {
      ctx.drawImage(image, offsetX, offsetY, width, height);
    }
    ctx.restore();
    this.drawCalls++;
  }

  drawRect(options: RectDrawOptions): void {
    const { ctx } = this;
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    const radius = Math.max(0, Math.min(options.radius ?? 0, Math.min(options.width, options.height) / 2));
    ctx.save();
    ctx.globalAlpha *= options.opacity ?? 1;
    ctx.beginPath();
    if (radius > 0) roundedRectPath(ctx, x, y, options.width, options.height, radius);
    else ctx.rect(x, y, options.width, options.height);
    ctx.fillStyle = options.color;
    ctx.fill();
    if (options.strokeColor && (options.lineWidth ?? 0) > 0) {
      ctx.strokeStyle = options.strokeColor;
      ctx.lineWidth = options.lineWidth ?? 1;
      ctx.stroke();
    }
    ctx.restore();
    this.drawCalls++;
  }

  drawCircle(options: CircleDrawOptions): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha *= options.opacity ?? 1;
    ctx.beginPath();
    ctx.arc(options.x ?? 0, options.y ?? 0, Math.max(0, options.radius), 0, Math.PI * 2);
    ctx.fillStyle = options.color;
    ctx.fill();
    if (options.strokeColor && (options.lineWidth ?? 0) > 0) {
      ctx.strokeStyle = options.strokeColor;
      ctx.lineWidth = options.lineWidth ?? 1;
      ctx.stroke();
    }
    ctx.restore();
    this.drawCalls++;
  }

  drawLine(options: LineDrawOptions): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha *= options.opacity ?? 1;
    ctx.strokeStyle = options.color;
    ctx.lineWidth = options.lineWidth ?? 1;
    ctx.beginPath();
    ctx.moveTo(options.x1, options.y1);
    ctx.lineTo(options.x2, options.y2);
    ctx.stroke();
    ctx.restore();
    this.drawCalls++;
  }

  drawText(options: TextDrawOptions): void {
    const { ctx } = this;
    const size = options.size ?? 16;
    const weight = options.weight ?? '400';
    const family = options.font ?? 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.save();
    ctx.globalAlpha *= options.opacity ?? 1;
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.textAlign = options.align ?? 'left';
    ctx.textBaseline = options.baseline ?? 'top';
    ctx.fillStyle = options.color ?? '#ffffff';
    if (options.shadowColor) {
      ctx.shadowColor = options.shadowColor;
      ctx.shadowBlur = options.shadowBlur ?? 0;
    }
    const lines = options.text.split('\n');
    const lineHeight = options.lineHeight ?? size * 1.25;
    lines.forEach((line, index) => {
      const y = (options.y ?? 0) + index * lineHeight;
      if (options.maxWidth !== undefined && options.maxWidth > 0) {
        ctx.fillText(line, options.x ?? 0, y, options.maxWidth);
      } else {
        ctx.fillText(line, options.x ?? 0, y);
      }
    });
    ctx.restore();
    this.drawCalls++;
  }

  measureText(text: string, size = 16, weight = '400', font?: string): number {
    const { ctx } = this;
    ctx.save();
    ctx.font = `${weight} ${size}px ${font ?? 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'}`;
    const width = ctx.measureText(text).width;
    ctx.restore();
    return width;
  }
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
