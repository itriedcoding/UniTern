import { clamp, Vec2 } from '../core/math';
import type { Node } from '../core/node';
import type { World } from '../core/world';
import type { Renderer } from '../render/renderer';
import { BoxCollider2D, CircleCollider2D, Collider2D } from './collider';
import { RigidBody2D } from './rigidbody';

export interface Contact {
  a: Collider2D;
  b: Collider2D;
  normal: Vec2;
  depth: number;
}

interface TrackedPair {
  a: Collider2D;
  b: Collider2D;
  trigger: boolean;
}

interface Manifold {
  normal: Vec2;
  depth: number;
}

function displace(node: Node, worldX: number, worldY: number): void {
  const parent = node.parent;
  if (parent) {
    const inverse = parent.worldMatrix.invert();
    if (inverse) {
      const local = inverse.transformVector({ x: worldX, y: worldY });
      node.position.x += local.x;
      node.position.y += local.y;
    }
    return;
  }
  node.position.x += worldX;
  node.position.y += worldY;
}

function boxBox(a: BoxCollider2D, b: BoxCollider2D): Manifold | null {
  const boundsA = a.worldBounds();
  const boundsB = b.worldBounds();
  const overlapX = Math.min(boundsA.right, boundsB.right) - Math.max(boundsA.left, boundsB.left);
  const overlapY = Math.min(boundsA.bottom, boundsB.bottom) - Math.max(boundsA.top, boundsB.top);
  if (overlapX <= 0 || overlapY <= 0) return null;
  const centerA = boundsA.center;
  const centerB = boundsB.center;
  if (overlapX < overlapY) {
    return { normal: new Vec2(centerA.x < centerB.x ? -1 : 1, 0), depth: overlapX };
  }
  return { normal: new Vec2(0, centerA.y < centerB.y ? -1 : 1), depth: overlapY };
}

function circleCircle(a: CircleCollider2D, b: CircleCollider2D): Manifold | null {
  const centerA = a.worldCenter();
  const centerB = b.worldCenter();
  const radius = a.worldRadius() + b.worldRadius();
  const dx = centerA.x - centerB.x;
  const dy = centerA.y - centerB.y;
  const distanceSq = dx * dx + dy * dy;
  if (distanceSq >= radius * radius) return null;
  const distance = Math.sqrt(distanceSq);
  if (distance < 1e-6) return { normal: new Vec2(1, 0), depth: radius };
  return { normal: new Vec2(dx / distance, dy / distance), depth: radius - distance };
}

/** Contact with the box as `b`; normal points from the box towards the circle. */
function circleBox(circle: CircleCollider2D, box: BoxCollider2D): Manifold | null {
  const center = circle.worldCenter();
  const radius = circle.worldRadius();
  const bounds = box.worldBounds();
  const closestX = clamp(center.x, bounds.left, bounds.right);
  const closestY = clamp(center.y, bounds.top, bounds.bottom);
  const dx = center.x - closestX;
  const dy = center.y - closestY;
  const distanceSq = dx * dx + dy * dy;
  if (distanceSq > radius * radius) return null;
  if (distanceSq > 1e-10) {
    const distance = Math.sqrt(distanceSq);
    return { normal: new Vec2(dx / distance, dy / distance), depth: radius - distance };
  }
  // Circle center is inside the box: push out along the closest edge.
  const toLeft = center.x - bounds.left;
  const toRight = bounds.right - center.x;
  const toTop = center.y - bounds.top;
  const toBottom = bounds.bottom - center.y;
  const minimum = Math.min(toLeft, toRight, toTop, toBottom);
  if (minimum === toLeft) return { normal: new Vec2(-1, 0), depth: radius + toLeft };
  if (minimum === toRight) return { normal: new Vec2(1, 0), depth: radius + toRight };
  if (minimum === toTop) return { normal: new Vec2(0, -1), depth: radius + toTop };
  return { normal: new Vec2(0, 1), depth: radius + toBottom };
}

function detect(a: Collider2D, b: Collider2D): Manifold | null {
  if (a instanceof BoxCollider2D && b instanceof BoxCollider2D) return boxBox(a, b);
  if (a instanceof CircleCollider2D && b instanceof CircleCollider2D) return circleCircle(a, b);
  if (a instanceof CircleCollider2D && b instanceof BoxCollider2D) return circleBox(a, b);
  if (a instanceof BoxCollider2D && b instanceof CircleCollider2D) {
    const manifold = circleBox(b, a);
    if (!manifold) return null;
    return { normal: manifold.normal.scale(-1), depth: manifold.depth };
  }
  return null;
}

function bodyOf(collider: Collider2D): RigidBody2D | undefined {
  return collider.node.getComponent(RigidBody2D);
}

/** Fixed-step physics world. */
export class PhysicsSystem {
  contacts: Contact[] = [];
  private tracked = new Map<string, TrackedPair>();
  private colliderCache: Collider2D[] = [];

  constructor(private readonly world: World) {}

  reset(): void {
    this.contacts = [];
    this.tracked.clear();
    this.colliderCache = [];
  }

  private collectColliders(): Collider2D[] {
    const colliders: Collider2D[] = [];
    const walk = (node: Node): void => {
      if (!node.active || node.destroyed) return;
      for (const component of node.components) {
        if (component.enabled && component instanceof Collider2D && component.node.activeInHierarchy) {
          colliders.push(component);
        }
      }
      for (const child of node.children) walk(child);
    };
    walk(this.world.root);
    return colliders;
  }

