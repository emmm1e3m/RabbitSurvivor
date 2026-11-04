import { AttributeSystem } from './AttributeSystem';
import { MetaProgress } from './MetaProgress';
import { CharacterDef, DEFAULT_CHARACTER } from '../data/characters';
import { DIFFICULTIES, DifficultyDef, LEVEL, SHOP } from '../data/balance';
import { collectMetaBonuses } from '../data/metaTree';
import { GAME_WIDTH, GAME_HEIGHT, DEFAULT_MAP_SCALE } from '../config';
import { EffectId, MetaEffectId } from '../types';
import type { ShopOffer } from '../systems/ShopSystem';

/**
 * 跨场景持久状态。GameScene 常驻期间，属性系统是唯一实例的引用传递，
 * 商店购买直接生效，无需序列化。
 */
class RunDataStore {
  /** 当前（或上一次）选择的角色，暂停重开时沿用 */
  character: CharacterDef = DEFAULT_CHARACTER;
  /** 当前难度编号（DIFFICULTIES 下标），默认 0；暂停重开时沿用 */
  difficulty = 0;
  attributes: AttributeSystem = new AttributeSystem(DEFAULT_CHARACTER.base);
  gold = 0;
  /** 已完成的波数 */
  wave = 0;
  weaponLevel = 1;
  kills = 0;
  /** 击杀分类统计：小怪与精英分开计数 */
  normalKills = 0;
  eliteKills = 0;
  level = 1;
  xp = 0;
  /** 待处理的升级加点次数（LevelUpScene 逐次消费） */
  pendingLevelUps = 0;
  /** 升级加点累计序号（生成唯一修饰器 id） */
  levelChoices = 0;
  /** 特效饰品堆叠层数 */
  effects = new Map<EffectId, number>();
  /** 局外天赋提供的特殊战斗效果层数 */
  metaEffects = new Map<MetaEffectId, number>();
  /** 本局是否击杀过 Boss（结算成就判定用） */
  bossKilled = false;
  /** 本局结算是否已发放星尘（防止重复记录） */
  metaRecorded = false;
  /** 数值饰品 id -> 已购次数（用于修饰器 id） */
  trinketCounts = new Map<string, number>();
  /** 商店各栏位锁定的商品（索引对应栏位；购买或手动解锁后清除，重开一局重置） */
  shopLocks: Array<ShopOffer | null> = new Array(SHOP.slots).fill(null);
  /** 购买生命饰品后待回复的血量（GameScene 恢复时结算） */
  pendingHeal = 0;
  /** 持有小问号数量（波后事件接受时消耗 1 个） */
  questionMarks = 0;
  /** 下一波敌人数量倍率（问号事件设置，开始下一波后重置） */
  nextWaveEnemyMult = 1;

  /** 本局地图尺寸：由当前角色的 mapScale 决定，默认 1.5 倍视口 */
  get mapWidth(): number {
    return Math.round(GAME_WIDTH * (this.character.mapScale ?? DEFAULT_MAP_SCALE));
  }

  get mapHeight(): number {
    return Math.round(GAME_HEIGHT * (this.character.mapScale ?? DEFAULT_MAP_SCALE));
  }

  /** 当前难度的倍率配置 */
  get difficultyDef(): DifficultyDef {
    return DIFFICULTIES[this.difficulty] ?? DIFFICULTIES[0];
  }

  /** 以指定角色开始新的一局（保留难度选择，重置其余进度） */
  startRun(character: CharacterDef, difficulty = this.difficulty): void {
    this.character = character;
    this.difficulty = Math.min(Math.max(0, Math.round(difficulty)), DIFFICULTIES.length - 1);
    this.attributes = new AttributeSystem(character.base);
    this.gold = 0;
    this.wave = 0;
    this.weaponLevel = 1;
    this.kills = 0;
    this.normalKills = 0;
    this.eliteKills = 0;
    this.level = 1;
    this.xp = 0;
    this.pendingLevelUps = 0;
    this.levelChoices = 0;
    this.effects.clear();
    this.metaEffects.clear();
    this.trinketCounts.clear();
    this.shopLocks = new Array(SHOP.slots).fill(null);
    this.pendingHeal = 0;
    this.questionMarks = 0;
    this.nextWaveEnemyMult = 1;
    this.bossKilled = false;
    this.metaRecorded = false;

    // 应用局外天赋：通用树 + 当前角色专属树的已购等级
    const bonuses = collectMetaBonuses(character.id, MetaProgress.ranks);
    bonuses.stats.forEach((bonus, index) => {
      this.attributes.addModifier({
        id: `meta:${bonus.nodeId}:${index}`,
        key: bonus.attr,
        type: bonus.mode,
        value: bonus.value
      });
    });
    for (const [effect, stacks] of bonuses.effects) {
      this.metaEffects.set(effect, stacks);
    }
  }

  /** 增加经验，返回本次升了几级（余量保留） */
  addXp(amount: number): number {
    this.xp += amount;
    let gained = 0;
    while (this.xp >= LEVEL.xpToNext) {
      this.xp -= LEVEL.xpToNext;
      this.level++;
      gained++;
    }
    return gained;
  }

  getEffect(id: EffectId): number {
    return this.effects.get(id) ?? 0;
  }

  addEffect(id: EffectId, stacks = 1): void {
    this.effects.set(id, this.getEffect(id) + stacks);
  }

  getMetaEffect(id: MetaEffectId): number {
    return this.metaEffects.get(id) ?? 0;
  }

  addGold(amount: number): void {
    this.gold += amount;
  }
}

export const RunData = new RunDataStore();
