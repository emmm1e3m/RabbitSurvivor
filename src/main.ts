import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, DEBUG } from './config';
import { RunData } from './core/RunData';
import { MetaProgress } from './core/MetaProgress';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { MetaScene } from './scenes/MetaScene';
import { CodexScene } from './scenes/CodexScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { GameScene } from './scenes/GameScene';
import { ShopScene } from './scenes/ShopScene';
import { LevelUpScene } from './scenes/LevelUpScene';
import { QuestionScene } from './scenes/QuestionScene';
import { PauseScene } from './scenes/PauseScene';
import { GameOverScene } from './scenes/GameOverScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.bg,
  scene: [
    BootScene,
    MenuScene,
    MetaScene,
    CodexScene,
    CharacterSelectScene,
    GameScene,
    ShopScene,
    LevelUpScene,
    QuestionScene,
    PauseScene,
    GameOverScene
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    antialias: true
  }
});

// 调试模式暴露真实单例，供无头冒烟脚本读取/注入状态
if (DEBUG) {
  (window as unknown as Record<string, unknown>).__rabbit = { game, RunData, MetaProgress };
}
