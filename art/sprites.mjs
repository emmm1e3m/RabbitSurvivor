// 敌人、场景和道具的离线像素源。五个可玩角色使用参考原图抠图，不在此绘制。
export const SIZE = 48;
export const palette = {
  ink: '#483735', deep: '#302d34', paper: '#fff7e7', white: '#fffdf1', shade: '#e9d7bb',
  skin: '#f7d9bd', skinShade: '#dfaa8f', brown: '#77533e', darkBrown: '#503b35',
  red: '#dc5650', redDark: '#a93642', coral: '#f58b79', pink: '#f3b4bd', pinkDark: '#d9879e',
  gold: '#f2c967', goldDark: '#c88c48', cream: '#f8dfa0', creamShade: '#deb77b',
  leaf: '#719d54', green: '#a3bd69', darkGreen: '#41674b', forest: '#375547',
  blue: '#7db5c3', blueDark: '#426a91', purple: '#9b88bd', purpleDark: '#695280',
};

const rgba = (hex) => {
  const text = hex.replace('#', '');
  return [parseInt(text.slice(0, 2), 16), parseInt(text.slice(2, 4), 16), parseInt(text.slice(4, 6), 16), text.length > 6 ? parseInt(text.slice(6, 8), 16) : 255];
};

export class PixelCanvas {
  constructor(width = SIZE, height = SIZE) {
    this.width = width; this.height = height;
    this.data = new Uint8Array(width * height * 4);
  }
  pixel(x, y, color) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.data.set(Array.isArray(color) ? color : rgba(color), (y * this.width + x) * 4);
  }
  rect(x, y, w, h, color) {
    for (let py = Math.round(y); py < y + h; py++) for (let px = Math.round(x); px < x + w; px++) this.pixel(px, py, color);
  }
  ellipse(x, y, w, h, color) {
    const cx = x + w / 2; const cy = y + h / 2;
    for (let py = Math.floor(y); py < y + h; py++) for (let px = Math.floor(x); px < x + w; px++) {
      if (((px + 0.5 - cx) / (w / 2)) ** 2 + ((py + 0.5 - cy) / (h / 2)) ** 2 <= 1) this.pixel(px, py, color);
    }
  }
  oval(x, y, w, h, fill, outline = palette.ink, thickness = 1) {
    this.ellipse(x, y, w, h, outline);
    this.ellipse(x + thickness, y + thickness, w - thickness * 2, h - thickness * 2, fill);
  }
  box(x, y, w, h, fill, outline = palette.ink, thickness = 1) {
    this.rect(x, y, w, h, outline);
    this.rect(x + thickness, y + thickness, w - thickness * 2, h - thickness * 2, fill);
  }
  polygon(points, color) {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) {
      const intersections = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i]; const b = points[(i + 1) % points.length];
        if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5)) intersections.push(a[0] + ((y + 0.5 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i + 1 < intersections.length; i += 2) for (let x = Math.ceil(intersections[i] - 0.5); x <= intersections[i + 1] - 0.5; x++) this.pixel(x, y, color);
    }
  }
  line(x0, y0, x1, y1, color, width = 1) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) this.rect(Math.round(x0 + ((x1 - x0) * i) / Math.max(1, steps)), Math.round(y0 + ((y1 - y0) * i) / Math.max(1, steps)), width, width, color);
  }
}

const P = palette;
const shadow = (c, y = 42, w = 24) => c.ellipse(24 - w / 2, y, w, 4, '#263d3150');
const heartShape = (c, x, y, scale = 1, fill = P.red) => {
  const rows = ['0110110','1111111','1111111','0111110','0011100','0001000'];
  rows.forEach((row, py) => [...row].forEach((v, px) => { if (v === '1') c.rect(x + px * scale, y + py * scale, scale, scale, fill); }));
};
const wifi = (c, x, y, color = P.redDark) => {
  c.rect(x + 2, y, 6, 1, color); c.rect(x, y + 1, 2, 1, color); c.rect(x + 8, y + 1, 2, 1, color);
  c.rect(x + 3, y + 3, 4, 1, color); c.pixel(x + 2, y + 4, color); c.pixel(x + 7, y + 4, color); c.rect(x + 4, y + 6, 2, 2, color);
};

