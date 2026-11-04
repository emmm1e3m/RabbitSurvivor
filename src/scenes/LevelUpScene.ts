import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { AttrKey } from '../core/AttributeSystem';
import { EventBus, Events } from '../core/EventBus';
import { MetaProgress } from '../core/MetaProgress';
import { RunData } from '../core/RunData';
import { Sfx } from '../core/Sfx';
import { LEVEL } from '../data/balance';
import { STAT_TRINKETS, StatTrinketDef } from '../data/trinkets';

const CARD_W = 520;
const CARD_H = 96;
const CARD_FILL = 0x232638;
const CARD_FILL_HOVER = 0x2e3350;
const SELECTED_STROKE = 0xffffff;

type LevelRarity = (typeof LEVEL.rarities)[number];

interface LevelOffer {
  def: StatTrinketDef;
  rarity: LevelRarity;
  /** 已按品质倍率缩放后的属性数值 */
  value: number;
}

interface CardView {
  offer: LevelOffer;
  bg: Phaser.GameObjects.Rectangle;
}

/** 属性数值的展示名与是否按百分比显示 */
const STAT_LABELS: Record<AttrKey, { label: string; percent?: boolean }> = {
  [AttrKey.MaxHP]: { label: '生命上限' },
  [AttrKey.HPRegen]: { label: '每秒回复' },
  [AttrKey.Damage]: { label: '伤害', percent: true },
  [AttrKey.AttackSpeed]: { label: '攻击速度', percent: true },
  [AttrKey.CritChance]: { label: '暴击率', percent: true },
  [AttrKey.Armor]: { label: '护甲' },
  [AttrKey.Dodge]: { label: '闪避率', percent: true },
  [AttrKey.MoveSpeed]: { label: '移动速度', percent: true },
  [AttrKey.PickupRange]: { label: '拾取范围' },
  [AttrKey.Range]: { label: '攻击范围' }
};

