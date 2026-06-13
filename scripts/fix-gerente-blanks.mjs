import { Jimp } from 'jimp';

const BASE = 'public/assets/sprites/';

const src = await Jimp.read(BASE + 'enemy-gerente-attack-escopo0.png');
await src.write(BASE + 'enemy-gerente-attack-escopo1.png');

const src2 = await Jimp.read(BASE + 'enemy-gerente-attack-escopo0.png');
await src2.write(BASE + 'enemy-gerente-attack-escopo2.png');

console.log('Fixed: enemy-gerente-attack-escopo1.png and enemy-gerente-attack-escopo2.png');
