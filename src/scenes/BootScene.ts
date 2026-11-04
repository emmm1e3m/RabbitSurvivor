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
    this.tex('charger', 34, 34, (g) => {
      g.fillStyle(COLORS.charger, 1);
      g.fillCircle(17, 17, 15);
      g.lineStyle(2, 0x8a6d1a, 1);
      g.strokeCircle(17, 17, 15);
      // 冲刺箭头
      g.fillStyle(0x6b3f00, 1);
      g.fillTriangle(25, 17, 12, 9, 12, 25);
      g.fillStyle(0x6b3f00, 0.85);
      g.fillCircle(9, 12, 2);
      g.fillCircle(9, 22, 2);
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
    this.tex('boss', 96, 96, (g) => {
      g.fillStyle(0x7d1f3f, 1);
      g.fillCircle(48, 48, 44);
      g.lineStyle(4, 0x3d0f20, 1);
      g.strokeCircle(48, 48, 44);
      // 双角
      g.fillStyle(0x3d0f20, 1);
      g.fillTriangle(18, 22, 34, 8, 36, 30);
      g.fillTriangle(78, 22, 62, 8, 60, 30);
      // 眼睛与嘴
      g.fillStyle(0xffd23f, 1);
      g.fillCircle(34, 42, 7);
      g.fillCircle(62, 42, 7);
      g.fillStyle(0x3d0f20, 1);
      g.fillRect(32, 62, 32, 9);
    });

    // 精英死亡黑白效果用灰度纹理
    for (const key of ['brute', 'shooter', 'boss']) {
      this.makeGray(key);
    }
  }

  /** 生成原纹理的去饱和副本（`<key>-gray`），用于精英死亡表现 */
  private makeGray(key: string): void {
    if (this.textures.exists(`${key}-gray`)) return;
    const source = this.textures.get(key).getSourceImage() as HTMLCanvasElement;
    const texture = this.textures.createCanvas(`${key}-gray`, source.width, source.height);
    if (!texture) return;
    const ctx = texture.getContext();
    ctx.drawImage(source, 0, 0);
    const image = ctx.getImageData(0, 0, source.width, source.height);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    ctx.putImageData(image, 0, 0);
    texture.refresh();
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
    this.tex('barrel', 40, 46, (g) => {
      g.fillStyle(0xb03a2e, 1);
      g.fillRoundedRect(4, 6, 32, 38, 6);
      g.lineStyle(3, 0x6e1f18, 1);
      g.strokeRoundedRect(4, 6, 32, 38, 6);
      // 桶箍
      g.fillStyle(0x6e1f18, 1);
      g.fillRect(4, 15, 32, 4);
      g.fillRect(4, 33, 32, 4);
      // 警告标志
      g.fillStyle(0xffd23f, 1);
      g.fillTriangle(20, 19, 12, 31, 28, 31);
      g.fillStyle(0x6e1f18, 1);
      g.fillRect(19, 22, 3, 5);
      g.fillRect(19, 28, 3, 2);
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

    // 小问号：金色圆底 + 黑色问号（Canvas 文本便于绘制字形）
    const question = this.textures.createCanvas('question', 22, 22);
    if (!question) return;
    const ctx = question.getContext();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(11, 11, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#8a6d1a';
    ctx.stroke();
    ctx.fillStyle = '#11121a';
    ctx.font = 'bold 15px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 11, 12);
    question.refresh();
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
