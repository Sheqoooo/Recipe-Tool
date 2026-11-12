// Original vector-style artwork, rasterized reproducibly without fonts or external services.
import {deflateSync} from 'node:zlib';
import {mkdir,writeFile} from 'node:fs/promises';
const ellipse=(cx,cy,rx,ry,color,angle=0)=>({color,inside:(x,y)=>{const dx=x-cx,dy=y-cy,c=Math.cos(angle),s=Math.sin(angle);return ((dx*c+dy*s)/rx)**2+((-dx*s+dy*c)/ry)**2<=1;}});
const line=(ax,ay,bx,by,width,color)=>({color,inside:(x,y)=>{const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));return (x-ax-t*dx)**2+(y-ay-t*dy)**2<=(width/2)**2;}});
const lemon=[ellipse(258,278,120,85,[239,179,27],-.45),ellipse(250,264,118,82,[255,210,51],-.45),ellipse(148,310,21,15,[255,210,51],-.45),ellipse(358,216,20,14,[255,210,51],-.45),line(193,211,182,163,12,[107,126,54]),ellipse(215,161,49,20,[89,150,76],-.4),ellipse(212,154,35,8,[124,180,85],-.4),ellipse(225,227,51,14,[255,231,122],-.45)];
const polygon=(points,color)=>({color,inside:(x,y)=>{let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [ax,ay]=points[i],[bx,by]=points[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)hit=!hit;}return hit;}});
const bag=[
 ellipse(204,185,26,76,[230,183,103],-.35),
 line(179,146,212,153,6,[248,216,158]),line(185,174,222,182,6,[248,216,158]),
 ellipse(295,172,34,54,[85,145,77],.4),ellipse(322,184,25,44,[116,164,82],-.45),ellipse(280,145,20,31,[139,185,93],-.35),
 ellipse(273,221,34,33,[222,91,72]),ellipse(288,207,17,24,[234,112,83]),
 polygon([[326,191],[352,197],[348,256],[317,252]],[133,177,192]),line(335,179,354,183,12,[86,138,158]),
 polygon([[146,235],[366,235],[342,386],[170,386]],[208,161,96]),
 polygon([[333,235],[366,235],[342,386],[319,386]],[179,129,73]),
 polygon([[158,244],[321,244],[310,377],[180,377]],[220,178,118]),
 line(214,271,214,223,11,[146,101,57]),line(214,223,224,202,11,[146,101,57]),line(224,202,246,193,11,[146,101,57]),
 line(246,193,270,201,11,[146,101,57]),line(270,201,282,222,11,[146,101,57]),line(282,222,282,271,11,[146,101,57]),
 ellipse(244,323,24,15,[106,152,80],-.45),line(231,333,260,306,4,[162,189,112])
];
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const tag=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,data])));return Buffer.concat([length,tag,data,crc]);}
export function iconPng(kind,size,appearance='auto'){
 const shopping=kind==='shopping',transparent=shopping&&appearance==='auto',channels=transparent?4:3;
 const background=appearance==='dark'?[30,32,29]:[255,255,255],shapes=shopping?bag:lemon,raw=Buffer.alloc((size*channels+1)*size);
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
  await writeFile(output+'/icons/shopping-'+size+'.png',iconPng('shopping',size));
  for(const appearance of ['auto','light','dark'])await writeFile(output+'/icons/shopping-bag-'+appearance+'-'+size+'-v2.png',iconPng('shopping',size,appearance));
 }
}
