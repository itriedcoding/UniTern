import type { Component } from '../core/component';
import type { Node } from '../core/node';
import type { Renderer } from './renderer';

/** Components that draw themselves implement this interface. */
export interface Renderable {
  zIndex: number;
  render(renderer: Renderer): void;
}

export function isRenderable(component: Component): component is Component & Renderable {
  const candidate = component as Component & Partial<Renderable>;
  return typeof candidate.render === 'function' && typeof candidate.zIndex === 'number';
}

function drawNode(node: Node, renderer: Renderer, inScreenSpace: boolean): void {
  if (!node.active || !node.visible || node.destroyed) return;
  const ctx = renderer.ctx;
  const screenSpace = inScreenSpace || node.screenSpace;

  if (node.screenSpace && !inScreenSpace) renderer.pushScreenSpace();
  ctx.save();
  ctx.translate(node.position.x, node.position.y);
  if (node.rotation !== 0) ctx.rotate(node.rotation);
  if (node.scale.x !== 1 || node.scale.y !== 1) ctx.scale(node.scale.x, node.scale.y);

  const renderables = node.components
    .filter((component) => component.enabled)
    .filter(isRenderable)
    .sort((a, b) => a.zIndex - b.zIndex);

  for (const renderable of renderables) renderable.render(renderer);

  const children = node.children.length > 1 ? [...node.children].sort((a, b) => a.zIndex - b.zIndex) : node.children;
  for (const child of children) drawNode(child, renderer, screenSpace);

  ctx.restore();
  if (node.screenSpace && !inScreenSpace) renderer.popScreenSpace();
}

/** Render a node tree into the renderer's current frame. */
export function renderNodeTree(root: Node, renderer: Renderer): void {
  drawNode(root, renderer, false);
}
