import type { CharacterId } from './characters';

export type SkillId = 'barrageRing' | 'piercingShot' | 'groundSlam';

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
  /** 局内达到 SKILL.upgradeLevel 后的强化说明 */
  upgradedDescription: string;
  /** 主动技能：空格或 HUD 按钮释放；被动技能自动触发 */
  active: boolean;
}

/** 每个角色的专属技能：数值配置在 balance.ts 的 SKILL 块 */
export const CHARACTER_SKILLS: Record<CharacterId, SkillDef> = {
  assault: {
    id: 'barrageRing',
    name: '弹幕环',
    description: '每 5 秒自动向四周发射两圈弹幕',
    upgradedDescription: '间隔缩短至 4 秒，每圈 8 → 12 发，伤害提升',
    active: false
  },
  ranger: {
    id: 'piercingShot',
    name: '穿云箭',
    description: '空格或点击技能按钮：向最近敌人射出高伤穿透箭',
    upgradedDescription: '双箭齐发，冷却 6 → 4.5 秒，伤害提升',
    active: true
  },
  tank: {
    id: 'groundSlam',
    name: '震地冲击',
    description: '空格或点击技能按钮：震击周围敌人造成范围伤害',
    upgradedDescription: '范围与伤害提升，冷却 8 → 6 秒',
    active: true
  }
};
