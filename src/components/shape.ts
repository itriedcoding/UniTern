import { Component } from '../core/component';
import type { ComponentSchema } from '../core/fields';
import { registerComponent } from '../core/registry';
import type { Renderer } from '../render/renderer';
import type { Renderable } from '../render/scene-renderer';

export type ShapeKind = 'rect' | 'circle';

/** Draws a primitive shape centered on the node origin. */
export class ShapeRenderer extends Component implements Renderable {
  static override schema: ComponentSchema = {
    type: 'shape',
    label: 'Shape',
    description: 'Draws a rectangle or circle without an image asset.',
    fields: [
      { key: 'shape', label: 'Shape', type: 'select', options: [
        { value: 'rect', label: 'Rectangle' },
        { value: 'circle', label: 'Circle' },
      ] },
      { key: 'width', label: 'Width', type: 'number', min: 0, step: 1 },
      { key: 'height', label: 'Height', type: 'number', min: 0, step: 1 },
      { key: 'radius', label: 'Radius', type: 'number', min: 0, step: 1, hint: 'Used by circles' },
      { key: 'cornerRadius', label: 'Corner Radius', type: 'number', min: 0, step: 1, hint: 'Used by rectangles' },
      { key: 'color', label: 'Fill', type: 'color' },
      { key: 'strokeColor', label: 'Stroke', type: 'color' },
      { key: 'lineWidth', label: 'Stroke Width', type: 'number', min: 0, step: 0.5 },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'zIndex', label: 'Z Index', type: 'number', step: 1 },
    ],
    defaults: {
      shape: 'rect',
      width: 32,
      height: 32,
      radius: 16,
      cornerRadius: 0,
      color: '#4f8cff',
      strokeColor: '#00000000',
      lineWidth: 0,
      opacity: 1,
      zIndex: 0,
    },
  };

  shape: ShapeKind = 'rect';
  width = 32;
  height = 32;
  radius = 16;
  cornerRadius = 0;
  color = '#4f8cff';
  strokeColor = '#00000000';
  lineWidth = 0;
  opacity = 1;
  zIndex = 0;

  render(renderer: Renderer): void {
    if (this.shape === 'circle') {
      renderer.drawCircle({
        x: 0,
        y: 0,
        radius: this.radius,
        color: this.color,
        opacity: this.opacity,
        strokeColor: this.lineWidth > 0 ? this.strokeColor : undefined,
        lineWidth: this.lineWidth,
      });
      return;
    }
    renderer.drawRect({
      x: -this.width / 2,
      y: -this.height / 2,
      width: this.width,
      height: this.height,
      radius: this.cornerRadius,
      color: this.color,
      opacity: this.opacity,
      strokeColor: this.lineWidth > 0 ? this.strokeColor : undefined,
      lineWidth: this.lineWidth,
    });
  }
}

registerComponent(ShapeRenderer);
