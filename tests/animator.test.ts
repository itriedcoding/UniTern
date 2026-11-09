import { describe, expect, it } from 'vitest';
import { Node, SpriteAnimator, SpriteRenderer, World } from '../src/index';

function advance(world: World, frames: number, dt = 0.1): void {
  for (let i = 0; i < frames; i++) world.update(dt);
}

function makeAnimated(loop: boolean): { world: World; animator: SpriteAnimator; sprite: SpriteRenderer } {
  const world = new World();
  const node = new Node('animated');
  const sprite = node.addComponent(new SpriteRenderer());
  const animator = node.addComponent(new SpriteAnimator());
  animator.frameWidth = 16;
  animator.frameHeight = 8;
  animator.columns = 4;
  animator.frames = 6;
  animator.fps = 10;
  animator.loop = loop;
  world.add(node);
  world.update(1 / 60);
  return { world, animator, sprite };
}

describe('SpriteAnimator', () => {
  it('advances frames at the configured rate and advances rows through the sheet', () => {
    const { world, animator, sprite } = makeAnimated(true);
    expect(animator.currentFrame).toBe(0);
    expect(sprite.frame?.toArray()).toEqual([0, 0, 16, 8]);

    advance(world, 1);
    expect(animator.currentFrame).toBe(1);
    expect(sprite.frame?.toArray()).toEqual([16, 0, 16, 8]);

    advance(world, 3);
    expect(animator.currentFrame).toBe(4);
    expect(sprite.frame?.toArray()).toEqual([0, 8, 16, 8]);
  });

  it('loops back to the first frame', () => {
    const { world, animator } = makeAnimated(true);
    advance(world, 6);
    expect(animator.currentFrame).toBe(0);
    expect(animator.playing).toBe(true);
  });

  it('stops on the last frame when not looping', () => {
    const { world, animator } = makeAnimated(false);
    advance(world, 8);
    expect(animator.currentFrame).toBe(5);
    expect(animator.playing).toBe(false);

    advance(world, 5);
    expect(animator.currentFrame).toBe(5);
  });

  it('restarts playback', () => {
    const { world, animator } = makeAnimated(false);
    advance(world, 8);
    animator.restart();
    expect(animator.currentFrame).toBe(0);
    expect(animator.playing).toBe(true);
  });
});
