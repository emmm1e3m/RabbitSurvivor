import type { CharacterId } from './characters';

/** 局外累计统计（跨局累加，存档保存） */
export interface MetaStats {
  runs: number;
  totalNormalKills: number;
  totalEliteKills: number;
  totalBossKills: number;
  bestWave: number;
  victories: number;
  bestRunGold: number;
  /** 单局结束时拥有的饰品总件数（含堆叠） */
  bestRunTrinkets: number;
}

/** 一局结束时的结算数据 */
export interface RunResult {
  characterId: CharacterId;
  wave: number;
  normalKills: number;
  eliteKills: number;
  bossKilled: boolean;
  victory: boolean;
  gold: number;
  trinketCount: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** 解锁时额外奖励的星尘 */
  stardust: number;
  /** 基于累计统计判断（结算时在累加本局数据之后调用） */
  check: (stats: MetaStats) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-run',
    name: '初次出征',
    description: '完成第一局游戏',
    stardust: 5,
    check: (s) => s.runs >= 1
  },
  {
    id: 'kills-100',
    name: '百人斩',
    description: '累计击杀 100 个小怪',
    stardust: 10,
    check: (s) => s.totalNormalKills >= 100
  },
  {
    id: 'elite-20',
    name: '精英猎手',
    description: '累计击杀 20 个精英敌人',
    stardust: 15,
    check: (s) => s.totalEliteKills >= 20
  },
  {
    id: 'wave-5',
    name: '站稳脚跟',
    description: '单局到达第 5 波',
    stardust: 10,
    check: (s) => s.bestWave >= 5
  },
  {
    id: 'boss-1',
    name: '屠龙者',
    description: '击败最终波 Boss',
    stardust: 20,
    check: (s) => s.totalBossKills >= 1
  },
  {
    id: 'victory-1',
    name: '凯旋',
    description: '通关一次',
    stardust: 30,
    check: (s) => s.victories >= 1
  },
  {
    id: 'rich-200',
    name: '小富即安',
    description: '单局结束时持有 200 金币',
    stardust: 10,
    check: (s) => s.bestRunGold >= 200
  },
  {
    id: 'collector-10',
    name: '收藏家',
    description: '单局集齐 10 件饰品',
    stardust: 15,
    check: (s) => s.bestRunTrinkets >= 10
  }
];
