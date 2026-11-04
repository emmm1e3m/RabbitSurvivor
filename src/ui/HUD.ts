import Phaser from 'phaser';
import { GAME_WIDTH, DEPTH, COLORS } from '../config';
import { RunData } from '../core/RunData';
import { LEVEL } from '../data/balance';
import { Player } from '../entities/Player';

const HP_BAR_WIDTH = 200;
const HP_BAR_HEIGHT = 18;
const XP_BAR_WIDTH = 200;
const XP_BAR_HEIGHT = 10;

export class HUD {
  private hpFill: Phaser.GameObjects.Rectangle;
  private hpText: Phaser.GameObjects.Text;
  private xpFill: Phaser.GameObjects.Rectangle;
  private levelText: Phaser.GameObjects.Text;
  private goldText: Phaser.GameObjects.Text;
  private waveText: Phaser.GameObjects.Text;
  private banner: Phaser.GameObjects.Container;
  private bannerText: Phaser.GameObjects.Text;
  private hideTimer?: Phaser.Time.TimerEvent;

  constructor(private scene: Phaser.Scene, onPause: () => void) {
    const depth = DEPTH.hud;

    // HUD 固定于屏幕：相机随玩家滚动时，所有元素 scrollFactor 为 0
    scene.add
      .rectangle(20, 20, HP_BAR_WIDTH + 4, HP_BAR_HEIGHT + 4, COLORS.hpBarBack)
      .setOrigin(0, 0)
      .setDepth(depth)
      .setScrollFactor(0);
    this.hpFill = scene.add
      .rectangle(22, 22, HP_BAR_WIDTH, HP_BAR_HEIGHT, COLORS.hpBarFill)
      .setOrigin(0, 0)
      .setDepth(depth)
      .setScrollFactor(0);
    this.hpText = scene.add
      .text(22 + HP_BAR_WIDTH + 12, 21, '', {
        fontSize: '18px',
        color: COLORS.textLight
      })
      .setDepth(depth)
      .setScrollFactor(0);

    scene.add
      .rectangle(20, 48, XP_BAR_WIDTH + 4, XP_BAR_HEIGHT + 4, COLORS.hpBarBack)
      .setOrigin(0, 0)
      .setDepth(depth)
      .setScrollFactor(0);
    this.xpFill = scene.add
      .rectangle(22, 50, XP_BAR_WIDTH, XP_BAR_HEIGHT, COLORS.player)
      .setOrigin(0, 0)
      .setDepth(depth)
      .setScrollFactor(0);
    this.levelText = scene.add
      .text(22 + XP_BAR_WIDTH + 12, 46, '', {
        fontSize: '15px',
        color: COLORS.textDim
      })
      .setDepth(depth)
      .setScrollFactor(0);

    this.goldText = scene.add
      .text(GAME_WIDTH - 72, 21, '', {
        fontSize: '20px',
        color: COLORS.gold
      })
      .setOrigin(1, 0)
      .setDepth(depth)
      .setScrollFactor(0);

    const pauseButton = scene.add
      .rectangle(GAME_WIDTH - 38, 40, 40, 40, 0x232638)
      .setStrokeStyle(2, 0x3a3f5c)
      .setDepth(depth)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    scene.add
      .rectangle(GAME_WIDTH - 44, 40, 6, 18, 0xeceff4)
      .setDepth(depth + 1)
      .setScrollFactor(0);
    scene.add
      .rectangle(GAME_WIDTH - 32, 40, 6, 18, 0xeceff4)
      .setDepth(depth + 1)
      .setScrollFactor(0);

    pauseButton.on('pointerover', () => pauseButton.setFillStyle(0x2e3350));
    pauseButton.on('pointerout', () => pauseButton.setFillStyle(0x232638));
    pauseButton.on('pointerdown', onPause);

    this.waveText = scene.add
      .text(GAME_WIDTH / 2, 20, '', {
        fontSize: '22px',
        color: COLORS.textLight
      })
      .setOrigin(0.5, 0)
      .setDepth(depth)
      .setScrollFactor(0);

    const bannerBg = scene.add.rectangle(0, 0, 460, 100, 0x000000, 0.72).setScrollFactor(0);
    this.bannerText = scene.add
      .text(0, 0, '', { fontSize: '30px', color: COLORS.textLight })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.banner = scene.add
      .container(GAME_WIDTH / 2, 200, [bannerBg, this.bannerText])
      .setDepth(DEPTH.banner)
      .setScrollFactor(0)
      .setVisible(false);
  }

  update(player: Player, wave: number, maxWave: number, timeLeft: number): void {
    const ratio = Phaser.Math.Clamp(player.hp / player.attributes.maxHp, 0, 1);
    this.hpFill.setScale(ratio, 1);
    this.hpText.setText(`${Math.ceil(player.hp)}/${Math.round(player.attributes.maxHp)}`);
    this.xpFill.setScale(Phaser.Math.Clamp(RunData.xp / LEVEL.xpToNext, 0, 1), 1);
    this.levelText.setText(`Lv.${RunData.level} · 经验 ${RunData.xp}/${LEVEL.xpToNext}`);
    this.goldText.setText(`金币 ${RunData.gold}`);
    this.waveText.setText(`第 ${wave}/${maxWave} 波 · 倒计时 ${Math.max(0, Math.ceil(timeLeft))}s`);
  }

  showWaveCleared(wave: number, bonus: number): void {
    this.bannerText.setText(`第 ${wave} 波完成  +${bonus} 金币`);
    this.banner.setVisible(true).setAlpha(0).setScale(0.85);
    this.scene.tweens.killTweensOf(this.banner);
    this.scene.tweens.add({
      targets: this.banner,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.Out'
    });

    this.hideTimer?.remove();
    this.hideTimer = this.scene.time.delayedCall(1300, () => {
      this.scene.tweens.add({
        targets: this.banner,
        alpha: 0,
        duration: 280,
        onComplete: () => this.banner.setVisible(false)
      });
    });
  }
}
