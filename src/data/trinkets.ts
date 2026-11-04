import { AttrKey } from '../core/AttributeSystem';
import { EffectId } from '../types';

export interface StatTrinketDef {
  id: string;
  name: string;
  description: string;
  price: number;
  attr: AttrKey;
  mode: 'flat' | 'percent';
  value: number;
}

export interface EffectTrinketDef {
  id: string;
  name: string;
  description: string;
  price: number;
  effect: EffectId;
  /** 不填则无限叠加 */
  maxStacks?: number;
}

/** 数值类饰品：映射到属性系统修饰器，可重复购买叠加 */
export const STAT_TRINKETS: StatTrinketDef[] = [
  { id: 'power', name: '力量', description: '伤害 +10%', price: 20, attr: AttrKey.Damage, mode: 'percent', value: 0.1 },
  { id: 'haste', name: '攻速', description: '攻击速度 +10%', price: 20, attr: AttrKey.AttackSpeed, mode: 'percent', value: 0.1 },
  { id: 'vitality', name: '生命', description: '生命上限 +15', price: 20, attr: AttrKey.MaxHP, mode: 'flat', value: 15 },
  { id: 'regen', name: '再生', description: '每秒回复 +0.5', price: 20, attr: AttrKey.HPRegen, mode: 'flat', value: 0.5 },
  { id: 'crit', name: '暴击', description: '暴击率 +5%', price: 20, attr: AttrKey.CritChance, mode: 'flat', value: 0.05 },
  { id: 'armor', name: '护甲', description: '护甲 +3', price: 20, attr: AttrKey.Armor, mode: 'flat', value: 3 },
  { id: 'dodge', name: '闪避', description: '闪避率 +5%', price: 20, attr: AttrKey.Dodge, mode: 'flat', value: 0.05 },
  { id: 'swift', name: '移速', description: '移动速度 +8%', price: 20, attr: AttrKey.MoveSpeed, mode: 'percent', value: 0.08 },
  { id: 'magnet', name: '磁铁', description: '拾取范围 +40', price: 20, attr: AttrKey.PickupRange, mode: 'flat', value: 40 },
  { id: 'scope', name: '瞄准镜', description: '攻击范围 +50', price: 20, attr: AttrKey.Range, mode: 'flat', value: 50 }
];

/** 特效类饰品：效果计数器堆叠 */
export const EFFECT_TRINKETS: EffectTrinketDef[] = [
  { id: 'pierce', name: '穿透弹', description: '子弹穿透 +1', price: 30, effect: EffectId.Pierce },
  { id: 'lifesteal', name: '吸血鬼', description: '每次击杀回复 1 HP', price: 30, effect: EffectId.Lifesteal },
  { id: 'multishot', name: '多重射击', description: '每次开火 +1 发弹丸', price: 30, effect: EffectId.MultiShot },
  { id: 'explosion', name: '爆裂打击', description: '+20% 概率击杀时引发爆炸', price: 35, effect: EffectId.Explosion },
  {
    id: 'heavy',
    name: '重型射击',
    description: '攻击速度减半，伤害翻倍（唯一）',
    price: 50,
    effect: EffectId.HeavyShot,
    maxStacks: 1
  }
];
