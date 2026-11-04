import Phaser from 'phaser';
import { SCENE_KEYS, COLORS, GAME_WIDTH, GAME_HEIGHT } from '../config';
import { CHARACTERS } from '../data/characters';

/** 程序化纹理生成：无外部素材，全部用 Graphics 绘制后烘焙为纹理 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Boot);
  }

  preload(): void {
    this.load.audio('bgm', 'audio/bgm.mp3');
  }

  create(): void {
    this.makePlayer();
    this.makeEnemies();
    this.makeProps();
    this.makeBullet();
    this.makePickups();
    this.makeGrid();
    this.makeParticle();
    this.makeVignette();
    this.scene.start(SCENE_KEYS.Menu);
  }

  private tex(key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
    const g = this.add.graphics();
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  private makePlayer(): void {
    for (const character of CHARACTERS) {
      this.tex(`player-${character.id}`, 32, 32, (g) => {
        g.fillStyle(character.color, 1);
        g.fillCircle(16, 16, 14);
        g.lineStyle(2, 0xffffff, 0.85);
        g.strokeCircle(16, 16, 14);
        // 朝向标记
        g.fillStyle(COLORS.playerAim, 1);
        g.fillCircle(25, 16, 3.5);
      });
    }
  }

  private makeEnemies(): void {
    this.tex('chaser', 30, 30, (g) => {
      g.fillStyle(COLORS.chaser, 1);
      g.fillCircle(15, 15, 14);
      g.lineStyle(2, 0x8b1e1e, 1);
      g.strokeCircle(15, 15, 14);
      g.fillStyle(0x8b1e1e, 0.9);
      g.fillCircle(10, 11, 2.5);
      g.fillCircle(20, 11, 2.5);
    });
    this.tex('brute', 54, 54, (g) => {
      g.fillStyle(COLORS.brute, 1);
      g.fillCircle(27, 27, 26);
      g.lineStyle(3, 0x5a1a75, 1);
      g.strokeCircle(27, 27, 26);
      g.fillStyle(0x5a1a75, 0.9);
      g.fillCircle(19, 21, 4);
      g.fillCircle(35, 21, 4);
      g.fillRect(18, 33, 18, 4);
    });
    this.tex('shooter', 52, 52, (g) => {
      g.fillStyle(COLORS.shooter, 1);
      g.fillCircle(26, 26, 24);
      g.lineStyle(3, 0x8a3b12, 1);
      g.strokeCircle(26, 26, 24);
      // 独眼与炮口
      g.fillStyle(0x8a3b12, 0.95);
      g.fillCircle(26, 22, 10);
      g.fillStyle(0xffe066, 1);
      g.fillCircle(26, 22, 4.5);
      g.fillStyle(0x8a3b12, 1);
      g.fillCircle(26, 44, 5);
    });
  }

  private makeProps(): void {
    this.tex('tree', 56, 60, (g) => {
      // 树干
      g.fillStyle(0x6b4a2b, 1);
      g.fillRect(25, 33, 7, 25);
      // 树冠
      g.fillStyle(0x2f7d46, 1);
      g.fillCircle(28, 24, 23);
      g.fillStyle(0x3e9b58, 1);
      g.fillCircle(18, 18, 13);
      g.fillCircle(38, 20, 12);
      g.lineStyle(2, 0x235f35, 1);
      g.strokeCircle(28, 24, 23);
      // 苹果
      g.fillStyle(0xe74c3c, 1);
      g.fillCircle(20, 26, 4);
      g.fillCircle(36, 29, 4);
      g.fillCircle(29, 14, 3.5);
      g.fillCircle(23, 36, 3.5);
    });
  }

  private makeBullet(): void {
    this.tex('bullet', 12, 12, (g) => {
      g.fillStyle(COLORS.bullet, 1);
      g.fillCircle(6, 6, 6);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(6, 6, 2.5);
    });
    this.tex('enemy-bullet', 12, 12, (g) => {
      g.fillStyle(COLORS.enemyBullet, 1);
      g.fillCircle(6, 6, 5.5);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(6, 6, 2.2);
    });
  }

  private makePickups(): void {
    this.tex('material', 12, 12, (g) => {
      g.fillStyle(COLORS.material, 1);
      g.beginPath();
      g.moveTo(6, 0);
      g.lineTo(12, 6);
      g.lineTo(6, 12);
      g.lineTo(0, 6);
      g.closePath();
      g.fillPath();
    });
    this.tex('heal', 16, 16, (g) => {
      // 苹果：果梗 + 果实 + 叶子
      g.lineStyle(2, 0x6b4a2b, 1);
      g.beginPath();
      g.moveTo(8, 5);
      g.lineTo(8, 1);
      g.strokePath();
      g.fillStyle(0xe74c3c, 1);
      g.fillCircle(8, 9, 6);
      g.fillStyle(0xffb3a7, 0.85);
      g.fillCircle(6, 7, 1.8);
      g.fillStyle(COLORS.heal, 1);
      g.fillCircle(12, 4, 2.6);
    });
  }

  private makeGrid(): void {
    this.tex('bg-grid', 64, 64, (g) => {
      g.fillStyle(COLORS.grid, 1);
      g.fillRect(0, 0, 64, 64);
      g.lineStyle(1, COLORS.gridLine, 1);
      g.beginPath();
      g.moveTo(0, 0.5);
      g.lineTo(64, 0.5);
      g.moveTo(0.5, 0);
      g.lineTo(0.5, 64);
      g.strokePath();
    });
  }

  private makeParticle(): void {
    this.tex('particle', 6, 6, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 6, 6);
    });
    // 命中碎裂碎片：不规则四边形，白色以支持按敌人颜色染色
    this.tex('shard', 10, 10, (g) => {
      g.fillStyle(0xffffff, 1);
      g.beginPath();
      g.moveTo(5, 0);
      g.lineTo(10, 6);
      g.lineTo(3, 10);
      g.lineTo(0, 4);
      g.closePath();
      g.fillPath();
    });
  }

  /** 受伤红屏：四边红色线性渐变到中心透明，用 Canvas 渐变生成 */
  private makeVignette(): void {
    if (this.textures.exists('hurt-vignette')) return;

    const texture = this.textures.createCanvas('hurt-vignette', GAME_WIDTH, GAME_HEIGHT);
    if (!texture) return;
    const ctx = texture.getContext();
    const band = 170;
    const red = '255, 45, 45';

    const paint = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      rx: number,
      ry: number,
      rw: number,
      rh: number
    ): void => {
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, `rgba(${red}, 0.8)`);
      grad.addColorStop(1, `rgba(${red}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(rx, ry, rw, rh);
    };

    paint(0, 0, 0, band, 0, 0, GAME_WIDTH, band);
    paint(0, GAME_HEIGHT, 0, GAME_HEIGHT - band, 0, GAME_HEIGHT - band, GAME_WIDTH, band);
    paint(0, 0, band, 0, 0, 0, band, GAME_HEIGHT);
    paint(GAME_WIDTH, 0, GAME_WIDTH - band, 0, GAME_WIDTH - band, 0, band, GAME_HEIGHT);
    texture.refresh();
  }
}
