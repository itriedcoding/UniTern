import type { EditorState } from './state';
import type { Viewport } from './viewport';

export interface EditorContext {
  state: EditorState;
  viewport: Viewport;
  refresh(): void;
  refreshToolbar(): void;
  toast(message: string, tone?: 'info' | 'error'): void;
  importAssets(): void;
  openScene(): void;
  saveScene(): void;
  exportGame(): void;
}
