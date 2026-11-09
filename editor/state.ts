import {
  countNodes,
  createComponentByType,
  createNodeData,
  createSceneData,
  makeId,
  normalizeScene,
  type AssetData,
  type NodeData,
  type SceneData,
} from '../src/index';

export type ChangeReason = 'view' | 'full';

/**
 * The editor edits plain scene data rather than live engine nodes. That keeps
 * undo/redo, saving and play mode trivial and predictable.
 */
export class EditorState {
  scene: SceneData;
  selectedId: string | null;
  dirty = false;
  version = 0;

  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private listeners = new Set<(reason: ChangeReason) => void>();
  private transactionSnapshot: string | null = null;

  constructor(scene: SceneData = createSceneData()) {
    this.scene = normalizeScene(scene);
    this.selectedId = this.scene.root.id;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get nodeCount(): number {
    return countNodes(this.scene.root);
  }

  subscribe(listener: (reason: ChangeReason) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(reason: ChangeReason): void {
    for (const listener of [...this.listeners]) listener(reason);
  }

  /** Bump the document version so the viewport rebuilds its preview tree. */
  touch(reason: ChangeReason = 'full'): void {
    this.version++;
    this.notify(reason);
  }

  snapshot(): string {
    return JSON.stringify(this.scene);
  }

  /** Run a document change as one undoable step. */
  mutate(change: () => void): void {
    const before = this.snapshot();
    change();
    this.pushHistory(before);
    this.dirty = true;
    this.touch('full');
  }

  /** Group continuous edits (typing, dragging) into one undo step. */
  beginTransaction(): void {
    if (this.transactionSnapshot === null) this.transactionSnapshot = this.snapshot();
  }

  endTransaction(): void {
    const before = this.transactionSnapshot;
    this.transactionSnapshot = null;
    if (before === null) return;
    if (before !== this.snapshot()) {
      this.pushHistory(before);
      this.dirty = true;
      this.touch('full');
    } else {
      this.touch('view');
    }
  }

  cancelTransaction(): void {
    this.transactionSnapshot = null;
  }

  private pushHistory(snapshot: string): void {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > 120) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): void {
    const previous = this.undoStack.pop();
    if (previous === undefined) return;
    this.redoStack.push(this.snapshot());
    this.scene = normalizeScene(JSON.parse(previous));
    this.afterHistory();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (next === undefined) return;
    this.undoStack.push(this.snapshot());
    this.scene = normalizeScene(JSON.parse(next));
    this.afterHistory();
  }

  private afterHistory(): void {
    if (!this.findNode(this.selectedId)) this.selectedId = this.scene.root.id;
    this.dirty = true;
    this.touch('full');
  }

  reset(scene: SceneData, options: { dirty?: boolean } = {}): void {
    this.scene = normalizeScene(scene);
    this.selectedId = this.scene.root.id;
    this.undoStack = [];
    this.redoStack = [];
    this.transactionSnapshot = null;
    this.dirty = options.dirty ?? false;
    this.touch('full');
  }

  markSaved(): void {
    this.dirty = false;
    this.touch('full');
  }

  select(id: string | null): void {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.notify('full');
  }

  findNode(id: string | null | undefined): NodeData | null {
    if (!id) return null;
    const walk = (node: NodeData): NodeData | null => {
      if (node.id === id) return node;
      for (const child of node.children) {
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(this.scene.root);
  }

  findParent(id: string): NodeData | null {
    const walk = (node: NodeData): NodeData | null => {
      for (const child of node.children) {
        if (child.id === id) return node;
        const found = walk(child);
        if (found) return found;
      }
      return null;
    };
    return walk(this.scene.root);
  }

  private containsNode(ancestor: NodeData, id: string): boolean {
    for (const child of ancestor.children) {
      if (child.id === id || this.containsNode(child, id)) return true;
    }
    return false;
  }

  addNode(parentId: string | null, position: [number, number], name = 'Node'): NodeData {
    const node = createNodeData(name, position);
    this.mutate(() => {
      const parent = (parentId ? this.findNode(parentId) : null) ?? this.scene.root;
      parent.children.push(node);
    });
    this.select(node.id);
    return node;
  }

  removeNode(id: string): void {
    if (id === this.scene.root.id) return;
    const parent = this.findParent(id);
    if (!parent) return;
    this.mutate(() => {
      parent.children = parent.children.filter((child) => child.id !== id);
    });
    if (this.selectedId === id) this.select(parent.id);
  }

  duplicateNode(id: string): void {
    const node = this.findNode(id);
    const parent = this.findParent(id);
    if (!node || !parent) return;
    const clone = (source: NodeData): NodeData => ({
      ...source,
      id: makeId('node'),
      name: `${source.name} Copy`,
      tags: [...source.tags],
      position: [...source.position],
      scale: [...source.scale],
      components: source.components.map((component) => ({ ...component })),
      children: source.children.map(clone),
    });
    const copy = clone(node);
    this.mutate(() => {
      const index = parent.children.findIndex((child) => child.id === id);
      parent.children.splice(index + 1, 0, copy);
    });
    this.select(copy.id);
  }

  moveNode(id: string, direction: -1 | 1): void {
    const parent = this.findParent(id);
    if (!parent) return;
    const index = parent.children.findIndex((child) => child.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= parent.children.length) return;
    this.mutate(() => {
      const [node] = parent.children.splice(index, 1);
      parent.children.splice(next, 0, node);
    });
  }

  reparent(id: string, newParentId: string): void {
    if (id === this.scene.root.id || id === newParentId) return;
    const node = this.findNode(id);
    const newParent = this.findNode(newParentId);
    const oldParent = this.findParent(id);
    if (!node || !newParent || !oldParent) return;
    if (this.containsNode(node, newParentId)) return;
    this.mutate(() => {
      oldParent.children = oldParent.children.filter((child) => child.id !== id);
      newParent.children.push(node);
    });
  }

  addComponent(nodeId: string, type: string): void {
    const node = this.findNode(nodeId);
    const component = createComponentByType(type);
    if (!node || !component) return;
    const data = component.toJSON();
    this.mutate(() => {
      node.components.push(data);
    });
  }

  removeComponent(nodeId: string, index: number): void {
    const node = this.findNode(nodeId);
    if (!node || index < 0 || index >= node.components.length) return;
    this.mutate(() => {
      node.components.splice(index, 1);
    });
  }

  setSceneName(name: string): void {
    this.mutate(() => {
      this.scene.name = name.trim() || 'Untitled';
    });
  }

  addAsset(asset: AssetData): void {
    this.mutate(() => {
      this.scene.assets.push(asset);
    });
  }

  addAssets(assets: AssetData[]): void {
    if (assets.length === 0) return;
    this.mutate(() => {
      this.scene.assets.push(...assets);
    });
  }

  removeAsset(id: string): void {
    this.mutate(() => {
      this.scene.assets = this.scene.assets.filter((asset) => asset.id !== id);
      const clearReferences = (node: NodeData): void => {
        for (const component of node.components) {
          if (component.type === 'sprite' && component.assetId === id) component.assetId = '';
        }
        node.children.forEach(clearReferences);
      };
      clearReferences(this.scene.root);
    });
  }
}
