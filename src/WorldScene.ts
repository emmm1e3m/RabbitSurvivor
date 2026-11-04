import Phaser from 'phaser';
import type { Session } from './game/Session';
import { characters, enemies as enemyDefs, items } from './game/content';
import type { GameEffect, InputState } from './game/types';
import { Sfx } from './audio';

interface Host {
  session: Session | null;
  input(): InputState;
  ready(scene: WorldScene): void;
  tick(): void;
  shake: boolean;
  manualAim: boolean;
}

/** Phaser只处理显示与输入适配，战斗和成长由纯玩法会话推进。 */
export class WorldScene extends Phaser.Scene {
  private host: Host;
  private actors = new Map<string, Phaser.GameObjects.Image>();
  private spare: Phaser.GameObjects.Image[] = [];
  private bars = new Map<number, Phaser.GameObjects.Rectangle>();
  private seen = new Set<string>();
  private menuActors: Phaser.GameObjects.Image[] = [];
  private fxCount = 0;
  private loadFailed = false;
  private aimGuide!: Phaser.GameObjects.Graphics;
  private attackGuide!: Phaser.GameObjects.Graphics;
  private recoil = 0;
  private hurtFlash = 0;

  constructor(host: Host) { super('world'); this.host = host; }

  preload(): void {
    const progress = document.querySelector<HTMLProgressElement>('#boot-progress')!;
    const label = document.querySelector<HTMLElement>('#boot-label')!;
    label.textContent = '正在打开苹果园…';
    this.load.on('progress', (value: number) => { progress.value = value; });
    this.load.on('loaderror', () => {
      this.loadFailed = true;
      label.textContent = '像素素材加载失败，请重试。';
      document.querySelector<HTMLElement>('#boot-retry')!.hidden = false;
    });
    this.load.atlas('atlas', `${import.meta.env.BASE_URL}assets/atlas.png`, `${import.meta.env.BASE_URL}assets/atlas.json`);
    for (const form of new Set(Object.values(characters).flatMap(def => [...def.forms]))) {
      this.load.image(`character-${form}`, `${import.meta.env.BASE_URL}assets/characters/${form}.png`);
    }
  }

