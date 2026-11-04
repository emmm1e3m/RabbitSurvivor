import type { AbilityDef, CharacterDef, CosmeticDef, EnemyDef, ItemDef, StageDef, MetaNodeDef } from './types';

/** 内容在此静态登记；渲染层按 ID 读取名称和贴图，不承载战斗判定。 */
export const characters: Readonly<Record<string, CharacterDef>> = {
  classrep: { id: 'classrep', name: '课代饼', title: '认真一点，变强一点', description: '每过一普通波获得3%伤害与1点生命；每3普通波招募一名有独立生命的苹果跟班。', forms: ['classrep'], initialForm: 'classrep', abilityId: 'apple-ring', base: { hp: 100, damage: 10, attackSpeed: 1, moveSpeed: 225, armor: 0, regen: 0.35 }, melee: false },
  goodrabbit: { id: 'goodrabbit', name: '三好兔', title: '把饼干花在刀刃上', description: '拾取的饼干币增加 50%；每持有 5 币伤害 +1%，最多 +30%。花钱后加成随余额变化。', forms: ['goodrabbit'], initialForm: 'goodrabbit', abilityId: 'golden-rain', base: { hp: 85, damage: 10, attackSpeed: 1, moveSpeed: 235, armor: 0, regen: 0.3 }, melee: false },
  bingo: { id: 'bingo', name: '饼狗', title: '苹果盾与小小勇气', description: '近身挥舞苹果；每波获得生命上限 22% 的苹果盾，实际治疗可缓慢补盾。', forms: ['bingo'], initialForm: 'bingo', abilityId: 'apple-slam', base: { hp: 140, damage: 15, attackSpeed: 1.15, moveSpeed: 235, armor: 3, regen: 0.4 }, melee: true },
  duo: { id: 'duo', name: '兔狗', title: '心好兔 × 信号狗', description: '共享生命与技能冷却；切换会短暂加速与无敌。心好兔技能穿敌冲锋，信号狗技能召唤消耗型环绕苹果。', forms: ['heart', 'signal'], initialForm: 'heart', abilityId: 'heart-dash', formAbilities: { heart: 'heart-dash', signal: 'signal-orbit' }, base: { hp: 105, damage: 11, attackSpeed: 1, moveSpeed: 230, armor: 1, regen: 0.3 }, melee: false }
};

export const enemies: Readonly<Record<string, EnemyDef>> = {
  cookie: { id: 'cookie', sprite: 'cookie-enemy', name: '饼干怪', hp: 18, speed: 85, damage: 9, radius: 15, coins: 3, behavior: 'chase' },
  note: { id: 'note', sprite: 'note-enemy', name: '音符怪', hp: 34, speed: 68, damage: 10, radius: 17, coins: 5, behavior: 'ranged' },
  charger: { id: 'charger', sprite: 'charger', name: '急急饼', hp: 38, speed: 90, damage: 13, radius: 18, coins: 5, behavior: 'charge' },
  bomber: { id: 'bomber', sprite: 'exploder', name: '爆米饼', hp: 26, speed: 115, damage: 18, radius: 18, coins: 4, behavior: 'explode' },
  laser: { id: 'laser', sprite: 'laser-enemy', name: '聚光音符', hp: 48, speed: 55, damage: 13, radius: 19, coins: 6, behavior: 'laser' },
  area: { id: 'area', sprite: 'mortar-enemy', name: '潮汐饼', hp: 43, speed: 65, damage: 12, radius: 19, coins: 6, behavior: 'area' },
  boss: { id: 'boss', sprite: 'boss', name: '坏老板', hp: 2200, speed: 62, damage: 20, radius: 34, coins: 90, behavior: 'boss' }
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
  'apple-ring': { id: 'apple-ring', icon: 'apple', name: '苹果双环', description: '向 32 个方向放出两圈苹果，共 64 枚；每枚造成 85% 苹果伤害，第5波起提升至 105%。', cooldown: 7, kind: 'ring' },
  'golden-rain': { id: 'golden-rain', icon: 'cookie', name: '饼干雨', description: '沿瞄准方向发出5枚高伤饼干，按苹果伤害计算。', cooldown: 7, kind: 'rain' },
  'apple-slam': { id: 'apple-slam', icon: 'shield', name: '苹果护身', description: '震击周围敌人，并恢复部分苹果盾。双生苹果追加较弱震击，穿透每层增加8范围。', cooldown: 8, kind: 'slam' },
  'heart-dash': { id: 'heart-dash', icon: 'heart-icon', name: '心好兔冲冲', description: '短暂加速与无敌，移动穿过敌人造成攻击伤害。双生苹果增加命中次数，穿透增加总目标额度。', cooldown: 7.5, kind: 'heart' },
  'signal-orbit': { id: 'signal-orbit', icon: 'apple', name: '苹果信号环', description: '召唤6枚苹果绕身，命中后消耗；双生苹果追加较弱的一圈，穿透增加每枚可命中目标数。', cooldown: 7.5, kind: 'signal' }
};

export const cosmetics: Readonly<Record<string, CosmeticDef>> = {
  'red-bow': { id: 'red-bow', sprite: 'bow', name: '红蝴蝶结', slot: 'neck' },
  'wizard-hat': { id: 'wizard-hat', sprite: 'hat', name: '小巫师帽', slot: 'head' },
  'little-boots': { id: 'little-boots', sprite: 'boots', name: '轻快鞋', slot: 'feet' }
};

export const talentBranches = {
  attack: { id: 'attack', name: '攻击' },
  survival: { id: 'survival', name: '生存' },
  agility: { id: 'agility', name: '灵巧' }
} as const;

