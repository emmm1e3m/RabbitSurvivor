import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { abilities, characters, cosmetics, enemies, items, upgrades } from '../src/game/content';

const atlas = JSON.parse(readFileSync('public/assets/atlas.json', 'utf8'));
const checkFrame = (name: string) => assert.ok(atlas.frames[name], `图集缺少帧：${name}`);
for (const registry of [items, abilities, upgrades]) for (const def of Object.values(registry)) checkFrame(def.icon);
for (const def of Object.values(enemies)) checkFrame(def.behavior === 'boss' ? `${def.sprite}-0` : def.sprite);
for (const def of Object.values(cosmetics)) checkFrame(def.sprite);
for (const def of Object.values(characters)) for (const form of def.forms) assert.ok(existsSync(`public/assets/characters/${form}.png`), `角色头像缺失：${form}`);
assert.ok(existsSync('public/fonts/pixel.woff2'), '本地字体缺失');
console.log('✓ 图标、怪物、装扮、角色头像与字体引用完整');