  create(): void {
    if (this.loadFailed) return;
    for (const form of new Set(Object.values(characters).flatMap(def => [...def.forms]))) this.textures.get(`character-${form}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.cameras.main.setBackgroundColor('#6e895a');
    this.aimGuide = this.add.graphics().setDepth(4);
    this.attackGuide = this.add.graphics().setDepth(70);
    this.add.tileSprite(960, 640, 1920, 1280, 'atlas', 'grass-0').setDepth(-20);
    this.cameras.main.setBounds(0, 0, 1920, 1280);
    // 地上的花由会话作为真实拾取物生成，避免摆放不可采的同形装饰。
    for (let i = 0; i < 24; i++) {
      const side = i % 4;
      const along = 40 + (i * 149) % (side % 2 ? 1170 : 1820);
      const x = side === 1 ? 1890 : side === 3 ? 25 : along;
      const y = side === 0 ? 20 : side === 2 ? 1250 : along;
      this.add.image(x, y, 'atlas', 'tree').setScale(2).setDepth(-1);
    }
    const boundary = this.add.graphics().setDepth(-5);
    boundary.lineStyle(5, 0x536c44, 0.8).strokeRect(24, 24, 1872, 1232);
    [...new Set(Object.values(characters).flatMap(def => [...def.forms]))].forEach((form, i) => {
      const image = this.add.image(760 + i * 95, 580 + (i % 2) * 35, `character-${form}`);
      const source = image.texture.getSourceImage();
      image.setDisplaySize(110 * source.width / source.height, 110);
      this.menuActors.push(image);
    });
    this.scale.on('resize', () => this.resize());
    this.resize();
    this.host.ready(this);
  }

  resize(): void {
    const { width, height } = this.scale;
    const zoom = width < height ? Math.max(0.6, Math.min(1, width / 520)) : Math.max(0.7, Math.min(1.45, height / 650));
    this.cameras.main.setZoom(zoom);
    this.host.session?.setView(width / zoom, height / zoom);
  }

  update(time: number, delta: number): void {
    const s = this.host.session;
    if (!s) {
      this.aimGuide?.clear();
      this.attackGuide?.clear();
      this.cameras.main.centerOn(960, 640);
      this.menuActors.forEach((sprite, i) => sprite.setVisible(true).setY(580 + (i % 2) * 35 + Math.round(Math.sin(time / 600 + i) * 4)));
      this.hideActors();
      this.host.tick();
      return;
    }
    this.menuActors.forEach(sprite => sprite.setVisible(false));
    const input = this.host.input();
    s.step(Math.min(delta / 1000, 0.05), input);
    this.recoil = Math.max(0, this.recoil - delta / 130);
    this.hurtFlash = Math.max(0, this.hurtFlash - delta / 1000);
    this.seen.clear();
    const moving = Math.abs(input.x) + Math.abs(input.y) > 0.05 && s.phase === 'running' && !s.paused;
    const bob = moving ? Math.round(Math.sin(time / 95) * 2) : 0;
    const p = this.putCharacter('player', s.player.x, s.player.y + bob, s.form, 76);
    p.setFlipX(s.player.facingX < -0.05).setAlpha(s.player.invulnerable > 0 && Math.floor(time / 90) % 2 ? 0.6 : 1);
    if (this.host.shake) p.setRotation(this.recoil * (p.flipX ? -0.09 : 0.09));
    if (this.hurtFlash > 0) p.setTint(0xffc6b0);
    this.cameras.main.centerOn(s.player.x, s.player.y);
    // 普攻与装填共用头顶进度条，直接读取真实武器计时，不另存UI冷却。
    const zoom = this.cameras.main.zoom;
    const barWidth = 52 / zoom; const barHeight = 6 / zoom; const border = 1 / zoom;
    const progress = s.reloadProgress ?? (1 - Math.min(1, s.attackCooldownRemaining / s.attackInterval));
    this.attackGuide.clear().fillStyle(0x293e2c, 0.9).fillRect(p.x - barWidth / 2, p.y - 49, barWidth, barHeight);
    this.attackGuide.fillStyle(s.reloadProgress !== null ? 0x9edfd2 : 0xf4d173, 1).fillRect(p.x - barWidth / 2 + border, p.y - 49 + border, (barWidth - border * 2) * Math.max(0, progress), barHeight - border * 2);
    this.aimGuide.clear();
    if (s.phase === 'running' && !s.paused && this.host.manualAim) {
      const length = s.melee ? 105 : Math.min(s.player.range, 300);
      const dx = s.player.facingX; const dy = s.player.facingY;
      const x = s.player.x + dx * length; const y = s.player.y + dy * length;
      this.aimGuide.lineStyle(s.melee ? 3 : 2, 0xfff1bf, 0.65);
      this.aimGuide.beginPath().moveTo(s.player.x + dx * 28, s.player.y + dy * 28).lineTo(x, y).strokePath();
      this.aimGuide.lineStyle(2, 0x344833, 0.9).strokeRect(x - 5, y - 5, 10, 10);
    }
    if (s.player.shield > 0) {
      this.put('shield', s.player.x, s.player.y + 4, 'shield', 1.45).setAlpha(0.22 + Math.sin(time / 200) * 0.07).setDepth(p.depth - 0.1);
    }
    // 统一使用生成的头部头像；饰品只提供效果与背包展示，不强贴挂件。
    for (let i = 0; i < s.followers; i++) {
      const angle = time / 1800 + i * Math.PI;
      this.putCharacter(`follower-${i}`, p.x + Math.cos(angle) * 58, p.y + Math.sin(angle) * 38, 'goodrabbit', 44);
    }
    for (const prop of s.props) this.put(`prop-${prop.id}`, prop.x, prop.y, prop.kind, prop.kind === 'tree' ? 1.65 : 1.1).setTint(prop.flash > 0 ? 0xffe4bb : 0xffffff);
    for (const enemy of s.enemies) {
      if (!enemy.active) continue;
      const def = enemyDefs[enemy.kind];
      const boss = def.behavior === 'boss';
      const key = boss ? `boss-${Math.floor(time / 200) % 4}` : def.sprite;
      const image = this.put(`enemy-${enemy.id}`, enemy.x, enemy.y, key, boss ? 2.3 : enemy.kind === 'note' ? 1.2 : 1.05);
      image.setFlipX(enemy.vx < 0).setTint(enemy.flash > 0 ? 0xffffff : enemy.windup > 0 ? 0xfbe098 : 0xffffff);
      if (enemy.flash > 0) image.setTintFill(0xfff5cf);
      if (enemy.flash > 0 && this.host.shake) image.setScale(image.scaleX * 1.07, image.scaleY * 0.96);
      let bar = this.bars.get(enemy.id);
      if (!bar && !boss) {
        bar = this.add.rectangle(0, 0, 30, 3, 0x994439).setOrigin(0, 0.5);
        this.bars.set(enemy.id, bar);
      }
      bar?.setPosition(enemy.x - 15, enemy.y - 19).setDisplaySize(30 * Math.max(0, enemy.hp / enemy.maxHp), 3).setVisible(enemy.hp < enemy.maxHp).setDepth(image.depth + 1);
    }
    for (const shot of s.projectiles) {
      const frameName = shot.enemy ? 'enemy-shot' : shot.kind === 'heart' ? 'heart-icon' : shot.kind === 'signal' ? 'signal-icon' : 'projectile';
      this.put(`shot-${shot.id}`, shot.x, shot.y, frameName, shot.enemy ? 0.6 : 0.7).setDepth(40).setRotation(Math.atan2(shot.vy, shot.vx));
    }
    for (const drop of s.pickups) {
      const sprite = drop.kind === 'coin' ? 'cookie' : drop.kind === 'flower' ? `flower-${drop.id % 3}` : drop.kind === 'apple' ? 'apple' : items[drop.itemId!].icon;
      this.put(`drop-${drop.id}`, drop.x, drop.y + Math.sin(time / 180 + drop.id) * 2, sprite, drop.kind === 'item' || drop.kind === 'flower' ? 0.8 : 0.55).setDepth(1);
    }
    for (const [key, image] of this.actors) {
      if (this.seen.has(key)) continue;
      image.setActive(false).setVisible(false);
      this.spare.push(image); this.actors.delete(key);
    }
    const living = new Set(s.enemies.filter(e => e.active).map(e => e.id));
    for (const [id, bar] of this.bars) if (!living.has(id)) { bar.destroy(); this.bars.delete(id); }
    for (const effect of s.drainEffects()) this.effect(effect);
    this.host.tick();
  }

  private put(key: string, x: number, y: number, frame: string, scale: number): Phaser.GameObjects.Image {
    this.seen.add(key);
    let image = this.actors.get(key);
    if (!image) {
      image = this.spare.pop() ?? this.add.image(x, y, 'atlas', frame);
      this.actors.set(key, image);
    }
    return image.setActive(true).setVisible(true).setTexture('atlas', frame).setPosition(x, y).setScale(scale).setDepth(5 + y / 1000).setAlpha(1).setFlipX(false).setRotation(0).clearTint();
  }

  private putCharacter(key: string, x: number, y: number, form: string, height: number): Phaser.GameObjects.Image {
    const image = this.put(key, x, y, 'pixel', 1).setTexture(`character-${form}`);
    const source = image.texture.getSourceImage();
    return image.setDisplaySize(height * source.width / source.height, height);
  }

  private hideActors(): void {
    for (const image of this.actors.values()) image.setVisible(false);
    for (const bar of this.bars.values()) bar.setVisible(false);
  }

  private effect(fx: GameEffect): void {
    if (fx.type === 'shoot') {
      Sfx.shoot();
      if (fx.kind !== 'enemy') this.recoil = 1;
      return;
    }
    if (fx.type === 'melee') { this.swing(fx); return; }
    if (fx.type === 'reload') { Sfx.reload(); return; }
    if (fx.type === 'pickup') { Sfx.coin(); return; }
    if (fx.type === 'hit') Sfx.hit();
    if (fx.type === 'kill') Sfx.kill();
    if (fx.type === 'hurt') { Sfx.hurt(); this.hurtFlash = 0.12; if (this.host.shake) this.cameras.main.shake(90, 0.002); }
    if (fx.type === 'heal') Sfx.heal();
    if (fx.type === 'levelup') Sfx.levelUp();
    if (fx.type === 'wave') Sfx.waveClear();
    if (fx.type === 'skill' || fx.type === 'switch') { Sfx.skill(); if (this.host.shake) this.cameras.main.shake(120, 0.003); }
    if (fx.type === 'explosion') { Sfx.explosion(); if (this.host.shake) this.cameras.main.shake(140, 0.004); }
    if (fx.type === 'buy') Sfx.buy();
    if (fx.type === 'victory') Sfx.victory();
    if (fx.type === 'defeat') Sfx.defeat();
    if (this.fxCount > 70) return;
    if (fx.type === 'hit' || fx.type === 'heal' || fx.type === 'hurt') {
      const color = fx.type === 'heal' ? '#d3f6b1' : fx.type === 'hurt' ? '#ffb0a0' : '#fff1bc';
      const label = this.add.text(fx.x, fx.y - 20, `${fx.type === 'heal' ? '+' : ''}${Math.ceil(fx.value ?? 0)}`, { fontFamily: 'OrchardPixel', fontSize: '16px', color, stroke: '#40352b', strokeThickness: 3 }).setOrigin(0.5).setDepth(80);
      this.fxCount++;
      this.tweens.add({ targets: label, y: label.y - 30, alpha: 0, duration: 520, onComplete: () => { label.destroy(); this.fxCount--; } });
    }
    if (['kill', 'skill', 'explosion', 'shield', 'warning', 'boss', 'switch'].includes(fx.type)) {
      const warning = fx.type === 'warning' || fx.type === 'boss';
      const image = this.add.image(fx.x, fx.y, 'atlas', warning ? 'ring' : fx.type === 'explosion' ? 'blast' : 'pixel').setDepth(20).setAlpha(warning ? 0.85 : 1).setScale(warning ? 1.5 : fx.type === 'explosion' ? 2.5 : 0.5);
      this.fxCount++;
      this.tweens.add({ targets: image, scaleX: warning ? 2.6 : 2.8, scaleY: warning ? 2.6 : 2.8, alpha: 0, duration: warning ? 1000 : 350, onComplete: () => { image.destroy(); this.fxCount--; } });
      if (!warning) for (let i = 0; i < 5 && this.fxCount < 70; i++) {
        const pixel = this.add.image(fx.x, fx.y, 'atlas', 'pixel').setTint(i % 2 ? 0xf4d38a : 0xe4a16c).setDepth(35).setScale(0.5);
        this.fxCount++;
        this.tweens.add({ targets: pixel, x: fx.x + Math.cos(i * 1.25) * 32, y: fx.y + Math.sin(i * 1.25) * 32, alpha: 0, duration: 300, onComplete: () => { pixel.destroy(); this.fxCount--; } });
      }
    }
  }

  private swing(fx: GameEffect): void {
    Sfx.swing(); this.recoil = 1;
    const angle = fx.angle ?? Math.atan2(fx.aimY ?? 0, fx.aimX ?? 1);
    const radius = Math.min(fx.radius ?? 95, 116);
    const arc = this.add.graphics().setDepth(30);
    const sword = this.add.image(fx.x, fx.y, 'atlas', 'sword').setScale(0.8).setDepth(31);
    const direction = (fx.comboIndex ?? 0) % 2 ? -1 : 1;
    this.tweens.addCounter({ from: -direction, to: direction, duration: 190, ease: 'Cubic.Out', onUpdate: tween => {
      const value = tween.getValue() ?? 0;
      const current = angle + value;
      const player = this.host.session?.player ?? fx;
      sword.setPosition(player.x + Math.cos(current) * 40, player.y + Math.sin(current) * 40).setRotation(current + Math.PI / 4).setAlpha(1 - Math.max(0, value) * 0.5);
      arc.clear().lineStyle(7, 0xffedbb, 0.65 * (1 - Math.max(0, value) * 0.65));
      arc.beginPath().arc(player.x, player.y, radius * 0.68, angle - direction, current, direction < 0).strokePath();
      arc.lineStyle(2, 0xffffff, 0.8).beginPath().arc(player.x, player.y, radius * 0.7, current - direction * 0.22, current, direction < 0).strokePath();
    }, onComplete: () => { arc.destroy(); sword.destroy(); } });
  }
}
