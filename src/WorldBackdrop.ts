import Phaser from 'phaser';
import type { BiomeId } from './game/types';

const scenery = {
  grass: { terrain: 'terrain-grass', color: 0x8fa871, accents: ['decor-grass'], tint: 0xffffff },
  forest: { terrain: 'terrain-forest', color: 0x49664b, accents: ['decor-fern', 'decor-bush'], tint: 0xc5d5b7 },
  sand: { terrain: 'terrain-beach', color: 0xd7bc81, accents: ['decor-shell', 'decor-starfish', 'decor-grass'], tint: 0xffffff },
  water: { terrain: 'terrain-sea', color: 0x4f929f, accents: ['decor-seaweed', 'decor-fish'], tint: 0xb9e7db }
} as const;

/** 场景只摆放离线素材，不参与碰撞或生成可拾取资源。 */
export class WorldBackdrop {
  private biome: BiomeId | null = null;
  private ground: Phaser.GameObjects.TileSprite;
  private accents: Phaser.GameObjects.Image[] = [];
  private fish: { image: Phaser.GameObjects.Image; x: number; y: number; seed: number }[] = [];

  constructor(private scene: Phaser.Scene) {
    this.ground = scene.add.tileSprite(960, 640, 1920, 1280, 'atlas', 'terrain-grass').setDepth(-30);
    this.ground.setTileScale(2);
    this.setBiome('grass');
  }

  setBiome(biome: BiomeId): void {
    if (this.biome === biome) return;
    this.biome = biome;
    const style = scenery[biome];
    this.ground.setFrame(style.terrain);
    this.ground.tilePositionX = 0; this.ground.tilePositionY = 0;
    this.scene.cameras.main.setBackgroundColor(style.color);
    for (const image of this.accents) image.destroy();
    this.accents = []; this.fish = [];
    // 固定疏密使同一片区域有辨识度，不使用与可采集花朵同形的装饰。
    const count = biome === 'forest' ? 58 : biome === 'water' ? 44 : 34;
    for (let i = 0; i < count; i++) {
      const x = 48 + (i * 317 + (i % 5) * 41) % 1824;
      const y = 48 + (i * 193 + (i % 3) * 67) % 1184;
      const frame = style.accents[i % style.accents.length];
      const image = this.scene.add.image(x, y, 'atlas', frame).setScale(0.7 + (i % 4) * 0.12).setDepth(-15);
      image.setFlipX(i % 2 === 0).setAlpha(frame === 'decor-fish' ? 0.6 : 0.76).setTint(style.tint);
      this.accents.push(image);
      if (frame === 'decor-fish') this.fish.push({ image, x, y, seed: i });
    }
  }

  update(time: number): void {
    if (this.biome !== 'water') return;
    this.ground.tilePositionX = Math.round(time / 1300);
    this.ground.tilePositionY = Math.round(Math.sin(time / 4500) * 3);
    for (const fish of this.fish) {
      fish.image.setPosition(fish.x + Math.sin(time / 2400 + fish.seed) * 36, fish.y + Math.sin(time / 3300 + fish.seed) * 9);
      fish.image.setFlipX(Math.cos(time / 2400 + fish.seed) < 0);
    }
  }
}
