import { Game, type SceneData } from 'unitern';
import sceneJson from '../game.json';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('The #game canvas is missing');

const game = new Game({ canvas, scene: sceneJson as unknown as SceneData, autoResize: true });

game
  .load()
  .then(() => {
    game.start();
    canvas.focus();
  })
  .catch((error: unknown) => {
    console.error(error);
  });