function boss(frame) {
  const c = new PixelCanvas(); const bob = frame % 2;
    shadow(c, 43, 29);
    c.polygon([[15, 26 + bob], [33, 26 + bob], [40, 41], [8, 41]], P.deep);
    c.polygon([[16, 27 + bob], [23, 29 + bob], [22, 40], [10, 39]], '#48524e');
    c.polygon([[31, 27 + bob], [24, 29 + bob], [25, 40], [38, 39]], '#57605a');
    c.rect(21, 28 + bob, 7, 11, '#633c57'); c.rect(20, 30 + bob, 2, 9, '#2d3436');
    c.oval(11, 32 + bob, 7, 7, P.skin); c.oval(31, 33 + bob, 7, 7, P.skin);
    c.box(32, 29 + bob, 7, 12, '#ec8a34'); c.rect(34, 31 + bob, 3, 5, '#f7b052');
    c.rect(16, 40, 7, 5, P.deep); c.rect(26, 40, 7, 5, P.deep);
  c.oval(9, 19 + bob, 7, 10, P.skin); c.oval(33, 19 + bob, 7, 10, P.skin);
  c.oval(12, 11 + bob, 24, 22, P.skin);
  c.ellipse(15, 25 + bob, 20, 7, '#edc4aa');
  c.polygon([[10, 20 + bob], [9, 13 + bob], [12, 8 + bob], [20, 5 + bob], [30, 7 + bob], [36, 12 + bob], [37, 23 + bob], [33, 21 + bob], [29, 16 + bob], [27, 19 + bob], [23, 16 + bob], [21, 20 + bob], [17, 16 + bob], [15, 23 + bob]], P.ink);
  c.polygon([[11, 18 + bob], [11, 13 + bob], [14, 9 + bob], [21, 7 + bob], [30, 9 + bob], [34, 13 + bob], [35, 20 + bob], [30, 16 + bob], [27, 14 + bob], [26, 17 + bob], [22, 14 + bob], [20, 18 + bob], [16, 14 + bob], [14, 20 + bob]], '#5f5e50');
  c.line(15, 10 + bob, 24, 8 + bob, '#85816b');
  const glass = '#938b75';
  c.box(12, 22 + bob, 11, 7, '#fff4d6', glass); c.box(25, 22 + bob, 11, 7, '#fff4d6', glass); c.rect(23, 24 + bob, 2, 1, glass);
  c.rect(16, 24 + bob, 4, 3, P.ink); c.rect(28, 24 + bob, 4, 3, P.ink); c.pixel(16, 24 + bob, P.white); c.pixel(28, 24 + bob, P.white);
  c.line(26, 29 + bob, 30, 29 + bob, P.brown); c.rect(23, 31 + bob, 5, 1, P.brown);
  return c;
}

