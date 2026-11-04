import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, COLORS } from '../config';
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
  private killText: Phaser.GameObjects.Text;
  private reloadBar: Phaser.GameObjects.Container;
  private reloadFill: Phaser.GameObjects.Rectangle;
  private bossBar: Phaser.GameObjects.Container;
  private bossFill: Phaser.GameObjects.Rectangle;
  private skillName: Phaser.GameObjects.Text;
  private skillHint: Phaser.GameObjects.Text;
  private skillState: Phaser.GameObjects.Text;
  private skillFill: Phaser.GameObjects.Rectangle;
  private banner: Phaser.GameObjects.Container;
  private bannerText: Phaser.GameObjects.Text;
  private hideTimer?: Phaser.Time.TimerEvent;

  constructor(private scene: Phaser.Scene, onPause: () => void, onSkill: () => void) {
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

    this.killText = scene.add
      .text(22, 68, '', {
        fontSize: '14px',
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

    // 装填蓄力条：位于屏幕中心玩家上方（相机严格跟随时即玩家头顶）
    const reloadBg = scene.add
      .rectangle(0, 0, 76, 9, 0x1a1c26, 0.85)
      .setStrokeStyle(1, 0x3a3f5c);
    this.reloadFill = scene.add.rectangle(-36, 0, 72, 5, COLORS.player).setOrigin(0, 0.5);
    this.reloadBar = scene.add
      .container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 42, [reloadBg, this.reloadFill])
      .setDepth(depth + 1)
      .setScrollFactor(0)
      .setVisible(false);

    // Boss 血条：屏幕上方居中
    const bossBg = scene.add.rectangle(0, 0, 424, 18, 0x1a1c26, 0.9);
    this.bossFill = scene.add.rectangle(-210, 0, 420, 14, COLORS.hpBarFill).setOrigin(0, 0.5);
    const bossLabel = scene.add
      .text(-218, 0, 'BOSS', {
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ff6b6b'
      })
      .setOrigin(1, 0.5);
    this.bossBar = scene.add
      .container(GAME_WIDTH / 2, 64, [bossBg, this.bossFill, bossLabel])
      .setDepth(depth)
      .setScrollFactor(0)
      .setVisible(false);

    // 技能按钮：右下角，显示名称、释放方式与冷却
    // container 子对象的点击判定只读取自身 scrollFactor，因此按钮需单独设为 0
    const skillBg = scene.add
      .rectangle(0, 0, 152, 94, 0x1a1c26, 0.9)
      .setStrokeStyle(2, 0x3a3f5c)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this.skillName = scene.add
      .text(0, -24, '', { fontSize: '17px', fontStyle: 'bold', color: COLORS.textLight })
      .setOrigin(0.5);
    this.skillHint = scene.add
      .text(0, 0, '', { fontSize: '12px', color: COLORS.textDim })
      .setOrigin(0.5);
    this.skillState = scene.add
      .text(0, 23, '', { fontSize: '15px', fontStyle: 'bold', color: '#51cf66' })
      .setOrigin(0.5);
    const skillBarBg = scene.add
      .rectangle(-64, 38, 128, 4, 0x232638)
      .setOrigin(0, 0.5);
    this.skillFill = scene.add
      .rectangle(-64, 38, 128, 4, 0x4dd0e1)
      .setOrigin(0, 0.5);
    scene.add
      .container(GAME_WIDTH - 96, GAME_HEIGHT - 66, [
        skillBg,
        this.skillName,
        this.skillHint,
        this.skillState,
        skillBarBg,
        this.skillFill
      ])
      .setDepth(depth)
      .setScrollFactor(0);
    skillBg.on('pointerdown', onSkill);

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
    this.killText.setText(
      `小怪 ${RunData.normalKills} · 精英 ${RunData.eliteKills} · 小问号 ${RunData.questionMarks}`
    );
    this.waveText.setText(`第 ${wave}/${maxWave} 波 · 倒计时 ${Math.max(0, Math.ceil(timeLeft))}s`);
  }

  /** 装填蓄力条：progress 为 null 时隐藏 */
  setReload(progress: number | null): void {
    if (progress === null) {
      this.reloadBar.setVisible(false);
      return;
    }
    this.reloadBar.setVisible(true);
    this.reloadFill.setScale(Phaser.Math.Clamp(progress, 0, 1), 1);
  }

  /** Boss 血条：ratio 为 null 时隐藏 */
  setBossBar(ratio: number | null): void {
    if (ratio === null) {
      this.bossBar.setVisible(false);
      return;
    }
    this.bossBar.setVisible(true);
    this.bossFill.setScale(Phaser.Math.Clamp(ratio, 0, 1), 1);
  }

  /** 技能按钮状态：remaining 为剩余冷却（秒），total 为本次冷却总时长 */
  updateSkill(
    name: string,
    active: boolean,
    upgraded: boolean,
    remaining: number,
    total: number
  ): void {
    this.skillName.setText(upgraded ? `${name} Lv2` : name);
    this.skillHint.setText(active ? '空格 / 点击释放' : '自动释放');
    const ready = remaining <= 0.001;
    this.skillState.setText(ready ? (active ? '就绪' : '待命') : `${remaining.toFixed(1)}s`);
    this.skillState.setColor(ready ? '#51cf66' : COLORS.textDim);
    this.skillFill.setScale(Phaser.Math.Clamp(1 - remaining / total, 0, 1), 1);
    this.skillFill.setFillStyle(ready ? 0x51cf66 : 0x4dd0e1);
  }

  showWaveCleared(wave: number, bonus: number): void {
    this.showBanner(`第 ${wave} 波完成  +${bonus} 金币`);
  }

  showSkillUpgrade(name: string): void {
    this.showBanner(`技能升级！${name}`, COLORS.gold);
  }

  private showBanner(text: string, color: string = COLORS.textLight): void {
    this.bannerText.setText(text).setColor(color);
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
