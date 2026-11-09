import { Script } from '../core/component';
import type { ComponentSchema } from '../core/fields';
import { clamp, Rect } from '../core/math';
import { registerComponent } from '../core/registry';
import { SpriteRenderer } from './sprite';

/** Steps a sibling Sprite through frames of a sprite sheet. */
export class SpriteAnimator extends Script {
  static override schema: ComponentSchema = {
    type: 'animator',
    label: 'Sprite Animator',
    description: 'Plays frames from a sprite sheet on the sibling Sprite component.',
    fields: [
      { key: 'frameWidth', label: 'Frame Width', type: 'number', min: 1, step: 1 },
      { key: 'frameHeight', label: 'Frame Height', type: 'number', min: 1, step: 1 },
      { key: 'columns', label: 'Columns', type: 'number', min: 1, step: 1 },
      { key: 'frames', label: 'Frame Count', type: 'number', min: 1, step: 1 },
      { key: 'fps', label: 'FPS', type: 'number', min: 0.1, step: 0.5 },
      { key: 'loop', label: 'Loop', type: 'boolean' },
      { key: 'playing', label: 'Playing', type: 'boolean' },
      { key: 'startFrame', label: 'Start Frame', type: 'number', min: 0, step: 1 },
    ],
    defaults: { frameWidth: 16, frameHeight: 16, columns: 1, frames: 1, fps: 8, loop: true, playing: true, startFrame: 0 },
  };

  frameWidth = 16;
  frameHeight = 16;
  columns = 1;
  frames = 1;
  fps = 8;
  loop = true;
  playing = true;
  startFrame = 0;

  private elapsed = 0;
  private frameIndex = 0;

  /** Zero-based index of the frame currently shown. */
  get currentFrame(): number {
    return this.frameIndex;
  }

  override start(): void {
    this.frameIndex = clamp(Math.floor(this.startFrame), 0, Math.max(0, this.frames - 1));
    this.elapsed = 0;
    this.applyFrame();
  }

  override update(dt: number): void {
    if (!this.playing || this.fps <= 0) return;
    const frameCount = Math.max(1, Math.floor(this.frames));
    this.elapsed += dt;
    const secondsPerFrame = 1 / this.fps;
    while (this.elapsed >= secondsPerFrame) {
      this.elapsed -= secondsPerFrame;
      const next = this.frameIndex + 1;
      if (next >= frameCount) {
        if (this.loop) {
          this.frameIndex = 0;
        } else {
          this.frameIndex = frameCount - 1;
          this.playing = false;
          break;
        }
      } else {
        this.frameIndex = next;
      }
    }
    this.applyFrame();
  }

  /** Restart playback from the configured start frame. */
  restart(): void {
    this.frameIndex = clamp(Math.floor(this.startFrame), 0, Math.max(0, this.frames - 1));
    this.elapsed = 0;
    this.playing = true;
    this.applyFrame();
  }

  private applyFrame(): void {
    const sprite = this.node.getComponent(SpriteRenderer);
    if (!sprite) return;
    const column = this.frameIndex % Math.max(1, Math.floor(this.columns));
    const row = Math.floor(this.frameIndex / Math.max(1, Math.floor(this.columns)));
    sprite.frame = new Rect(column * this.frameWidth, row * this.frameHeight, this.frameWidth, this.frameHeight);
  }
}

registerComponent(SpriteAnimator);
