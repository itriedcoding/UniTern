import type { AssetData } from '../../src/index';
import type { EditorContext } from '../context';
import { el } from '../dom';
import { emptyState, iconButton, miniButton } from '../ui';

function useAsset(asset: AssetData, ctx: EditorContext): void {
  const { state } = ctx;
  const node = state.findNode(state.selectedId);
  if (!node) {
    ctx.toast('Select a node with a Sprite component first', 'error');
    return;
  }
  const sprite = node.components.find((component) => component.type === 'sprite');
  if (!sprite) {
    ctx.toast(`"${node.name}" has no Sprite component`, 'error');
    return;
  }
  state.mutate(() => {
    sprite.assetId = asset.id;
  });
  ctx.toast(`Assigned "${asset.name}" to ${node.name}`);
}

export function renderAssets(container: HTMLElement, ctx: EditorContext): void {
  const { state } = ctx;
  const scrollTop = container.scrollTop;
  container.replaceChildren();
  const assets = state.scene.assets;

  if (assets.length === 0) {
    container.append(emptyState('No assets yet', 'Import images with the + button. They are embedded in the scene file.'));
    return;
  }

  const grid = el('div', { class: 'asset-grid' });
  for (const asset of assets) {
    const card = el('div', { class: 'asset-card' });
    const image = el('img', {
      class: 'asset-thumb',
      attrs: { src: asset.src, alt: asset.name, loading: 'lazy', draggable: 'false' },
    });
    const footer = el(
      'div',
      { class: 'asset-meta' },
      el('span', { class: 'asset-name', text: asset.name, title: asset.name }),
      el(
        'div',
        { class: 'asset-actions' },
        miniButton('Use', () => useAsset(asset, ctx), 'Assign to the selected sprite'),
        iconButton('trash', 'Delete asset', () => state.removeAsset(asset.id), { danger: true }),
      ),
    );
    card.append(image, footer);
    grid.append(card);
  }
  container.append(grid);
  container.scrollTop = scrollTop;
}
