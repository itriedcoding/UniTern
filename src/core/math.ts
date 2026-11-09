/**
 * Small, dependency-free 2D math toolkit.
 * Vectors are mutable and notify listeners when their components change, which
 * lets scene nodes invalidate cached world matrices even for direct writes
 * such as `node.position.x = 10`.
 */

export const TAU = Math.PI * 2;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export interface Vec2Like {
  x: number;
  y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
  return a === b ? 0 : (value - a) / (b - a);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp(inverseLerp(edge0, edge1, x), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential smoothing. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

export function wrapAngle(angle: number): number {
  const wrapped = (angle + Math.PI) % TAU;
  return (wrapped < 0 ? wrapped + TAU : wrapped) - Math.PI;
}

export function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}

export function degToRad(degrees: number): number {
  return degrees * DEG2RAD;
}

export function radToDeg(radians: number): number {
  return radians * RAD2DEG;
}

export function approximately(a: number, b: number, epsilon = 1e-6): boolean {
  return Math.abs(a - b) <= epsilon;
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1));
}

export function chance(probability: number): boolean {
  return Math.random() < probability;
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export const easings = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => t * (2 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outBack: (t: number) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
};

export class Vec2 implements Vec2Like {
  private _x: number;
  private _y: number;
  private _onChange: (() => void) | undefined;

  constructor(x = 0, y = 0) {
    this._x = x;
    this._y = y;
  }

  get x(): number {
    return this._x;
  }

  set x(value: number) {
    if (value !== this._x) {
      this._x = value;
      this._onChange?.();
    }
  }

  get y(): number {
    return this._y;
  }

  set y(value: number) {
    if (value !== this._y) {
      this._y = value;
      this._onChange?.();
    }
  }

  /** Register a listener that fires whenever x or y changes. */
  onChange(listener: (() => void) | undefined): this {
    this._onChange = listener;
    return this;
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(other: Vec2Like): this {
    this.set(other.x, other.y);
    return this;
  }

  clone(): Vec2 {
    return new Vec2(this._x, this._y);
  }

  add(other: Vec2Like): this {
    this.set(this._x + other.x, this._y + other.y);
    return this;
  }

  addScaled(other: Vec2Like, scale: number): this {
    this.set(this._x + other.x * scale, this._y + other.y * scale);
    return this;
  }

  sub(other: Vec2Like): this {
    this.set(this._x - other.x, this._y - other.y);
    return this;
  }

  scale(factor: number): this {
    this.set(this._x * factor, this._y * factor);
    return this;
  }

  scaleXY(x: number, y: number): this {
    this.set(this._x * x, this._y * y);
    return this;
  }

  multiply(other: Vec2Like): this {
    this.set(this._x * other.x, this._y * other.y);
    return this;
  }

  negate(): this {
    this.set(-this._x, -this._y);
    return this;
  }

  setLength(length: number): this {
    const current = this.length();
    if (current === 0) return this;
    return this.scale(length / current);
  }

  length(): number {
    return Math.hypot(this._x, this._y);
  }

  lengthSq(): number {
    return this._x * this._x + this._y * this._y;
  }

  normalize(): this {
    const length = this.length();
    if (length > 0) this.scale(1 / length);
    return this;
  }

  dot(other: Vec2Like): number {
    return this._x * other.x + this._y * other.y;
  }

  cross(other: Vec2Like): number {
    return this._x * other.y - this._y * other.x;
  }

  distanceTo(other: Vec2Like): number {
    return Math.hypot(other.x - this._x, other.y - this._y);
  }

  distanceSq(other: Vec2Like): number {
    const dx = other.x - this._x;
    const dy = other.y - this._y;
    return dx * dx + dy * dy;
  }

  angle(): number {
    return Math.atan2(this._y, this._x);
  }

  rotate(radians: number): this {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    this.set(this._x * cos - this._y * sin, this._x * sin + this._y * cos);
    return this;
  }

  rotateAround(center: Vec2Like, radians: number): this {
    const dx = this._x - center.x;
    const dy = this._y - center.y;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    this.set(center.x + dx * cos - dy * sin, center.y + dx * sin + dy * cos);
    return this;
  }

  lerp(target: Vec2Like, t: number): this {
    this.set(lerp(this._x, target.x, t), lerp(this._y, target.y, t));
    return this;
  }

  perpendicular(): Vec2 {
    return new Vec2(-this._y, this._x);
  }

  equals(other: Vec2Like, epsilon = 1e-6): boolean {
    return approximately(this._x, other.x, epsilon) && approximately(this._y, other.y, epsilon);
  }

  isZero(epsilon = 1e-6): boolean {
    return Math.abs(this._x) <= epsilon && Math.abs(this._y) <= epsilon;
  }

  toArray(): [number, number] {
    return [this._x, this._y];
  }

  toString(): string {
    return `(${this._x}, ${this._y})`;
  }

  static from(value: Vec2Like | null | undefined, fallback = 0): Vec2 {
    return new Vec2(value?.x ?? fallback, value?.y ?? fallback);
  }

  static zero(): Vec2 {
    return new Vec2(0, 0);
  }

  static one(): Vec2 {
    return new Vec2(1, 1);
  }

  static add(a: Vec2Like, b: Vec2Like): Vec2 {
    return new Vec2(a.x + b.x, a.y + b.y);
  }

  static sub(a: Vec2Like, b: Vec2Like): Vec2 {
    return new Vec2(a.x - b.x, a.y - b.y);
  }

  static scale(a: Vec2Like, factor: number): Vec2 {
    return new Vec2(a.x * factor, a.y * factor);
  }

  static distance(a: Vec2Like, b: Vec2Like): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }
}

/** 2D affine matrix in the same layout the Canvas 2D API uses. */
export class Mat2D {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;

  constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }

  set(a: number, b: number, c: number, d: number, e: number, f: number): this {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
    return this;
  }

  copy(other: Mat2D): this {
    return this.set(other.a, other.b, other.c, other.d, other.e, other.f);
  }

  clone(): Mat2D {
    return new Mat2D(this.a, this.b, this.c, this.d, this.e, this.f);
  }

  identity(): this {
    return this.set(1, 0, 0, 1, 0, 0);
  }

  /** this = this * other */
  multiply(other: Mat2D): this {
    const { a, b, c, d, e, f } = this;
    return this.set(
      a * other.a + c * other.b,
      b * other.a + d * other.b,
      a * other.c + c * other.d,
      b * other.c + d * other.d,
      a * other.e + c * other.f + e,
      b * other.e + d * other.f + f,
    );
  }

  translate(x: number, y: number): this {
    this.e += this.a * x + this.c * y;
    this.f += this.b * x + this.d * y;
    return this;
  }

  scale(x: number, y: number): this {
    this.a *= x;
    this.b *= x;
    this.c *= y;
    this.d *= y;
    return this;
  }

  rotate(radians: number): this {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return this.multiply(new Mat2D(cos, sin, -sin, cos, 0, 0));
  }

  transformPoint(point: Vec2Like): Vec2 {
    return new Vec2(this.a * point.x + this.c * point.y + this.e, this.b * point.x + this.d * point.y + this.f);
  }

  transformVector(vector: Vec2Like): Vec2 {
    return new Vec2(this.a * vector.x + this.c * vector.y, this.b * vector.x + this.d * vector.y);
  }

  determinant(): number {
    return this.a * this.d - this.b * this.c;
  }

  /** Returns the inverse, or null when the matrix is singular. */
  invert(): Mat2D | null {
    const det = this.determinant();
    if (Math.abs(det) < 1e-12) return null;
    const { a, b, c, d, e, f } = this;
    return new Mat2D(
      d / det,
      -b / det,
      -c / det,
      a / det,
      (c * f - d * e) / det,
      (b * e - a * f) / det,
    );
  }

  /** Scale factor applied along each local axis. */
  axisScale(): Vec2 {
    return new Vec2(Math.hypot(this.a, this.b), Math.hypot(this.c, this.d));
  }
}

