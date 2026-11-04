import { talents, talentBranches } from './game/content';
import { getTalentState } from './game/MetaProgress';
import type { Profile, MetaNodeDef } from './game/types';

type Icon = (name: string, size?: number, extra?: string) => string;

function renderNode(profile: Profile, def: MetaNodeDef, icon: Icon): string {
  const state = getTalentState(profile, def.id)!;
  const label = state.maxed ? '已学满' : state.locked ? '先学前置本领' : !state.affordable ? `还差 ${def.cost - profile.talentPoints} 积分` : `学习 · ${def.cost} 积分`;
  return `<article class="talent-node${state.locked ? ' locked' : ''}${state.maxed ? ' maxed' : ''}">
    <header class="talent-node-header">${icon(def.icon, 32)}<h3>${def.name}</h3><button class="info-button" data-info-kind="talent" data-info-id="${def.id}" aria-label="查看${def.name}详情">i</button></header>
    <p class="talent-benefit">${def.description.replace('永久', '')}</p>
    <div class="talent-ranks" aria-label="已学习 ${state.rank} 级，共 ${state.maxRank} 级">${Array.from({ length: state.maxRank }, (_, index) => `<span${index < state.rank ? ' class="learned"' : ''}></span>`).join('')}<small>${state.rank} / ${state.maxRank}</small></div>
    <button class="${state.canBuy ? 'primary' : 'secondary'} talent-buy" data-talent="${def.id}" ${state.canBuy ? '' : 'disabled'}>${label}</button>
  </article>`;
}

/** 成长树只呈现登记节点，购买与前置判定由纯数据层完成。 */
export function renderMeta(profile: Profile, icon: Icon): string {
  return `<div class="growth-toolbar"><div class="growth-balance">${icon('star', 40)}<strong>${profile.talentPoints}</strong><span>成长积分</span></div><p>积分随抵达波次增加，通关额外奖励；主动结束不获积分。<br>学习后，下次出发时生效。</p></div>
    <div class="talent-tree">${Object.values(talentBranches).map(branch => `<section class="talent-branch"><h3 class="talent-branch-title">${branch.name}</h3><div class="talent-nodes">${Object.values(talents).filter(def => def.branch === branch.id).map(def => renderNode(profile, def, icon)).join('')}</div></section>`).join('')}</div>`;
}
