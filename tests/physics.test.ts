import { describe, expect, it } from 'vitest';
import {
  BoxCollider2D,
  CircleCollider2D,
  Node,
  RigidBody2D,
  Vec2,
  World,
  type ContactEvent,
} from '../src/index';

function step(world: World, frames: number, dt = 1 / 60): void {
  for (let i = 0; i < frames; i++) world.update(dt);
}

function boxBody(name: string, x: number, y: number, width: number, height: number): Node {
  const node = new Node(name);
  node.position.set(x, y);
  const collider = node.addComponent(new BoxCollider2D());
  collider.size.set(width, height);
  node.addComponent(new RigidBody2D());
  return node;
}

describe('PhysicsSystem', () => {
  it('applies gravity and integrates velocity', () => {
    const world = new World({ gravity: [0, 600] });
    const node = boxBody('faller', 0, 0, 20, 20);
    world.add(node);
    step(world, 60);

    const body = node.getComponent(RigidBody2D)!;
    expect(body.velocity.y).toBeGreaterThan(500);
    expect(node.position.y).toBeGreaterThan(100);
  });

  it('lands dynamic bodies on static ground', () => {
    const world = new World({ gravity: [0, 1000] });
    const ground = new Node('ground');
    ground.position.set(0, 100);
    const groundCollider = ground.addComponent(new BoxCollider2D());
    groundCollider.size.set(400, 40);
    world.add(ground);

    const player = boxBody('player', 0, 0, 32, 32);
    world.add(player);
    step(world, 180);

    const body = player.getComponent(RigidBody2D)!;
    expect(body.grounded).toBe(true);
    expect(player.position.y).toBeCloseTo(64, 0);
    expect(Math.abs(body.velocity.y)).toBeLessThan(40);
  });

  it('separates overlapping dynamic bodies', () => {
    const world = new World({ gravity: [0, 0] });
    const a = boxBody('a', 0, 0, 32, 32);
    const b = boxBody('b', 10, 0, 32, 32);
    world.add(a);
    world.add(b);
    step(world, 1);

    const distance = Math.abs(a.position.x - b.position.x);
    expect(distance).toBeCloseTo(32, 0);
  });

  it('emits collision events on enter and exit', () => {
    const world = new World({ gravity: [0, 1000] });
    const ground = new Node('ground');
    ground.position.set(0, 100);
    ground.addComponent(new BoxCollider2D()).size.set(400, 40);
    world.add(ground);

    const player = boxBody('player', 0, 0, 32, 32);
    world.add(player);

    const events: string[] = [];
    world.events.on('collision:enter', () => events.push('enter'));
    world.events.on('collision:exit', () => events.push('exit'));

    step(world, 180);
    expect(events).toContain('enter');

    player.position.y = -400;
    player.getComponent(RigidBody2D)!.velocity.set(0, 0);
    step(world, 2);
    expect(events).toContain('exit');
  });

  it('does not resolve trigger overlaps but reports them once', () => {
    const world = new World({ gravity: [0, 0] });
    const coin = new Node('coin');
    const trigger = coin.addComponent(new CircleCollider2D());
    trigger.radius = 12;
    trigger.isTrigger = true;
    world.add(coin);

    const player = boxBody('player', 0, 0, 32, 32);
    world.add(player);

    let triggers = 0;
    let payload: ContactEvent | null = null;
    world.events.on('trigger:enter', (event) => {
      triggers++;
      payload = event;
    });

    step(world, 5);
    expect(triggers).toBe(1);
    expect(payload).not.toBeNull();
    // Nothing was pushed apart.
    expect(player.position.x).toBe(0);
    expect(player.position.y).toBe(0);
  });

  it('ignores colliders whose layer masks do not match', () => {
    const world = new World({ gravity: [0, 0] });
    const a = boxBody('a', 0, 0, 32, 32);
    const b = boxBody('b', 8, 0, 32, 32);
    a.getComponent(BoxCollider2D)!.layer = 2;
    a.getComponent(BoxCollider2D)!.mask = 2;
    b.getComponent(BoxCollider2D)!.layer = 1;
    b.getComponent(BoxCollider2D)!.mask = 1;
    world.add(a);
    world.add(b);
    step(world, 1);
    expect(a.position.x).toBe(0);
    expect(b.position.x).toBe(8);
  });

  it('moves bodies parented to rotated nodes along world velocity', () => {
    const world = new World({ gravity: [0, 0] });
    const parent = new Node('parent');
    parent.rotation = Math.PI / 2;
    const child = new Node('child');
    child.addComponent(new RigidBody2D());
    child.getComponent(RigidBody2D)!.velocity.set(60, 0);
    parent.add(child);
    world.add(parent);

    step(world, 60);
    const worldPosition = child.worldPosition;
    expect(worldPosition.x).toBeCloseTo(60, 0);
    expect(worldPosition.y).toBeCloseTo(0, 6);
    expect(child.position.x).toBeCloseTo(0, 6);
    expect(child.position.y).toBeCloseTo(-60, 0);
    expect(new Vec2().distanceTo(worldPosition)).toBeGreaterThan(50);
  });
});