/** Compose a translation/rotation/scale matrix into `out`. */
export function composeTRS(out: Mat2D, x: number, y: number, rotation: number, scaleX: number, scaleY: number): Mat2D {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return out.set(cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, x, y);
}

export class Rect {
  x: number;
  y: number;
  width: number;
  height: number;

  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  static fromCenter(x: number, y: number, width: number, height: number): Rect {
    return new Rect(x - width / 2, y - height / 2, width, height);
  }

  get left(): number {
    return this.x;
  }

  get top(): number {
    return this.y;
  }

  get right(): number {
    return this.x + this.width;
  }

  get bottom(): number {
    return this.y + this.height;
  }

  get centerX(): number {
    return this.x + this.width / 2;
  }

  get centerY(): number {
    return this.y + this.height / 2;
  }

  get center(): Vec2 {
    return new Vec2(this.centerX, this.centerY);
  }

  clone(): Rect {
    return new Rect(this.x, this.y, this.width, this.height);
  }

  set(x: number, y: number, width: number, height: number): this {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    return this;
  }

  contains(point: Vec2Like): boolean {
    return point.x >= this.left && point.x <= this.right && point.y >= this.top && point.y <= this.bottom;
  }

  containsRect(other: Rect): boolean {
    return other.left >= this.left && other.right <= this.right && other.top >= this.top && other.bottom <= this.bottom;
  }

  intersects(other: Rect): boolean {
    return this.left <= other.right && this.right >= other.left && this.top <= other.bottom && this.bottom >= other.top;
  }

  intersection(other: Rect): Rect | null {
    const left = Math.max(this.left, other.left);
    const top = Math.max(this.top, other.top);
    const right = Math.min(this.right, other.right);
    const bottom = Math.min(this.bottom, other.bottom);
    if (right < left || bottom < top) return null;
    return new Rect(left, top, right - left, bottom - top);
  }

  union(other: Rect): Rect {
    const left = Math.min(this.left, other.left);
    const top = Math.min(this.top, other.top);
    const right = Math.max(this.right, other.right);
    const bottom = Math.max(this.bottom, other.bottom);
    return new Rect(left, top, right - left, bottom - top);
  }

  inflate(amountX: number, amountY = amountX): Rect {
    this.x -= amountX;
    this.y -= amountY;
    this.width += amountX * 2;
    this.height += amountY * 2;
    return this;
  }

  toArray(): [number, number, number, number] {
    return [this.x, this.y, this.width, this.height];
  }

  toString(): string {
    return `Rect(${this.x}, ${this.y}, ${this.width}, ${this.height})`;
  }
}
