import { AttrKey } from '../core/AttributeSystem';

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
  upgradeCost: (currentLevel: number) => WEAPON.upgradeBaseCost * currentLevel
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
  ]
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
  chaser: { hp: 20, speed: 90, damage: 10, radius: 14, xp: 2 },
  brute: { hp: 80, speed: 55, damage: 20, radius: 26, xp: 6 },
  /**
   * 弹幕精英：后期波次出现的远程怪，保持距离并发射扇形弹幕；
   * 血量走难度里的 bossHp 倍率（与未来 Boss 同一通道）。
   */
  shooter: {
    hp: 90,
    speed: 70,
    damage: 12,
    radius: 24,
    xp: 10,
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
  tree: { hp: 40, speed: 0, damage: 0, radius: 22, xp: 5 }
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
  scatterRadius: 1100
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
  bruteCount: (n: number) => (n >= 3 ? Math.floor((n - 2) * 1.5) : 0),
  bruteHp: (n: number) => ENEMY.brute.hp * Math.pow(1.3, n - 1),
  /** 弹幕精英：第 4 波起出现，第 9 波起每波 2 只 */
  shooterCount: (n: number) => (n < 4 ? 0 : n >= 9 ? 2 : 1),
  shooterHp: (n: number) => ENEMY.shooter.hp * Math.pow(1.22, n - 1),
  spawnInterval: (n: number) => Math.max(0.25, 0.8 - 0.04 * n),
  /** 初始生成队列耗尽后的补怪间隔（秒），保证波次末尾持续有怪但不堆怪 */
  refillInterval: 1.5,
  /** 波次奖励保底：首波 22 金，保证至少买得起一件 20 金数值饰品 */
  reward: (n: number) => 20 + 2 * n
} as const;

// ===== 掉落 =====
export const DROP = {
  /** 击杀必掉金币；回血掉落用独立概率判定，可与金币同时掉落 */
  chaser: { materialChance: 1, materialValue: 1, healChance: 0.02, healValue: 5, healCountMin: 1, healCountMax: 1 },
  brute: { materialChance: 1, materialValue: 3, healChance: 0.08, healValue: 10, healCountMin: 1, healCountMax: 1 },
  shooter: { materialChance: 1, materialValue: 8, healChance: 0.3, healValue: 15, healCountMin: 1, healCountMax: 2 },
  tree: { materialChance: 1, materialValue: 3, healChance: 1, healValue: 10, healCountMin: 1, healCountMax: 2 },
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
  /** 敌人死亡残影：先放大并半透明，再上漂淡出 */
  deathPopScale: 1.2,
  deathPopAlpha: 0.7,
  deathPopDuration: 140,
  deathFloatDistance: 30,
  deathFloatDuration: 380
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