function cookieEnemy(kind) {
  const c = new PixelCanvas(); shadow(c);
  if (kind === 'elite') { c.oval(5, 10, 38, 33, P.goldDark, P.ink, 2); c.ellipse(10, 12, 28, 25, '#c7a069'); c.box(3, 24, 9, 15, '#7e8b84'); c.rect(5, 27, 5, 8, '#b2c1a8'); }
  else {
    c.oval(8, 12, 32, 30, P.goldDark, P.ink, 2); c.ellipse(11, 13, 26, 24, kind === 'exploder' ? '#c49b54' : P.gold);
    c.oval(6, 29, 8, 8, P.goldDark); c.oval(34, 29, 8, 8, P.goldDark);
  }
  [[13,18],[31,16],[17,33],[32,32],[24,13]].forEach(([x,y]) => c.rect(x,y,3,3,P.brown));
  c.rect(16, 24, 5, 4, P.ink); c.rect(27, 24, 5, 4, P.ink); c.rect(17, 24, 2, 1, P.white); c.rect(28, 24, 2, 1, P.white);
  c.line(15, 21, 20, 23, P.ink); c.line(27, 23, 32, 21, P.ink); c.rect(22, 31, 5, 2, P.ink);
  c.rect(12, 39, 8, 4, P.brown); c.rect(29, 39, 8, 4, P.brown);
  if (kind === 'charger') { c.polygon([[14,13],[17,4],[22,12]], P.ink); c.polygon([[26,12],[33,4],[34,15]], P.ink); c.polygon([[17,10],[18,7],[20,11]], P.coral); c.polygon([[29,11],[32,7],[32,12]], P.coral); c.box(18, 29, 12, 8, P.red); c.rect(21, 31, 6, 2, P.gold); }
  if (kind === 'exploder') { c.box(17,29,15,13,P.redDark); c.rect(19,31,11,9,P.red); c.polygon([[24,32],[20,38],[28,38]],P.gold); c.rect(24,34,1,2,P.ink); c.pixel(24,37,P.ink); c.line(24,28,27,22,P.ink); c.rect(25,20,3,3,P.gold); }
  if (kind === 'elite') { c.polygon([[11,13],[10,5],[17,9],[23,3],[29,9],[38,5],[37,15]],P.ink); c.polygon([[13,12],[12,8],[18,11],[23,6],[29,12],[35,8],[35,13]],P.gold); c.rect(21,10,4,3,P.red); }
  return c;
}

function noteEnemy() {
  const c = new PixelCanvas(); shadow(c, 42, 26);
  c.oval(9, 24, 25, 18, P.purpleDark, P.ink, 2); c.ellipse(11,25,19,11,P.purple);
  c.box(28, 9, 7, 25, P.purple); c.polygon([[28,10],[40,7],[40,17],[34,19],[34,13],[29,15]],P.ink); c.polygon([[31,10],[38,9],[38,14],[34,16],[34,12],[31,13]],P.blue);
  c.rect(14,30,4,4,P.deep); c.rect(24,29,4,4,P.deep); c.pixel(14,30,P.white); c.pixel(24,29,P.white); c.rect(20,36,4,2,P.pink);
  c.line(11,27,17,28,P.deep); c.line(24,27,29,25,P.deep);
  c.rect(7,37,5,2,P.pinkDark); c.rect(32,35,5,2,P.pinkDark);
  return c;
}

function tree() {
  const c = new PixelCanvas(); shadow(c, 43, 34);
  c.box(20, 23, 8, 21, P.brown); c.rect(22,29,2,13,'#ab7b4f'); c.line(23,31,15,25,P.brown,2); c.line(24,32,33,26,P.brown,2);
  c.oval(3, 11, 22, 24, P.darkGreen); c.oval(23, 10, 22, 24, P.darkGreen); c.oval(11, 1, 27, 28, P.darkGreen);
  c.ellipse(6,11,18,18,P.leaf); c.ellipse(24,12,18,18,P.leaf); c.ellipse(14,3,21,22,P.leaf);
  c.ellipse(12,8,15,10,P.green); c.rect(13,10,7,2,'#bbd07e'); c.rect(29,18,6,2,P.green); c.rect(8,23,6,2,P.green);
  [[12,21],[29,14],[31,27]].forEach(([x,y])=>{c.oval(x,y,6,6,P.red);c.rect(x+1,y+1,2,2,P.coral);c.rect(x+3,y-1,2,2,P.brown);});
  return c;
}

