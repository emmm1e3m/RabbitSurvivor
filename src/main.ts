import Phaser from 'phaser';
import { Session } from './game/Session';
import { buyTalent, normalizeProfile } from './game/MetaProgress';
import { abilities, characters, items, stages, enemies as enemyDefs, content } from './game/content';
import type { BiomeId, CharacterId, InputState, Profile } from './game/types';
import { WorldScene } from './WorldScene';
import { Sfx } from './audio';
import { renderDetails } from './DetailsView';
import { renderShop } from './ShopView';
import { renderMeta } from './MetaView';
import type { DetailKind } from './DetailsView';

type Atlas = { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>; meta: { size: { w: number; h: number } } };
type Settings = { autoAim: boolean; music: boolean; sound: boolean; shake: boolean };
const base = import.meta.env.BASE_URL;
const root = document.querySelector<HTMLDivElement>('#ui')!;
const keys = new Set<string>();
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const profileKey = 'survivor:profile:v2';
function storedValue(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; }
}
function persistProfile(profile: Profile): void {
  try { localStorage.setItem(profileKey, JSON.stringify(profile)); } catch { /* 本次会话仍保留成长。 */ }
}
function readProfile(): Profile {
  const profile = normalizeProfile(storedValue(profileKey) ?? storedValue('survivor:profile:v1'), storedValue('rabbit:meta:v1'));
  persistProfile(profile);
  return profile;
}

function readSettings(): Settings {
  const settings = { autoAim: true, music: true, sound: true, shake: !matchMedia('(prefers-reduced-motion: reduce)').matches };
  try {
    const data = JSON.parse(localStorage.getItem('survivor:settings') ?? '{}');
    for (const key of Object.keys(settings) as (keyof Settings)[]) if (typeof data[key] === 'boolean') settings[key] = data[key];
  } catch { /* 使用默认设置。 */ }
  return settings;
}

/** 界面只发动作与读取状态，不重复实现伤害、购买或技能结算。 */
class App {
  session: Session | null = null;
  scene: WorldScene | null = null;
  settings = readSettings();
  profile = readProfile();
  selected: CharacterId = 'classrep';
  private mode = '';
  private info: 'help' | 'settings' | 'growth' | 'details' | null = null;
  private detailReturn: 'growth' | null = null;
  private detail: { kind: DetailKind; id: string } | null = null;
  private resumeAfterInfo = false;
  private stick: InputState = { x: 0, y: 0 };
  private aim = { x: 1, y: 0 };
  private mouseFiring = false;
  private touchFiring = false;
  private aimPointerId: number | null = null;
  private aimCenter = { x: 0, y: 0 };
  private pointerId: number | null = null;
  private stickCenter = { x: 0, y: 0 };
  private lastUi = 0;
  private lastInventory = '';
  private lastProgressRevision = -1;
  private lastWave = 0;
  private growthScroll = 0;
  private toastTimer = 0;
  private music = new Audio(`${base}audio/orchard-futurebass.mp3`);

