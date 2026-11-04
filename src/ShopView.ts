import { items } from './game/content';
import type { Session } from './game/Session';
import type { ItemDef, ShopOffer, StatKey } from './game/types';

type IconRenderer = (name: string, size?: number, extra?: string) => string;

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const number = (value: number): string => Number(value.toFixed(2)).toString();
const percent = (value: number): string => `${number(value * 100)}%`;

const statLabels: Record<StatKey, string> = {
  damage: '苹果伤害', attackSpeed: '攻击速度', maxHp: '生命上限',
  armor: '护甲', regen: '每秒回复', crit: '暴击率', moveSpeed: '移动速度'
};
const percentageStats = new Set<StatKey>(['damage', 'attackSpeed', 'crit', 'moveSpeed']);

/** 卡片只列直接收益，完整规则交给共用详情面板。 */
function itemBenefits(def: ItemDef, session: Session): string[] {
  if (def.action) {
    if (def.action.kind === 'heal') return [`回复 ${number(def.action.amount)} 生命`];
    if (def.action.kind === 'invulnerable') return [`无敌 ${number(def.action.amount)} 秒`];
    return [`范围伤害 ${number(def.action.amount)} + 攻击 ×${number(def.action.damageScale ?? 0)}`];
  }

  const benefits = Object.entries(def.statBonuses ?? {}).map(([key, value]) => {
    const stat = key as StatKey;
    return `${statLabels[stat]} +${percentageStats.has(stat) ? percent(value) : number(value)}`;
  });
  for (const [key, value] of Object.entries(def.effectBonuses ?? {})) {
    if (key === 'multishot') benefits.push(session.melee ? `连击 +${number(value)} 段` : `弹丸 +${number(value)} 枚`);
    else if (key === 'pierce') benefits.push(session.melee ? `每段目标 +${number(value)} · 范围 +${number(value * 8)}` : `穿透 +${number(value)} 次`);
    else if (key === 'explosion') benefits.push(`击杀爆炸 +${percent(value)}`);
    else if (key === 'lifesteal') benefits.push(`击杀回复 +${number(value)} 生命`);
    else if (key === 'pickupRange') benefits.push(`拾取范围 +${number(value)}`);
  }
  return benefits.length ? benefits.slice(0, 2) : [def.description.split(/[。；]/)[0].replace(/^一次性[：:]/, '')];
}

function purchaseState(session: Session, offer: ShopOffer): { disabled: boolean; label: string; sold: boolean } {
  if (offer.sold) return { disabled: true, label: '已买下', sold: true };
  if (offer.kind === 'weapon' && session.weaponLevel >= 5) return { disabled: true, label: '已满级', sold: false };
  if (offer.itemId) {
    const def = items[offer.itemId];
    if (def.kind === 'equipment' && (session.equipment[def.id] ?? 0) >= def.maxStacks) return { disabled: true, label: '已达上限', sold: false };
    if (def.maxPerRun !== undefined && (session.acquired[def.id] ?? 0) >= def.maxPerRun) return { disabled: true, label: '本局已获得', sold: false };
    if (def.kind === 'consumable' && !session.inventory.includes(null)) return { disabled: true, label: '道具栏已满', sold: false };
  }
  if (session.player.coins < offer.price) return { disabled: true, label: `还差 ${Math.ceil(offer.price - session.player.coins)} 币`, sold: false };
  return { disabled: false, label: '买下', sold: false };
}

function renderCard(session: Session, offer: ShopOffer, icon: IconRenderer): string {
  const def = offer.itemId ? items[offer.itemId] : undefined;
  const state = purchaseState(session, offer);
  const benefits = def ? itemBenefits(def, session) : ['基础苹果伤害 +20%'];
  const kind = offer.kind === 'weapon' ? '武器强化' : offer.kind === 'consumable' ? '一次性道具' : '随身饰品';
  const infoKind = def ? 'item' : 'weapon';
  const infoId = def?.id ?? 'current';
  return `<article class="shop-card${state.sold ? ' sold' : ''}">
    <header class="shop-card-header">
      ${icon(def?.icon ?? 'sword', 56)}
      <button class="shop-info-button" type="button" data-info-kind="${infoKind}" data-info-id="${escapeHtml(infoId)}" aria-label="查看${escapeHtml(offer.name)}详情">i</button>
    </header>
    <h3>${escapeHtml(offer.name)}</h3>
    <span class="shop-card-kind">${kind}</span>
    <p class="shop-card-benefit">${benefits.map(escapeHtml).join('<br>')}</p>
    <footer class="shop-card-footer">
      <strong class="shop-card-price">${icon('cookie', 22)}${number(offer.price)}</strong>
      <button class="shop-buy-button${state.disabled ? '' : ' primary'}" type="button" data-buy="${escapeHtml(offer.id)}" ${state.disabled ? 'disabled' : ''}>${state.label}</button>
    </footer>
  </article>`;
}

function renderOwned(session: Session, icon: IconRenderer): string {
  const equipment = Object.entries(session.equipment).filter(([, count]) => count > 0).map(([id, count]) => {
    const def = items[id];
    return `<button class="shop-owned-chip" type="button" data-info-kind="item" data-info-id="${escapeHtml(id)}" aria-label="查看${escapeHtml(def.name)}详情">${icon(def.icon, 26)}<span>${escapeHtml(def.name)}</span>${count > 1 ? `<b>×${count}</b>` : ''}</button>`;
  });
  const consumables = session.inventory.flatMap(id => id ? [`<button class="shop-owned-chip consumable" type="button" data-info-kind="item" data-info-id="${escapeHtml(id)}" aria-label="查看${escapeHtml(items[id].name)}详情">${icon(items[id].icon, 26)}<span>${escapeHtml(items[id].name)}</span></button>`] : []);
  const owned = [...equipment, ...consumables];
  return owned.length ? `<section class="shop-owned" aria-label="已持有道具"><span class="shop-owned-label">已持有</span><div class="shop-owned-list">${owned.join('')}</div></section>` : '';
}

/** 商店只读取本局数据；所有消费仍交给 Session 的购买和刷新入口。 */
export function renderShop(session: Session, icon: IconRenderer): string {
  const used = session.inventory.filter(Boolean).length;
  return `<div class="shop-view">
    <div class="shop-toolbar">
      <div><p class="shop-stage-label">第 ${session.wave} 波完成</p><p class="shop-balance">${icon('cookie', 36)}<strong>${Math.floor(session.player.coins)}</strong><span>饼干币</span></p></div>
      <p class="shop-capacity">道具栏 <strong>${used} / ${session.inventory.length}</strong></p>
    </div>
    <div class="shop-cards">${session.shop.map(offer => renderCard(session, offer, icon)).join('')}</div>
    ${renderOwned(session, icon)}
    <footer class="shop-actions">
      <button class="secondary" type="button" data-action="reroll" ${session.player.coins < session.rerollCost ? 'disabled' : ''}>换一批 <span class="shop-refresh-price">${session.rerollCost} 币</span></button>
      <button class="primary" type="button" data-action="next">下一波 <span class="action-key">Enter</span></button>
    </footer>
  </div>`;
}
