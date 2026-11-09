import { Script } from '../core/component';
import type { ComponentSchema } from '../core/fields';
import { clamp, degToRad, moveTowards, TAU, Vec2 } from '../core/math';
import { registerComponent } from '../core/registry';
import { RigidBody2D } from '../physics/rigidbody';
import { SpriteRenderer } from './sprite';
import { TextRenderer } from './text';

const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];
const JUMP_KEYS = ['Space', 'KeyW', 'ArrowUp'];

/** Classic platformer movement: run, coyote time, jump buffering, variable jump height. */
export class PlatformerController extends Script {
  static override schema: ComponentSchema = {
    type: 'platformer-controller',
    label: 'Platformer Controller',
    description: 'Keyboard movement for a dynamic rigid body. A/D or arrows to move, space to jump.',
    fields: [
      { key: 'moveSpeed', label: 'Move Speed', type: 'number', min: 0, step: 10 },
      { key: 'groundAcceleration', label: 'Ground Accel', type: 'number', min: 0, step: 100 },
      { key: 'airAcceleration', label: 'Air Accel', type: 'number', min: 0, step: 100 },
      { key: 'jumpVelocity', label: 'Jump Velocity', type: 'number', min: 0, step: 10 },
      { key: 'coyoteTime', label: 'Coyote Time', type: 'number', min: 0, step: 0.01, suffix: 's' },
      { key: 'jumpBufferTime', label: 'Jump Buffer', type: 'number', min: 0, step: 0.01, suffix: 's' },
      { key: 'jumpCutMultiplier', label: 'Jump Cut', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'maxFallSpeed', label: 'Max Fall Speed', type: 'number', min: 0, step: 50 },
    ],
    defaults: {
      moveSpeed: 320,
      groundAcceleration: 2600,
      airAcceleration: 1600,
      jumpVelocity: 660,
      coyoteTime: 0.1,
      jumpBufferTime: 0.12,
      jumpCutMultiplier: 0.45,
      maxFallSpeed: 1400,
    },
  };

  moveSpeed = 320;
  groundAcceleration = 2600;
  airAcceleration = 1600;
  jumpVelocity = 660;
  coyoteTime = 0.1;
  jumpBufferTime = 0.12;
  jumpCutMultiplier = 0.45;
  maxFallSpeed = 1400;

  private coyote = 0;
  private jumpBuffer = 0;

  get body(): RigidBody2D | undefined {
    return this.node.getComponent(RigidBody2D);
  }

  override start(): void {
    if (!this.body) {
      console.warn(`[unitern] PlatformerController on "${this.node.name}" needs a RigidBody2D`);
    }
  }

  override fixedUpdate(dt: number): void {
    const body = this.body;
    const input = this.world.input;
    if (!body || !input || !body.isDynamic) return;

    const axis = input.axis(LEFT_KEYS, RIGHT_KEYS);
    const acceleration = body.grounded ? this.groundAcceleration : this.airAcceleration;
    body.velocity.x = moveTowards(body.velocity.x, axis * this.moveSpeed, acceleration * dt);

    if (axis !== 0) {
      const sprite = this.node.getComponent(SpriteRenderer);
      if (sprite) sprite.flipX = axis < 0;
    }

    if (body.grounded) this.coyote = this.coyoteTime;
    else this.coyote = Math.max(0, this.coyote - dt);

    if (input.isPressed(...JUMP_KEYS)) this.jumpBuffer = this.jumpBufferTime;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      body.velocity.y = -this.jumpVelocity;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.world.audio?.playTone({ frequency: 480, slideTo: 720, duration: 0.12, type: 'triangle', volume: 0.06 });
    }

    if (input.isReleased(...JUMP_KEYS) && body.velocity.y < 0) {
      body.velocity.y *= clamp(this.jumpCutMultiplier, 0, 1);
    }

    if (this.maxFallSpeed > 0 && body.velocity.y > this.maxFallSpeed) body.velocity.y = this.maxFallSpeed;
  }
}

/** Moves a node back and forth around its starting position. */
export class Oscillator extends Script {
  static override schema: ComponentSchema = {
    type: 'oscillator',
    label: 'Oscillator',
    description: 'Moves the node in a sine wave around its start position.',
    fields: [
      { key: 'amplitude', label: 'Amplitude', type: 'vec2' },
      { key: 'frequency', label: 'Frequency', type: 'number', min: 0, step: 0.1, suffix: 'Hz' },
      { key: 'phase', label: 'Phase', type: 'number', step: 0.1 },
    ],
    defaults: { amplitude: [0, 6], frequency: 1, phase: 0 },
  };

  amplitude = new Vec2(0, 6);
  frequency = 1;
  phase = 0;

  private origin = new Vec2();
  private elapsed = 0;

  override start(): void {
    this.origin.copy(this.node.position);
  }

