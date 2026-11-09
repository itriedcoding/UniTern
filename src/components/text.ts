import { Component } from '../core/component';
import type { ComponentSchema } from '../core/fields';
import { registerComponent } from '../core/registry';
import type { Renderer } from '../render/renderer';
import type { Renderable } from '../render/scene-renderer';

/** Draws a single- or multi-line text block. */
export class TextRenderer extends Component implements Renderable {
  static override schema: ComponentSchema = {
    type: 'text',
    label: 'Text',
    description: 'Draws text at the node position.',
    fields: [
      { key: 'text', label: 'Text', type: 'textarea' },
      { key: 'size', label: 'Size', type: 'number', min: 1, step: 1 },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'weight', label: 'Weight', type: 'select', options: [
        { value: '400', label: 'Regular' },
        { value: '600', label: 'Semibold' },
        { value: '800', label: 'Heavy' },
      ] },
      { key: 'align', label: 'Align', type: 'select', options: [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' },
      ] },
      { key: 'lineHeight', label: 'Line Height', type: 'number', min: 0, step: 1, hint: '0 is automatic' },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0, max: 1, step: 0.05 },
      { key: 'zIndex', label: 'Z Index', type: 'number', step: 1 },
    ],
    defaults: { text: 'Text', size: 24, color: '#ffffff', weight: '600', align: 'left', lineHeight: 0, opacity: 1, zIndex: 0 },
  };

  text = 'Text';
  size = 24;
  color = '#ffffff';
  weight = '600';
  align: CanvasTextAlign = 'left';
  lineHeight = 0;
  opacity = 1;
  zIndex = 0;

  render(renderer: Renderer): void {
    if (this.text.length === 0) return;
    renderer.drawText({
      text: this.text,
      x: 0,
      y: 0,
      size: this.size,
      color: this.color,
      weight: this.weight,
      align: this.align,
      lineHeight: this.lineHeight > 0 ? this.lineHeight : this.size * 1.25,
      opacity: this.opacity,
    });
  }

  measureWidth(renderer: Renderer): number {
    const lines = this.text.split('\n');
    let widest = 0;
    for (const line of lines) widest = Math.max(widest, renderer.measureText(line, this.size, this.weight));
    return widest;
  }

  measureHeight(): number {
    const lines = this.text.split('\n').length;
    return lines * (this.lineHeight > 0 ? this.lineHeight : this.size * 1.25);
  }
}

registerComponent(TextRenderer);
