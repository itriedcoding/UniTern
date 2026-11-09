import type { NodeData } from '../../src/index';
import type { EditorContext } from '../context';
import { el, svgIcon } from '../dom';
import { iconButton } from '../ui';

const collapsed = new Set<string>();

function nodeIcon(node: NodeData): string {
  if (node.screenSpace) return 'ui';
  const types = new Set(node.components.map((component) => component.type));
  if (types.has('camera')) return 'camera';
  if (types.has('text')) return 'text';
  if (types.has('sprite')) return 'image';
  if (types.has('shape')) return 'box';
  return 'spark';
}

function appendNode(container: HTMLElement, node: NodeData, depth: number, ctx: EditorContext): void {
  const state = ctx.state;
  const isRoot = node.id === state.scene.root.id;
  const isSelected = state.selectedId === node.id;
  const row = el('div', {
    class: `tree-row${isSelected ? ' is-selected' : ''}`,
    attrs: { 'data-node-id': node.id },
    title: node.name,
  });
  row.style.paddingLeft = `${6 + depth * 13}px`;
  row.addEventListener('click', () => state.select(node.id));

  if (node.children.length > 0) {
    const isCollapsed = collapsed.has(node.id);
    const caret = el('button', {
      class: `tree-caret${isCollapsed ? '' : ' is-open'}`,
      attrs: { type: 'button', 'aria-label': isCollapsed ? 'Expand' : 'Collapse' },
      on: {
        click: (event) => {
          event.stopPropagation();
          if (isCollapsed) collapsed.delete(node.id);
          else collapsed.add(node.id);
          ctx.refresh();
        },
      },
    });
    caret.append(svgIcon('chevron', 11));
    row.append(caret);
  } else {
    row.append(el('span', { class: 'tree-caret-spacer' }));
  }

  row.append(el('span', { class: 'tree-icon' }, svgIcon(nodeIcon(node), 13)));
  row.append(el('span', { class: 'tree-name', text: node.name || 'Node' }));

  const actions = el('div', { class: 'tree-actions' });
  actions.append(
    iconButton(node.visible ? 'eye' : 'eyeOff', node.visible ? 'Hide' : 'Show', (event) => {
      event.stopPropagation();
      state.mutate(() => {
        node.visible = !node.visible;
      });
    }),
  );
  if (!isRoot) {
    actions.append(
      iconButton(
        'copy',
        'Duplicate',
        (event) => {
          event.stopPropagation();
          state.duplicateNode(node.id);
        },
      ),
      iconButton(
        'trash',
        'Delete',
        (event) => {
          event.stopPropagation();
          state.removeNode(node.id);
        },
        { danger: true },
      ),
    );
  }
  row.append(actions);
  container.append(row);

  if (!collapsed.has(node.id)) {
    for (const child of node.children) appendNode(container, child, depth + 1, ctx);
  }
}

export function renderHierarchy(container: HTMLElement, ctx: EditorContext): void {
  const scrollTop = container.scrollTop;
  container.replaceChildren();
  const tree = el('div', { class: 'tree' });
  appendNode(tree, ctx.state.scene.root, 0, ctx);
  container.append(tree);
  container.scrollTop = scrollTop;
}

export function expandAll(): void {
  collapsed.clear();
}
