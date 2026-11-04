import { AttrKey } from '../core/AttributeSystem';
import type { EnemyKind } from '../types';

// ===== 玩家初始属性 =====
export const PLAYER_BASE: Record<AttrKey, number> = {
  [AttrKey.MaxHP]: 100,
  [AttrKey.HPRegen]: 0.5,
  [AttrKey.Damage]: 1.0,
  [AttrKey.AttackSpeed]: 1.0,
  [AttrKey.CritChance]: 0.05,
  [AttrKey.Armor]: 0,
  [AttrKey.Dodge]: 0,
  [AttrKey.MoveSpeed]: 220,
  [AttrKey.PickupRange]: 80,
  [AttrKey.Range]: 300
};

export const PLAYER = {
  radius: 16,
  invulnTime: 0.3,
  contactThrottle: 0.5,
  armorFactor: 15,
  critMultiplier: 2.0
} as const;

// ===== 武器 =====
export const WEAPON = {
  damage: 10,
  cooldown: 0.5,
  projectileSpeed: 600,
  projectileRadius: 6,
  projectileLifeMargin: 0.3,
  maxLevel: 5,
  damagePerLevel: 0.3,
  upgradeBaseCost: 40,
  upgradeCost: (currentLevel: number) => WEAPON.upgradeBaseCost * currentLevel,
  /** 弹匣容量：累计发射这么多发后进入装填 */
  magazineSize: 15,
  /** 装填时长（秒），期间停火并显示蓄力条 */
  reloadTime: 1
} as const;

// ===== 角色技能 =====
export const SKILL = {
  /** 局内达到该等级后技能自动强化 */
  upgradeLevel: 5,
  /** 突击者：自动弹幕环 */
  barrage: {
    interval: 5,
    upgradedInterval: 4,
    bulletsPerRing: 8,
    upgradedBulletsPerRing: 12,
    /** 两排弹丸的飞行速度差，形成内外两圈 */
    speeds: [380, 500] as const,
    upgradedSpeeds: [400, 520] as const,
    range: 360,
    upgradedRange: 430,
    damageMult: 1,
    upgradedDamageMult: 1.2,
    shakeDuration: 120,
    shakeIntensity: 0.0035
  },
  /** 游侠：主动穿云箭（高伤穿透，优先射向最近敌人） */
  piercing: {
    cooldown: 6,
    upgradedCooldown: 4.5,
    damageMult: 3,
    upgradedDamageMult: 4,
    speed: 900,
    range: 700,
    pierce: 99,
    shots: 1,
    upgradedShots: 2,
    spread: 0.14
  },
  /** 重装：主动震地冲击（自身周围范围伤害） */
  slam: {
    cooldown: 8,
    upgradedCooldown: 6,
    radius: 180,
    upgradedRadius: 240,
    damageMult: 2,
    upgradedDamageMult: 3,
    shakeDuration: 180,
    shakeIntensity: 0.006
  }
} as const;

// ===== 精英出生提示 =====
export const ELITE = {
  /** 红点提示时长（秒），到时才真正生成 */
  telegraphTime: 1,
  bossTelegraphTime: 1.4,
  /** 红点半径（Boss 更大） */
  markRadius: 14,
  bossMarkRadius: 26,
  /** 精英在视口内生成以保证红点可见，距视口边缘的内缩像素 */
  viewportInset: 60,
  /** 与玩家的最小距离 */
  minPlayerDist: 280
} as const;

// ===== 炸药桶 =====
export const BARREL = {
  /** 爆炸半径、对敌人与玩家的伤害 */
  explosionRadius: 120,
  explosionDamage: 40,
  playerDamage: 20,
  shakeDuration: 200,
  shakeIntensity: 0.007
} as const;

