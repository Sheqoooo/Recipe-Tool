import type {MediaPayload} from '../src/shared/types.js';
export type PreparedVideo=MediaPayload;
function base64(bytes:Uint8Array):string{let text='';for(let at=0;at<bytes.length;at+=16384)text+=String.fromCharCode(...bytes.subarray(at,at+16384));return btoa(text);}
function wait(video:HTMLVideoElement,event:string,ready:()=>boolean):Promise<void>{
 if(ready())return Promise.resolve();
 return new Promise((resolve,reject)=>{const done=()=>{clearTimeout(timer);video.removeEventListener(event,success);video.removeEventListener('error',failure);};const success=()=>{done();resolve();};const failure=()=>{done();reject(new Error('Dieses Videoformat kann der Browser nicht zuverlässig lesen. Bitte Beschreibung oder Transkript verwenden.'));};const timer=setTimeout(failure,15000);video.addEventListener(event,success,{once:true});video.addEventListener('error',failure,{once:true});});
}
export async function prepareVideo(file:File,progress:(text:string)=>void):Promise<PreparedVideo>{
 if(!['video/mp4','video/webm','video/quicktime'].includes(file.type)||!file.size||file.size>20000000)throw new Error('Bitte ein MP4-, MOV- oder WebM-Video mit höchstens 20 MB auswählen.');
 const url=URL.createObjectURL(file),video=document.createElement('video');video.preload='auto';video.muted=true;video.playsInline=true;
 try{
  progress('Video wird auf deinem Gerät vorbereitet …');video.src=url;
  await wait(video,'loadedmetadata',()=>video.readyState>=1);
  if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>180)throw new Error('Videoimporte sind auf drei Minuten begrenzt.');
  if(Math.max(video.videoWidth,video.videoHeight)>3840||Math.min(video.videoWidth,video.videoHeight)>2160||!video.videoWidth)throw new Error('Bitte ein Video bis 4K-Auflösung verwenden.');
  const duration=video.duration,frames:string[]=[],canvas=document.createElement('canvas');
  const scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
  const context=canvas.getContext('2d');if(!context)throw new Error('Bildaufbereitung wird von diesem Browser nicht unterstützt.');
  for(let i=0;i<6;i++){
   const target=Math.max(.001,Math.min(duration-.001,duration*(i+.5)/6));video.currentTime=target;
   await wait(video,'seeked',()=>!video.seeking&&video.readyState>=2);
   context.drawImage(video,0,0,canvas.width,canvas.height);
   let image=canvas.toDataURL('image/jpeg',.65);if(image.length>266690)image=canvas.toDataURL('image/jpeg',.35);
   if(image.length>266690)throw new Error('Die Einzelbilder sind zu groß. Bitte das Video verkleinern oder die Beschreibung verwenden.');frames.push(image);
  }
  progress('Tonspur wird auf deinem Gerät vorbereitet …');
  const decoder=new OfflineAudioContext(1,16000,16000);let decoded:AudioBuffer;
  try{decoded=await decoder.decodeAudioData(await file.arrayBuffer());}catch{throw new Error('Die Tonspur kann auf diesem Gerät nicht gelesen werden. Bitte Beschreibung oder Transkript verwenden.');}
  if(!Number.isFinite(decoded.duration)||decoded.duration<=0||decoded.duration>180)throw new Error('Die Tonspur darf höchstens drei Minuten lang sein.');
  const count=Math.ceil(decoded.duration*16000),offline=new OfflineAudioContext(1,count,16000),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
  const mono=(await offline.startRendering()).getChannelData(0),wav=new Uint8Array(44+mono.length*2),v=new DataView(wav.buffer);
  const word=(at:number,text:string)=>{for(let i=0;i<text.length;i++)wav[at+i]=text.charCodeAt(i);};
  word(0,'RIFF');v.setUint32(4,wav.length-8,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,mono.length*2,true);
  for(let i=0;i<mono.length;i++){const sample=Math.max(-1,Math.min(1,mono[i]));v.setInt16(44+i*2,sample<0?sample*32768:sample*32767,true);}
  progress('Ton und Einzelbilder werden ausgewertet …');return {audio:base64(wav),frames};
 }finally{video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}
