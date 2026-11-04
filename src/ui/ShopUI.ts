import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { RunData } from '../core/RunData';
import { Sfx } from '../core/Sfx';
import { ShopOffer, ShopSystem } from '../systems/ShopSystem';
import { SHOP } from '../data/balance';
import { EFFECT_TRINKETS, STAT_TRINKETS } from '../data/trinkets';

const CARD_W = 280;
const CARD_H = 250;
const CARD_GAP = 20;
const CARD_FILL = 0x232638;
const CARD_FILL_HOVER = 0x2e3350;
const CARD_FILL_SOLD = 0x1a1c26;
const DEFAULT_STROKE = 0x3a3f5c;
const LOCKED_STROKE = 0xffd23f;
const LOCK_W = 96;
const LOCK_H = 30;

const KIND_LABEL: Record<ShopOffer['kind'], { text: string; color: string }> = {
  stat: { text: '数值饰品', color: '#4dd0e1' },
  effect: { text: '特效饰品', color: '#ff9f43' },
  weapon: { text: '武器', color: '#b44bd6' }
};

interface CardView {
  index: number;
  offer: ShopOffer;
  bg: Phaser.GameObjects.Rectangle;
  priceText: Phaser.GameObjects.Text;
  lockBg: Phaser.GameObjects.Rectangle;
  lockText: Phaser.GameObjects.Text;
  locked: boolean;
  disabled: boolean;
}

export class ShopUI {
  private goldText: Phaser.GameObjects.Text;
  private cardsLayer: Phaser.GameObjects.Container;
  private cards: CardView[] = [];
  private rerollText!: Phaser.GameObjects.Text;
  private ownedText!: Phaser.GameObjects.Text;
  private confirmLayer: Phaser.GameObjects.Container | null = null;
  private pendingCard: CardView | null = null;

  constructor(
    private scene: Phaser.Scene,
    private shop: ShopSystem,
    offers: ShopOffer[],
    private onNextWave: () => void
  ) {
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8);