function barrel() {
  const c=new PixelCanvas(); shadow(c,42,28);
  c.oval(10,12,28,31,'#a9523d',P.ink,2); c.rect(12,15,24,22,'#b76444');
  c.rect(15,17,2,19,'#d08250');c.rect(24,17,2,19,'#854433');c.rect(32,17,2,19,'#d08250');
  c.box(10,18,28,5,'#6d7978');c.box(10,33,28,5,'#6d7978');c.ellipse(12,12,24,6,'#d48c57'); c.ellipse(15,13,18,3,'#85523d');
  c.box(18,24,12,9,P.gold); c.polygon([[24,25],[20,31],[28,31]],P.redDark); c.rect(23,27,2,2,P.ink);c.pixel(24,30,P.ink);
  return c;
}

function apple() {
  const c=new PixelCanvas(); c.oval(10,15,28,26,P.redDark);c.ellipse(12,15,24,23,P.red);c.ellipse(11,15,15,21,P.red);c.ellipse(22,15,15,21,P.red);c.rect(15,18,4,3,'#ffb18c');c.rect(14,21,3,5,P.coral);c.box(23,8,3,9,P.brown);c.oval(26,6,10,6,P.leaf);c.rect(29,7,3,2,P.green);return c;
}

function cookie() {
  const c=new PixelCanvas();c.oval(9,9,30,30,P.goldDark,P.ink,2);c.ellipse(12,11,24,24,P.gold);c.rect(14,13,6,2,'#ffe5a0');[[18,18],[28,16],[15,28],[27,29],[23,24]].forEach(([x,y])=>c.box(x,y,4,4,P.brown));return c;
}

function coin() {
  const c=new PixelCanvas();c.oval(12,7,24,34,P.goldDark,P.ink,2);c.ellipse(14,9,20,28,P.gold);c.oval(17,13,14,20,P.gold,P.goldDark);c.rect(22,16,3,14,P.goldDark);c.rect(20,19,7,2,P.goldDark);c.rect(15,13,2,7,'#fff3c4');return c;
}

function hat() {
  const c=new PixelCanvas();c.polygon([[11,30],[21,5],[25,8],[28,15],[33,31]],P.ink);c.polygon([[14,29],[21,9],[24,11],[26,19],[30,29]],P.purpleDark);c.polygon([[18,24],[22,12],[24,18],[25,25]],P.purple);c.box(8,29,32,7,P.purpleDark);c.rect(12,29,25,3,P.purple);c.rect(15,26,17,4,P.gold);c.box(23,26,5,5,P.goldDark);return c;
}

function bow() {
  const c=new PixelCanvas();c.polygon([[6,13],[20,18],[27,18],[42,13],[41,34],[28,28],[20,28],[7,34]],P.ink);c.polygon([[8,16],[20,20],[21,26],[9,31]],P.red);c.polygon([[28,20],[39,16],[39,31],[27,26]],P.red);c.rect(10,18,4,3,P.coral);c.rect(34,18,4,3,P.coral);c.box(21,18,7,11,P.redDark);c.rect(22,20,3,6,P.red);return c;
}

function lamp() {
  const c=new PixelCanvas();c.oval(18,5,12,10,P.goldDark);c.ellipse(20,7,8,7,'#00000000');c.box(13,13,23,4,P.goldDark);c.box(13,18,22,19,P.goldDark);c.rect(16,20,16,15,'#fff0a3');c.rect(23,20,2,15,P.goldDark);c.polygon([[23,23],[19,30],[22,32],[21,35],[28,29],[25,27]],'#f1ae4f');c.box(11,37,27,4,P.goldDark);c.rect(14,14,20,2,P.gold);c.rect(15,38,18,1,P.gold);return c;
}