  constructor(private atlas: Atlas) {
    this.music.loop = true; this.music.volume = 0.22; this.music.preload = 'none';
    Sfx.setEnabled(this.settings.sound);
    root.addEventListener('click', e => this.click(e));
    root.addEventListener('change', e => this.change(e));
    root.addEventListener('pointerdown', e => this.pointerDown(e));
    window.addEventListener('pointerdown', e => {
      if ((e.target as Element).tagName === 'CANVAS' && e.pointerType === 'mouse' && e.button === 0 && this.session?.phase === 'running' && !this.session.paused) {
        this.updateMouseAim(e); this.mouseFiring = true;
      }
    });
    window.addEventListener('pointermove', e => this.pointerMove(e));
    window.addEventListener('pointerup', e => this.pointerUp(e));
    window.addEventListener('pointercancel', e => this.pointerUp(e));
    window.addEventListener('keydown', e => this.keyDown(e));
    window.addEventListener('keyup', e => keys.delete(e.code));
    window.addEventListener('blur', () => this.autoPause());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoPause(); });
    let portrait = innerWidth < innerHeight;
    window.addEventListener('resize', () => { const next = innerWidth < innerHeight; if (next !== portrait) this.autoPause(); portrait = next; });
    document.querySelector('#boot-retry')!.addEventListener('click', () => location.reload());
  }

  get shake(): boolean { return this.settings.shake; }
  get manualAim(): boolean { return !this.settings.autoAim; }
  ready(scene: WorldScene): void { this.scene = scene; document.querySelector<HTMLElement>('#boot')!.hidden = true; this.render(); }
  input(): InputState {
    if (!this.session || this.session.paused || this.session.phase !== 'running') return { x: 0, y: 0 };
    const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    const y = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
    const movement = x || y ? { x, y } : this.stick;
    return { ...movement, aimX: this.aim.x, aimY: this.aim.y, fire: this.mouseFiring || this.touchFiring, autoAim: this.settings.autoAim };
  }
  tick(): void {
    const s = this.session;
    this.syncProgress();
    const mode = `${s?.phase ?? 'menu'}:${s?.paused ?? false}:${this.info}`;
    if (mode !== this.mode) this.render();
    if (s && performance.now() - this.lastUi > 80) {
      this.lastUi = performance.now(); this.updateHud();
      if (s.wave !== this.lastWave) { this.lastWave = s.wave; this.toast(`第 ${s.wave} 波 · ${s.stage.name}`); }
    }
  }

  private icon(name: string, size = 48, extra = ''): string {
    const form = name.replace(/-[0-3]$/, '');
    if (Object.values(characters).some(def => def.forms.includes(form))) return `<img class="character-art ${extra}" src="${base}assets/characters/${form}.png" alt="" aria-hidden="true" style="width:${size}px;height:${size}px;object-fit:contain" />`;
    const f = this.atlas.frames[name].frame; const scale = size / f.w;
    return `<span class="inline-icon ${extra}" aria-hidden="true" style="width:${size}px;height:${size}px;background-image:url('${base}assets/atlas.png');background-size:${this.atlas.meta.size.w * scale}px ${this.atlas.meta.size.h * scale}px;background-position:${-f.x * scale}px ${-f.y * scale}px"></span>`;
  }
  private header(): string {
    return `<header class="app-header"><a class="brand" href="${base}" aria-label="幸存兔首页">${this.icon('goodrabbit-0', 40)}<span>幸存兔</span></a><div class="header-actions"><button class="secondary small" data-action="growth">成长</button><button class="subtle small" data-action="help">玩法指南</button><button class="subtle small" data-action="settings">设置</button></div></header>`;
  }
  private syncProgress(): void {
    const s = this.session;
    if (!s || s.progressRevision === this.lastProgressRevision) return;
    this.lastProgressRevision = s.progressRevision;
    this.profile = s.result?.profile ?? s.profileSnapshot;
    persistProfile(this.profile);
  }
  private render(): void {
    this.syncProgress();
    const growth = root.querySelector<HTMLElement>('.growth-modal');
    if (growth) this.growthScroll = growth.scrollTop;
    this.clearInput(); const s = this.session;
    this.mode = `${s?.phase ?? 'menu'}:${s?.paused ?? false}:${this.info}`;
    root.dataset.aimMode = this.settings.autoAim ? 'auto' : 'manual';
    document.body.dataset.aimMode = root.dataset.aimMode;
    document.body.dataset.reducedMotion = this.settings.shake ? "false" : "true";
    root.innerHTML = (!s ? this.header() + this.menu() : this.hud() + this.overlay()) + this.infoModal() + '<div class="toast" role="status"></div>';
    if (this.info === 'growth') root.querySelector<HTMLElement>('.growth-modal')!.scrollTop = this.growthScroll;
    const shade = root.querySelector<HTMLElement>('.modal-shade');
    for (const child of Array.from(root.children)) (child as HTMLElement).inert = !!shade && child !== shade;
    this.lastInventory = ''; if (s) this.updateHud();
  }
  private menu(): string {
    const chosen = characters[this.selected];
    const skillIds = [...new Set(chosen.forms.map(form => chosen.formAbilities?.[form] ?? chosen.abilityId))];
    return `<main class="menu"><div class="menu-top"><div><p class="eyebrow">苹果园 · 清晨</p><h1 class="title">小小的你，<br>也能守住果园。</h1><p class="lead">穿过草地、森林、沙地与水边，和伙伴一起对付坏老板。</p></div><div class="profile-summary">${this.icon('star', 40)}<strong>${this.profile.talentPoints}</strong><span>成长积分</span><small>道具栏 ${1 + Math.min(2, this.profile.bossWins)} 格 · 最佳第 ${this.profile.bestWave} 波</small></div></div><div class="character-grid" role="group" aria-label="选择角色">${Object.values(characters).map(def => `<div class="character-option"><button class="character-card" data-character="${def.id}" aria-pressed="${this.selected === def.id}"><span class="portrait">${this.icon(`${def.initialForm}-0`, 96)}${def.forms.length > 1 ? this.icon('signal-0', 48, 'duo-friend') : ''}</span><strong class="character-title">${def.name}</strong><span class="character-flavor">${def.title}</span></button><button class="info-button" data-info-kind="character" data-info-id="${def.id}" aria-label="${def.name}的详情">i</button></div>`).join('')}</div><section class="selected-panel"><div class="selection-copy"><h2>${chosen.name}的技能</h2>${skillIds.map(id => { const skill = abilities[id]; return `<p class="ability-note">${this.icon(skill.icon, 28)}<strong>${skill.name}</strong><button class="info-button inline-info" data-info-kind="ability" data-info-id="${skill.id}" aria-label="${skill.name}的详情">i</button></p>`; }).join('')}</div><div class="start-actions"><button class="primary" data-action="start">出发！<span class="action-key">Enter</span></button></div></section><footer class="menu-footer"><span>WASD / 方向键选择 · 空格 / 回车确认</span></footer></main>`;
  }
  private hud(): string {
    const s = this.session!;
    return `<div class="hud"><div class="hud-left"><div class="health">${this.icon('heart-icon', 30)}<div><div class="hp-label"><span>生命</span><strong id="hp-label"></strong></div><div class="meter"><div class="meter-fill" id="hp-fill"></div></div></div></div><div class="shield-status" id="shield-status"><span class="shield-icon">${this.icon('shield', 30)}</span><div><div class="shield-label"><span>护盾</span><strong id="shield-label"></strong></div><div class="meter shield-meter"><div class="meter-fill" id="shield-fill"></div></div></div></div><small id="player-status"></small></div><div class="hud-center"><strong id="wave-label"></strong><span id="wave-time"></span><span id="run-status"></span></div><div class="hud-right"><span class="coins">${this.icon('cookie', 30)}<strong id="coin-label"></strong></span><button class="small" data-action="pause" aria-label="暂停游戏">Ⅱ</button></div></div><div class="boss-hud" hidden><strong>坏老板</strong><div class="boss-meter"><div id="boss-fill"></div></div><span id="boss-hp"></span></div><div class="bottom-hud"><div class="inventory" id="equipment-summary"></div><span id="reload-label"></span></div><div class="touch-zone"><div class="joystick" id="joystick" role="group" aria-label="拖动摇杆移动"><div class="stick"></div></div></div><div class="aim-zone"><div class="aim-pad" id="aim-pad" role="group" aria-label="按住连续射击，拖动瞄准"><div class="aim-stick"></div><span class="aim-hint">按住射击</span></div></div><div class="touch-actions"><button class="skill-button" data-action="skill"><span class="action-art" id="skill-icon">${this.icon(s.ability.icon, 40)}</span><span id="skill-name">${s.ability.name}</span><span class="action-meter" id="skill-meter" role="progressbar" aria-label="技能冷却" aria-valuemin="0" aria-valuemax="100"><span class="action-fill" id="skill-fill"></span></span><span class="action-key">空格</span></button>${characters[s.characterId].forms.length > 1 ? `<button class="skill-button switch-button" data-action="switch"><span class="action-art" id="switch-icon">${this.icon(s.form === 'heart' ? 'signal-0' : 'heart-0', 40)}</span><span>切换伙伴</span><span class="action-meter" id="switch-meter" role="progressbar" aria-label="切换冷却" aria-valuemin="0" aria-valuemax="100"><span class="action-fill" id="switch-fill"></span></span><span class="action-key">Q</span></button>` : ''}<div class="item-slots" id="item-slots"></div></div>`;
  }
  private overlay(): string {
    const s = this.session!; if (this.info) return '';
    if (s.paused) return this.modal('歇一小会儿', `<p class="lead">苹果已经收好，准备好了再继续。</p><div class="modal-actions modal-actions--stack"><button class="primary" data-action="resume">继续冒险</button><button class="secondary" data-action="settings">声音与画面</button><button class="secondary danger" data-action="abandon">结束本局</button></div>`, 'paused-panel');
    if (s.phase === 'shop') return this.modal('果园小铺', renderShop(s, (name, size, extra) => this.icon(name, size, extra)), 'shop-modal');
    if (s.result) {
      const r = s.result;
      return this.modal(r.reason === 'victory' ? '守住苹果园啦！' : r.reason === 'abandon' ? '先休息一下' : '下次会更勇敢', `<div class="result-portrait">${this.icon(`${s.form}-0`, 120)}</div><p class="lead">${r.reason === 'victory' ? '伙伴们终于可以放心摘苹果了。下次坏老板会带来更强的帮手。' : r.reason === 'abandon' ? '这趟冒险先到这里，下次再来看看。' : '在成长里学一点新本领，再和伙伴出发吧。'}</p><div class="result-stats"><div><strong>${r.wave}</strong><span>抵达波次</span></div><div><strong>+${r.talentPointsEarned}</strong><span>成长积分</span></div><div><strong>${r.bossesDefeated}</strong><span>击退坏老板</span></div><div><strong>${r.kills}</strong><span>击败怪物</span></div><div><strong>${r.coinsEarned}</strong><span>收获饼干币</span></div><div><strong>${Math.floor(r.elapsed / 60)}:${Math.floor(r.elapsed % 60).toString().padStart(2, '0')}</strong><span>冒险时间</span></div></div><div class="modal-actions"><button class="primary" data-action="restart">再来一次</button><button class="secondary" data-action="growth">成长</button><button class="secondary" data-action="menu">选择伙伴</button></div>`, 'result-modal');
    }
    return '';
  }
  private equipmentHtml(): string {
    const owned = Object.entries(this.session!.equipment).filter(([, count]) => count > 0);
    return owned.length ? owned.map(([id, count]) => `<span class="inventory-chip" title="${items[id].description}">${this.icon(items[id].icon, 26)}<span>${items[id].name}${count > 1 ? ` ×${count}` : ''}</span></span>`).join('') : '';
  }
  private modal(title: string, body: string, extra = ''): string { return `<div class="modal-shade"><section class="modal ${extra}" role="dialog" aria-modal="true" aria-label="${title}"><header class="modal-header"><h2>${title}</h2></header>${body}</section></div>`; }
  private infoModal(): string {
    if (!this.info) return '';
    const close = '<button class="close-button" data-action="close-info" aria-label="关闭">×</button>';
    if (this.info === 'details' && this.detail) {
      const detail = renderDetails(this.detail.kind, this.detail.id, this.session, (name, size, extra) => this.icon(name, size, extra), this.profile);
      return this.modal(detail.title, `${close}${detail.body}<footer class="modal-actions"><button class="primary" data-action="close-info">知道了</button></footer>`, 'detail-modal');
    }
    if (this.info === 'growth') return this.modal('成长', `${close}${renderMeta(this.profile, (name, size, extra) => this.icon(name, size, extra))}<footer class="modal-actions"><button class="primary" data-action="close-info">完成</button></footer>`, 'growth-modal');
    if (this.info === 'settings') {
      const rows: [keyof Settings, string, string][] = [
        ['autoAim', '自动索敌与开火', '开启时自动攻击附近目标。关闭后用鼠标瞄准、按住左键连续射击；手机按住右摇杆连续射击，拖动瞄准。'],
        ['music', '果园背景音乐', '冒险时播放果园的旋律。'],
        ['sound', '攻击与按钮音效', '射击、命中、拾取与按钮的声音反馈。'],
        ['shake', '画面动态反馈', '攻击与受伤时的轻微震动，以及界面的呼吸和过渡动画。']
      ];
      return this.modal('操作、声音与画面', `${close}<div class="settings">${rows.map(([key, title, description]) => `<label class="setting-row"><span class="setting-copy"><strong id="setting-${key}">${title}</strong><small id="setting-${key}-description">${description}</small></span><input class="setting-switch" role="switch" type="checkbox" aria-labelledby="setting-${key}" aria-describedby="setting-${key}-description" data-option="${key}" ${this.settings[key] ? 'checked' : ''}></label>`).join('')}</div><footer class="modal-actions"><button class="primary" data-action="close-info">完成</button></footer>`, 'settings-modal');
    }
    const instructions = [
      ['boots', '选择适合你的操作', '默认自动寻找目标并开火。设置中可关闭：电脑WASD移动、鼠标瞄准、按住左键连续射击；手机左摇杆移动，按住右摇杆连续射击、拖动瞄准。'],
      ['ring', '把握技能时机', '空格或右下按钮使用技能。兔狗按 Q 切换伙伴；1 / 2 / 3 使用对应一次性道具。'],
      ['hat', '休整，再出发', '每波结束到小铺购买饰品、强化武器或补充道具。菜单和商店支持WASD/方向键选择，空格/回车确认。'],
      ['star', '把勇气变成本领', `一趟冒险共 ${stages.length} 波，击退最后的坏老板即可获胜。成长积分为抵达波次 × 5，通关额外获得 10 积分；主动结束不获积分。回到成长页学习永久本领。`]
    ];
    return this.modal('一起守住苹果园', `${close}<div class="instruction-grid">${instructions.map(([icon, title, text]) => `<div class="instruction-item">${this.icon(icon, 48)}<h3>${title}</h3><p>${text}</p></div>`).join('')}</div><footer class="modal-actions"><button class="primary" data-action="close-info">知道啦</button></footer>`);
  }
  private updateHud(): void {
    const s = this.session!; const p = s.player;
    const text = (id: string, value: string) => { const e = document.getElementById(id); if (e && e.textContent !== value) e.textContent = value; };
    const fill = (id: string, fraction: number) => { const e = document.getElementById(id); if (e) e.style.width = `${clamp(fraction * 100, 0, 100)}%`; };
    text('hp-label', `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`);
    fill('hp-fill', p.hp / p.maxHp);
    const shield = document.getElementById('shield-status');
    if (shield) shield.hidden = p.maxShield <= 0 && p.shield <= 0;
    text('shield-label', `${Math.ceil(p.shield)} / ${Math.round(Math.max(p.maxShield, p.shield))}`);
    fill('shield-fill', p.shield / Math.max(1, p.maxShield, p.shield));
    text('player-status', p.invulnerable > 0 ? '保护中' : '');
    const biomeNames: Record<BiomeId, string> = { grass: '草地', forest: '森林', sand: '沙地', water: '水边' };
    text('coin-label', Math.floor(p.coins).toString()); text('wave-label', `第 ${s.wave} / ${stages.length} 波`);
    text('wave-time', s.stage.boss ? '坏老板来了' : `${Math.ceil(s.waveTime)} 秒`);
    text('run-status', biomeNames[s.biome]);
    const skillFraction = 1 - p.skillCooldown / Math.max(.001, p.skillMaxCooldown);
    fill('skill-fill', skillFraction); fill('switch-fill', 1 - s.switchCooldown / 4);
    document.getElementById('skill-meter')?.setAttribute('aria-valuenow', String(Math.round(clamp(skillFraction, 0, 1) * 100)));
    document.getElementById('switch-meter')?.setAttribute('aria-valuenow', String(Math.round(clamp(1 - s.switchCooldown / 4, 0, 1) * 100)));
    text('reload-label', `武器 Lv.${s.weaponLevel} · 击败 ${s.kills}${s.followers.length ? ` · 跟班 ${s.followers.length}` : ''}`);
    const boss = s.enemies.find(e => e.active && enemyDefs[e.kind].behavior === 'boss');
    const bossHud = root.querySelector<HTMLElement>('.boss-hud'); if (bossHud) bossHud.hidden = !boss;
    if (boss) { fill('boss-fill', boss.hp / boss.maxHp); text('boss-hp', `${Math.ceil(boss.hp)} / ${Math.round(boss.maxHp)}`); }
    const token = JSON.stringify([s.inventory, s.equipment, s.form, s.ability.id]);
    if (token !== this.lastInventory) {
      this.lastInventory = token;
      const equipment = document.getElementById('equipment-summary'); if (equipment) equipment.innerHTML = this.equipmentHtml();
      const slots = document.getElementById('item-slots');
      if (slots) slots.innerHTML = s.inventory.map((id, i) => `<button class="item-button" data-item="${i}" aria-label="${id ? `使用${items[id].name}` : `道具栏${i + 1}，空`}" ${id ? '' : 'disabled'}>${id ? this.icon(items[id].icon, 36) : '<span class="empty-slot">＋</span>'}<span>${id ? items[id].name : '空位'}</span><span class="action-key">${i + 1}</span></button>`).join('');
      const skillIcon = document.getElementById('skill-icon'); if (skillIcon) skillIcon.innerHTML = this.icon(s.ability.icon, 40);
      text('skill-name', s.ability.name);
      const switchIcon = document.getElementById('switch-icon'); if (switchIcon) switchIcon.innerHTML = this.icon(s.form === 'heart' ? 'signal-0' : 'heart-0', 40);
    }
    const canAct = s.phase === 'running' && !s.paused;
    const skill = root.querySelector<HTMLButtonElement>('[data-action="skill"]');
    if (skill) skill.disabled = p.skillCooldown > 0 || !canAct;
    skill?.classList.toggle('ready', p.skillCooldown <= 0 && canAct);
    const switchButton = root.querySelector<HTMLButtonElement>('[data-action="switch"]');
    if (switchButton) switchButton.disabled = s.switchCooldown > 0 || !canAct;
    switchButton?.classList.toggle('ready', s.switchCooldown <= 0 && canAct);
    root.querySelector('.hud')?.classList.toggle('low-health', p.hp / p.maxHp < 0.3);
  }
  private start(): void {
    this.info = null; this.detailReturn = null; this.resumeAfterInfo = false; this.lastProgressRevision = -1; this.lastWave = 0;
    this.session = new Session(this.selected, this.profile);
    this.scene!.resize(); this.unlockMusic(); this.render();
  }
  private click(event: MouseEvent): void {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return; Sfx.ui();
    if (button.dataset.infoKind) {
      this.detailReturn = this.info === 'growth' ? 'growth' : null;
      if (!this.info) this.pauseForInfo();
      this.detail = { kind: button.dataset.infoKind as DetailKind, id: button.dataset.infoId! };
      this.info = 'details'; this.render(); return;
    }
    if (button.dataset.character) { this.selected = button.dataset.character; this.render(); return; }
    if (button.dataset.talent) {
      if (this.session && !this.session.result) return;
      const profile = buyTalent(this.profile, button.dataset.talent);
      if (profile) {
        this.profile = profile; persistProfile(profile); this.render();
        root.querySelector<HTMLElement>(`[data-talent="${button.dataset.talent}"]:not(:disabled)`)?.focus({ preventScroll: true });
      }
      return;
    }
    if (button.dataset.buy) { if (!this.session!.buy(button.dataset.buy)) this.toast('饼干不够，或道具栏已满。'); this.render(); return; }
    if (button.dataset.item !== undefined) { if (!this.session!.useItem(Number(button.dataset.item))) this.toast('现在还不能使用。'); return; }
    switch (button.dataset.action) {
      case 'start': case 'restart': this.start(); break;
      case 'menu': this.session = null; this.render(); break;
      case 'pause': this.session!.pause(); this.render(); break;
      case 'resume': this.session!.resume(); this.render(); break;
      case 'abandon': this.session!.abandon(); this.session!.resume(); this.render(); break;
      case 'next': this.session!.nextWave(); this.scene!.resize(); this.render(); break;
      case 'reroll': this.session!.reroll(); this.render(); break;
      case 'skill': this.session!.activateSkill(); break;
      case 'switch': this.session!.switchForm(); break;
      case 'growth': if (this.session && !this.session.result) break; this.pauseForInfo(); this.info = 'growth'; this.render(); break;
      case 'help': case 'settings': this.pauseForInfo(); this.info = button.dataset.action; this.render(); break;
      case 'close-info': this.closeInfo(); break;
    }
  }
  private pauseForInfo(): void {
    this.resumeAfterInfo = this.session?.phase === 'running' && !this.session.paused;
    if (this.resumeAfterInfo) this.session!.pause();
  }
  private closeInfo(): void {
    if (this.detailReturn) { this.info = this.detailReturn; this.detailReturn = null; }
    else { this.info = null; if (this.resumeAfterInfo) this.session?.resume(); this.resumeAfterInfo = false; }
    this.render();
  }
  private change(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.dataset.option) {
      this.settings[target.dataset.option as keyof Settings] = target.checked;
      Sfx.setEnabled(this.settings.sound);
      if (this.settings.music) this.unlockMusic(); else this.music.pause();
      try { localStorage.setItem('survivor:settings', JSON.stringify(this.settings)); } catch { /* 本次会话仍生效。 */ }
      if (target.dataset.option === 'autoAim' || target.dataset.option === 'shake') { this.clearInput(); this.render(); }
    }
  }
  private unlockMusic(): void { if (this.settings.music) void this.music.play().catch(() => { /* 静音继续，不阻塞开局。 */ }); }
  private clearInput(): void { keys.clear(); this.stick = { x: 0, y: 0 }; this.pointerId = null; this.aimPointerId = null; this.mouseFiring = false; this.touchFiring = false; }
  private autoPause(): void { this.clearInput(); if (this.session?.phase === 'running' && !this.session.paused) { this.session.pause(); this.render(); } }
  private keyDown(event: KeyboardEvent): void {
    if (event.code === 'Escape') { if (this.info) this.closeInfo(); else if (this.session?.phase === 'running') { this.session.paused ? this.session.resume() : this.session.pause(); this.render(); } return; }
    const uiMode = !this.session || this.session.paused || this.session.phase !== 'running' || !!this.info;
    if (uiMode) {
      if ((event.target as Element).tagName === 'SELECT') return;
      const direction: Record<string, [number, number]> = { KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0], KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1] };
      if (direction[event.code]) { event.preventDefault(); this.navigate(...direction[event.code]); return; }
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault(); if (event.repeat) return;
        const scope = root.querySelector('.modal') ?? root.querySelector('.menu');
        const focused = document.activeElement as HTMLElement;
        if (!this.session && !this.info && (!root.contains(focused) || focused.dataset.character)) this.start();
        else {
          const fallback = !this.info && this.session?.phase === 'shop' ? '[data-action="next"]' : 'button:not(:disabled)';
          const focusedControl = scope?.contains(focused) || (!this.session && !this.info && focused.closest('.app-header'));
          (focusedControl ? focused : scope?.querySelector<HTMLElement>(fallback))?.click();
        }
      }
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    keys.add(event.code); if (event.repeat) return;
    if (!this.session) return;
    if (event.code === 'Space') this.session.activateSkill();
    if (event.code === 'KeyQ') this.session.switchForm();
    const slot = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code);
    if (slot >= 0) this.session.useItem(slot);
  }

  private navigate(dx: number, dy: number): void {
    const scope = root.querySelector('.modal') ?? root.querySelector('.menu');
    if (!scope) return;
    const controls = Array.from(scope.querySelectorAll<HTMLElement>('button:not(:disabled):not([data-info-kind]),select,input')).filter(e => e.getBoundingClientRect().width > 0);
    const current = controls.includes(document.activeElement as HTMLElement) ? document.activeElement as HTMLElement : controls.find(e => e.getAttribute('aria-pressed') === 'true') ?? controls[0];
    if (!current) return;
    const r = current.getBoundingClientRect(); const cx = r.x + r.width / 2; const cy = r.y + r.height / 2;
    const candidates = controls.filter(e => e !== current).map(e => {
      const b = e.getBoundingClientRect(); const x = b.x + b.width / 2 - cx; const y = b.y + b.height / 2 - cy;
      return { e, along: x * dx + y * dy, cost: Math.abs(x * dx + y * dy) + Math.abs(x * dy - y * dx) * 2 };
    }).filter(e => e.along > 5).sort((a, b) => a.cost - b.cost);
    const target = candidates[0]?.e ?? controls[(controls.indexOf(current) + (dx + dy > 0 ? 1 : controls.length - 1)) % controls.length];
    if (target.dataset.character) {
      this.selected = target.dataset.character; this.render();
      root.querySelector<HTMLElement>(`[data-character="${this.selected}"]`)!.focus();
    } else target.focus();
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  private pointerDown(event: PointerEvent): void {
    const aimPad = (event.target as Element).closest<HTMLElement>('#aim-pad');
    if (aimPad && this.aimPointerId === null && this.session?.phase === 'running' && !this.session.paused) {
      event.preventDefault(); this.aimPointerId = event.pointerId; this.touchFiring = true;
      const rect = aimPad.getBoundingClientRect(); this.aimCenter = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      aimPad.setPointerCapture(event.pointerId); this.pointerMove(event); return;
    }
    const pad = (event.target as Element).closest<HTMLElement>('#joystick');
    if (!pad || this.pointerId !== null || !this.session || this.session.paused) return;
    event.preventDefault(); this.pointerId = event.pointerId;
    const r = pad.getBoundingClientRect(); this.stickCenter = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    pad.setPointerCapture(event.pointerId); this.pointerMove(event);
  }
  private pointerMove(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && this.aimPointerId === null) this.updateMouseAim(event);
    if (event.pointerId === this.aimPointerId) {
      const x = (event.clientX - this.aimCenter.x) / 38; const y = (event.clientY - this.aimCenter.y) / 38; const length = Math.hypot(x, y);
      if (length > 0.15) this.aim = { x: x / length, y: y / length };
      const knob = document.querySelector<HTMLElement>('.aim-stick'); if (knob) knob.style.transform = `translate(${clamp(x, -1, 1) * 28}px,${clamp(y, -1, 1) * 28}px)`;
      return;
    }
    if (event.pointerId !== this.pointerId) return;
    const dx = (event.clientX - this.stickCenter.x) / 38; const dy = (event.clientY - this.stickCenter.y) / 38;
    const length = Math.hypot(dx, dy); const scale = length > 1 ? 1 / length : 1;
    this.stick = length < 0.12 ? { x: 0, y: 0 } : { x: dx * scale, y: dy * scale };
    const stick = document.querySelector<HTMLElement>('.stick'); if (stick) stick.style.transform = `translate(${this.stick.x * 28}px,${this.stick.y * 28}px)`;
  }
  private pointerUp(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && (event.button === 0 || event.type === 'pointercancel')) this.mouseFiring = false;
    if (event.pointerId === this.aimPointerId) {
      this.aimPointerId = null; this.touchFiring = false;
      const knob = document.querySelector<HTMLElement>('.aim-stick'); if (knob) knob.style.transform = '';
    }
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null; this.stick = { x: 0, y: 0 };
    const stick = document.querySelector<HTMLElement>('.stick'); if (stick) stick.style.transform = '';
  }

  private updateMouseAim(event: PointerEvent): void {
    if (!this.session || !this.scene) return;
    const point = this.scene.cameras.main.getWorldPoint(event.clientX, event.clientY);
    const dx = point.x - this.session.player.x; const dy = point.y - this.session.player.y; const length = Math.hypot(dx, dy);
    if (length > 1) this.aim = { x: dx / length, y: dy / length };
  }
  private toast(message: string): void {
    const element = root.querySelector<HTMLElement>('.toast'); if (!element) return;
    element.textContent = message; element.classList.add('visible'); window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => element.classList.remove('visible'), 2400);
  }
}

async function boot(): Promise<void> {
  const response = await fetch(`${base}assets/atlas.json`);
  if (!response.ok) throw new Error('图集清单加载失败');
  const app = new App(await response.json() as Atlas);
  const scene = new WorldScene(app);
  new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: innerWidth, height: innerHeight, backgroundColor: '#829867', pixelArt: true, roundPixels: true, scene: [scene], scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER } });
  if (import.meta.env.DEV) Object.assign(window, { __survivor: { app, content, get session() { return app.session; } } });
}
void boot().catch(() => {
  document.querySelector('#boot-label')!.textContent = '暂时没能打开果园，请检查网络后重试。';
  const retry = document.querySelector<HTMLButtonElement>('#boot-retry')!; retry.hidden = false; retry.onclick = () => location.reload();
});
