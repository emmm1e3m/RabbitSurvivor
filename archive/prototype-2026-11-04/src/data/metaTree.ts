import { AttrKey } from '../core/AttributeSystem';
import { MetaEffectId } from '../types';
import { META } from './balance';
import type { CharacterId } from './characters';

export interface MetaStatEffect {
  kind: 'stat';
  attr: AttrKey;
  mode: 'flat' | 'percent';
  /** 每级数值 */
  value: number;
}

export interface MetaRuntimeEffect {
  kind: 'effect';
  effect: MetaEffectId;
  /** 每级层数 */
  value: number;
}

export type MetaEffect = MetaStatEffect | MetaRuntimeEffect;

export interface MetaNodeDef {
  id: string;
  name: string;
  description: string;
  /** 每级消耗的星尘 */
  cost: number;
  maxRank: number;
  /** 前置节点：至少拥有 1 级才能购买本节点 */
  requires?: string;
  /** 树内布局：行（0 起）与列（0 起） */
  tier: number;
  slot: number;
  effects: MetaEffect[];
}

export interface MetaTreeDef {
  /** 'shared' 或角色 id */
  id: 'shared' | CharacterId;
  name: string;
  description: string;
  nodes: MetaNodeDef[];
}

export interface MetaStatBonus {
  nodeId: string;
  attr: AttrKey;
  mode: 'flat' | 'percent';
  value: number;
}

export interface MetaBonuses {
  stats: MetaStatBonus[];
  effects: Map<MetaEffectId, number>;
}

const stat = (
  attr: AttrKey,
  mode: 'flat' | 'percent',
  value: number
): MetaStatEffect => ({ kind: 'stat', attr, mode, value });

const runtime = (effect: MetaEffectId, value = 1): MetaRuntimeEffect => ({
  kind: 'effect',
  effect,
  value
});

/** 全角色共享的通用天赋树 */
const SHARED_TREE: MetaTreeDef = {
  id: 'shared',
  name: '通用',
  description: '所有角色共享的永久强化',
  nodes: [
    {
      id: 'shared-vigor',
      name: '强健体魄',
      description: '生命上限 +10/级',
      cost: 8,
      maxRank: 3,
      tier: 0,
      slot: 0,
      effects: [stat(AttrKey.MaxHP, 'flat', 10)]
    },
    {
      id: 'shared-power',
      name: '火力强化',
      description: '伤害 +5%/级',
      cost: 10,
      maxRank: 3,
      tier: 0,
      slot: 1,
      effects: [stat(AttrKey.Damage, 'percent', 0.05)]
    },
    {
      id: 'shared-swift',
      name: '轻盈步伐',
      description: '移动速度 +4%/级',
      cost: 8,
      maxRank: 2,
      tier: 0,
      slot: 2,
      effects: [stat(AttrKey.MoveSpeed, 'percent', 0.04)]
    },
    {
      id: 'shared-armor',
      name: '坚硬外壳',
      description: '护甲 +2/级',
      cost: 12,
      maxRank: 2,
      requires: 'shared-vigor',
      tier: 1,
      slot: 0,
      effects: [stat(AttrKey.Armor, 'flat', 2)]
    },
    {
      id: 'shared-multishot',
      name: '弹幕扩容',
      description: '每次开火的弹丸 +1/级',
      cost: 30,
      maxRank: 2,
      requires: 'shared-power',
      tier: 1,
      slot: 1,
      effects: [runtime(MetaEffectId.ExtraProjectile)]
    },
    {
      id: 'shared-range',
      name: '鹰眼',
      description: '攻击范围 +30/级',
      cost: 10,
      maxRank: 2,
      requires: 'shared-swift',
      tier: 1,
      slot: 2,
      effects: [stat(AttrKey.Range, 'flat', 30)]
    },
    {
      id: 'shared-magnet',
      name: '磁力场',
      description: '拾取范围 +30/级',
      cost: 8,
      maxRank: 2,
      requires: 'shared-range',
      tier: 2,
      slot: 2,
      effects: [stat(AttrKey.PickupRange, 'flat', 30)]
    }
  ]
};

/** 突击者专属：持续火力与穿甲 */
const ASSAULT_TREE: MetaTreeDef = {
  id: 'assault',
  name: '突击者',
  description: '强化持续火力与穿透',
  nodes: [
    {
      id: 'assault-speed',
      name: '突击训练',
      description: '攻击速度 +6%/级',
      cost: 10,
      maxRank: 2,
      tier: 0,
      slot: 0,
      effects: [stat(AttrKey.AttackSpeed, 'percent', 0.06)]
    },
    {
      id: 'assault-pierce',
      name: '穿甲弹',
      description: '弹丸穿透 +1/级',
      cost: 30,
      maxRank: 2,
      requires: 'assault-speed',
      tier: 1,
      slot: 0,
      effects: [runtime(MetaEffectId.Pierce)]
    },
    {
      id: 'assault-damage',
      name: '战术打击',
      description: '伤害 +8%/级',
      cost: 12,
      maxRank: 2,
      tier: 0,
      slot: 1,
      effects: [stat(AttrKey.Damage, 'percent', 0.08)]
    },
    {
      id: 'assault-crit',
      name: '致命节奏',
      description: '暴击率 +4%/级',
      cost: 15,
      maxRank: 2,
      requires: 'assault-damage',
      tier: 1,
      slot: 1,
      effects: [stat(AttrKey.CritChance, 'flat', 0.04)]
    }
  ]
};

