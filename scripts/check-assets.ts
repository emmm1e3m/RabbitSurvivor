import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { abilities, characters, cosmetics, enemies, items, talents } from '../src/game/content';

const atlas = JSON.parse(readFileSync('public/assets/atlas.json', 'utf8'));
const checkFrame = (name: string) => assert.ok(atlas.frames[name], `图集缺少帧：${name}`);
for (const registry of [items, abilities, talents]) for (const def of Object.values(registry)) checkFrame(def.icon);
for (const def of Object.values(enemies)) checkFrame(def.behavior === 'boss' ? `${def.sprite}-0` : def.sprite);
for (const def of Object.values(cosmetics)) checkFrame(def.sprite);
for (const def of Object.values(characters)) for (const form of def.forms) assert.ok(existsSync(`public/assets/characters/${form}.png`), `角色头像缺失：${form}`);
for (const terrain of ['grass', 'forest', 'beach', 'sea']) {
  checkFrame(`terrain-${terrain}`); checkFrame(`terrain-${terrain}-1`);
}
for (const frame of ['decor-grass', 'decor-fern', 'decor-bush', 'decor-shell', 'decor-starfish', 'decor-seaweed', 'decor-fish', 'tree-beach', 'tree-water', 'bubble']) checkFrame(frame);
for (let frame = 0; frame < 4; frame++) checkFrame(`bubble-ring-${frame}`);
assert.ok(existsSync('public/fonts/pixel.woff2'), '本地字体缺失');
assert.ok(existsSync('public/audio/orchard-futurebass.mp3'), '新版BGM缺失');
console.log('✓ 图标、怪物、装扮、角色头像、场景、音乐与字体引用完整');
