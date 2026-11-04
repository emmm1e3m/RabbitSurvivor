import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { Sfx } from '../core/Sfx';

interface GameOverData {
  wave: number;
  kills: number;
  victory: boolean;
}

export class GameOverScene extends Phaser.Scene {
  private result!: GameOverData;

  constructor() {
    super(SCENE_KEYS.GameOver);
  }

  init(data: GameOverData): void {
    this.result = data;
  }

  create(): void {
    if (this.result.victory) Sfx.victory();
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78);

    const title = this.result.victory ? '通关！' : '游戏结束';
    const titleColor = this.result.victory ? '#51cf66' : '#ff6b6b';

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 110, title, {
        fontSize: '64px',
        fontStyle: 'bold',
        color: titleColor
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        `到达第 ${this.result.wave} 波 · 击杀 ${this.result.kills} 个敌人`,
        { fontSize: '26px', color: COLORS.textLight }
      )
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 100, '按 Enter 选择角色', {
        fontSize: '24px',
        color: COLORS.textDim
      })
      .setOrigin(0.5);

    this.input.keyboard!.once('keydown-ENTER', () => {
      Sfx.ui();
      this.scene.stop(SCENE_KEYS.Game);
      this.scene.start(SCENE_KEYS.CharacterSelect);
    });
  }
}
