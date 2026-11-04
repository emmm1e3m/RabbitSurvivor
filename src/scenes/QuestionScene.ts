import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { EventBus, Events } from '../core/EventBus';
import { RunData } from '../core/RunData';
import { Sfx } from '../core/Sfx';
import { QUESTION_CHOICES, QuestionChoiceDef } from '../data/questions';

const CARD_W = 560;
const CARD_H = 170;

interface QuestionData {
  /** 当前是本次波后第几个问号（0 起） */
  index?: number;
  /** 本次波后需要处理的小问号总数 */
  total?: number;
}

/** 波次结算后的问号事件：消耗 1 个小问号接受随机交易，或保留问号拒绝 */
export class QuestionScene extends Phaser.Scene {
  private closed = false;
  private offer: QuestionChoiceDef | null = null;
  private index = 0;
  private total = 1;

  constructor() {
    super(SCENE_KEYS.Question);
  }

  init(data: QuestionData = {}): void {
    this.index = data.index ?? 0;
    this.total = data.total ?? 1;
  }

  create(): void {
    this.closed = false;
    this.offer =
      QUESTION_CHOICES.length > 0 ? Phaser.Utils.Array.GetRandom(QUESTION_CHOICES) : null;

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.84);
    this.add
      .rectangle(cx, cy, 660, 440, 0x1a1c26)
      .setStrokeStyle(2, 0x8a6d1a);

    this.add
      .text(cx, cy - 168, '神秘问号', {
        fontSize: '40px',
        fontStyle: 'bold',
        color: COLORS.gold
      })
      .setOrigin(0.5);

    const counter = this.total > 1 ? `问号事件 ${this.index + 1}/${this.total} · ` : '';
    this.add
      .text(
        cx,
        cy - 120,
        `${counter}持有小问号 ×${RunData.questionMarks} · 接受会消耗 1 个，拒绝则保留`,
        { fontSize: '18px', color: COLORS.textDim }
      )
      .setOrigin(0.5);

    if (!this.offer) {
      this.finish();
      return;
    }

    this.add
      .rectangle(cx, cy - 20, CARD_W, CARD_H, 0x232638)
      .setStrokeStyle(2, 0xffd23f);
    this.add
      .text(cx, cy - 64, this.offer.name, {
        fontSize: '28px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0.5);
    this.add
      .text(cx, cy - 6, this.offer.description, {
        fontSize: '20px',
        color: '#ffd23f',
        align: 'center',
        wordWrap: { width: CARD_W - 60 }
      })
      .setOrigin(0.5);

    this.createButton(cx - 110, cy + 138, '拒绝', 0x2e3350, 0x3a3f5c, () => this.decline());
    this.createButton(cx + 110, cy + 138, '接受', 0x2f6f4f, 0x51cf66, () => this.accept());

    this.add
      .text(cx, cy + 192, '拒绝不会消耗小问号', {
        fontSize: '15px',
        color: COLORS.textDim
      })
      .setOrigin(0.5);

    this.input.keyboard!.on('keydown-ENTER', () => this.accept());
    this.input.keyboard!.on('keydown-ESC', () => this.decline());
    Sfx.question();
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    fill: number,
    stroke: number,
    onClick: () => void
  ): void {
    const button = this.add
      .rectangle(x, y, 160, 52, fill)
      .setStrokeStyle(2, stroke)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, { fontSize: '22px', color: COLORS.textLight })
      .setOrigin(0.5);

    button.on('pointerover', () => button.setAlpha(0.8));
    button.on('pointerout', () => button.setAlpha(1));
    button.on('pointerdown', onClick);
  }

  private accept(): void {
    if (this.closed || !this.offer || RunData.questionMarks <= 0) return;
    this.closed = true;
    RunData.questionMarks--;
    this.offer.apply();
    Sfx.buy();
    this.finish();
  }

  private decline(): void {
    if (this.closed) return;
    this.closed = true;
    Sfx.ui();
    this.finish();
  }

  private finish(): void {
    // 先停止再通知：否则同一帧内 GameScene 重新 launch 本场景的 start 会排在 stop 之前被取消
    this.scene.stop();
    EventBus.emit(Events.QuestionClosed);
  }
}