export const talents: Readonly<Record<string, MetaNodeDef>> = {
  'attack-power': { id: 'attack-power', branch: 'attack', name: '苹果力量', icon: 'apple', description: '永久苹果伤害 +6% / 级。', cost: 20, maxRank: 3, statBonuses: { damage: 0.06 } },
  'attack-haste': { id: 'attack-haste', branch: 'attack', name: '轻快出手', icon: 'boots', description: '永久攻击速度 +4% / 级。', cost: 25, maxRank: 2, requires: 'attack-power', statBonuses: { attackSpeed: 0.04 } },
  'attack-crit': { id: 'attack-crit', branch: 'attack', name: '灵光一闪', icon: 'heart-icon', description: '永久暴击率 +3% / 级。', cost: 30, maxRank: 2, requires: 'attack-haste', statBonuses: { crit: 0.03 } },
  'survival-vigor': { id: 'survival-vigor', branch: 'survival', name: '好好吃饭', icon: 'heart-icon', description: '永久生命上限 +8 / 级。', cost: 20, maxRank: 3, statBonuses: { maxHp: 8 } },
  'survival-armor': { id: 'survival-armor', branch: 'survival', name: '小小护甲', icon: 'shield', description: '永久护甲 +1 / 级。', cost: 25, maxRank: 3, requires: 'survival-vigor', statBonuses: { armor: 1 } },
  'survival-regen': { id: 'survival-regen', branch: 'survival', name: '暖暖恢复', icon: 'apple', description: '永久每秒回复 +0.15 / 级。', cost: 30, maxRank: 2, requires: 'survival-armor', statBonuses: { regen: 0.15 } },
  'agility-speed': { id: 'agility-speed', branch: 'agility', name: '小步快跑', icon: 'boots', description: '永久移动速度 +3% / 级。', cost: 20, maxRank: 3, statBonuses: { moveSpeed: 0.03 } },
  'agility-magnet': { id: 'agility-magnet', branch: 'agility', name: '饼干磁力', icon: 'magnet', description: '永久拾取范围 +20 / 级。', cost: 25, maxRank: 2, requires: 'agility-speed', effectBonuses: { pickupRange: 20 } },
  'agility-pierce': { id: 'agility-pierce', branch: 'agility', name: '穿心练习', icon: 'apple', description: '永久穿透 +1，近战每段多命中一个目标；与饰品共用上限。', cost: 60, maxRank: 1, requires: 'agility-magnet', effectBonuses: { pierce: 1 } }
};

export const stages: readonly StageDef[] = [
  { wave: 1, biome: 'grass', name: '苹果园的早晨', duration: 25, spawnInterval: 1.05, hpScale: 1, reward: 12, weights: { cookie: 1 } },
  { wave: 2, biome: 'grass', name: '听见小小音符', duration: 25, spawnInterval: 0.9, hpScale: 1.15, reward: 14, weights: { cookie: 0.82, note: 0.18 } },
  { wave: 3, biome: 'forest', name: '饼干急行军', duration: 27, spawnInterval: 0.8, hpScale: 1.35, reward: 16, weights: { cookie: 0.65, charger: 0.2, note: 0.15 } },
  { wave: 4, biome: 'forest', name: '不要靠近爆米饼', duration: 27, spawnInterval: 0.73, hpScale: 1.6, reward: 18, weights: { cookie: 0.55, charger: 0.15, note: 0.15, bomber: 0.15 } },
  { wave: 5, biome: 'sand', name: '午后的苹果雨', duration: 28, spawnInterval: 0.66, hpScale: 1.9, reward: 20, weights: { cookie: 0.5, charger: 0.2, note: 0.2, bomber: 0.1 } },
  { wave: 6, biome: 'sand', name: '信号有点拥挤', duration: 28, spawnInterval: 0.61, hpScale: 2.2, reward: 22, weights: { cookie: 0.3, charger: 0.2, note: 0.15, bomber: 0.15, laser: 0.1, area: 0.1 } },
  { wave: 7, biome: 'water', name: '潮汐与回声', duration: 30, spawnInterval: 0.56, hpScale: 2.55, reward: 24, weights: { cookie: 0.3, charger: 0.15, note: 0.15, bomber: 0.15, laser: 0.12, area: 0.13 } },
  { wave: 8, biome: 'water', name: '坏老板来了', duration: 30, spawnInterval: 1.45, hpScale: 2.65, reward: 35, weights: { cookie: 0.7, note: 0.18, charger: 0.12 }, boss: true }
];

export const content = { characters, items, enemies, abilities, talents, talentBranches, cosmetics, stages };

/** 在内容边界一次校验引用，内容错误直接报出名称。 */
export function validateContent(): void {
  for (const registry of [characters, items, enemies, abilities, talents, cosmetics]) {
    for (const [id, def] of Object.entries(registry)) if (id !== def.id) throw new Error(`内容 ID 与登记键不一致：${id}`);
  }
  for (const def of Object.values(characters)) {
    if (!abilities[def.abilityId] || !def.forms.includes(def.initialForm)) throw new Error(`角色引用不完整：${def.id}`);
    for (const [form, ability] of Object.entries(def.formAbilities ?? {})) if (!def.forms.includes(form) || !abilities[ability]) throw new Error(`形态技能未登记：${def.id}/${form}`);
  }
  for (const def of Object.values(items)) {
    if (def.cosmetic && !cosmetics[def.cosmetic]) throw new Error(`饰品外观未登记：${def.id}`);
    if (def.kind === 'consumable' && !def.action) throw new Error(`主动道具缺少行为：${def.id}`);
  }
  for (const stage of stages) for (const kind of Object.keys(stage.weights)) if (!enemies[kind]) throw new Error(`波次引用未登记敌人：${kind}`);
  for (const node of Object.values(talents)) if (node.requires && !talents[node.requires]) throw new Error(`成长前置未登记：${node.id}`);
}
