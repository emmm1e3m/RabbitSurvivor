/** 纯玩法契约；坐标为世界像素，时间统一为秒。 */
export type CharacterId = string;
export type FormId = string;
export type EnemyId = string;
export type ItemId = string;
export type Phase = 'running' | 'shop' | 'victory' | 'defeat';
export type StatKey = 'damage' | 'attackSpeed' | 'maxHp' | 'armor' | 'regen' | 'crit' | 'moveSpeed';
export interface Point { x: number; y: number }
export interface Profile {
  version: 2;
  bossWins: number;
  bestWave: number;
  totalRuns: number;
  totalKills: number;
  talentPoints: number;
  talents: Record<string, number>;
  threatLevel: number;
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
  coins: number;
  invulnerable: number; skillCooldown: number; skillMaxCooldown: number;
  facingX: number; facingY: number;
  speedBoostRemaining: number; dashRemaining: number;
}
export interface EnemyState extends Point {
  id: number; kind: EnemyId; hp: number; maxHp: number; radius: number;
  speed: number; damage: number; age: number; cooldown: number;
  windup: number; dashTime: number; vx: number; vy: number;
  active: boolean; flash: number;
  attackIndex: number;
}
/** 一次攻击起手的统一快照；弹丸、连段、技能和召唤物共用。 */
export interface AttackMods { damage: number; critChance: number; shotCount: number; pierce: number; explosionChance: number; lifesteal: number }
export interface ProjectileState extends Point {
  id: number; vx: number; vy: number; damage: number; radius: number;
  life: number; enemy: boolean; pierce: number; hitIds: Set<number>;
  kind: 'apple' | 'cookie' | 'note' | 'heart' | 'signal';
  mods?: AttackMods;
}
export interface FollowerState extends Point { id: number; hp: number; maxHp: number; shootCooldown: number; hurtCooldown: number; facingX: number; facingY: number }
export interface HazardState extends Point {
  id: number; kind: 'laser' | 'area'; endX: number; endY: number;
  radius: number; width: number; warningRemaining: number; activeRemaining: number;
  damage: number; ownerId: number; hitIds: Set<number>;
}
export interface OrbitAppleState extends Point { id: number; angle: number; orbitRadius: number; radius: number; life: number; remainingHits: number; hitIds: Set<number>; mods: AttackMods }
export interface PropState extends Point { id: number; kind: 'tree' | 'barrel'; hp: number; maxHp: number; radius: number; flash: number }
export interface PickupState extends Point { id: number; kind: 'coin' | 'flower' | 'apple' | 'item'; value: number; age: number; itemId?: ItemId }
export type EffectType = 'shoot' | 'melee' | 'hit' | 'kill' | 'hurt' | 'heal' | 'pickup' | 'wave' | 'skill' | 'explosion' | 'shield' | 'warning' | 'boss' | 'reload' | 'buy' | 'victory' | 'defeat' | 'switch';
export interface GameEffect extends Point { type: EffectType; value?: number; kind?: string; text?: string; radius?: number; aimX?: number; aimY?: number; angle?: number; comboIndex?: number }
export interface CharacterDef {
  id: CharacterId; name: string; title: string; description: string;
  forms: readonly FormId[]; initialForm: FormId; abilityId: string;
  formAbilities?: Readonly<Record<string, string>>;
  base: { hp: number; damage: number; attackSpeed: number; moveSpeed: number; armor: number; regen: number };
  melee: boolean;
}
export interface EnemyDef { id: EnemyId; name: string; sprite: string; hp: number; speed: number; damage: number; radius: number; coins: number; behavior: 'chase' | 'ranged' | 'charge' | 'explode' | 'laser' | 'area' | 'boss' }
export type EquipmentEffect = 'multishot' | 'pierce' | 'explosion' | 'lifesteal' | 'pickupRange';
export interface ItemAction { kind: 'heal' | 'burst' | 'invulnerable'; amount: number; radius?: number; damageScale?: number }
export interface ItemDef {
  id: ItemId; name: string; icon: string; description: string; price: number;
  kind: 'equipment' | 'consumable'; maxStacks: number; cosmetic?: string;
  statBonuses?: Readonly<Partial<Record<StatKey, number>>>;
  effectBonuses?: Readonly<Partial<Record<EquipmentEffect, number>>>;
  action?: ItemAction; maxPerRun?: number;
}
export interface AbilityDef { id: string; name: string; icon: string; description: string; cooldown: number; kind: 'ring' | 'rain' | 'slam' | 'heart' | 'signal' }
export type TalentBranch = 'attack' | 'survival' | 'agility';
export interface MetaNodeDef { id: string; branch: TalentBranch; name: string; icon: string; description: string; cost: number; maxRank: number; requires?: string; statBonuses?: Readonly<Partial<Record<StatKey, number>>>; effectBonuses?: Readonly<Partial<Record<EquipmentEffect, number>>> }
export interface TalentNodeState { rank: number; maxRank: number; maxed: boolean; locked: boolean; affordable: boolean; cost: number; canBuy: boolean }
export interface DifficultySnapshot { hp: number; damage: number; growthHp: number; growthDamage: number; mechanicTier: number }
export interface CosmeticDef { id: string; name: string; sprite: string; slot: 'head' | 'neck' | 'feet' }
export type BiomeId = 'grass' | 'forest' | 'sand' | 'water';
export interface StageDef { wave: number; name: string; duration: number; spawnInterval: number; hpScale: number; reward: number; weights: Readonly<Partial<Record<EnemyId, number>>>; boss?: boolean; biome: BiomeId }
export interface ShopOffer { id: string; itemId?: ItemId; kind: 'equipment' | 'consumable' | 'weapon'; name: string; description: string; price: number; sold: boolean }
export interface RunResult { reason: 'victory' | 'defeat' | 'abandon'; wave: number; kills: number; coinsEarned: number; elapsed: number; profile: Profile; bossesDefeated: number; talentPointsEarned: number }
export interface SessionOptions { seed?: number }
