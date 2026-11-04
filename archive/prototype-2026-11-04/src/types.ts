/** 特效饰品 id（RunData.effects 中按堆叠层数计数） */
export enum EffectId {
  Pierce = 'pierce',
  Lifesteal = 'lifesteal',
  MultiShot = 'multishot',
  Explosion = 'explosion',
  HeavyShot = 'heavy'
}

export type EnemyKind = 'chaser' | 'charger' | 'brute' | 'shooter' | 'tree' | 'barrel' | 'boss';

/** 精英怪：死亡走黑白僵直特效，击杀单独统计 */
export const isElite = (kind: EnemyKind): boolean =>
  kind === 'brute' || kind === 'shooter' || kind === 'boss';

/** 可破坏物：不计击杀、不参与波次存活统计 */
export const isProp = (kind: EnemyKind): boolean => kind === 'tree' || kind === 'barrel';

/** 局外天赋提供的特殊战斗效果（RunData.metaEffects 按层数计数） */
export enum MetaEffectId {
  /** 每次开火额外弹丸 */
  ExtraProjectile = 'extraProjectile',
  /** 弹丸穿透 */
  Pierce = 'pierce',
  /** 子弹附加燃烧 */
  Burn = 'burn',
  /** 击杀回复 */
  Lifesteal = 'lifesteal'
}

export type PickupKind = 'material' | 'heal' | 'question';

export interface InputState {
  x: number;
  y: number;
}
