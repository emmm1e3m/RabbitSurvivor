import Phaser from 'phaser';
import type { Session } from './game/Session';
import { characters, enemies as enemyDefs, items } from './game/content';
import type { GameEffect, InputState } from './game/types';
import { Sfx } from './audio';
import { WorldBackdrop } from './WorldBackdrop';

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
  private seen = new Set<string>();
  private menuActors: Phaser.GameObjects.Image[] = [];
  private fxCount = 0;
  private loadFailed = false;
  private aimGuide!: Phaser.GameObjects.Graphics;
  private attackGuide!: Phaser.GameObjects.Graphics;
  private healthBars!: Phaser.GameObjects.Graphics;
  private danger!: Phaser.GameObjects.Graphics;
  private backdrop!: WorldBackdrop;
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
    this.healthBars = this.add.graphics().setDepth(71);
    this.danger = this.add.graphics().setDepth(2);
    this.backdrop = new WorldBackdrop(this);
    this.cameras.main.setBounds(0, 0, 1920, 1280);
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
    const preferredZoom = width < height ? Math.max(0.6, Math.min(1, width / 520)) : Math.max(0.7, Math.min(1.45, height / 650));
    const zoom = Math.max(preferredZoom, width / 1920, height / 1280);
    this.cameras.main.setZoom(zoom);
    this.host.session?.setView(width / zoom, height / zoom);
  }

  update(time: number, delta: number): void {
    const s = this.host.session;
    this.healthBars?.clear(); this.danger?.clear();
    this.backdrop?.setBiome(s?.biome ?? 'grass');
    this.backdrop?.update(time);
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
    for (const follower of s.followers) {
      const image = this.putCharacter(`follower-${follower.id}`, follower.x, follower.y, 'goodrabbit', 44);
      image.setFlipX(follower.facingX < 0).setAlpha(follower.hurtCooldown > 0 ? 0.65 : 1);
      this.healthBar(follower.x, follower.y - 29, follower.hp, follower.maxHp, 30, 0xa7d27c);
    }
    for (const prop of s.props) {
      const tree = prop.kind === 'tree';
      const frame = tree ? s.biome === 'water' ? 'tree-water' : s.biome === 'sand' ? 'tree-beach' : 'tree' : 'barrel';
      this.put(`prop-${prop.id}`, prop.x, prop.y, frame, tree ? 1.65 : 1.1).setTint(prop.flash > 0 ? 0xffe4bb : 0xffffff);
      this.healthBar(prop.x, prop.y - (tree ? 44 : 31), prop.hp, prop.maxHp, 36, tree ? 0xa6c66f : 0xefb55f);
    }
    for (const enemy of s.enemies) {
      if (!enemy.active) continue;
      const def = enemyDefs[enemy.kind];
      const boss = def.behavior === 'boss';
      const key = boss ? `boss-${Math.floor(time / 200) % 4}` : def.sprite;
      const image = this.put(`enemy-${enemy.id}`, enemy.x, enemy.y, key, boss ? 2.3 : enemy.kind === 'note' ? 1.2 : 1.05);
      image.setFlipX(enemy.vx < 0).setTint(enemy.flash > 0 ? 0xffffff : enemy.windup > 0 ? 0xfbe098 : 0xffffff);
      if (enemy.flash > 0) image.setTintFill(0xfff5cf);
      if (enemy.flash > 0 && this.host.shake) image.setScale(image.scaleX * 1.07, image.scaleY * 0.96);
      if (boss || enemy.hp < enemy.maxHp) this.healthBar(enemy.x, enemy.y - (boss ? 58 : 27), enemy.hp, enemy.maxHp, boss ? 72 : 30, 0xe78370);
    }
    for (const shot of s.projectiles) {
      const frameName = shot.enemy ? 'enemy-shot' : shot.kind === 'heart' ? 'heart-icon' : shot.kind === 'signal' ? 'signal-icon' : shot.kind === 'cookie' ? 'cookie' : 'projectile';
      this.put(`shot-${shot.id}`, shot.x, shot.y, frameName, shot.enemy ? 0.6 : 0.7).setDepth(40).setRotation(Math.atan2(shot.vy, shot.vx));
      if (s.biome === 'water' && !shot.enemy) this.put(`shot-bubble-${shot.id}`, shot.x, shot.y, `bubble-ring-${Math.floor(time / 180) % 4}`, 0.46).setDepth(41).setAlpha(0.8);
    }
    for (const apple of s.orbitApples) {
      this.put(`orbit-${apple.id}`, apple.x, apple.y, 'projectile', 0.8).setDepth(40).setRotation(apple.angle);
      if (s.biome === 'water') this.put(`orbit-bubble-${apple.id}`, apple.x, apple.y, `bubble-ring-${Math.floor(time / 180) % 4}`, 0.6).setDepth(41);
    }
    this.drawHazards(s, time);
    for (const drop of s.pickups) {
      const sprite = drop.kind === 'coin' ? 'cookie' : drop.kind === 'flower' ? `flower-${drop.id % 3}` : drop.kind === 'apple' ? 'apple' : items[drop.itemId!].icon;
      this.put(`drop-${drop.id}`, drop.x, drop.y + Math.sin(time / 180 + drop.id) * 2, sprite, drop.kind === 'item' || drop.kind === 'flower' ? 0.8 : 0.55).setDepth(1);
    }
    for (const [key, image] of this.actors) {
      if (this.seen.has(key)) continue;
      image.setActive(false).setVisible(false);
      this.spare.push(image); this.actors.delete(key);
    }
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
  }

  private healthBar(x: number, y: number, hp: number, maxHp: number, width: number, color: number): void {
    const g = this.healthBars;
    g.fillStyle(0x293d31, 0.95).fillRect(Math.round(x - width / 2 - 1), Math.round(y - 1), width + 2, 7);
    g.fillStyle(0x5c6050, 1).fillRect(Math.round(x - width / 2), Math.round(y), width, 5);
    g.fillStyle(color, 1).fillRect(Math.round(x - width / 2), Math.round(y), Math.max(0, width * hp / maxHp), 5);
  }

  private drawHazards(session: Session, time: number): void {
    const g = this.danger;
    for (const hazard of session.hazards) {
      const warning = hazard.warningRemaining > 0;
      const pulse = 0.55 + Math.sin(time / 80) * 0.2;
      if (hazard.kind === 'laser') {
        g.lineStyle(hazard.width + (warning ? 0 : 8), 0xe56f59, warning ? 0.15 : 0.25);
        g.beginPath().moveTo(hazard.x, hazard.y).lineTo(hazard.endX, hazard.endY).strokePath();
        g.lineStyle(warning ? 2 : hazard.width, warning ? 0xffbd8b : 0xffb790, warning ? pulse : 0.85);
        g.beginPath().moveTo(hazard.x, hazard.y).lineTo(hazard.endX, hazard.endY).strokePath();
        if (!warning) {
          g.lineStyle(3, 0xfff7d5, 1).beginPath().moveTo(hazard.x, hazard.y).lineTo(hazard.endX, hazard.endY).strokePath();
        }
      } else {
        g.fillStyle(warning ? 0xdf685b : 0xf4a55b, warning ? 0.14 : 0.55).fillCircle(hazard.x, hazard.y, hazard.radius);
        g.lineStyle(warning ? 3 : 5, warning ? 0xffab83 : 0xffefad, warning ? pulse : 0.85).strokeCircle(hazard.x, hazard.y, hazard.radius);
        g.lineStyle(2, 0xffddab, warning ? pulse : 1);
        g.beginPath().moveTo(hazard.x - 10, hazard.y).lineTo(hazard.x + 10, hazard.y).moveTo(hazard.x, hazard.y - 10).lineTo(hazard.x, hazard.y + 10).strokePath();
      }
    }
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
    if (fx.type === 'boss' && fx.kind === 'defeated') return;
    if (fx.type === 'shield' && fx.kind === 'block') Sfx.hit();
    if (fx.type === 'hit') Sfx.hit();
    if (fx.type === 'kill') Sfx.kill();
    if (fx.type === 'hurt') { Sfx.hurt(); if (fx.kind !== 'follower') { this.hurtFlash = 0.12; if (this.host.shake) this.cameras.main.shake(90, 0.002); } }
    if (fx.type === 'heal') Sfx.heal();
    if (fx.type === 'wave') Sfx.waveClear();
    if (fx.type === 'skill' || fx.type === 'switch') { Sfx.skill(); if (this.host.shake) this.cameras.main.shake(120, 0.003); }
    if (fx.type === 'explosion') { Sfx.explosion(); if (this.host.shake) this.cameras.main.shake(140, 0.004); }
    if (fx.type === 'buy') Sfx.buy();
    if (fx.type === 'victory') Sfx.victory();
    if (fx.type === 'defeat') Sfx.defeat();
    if (fx.type === 'kill' && fx.kind === 'boss' && this.host.session?.biome === 'water') this.sinkBoss(fx);
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

  private sinkBoss(fx: GameEffect): void {
    const boss = this.add.image(fx.x, fx.y, 'atlas', 'boss-0').setScale(2.3).setDepth(32).setTint(0xa6ced0);
    this.tweens.add({ targets: boss, y: fx.y + 30, scaleY: 1.5, alpha: 0, duration: 850, onComplete: () => boss.destroy() });
    for (let i = 0; i < 7; i++) {
      const bubble = this.add.image(fx.x + (i % 3 - 1) * 16, fx.y - 8 + (i % 2) * 9, 'atlas', 'bubble').setScale(0.7 + (i % 3) * 0.25).setDepth(45);
      this.tweens.add({ targets: bubble, x: bubble.x + Math.sin(i) * 25, y: bubble.y - 65 - i * 5, alpha: 0, duration: 650 + i * 90, delay: i * 55, onComplete: () => bubble.destroy() });
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
