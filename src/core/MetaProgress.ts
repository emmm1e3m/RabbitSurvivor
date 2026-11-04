import { META } from '../data/balance';
import { findMetaNode } from '../data/metaTree';
import {
  ACHIEVEMENTS,
  AchievementDef,
  MetaStats,
  RunResult
} from '../data/achievements';
import type { EnemyKind } from '../types';

const SAVE_KEY = 'rabbit:meta:v1';

interface MetaSaveData {
  version: 1;
  stardust: number;
  /** nodeId -> 已购买等级 */
  ranks: Record<string, number>;
  /** 已解锁成就 id */
  achievements: string[];
  codex: {
    enemies: EnemyKind[];
    trinkets: string[];
  };
  stats: MetaStats;
}

export interface MetaNodeState {
  rank: number;
  maxed: boolean;
  /** 前置节点未解锁 */
  locked: boolean;
  cost: number;
  affordable: boolean;
}

export interface RunReward {
  /** 本局获得的总星尘（含成就奖励） */
  stardust: number;
  /** 本局新解锁的成就 */
  achievements: AchievementDef[];
}

function freshStats(): MetaStats {
  return {
    runs: 0,
    totalNormalKills: 0,
    totalEliteKills: 0,
    totalBossKills: 0,
    bestWave: 0,
    victories: 0,
    bestRunGold: 0,
    bestRunTrinkets: 0
  };
}

function freshSave(): MetaSaveData {
  return {
    version: 1,
    stardust: META.startingStardust,
    ranks: {},
    achievements: [],
    codex: { enemies: [], trinkets: [] },
    stats: freshStats()
  };
}

/**
 * 局外存档：星尘、天赋等级、成就与图鉴发现，持久化到 localStorage。
 * 读取时对缺失字段做兜底，存档损坏则重置为新档。
 */
class MetaProgressStore {
  private data: MetaSaveData = freshSave();

  constructor() {
    this.load();
  }

  get stardust(): number {
    return this.data.stardust;
  }

  get ranks(): Readonly<Record<string, number>> {
    return this.data.ranks;
  }

  get stats(): Readonly<MetaStats> {
    return this.data.stats;
  }

  getRank(nodeId: string): number {
    return this.data.ranks[nodeId] ?? 0;
  }

  getNodeState(nodeId: string): MetaNodeState | null {
    const node = findMetaNode(nodeId);
    if (!node) return null;
    const rank = this.getRank(nodeId);
    const maxed = rank >= node.maxRank;
    const locked = node.requires ? this.getRank(node.requires) <= 0 : false;
    return {
      rank,
      maxed,
      locked,
      cost: node.cost,
      affordable: this.data.stardust >= node.cost
    };
  }

  /** 购买一级天赋，成功返回 true */
  buyNode(nodeId: string): boolean {
    const node = findMetaNode(nodeId);
    const state = this.getNodeState(nodeId);
    if (!node || !state) return false;
    if (state.maxed || state.locked || !state.affordable) return false;

    this.data.stardust -= state.cost;
    this.data.ranks[nodeId] = state.rank + 1;
    this.save();
    return true;
  }

  isAchievementUnlocked(id: string): boolean {
    return this.data.achievements.includes(id);
  }

  isEnemyDiscovered(kind: EnemyKind): boolean {
    return this.data.codex.enemies.includes(kind);
  }

  discoverEnemy(kind: EnemyKind): void {
    if (this.data.codex.enemies.includes(kind)) return;
    this.data.codex.enemies.push(kind);
    this.save();
  }

  /** key 使用商店商品 id（如 'stat:power' / 'effect:pierce'） */
  isTrinketDiscovered(key: string): boolean {
    return this.data.codex.trinkets.includes(key);
  }

  discoverTrinket(key: string): void {
    if (this.data.codex.trinkets.includes(key)) return;
    this.data.codex.trinkets.push(key);
    this.save();
  }

  /** 一局结束：累加统计、发放星尘、检查成就；重复调用由 RunData.metaRecorded 拦截 */
  recordRun(result: RunResult): RunReward {
    const stats = this.data.stats;
    stats.runs++;
    stats.totalNormalKills += result.normalKills;
    stats.totalEliteKills += result.eliteKills;
    if (result.bossKilled) stats.totalBossKills++;
    stats.bestWave = Math.max(stats.bestWave, result.wave);
    stats.bestRunGold = Math.max(stats.bestRunGold, result.gold);
    stats.bestRunTrinkets = Math.max(stats.bestRunTrinkets, result.trinketCount);
    if (result.victory) stats.victories++;

    let stardust = META.runReward(
      result.wave,
      result.normalKills,
      result.eliteKills,
      result.victory
    );
    const unlocked: AchievementDef[] = [];
    for (const achievement of ACHIEVEMENTS) {
      if (this.data.achievements.includes(achievement.id)) continue;
      if (!achievement.check(stats)) continue;
      this.data.achievements.push(achievement.id);
      stardust += achievement.stardust;
      unlocked.push(achievement);
    }

    this.data.stardust += stardust;
    this.save();
    return { stardust, achievements: unlocked };
  }

  private load(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<MetaSaveData>;
      const fresh = freshSave();
      this.data = {
        ...fresh,
        ...parsed,
        stardust:
          typeof parsed.stardust === 'number' && Number.isFinite(parsed.stardust)
            ? parsed.stardust
            : fresh.stardust,
        ranks: { ...(parsed.ranks ?? {}) },
        achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
        codex: {
          enemies: Array.isArray(parsed.codex?.enemies) ? parsed.codex.enemies : [],
          trinkets: Array.isArray(parsed.codex?.trinkets) ? parsed.codex.trinkets : []
        },
        stats: { ...freshStats(), ...(parsed.stats ?? {}) }
      };
    } catch {
      this.data = freshSave();
    }
  }

  private save(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // 存储不可用（隐私模式等）时静默失败，本局仍可正常游玩
    }
  }
}

export const MetaProgress = new MetaProgressStore();