  override update(dt: number): void {
    this.elapsed += dt;
    const offset = Math.sin(this.elapsed * this.frequency * TAU + this.phase);
    this.node.position.x = this.origin.x + this.amplitude.x * offset;
    this.node.position.y = this.origin.y + this.amplitude.y * offset;
  }
}

/** Spins a node continuously. */
export class Spinner extends Script {
  static override schema: ComponentSchema = {
    type: 'spinner',
    label: 'Spinner',
    description: 'Rotates the node at a constant rate.',
    fields: [{ key: 'degreesPerSecond', label: 'Speed', type: 'number', step: 5, suffix: '°/s' }],
    defaults: { degreesPerSecond: 90 },
  };

  degreesPerSecond = 90;

  override update(dt: number): void {
    this.node.rotation += degToRad(this.degreesPerSecond) * dt;
  }
}

/** Offsets a node relative to the camera for depth layers. */
export class Parallax extends Script {
  static override schema: ComponentSchema = {
    type: 'parallax',
    label: 'Parallax',
    description: 'Scrolls a background layer at a fraction of the camera movement. 1 is static, 0 is locked to the camera.',
    fields: [{ key: 'factor', label: 'Factor', type: 'vec2' }],
    defaults: { factor: [0.3, 1] },
  };

  factor = new Vec2(0.3, 1);
  private origin = new Vec2();

  override start(): void {
    this.origin.copy(this.node.position);
  }

  override lateUpdate(): void {
    const camera = this.world.camera.position;
    this.node.position.x = this.origin.x + camera.x * (1 - this.factor.x);
    this.node.position.y = this.origin.y + camera.y * (1 - this.factor.y);
  }
}

export interface CollectPayload {
  value: number;
  node: import('../core/node').Node;
}

/** Destroys the node when a matching body enters its trigger collider. */
export class Collectible extends Script {
  static override schema: ComponentSchema = {
    type: 'collectible',
    label: 'Collectible',
    description: 'Emits a "collect" event and disappears when a tagged body enters its trigger.',
    fields: [
      { key: 'value', label: 'Value', type: 'number', step: 1 },
      { key: 'requiredTag', label: 'Collector Tag', type: 'text' },
      { key: 'destroyOnCollect', label: 'Destroy', type: 'boolean' },
      { key: 'sound', label: 'Sound', type: 'boolean' },
    ],
    defaults: { value: 10, requiredTag: 'player', destroyOnCollect: true, sound: true },
  };

  value = 10;
  requiredTag = 'player';
  destroyOnCollect = true;
  sound = true;

  private unsubscribe: (() => void) | null = null;

  override start(): void {
    this.unsubscribe = this.world.events.on('trigger:enter', ({ a, b }) => {
      const other = a.node === this.node ? b : b.node === this.node ? a : null;
      if (!other) return;
      if (this.requiredTag && !other.node.tags.includes(this.requiredTag)) return;
      this.world.events.emit('collect', { value: this.value, node: this.node });
      if (this.sound) {
        this.world.audio?.playTone({ frequency: 880, slideTo: 1320, duration: 0.14, type: 'sine', volume: 0.08 });
      }
      if (this.destroyOnCollect) this.node.destroy();
    });
  }

  override onDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

/** Binds a text node to a gameplay event, optionally accumulating a total. */
export class CounterText extends Script {
  static override schema: ComponentSchema = {
    type: 'counter-text',
    label: 'Counter Text',
    description: 'Writes an event value into a sibling Text component. Use {value} in the template.',
    fields: [
      { key: 'event', label: 'Event', type: 'text' },
      { key: 'template', label: 'Template', type: 'text', hint: '{value} is replaced with the counter' },
      { key: 'accumulate', label: 'Accumulate', type: 'boolean' },
      { key: 'startingValue', label: 'Start Value', type: 'number', step: 1 },
    ],
    defaults: { event: 'collect', template: 'SCORE {value}', accumulate: true, startingValue: 0 },
  };

  event = 'collect';
  template = 'SCORE {value}';
  accumulate = true;
  startingValue = 0;

  private total = 0;
  private unsubscribe: (() => void) | null = null;

  override start(): void {
    this.total = this.startingValue;
    this.write();
    this.unsubscribe = this.world.events.on(this.event, (payload) => {
      const value = typeof (payload as { value?: unknown }).value === 'number' ? (payload as { value: number }).value : 1;
      this.total = this.accumulate ? this.total + value : value;
      this.write();
    });
  }

  private write(): void {
    const text = this.node.getComponent(TextRenderer);
    if (!text) return;
    text.text = this.template.replaceAll('{value}', String(this.total));
  }

  override onDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}

registerComponent(PlatformerController);
registerComponent(Oscillator);
registerComponent(Spinner);
registerComponent(Parallax);
registerComponent(Collectible);
registerComponent(CounterText);
