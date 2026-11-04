import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { Sfx } from '../core/Sfx';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Menu);
  }

  create(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'RABBIT 幸存者', {
        fontSize: '64px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, '按 Enter 开始', {
        fontSize: '28px',
        color: COLORS.textDim
      })
      .setOrigin(0.5);

    this.input.keyboard!.once('keydown-ENTER', () => {
      Sfx.ui();
      this.scene.start(SCENE_KEYS.CharacterSelect);
    });
  }
}