    scene.add
      .text(GAME_WIDTH / 2, 64, '商 店', {
        fontSize: '44px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0.5);

    scene.add
      .text(GAME_WIDTH / 2, 112, '购买饰品强化自己 · 点击「锁定」可保留到下一波商店', {
        fontSize: '18px',
        color: COLORS.textDim
      })
      .setOrigin(0.5);

    this.goldText = scene.add
      .text(GAME_WIDTH - 60, 64, '', { fontSize: '28px', color: COLORS.gold })
      .setOrigin(1, 0.5);

    this.createOwnedPanel();
    this.cardsLayer = scene.add.container(0, 0).setDepth(1);
    this.createRerollButton();
    this.createNextWaveButton();
    this.renderOffers(offers);
    this.refresh();
  }

  /** 左下角：本次冒险已购买的饰品与堆叠层数 */
  private createOwnedPanel(): void {
    const scene = this.scene;
    scene.add
      .rectangle(40, GAME_HEIGHT - 232, 700, 142, 0x1a1c26, 0.6)
      .setOrigin(0, 0)
      .setStrokeStyle(2, DEFAULT_STROKE);
    scene.add
      .text(60, GAME_HEIGHT - 214, '已购饰品', { fontSize: '18px', color: COLORS.textDim })
      .setOrigin(0, 0);

    this.ownedText = scene.add
      .text(60, GAME_HEIGHT - 182, '', {
        fontSize: '16px',
        color: COLORS.textLight,
        lineSpacing: 8,
        wordWrap: { width: 660 }
      })
      .setOrigin(0, 0);
  }

  private ownedSummary(): string {
    const parts: string[] = [];
    for (const def of STAT_TRINKETS) {
      const count = RunData.trinketCounts.get(def.id) ?? 0;
      if (count > 0) parts.push(`${def.name} ×${count}`);
    }
    for (const def of EFFECT_TRINKETS) {
      const count = RunData.trinketCounts.get(def.id) ?? 0;
      if (count > 0) parts.push(`${def.name} ×${count}`);
    }
    return parts.length > 0 ? parts.join('    ') : '尚未购买任何饰品';
  }

  private renderOffers(offers: ShopOffer[]): void {
    this.cardsLayer.removeAll(true);
    this.cards = [];

    offers.forEach((offer, i) => {
      const x = GAME_WIDTH / 2 + (i - (SHOP.slots - 1) / 2) * (CARD_W + CARD_GAP);
      const y = 340;
      this.createCard(offer, i, x, y);
    });
  }

  private createCard(offer: ShopOffer, index: number, x: number, y: number): void {
    const scene = this.scene;
    const locked = this.shop.isLocked(index);

    const bg = scene.add
      .rectangle(x, y, CARD_W, CARD_H, CARD_FILL)
      .setStrokeStyle(2, locked ? LOCKED_STROKE : DEFAULT_STROKE)
      .setInteractive({ useHandCursor: true });

    const kindText = scene.add
      .text(x - CARD_W / 2 + 20, y - CARD_H / 2 + 18, KIND_LABEL[offer.kind].text, {
        fontSize: '15px',
        color: KIND_LABEL[offer.kind].color
      })
      .setOrigin(0, 0);

    const nameText = scene.add
      .text(x - CARD_W / 2 + 20, y - CARD_H / 2 + 46, offer.name, {
        fontSize: '28px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0, 0);

    const descText = scene.add
      .text(x - CARD_W / 2 + 20, y - CARD_H / 2 + 90, offer.description, {
        fontSize: '17px',
        color: COLORS.textDim,
        wordWrap: { width: CARD_W - 40 }
      })
      .setOrigin(0, 0);

    const priceText = scene.add
      .text(x + CARD_W / 2 - 20, y + CARD_H / 2 - 18, `${offer.cost} 金币`, {
        fontSize: '22px',
        color: COLORS.gold
      })
      .setOrigin(1, 1);

    const lockBg = scene.add
      .rectangle(x - CARD_W / 2 + 20 + LOCK_W / 2, y + CARD_H / 2 - 32, LOCK_W, LOCK_H, 0x2e3350)
      .setStrokeStyle(2, locked ? LOCKED_STROKE : DEFAULT_STROKE)
      .setInteractive({ useHandCursor: true });
    const lockText = scene.add
      .text(lockBg.x, lockBg.y, '', { fontSize: '16px', color: COLORS.textDim })
      .setOrigin(0.5);

    this.cardsLayer.add([bg, kindText, nameText, descText, priceText, lockBg, lockText]);

    const card: CardView = {
      index,
      offer,
      bg,
      priceText,
      lockBg,
      lockText,
      locked,
      disabled: false
    };
    this.syncLockVisual(card);

    bg.on('pointerover', () => {
      if (!card.disabled) bg.setFillStyle(CARD_FILL_HOVER);
    });
    bg.on('pointerout', () => {
      if (!card.disabled) bg.setFillStyle(CARD_FILL);
    });
    bg.on('pointerdown', () => this.openConfirm(card));

    lockBg.on('pointerover', () => lockBg.setAlpha(0.8));
    lockBg.on('pointerout', () => lockBg.setAlpha(1));
    lockBg.on('pointerdown', () => {
      if (card.disabled) return;
      Sfx.ui();
      this.shop.toggleLock(index, offer);
      card.locked = !card.locked;
      this.syncLockVisual(card);
    });

    this.cards.push(card);
  }

  private syncLockVisual(card: CardView): void {
    const stroke = card.locked ? LOCKED_STROKE : DEFAULT_STROKE;
    card.lockText.setText(card.locked ? '已锁定' : '锁定');
    card.lockText.setColor(card.locked ? COLORS.gold : COLORS.textDim);
    card.lockBg.setStrokeStyle(2, stroke);
    card.bg.setStrokeStyle(2, stroke);
  }

  /** 点击卡片先弹确认框，确认后才扣款 */
  private openConfirm(card: CardView): void {
    if (card.disabled) return;
    if (RunData.gold < card.offer.cost) return;

    Sfx.ui();
    this.closeConfirm();
    this.pendingCard = card;

    const scene = this.scene;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const layer = scene.add.container(0, 0).setDepth(10);

    const blocker = scene.add
      .rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55)
      .setInteractive();
    blocker.on('pointerdown', () => this.closeConfirm());

    const panel = scene.add
      .rectangle(cx, cy, 480, 300, 0x1a1c26)
      .setStrokeStyle(2, 0x3a3f5c);

    const title = scene.add
      .text(cx, cy - 108, '确认购买', {
        fontSize: '28px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0.5);

    const name = scene.add
      .text(cx, cy - 62, card.offer.name, {
        fontSize: '26px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0.5);

    const desc = scene.add
      .text(cx, cy - 22, card.offer.description, {
        fontSize: '16px',
        color: COLORS.textDim,
        wordWrap: { width: 400 }
      })
      .setOrigin(0.5);

    const price = scene.add
      .text(cx, cy + 12, `价格 ${card.offer.cost} 金币`, {
        fontSize: '18px',
        color: COLORS.gold
      })
      .setOrigin(0.5);

    const cancelButton = this.createModalButton(cx - 110, cy + 82, '取消', 0x2e3350, 0x3a3f5c, () => {
      Sfx.ui();
      this.closeConfirm();
    });
    const confirmButton = this.createModalButton(
      cx + 110,
      cy + 82,
      '确认购买',
      0x2f6f4f,
      0x51cf66,
      () => this.confirmPurchase()
    );

    layer.add([blocker, panel, title, name, desc, price, ...cancelButton, ...confirmButton]);
    this.confirmLayer = layer;
  }

  private confirmPurchase(): void {
    const card = this.pendingCard;
    if (!card) return;
    this.closeConfirm();
    this.purchaseCard(card);
  }

  private closeConfirm(): void {
    this.pendingCard = null;
    this.confirmLayer?.destroy(true);
    this.confirmLayer = null;
  }

  private createModalButton(
    x: number,
    y: number,
    label: string,
    fill: number,
    stroke: number,
    onClick: () => void
  ): Phaser.GameObjects.GameObject[] {
    const button = this.scene.add
      .rectangle(x, y, 160, 52, fill)
      .setStrokeStyle(2, stroke)
      .setInteractive({ useHandCursor: true });
    const text = this.scene.add
      .text(x, y, label, { fontSize: '22px', color: COLORS.textLight })
      .setOrigin(0.5);

    button.on('pointerover', () => button.setAlpha(0.8));
    button.on('pointerout', () => button.setAlpha(1));
    button.on('pointerdown', onClick);
    return [button, text];
  }

  private purchaseCard(card: CardView): void {
    if (card.disabled) return;
    if (!this.shop.buy(card.offer, card.index)) return;
    Sfx.buy();

    // 本次进店每张卡限购一次，刷新后可再次购买；购买后解除锁定
    card.disabled = true;
    card.bg.setFillStyle(CARD_FILL_SOLD);
    card.bg.setStrokeStyle(2, DEFAULT_STROKE);
    card.bg.disableInteractive();
    card.priceText.setText('售罄').setColor(COLORS.textDim);
    card.lockBg.setVisible(false).disableInteractive();
    card.lockText.setVisible(false);

    this.refresh();
  }

  private refresh(): void {
    this.goldText.setText(`金币 ${RunData.gold}`);
    this.ownedText.setText(this.ownedSummary());
    for (const card of this.cards) {
      if (card.disabled) continue;
      card.priceText.setColor(RunData.gold >= card.offer.cost ? COLORS.gold : '#ff6b6b');
    }
    this.rerollText.setText(`刷新  ${this.shop.rerollCost} 金币`);
    this.rerollText.setColor(
      RunData.gold >= this.shop.rerollCost ? COLORS.textLight : '#ff6b6b'
    );
  }

  private tryReroll(): void {
    const offers = this.shop.reroll();
    if (!offers) return;
    Sfx.ui();
    this.renderOffers(offers);
    this.refresh();
  }

  private createRerollButton(): void {
    const x = GAME_WIDTH - 440;
    const y = GAME_HEIGHT - 56;

    const button = this.scene.add
      .rectangle(x, y, 220, 60, 0x2e3350)
      .setStrokeStyle(2, 0x3a3f5c)
      .setInteractive({ useHandCursor: true });

    this.rerollText = this.scene.add
      .text(x, y, '', { fontSize: '20px', color: COLORS.textLight })
      .setOrigin(0.5);

    button.on('pointerover', () => button.setFillStyle(0x3a3f5c));
    button.on('pointerout', () => button.setFillStyle(0x2e3350));
    button.on('pointerdown', () => this.tryReroll());
  }

  private createNextWaveButton(): void {
    const x = GAME_WIDTH - 180;
    const y = GAME_HEIGHT - 56;

    const button = this.scene.add
      .rectangle(x, y, 260, 60, 0x2f6f4f)
      .setStrokeStyle(2, 0x51cf66)
      .setInteractive({ useHandCursor: true });

    this.scene.add
      .text(x, y, '开始下一波 ▶', {
        fontSize: '24px',
        color: COLORS.textLight
      })
      .setOrigin(0.5);

    button.on('pointerover', () => button.setFillStyle(0x3a8a63));
    button.on('pointerout', () => button.setFillStyle(0x2f6f4f));
    button.on('pointerdown', () => {
      Sfx.ui();
      this.onNextWave();
    });

    this.scene.add
      .text(40, GAME_HEIGHT - 56, '按 Enter 开始下一波', {
        fontSize: '16px',
        color: COLORS.textDim
      })
      .setOrigin(0, 0.5);
  }
}
