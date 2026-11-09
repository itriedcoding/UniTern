import type { ComponentData, ComponentSchema, FieldDef } from './fields';
import { Rect, Vec2 } from './math';
import type { Node } from './node';
import type { World } from './world';

/**
 * A behaviour attached to a scene node. Components declare their serializable
 * state through a static schema; encoding and decoding is handled here.
 */
export abstract class Component {
  static schema: ComponentSchema = {
    type: 'component',
    label: 'Component',
    fields: [],
    defaults: {},
  };

  node!: Node;
  enabled = true;

  get schema(): ComponentSchema {
    return (this.constructor as typeof Component).schema;
  }

  get world(): World {
    const world = this.node?.world;
    if (!world) throw new Error(`Component "${this.schema.type}" is not attached to a world`);
    return world;
  }

  get transform(): Node {
    return this.node;
  }

  onAttach(): void {}
  onDetach(): void {}

  /** Snapshot of every schema field, ready to be written into a scene file. */
  toJSON(): ComponentData {
    const data: ComponentData = { type: this.schema.type };
    for (const field of this.schema.fields) {
      data[field.key] = encodeField(field, (this as unknown as Record<string, unknown>)[field.key]);
    }
    return data;
  }

  /** Apply scene data on top of the schema defaults. */
  applyData(data: ComponentData): void {
    const target = this as unknown as Record<string, unknown>;
    for (const field of this.schema.fields) {
      const raw = data[field.key] ?? this.schema.defaults[field.key];
      target[field.key] = decodeField(field, raw);
    }
  }

  /** Reset the component to its schema defaults. */
  reset(): void {
    this.applyData({ type: this.schema.type });
  }
}

function isVec2(value: unknown): value is Vec2 {
  return value instanceof Vec2;
}

function isRect(value: unknown): value is Rect {
  return value instanceof Rect;
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function encodeField(field: FieldDef, value: unknown): unknown {
  switch (field.type) {
    case 'number':
      return finiteOr(value, 0);
    case 'boolean':
      return Boolean(value);
    case 'vec2': {
      if (isVec2(value)) return [value.x, value.y];
      if (Array.isArray(value)) return [finiteOr(value[0], 0), finiteOr(value[1], 0)];
      return [0, 0];
    }
    case 'rect': {
      if (isRect(value)) return [value.x, value.y, value.width, value.height];
      if (value === null || value === undefined) return null;
      if (Array.isArray(value)) {
        return [finiteOr(value[0], 0), finiteOr(value[1], 0), finiteOr(value[2], 0), finiteOr(value[3], 0)];
      }
      return null;
    }
    case 'text':
    case 'textarea':
    case 'color':
    case 'select':
    case 'asset':
    case 'node':
      return typeof value === 'string' ? value : String(value ?? '');
    default:
      return value;
  }
}

export function decodeField(field: FieldDef, raw: unknown): unknown {
  switch (field.type) {
    case 'number': {
      const value = finiteOr(typeof raw === 'string' ? Number(raw) : raw, finiteOr(field.min, 0));
      const min = field.min ?? Number.NEGATIVE_INFINITY;
      const max = field.max ?? Number.POSITIVE_INFINITY;
      return Math.min(Math.max(value, min), max);
    }
    case 'boolean':
      return Boolean(raw);
    case 'vec2': {
      if (Array.isArray(raw)) return new Vec2(finiteOr(raw[0], 0), finiteOr(raw[1], 0));
      if (raw && typeof raw === 'object') {
        const object = raw as Record<string, unknown>;
        return new Vec2(finiteOr(object.x, 0), finiteOr(object.y, 0));
      }
      return new Vec2();
    }
    case 'rect': {
      if (raw === null || raw === undefined) return null;
      if (Array.isArray(raw)) {
        return new Rect(
          finiteOr(raw[0], 0),
          finiteOr(raw[1], 0),
          Math.max(0, finiteOr(raw[2], 0)),
          Math.max(0, finiteOr(raw[3], 0)),
        );
      }
      if (typeof raw === 'object') {
        const object = raw as Record<string, unknown>;
        return new Rect(
          finiteOr(object.x, 0),
          finiteOr(object.y, 0),
          Math.max(0, finiteOr(object.width, 0)),
          Math.max(0, finiteOr(object.height, 0)),
        );
      }
      return null;
    }
    case 'text':
    case 'textarea':
    case 'color':
    case 'select':
    case 'asset':
    case 'node':
      return typeof raw === 'string' ? raw : String(raw ?? '');
    default:
      return raw;
  }
}

/** Base class for gameplay behaviour with a lifecycle. */
export class Script extends Component {
  private _started = false;

  get started(): boolean {
    return this._started;
  }

  /** @internal Called by the world exactly once before the first update. */
  startIfNeeded(): void {
    if (this._started) return;
    this._started = true;
    this.start();
  }

  start(): void {}
  update(_dt: number): void {}
  fixedUpdate(_dt: number): void {}
  lateUpdate(_dt: number): void {}
  onDestroy(): void {}
}
