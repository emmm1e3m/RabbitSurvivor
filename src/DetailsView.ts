import { abilities, characters, items, upgrades } from './game/content';
import type { Session } from './game/Session';

export type DetailKind = 'character' | 'item' | 'ability' | 'upgrade' | 'weapon';
type Icon = (name: string, size?: number, extra?: string) => string;

/** 详情只读取已登记内容与当前状态，不触发购买、升级或随机数。 */
export function renderDetails(kind: DetailKind, id: string, session: Session | null, icon: Icon): { title: string; body: string } {
  if (kind === 'character') {
    const def = characters[id]; const skill = abilities[def.abilityId];
    return { title: def.name, body: `<div class="detail-portrait">${def.forms.map(form => icon(`${form}-0`, 112)).join('')}</div><p class="detail-lead">${def.description}</p><dl class="detail-stats"><div><dt>生命</dt><dd>${def.base.hp}</dd></div><div><dt>苹果威力</dt><dd>${def.base.damage}</dd></div><div><dt>护甲</dt><dd>${def.base.armor}</dd></div><div><dt>攻击方式</dt><dd>${def.melee ? '近战挥击' : def.forms.length > 1 ? '远程 / 近战切换' : '远程苹果'}</dd></div></dl><section class="detail-section"><h3>${icon(skill.icon, 32)}${skill.name}</h3><p>${skill.description}</p><small>基础冷却 ${skill.cooldown} 秒 · 等级5时强化</small></section>` };
  }
  if (kind === 'item') {
    const def = items[id]; const held = def.kind === 'equipment' ? session?.equipment[id] ?? 0 : session?.inventory.filter(item => item === id).length ?? 0;
    return { title: def.name, body: `<div class="detail-portrait">${icon(def.icon, 80)}</div><p class="detail-lead">${def.description}</p><dl class="detail-stats"><div><dt>类型</dt><dd>${def.kind === 'equipment' ? '随身饰品' : '一次性道具'}</dd></div><div><dt>手中持有</dt><dd>${held}</dd></div>${def.kind === 'equipment' ? `<div><dt>叠加上限</dt><dd>${def.maxStacks} 层</dd></div>` : `<div><dt>使用</dt><dd>成功使用后消耗</dd></div>`}</dl>${def.maxPerRun ? `<p class="detail-note">每次冒险最多获得 ${def.maxPerRun} 份。</p>` : ''}` };
  }
  if (kind === 'ability') {
    const def = abilities[id];
    return { title: def.name, body: `<div class="detail-portrait">${icon(def.icon, 80)}</div><p class="detail-lead">${def.description}</p><dl class="detail-stats"><div><dt>基础冷却</dt><dd>${def.cooldown} 秒</dd></div><div><dt>强化</dt><dd>角色达到等级5</dd></div></dl><p class="detail-note">空格或技能按钮使用。</p>` };
  }
  if (kind === 'upgrade') {
    const def = upgrades[id.split(':')[0]];
    const offer = session!.upgradeChoices.find(choice => choice.id === id)!;
    const percent = ['damage', 'attackSpeed', 'crit', 'moveSpeed'].includes(offer.stat);
    return { title: offer.name, body: `<div class="detail-portrait">${icon(def.icon, 80)}</div><p class="detail-lead">${def.description}</p><p>本次获得：+${percent ? `${Math.round(offer.amount * 100)}%` : offer.amount.toFixed(offer.stat === 'regen' ? 2 : 0)}</p><p class="detail-note">选择后立即生效。本次冒险结束后重置。</p>` };
  }
  return { title: '苹果武器', body: `<div class="detail-portrait">${icon('sword', 80)}</div><p class="detail-lead">让每一颗苹果更有力量。每级提高基础威力，最多升到5级；同样作用于近战和远程。</p><dl class="detail-stats"><div><dt>当前等级</dt><dd>${session!.weaponLevel}</dd></div><div><dt>每级加成</dt><dd>基础威力 +20%</dd></div></dl>` };
}
