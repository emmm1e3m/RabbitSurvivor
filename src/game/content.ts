import type { AbilityDef, CharacterDef, CosmeticDef, EnemyDef, ItemDef, StageDef, UpgradeDef } from './types';

/** 内容在此静态登记；渲染层按 ID 读取名称和贴图，不承载战斗判定。 */
export const characters: Readonly<Record<string, CharacterDef>> = {
  classrep: { id: 'classrep', name: '课代饼', title: '认真一点，变强一点', description: '每过一波获得 3% 伤害与 1 点生命；第 3、6 波各出现一名苹果跟班。', forms: ['classrep'], initialForm: 'classrep', abilityId: 'apple-ring', base: { hp: 100, damage: 10, attackSpeed: 1, moveSpeed: 225, armor: 0, regen: 0.35 }, melee: false },
  goodrabbit: { id: 'goodrabbit', name: '三好兔', title: '把饼干花在刀刃上', description: '拾取的饼干币增加 50%；每持有 5 币伤害 +1%，最多 +30%。花钱后加成随余额变化。', forms: ['goodrabbit'], initialForm: 'goodrabbit', abilityId: 'golden-rain', base: { hp: 85, damage: 10, attackSpeed: 1, moveSpeed: 235, armor: 0, regen: 0.3 }, melee: false },
  bingo: { id: 'bingo', name: '饼狗', title: '苹果盾与小小勇气', description: '近身挥舞苹果；每波获得生命上限 22% 的苹果盾，实际治疗可缓慢补盾。', forms: ['bingo'], initialForm: 'bingo', abilityId: 'apple-slam', base: { hp: 140, damage: 15, attackSpeed: 1.15, moveSpeed: 235, armor: 3, regen: 0.4 }, melee: true },
  duo: { id: 'duo', name: '兔狗', title: '心好兔 × 信号狗', description: '共享生命与技能冷却，切换心好兔的远程爱心和信号狗的近身信号波；切换冷却 4 秒。', forms: ['heart', 'signal'], initialForm: 'heart', abilityId: 'duet', base: { hp: 105, damage: 11, attackSpeed: 1, moveSpeed: 230, armor: 1, regen: 0.3 }, melee: false }
};

export const enemies: Readonly<Record<string, EnemyDef>> = {
  cookie: { id: 'cookie', sprite: 'cookie-enemy', name: '饼干怪', hp: 18, speed: 85, damage: 9, radius: 15, xp: 5, coins: 3, behavior: 'chase' },
  note: { id: 'note', sprite: 'note-enemy', name: '音符怪', hp: 34, speed: 68, damage: 10, radius: 17, xp: 9, coins: 5, behavior: 'ranged' },
  charger: { id: 'charger', sprite: 'charger', name: '急急饼', hp: 38, speed: 90, damage: 13, radius: 18, xp: 9, coins: 5, behavior: 'charge' },
  bomber: { id: 'bomber', sprite: 'exploder', name: '爆米饼', hp: 26, speed: 115, damage: 18, radius: 18, xp: 8, coins: 4, behavior: 'explode' },
  boss: { id: 'boss', sprite: 'boss', name: '坏老板', hp: 3000, speed: 62, damage: 20, radius: 34, xp: 90, coins: 90, behavior: 'boss' }
};

