export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** 地图相对视口的默认倍数；角色可通过 CharacterDef.mapScale 覆盖（例如更小的地图） */
export const DEFAULT_MAP_SCALE = 1.5;

/** 开发调试开关：URL 带 ?debug 时启用快捷测试键（生产环境自动关闭） */
export const DEBUG =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

/** BGM 音量（0-1） */
export const BGM_VOLUME = 0.4;

/** 程序化音效主音量（0-1） */
export const SFX_VOLUME = 0.6;

export const SCENE_KEYS = {
  Boot: 'Boot',
  Menu: 'Menu',
  CharacterSelect: 'CharacterSelect',
  Game: 'Game',
  Shop: 'Shop',
  LevelUp: 'LevelUp',
  Pause: 'Pause',
  GameOver: 'GameOver'
} as const;

/** 全局调色板（程序化图形统一取色） */
export const COLORS = {
  bg: 0x11121a,
  grid: 0x1c1e2b,
  gridLine: 0x232638,
  /** 地图外部区域颜色（与地图内网格底色形成区分） */
  mapOutside: 0x05060b,
  /** 地图边界描边颜色 */
  mapBorder: 0x3a3f5c,
  player: 0x4dd0e1,
  playerAim: 0xffffff,
  chaser: 0xff6b6b,
  brute: 0xb44bd6,
  shooter: 0xff922b,
  bullet: 0xffe066,
  enemyBullet: 0xff4d8d,
  material: 0xffd23f,
  heal: 0x51cf66,
  hpBarBack: 0x2b2d3a,
  hpBarFill: 0xff4757,
  textLight: '#eceff4',
  textDim: '#8b93a7',
  gold: '#ffd23f'
} as const;

/** 渲染层级 */
export const DEPTH = {
  bg: 0,
  pickup: 5,
  enemy: 10,
  player: 20,
  projectile: 30,
  fx: 40,
  hud: 100,
  banner: 110,
  shop: 200
} as const;
