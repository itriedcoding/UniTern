import { Game, Node, Script, type SceneData } from 'unitern';
import sceneJson from '../game.json';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('The #game canvas is missing');

const game = new Game({ canvas, scene: sceneJson as unknown as SceneData, autoResize: true });

// Exposed for debugging from the browser console (and used by the site smoke test).
declare global {
  interface Window {
    uniternGame?: Game;
  }
}
window.uniternGame = game;

const totalCoins = countCollectibles(sceneJson.root);
let collected = 0;
let won = false;

const overlay = document.createElement('div');
overlay.style.cssText = [
  'position:fixed',
  'inset:0',
  'display:none',
  'place-items:center',
  'background:rgba(5,11,20,0.74)',
  'backdrop-filter:blur(4px)',
  'z-index:20',
  'font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif',
  'color:#eaf4ff',
  'text-align:center',
  'padding:24px',
].join(';');

const card = document.createElement('div');
card.style.cssText = [
  'max-width:420px',
  'padding:34px 38px',
  'border-radius:18px',
  'background:rgba(17,28,44,0.92)',
  'border:1px solid #2c4160',
  'box-shadow:0 30px 80px rgba(0,0,0,0.5)',
].join(';');

const title = document.createElement('h1');
title.textContent = 'LEVEL COMPLETE';
title.style.cssText = 'margin:0 0 8px;font-size:28px;letter-spacing:2px;color:#ffcf5c;';
const subtitle = document.createElement('p');
subtitle.textContent = `All ${totalCoins} coins collected.`;
subtitle.style.cssText = 'margin:0 0 20px;font-size:15px;color:#a9bfd9;line-height:1.5;';
const again = document.createElement('p');
again.textContent = 'Press R to run it again';
again.style.cssText = 'margin:0;font-size:13px;color:#7f95b2;letter-spacing:0.3px;';

card.append(title, subtitle, again);
overlay.append(card);
document.body.append(overlay);

function countCollectibles(node: { components?: Array<{ type?: string }>; children?: unknown[] }): number {
  let total = 0;
  if (Array.isArray(node.components) && node.components.some((component) => component.type === 'collectible')) total++;
  if (Array.isArray(node.children)) {
    for (const child of node.children) total += countCollectibles(child as typeof node);
  }
  return total;
}

class FallGuard extends Script {
  private triggered = false;

  override update(): void {
    if (this.triggered) return;
    const player = this.world.findByName('Player');
    if (player && player.position.y > 1200) {
      this.triggered = true;
      void restart();
    }
  }
}

function installGuard(): void {
  const guard = new Node('Fall Guard');
  guard.addComponent(new FallGuard());
  game.world.add(guard);
}

async function restart(): Promise<void> {
  collected = 0;
  won = false;
  overlay.style.display = 'none';
  await game.restart();
  installGuard();
  canvas.focus();
}

game.world.events.on('collect', () => {
  collected++;
  if (collected >= totalCoins && !won) {
    won = true;
    subtitle.textContent = `All ${totalCoins} coins collected.`;
    overlay.style.display = 'grid';
  }
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyR' && won) void restart();
});

game
  .load()
  .then(() => {
    game.start();
    installGuard();
    canvas.focus();
  })
  .catch((error: unknown) => {
    console.error(error);
    const message = document.createElement('p');
    message.textContent = 'Could not start the game. Check the browser console for details.';
    message.style.cssText = 'color:#ffd7dd;font-family:ui-sans-serif,system-ui,sans-serif;padding:24px;';
    document.body.append(message);
  });