/** 游侠专属：暴击、射程与燃烧箭 */
const RANGER_TREE: MetaTreeDef = {
  id: 'ranger',
  name: '游侠',
  description: '强化暴击、射程与燃烧箭',
  nodes: [
    {
      id: 'ranger-crit',
      name: '猎手直觉',
      description: '暴击率 +5%/级',
      cost: 10,
      maxRank: 2,
      tier: 0,
      slot: 0,
      effects: [stat(AttrKey.CritChance, 'flat', 0.05)]
    },
    {
      id: 'ranger-burn',
      name: '燃烧箭',
      description: `子弹附加燃烧：每秒 ${Math.round(META.burnDamageRatio * 100)}% 武器伤害，持续 ${META.burnDuration}s（每级叠加）`,
      cost: 30,
      maxRank: 2,
      requires: 'ranger-crit',
      tier: 1,
      slot: 0,
      effects: [runtime(MetaEffectId.Burn)]
    },
    {
      id: 'ranger-move',
      name: '风行',
      description: '移动速度 +6%/级',
      cost: 8,
      maxRank: 2,
      tier: 0,
      slot: 1,
      effects: [stat(AttrKey.MoveSpeed, 'percent', 0.06)]
    },
    {
      id: 'ranger-range',
      name: '远程专精',
      description: '攻击范围 +40/级',
      cost: 10,
      maxRank: 2,
      requires: 'ranger-move',
      tier: 1,
      slot: 1,
      effects: [stat(AttrKey.Range, 'flat', 40)]
    }
  ]
};

/** 重装专属：生存、护甲与击杀回复 */
const TANK_TREE: MetaTreeDef = {
  id: 'tank',
  name: '重装',
  description: '强化生存、护甲与吸血',
  nodes: [
    {
      id: 'tank-hp',
      name: '重装体魄',
      description: '生命上限 +20/级',
      cost: 10,
      maxRank: 2,
      tier: 0,
      slot: 0,
      effects: [stat(AttrKey.MaxHP, 'flat', 20)]
    },
    {
      id: 'tank-armor',
      name: '复合装甲',
      description: '护甲 +3/级',
      cost: 12,
      maxRank: 2,
      requires: 'tank-hp',
      tier: 1,
      slot: 0,
      effects: [stat(AttrKey.Armor, 'flat', 3)]
    },
    {
      id: 'tank-regen',
      name: '自愈',
      description: '每秒回复 +0.5/级',
      cost: 10,
      maxRank: 2,
      tier: 0,
      slot: 1,
      effects: [stat(AttrKey.HPRegen, 'flat', 0.5)]
    },
    {
      id: 'tank-lifesteal',
      name: '嗜血装甲',
      description: '每次击杀回复 +1 HP/级',
      cost: 30,
      maxRank: 2,
      requires: 'tank-regen',
      tier: 1,
      slot: 1,
      effects: [runtime(MetaEffectId.Lifesteal)]
    }
  ]
};

/** 天赋树池：通用树 + 每个角色的专属树 */
export const META_TREES: MetaTreeDef[] = [
  SHARED_TREE,
  ASSAULT_TREE,
  RANGER_TREE,
  TANK_TREE
];

export function findMetaNode(nodeId: string): MetaNodeDef | undefined {
  for (const tree of META_TREES) {
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (node) return node;
  }
  return undefined;
}

/** 汇总当前角色可用的已解锁天赋（通用树 + 该角色专属树） */
export function collectMetaBonuses(
  characterId: CharacterId,
  ranks: Readonly<Record<string, number>>
): MetaBonuses {
  const stats: MetaStatBonus[] = [];
  const effects = new Map<MetaEffectId, number>();

  for (const tree of META_TREES) {
    if (tree.id !== 'shared' && tree.id !== characterId) continue;
    for (const node of tree.nodes) {
      const rank = ranks[node.id] ?? 0;
      if (rank <= 0) continue;
      for (const effect of node.effects) {
        if (effect.kind === 'stat') {
          stats.push({
            nodeId: node.id,
            attr: effect.attr,
            mode: effect.mode,
            value: effect.value * rank
          });
        } else {
          effects.set(
            effect.effect,
            (effects.get(effect.effect) ?? 0) + effect.value * rank
          );
        }
      }
    }
  }

  return { stats, effects };
}
