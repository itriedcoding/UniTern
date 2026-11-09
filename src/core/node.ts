import { Script, type Component } from './component';
import { composeTRS, Mat2D, Vec2, type Vec2Like } from './math';
import type { World } from './world';

let nodeCounter = 1;

/** Scene graph node. Holds a transform, components and children. */
export class Node {
  readonly id: string;
  name: string;
  active = true;
  visible = true;
  /** When true, this node and its children render in canvas pixel space. */
  screenSpace = false;
  tags: string[] = [];
  zIndex = 0;
  parent: Node | null = null;
  children: Node[] = [];
  components: Component[] = [];
  world: World | null = null;
  destroyed = false;

  private _position = new Vec2();
  private _rotation = 0;
  private _scale = new Vec2(1, 1);
  private _local = new Mat2D();
  private _matrix = new Mat2D();
  private _dirty = true;

  constructor(name = 'Node', id?: string) {
    this.name = name;
    this.id = id && id.length > 0 ? id : `node-${nodeCounter++}`;
    this._position.onChange(() => this.markDirty());
    this._scale.onChange(() => this.markDirty());
  }

  get position(): Vec2 {
    return this._position;
  }

  get rotation(): number {
    return this._rotation;
  }

  set rotation(radians: number) {
    if (radians !== this._rotation) {
      this._rotation = radians;
      this.markDirty();
    }
  }

  get scale(): Vec2 {
    return this._scale;
  }

  /** Invalidate this node's cached world matrix and all descendants. */
  markDirty(): this {
    this._dirty = true;
    for (const child of this.children) child.markDirty();
    return this;
  }

  get worldMatrix(): Mat2D {
    if (!this._dirty) return this._matrix;
    composeTRS(this._local, this._position.x, this._position.y, this._rotation, this._scale.x, this._scale.y);
    if (this.parent) this._matrix.copy(this.parent.worldMatrix).multiply(this._local);
    else this._matrix.copy(this._local);
    this._dirty = false;
    return this._matrix;
  }

  get worldPosition(): Vec2 {
    return this.worldMatrix.transformPoint(Vec2.zero());
  }

  get worldScale(): Vec2 {
    return this.worldMatrix.axisScale();
  }

  get activeInHierarchy(): boolean {
    let node: Node | null = this;
    while (node) {
      if (!node.active) return false;
      node = node.parent;
    }
    return true;
  }

  setPosition(x: number, y: number): this {
    this._position.set(x, y);
    return this;
  }

  add(child: Node): this {
    if (child === this) throw new Error('A node cannot be its own child');
    if (child.contains(this)) throw new Error('Cannot parent a node to one of its descendants');
    if (child.parent) child.parent.remove(child);
    child.parent = this;
    this.children.push(child);
    child.attachToWorld(this.world);
    this.markDirty();
    return this;
  }

  remove(child: Node): this {
    const index = this.children.indexOf(child);
    if (index < 0) return this;
    this.children.splice(index, 1);
    child.parent = null;
    child.attachToWorld(null);
    this.markDirty();
    return this;
  }

  addComponent<T extends Component>(component: T): T {
    if (component.node) throw new Error('Component is already attached to a node');
    component.node = this;
    this.components.push(component);
    component.onAttach();
    return component;
  }

  removeComponent<T extends Component>(component: T): boolean {
    const index = this.components.indexOf(component);
    if (index < 0) return false;
    this.components.splice(index, 1);
    component.onDetach();
    if (component instanceof Script) component.onDestroy();
    return true;
  }

  getComponent<T extends Component>(ctor: abstract new (...args: never[]) => T): T | undefined {
    for (const component of this.components) {
      if (component instanceof ctor) return component;
    }
    return undefined;
  }

  getComponentByType<T extends Component = Component>(type: string): T | undefined {
    for (const component of this.components) {
      if (component.schema.type === type) return component as T;
    }
    return undefined;
  }

  hasComponent<T extends Component>(ctor: abstract new (...args: never[]) => T): boolean {
    return this.getComponent(ctor) !== undefined;
  }

  contains(node: Node): boolean {
    for (const child of this.children) {
      if (child === node || child.contains(node)) return true;
    }
    return false;
  }

  traverse(visit: (node: Node) => void): void {
    visit(this);
    for (const child of this.children) child.traverse(visit);
  }

  find(predicate: (node: Node) => boolean): Node | null {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const found = child.find(predicate);
      if (found) return found;
    }
    return null;
  }

  findAll(predicate: (node: Node) => boolean): Node[] {
    const results: Node[] = [];
    this.traverse((node) => {
      if (predicate(node)) results.push(node);
    });
    return results;
  }

  findByName(name: string): Node | null {
    return this.find((node) => node.name === name);
  }

  findById(id: string): Node | null {
    return this.find((node) => node.id === id);
  }

  findByTag(tag: string): Node[] {
    return this.findAll((node) => node.tags.includes(tag));
  }

  getRoot(): Node {
    let node: Node = this;
    while (node.parent) node = node.parent;
    return node;
  }

  localToWorld(point: Vec2Like): Vec2 {
    return this.worldMatrix.transformPoint(point);
  }

  worldToLocal(point: Vec2Like): Vec2 {
    const inverse = this.worldMatrix.invert();
    return inverse ? inverse.transformPoint(point) : new Vec2(point.x, point.y);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const child of [...this.children]) child.destroy();
    this.children.length = 0;
    for (const component of this.components) {
      component.onDetach();
      if (component instanceof Script) component.onDestroy();
    }
    this.components.length = 0;
    if (this.parent) {
      const parent = this.parent;
      this.parent = null;
      const index = parent.children.indexOf(this);
      if (index >= 0) parent.children.splice(index, 1);
      parent.markDirty();
    }
    this.attachToWorld(null);
  }

  /** @internal */
  attachToWorld(world: World | null): void {
    if (this.world === world) return;
    this.world = world;
    for (const child of this.children) child.attachToWorld(world);
  }
}
