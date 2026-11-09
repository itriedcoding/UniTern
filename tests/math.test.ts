import { describe, expect, it } from 'vitest';
import { composeTRS, Mat2D, Node, Rect, Vec2 } from '../src/index';

describe('Vec2', () => {
  it('supports chained vector operations', () => {
    const vector = new Vec2(3, 4);
    expect(vector.length()).toBe(5);
    expect(vector.clone().normalize().length()).toBeCloseTo(1, 10);
    expect(vector.dot(new Vec2(1, 0))).toBe(3);
    expect(vector.distanceTo(new Vec2(0, 0))).toBe(5);
    expect(vector.toArray()).toEqual([3, 4]);
  });

  it('notifies listeners when a component changes', () => {
    const vector = new Vec2();
    let changes = 0;
    vector.onChange(() => changes++);
    vector.x = 5;
    vector.y = 2;
    vector.set(5, 2); // unchanged, must not fire
    expect(changes).toBe(2);
  });
});

describe('Mat2D', () => {
  it('composes translate, rotate and scale', () => {
    const matrix = composeTRS(new Mat2D(), 10, 20, Math.PI / 2, 2, 3);
    const point = matrix.transformPoint({ x: 1, y: 0 });
    expect(point.x).toBeCloseTo(10, 6);
    expect(point.y).toBeCloseTo(22, 6);
  });

  it('inverts transforms', () => {
    const matrix = composeTRS(new Mat2D(), 12, -4, 0.7, 2, 0.5);
    const inverse = matrix.invert();
    expect(inverse).not.toBeNull();
    const point = { x: 3, y: -8 };
    const roundTrip = inverse!.transformPoint(matrix.transformPoint(point));
    expect(roundTrip.x).toBeCloseTo(point.x, 6);
    expect(roundTrip.y).toBeCloseTo(point.y, 6);
  });

  it('returns null for singular matrices', () => {
    expect(new Mat2D(0, 0, 0, 0, 0, 0).invert()).toBeNull();
  });
});

describe('Rect', () => {
  it('intersects and unions', () => {
    const a = new Rect(0, 0, 10, 10);
    const b = new Rect(5, 5, 10, 10);
    expect(a.intersects(b)).toBe(true);
    expect(a.contains({ x: 5, y: 5 })).toBe(true);
    expect(a.intersection(b)?.toArray()).toEqual([5, 5, 5, 5]);
    expect(a.union(b).toArray()).toEqual([0, 0, 15, 15]);
    expect(a.intersects(new Rect(20, 20, 5, 5))).toBe(false);
  });
});

describe('Node transforms', () => {
  it('composes world transforms through the hierarchy', () => {
    const parent = new Node('parent');
    parent.position.set(100, 50);
    parent.rotation = Math.PI / 2;
    const child = new Node('child');
    child.position.set(10, 0);
    parent.add(child);

    const world = child.worldPosition;
    expect(world.x).toBeCloseTo(100, 6);
    expect(world.y).toBeCloseTo(60, 6);

    const backToLocal = child.worldToLocal(world);
    expect(backToLocal.x).toBeCloseTo(0, 6);
    expect(backToLocal.y).toBeCloseTo(0, 6);

    const worldPoint = child.localToWorld({ x: 10, y: 0 });
    expect(worldPoint.x).toBeCloseTo(100, 6);
    expect(worldPoint.y).toBeCloseTo(70, 6);
  });

  it('invalidates cached matrices when a transform changes', () => {
    const node = new Node('node');
    expect(node.worldPosition.x).toBe(0);
    node.position.x = 42;
    expect(node.worldPosition.x).toBe(42);
    node.scale.set(2, 2);
    expect(node.worldScale.x).toBe(2);
  });

  it('prevents cyclic parenting', () => {
    const parent = new Node('parent');
    const child = new Node('child');
    parent.add(child);
    expect(() => child.add(parent)).toThrow();
    expect(() => parent.add(parent)).toThrow();
  });

  it('destroys children recursively', () => {
    const parent = new Node('parent');
    const child = new Node('child');
    parent.add(child);
    parent.destroy();
    expect(parent.destroyed).toBe(true);
    expect(child.destroyed).toBe(true);
    expect(parent.children).toHaveLength(0);
  });
});
