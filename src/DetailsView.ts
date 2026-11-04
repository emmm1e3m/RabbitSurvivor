import { abilities, characters, items, talents, talentBranches } from './game/content';
import type { Session } from './game/Session';
import { getTalentState } from './game/MetaProgress';
import type { AbilityDef, CharacterDef, Profile } from './game/types';

export type DetailKind = 'character' | 'item' | 'ability' | 'talent' | 'weapon';
type Icon = (name: string, size?: number, extra?: string) => string;
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const number = (value: number): string => Number(value.toFixed(2)).toString();
const formNames: Record<string, string> = { heart: '心好兔', signal: '信号狗' };

function stats(entries: readonly [string, string | number][]): string {
  return `<dl class="detail-stats">${entries.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('')}</dl>`;
}

function characterSkills(def: CharacterDef): { id: string; form: string }[] {
  const seen = new Set<string>();
  return def.forms.flatMap(form => {
    const id = def.formAbilities?.[form] ?? def.abilityId;
    if (seen.has(id)) return [];
    seen.add(id); return [{ id, form }];
  });
}

/** 技能详情补充其实际构筑联动，不以普通攻击的说明代替技能行为。 */
function abilityNotes(def: AbilityDef): string[] {
  const common = '技能继承当前苹果伤害、暴击和击杀效果。';
  const notes: Record<AbilityDef['kind'], string[]> = {
    ring: ['双生苹果追加较弱的一次施放，额外施放为 45% 伤害，最多共 3 次。', '穿透每层让每枚苹果多命中 1 个目标。'],
    rain: ['双生苹果追加较弱的一次施放，额外施放为 45% 伤害，最多共 3 次。', '穿透每层让每枚苹果多命中 1 个目标。'],
    slam: ['双生苹果追加 45% 伤害的震击，最多共 3 次。', '穿透每层让震击范围增加 8。'],
    heart: ['冲刺期间加速并获得无敌，持续 2.2 秒。', '双生苹果增加同一敌人的可碰撞次数；穿透增加本次冲刺的总命中额度。'],
    signal: ['苹果环绕身体，命中额度耗尽或 5.5 秒后消失。', '双生苹果追加 45% 伤害的一圈，最多 18 枚；穿透增加每枚可命中的不同目标数。']
  };
  return [...notes[def.kind], common];
}

function skillSection(def: AbilityDef, icon: Icon, prefix = ''): string {
  return `<section class="detail-section"><h3>${icon(def.icon, 32)}${prefix ? `${escapeHtml(prefix)} · ` : ''}${escapeHtml(def.name)}</h3><p>${escapeHtml(def.description)}</p><ul class="detail-list">${abilityNotes(def).map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul></section>`;
}

/** 详情只读取已登记内容与当前状态，不触发购买、成长或随机数。 */
export function renderDetails(kind: DetailKind, id: string, session: Session | null, icon: Icon, profile: Profile): { title: string; body: string } {
  if (kind === 'character') {
    const def = characters[id];
    const attack = def.forms.length > 1 ? '远程 / 近战切换' : def.melee ? '近战挥击' : '远程苹果';
    return {
      title: def.name,
      body: `<div class="detail-portrait">${def.forms.map(form => icon(`${form}-0`, 112)).join('')}</div><p class="detail-lead">${escapeHtml(def.description)}</p>${stats([['起始生命', def.base.hp], ['苹果威力', def.base.damage], ['起始护甲', def.base.armor], ['攻击方式', attack]])}${characterSkills(def).map(entry => skillSection(abilities[entry.id], icon, def.forms.length > 1 ? formNames[entry.form] : '')).join('')}`
    };
  }
  if (kind === 'item') {
    const def = items[id];
    const held = def.kind === 'equipment' ? session?.equipment[id] ?? 0 : session?.inventory.filter(item => item === id).length ?? 0;
    const entries: [string, string | number][] = [['类型', def.kind === 'equipment' ? '随身饰品' : '一次性道具'], ['手中持有', held]];
    entries.push(def.kind === 'equipment' ? ['叠加上限', `${def.maxStacks} 层`] : ['使用', '成功使用后消耗']);
    return { title: def.name, body: `<div class="detail-portrait">${icon(def.icon, 80)}</div><p class="detail-lead">${escapeHtml(def.description)}</p>${stats(entries)}${def.maxPerRun ? `<p class="detail-note">每次冒险最多获得 ${def.maxPerRun} 份。</p>` : ''}` };
  }
  if (kind === 'ability') {
    const def = abilities[id];
    return { title: def.name, body: `<div class="detail-portrait">${icon(def.icon, 80)}</div><p class="detail-lead">${escapeHtml(def.description)}</p>${stats([['基础冷却', `${number(def.cooldown)} 秒`], ['强化', '第 5 波开始']])}<ul class="detail-list">${abilityNotes(def).map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` };
  }
  if (kind === 'talent') {
    const def = talents[id];
    const state = getTalentState(profile, id)!;
    const entries: [string, string | number][] = [['分支', talentBranches[def.branch].name], ['已学习', `${state.rank} / ${state.maxRank}`], ['每级消耗', `${def.cost} 积分`], ['生效范围', '下一次与后续冒险']];
    if (def.requires) entries.push(['前置本领', `${talents[def.requires].name} 1 级`]);
    return { title: def.name, body: `<div class="detail-portrait">${icon(def.icon, 80)}</div><p class="detail-lead">${escapeHtml(def.description)}</p>${stats(entries)}` };
  }
  return { title: '苹果武器', body: `<div class="detail-portrait">${icon('sword', 80)}</div><p class="detail-lead">提高每一次攻击的苹果威力，同样作用于近战、远程和继承苹果伤害的技能。</p>${stats([['当前等级', session!.weaponLevel], ['等级上限', 5], ['每级加成', '基础威力 +20%']])}` };
}
