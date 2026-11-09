import { Component } from '../core/component';
import type { ComponentSchema } from '../core/fields';
import { Rect, Vec2 } from '../core/math';
import { registerComponent } from '../core/registry';

let colliderCounter = 1;

const COMMON_FIELDS = [
  { key: 'offset', label: 'Offset', type: 'vec2' as const },
  { key: 'isTrigger', label: 'Trigger', type: 'boolean' as const, hint: 'Detects overlaps without pushing bodies apart' },
  { key: 'layer', label: 'Layer', type: 'number' as const, min: 1, max: 16, step: 1 },
  { key: 'mask', label: 'Mask', type: 'number' as const, min: 0, max: 65535, step: 1, hint: 'Bitmask of layers this collider interacts with' },
];

/** Base class for 2D colliders. Collision detection uses axis-aligned bounds. */
export abstract class Collider2D extends Component {
  readonly uid: number = colliderCounter++;
  offset = new Vec2();
  isTrigger = false;
  layer = 1;
  mask = 0xffff;

  abstract readonly shape: 'box' | 'circle';

  /** World-space axis-aligned bounds. */
  abstract worldBounds(): Rect;

  /** World-space center used by circle collisions and debug drawing. */
  abstract worldCenter(): Vec2;

  protected offsetWorld(): Vec2 {
    return this.node.worldMatrix.transformPoint(this.offset);
  }
}

export class BoxCollider2D extends Collider2D {
  static override schema: ComponentSchema = {
    type: 'box-collider',
    label: 'Box Collider',
    description: 'Axis-aligned box collision shape.',
    fields: [{ key: 'size', label: 'Size', type: 'vec2' }, ...COMMON_FIELDS],
    defaults: { size: [32, 32], offset: [0, 0], isTrigger: false, layer: 1, mask: 65535 },
  };

  readonly shape = 'box' as const;
  size = new Vec2(32, 32);

  worldBounds(): Rect {
    const matrix = this.node.worldMatrix;
    const halfWidth = this.size.x / 2;
    const halfHeight = this.size.y / 2;
    const corners = [
      matrix.transformPoint(new Vec2(this.offset.x - halfWidth, this.offset.y - halfHeight)),
      matrix.transformPoint(new Vec2(this.offset.x + halfWidth, this.offset.y - halfHeight)),
      matrix.transformPoint(new Vec2(this.offset.x + halfWidth, this.offset.y + halfHeight)),
      matrix.transformPoint(new Vec2(this.offset.x - halfWidth, this.offset.y + halfHeight)),
    ];
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const corner of corners) {
      left = Math.min(left, corner.x);
      right = Math.max(right, corner.x);
      top = Math.min(top, corner.y);
      bottom = Math.max(bottom, corner.y);
    }
    return new Rect(left, top, right - left, bottom - top);
  }

  worldCenter(): Vec2 {
    return this.offsetWorld();
  }
}

export class CircleCollider2D extends Collider2D {
  static override schema: ComponentSchema = {
    type: 'circle-collider',
    label: 'Circle Collider',
    description: 'Circle collision shape.',
    fields: [{ key: 'radius', label: 'Radius', type: 'number', min: 0, step: 1 }, ...COMMON_FIELDS],
    defaults: { radius: 16, offset: [0, 0], isTrigger: false, layer: 1, mask: 65535 },
  };

  readonly shape = 'circle' as const;
  radius = 16;

  worldScaleFactor(): number {
    const scale = this.node.worldScale;
    return Math.max(Math.abs(scale.x), Math.abs(scale.y));
  }

  worldRadius(): number {
    return this.radius * this.worldScaleFactor();
  }

  worldCenter(): Vec2 {
    return this.offsetWorld();
  }

  worldBounds(): Rect {
    const center = this.worldCenter();
    const radius = this.worldRadius();
    return Rect.fromCenter(center.x, center.y, radius * 2, radius * 2);
  }
}

registerComponent(BoxCollider2D);
registerComponent(CircleCollider2D);
