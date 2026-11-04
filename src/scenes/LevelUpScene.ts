import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { AttrKey } from '../core/AttributeSystem';
import { EventBus, Events } from '../core/EventBus';
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

  constructor() {
    super(SCENE_KEYS.LevelUp);
  }

  create(): void {
    this.closed = false;
    this.cards = [];
    this.cardObjects = [];
    this.selected = null;

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
      .text(cx, 148, '从随机属性中三选一，品质决定数值档位', {
        fontSize: '18px',
        color: COLORS.textDim
      })
      .setOrigin(0.5);

    this.renderOffers();
    this.createConfirmButton(cx, 608);
    this.input.keyboard!.on('keydown-ENTER', () => this.confirm());
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
      const rarity = this.rollRarity();
      const offer: LevelOffer = { def, rarity, value: def.value * rarity.mult };
      this.createCard(offer, i, cx, 242 + i * 108);
    }
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

  private createConfirmButton(x: number, y: number): void {
    const button = this.add
      .rectangle(x, y, 260, 56, 0x2f6f4f)
      .setStrokeStyle(2, 0x51cf66)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, '确认属性', { fontSize: '24px', color: COLORS.textLight })
      .setOrigin(0.5);

    button.on('pointerover', () => button.setFillStyle(0x3a8a63));
    button.on('pointerout', () => button.setFillStyle(0x2f6f4f));
    button.on('pointerdown', () => this.confirm());
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

    // 一次获得多级时在同一页面连续选择，每次都重新抽一组
    if (RunData.pendingLevelUps > 0) {
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