function icon(name) {
  const c=new PixelCanvas();
  switch(name){
    case 'heart-icon':heartShape(c,10,11,4,P.ink);heartShape(c,12,12,3,P.red);c.rect(15,15,5,3,P.coral);break;
    case 'shield':c.polygon([[10,10],[24,6],[38,10],[36,29],[31,37],[24,42],[17,37],[12,29]],P.ink);c.polygon([[13,13],[24,9],[35,13],[33,28],[29,34],[24,38],[19,34],[15,27]],P.blueDark);c.polygon([[15,14],[24,11],[24,35],[20,32],[17,25]],P.blue);c.rect(22,17,4,12,P.paper);c.rect(18,21,12,4,P.paper);break;
    case 'xp':c.polygon([[24,6],[37,19],[33,34],[24,42],[15,34],[11,19]],P.ink);c.polygon([[24,9],[34,20],[30,32],[24,38],[18,32],[14,20]],P.blue);c.polygon([[24,11],[30,20],[24,25],[18,20]],'#c8e9d6');c.line(24,25,24,35,P.blueDark,2);break;
    case 'star':c.polygon([[24,5],[29,17],[43,18],[33,27],[36,42],[24,34],[12,42],[15,27],[5,18],[19,17]],P.ink);c.polygon([[24,10],[27,20],[37,21],[29,26],[32,36],[24,30],[16,36],[19,26],[11,21],[21,20]],P.gold);c.rect(22,17,3,8,'#fff0ad');break;
    case 'boots':c.box(8,12,13,24,P.brown);c.box(25,10,13,24,P.brown);c.box(8,29,18,11,'#9a6b4d');c.box(25,27,17,11,'#9a6b4d');c.rect(10,13,9,5,P.gold);c.rect(27,11,9,5,P.gold);c.rect(9,37,16,3,P.ink);c.rect(26,35,15,3,P.ink);break;
    case 'magnet':c.oval(10,9,28,31,P.ink);c.oval(15,12,18,22,P.red);c.ellipse(18,11,12,19,'#00000000');c.rect(10,7,11,17,P.red);c.rect(27,7,11,17,P.red);c.box(10,7,11,8,P.paper);c.box(27,7,11,8,P.paper);break;
    case 'ring':c.oval(10,13,28,28,P.goldDark,P.ink,2);c.ellipse(16,19,16,16,'#00000000');c.polygon([[24,3],[33,12],[24,22],[15,12]],P.ink);c.polygon([[24,6],[30,12],[24,18],[18,12]],P.blue);c.polygon([[24,6],[24,14],[18,12]],'#c8e9d6');break;
    case 'clover':c.oval(10,10,15,16,P.leaf);c.oval(23,10,15,16,P.leaf);c.oval(10,23,15,16,P.leaf);c.oval(23,23,15,16,P.leaf);c.rect(21,20,7,9,P.leaf);c.line(25,29,28,43,P.darkGreen,3);c.rect(14,13,5,2,P.green);c.rect(27,13,5,2,P.green);break;
    case 'projectile':c.oval(16,16,17,17,P.redDark);c.ellipse(17,17,14,14,P.red);c.rect(20,19,4,3,P.coral);c.rect(24,12,2,6,P.brown);c.oval(27,12,7,5,P.leaf);break;
    case 'enemy-shot':c.polygon([[24,12],[34,23],[24,36],[14,23]],P.ink);c.polygon([[24,15],[31,23],[24,32],[17,23]],P.pinkDark);c.rect(22,19,4,7,'#ffe4d4');break;
    case 'pixel':c.rect(20,20,8,8,P.paper);break;
    case 'heal-potion':c.box(18,6,12,7,P.brown);c.box(17,12,14,6,P.paper);c.oval(10,17,28,26,P.blueDark);c.ellipse(13,20,22,20,P.blue);c.rect(14,29,20,9,P.leaf);c.rect(22,23,4,13,P.white);c.rect(18,27,12,4,P.white);break;
    case 'blast':c.polygon([[23,4],[28,15],[41,11],[36,24],[44,31],[30,34],[25,45],[19,34],[6,37],[12,25],[4,17],[18,16]],P.redDark);c.polygon([[24,11],[27,21],[35,17],[30,26],[36,30],[27,31],[24,38],[21,29],[12,30],[17,24],[13,19],[21,21]],P.gold);break;
    case 'sword':c.polygon([[11,36],[33,9],[39,7],[39,15],[18,40]],P.ink);c.polygon([[17,33],[34,12],[36,12],[35,16],[20,35]],'#b9d5ce');c.polygon([[17,33],[34,12],[35,13],[19,35]],P.white);c.line(11,30,24,40,P.goldDark,4);c.line(9,40,14,35,P.brown,4);break;
    case 'book':c.box(10,9,28,33,P.brown);c.rect(13,10,22,28,P.redDark);c.rect(15,12,18,24,P.red);c.rect(13,36,22,3,P.paper);c.rect(11,12,2,24,P.goldDark);c.box(21,18,8,11,P.gold);break;
    case 'signal-icon':wifi(c,8,8,P.redDark);wifi(c,24,22,P.redDark);c.oval(8,29,9,9,P.pink);break;
  }
  return c;
}