function formatAmount(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** 升级加点：随机抽出 3 种属性（数值按品质缩放），三选一后确认继续 */
export class LevelUpScene extends Phaser.Scene {
  private closed = false;
  private cards: CardView[] = [];
  private cardObjects: Phaser.GameObjects.GameObject[] = [];
  private selected: LevelOffer | null = null;
  private subtitle!: Phaser.GameObjects.Text;
  /** 本次升级内已刷新次数（决定下一次刷新费用，选中后重置） */
  private refreshCount = 0;
  private refreshLabel!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.LevelUp);
  }

  create(): void {
    this.closed = false;
    this.cards = [];
    this.cardObjects = [];
    this.selected = null;
    this.refreshCount = 0;

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.82);
    this.add
      .rectangle(cx, cy, 880, 640, 0x1a1c26)
      .setStrokeStyle(2, 0x3a3f5c);

    this.add
      .text(cx, 100, `升级！Lv.${RunData.level}`, {
        fontSize: '40px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0.5);

    this.subtitle = this.add
      .text(cx, 148, '随机三选一（品质决定数值档位），可花金币刷新', {
        fontSize: '18px',
        color: COLORS.textDim
      })
      .setOrigin(0.5);

    this.goldText = this.add
      .text(cx + 400, 100, '', { fontSize: '18px', color: COLORS.gold })
      .setOrigin(1, 0.5);

    this.createActionButtons(cx, 608);
    this.renderOffers();
    this.input.keyboard!.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard!.on('keydown-R', () => this.refreshOffers());
  }

  /** 随机抽取不重复的属性并各自掷品质，重建三张卡片 */
  private renderOffers(): void {
    for (const obj of this.cardObjects) obj.destroy();
    this.cardObjects = [];
    this.cards = [];
    this.selected = null;

    const cx = GAME_WIDTH / 2;
    const pool = [...STAT_TRINKETS];
    for (let i = 0; i < LEVEL.optionCount && pool.length > 0; i++) {
      const def = pool.splice(Phaser.Math.Between(0, pool.length - 1), 1)[0];
      MetaProgress.discoverTrinket(`stat:${def.id}`);
      const rarity = this.rollRarity();
      const offer: LevelOffer = { def, rarity, value: def.value * rarity.mult };
      this.createCard(offer, i, cx, 242 + i * 108);
    }
    this.updateFooter();
  }

  /** 花金币重掷三个选项；费用随本次升级内的刷新次数递增 */
  private refreshOffers(): void {
    if (this.closed) return;
    const cost = LEVEL.refreshCost(this.refreshCount);
    if (RunData.gold < cost) {
      Sfx.ui();
      return;
    }
    RunData.addGold(-cost);
    EventBus.emit(Events.GoldChanged, RunData.gold);
    this.refreshCount++;
    Sfx.select();
    this.renderOffers();
  }

  private updateFooter(): void {
    const cost = LEVEL.refreshCost(this.refreshCount);
    const affordable = RunData.gold >= cost;
    this.refreshLabel.setText(affordable ? `刷新属性（${cost} 金币）` : `金币不足（需 ${cost}）`);
    this.refreshLabel.setColor(affordable ? COLORS.textLight : COLORS.textDim);
    this.goldText.setText(`金币 ${RunData.gold}`);
  }

  private rollRarity(): LevelRarity {
    let roll = Math.random();
    for (const rarity of LEVEL.rarities) {
      roll -= rarity.chance;
      if (roll < 0) return rarity;
    }
    return LEVEL.rarities[LEVEL.rarities.length - 1];
  }

  private bonusText(def: StatTrinketDef, value: number): string {
    const info = STAT_LABELS[def.attr];
    const shown = info.percent ? value * 100 : value;
    return `${info.label} +${formatAmount(shown)}${info.percent ? '%' : ''}`;
  }

  private createCard(offer: LevelOffer, index: number, x: number, y: number): void {
    const { def, rarity } = offer;
    const rarityCss = colorToCss(rarity.color);

    const bg = this.add
      .rectangle(x, y, CARD_W, CARD_H, CARD_FILL)
      .setStrokeStyle(2, rarity.color)
      .setInteractive({ useHandCursor: true });

    const name = this.add
      .text(x - CARD_W / 2 + 28, y - 22, def.name, {
        fontSize: '24px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0, 0.5);

    const rarityTag = this.add
      .text(x + CARD_W / 2 - 28, y - 22, rarity.name, {
        fontSize: '18px',
        fontStyle: 'bold',
        color: rarityCss
      })
      .setOrigin(1, 0.5);

    const bonus = this.add
      .text(x - CARD_W / 2 + 28, y + 22, this.bonusText(def, offer.value), {
        fontSize: '22px',
        fontStyle: 'bold',
        color: rarityCss
      })
      .setOrigin(0, 0.5);

    bg.on('pointerover', () => {
      if (this.selected !== offer) bg.setFillStyle(CARD_FILL_HOVER);
    });
    bg.on('pointerout', () => {
      if (this.selected !== offer) bg.setFillStyle(CARD_FILL);
    });
    bg.on('pointerdown', () => this.selectCard(index));

    this.cardObjects.push(bg, name, rarityTag, bonus);
    this.cards.push({ offer, bg });
  }

  private selectCard(index: number): void {
    if (this.closed) return;
    Sfx.select();
    this.selected = this.cards[index].offer;
    this.cards.forEach((card, i) => {
      const active = i === index;
      card.bg.setFillStyle(active ? CARD_FILL_HOVER : CARD_FILL);
      card.bg.setStrokeStyle(active ? 3 : 2, active ? SELECTED_STROKE : card.offer.rarity.color);
    });
  }

  private createActionButtons(x: number, y: number): void {
    const refreshBg = this.add
      .rectangle(x - 180, y, 300, 56, 0x2e3350)
      .setStrokeStyle(2, 0x4da3ff)
      .setInteractive({ useHandCursor: true });
    this.refreshLabel = this.add
      .text(x - 180, y, '', { fontSize: '21px', color: COLORS.textLight })
      .setOrigin(0.5);
    refreshBg.on('pointerover', () => refreshBg.setFillStyle(0x3a4058));
    refreshBg.on('pointerout', () => refreshBg.setFillStyle(0x2e3350));
    refreshBg.on('pointerdown', () => this.refreshOffers());

    const confirmBg = this.add
      .rectangle(x + 180, y, 260, 56, 0x2f6f4f)
      .setStrokeStyle(2, 0x51cf66)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x + 180, y, '确认属性', { fontSize: '24px', color: COLORS.textLight })
      .setOrigin(0.5);
    confirmBg.on('pointerover', () => confirmBg.setFillStyle(0x3a8a63));
    confirmBg.on('pointerout', () => confirmBg.setFillStyle(0x2f6f4f));
    confirmBg.on('pointerdown', () => this.confirm());
  }

  private confirm(): void {
    if (this.closed || !this.selected) return;
    Sfx.ui();

    const offer = this.selected;
    RunData.levelChoices++;
    RunData.attributes.addModifier({
      id: `level:${RunData.levelChoices}`,
      key: offer.def.attr,
      type: offer.def.mode,
      value: offer.value
    });
    if (offer.def.attr === AttrKey.MaxHP) RunData.pendingHeal += offer.value;
    RunData.pendingLevelUps = Math.max(0, RunData.pendingLevelUps - 1);

    // 一次获得多级时在同一页面连续选择，每次都重新抽一组（刷新费用也重置）
    if (RunData.pendingLevelUps > 0) {
      this.refreshCount = 0;
      this.renderOffers();
      this.subtitle.setText(`选择一项属性提升（剩余 ${RunData.pendingLevelUps} 次）`);
      return;
    }

    this.closed = true;
    EventBus.emit(Events.LevelUpClosed);
    this.scene.resume(SCENE_KEYS.Game);
    this.scene.stop();
  }
}
