// 只准备已经由内置ImageGen直接生成的头像：整张等比缩小，不裁切、不去身体、不重绘。
// 用法：node scripts/prepare-character-images.mjs --sources sources.json [--out public/assets/characters]
// sources.json为内置工具实际返回的五张PNG路径映射，通常仅保存在.verify/。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const args=Object.fromEntries(process.argv.slice(2).reduce((pairs,arg,i,list)=>{if(arg.startsWith('--'))pairs.push([arg.slice(2),list[i+1]]);return pairs;},[]));
if(!args.sources)throw new Error('请提供 --sources，指向五个直接生成头像的实际路径。');
const sources=JSON.parse(await readFile(resolve(args.sources),'utf8'));
const output=resolve(args.out??'public/assets/characters');
await mkdir(output,{recursive:true});
const results=[],previews=[];
for(const id of ['classrep','goodrabbit','bingo','heart','signal']){
  if(typeof sources[id]!=='string')throw new Error(`缺少生成结果：${id}`);
  const image=PNG.sync.read(await readFile(sources[id]));
  const scale=Math.min(1,512/Math.max(image.width,image.height));
  const width=Math.round(image.width*scale),height=Math.round(image.height*scale),prepared=new PNG({width:512,height:512});
  const offsetX=Math.floor((512-width)/2),offsetY=Math.floor((512-height)/2);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const sx=Math.min(image.width-1,Math.floor(x/scale)),sy=Math.min(image.height-1,Math.floor(y/scale)),si=(sy*image.width+sx)*4;
    prepared.data.set(image.data.subarray(si,si+4),((y+offsetY)*512+x+offsetX)*4);
  }
  const file=resolve(output,`${id}.png`);await writeFile(file,PNG.sync.write(prepared));
  let transparent=0,nonTransparent=0;for(let i=3;i<prepared.data.length;i+=4){if(prepared.data[i]===0)transparent++;else nonTransparent++;}
  if(!transparent||!nonTransparent)throw new Error(`生成结果没有有效透明通道：${id}`);
  results.push({id,width:512,height:512,sourceDimensions:{width:image.width,height:image.height},transparentPixels:transparent,file});previews.push(prepared);
}
// 棋盘只用于开发预览，正式头像保留生成结果的真实透明通道。
const preview=new PNG({width:1280,height:280});
for(let y=0;y<preview.height;y++)for(let x=0;x<preview.width;x++){const checker=(Math.floor(x/12)+Math.floor(y/12))%2;preview.data.set(checker?[222,224,217,255]:[248,246,238,255],(y*preview.width+x)*4);}
for(let n=0;n<previews.length;n++)for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const image=previews[n],si=((y*2)*512+x*2)*4,ti=((y+12)*1280+n*256+x)*4,a=image.data[si+3]/255;
  for(let k=0;k<3;k++)preview.data[ti+k]=Math.round(image.data[si+k]*a+preview.data[ti+k]*(1-a));
}
await mkdir(resolve('.verify'),{recursive:true});await writeFile(resolve('.verify/characters-imagegen-heads.png'),PNG.sync.write(preview));
console.log(JSON.stringify(results,null,2));
