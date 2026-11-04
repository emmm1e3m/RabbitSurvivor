/** 纯玩法契约；坐标为世界像素，时间统一为秒。 */
export type CharacterId = string;
export type FormId = string;
export type EnemyId = string;
export type ItemId = string;
export type Phase = 'running' | 'upgrade' | 'shop' | 'victory' | 'defeat';
export type StatKey = 'damage' | 'attackSpeed' | 'maxHp' | 'armor' | 'regen' | 'crit' | 'moveSpeed';
export interface Point { x: number; y: number }
export interface Profile {
  version: 1;
  bossWins: number;
  bestWave: number;
  totalRuns: number;
  totalKills: number;
}
export interface InputState {
  x: number; y: number;
  /** 世界坐标系中的瞄准方向向量，非目标位置；零向量保留上次方向。 */
  aimX?: number; aimY?: number;
  /** 手动模式必须显式请求开火；省略时不攻击。 */
  fire?: boolean;
  /** 自动模式寻找射程内目标后开火；省略时沿用手动输入语义。 */
  autoAim?: boolean;
}
export interface PlayerState extends Point {
  hp: number; maxHp: number; shield: number; maxShield: number;
  damage: number; attackSpeed: number; crit: number; armor: number;
  regen: number; moveSpeed: number; range: number;
  level: number; xp: number; xpToNext: number; coins: number;
  invulnerable: number; skillCooldown: number; skillMaxCooldown: number;
  facingX: number; facingY: number;
}
export interface EnemyState extends Point {
  id: number; kind: EnemyId; hp: number; maxHp: number; radius: number;
  speed: number; damage: number; age: number; cooldown: number;
  windup: number; dashTime: number; vx: number; vy: number;
  active: boolean; flash: number;
}
export interface ProjectileState extends Point {
  id: number; vx: number; vy: number; damage: number; radius: number;
  life: number; enemy: boolean; pierce: number; hitIds: Set<number>;
  kind: 'apple' | 'note' | 'heart' | 'signal';
}
export interface PropState extends Point { id: number; kind: 'tree' | 'barrel'; hp: number; maxHp: number; radius: number; flash: number }
export interface PickupState extends Point { id: number; kind: 'coin' | 'flower' | 'apple' | 'item'; value: number; age: number; itemId?: ItemId }
export type EffectType = 'shoot' | 'melee' | 'hit' | 'kill' | 'hurt' | 'heal' | 'pickup' | 'wave' | 'levelup' | 'skill' | 'explosion' | 'shield' | 'warning' | 'boss' | 'reload' | 'buy' | 'victory' | 'defeat' | 'switch';
export interface GameEffect extends Point { type: EffectType; value?: number; kind?: string; text?: string; radius?: number; aimX?: number; aimY?: number; angle?: number; comboIndex?: number }
export interface CharacterDef {
  id: CharacterId; name: string; title: string; description: string;
  forms: readonly FormId[]; initialForm: FormId; abilityId: string;
  base: { hp: number; damage: number; attackSpeed: number; moveSpeed: number; armor: number; regen: number };
  melee: boolean;
}
export interface EnemyDef { id: EnemyId; name: string; sprite: string; hp: number; speed: number; damage: number; radius: number; xp: number; coins: number; behavior: 'chase' | 'ranged' | 'charge' | 'explode' | 'boss' }
export type EquipmentEffect = 'multishot' | 'pierce' | 'explosion' | 'lifesteal' | 'pickupRange';
export interface ItemAction { kind: 'heal' | 'burst' | 'invulnerable'; amount: number; radius?: number; damageScale?: number }
export interface ItemDef {
  id: ItemId; name: string; icon: string; description: string; price: number;
  kind: 'equipment' | 'consumable'; maxStacks: number; cosmetic?: string;
  statBonuses?: Readonly<Partial<Record<StatKey, number>>>;
  effectBonuses?: Readonly<Partial<Record<EquipmentEffect, number>>>;
  action?: ItemAction; maxPerRun?: number;
}
export interface AbilityDef { id: string; name: string; icon: string; description: string; cooldown: number; kind: 'ring' | 'rain' | 'slam' | 'duet' }
export interface UpgradeDef { id: string; name: string; icon: string; description: string; stat: StatKey; amount: number; cap?: number }
export interface CosmeticDef { id: string; name: string; sprite: string; slot: 'head' | 'neck' | 'feet' }
export interface StageDef { wave: number; name: string; duration: number; spawnInterval: number; hpScale: number; reward: number; weights: Readonly<Partial<Record<EnemyId, number>>>; boss?: boolean }
export interface ShopOffer { id: string; itemId?: ItemId; kind: 'equipment' | 'consumable' | 'weapon'; name: string; description: string; price: number; sold: boolean }
export interface UpgradeOffer { id: string; name: string; icon: string; description: string; stat: StatKey; amount: number; quality: 1 | 1.2 | 1.5 }
export interface RunResult { victory: boolean; wave: number; kills: number; coinsEarned: number; elapsed: number; profile: Profile; challenge: number }
export interface SessionOptions { seed?: number; challenge?: number }