  private collectBodies(): RigidBody2D[] {
    const bodies: RigidBody2D[] = [];
    const walk = (node: Node): void => {
      if (!node.active || node.destroyed) return;
      for (const component of node.components) {
        if (component.enabled && component instanceof RigidBody2D && component.node.activeInHierarchy) {
          bodies.push(component);
        }
      }
      for (const child of node.children) walk(child);
    };
    walk(this.world.root);
    return bodies;
  }

  step(dt: number): void {
    void dt;
    const bodies = this.collectBodies();
    const gravity = this.world.gravity;

    for (const body of bodies) {
      body.wasGrounded = body.grounded;
      body.grounded = false;
      if (!body.isDynamic || body.node.destroyed) continue;
      if (body.gravityScale !== 0) {
        body.velocity.x += gravity.x * body.gravityScale * dt;
        body.velocity.y += gravity.y * body.gravityScale * dt;
      }
      if (body.drag > 0) {
        const damping = 1 / (1 + body.drag * dt);
        body.velocity.scale(damping);
      }
      if (body.maxSpeed > 0 && body.velocity.lengthSq() > body.maxSpeed * body.maxSpeed) {
        body.velocity.setLength(body.maxSpeed);
      }
      displace(body.node, body.velocity.x * dt, body.velocity.y * dt);
    }

    const colliders = this.collectColliders();
    this.colliderCache = colliders;
    const contacts: Contact[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < colliders.length; i++) {
      const a = colliders[i];
      for (let j = i + 1; j < colliders.length; j++) {
        const b = colliders[j];
        if (a.node === b.node) continue;
        if (a.node.destroyed || b.node.destroyed) continue;
        if ((a.layer & b.mask) === 0 || (b.layer & a.mask) === 0) continue;
        const boundsA = a.worldBounds();
        const boundsB = b.worldBounds();
        if (!boundsA.intersects(boundsB)) continue;
        const manifold = detect(a, b);
        if (!manifold) continue;

        const trigger = a.isTrigger || b.isTrigger;
        const pairKey = a.uid < b.uid ? `${a.uid}:${b.uid}` : `${b.uid}:${a.uid}`;
        seen.add(pairKey);
        const previous = this.tracked.get(pairKey);
        if (!previous) {
          this.tracked.set(pairKey, { a, b, trigger });
          this.world.events.emit(trigger ? 'trigger:enter' : 'collision:enter', {
            a,
            b,
            normal: manifold.normal.clone(),
            depth: manifold.depth,
          });
        }

        const contact: Contact = { a, b, normal: manifold.normal.clone(), depth: manifold.depth };
        contacts.push(contact);
        if (trigger) continue;

        const bodyA = bodyOf(a);
        const bodyB = bodyOf(b);
        const inverseA = bodyA?.inverseMass ?? 0;
        const inverseB = bodyB?.inverseMass ?? 0;
        const inverseTotal = inverseA + inverseB;
        if (inverseTotal <= 0) continue;

        const correction = manifold.depth / inverseTotal;
        if (inverseA > 0) displace(a.node, manifold.normal.x * correction * inverseA, manifold.normal.y * correction * inverseA);
        if (inverseB > 0) displace(b.node, -manifold.normal.x * correction * inverseB, -manifold.normal.y * correction * inverseB);

        // Remove the approaching component of the relative velocity.
        const relativeX = (bodyA?.velocity.x ?? 0) - (bodyB?.velocity.x ?? 0);
        const relativeY = (bodyA?.velocity.y ?? 0) - (bodyB?.velocity.y ?? 0);
        const normalVelocity = relativeX * manifold.normal.x + relativeY * manifold.normal.y;
        if (normalVelocity < 0) {
          const impulse = -normalVelocity / inverseTotal;
          if (bodyA) bodyA.velocity.addScaled(manifold.normal, impulse * inverseA);
          if (bodyB) bodyB.velocity.addScaled(manifold.normal, -impulse * inverseB);
        }

        if (bodyA && manifold.normal.y < -0.5) bodyA.grounded = true;
        if (bodyB && manifold.normal.y > 0.5) bodyB.grounded = true;
      }
    }

    for (const [key, pair] of this.tracked) {
      if (seen.has(key)) continue;
      this.tracked.delete(key);
      this.world.events.emit(pair.trigger ? 'trigger:exit' : 'collision:exit', {
        a: pair.a,
        b: pair.b,
        normal: new Vec2(),
        depth: 0,
      });
    }

    this.contacts = contacts;
  }

  debugDraw(renderer: Renderer): void {
    for (const collider of this.colliderCache) {
      if (collider.node.destroyed) continue;
      if (collider instanceof BoxCollider2D) {
        const bounds = collider.worldBounds();
        renderer.drawRect({
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          radius: 0,
          color: 'rgba(0,0,0,0)',
          strokeColor: collider.isTrigger ? 'rgba(255,196,84,0.9)' : 'rgba(94,234,164,0.9)',
          lineWidth: 1,
        });
      } else if (collider instanceof CircleCollider2D) {
        const center = collider.worldCenter();
        renderer.drawCircle({
          x: center.x,
          y: center.y,
          radius: collider.worldRadius(),
          color: 'rgba(0,0,0,0)',
          strokeColor: collider.isTrigger ? 'rgba(255,196,84,0.9)' : 'rgba(94,234,164,0.9)',
          lineWidth: 1,
        });
      }
    }
    for (const contact of this.contacts) {
      const center = contact.normal.lengthSq() > 0 ? contact.a.worldBounds().center : null;
      if (!center) continue;
      renderer.drawLine({
        x1: center.x,
        y1: center.y,
        x2: center.x + contact.normal.x * 18,
        y2: center.y + contact.normal.y * 18,
        color: 'rgba(255,84,112,0.9)',
        lineWidth: 1.5,
      });
    }
  }
}

