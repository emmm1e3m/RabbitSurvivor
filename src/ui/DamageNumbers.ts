import Phaser from 'phaser';
import { DEPTH } from '../config';

const POOL_SIZE = 64;
const NORMAL_COLOR = '#ffffff';
const CRIT_COLOR = '#ffd23f';
const FONT = 'Impact, "Arial Black", "Microsoft YaHei", sans-serif';

/** 伤害飘字：池化文本，普通白字 / 暴击金字加大并弹跳 */
export class DamageNumbers {
  private texts: Phaser.GameObjects.Text[] = [];
  private cursor = 0;

  constructor(private scene: Phaser.Scene) {
    for (let i = 0; i < POOL_SIZE; i++) {
      this.texts.push(
        scene.add
          .text(0, 0, '', {
            fontFamily: FONT,
            fontSize: '24px',
            fontStyle: 'bold italic',
            color: NORMAL_COLOR,
            stroke: '#12131c',
            strokeThickness: 5
          })
          .setOrigin(0.5)
          .setDepth(DEPTH.fx + 1)
          .setVisible(false)
      );
    }
  }

  show(x: number, y: number, amount: number, critical: boolean): void {
    const text = this.next();
    this.scene.tweens.killTweensOf(text);

    text
      .setPosition(x + Phaser.Math.Between(-18, 18), y + Phaser.Math.Between(-10, 4))
      .setText(`${Math.max(1, Math.round(amount))}`)
      .setFontSize(critical ? 42 : 26)
      .setColor(critical ? CRIT_COLOR : NORMAL_COLOR)
      .setStroke(critical ? '#5a1a00' : '#12131c', critical ? 6 : 5)
      .setShadow(0, 3, critical ? '#ff9f43' : '#000000', critical ? 8 : 3, true, true)
      .setAngle(Phaser.Math.Between(-12, 12))
      .setAlpha(1)
      .setScale(critical ? 0.4 : 0.7)
      .setVisible(true);

    this.scene.tweens.add({
      targets: text,
      scale: critical ? 1.2 : 1,
      duration: critical ? 200 : 130,
      ease: 'Back.Out',
      onComplete: () => {
        this.scene.tweens.add({
          targets: text,
          y: text.y - (critical ? 56 : 38),
          alpha: 0,
          duration: critical ? 560 : 440,
          ease: 'Cubic.Out',
          onComplete: () => text.setVisible(false)
        });
      }
    });
  }

  private next(): Phaser.GameObjects.Text {
    const text = this.texts[this.cursor];
    this.cursor = (this.cursor + 1) % this.texts.length;
    return text;
  }
}
