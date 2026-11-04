import type { EnemyKind } from '../types';

export interface CodexEnemyDef {
  kind: EnemyKind;
  name: string;
  description: string;
}

/** 图鉴中的敌人与可破坏物条目 */
export const CODEX_ENEMIES: CodexEnemyDef[] = [
  {
    kind: 'chaser',
    name: '追猎者',
    description: '成群出现的基础敌人，移动速度快。'
  },
  {
    kind: 'charger',
    name: '突击怪',
    description: '第 2 波起出现，接近后蓄力并高速冲刺撞击玩家。'
  },
  {
    kind: 'brute',
    name: '蛮兽',
    description: '第 3 波起出现的精英，血厚且接触伤害高。'
  },
  {
    kind: 'shooter',
    name: '弹幕精英',
    description: '第 4 波起出现的远程精英，保持距离发射扇形弹幕。'
  },
  {
    kind: 'boss',
    name: '终焉巨兽',
    description: '最终波出现的 Boss，拥有扇形弹幕与高额血量。'
  },
  {
    kind: 'tree',
    name: '苹果树',
    description: '击碎后获得经验、金币与苹果。'
  },
  {
    kind: 'barrel',
    name: '炸药桶',
    description: '被击破后爆炸，同时伤害敌人与玩家。'
  }
];

export function findCodexEnemy(kind: EnemyKind): CodexEnemyDef | undefined {
  return CODEX_ENEMIES.find((entry) => entry.kind === kind);
}
