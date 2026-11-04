/** 特效饰品 id（RunData.effects 中按堆叠层数计数） */
export enum EffectId {
  Pierce = 'pierce',
  Lifesteal = 'lifesteal',
  MultiShot = 'multishot',
  Explosion = 'explosion',
  HeavyShot = 'heavy'
}

export type EnemyKind = 'chaser' | 'brute' | 'shooter' | 'tree';

export type PickupKind = 'material' | 'heal';

export interface InputState {
  x: number;
  y: number;
}
