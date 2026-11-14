// Original vector-style artwork, rasterized reproducibly without fonts or external services.
import {deflateSync} from 'node:zlib';
import {mkdir,writeFile} from 'node:fs/promises';
const ellipse=(cx,cy,rx,ry,color,angle=0)=>({color,inside:(x,y)=>{const dx=x-cx,dy=y-cy,c=Math.cos(angle),s=Math.sin(angle);return ((dx*c+dy*s)/rx)**2+((-dx*s+dy*c)/ry)**2<=1;}});
const line=(ax,ay,bx,by,width,color)=>({color,inside:(x,y)=>{const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));return (x-ax-t*dx)**2+(y-ay-t*dy)**2<=(width/2)**2;}});
const lemon=[ellipse(258,278,120,85,[239,179,27],-.45),ellipse(250,264,118,82,[255,210,51],-.45),ellipse(148,310,21,15,[255,210,51],-.45),ellipse(358,216,20,14,[255,210,51],-.45),line(193,211,182,163,12,[107,126,54]),ellipse(215,161,49,20,[89,150,76],-.4),ellipse(212,154,35,8,[124,180,85],-.4),ellipse(225,227,51,14,[255,231,122],-.45)];
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const tag=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,data])));return Buffer.concat([length,tag,data,crc]);}
export function iconPng(kind,size){
 if(kind!=='recipes')throw new Error('Unsupported app icon');
 const transparent=false,channels=3,background=[255,255,255],shapes=lemon,raw=Buffer.alloc((size*channels+1)*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const sums=[0,0,0];let alpha=0;
  for(const [ox,oy]of [[.25,.25],[.75,.25],[.25,.75],[.75,.75]]){
   const px=(x+ox)*512/size,py=(y+oy)*512/size;let color=background,covered=!transparent;
   for(const shape of shapes)if(shape.inside(px,py)){color=shape.color;covered=true;}
   if(covered){alpha+=255;for(let c=0;c<3;c++)sums[c]+=color[c];}
  }
  const at=y*(size*channels+1)+1+x*channels;
  for(let c=0;c<3;c++)raw[at+c]=alpha?Math.round(sums[c]/(alpha/255)):0;
  if(transparent)raw[at+3]=Math.round(alpha/4);
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=transparent?6:2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
export async function buildAppIcons(output){
 await mkdir(output+'/icons',{recursive:true});
 for(const size of [180,192,512]){
  await writeFile(output+'/icons/recipes-'+size+'.png',iconPng('recipes',size));
 }
}
