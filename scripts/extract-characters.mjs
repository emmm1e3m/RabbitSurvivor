// 手动离线重提取原图角色。只裁切和去背景，不重绘、不像素化。
// 示例：node scripts/extract-characters.mjs --sheet "角色参考/从左往右依次为：课代饼、三好兔、心好兔、信号狗、饼哩.png" --bingo "角色参考/饼狗.png"
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const args=Object.fromEntries(process.argv.slice(2).reduce((pairs,arg,index,list)=>{
  if(arg.startsWith('--'))pairs.push([arg.slice(2),list[index+1]]);
  return pairs;
},[]));
if(!args.sheet || !args.bingo)throw new Error('请明确提供 --sheet 五人参考图路径与 --bingo 饼狗原图路径。脚本不会自动读取或发布本地参考目录。');
const out=resolve(args.out??'.verify/reference-cutouts');
const sheet=PNG.sync.read(await readFile(resolve(args.sheet)));
const bingo=PNG.sync.read(await readFile(resolve(args.bingo)));

function crop(image,box){
  const [left,top,right,bottom]=box.map(Math.round);
  const result=new PNG({width:right-left,height:bottom-top});
  for(let y=0;y<result.height;y++){
    const start=((y+top)*image.width+left)*4;
    result.data.set(image.data.subarray(start,start+result.width*4),y*result.width*4);
  }
  return result;
}

function cutout(image,mode){
  const w=image.width,h=image.height,total=w*h;
  const bg=new Uint8Array(total),queue=new Uint32Array(total);let head=0,tail=0;
  const isBackground=(index)=>{
    const i=index*4,r=image.data[i],g=image.data[i+1],b=image.data[i+2];
    return mode==='blue' ? b>135 && b>r+55 && b>g+50 : r>222 && g>215 && b>199 && r-b<48;
  };
  const push=(index)=>{if(!bg[index] && isBackground(index)){bg[index]=1;queue[tail++]=index;}};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}
  for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
  while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w);}

  // 保留最大的连通前景，去掉与角色无关的纸纹、边框等残留。
  const seen=new Uint8Array(total);let largest=[];
  for(let start=0;start<total;start++)if(!bg[start]&&!seen[start]){
    const component=[];head=0;tail=0;queue[tail++]=start;seen[start]=1;
    while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);component.push(i);
      for(const n of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(n>=0&&!bg[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}
    }
    if(component.length>largest.length)largest=component;
  }
  const keep=new Uint8Array(total);for(const index of largest)keep[index]=1;
  const result=new PNG({width:w,height:h});
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const index=y*w+x;let nearForeground=false,nearBackground=false;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h){nearBackground=true;continue;}
      if(keep[ny*w+nx])nearForeground=true;else nearBackground=true;
    }
    if(!keep[index]&&!nearForeground)continue;
    const i=index*4,C=[image.data[i],image.data[i+1],image.data[i+2]];
    let alpha=keep[index]?1:0;
    let B=mode==='blue'?[2,94,249]:[253,249,238];
    // 边缘采用原图背景与深色外轮廓估计透明度，去除奶油色/蓝色边缘溢色。
    if(nearBackground){
      if(mode==='blue'){
        let bestBlue=-1;
        for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
          const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;
          const ni=ny*w+nx,offset=ni*4;
          if(bg[ni]){const color=[image.data[offset],image.data[offset+1],image.data[offset+2]],blue=color[2]-Math.max(color[0],color[1]);if(blue>bestBlue){bestBlue=blue;B=color;}}
        }
      }
      const F=mode==='blue'?[71,46,24]:[112,79,62];
      const vector=F.map((v,k)=>v-B[k]);
      alpha=Math.max(0,Math.min(1,C.reduce((sum,v,k)=>sum+(v-B[k])*vector[k],0)/vector.reduce((sum,v)=>sum+v*v,0)));
      if(alpha<.06)continue;
    }
    for(let k=0;k<3;k++)result.data[i+k]=nearBackground?Math.round(Math.max(0,Math.min(255,(C[k]-(1-alpha)*B[k])/alpha))):C[k];
    result.data[i+3]=Math.round(alpha*255);
  }
  let minX=w,minY=h,maxX=0,maxY=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(result.data[(y*w+x)*4+3]>8){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  if(minX>=maxX)throw new Error('未找到角色前景，请检查参考图。');
  const padding=12,trimmed=new PNG({width:maxX-minX+1+padding*2,height:maxY-minY+1+padding*2});
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const i=(y*w+x)*4,ti=((y-minY+padding)*trimmed.width+x-minX+padding)*4;
    trimmed.data.set(result.data.subarray(i,i+4),ti);
  }
  return trimmed;
}

const ratioX=sheet.width/1881,ratioY=sheet.height/836;
const boxes={classrep:[34,190,350,666],goodrabbit:[404,173,738,666],heart:[778,172,1112,666],signal:[1137,213,1472,666]};
const extracted=[];
await mkdir(out,{recursive:true});
for(const [name,box] of Object.entries(boxes)){
  const frame=cutout(crop(sheet,box.map((v,i)=>v*(i%2?ratioY:ratioX))),'paper');
  await writeFile(resolve(out,`${name}.png`),PNG.sync.write(frame));extracted.push({name,image:frame});
}
const dog=cutout(bingo,'blue');await writeFile(resolve(out,'bingo.png'),PNG.sync.write(dog));extracted.splice(2,0,{name:'bingo',image:dog});

// 仅供检查的原图抠图预览，背景棋盘用来检查透明边缘，不作为玩家素材。
const cellW=256,cellH=520,preview=new PNG({width:cellW*extracted.length,height:cellH});
for(let y=0;y<preview.height;y++)for(let x=0;x<preview.width;x++){
  const color=(Math.floor(x/14)+Math.floor(y/14))%2?[221,223,217,255]:[245,244,237,255];preview.data.set(color,(y*preview.width+x)*4);
}
for(let n=0;n<extracted.length;n++){
  const source=extracted[n].image,scale=Math.min(224/source.width,472/source.height),dw=Math.round(source.width*scale),dh=Math.round(source.height*scale),ox=n*cellW+Math.floor((cellW-dw)/2),oy=Math.floor((cellH-dh)/2);
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
    const sx=Math.min(source.width-1,Math.round(x/scale)),sy=Math.min(source.height-1,Math.round(y/scale)),si=(sy*source.width+sx)*4,ti=((oy+y)*preview.width+ox+x)*4,a=source.data[si+3]/255;
    for(let k=0;k<3;k++)preview.data[ti+k]=Math.round(source.data[si+k]*a+preview.data[ti+k]*(1-a));
  }
}
await mkdir(resolve('.verify'),{recursive:true});await writeFile(resolve('.verify/characters-cutout-preview.png'),PNG.sync.write(preview));
console.log(extracted.map(({name,image})=>`${name}: ${image.width}×${image.height}`).join('\n'));
