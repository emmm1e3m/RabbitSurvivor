import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { RunData } from '../core/RunData';
import { Sfx } from '../core/Sfx';
import { GameScene } from './GameScene';

export class PauseScene extends Phaser.Scene {
  private closed = false;

  constructor() {
    super(SCENE_KEYS.Pause);
  }

  create(): void {
    this.closed = false;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 560, 440, 0x1a1c26)
      .setStrokeStyle(2, 0x3a3f5c);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 165, '游戏已暂停', {
        fontSize: '40px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0.5);

    const game = this.scene.get(SCENE_KEYS.Game) as GameScene;
    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 118,
        `${RunData.character.name} · 第 ${game.currentWave} 波 · 小怪 ${RunData.normalKills} · 精英 ${RunData.eliteKills}`,
        { fontSize: '18px', color: COLORS.textDim }
      )
      .setOrigin(0.5);

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.createButton(cx - 130, cy - 32, '继续游戏', 0x2f6f4f, 0x51cf66, () => this.resumeGame());
    this.createButton(cx + 130, cy - 32, '重新开始', 0x2e4a6b, 0x4da3ff, () => this.restartGame());
    this.createButton(cx - 130, cy + 44, '结束游戏', 0x7a2b2b, 0xff6b6b, () => this.endGame());
    this.createButton(cx + 130, cy + 44, '退出游戏', 0x232638, 0x3a3f5c, () => this.exitToMenu());

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 168, '按 ESC / P 继续', {
        fontSize: '16px',
        color: COLORS.textDim
      })
      .setOrigin(0.5);

    this.input.keyboard!.on('keydown-ESC', () => this.resumeGame());
    this.input.keyboard!.on('keydown-P', () => this.resumeGame());
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
      .rectangle(x, y, 240, 56, fill)
      .setStrokeStyle(2, stroke)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(x, y, label, { fontSize: '22px', color: COLORS.textLight })
      .setOrigin(0.5);

    button.on('pointerover', () => button.setAlpha(0.8));
    button.on('pointerout', () => button.setAlpha(1));
    button.on('pointerdown', onClick);
  }

  private resumeGame(): void {
    if (this.closed) return;
    this.closed = true;
    Sfx.ui();

    this.scene.resume(SCENE_KEYS.Game);
    this.scene.stop();
  }

  /** 重新开始：沿用当前角色，清空进度重开一局 */
  private restartGame(): void {
    if (this.closed) return;
    this.closed = true;
    Sfx.ui();

    RunData.startRun(RunData.character);
    this.scene.stop(SCENE_KEYS.Game);
    this.scene.start(SCENE_KEYS.Game);
  }

  private endGame(): void {
    if (this.closed) return;
    this.closed = true;
    Sfx.ui();

    const game = this.scene.get(SCENE_KEYS.Game) as GameScene;
    const wave = game.currentWave;
    this.scene.stop(SCENE_KEYS.Game);
    this.scene.start(SCENE_KEYS.GameOver, {
      wave,
      normalKills: RunData.normalKills,
      eliteKills: RunData.eliteKills,
      victory: false
    });
  }

  /** 退出游戏：回到主菜单 */
  private exitToMenu(): void {
    if (this.closed) return;
    this.closed = true;
    Sfx.ui();

    this.scene.stop(SCENE_KEYS.Game);
    this.scene.start(SCENE_KEYS.Menu);
  }
}