export const items: Readonly<Record<string, ItemDef>> = {
  bow: { id: 'bow', icon: 'bow', name: '红蝴蝶结', description: '苹果伤害 +10%。', price: 24, kind: 'equipment', maxStacks: 3, statBonuses: { damage: 0.1 }, cosmetic: 'red-bow' },
  hat: { id: 'hat', icon: 'hat', name: '小巫师帽', description: '暴击率 +6%。', price: 25, kind: 'equipment', maxStacks: 3, statBonuses: { crit: 0.06 }, cosmetic: 'wizard-hat' },
  boots: { id: 'boots', icon: 'boots', name: '轻快鞋', description: '移动速度 +8%。', price: 22, kind: 'equipment', maxStacks: 2, statBonuses: { moveSpeed: 0.08 }, cosmetic: 'little-boots' },
  shell: { id: 'shell', icon: 'shield', name: '饼干护甲', description: '护甲 +3，生命上限 +8。', price: 26, kind: 'equipment', maxStacks: 3, statBonuses: { armor: 3, maxHp: 8 } },
  magnet: { id: 'magnet', icon: 'magnet', name: '饼干磁铁', description: '拾取距离 +35。', price: 18, kind: 'equipment', maxStacks: 2, effectBonuses: { pickupRange: 35 } },
  multishot: { id: 'multishot', icon: 'apple', name: '双生苹果', description: '远程多发 1 枚苹果；近战追加 1 段挥击，后续段造成 65% 伤害。最多 3 发或 3 段。', price: 42, kind: 'equipment', maxStacks: 2, effectBonuses: { multishot: 1 } },
  pierce: { id: 'pierce', icon: 'apple', name: '穿心签', description: '远程多穿透 1 个目标；近战每段多命中 1 个最近目标并增加 8 范围。最多穿透 2 次或每段命中 3 个。', price: 30, kind: 'equipment', maxStacks: 2, effectBonuses: { pierce: 1 } },
  explosion: { id: 'explosion', icon: 'blast', name: '爆米花', description: '击杀有 15% 概率小爆炸，最多 30%；爆炸不再连锁触发爆炸。', price: 34, kind: 'equipment', maxStacks: 2, effectBonuses: { explosion: 0.15 } },
  regen: { id: 'regen', icon: 'apple', name: '苹果茶', description: '每秒恢复 +0.35。', price: 25, kind: 'equipment', maxStacks: 3, statBonuses: { regen: 0.35 } },
  lifesteal: { id: 'lifesteal', icon: 'heart-icon', name: '暖心徽章', description: '击杀恢复 0.75 生命，最多 2 层。', price: 32, kind: 'equipment', maxStacks: 2, effectBonuses: { lifesteal: 0.75 } },
  apple: { id: 'apple', icon: 'apple', name: '苹果便当', description: '一次性：立即回复 35 生命。', price: 24, kind: 'consumable', maxStacks: 3, action: { kind: 'heal', amount: 35 } },
  bomb: { id: 'bomb', icon: 'blast', name: '苹果汽水', description: '一次性：周围造成 80 + 苹果伤害 ×3 的伤害。', price: 38, kind: 'consumable', maxStacks: 3, action: { kind: 'burst', amount: 80, damageScale: 3, radius: 240 } },
  lamp: { id: 'lamp', icon: 'lamp', name: '灯', description: '一次性：无敌 11.2 秒。本局最多获得一盏。', price: 105, kind: 'consumable', maxStacks: 1, maxPerRun: 1, action: { kind: 'invulnerable', amount: 11.2 } }
};

export const abilities: Readonly<Record<string, AbilityDef>> = {
  'apple-ring': { id: 'apple-ring', icon: 'apple', name: '苹果双环', description: '向 32 个方向放出两圈苹果，共 64 枚；每枚造成 85% 苹果伤害，5 级后提升至 105%。', cooldown: 7, kind: 'ring' },
  'golden-rain': { id: 'golden-rain', icon: 'coin', name: '饼干雨', description: '沿瞄准方向发出 5 枚高伤苹果。', cooldown: 7, kind: 'rain' },
  'apple-slam': { id: 'apple-slam', icon: 'shield', name: '苹果护身', description: '震击周围敌人，并恢复一部分苹果盾。', cooldown: 8, kind: 'slam' },
  duet: { id: 'duet', icon: 'heart-icon', name: '心有信号', description: '爱心与信号共同扫过身边；两种形态共用冷却。', cooldown: 7.5, kind: 'duet' }
};

