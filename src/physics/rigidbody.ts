import { Component } from '../core/component';
import type { ComponentSchema } from '../core/fields';
import { Vec2 } from '../core/math';
import { registerComponent } from '../core/registry';

export type BodyType = 'dynamic' | 'kinematic' | 'static';

/**
 * Linear rigid body. Velocities are in world units per second; the solver
 * writes displacement back into the owning node's transform.
 */
export class RigidBody2D extends Component {
  static override schema: ComponentSchema = {
    type: 'rigidbody',
    label: 'Rigid Body',
    description: 'Moves the node with velocity and gravity, and resolves collisions.',
    fields: [
      { key: 'bodyType', label: 'Body Type', type: 'select', options: [
        { value: 'dynamic', label: 'Dynamic' },
        { value: 'kinematic', label: 'Kinematic' },
        { value: 'static', label: 'Static' },
      ] },
      { key: 'velocity', label: 'Velocity', type: 'vec2' },
      { key: 'gravityScale', label: 'Gravity Scale', type: 'number', step: 0.1 },
      { key: 'drag', label: 'Drag', type: 'number', min: 0, step: 0.1 },
      { key: 'mass', label: 'Mass', type: 'number', min: 0.0001, step: 0.1 },
      { key: 'maxSpeed', label: 'Max Speed', type: 'number', min: 0, step: 10, hint: '0 means unlimited' },
    ],
    defaults: { bodyType: 'dynamic', velocity: [0, 0], gravityScale: 1, drag: 0, mass: 1, maxSpeed: 0 },
  };

  bodyType: BodyType = 'dynamic';
  velocity = new Vec2();
  gravityScale = 1;
  drag = 0;
  mass = 1;
  maxSpeed = 0;

  /** Set by the physics solver on the last step. */
  grounded = false;
  /** True when the body was grounded on the previous step. */
  wasGrounded = false;

  get inverseMass(): number {
    return this.bodyType === 'dynamic' ? 1 / Math.max(this.mass, 0.0001) : 0;
  }

  get isDynamic(): boolean {
    return this.bodyType === 'dynamic';
  }

  applyImpulse(x: number, y: number): void {
    if (!this.isDynamic) return;
    this.velocity.x += x * this.inverseMass;
    this.velocity.y += y * this.inverseMass;
  }
}

registerComponent(RigidBody2D);
