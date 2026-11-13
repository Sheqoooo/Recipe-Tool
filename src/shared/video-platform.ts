import {normalizeSourceUrl} from './source-url.js';
export type VideoPlatform='youtube'|'instagram'|'tiktok';
export function videoPlatform(url:URL):VideoPlatform|undefined{
 if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(url.hostname))return 'youtube';
 if(['instagram.com','www.instagram.com'].includes(url.hostname)&&/^\/(?:reel|reels|p)\/[^/]+\/?$/.test(url.pathname))return 'instagram';
 if(['tiktok.com','www.tiktok.com','m.tiktok.com','vm.tiktok.com','vt.tiktok.com'].includes(url.hostname))return 'tiktok';
}
export function videoLink(value:unknown):URL{
 const url=normalizeSourceUrl(value),platform=videoPlatform(url);
 if(!platform)throw new Error('Nicht unterstützter Video-Link.');
 if(platform==='youtube'){
  const id=url.hostname==='youtu.be'?url.pathname.slice(1):url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)\/?$/)?.[1];
  if(!id||!/^[-\w]{11}$/.test(id))throw new Error('Ungültiger YouTube-Link.');
  return new URL('https://www.youtube.com/watch?v='+id);
 }
 if(platform==='tiktok'&&!(['vm.tiktok.com','vt.tiktok.com'].includes(url.hostname)?/^\/[A-Za-z0-9]+\/?$/.test(url.pathname):/^\/(?:@[^/]+\/video\/[0-9]+|t\/[A-Za-z0-9]+)\/?$/.test(url.pathname)))throw new Error('Ungültiger TikTok-Video-Link.');
 // Strip tracking parameters only after checking for credentials.
 url.search='';return url;
}