export const upgrades: Readonly<Record<string, UpgradeDef>> = {
  power: { id: 'power', icon: 'apple', name: '苹果力量', description: '苹果伤害 +8%', stat: 'damage', amount: 0.08 },
  haste: { id: 'haste', icon: 'boots', name: '轻快出手', description: '攻击速度 +8%', stat: 'attackSpeed', amount: 0.08, cap: 1.2 },
  heart: { id: 'heart', icon: 'heart-icon', name: '好好吃饭', description: '生命上限 +12，并回复等量生命', stat: 'maxHp', amount: 12 },
  armor: { id: 'armor', icon: 'shield', name: '饼干外壳', description: '护甲 +2', stat: 'armor', amount: 2, cap: 18 },
  regen: { id: 'regen', icon: 'apple', name: '暖暖恢复', description: '每秒回复 +0.2', stat: 'regen', amount: 0.2, cap: 1.2 },
  crit: { id: 'crit', icon: 'heart-icon', name: '灵光一闪', description: '暴击率 +4%', stat: 'crit', amount: 0.04, cap: 0.4 },
  swift: { id: 'swift', icon: 'boots', name: '小步快跑', description: '移动速度 +5%', stat: 'moveSpeed', amount: 0.05, cap: 0.35 }
};

export const cosmetics: Readonly<Record<string, CosmeticDef>> = {
  'red-bow': { id: 'red-bow', sprite: 'bow', name: '红蝴蝶结', slot: 'neck' },
  'wizard-hat': { id: 'wizard-hat', sprite: 'hat', name: '小巫师帽', slot: 'head' },
  'little-boots': { id: 'little-boots', sprite: 'boots', name: '轻快鞋', slot: 'feet' }
};

export const stages: readonly StageDef[] = [
  { wave: 1, name: '苹果园的早晨', duration: 25, spawnInterval: 1.05, hpScale: 1, reward: 12, weights: { cookie: 1 } },
  { wave: 2, name: '听见小小音符', duration: 25, spawnInterval: 0.9, hpScale: 1.15, reward: 14, weights: { cookie: 0.82, note: 0.18 } },
  { wave: 3, name: '饼干急行军', duration: 27, spawnInterval: 0.8, hpScale: 1.35, reward: 16, weights: { cookie: 0.65, charger: 0.2, note: 0.15 } },
  { wave: 4, name: '不要靠近爆米饼', duration: 27, spawnInterval: 0.73, hpScale: 1.6, reward: 18, weights: { cookie: 0.55, charger: 0.15, note: 0.15, bomber: 0.15 } },
  { wave: 5, name: '午后的苹果雨', duration: 28, spawnInterval: 0.66, hpScale: 1.9, reward: 20, weights: { cookie: 0.5, charger: 0.2, note: 0.2, bomber: 0.1 } },
  { wave: 6, name: '信号有点拥挤', duration: 28, spawnInterval: 0.61, hpScale: 2.2, reward: 22, weights: { cookie: 0.4, charger: 0.22, note: 0.23, bomber: 0.15 } },
  { wave: 7, name: '下班前的最后一波', duration: 30, spawnInterval: 0.56, hpScale: 2.55, reward: 24, weights: { cookie: 0.4, charger: 0.2, note: 0.22, bomber: 0.18 } },
  { wave: 8, name: '坏老板来了', duration: 30, spawnInterval: 1.45, hpScale: 2.65, reward: 35, weights: { cookie: 0.7, note: 0.18, charger: 0.12 }, boss: true }
];

export const content = { characters, items, enemies, abilities, upgrades, cosmetics, stages };

/** 在内容边界一次校验引用，内容错误直接报出名称。 */
export function validateContent(): void {
  for (const registry of [characters, items, enemies, abilities, upgrades, cosmetics]) {
    for (const [id, def] of Object.entries(registry)) if (id !== def.id) throw new Error(`内容 ID 与登记键不一致：${id}`);
  }
  for (const def of Object.values(characters)) {
    if (!abilities[def.abilityId] || !def.forms.includes(def.initialForm)) throw new Error(`角色引用不完整：${def.id}`);
  }
  for (const def of Object.values(items)) {
    if (def.cosmetic && !cosmetics[def.cosmetic]) throw new Error(`饰品外观未登记：${def.id}`);
    if (def.kind === 'consumable' && !def.action) throw new Error(`主动道具缺少行为：${def.id}`);
  }
  for (const stage of stages) for (const kind of Object.keys(stage.weights)) if (!enemies[kind]) throw new Error(`波次引用未登记敌人：${kind}`);
}
