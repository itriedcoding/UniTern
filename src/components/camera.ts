import { Script } from '../core/component';
import type { ComponentSchema } from '../core/fields';
import { clamp, damp, degToRad, randRange, Rect, Vec2 } from '../core/math';
import { registerComponent } from '../core/registry';

/** Drives the world camera. Only one active camera should exist at a time. */
export class Camera2D extends Script {
  static override schema: ComponentSchema = {
    type: 'camera',
    label: 'Camera',
    description: 'Controls the view. Follow another node for a tracking camera.',
    fields: [
      { key: 'active', label: 'Active', type: 'boolean' },
      { key: 'zoom', label: 'Zoom', type: 'number', min: 0.05, max: 20, step: 0.05 },
      { key: 'rotationDegrees', label: 'Rotation', type: 'number', step: 1, suffix: '°' },
      { key: 'followId', label: 'Follow Node', type: 'node' },
      { key: 'offset', label: 'Offset', type: 'vec2' },
      { key: 'damping', label: 'Damping', type: 'number', min: 0, step: 0.5, hint: '0 snaps instantly' },
      { key: 'bounds', label: 'Bounds', type: 'rect', hint: 'Optional world-space camera limits' },
    ],
    defaults: {
      active: true,
      zoom: 1,
      rotationDegrees: 0,
      followId: '',
      offset: [0, 0],
      damping: 8,
      bounds: null,
    },
  };

  active = true;
  zoom = 1;
  rotationDegrees = 0;
  followId = '';
  offset = new Vec2();
  damping = 8;
  bounds: Rect | null = null;

  private shakeRemaining = 0;
  private shakeDuration = 0;
  private shakeIntensity = 0;

  /** Add a decaying screen shake. */
  shake(duration = 0.25, intensity = 10): void {
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeRemaining = Math.max(this.shakeRemaining, duration);
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  override lateUpdate(dt: number): void {
    if (!this.active) return;
    const world = this.world;
    const camera = world.camera;
    camera.zoom = clamp(this.zoom, 0.05, 20);
    camera.rotation = degToRad(this.rotationDegrees);

    let target = this.node.worldPosition.clone().add(this.offset);
    if (this.followId) {
      const followed = world.findById(this.followId);
      if (followed) target = followed.worldPosition.clone().add(this.offset);
    }

    if (this.damping > 0) {
      camera.position.x = damp(camera.position.x, target.x, this.damping, dt);
      camera.position.y = damp(camera.position.y, target.y, this.damping, dt);
    } else {
      camera.position.copy(target);
    }

    if (this.bounds) {
      const halfWidth = world.viewport.width / (2 * camera.zoom);
      const halfHeight = world.viewport.height / (2 * camera.zoom);
      camera.position.x =
        this.bounds.width <= halfWidth * 2
          ? this.bounds.centerX
          : clamp(camera.position.x, this.bounds.left + halfWidth, this.bounds.right - halfWidth);
      camera.position.y =
        this.bounds.height <= halfHeight * 2
          ? this.bounds.centerY
          : clamp(camera.position.y, this.bounds.top + halfHeight, this.bounds.bottom - halfHeight);
    }

    if (this.shakeRemaining > 0 && this.shakeDuration > 0) {
      this.shakeRemaining = Math.max(0, this.shakeRemaining - dt);
      const falloff = this.shakeRemaining / this.shakeDuration;
      const amount = this.shakeIntensity * falloff * falloff;
      camera.position.x += randRange(-amount, amount);
      camera.position.y += randRange(-amount, amount);
      if (this.shakeRemaining === 0) this.shakeIntensity = 0;
    }
  }
}

registerComponent(Camera2D);
