import { AttrKey } from '../core/AttributeSystem';
import { COLORS } from '../config';
import { PLAYER_BASE } from './balance';

export type CharacterId = 'assault' | 'ranger' | 'tank';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  description: string;
  /** 玩家纹理颜色 */
  color: number;
  base: Record<AttrKey, number>;
  /** 地图相对视口的倍数，不填用 DEFAULT_MAP_SCALE（1.5）；更小 = 更紧凑的地图 */
  mapScale?: number;
}

/** 可选角色池：当前仅基础属性与颜色的差异，后续可扩展专属武器/被动 */
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'assault',
    name: '突击者',
    description: '均衡的初始属性，适合新手',
    color: COLORS.player,
    base: { ...PLAYER_BASE }
  },
  {
    id: 'ranger',
    name: '游侠',
    description: '移动与攻速快、暴击高，但生命较低',
    color: 0x8affc1,
    base: {
      ...PLAYER_BASE,
      [AttrKey.MaxHP]: 80,
      [AttrKey.MoveSpeed]: 260,
      [AttrKey.AttackSpeed]: 1.15,
      [AttrKey.CritChance]: 0.15,
      [AttrKey.PickupRange]: 100
    }
  },
  {
    id: 'tank',
    name: '重装',
    description: '生命厚、带护甲，但移速与攻速较慢',
    color: 0xffb86b,
    base: {
      ...PLAYER_BASE,
      [AttrKey.MaxHP]: 140,
      [AttrKey.HPRegen]: 0.8,
      [AttrKey.Damage]: 1.1,
      [AttrKey.AttackSpeed]: 0.85,
      [AttrKey.Armor]: 4,
      [AttrKey.MoveSpeed]: 180,
      [AttrKey.PickupRange]: 70
    }
  }
];

export const DEFAULT_CHARACTER = CHARACTERS[0];