// ===== 等级 =====
export const LEVEL = {
  /** 每级所需经验（固定值，后续可改成随等级递增） */
  xpToNext: 50,
  /** 每次升级随机提供的属性选项数量（从中三选一） */
  optionCount: 3,
  /** 属性强化品质：数值倍率与出现概率（一般 50% / 优秀 30% / 传奇 20%） */
  rarities: [
    { id: 'normal', name: '一般', mult: 1, chance: 0.5, color: 0x9aa0b5 },
    { id: 'excellent', name: '优秀', mult: 1.2, chance: 0.3, color: 0x4dabf7 },
    { id: 'legendary', name: '传奇', mult: 1.5, chance: 0.2, color: 0xffd23f }
  ],
  /** 升级三选一刷新费用：本次升级内第 n 次刷新 → 10 / 15 / 20 … 金币 */
  refreshCost: (refreshesDone: number) => 10 + refreshesDone * 5
} as const;

// ===== 难度 =====
export interface DifficultyDef {
  /** 难度编号，0 为默认 */
  level: number;
  /** 敌人接触伤害与弹幕伤害倍率 */
  enemyDamage: number;
  /** 敌人血量倍率（预留扩展，当前为 1） */
  enemyHp: number;
  /** 敌人数量倍率（预留扩展，当前为 1） */
  enemyCount: number;
  /** 精英/Boss 血量倍率（当前作用于弹幕精英，未来 Boss 同样读取） */
  bossHp: number;
}

/** 难度档位：默认难度 0，逐档提高敌人伤害与精英血量 */
export const DIFFICULTIES: DifficultyDef[] = [
  { level: 0, enemyDamage: 1, enemyHp: 1, enemyCount: 1, bossHp: 1 },
  { level: 1, enemyDamage: 1.2, enemyHp: 1, enemyCount: 1, bossHp: 1.5 },
  { level: 2, enemyDamage: 1.5, enemyHp: 1, enemyCount: 1, bossHp: 2 },
  { level: 3, enemyDamage: 2, enemyHp: 1, enemyCount: 1, bossHp: 3 }
];

// ===== 敌人 =====
export const ENEMY = {
  chaser: { hp: 20, speed: 90, damage: 10, radius: 14, xp: 4 },
  /** 突击怪：接近后短暂蓄力，再高速冲刺撞向玩家 */
  charger: {
    hp: 35,
    speed: 85,
    damage: 12,
    radius: 15,
    xp: 6,
    /** 进入该距离后开始蓄力冲刺 */
    chargeRange: 300,
    /** 蓄力时长、冲刺速度与持续时间（秒）、冲刺后冷却 */
    chargeWindup: 0.55,
    chargeSpeed: 430,
    chargeDuration: 0.35,
    chargeCooldown: 2.8
  },
  brute: { hp: 80, speed: 55, damage: 20, radius: 26, xp: 12 },
  /**
   * 弹幕精英：后期波次出现的远程怪，保持距离并发射扇形弹幕；
   * 血量走难度里的 bossHp 倍率（与未来 Boss 同一通道）。
   */
  shooter: {
    hp: 90,
    speed: 70,
    damage: 12,
    radius: 24,
    xp: 18,
    /** 进入该距离后停止追击并开火 */
    shootRange: 340,
    shootInterval: 2.2,
    bulletSpeed: 230,
    bulletDamage: 8,
    /** 每次开火的弹丸数与相邻弹丸夹角（弧度） */
    burst: 3,
    spread: 0.18
  },
  /** 苹果树：不移动、不造成伤害，击碎后给经验并必掉金币与 1-2 个苹果 */
  tree: { hp: 40, speed: 0, damage: 0, radius: 22, xp: 8 },
  /** 炸药桶：被击破后爆炸，同时伤害敌人与玩家 */
  barrel: { hp: 30, speed: 0, damage: 0, radius: 18, xp: 4 },
  /** Boss：最终波出现，远程扇形弹幕 + 高接触伤害，血量吃难度 bossHp 倍率 */
  boss: {
    hp: 600,
    speed: 45,
    damage: 25,
    radius: 44,
    xp: 100,
    shootRange: 380,
    shootInterval: 1.8,
    bulletSpeed: 250,
    bulletDamage: 12,
    burst: 5,
    spread: 0.16
  }
} as const;