function grass(variant) {
  const c=new PixelCanvas();c.rect(0,0,48,48,'#8ea477');
  const colors=['#829969','#91a87a','#a1b485','#7d9568'];
  for(let i=0;i<24;i++){const x=(i*17+variant*13)%48;const y=(i*11+variant*7)%48;c.rect(x,y,2+(i%3),1,colors[i%4]);}
  [[7,9],[31,28],[18,37]].forEach(([x,y],i)=>{x=(x+variant*9)%43;y=(y+variant*5)%44;c.line(x,y+3,x+1,y,'#678357');c.line(x+2,y+3,x+3,y+1,'#7f985f');if((variant+i)%3===0)c.pixel(x+1,y,'#c5c895');});
  return c;
}

function flower(variant) {
  const c=new PixelCanvas();const cols=[P.paper,P.pink,P.gold];c.line(23,24,23,39,P.darkGreen,2);c.ellipse(16,29,8,4,P.leaf);c.ellipse(24,32,7,4,P.leaf);[[20,17],[25,17],[18,22],[27,22],[22,26]].forEach(([x,y])=>c.ellipse(x,y,6,6,cols[variant]));c.ellipse(22,21,6,6,P.goldDark);return c;
}

export function buildSprites() {
  const sprites=[];
  const add=(name,canvas)=>sprites.push({name,width:canvas.width,height:canvas.height,data:canvas.data});
  for(let f=0;f<4;f++)add(`boss-${f}`,boss(f));
  add('cookie-enemy',cookieEnemy('normal'));add('note-enemy',noteEnemy());add('charger',cookieEnemy('charger'));add('elite',cookieEnemy('elite'));add('exploder',cookieEnemy('exploder'));add('tree',tree());add('barrel',barrel());
  add('apple',apple());add('cookie',cookie());add('coin',coin());add('hat',hat());add('bow',bow());add('lamp',lamp());
  for(const name of ['heart-icon','shield','xp','star','boots','magnet','ring','clover','projectile','enemy-shot','pixel','heal-potion','blast','sword','book','signal-icon'])add(name,icon(name));
  for(let i=0;i<4;i++)add(`grass-${i}`,grass(i));
  for(let i=0;i<3;i++)add(`flower-${i}`,flower(i));
  // 灰度副本在构建阶段生成，精英死亡不在玩家浏览器中烘焙纹理。
  for(const sprite of sprites.filter(s=>['elite','note-enemy','boss-0','boss-1','boss-2','boss-3'].includes(s.name))){
    const data=new Uint8Array(sprite.data);
    for(let i=0;i<data.length;i+=4){const v=Math.round(data[i]*.3+data[i+1]*.59+data[i+2]*.11);data[i]=v;data[i+1]=v;data[i+2]=v;}
    sprites.push({...sprite,name:`${sprite.name}-gray`,data});
  }
  return sprites;
}
