// 开发阶段生成像素图集；生成结果作为静态资源随游戏部署。
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { buildSprites, SIZE, palette } from '../art/sprites.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'public/assets');
const sprites=buildSprites();
const seen=new Set();
// 目前只有16、48、96三档大小；统一网格足够，不引入复杂打包器。
const columns=10;const padding=2;const cell=Math.max(...sprites.map(sprite=>Math.max(sprite.width,sprite.height)))+padding*2;const rows=Math.ceil(sprites.length/columns);
const atlas=new PNG({width:columns*cell,height:rows*cell});
const frames={};

function paste(target,sprite,x,y,scale=1,keepBackground=false){
  for(let sy=0;sy<sprite.height;sy++)for(let sx=0;sx<sprite.width;sx++){
    const si=(sy*sprite.width+sx)*4;
    if(keepBackground && sprite.data[si+3]===0)continue;
    for(let oy=0;oy<scale;oy++)for(let ox=0;ox<scale;ox++){
      const ti=((y+sy*scale+oy)*target.width+x+sx*scale+ox)*4;
      if(keepBackground){
        const alpha=sprite.data[si+3]/255;
        for(let channel=0;channel<3;channel++)target.data[ti+channel]=Math.round(sprite.data[si+channel]*alpha+target.data[ti+channel]*(1-alpha));
      }else target.data.set(sprite.data.subarray(si,si+4),ti);
    }
  }
}

sprites.forEach((sprite,i)=>{
  if(seen.has(sprite.name))throw new Error(`重复的素材帧：${sprite.name}`);seen.add(sprite.name);
  const x=(i%columns)*cell+padding;const y=Math.floor(i/columns)*cell+padding;
  paste(atlas,sprite,x,y);
  frames[sprite.name]={frame:{x,y,w:sprite.width,h:sprite.height},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:sprite.width,h:sprite.height},sourceSize:{w:sprite.width,h:sprite.height}};
});

await mkdir(out,{recursive:true});
await writeFile(resolve(out,'atlas.png'),PNG.sync.write(atlas));
await writeFile(resolve(out,'atlas.json'),JSON.stringify({frames,meta:{app:'RabbitSurvivor pixel pipeline',version:'1.0',image:'atlas.png',format:'RGBA8888',size:{w:atlas.width,h:atlas.height},scale:'1'}},null,2)+'\n');
const animations={};
animations.boss={idle:['boss-0','boss-2'],walk:['boss-0','boss-1','boss-2','boss-3'],frameRate:7};
animations.bubbleRing={idle:['bubble-ring-0','bubble-ring-1','bubble-ring-2','bubble-ring-3'],frameRate:5};
const terrain=Object.fromEntries(['grass','forest','beach','sea'].map(kind=>[kind,[`terrain-${kind}`,`terrain-${kind}-1`]]));
await writeFile(resolve(out,'manifest.json'),JSON.stringify({schemaVersion:1,atlases:{game:{image:'assets/atlas.png',data:'assets/atlas.json'}},defaultFrameSize:[SIZE,SIZE],terrain,animations,palette,frames:sprites.map(s=>s.name)},null,2)+'\n');

// 仅供开发检查的放大联络表，不放入玩家发布资源目录。
const previewCols=8;const previewCell=128;const previewRows=Math.ceil(sprites.length/previewCols);
const preview=new PNG({width:previewCols*previewCell,height:previewRows*previewCell});
for(let y=0;y<preview.height;y++)for(let x=0;x<preview.width;x++){
  const i=(y*preview.width+x)*4;const tile=(Math.floor(x/8)+Math.floor(y/8))%2;preview.data.set(tile?[242,232,211,255]:[249,243,227,255],i);
}
sprites.forEach((sprite,i)=>{
  const scale=Math.max(1,Math.floor(96/Math.max(sprite.width,sprite.height)));
  paste(preview,sprite,(i%previewCols)*previewCell+Math.floor((previewCell-sprite.width*scale)/2),Math.floor(i/previewCols)*previewCell+Math.floor((previewCell-sprite.height*scale)/2),scale,true);
});
await mkdir(resolve(root,'.verify'),{recursive:true});
await writeFile(resolve(root,'.verify/assets-preview.png'),PNG.sync.write(preview));
console.log(`生成 ${sprites.length} 个像素帧：${atlas.width}×${atlas.height} PNG图集，全部离线完成。`);
