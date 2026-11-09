import { describe, expect, it } from 'vitest';
import { Camera2D, Node, Rect, Script, World, createSceneData, normalizeScene } from '../src/index';

class RecordingScript extends Script {
  log: string[] = [];

  override start(): void {
    this.log.push('start');
  }

  override fixedUpdate(dt: number): void {
    this.log.push(`fixed:${dt.toFixed(4)}`);
  }

  override update(dt: number): void {
    this.log.push(`update:${dt.toFixed(4)}`);
  }

  override lateUpdate(): void {
    this.log.push('late');
  }

  override onDestroy(): void {
    this.log.push('destroy');
  }
}

describe('World', () => {
  it('runs the script lifecycle in order', () => {
    const world = new World();
    const node = new Node('node');
    const script = node.addComponent(new RecordingScript());
    world.add(node);

    world.update(1 / 60);
    expect(script.log[0]).toBe('start');
    expect(script.log).toContain('fixed:0.0167');
    expect(script.log.indexOf('fixed:0.0167')).toBeLessThan(script.log.indexOf('update:0.0167'));
    expect(script.log.indexOf('update:0.0167')).toBeLessThan(script.log.indexOf('late'));

    const startCount = script.log.filter((entry) => entry === 'start').length;
    world.update(1 / 60);
    expect(script.log.filter((entry) => entry === 'start')).toHaveLength(startCount);
  });

  it('runs fixed steps to catch up with larger frames', () => {
    const world = new World();
    const node = new Node('node');
    const script = node.addComponent(new RecordingScript());
    world.add(node);

    world.update(1 / 30);
    expect(script.log.filter((entry) => entry.startsWith('fixed:'))).toHaveLength(2);
    expect(world.fixedTime).toBeCloseTo(2 / 60, 6);
    expect(world.time).toBeCloseTo(1 / 30, 6);
  });

  it('caps catch-up steps to avoid a spiral of death', () => {
    const world = new World();
    const node = new Node('node');
    const script = node.addComponent(new RecordingScript());
    world.add(node);
    world.update(1);
    expect(script.log.filter((entry) => entry.startsWith('fixed:')).length).toBe(world.maxSubSteps);
  });

  it('honours pause and time scale', () => {
    const world = new World();
    const node = new Node('node');
    const script = node.addComponent(new RecordingScript());
    world.add(node);

    world.paused = true;
    world.update(1 / 60);
    expect(script.log).toHaveLength(0);
    expect(world.time).toBe(0);

    world.paused = false;
    world.timeScale = 0.5;
    world.update(1 / 60);
    expect(world.time).toBeCloseTo(1 / 120, 6);
  });

  it('destroys scripts and removes nodes', () => {
    const world = new World();
    const node = new Node('node');
    const script = node.addComponent(new RecordingScript());
    world.add(node);
    world.update(1 / 60);
    node.destroy();
    expect(script.log).toContain('destroy');
    expect(world.root.children).toHaveLength(0);
  });

  it('loads scenes and applies settings', () => {
    const scene = createSceneData('Test');
    scene.settings.gravity = [0, 42];
    scene.settings.background = '#123456';
    scene.settings.fixedStep = 1 / 120;
    scene.root.position = [5, 6];
    const world = new World();
    world.loadScene(normalizeScene(scene));
    expect(world.gravity.y).toBe(42);
    expect(world.backgroundColor).toBe('#123456');
    expect(world.fixedStep).toBeCloseTo(1 / 120, 8);
    expect(world.root.children[0].position.x).toBe(5);
    world.destroy();
    expect(world.isDestroyed).toBe(true);
  });
});

describe('Camera2D', () => {
  it('follows a target with smoothing disabled', () => {
    const world = new World();
    const target = new Node('target');
    target.position.set(400, 250);
    world.add(target);

    const cameraNode = new Node('camera');
    const camera = cameraNode.addComponent(new Camera2D());
    camera.damping = 0;
    camera.followId = target.id;
    camera.zoom = 2;
    world.add(cameraNode);

    world.update(1 / 60);
    expect(world.camera.position.x).toBeCloseTo(400, 5);
    expect(world.camera.position.y).toBeCloseTo(250, 5);
    expect(world.camera.zoom).toBe(2);

    target.position.set(500, 300);
    world.update(1 / 60);
    expect(world.camera.position.x).toBeCloseTo(500, 5);
  });

  it('clamps the camera to bounds', () => {
    const world = new World();
    world.viewport = { width: 200, height: 100 };
    const target = new Node('target');
    target.position.set(500, 500);
    world.add(target);

    const cameraNode = new Node('camera');
    const camera = cameraNode.addComponent(new Camera2D());
    camera.damping = 0;
    camera.followId = target.id;
    camera.bounds = new Rect(0, 0, 400, 200);
    world.add(cameraNode);

    world.update(1 / 60);
    // Half viewport is 100x50, so the view is clamped inside the 400x200 bounds.
    expect(world.camera.position.x).toBeCloseTo(300, 5);
    expect(world.camera.position.y).toBeCloseTo(150, 5);
  });
});
