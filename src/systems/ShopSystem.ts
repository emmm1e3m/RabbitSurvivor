import { RunData } from '../core/RunData';
import { EventBus, Events } from '../core/EventBus';
import { AttrKey } from '../core/AttributeSystem';
import { SHOP, WEAPON } from '../data/balance';
import {
  EFFECT_TRINKETS,
  EffectTrinketDef,
  STAT_TRINKETS,
  StatTrinketDef
} from '../data/trinkets';

export interface ShopOffer {
  id: string;
  kind: 'stat' | 'effect' | 'weapon';
  name: string;
  description: string;
  cost: number;
  stat?: StatTrinketDef;
  effect?: EffectTrinketDef;
}

/** 商店数据逻辑（与渲染分离）：roll 4 张不重复卡片，购买直接改写 RunData */
export class ShopSystem {
  private rerollsDone = 0;
  /** 本次刷新批次内已售出的商品 id（刷新后重置） */
  private sold = new Set<string>();

  /** 下一次刷新的价格 */
  get rerollCost(): number {
    return SHOP.rerollCost(this.rerollsDone);
  }

  /** 花费金币刷新未锁定栏位；金币不足或全部栏位已锁定时返回 null */
  reroll(): ShopOffer[] | null {
    const cost = this.rerollCost;
    if (RunData.shopLocks.every((lock) => lock !== null)) return null;
    if (RunData.gold < cost) return null;

    RunData.gold -= cost;
    this.rerollsDone++;
    this.sold.clear();
    EventBus.emit(Events.GoldChanged, RunData.gold);
    return this.rollOffers();
  }

  isLocked(index: number): boolean {
    return RunData.shopLocks[index] != null;
  }

  /** 切换栏位锁定：锁定后刷新与下一波商店都会保留该商品 */
  toggleLock(index: number, offer: ShopOffer): void {
    RunData.shopLocks[index] = RunData.shopLocks[index] ? null : offer;
  }

  /** 特效饰品是否已达堆叠上限 */
  isMaxed(offer: ShopOffer): boolean {
    if (offer.kind !== 'effect' || !offer.effect || offer.effect.maxStacks === undefined) {
      return false;
    }
    return RunData.getEffect(offer.effect.effect) >= offer.effect.maxStacks;
  }

  rollOffers(): ShopOffer[] {
    const offers: Array<ShopOffer | null> = new Array(SHOP.slots).fill(null);
    const used = new Set<string>();

    // 锁定栏位固定展示原商品，其余栏位重新掷骰
    for (let i = 0; i < SHOP.slots; i++) {
      const locked = RunData.shopLocks[i];
      if (locked) {
        offers[i] = locked;
        used.add(locked.id);
      }
    }

    let guard = 0;
    for (let i = 0; i < SHOP.slots; i++) {
      if (offers[i]) continue;
      while (!offers[i] && guard++ < 100) {
        const roll = Math.random();
        let offer: ShopOffer | null;

        if (roll < SHOP.weights.statTrinket) {
          offer = this.statOffer(used);
        } else if (roll < SHOP.weights.statTrinket + SHOP.weights.effectTrinket) {
          offer = this.effectOffer(used) ?? this.statOffer(used);
        } else {
          offer = this.weaponOffer(used) ?? this.statOffer(used);
        }

        if (offer) {
          offers[i] = offer;
          used.add(offer.id);
        }
      }
    }
    return offers as ShopOffer[];
  }

  buy(offer: ShopOffer, slotIndex: number): boolean {
    if (this.sold.has(offer.id)) return false;
    if (this.isMaxed(offer)) return false;
    if (RunData.gold < offer.cost) return false;
    RunData.gold -= offer.cost;
    this.sold.add(offer.id);
    // 买走锁定商品后解除锁定，避免下一波重复出现已购商品
    if (RunData.shopLocks[slotIndex]?.id === offer.id) {
      RunData.shopLocks[slotIndex] = null;
    }

    if (offer.kind === 'stat' && offer.stat) {
      const def = offer.stat;
      const count = (RunData.trinketCounts.get(def.id) ?? 0) + 1;
      RunData.trinketCounts.set(def.id, count);
      RunData.attributes.addModifier({
        id: `stat:${def.id}:${count}`,
        key: def.attr,
        type: def.mode,
        value: def.value
      });
      if (def.attr === AttrKey.MaxHP) {
        RunData.pendingHeal += def.value;
      }
    } else if (offer.kind === 'effect' && offer.effect) {
      const def = offer.effect;
      RunData.trinketCounts.set(def.id, (RunData.trinketCounts.get(def.id) ?? 0) + 1);
      RunData.addEffect(def.effect);
    } else if (offer.kind === 'weapon') {
      RunData.weaponLevel = Math.min(WEAPON.maxLevel, RunData.weaponLevel + 1);
    }

    EventBus.emit(Events.ShopPurchased, offer);
    EventBus.emit(Events.GoldChanged, RunData.gold);
    return true;
  }

  private statOffer(used: Set<string>): ShopOffer | null {
    const pool = STAT_TRINKETS.filter((def) => !used.has(`stat:${def.id}`));
    if (pool.length === 0) return null;
    const def = pool[Math.floor(Math.random() * pool.length)];

    return {
      id: `stat:${def.id}`,
      kind: 'stat',
      name: def.name,
      description: def.description,
      cost: def.price,
      stat: def
    };
  }

  private effectOffer(used: Set<string>): ShopOffer | null {
    const pool = EFFECT_TRINKETS.filter((def) => {
      if (used.has(`effect:${def.id}`)) return false;
      if (def.maxStacks !== undefined && RunData.getEffect(def.effect) >= def.maxStacks) {
        return false;
      }
      return true;
    });
    if (pool.length === 0) return null;
    const def = pool[Math.floor(Math.random() * pool.length)];

    return {
      id: `effect:${def.id}`,
      kind: 'effect',
      name: def.name,
      description: def.description,
      cost: def.price,
      effect: def
    };
  }

  private weaponOffer(used: Set<string>): ShopOffer | null {
    if (used.has('weapon')) return null;

    const level = RunData.weaponLevel;
    if (level >= WEAPON.maxLevel) return null;

    return {
      id: 'weapon',
      kind: 'weapon',
      name: '武器升级',
      description: `伤害 +30%（Lv.${level} → Lv.${level + 1}）`,
      cost: WEAPON.upgradeCost(level)
    };
  }
}