// ===== 可破坏物 =====
export const PROP = {
  /** 每波生成的苹果树数量（随波次缓慢增加） */
  count: (n: number) => Math.min(6, 2 + Math.ceil(n / 2)),
  /** 距场地边缘的最小距离 */
  margin: 90,
  /** 与玩家的最小生成距离 */
  minPlayerDist: 150,
  /** 苹果树之间的最小间距 */
  minGap: 110,
  /** 首棵苹果树距玩家的距离范围（保证落在初始视野内） */
  nearPlayerMin: 200,
  nearPlayerMax: 320,
  /** 其余苹果树围绕玩家生成的最大距离（可能需要移动探索） */
  scatterRadius: 1100,
  /** 每波炸药桶数量 */
  barrelCount: (n: number) => Math.min(4, 1 + Math.floor(n / 3))
} as const;

// ===== 波次 =====
export const WAVE = {
  maxWave: 10,
  /** 生成点在视野外的偏移，同时作为敌人距地图边缘的最小距离 */
  spawnMargin: 40,
  maxAlive: 80,
  /** 每波时长（秒）。当前统一 30s，后续可按波次返回不同值 */
  duration: (_n: number) => 30,
  chaserCount: (n: number) => 10 + 4 * n,
  chaserHp: (n: number) => ENEMY.chaser.hp * Math.pow(1.3, n - 1),
  /** 突击怪：第 2 波起出现，数量随波次增长 */
  chargerCount: (n: number) => (n >= 2 ? Math.max(1, Math.round(n * 0.7)) : 0),
  chargerHp: (n: number) => ENEMY.charger.hp * Math.pow(1.25, n - 1),
  bruteCount: (n: number) => (n >= 3 ? Math.floor((n - 2) * 1.5) : 0),
  bruteHp: (n: number) => ENEMY.brute.hp * Math.pow(1.3, n - 1),
  /** 弹幕精英：第 4 波起出现，第 9 波起每波 2 只 */
  shooterCount: (n: number) => (n < 4 ? 0 : n >= 9 ? 2 : 1),
  shooterHp: (n: number) => ENEMY.shooter.hp * Math.pow(1.22, n - 1),
  /** Boss：仅在最终波出现 1 只 */
  bossCount: (n: number) => (n >= WAVE.maxWave ? 1 : 0),
  bossHp: (_n: number) => ENEMY.boss.hp,
  spawnInterval: (n: number) => Math.max(0.25, 0.8 - 0.04 * n),
  /** 初始生成队列耗尽后的补怪间隔（秒），保证波次末尾持续有怪但不堆怪 */
  refillInterval: 1.5,
  /** 波次结束奖励（金币主要来自击杀掉落，波次奖励仅作补充） */
  reward: (n: number) => 8 + n
} as const;

// ===== 掉落 =====
export const DROP = {
  /** 击杀必掉金币；回血掉落用独立概率判定，可与金币同时掉落 */
  chaser: { materialChance: 1, materialValue: 2, healChance: 0.02, healValue: 5, healCountMin: 1, healCountMax: 1 },
  charger: { materialChance: 1, materialValue: 3, healChance: 0.05, healValue: 8, healCountMin: 1, healCountMax: 1 },
  brute: { materialChance: 1, materialValue: 5, healChance: 0.08, healValue: 10, healCountMin: 1, healCountMax: 1 },
  shooter: { materialChance: 1, materialValue: 12, healChance: 0.3, healValue: 15, healCountMin: 1, healCountMax: 2 },
  tree: { materialChance: 1, materialValue: 5, healChance: 1, healValue: 10, healCountMin: 1, healCountMax: 2 },
  barrel: { materialChance: 1, materialValue: 3, healChance: 0, healValue: 0, healCountMin: 0, healCountMax: 0 },
  boss: { materialChance: 1, materialValue: 120, healChance: 1, healValue: 25, healCountMin: 3, healCountMax: 5 },
  magnetDelay: 0.4,
  pickupRadius: 12,
  baseMagnetSpeed: 300,
  magnetSpeedPerDist: 3,
  maxMagnetSpeed: 600
} as const;

