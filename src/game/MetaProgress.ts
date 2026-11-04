import { talents } from './content';
import type { EquipmentEffect, Profile, StatKey, TalentNodeState } from './types';

export const createProfile = (): Profile => ({ version: 2, bossWins: 0, bestWave: 0, totalRuns: 0, totalKills: 0, talentPoints: 0, talents: {}, threatLevel: 0 });
const integer = (value: unknown, max = 1_000_000): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** 与饰品共用的加算入口：百分比属性同层累加，实际上限由角色属性计算应用。 */
export function applyStats(target: Record<StatKey, number>, bonuses: Readonly<Partial<Record<StatKey, number>>>, rank = 1): void {
  for (const [key, amount] of Object.entries(bonuses)) target[key as StatKey] += amount * rank;
}
export function collectTalentBonuses(profile: Profile): { stats: Record<StatKey, number>; effects: Record<EquipmentEffect, number> } {
  const stats: Record<StatKey, number> = { damage: 0, attackSpeed: 0, maxHp: 0, armor: 0, regen: 0, crit: 0, moveSpeed: 0 };
  const effects: Record<EquipmentEffect, number> = { multishot: 0, pierce: 0, explosion: 0, lifesteal: 0, pickupRange: 0 };
  for (const node of Object.values(talents)) {
    const rank = Math.min(node.maxRank, profile.talents[node.id] ?? 0);
    applyStats(stats, node.statBonuses ?? {}, rank);
    for (const [key, amount] of Object.entries(node.effectBonuses ?? {})) effects[key as EquipmentEffect] += amount * rank;
  }
  return { stats, effects };
}
export function getTalentState(profile: Profile, id: string): TalentNodeState | null {
  const node = talents[id]; if (!node) return null;
  const rank = profile.talents[id] ?? 0; const locked = !!node.requires && !(profile.talents[node.requires] > 0);
  const maxed = rank >= node.maxRank; const affordable = profile.talentPoints >= node.cost;
  return { rank, maxRank: node.maxRank, maxed, locked, affordable, cost: node.cost, canBuy: !locked && !maxed && affordable };
}
export function buyTalent(profile: Profile, id: string): Profile | null {
  const state = getTalentState(profile, id); if (!state?.canBuy) return null;
  return { ...profile, talentPoints: profile.talentPoints - state.cost, talents: { ...profile.talents, [id]: state.rank + 1 } };
}

/** 归档树的一次性兑换表，来自旧源码的 cost/maxRank；不保留旧增益运行双轨。 */
const oldNodes: Record<string, readonly [number, number]> = {
  'shared-vigor': [8, 3], 'shared-power': [10, 3], 'shared-swift': [8, 2], 'shared-armor': [12, 2], 'shared-multishot': [30, 2], 'shared-range': [10, 2], 'shared-magnet': [8, 2],
  'assault-speed': [10, 2], 'assault-pierce': [30, 2], 'assault-damage': [12, 2], 'assault-crit': [15, 2],
  'ranger-crit': [10, 2], 'ranger-burn': [30, 2], 'ranger-move': [8, 2], 'ranger-range': [10, 2],
  'tank-hp': [10, 2], 'tank-armor': [12, 2], 'tank-regen': [10, 2], 'tank-lifesteal': [30, 2]
};
export function normalizeProfile(raw: unknown, legacy?: unknown): Profile {
  const input = object(raw); const old = object(legacy); const stats = object(old.stats);
  const profile = createProfile();
  profile.bossWins = integer(input.bossWins ?? stats.totalBossKills);
  profile.bestWave = Math.min(8, integer(input.bestWave ?? stats.bestWave));
  profile.totalRuns = integer(input.totalRuns ?? stats.runs);
  profile.totalKills = integer(input.totalKills ?? (integer(stats.totalNormalKills) + integer(stats.totalEliteKills)));
  profile.threatLevel = integer(input.threatLevel, 4);
  if (input.version === 2) {
    profile.talentPoints = integer(input.talentPoints);
    const ranks = object(input.talents);
    for (const node of Object.values(talents)) profile.talents[node.id] = integer(ranks[node.id], node.maxRank);
    for (const node of Object.values(talents)) if (node.requires && !profile.talents[node.requires]) profile.talents[node.id] = 0;
  } else {
    profile.talentPoints = integer(old.stardust);
    const ranks = object(old.ranks);
    for (const [id, [cost, maxRank]] of Object.entries(oldNodes)) profile.talentPoints += integer(ranks[id], maxRank) * cost;
  }
  return profile;
}
