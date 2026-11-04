import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { MetaProgress } from '../core/MetaProgress';
import { Sfx } from '../core/Sfx';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Menu);
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const stats = MetaProgress.stats;

    this.add
      .text(cx, GAME_HEIGHT / 2 - 130, 'RABBIT 幸存者', {
        fontSize: '64px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0.5);

    this.add
      .text(
        cx,
        GAME_HEIGHT / 2 - 60,
        `星尘 ${MetaProgress.stardust} · 完成 ${stats.runs} 局 · 最佳第 ${stats.bestWave} 波`,
        { fontSize: '18px', color: COLORS.gold }
      )
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT / 2 + 15, '按 Enter 开始', {
        fontSize: '28px',
        color: COLORS.textDim
      })
      .setOrigin(0.5);

    this.createButton(cx - 140, GAME_HEIGHT / 2 + 105, '天赋树  T', () => this.openMeta());
    this.createButton(cx + 140, GAME_HEIGHT / 2 + 105, '图鉴/成就  C', () => this.openCodex());

    this.add
      .text(cx, GAME_HEIGHT - 42, '天赋、成就与图鉴进度自动保存到本地', {
        fontSize: '15px',
        color: COLORS.textDim
      })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-ENTER', () => {
      Sfx.ui();
      this.scene.start(SCENE_KEYS.CharacterSelect);
    });
    keyboard.on('keydown-T', () => this.openMeta());
    keyboard.on('keydown-C', () => this.openCodex());
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const button = this.add
      .rectangle(x, y, 220, 54, 0x232638)
      .setStrokeStyle(2, 0x3a3f5c)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, { fontSize: '20px', color: COLORS.textLight })
      .setOrigin(0.5);

    button.on('pointerover', () => button.setFillStyle(0x2e3350));
    button.on('pointerout', () => button.setFillStyle(0x232638));
    button.on('pointerdown', onClick);
  }

  private openMeta(): void {
    Sfx.ui();
    this.scene.start(SCENE_KEYS.Meta);
  }

  private openCodex(): void {
    Sfx.ui();
    this.scene.start(SCENE_KEYS.Codex);
  }
}