// ===== 装饰品 / 商店 =====
export const SHOP = {
  slots: 4,
  weights: { statTrinket: 0.6, effectTrinket: 0.25, weaponUpgrade: 0.15 },
  /** 本次进店已刷新次数 → 下一次刷新价格：1 / 2 / 5 / 10 / 15 …（每波进店重置） */
  rerollCost: (rerollsDone: number) => {
    if (rerollsDone === 0) return 1;
    if (rerollsDone === 1) return 2;
    return 5 + (rerollsDone - 2) * 5;
  }
} as const;

// ===== 局外成长 =====
export const META = {
  /** 新存档初始星尘，保证第一次进天赋树就能尝试购买 */
  startingStardust: 20,
  /** 一局结束获得的星尘：波次 + 击杀 + 通关奖励 */
  runReward: (wave: number, normalKills: number, eliteKills: number, victory: boolean) =>
    Math.max(1, wave * 2 + Math.floor(normalKills / 10) + eliteKills + (victory ? 20 : 0)),
  /** 燃烧弹：每层每秒伤害 = 武器基础伤害 × ratio，持续 duration 秒，每 tick 秒结算一次 */
  burnDamageRatio: 0.3,
  burnDuration: 3,
  burnTick: 0.5
} as const;

// ===== 小问号事件 =====
export const QUESTION = {
  /** 击碎苹果树 / 击杀精英后掉落小问号的概率（Boss 只在最终波，无下一波可影响，不掉落） */
  dropChance: {
    tree: 0.1,
    brute: 0.2,
    shooter: 0.3
  } as Partial<Record<EnemyKind, number>>,
  /** “危险悬赏”选项：立即获得的金币与下一波敌人数量倍率 */
  bountyGold: 20,
  bountyEnemyMult: 1.3
} as const;

export const STAT_TRINKET_BASE_PRICE = 20;
export const EFFECT_TRINKET_BASE_PRICE = 30;

// ===== 受击与死亡表现 =====
export const FEEDBACK = {
  /** 玩家受伤时的相机震动时长（ms）与强度 */
  hurtShakeDuration: 160,
  hurtShakeIntensity: 0.008,
  /** 屏幕边缘红色渐隐：峰值透明度、保持时间、淡出时长 */
  hurtVignetteAlpha: 0.85,
  hurtVignetteHold: 80,
  hurtVignetteFade: 400,
  /** 敌人受击闪白时长（秒）：小怪/可破坏物更亮更久，精英与 Boss 略短避免掩盖染色 */
  hitFlashDuration: 0.14,
  hitFlashEliteDuration: 0.08,
  /** 敌人死亡残影：先放大并半透明，再上漂淡出 */
  deathPopScale: 1.2,
  deathPopAlpha: 0.7,
  deathPopDuration: 140,
  deathFloatDistance: 30,
  deathFloatDuration: 380,
  /** 音效相对视觉的提前量（毫秒）：命中/死亡视觉略微延迟，让声音先到 */
  sfxLeadMs: 40,
  /** 精英死亡：黑白僵直时长、放大后淡出时长与放大倍率 */
  eliteFreezeDuration: 240,
  elitePopScale: 1.35,
  eliteFadeDuration: 360
} as const;

// ===== 特效饰品 =====
export const EFFECTS = {
  lifestealPerStack: 1,
  explosionChancePerStack: 0.2,
  explosionRadius: 80,
  explosionDamageMult: 2,
  heavyCooldownMult: 2,
  heavyDamageMult: 2,
  heavyMaxStacks: 1
} as const;
