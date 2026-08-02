/**
 * Entry point. Wires the configuration into the page, registers every scene,
 * and opens the title screen.
 */

import { config } from './config.js';
import { Game } from './engine/game.js';
import { TitleScene } from './scenes/title.js';
import { WoodsScene } from './scenes/woods.js';
import { CottageScene } from './scenes/cottage.js';
import { HallScene } from './scenes/hall.js';
import { GardenScene } from './scenes/garden.js';

document.title = config.gameTitle;

const game = new Game();
game.register('title', (g) => new TitleScene(g));
game.register('woods', (g) => new WoodsScene(g));
game.register('cottage', (g) => new CottageScene(g));
game.register('hall', (g) => new HallScene(g));
game.register('garden', (g) => new GardenScene(g));

await game.goTo('title', {}, { transition: false });
game.start();
