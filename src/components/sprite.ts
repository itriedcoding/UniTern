import { Component } from '../core/component';
import type { ComponentSchema } from '../core/fields';
import { Rect, Vec2 } from '../core/math';
import { registerComponent } from '../core/registry';
import type { Renderable } from '../render/scene-renderer';
import type { Renderer } from '../render/renderer';

/** Draws an image asset at the node's transform. */
export class SpriteRenderer extends Component implements Renderable {
  static override schema: ComponentSchema = {
    type: 'sprite',
    label: 'Sprite',
    description: 'Draws an image from the scene asset library.',
    fields: [
      { key: 'assetId', label: 'Image', type: 'asset' },
      { key: 'width', label: 'Width', type: 'number', min: 0, step: 1, hint: '0 uses the image width' },
      { key: 'height', label: 'Height', type: 'number', min: 0, step: 1, hint: '0 uses the image height' },
      { key: 'anchor', label: 'Anchor', type: 'vec2', hint: '0,0 is top-left; 0.5,0.5 is centered' },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'flipX', label: 'Flip X', type: 'boolean' },
      { key: 'flipY', label: 'Flip Y', type: 'boolean' },
      { key: 'zIndex', label: 'Z Index', type: 'number', step: 1 },
    ],
    defaults: { assetId: '', width: 0, height: 0, anchor: [0.5, 0.5], opacity: 1, flipX: false, flipY: false, zIndex: 0 },
  };

  assetId = '';
  width = 0;
  height = 0;
  anchor = new Vec2(0.5, 0.5);
  opacity = 1;
  flipX = false;
  flipY = false;
  zIndex = 0;

  /** Optional runtime-only image override (procedural textures, editor previews). */
  image: CanvasImageSource | null = null;
  /** Runtime-only sprite-sheet frame. */
  frame: Rect | null = null;

  private resolvedAssetId: string | null = null;
  private resolvedImage: CanvasImageSource | null = null;

  get texture(): CanvasImageSource | null {
    if (this.image) return this.image;
    const assets = this.node.world?.assets;
    if (!assets) return null;
    if (this.resolvedAssetId !== this.assetId || !this.resolvedImage) {
      this.resolvedAssetId = this.assetId;
      this.resolvedImage = assets.getImage(this.assetId) ?? null;
    }
    return this.resolvedImage;
  }

  getSize(): Vec2 {
    if (this.width > 0 && this.height > 0) return new Vec2(this.width, this.height);
    if (this.frame) return new Vec2(this.width > 0 ? this.width : this.frame.width, this.height > 0 ? this.height : this.frame.height);
    const image = this.texture as unknown as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number } | null;
    const naturalWidth = image?.naturalWidth ?? image?.width ?? 0;
    const naturalHeight = image?.naturalHeight ?? image?.height ?? 0;
    return new Vec2(this.width > 0 ? this.width : naturalWidth || 32, this.height > 0 ? this.height : naturalHeight || 32);
  }

  render(renderer: Renderer): void {
    const image = this.texture;
    if (!image) return;
    const size = this.getSize();
    renderer.drawSprite(image, {
      x: 0,
      y: 0,
      width: size.x,
      height: size.y,
      anchorX: this.anchor.x,
      anchorY: this.anchor.y,
      opacity: this.opacity,
      flipX: this.flipX,
      flipY: this.flipY,
      frame: this.frame,
    });
  }
}

registerComponent(SpriteRenderer);
