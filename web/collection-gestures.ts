interface Options {
 root:HTMLElement;indicator:HTMLElement;active:()=>boolean;
 canDelete:(id:number)=>boolean;onDelete:(id:number)=>void;
 onRefresh:()=>Promise<void>;onError:(error:unknown)=>void;
}
export function installCollectionGestures(options:Options):{refresh:()=>Promise<void>} {
 const {root,indicator}=options;
 let press:ReturnType<typeof setTimeout>|undefined,pressedId:number|null=null,startX=0,startY=0;
 let suppressId:number|null=null,suppressUntil=0;
 let pull:{x:number;y:number;distance:number;vertical:boolean}|null=null;
 let refreshing:Promise<void>|null=null;
 const cancelPress=()=>{clearTimeout(press);press=undefined;pressedId=null;};
 const display=(distance:number,text:string)=>{
   indicator.style.height=distance+'px';indicator.textContent=text;indicator.hidden=distance===0;
 };
 const resetPull=()=>{pull=null;if(!refreshing)display(0,'');};
 const refresh=():Promise<void>=>{
   if(refreshing)return refreshing;
   if(!options.active())return Promise.resolve();
   cancelPress();pull=null;root.setAttribute('aria-busy','true');display(44,'↻ Wird aktualisiert …');
   refreshing=Promise.resolve().then(options.onRefresh).catch(options.onError).finally(()=>{
     refreshing=null;root.removeAttribute('aria-busy');display(0,'');
   });return refreshing;
 };
 root.addEventListener('pointerdown',event=>{
   cancelPress();suppressId=null;suppressUntil=0;if(!options.active()||!event.isPrimary||event.button!==0)return;
   const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-open]'):null;
   if(!target)return;const id=Number(target.dataset.open);if(!options.canDelete(id))return;
   startX=event.clientX;startY=event.clientY;pressedId=id;
   press=setTimeout(()=>{
     if(pressedId!==id||!target.isConnected||!options.active())return;
     suppressId=id;suppressUntil=Date.now()+1500;cancelPress();resetPull();options.onDelete(id);
   },600);
 });
 root.addEventListener('pointermove',event=>{if(Math.hypot(event.clientX-startX,event.clientY-startY)>10)cancelPress();});
 root.addEventListener('pointerup',()=>{cancelPress();if(suppressId!==null)suppressUntil=Date.now()+1000;});
 root.addEventListener('pointercancel',cancelPress);
 root.addEventListener('click',event=>{
   const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-open]'):null;
   if(target&&Number(target.dataset.open)===suppressId&&Date.now()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 root.addEventListener('contextmenu',event=>{
   const target=event.target instanceof Element?event.target.closest<HTMLElement>('[data-open]'):null;
   if(!target||!options.active())return;const id=Number(target.dataset.open);
   if(!options.canDelete(id))return;
   event.preventDefault();cancelPress();suppressId=id;suppressUntil=Date.now()+1000;options.onDelete(id);
 });
 root.addEventListener('dragstart',event=>{if(event.target instanceof Element&&event.target.closest('[data-open]'))event.preventDefault();});
 document.addEventListener('touchstart',event=>{
   resetPull();
   if(event.touches.length!==1){cancelPress();return;}
   const target=event.target instanceof Element?event.target:null;
   if(!options.active()||refreshing||window.scrollY>0||!target?.closest('#view-collection,#app-header')||target.closest('input,textarea,select,dialog,nav')||target.closest('button:not([data-open])'))return;
   const t=event.touches[0];pull={x:t.clientX,y:t.clientY,distance:0,vertical:false};
 },{passive:true});
 document.addEventListener('touchmove',event=>{
   if(!pull)return;if(event.touches.length!==1||!options.active()){resetPull();cancelPress();return;}
   const t=event.touches[0],dx=t.clientX-pull.x,dy=t.clientY-pull.y;
   if(!pull.vertical){if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){resetPull();return;}if(dy<0||window.scrollY>0){resetPull();return;}if(dy<10||dy<Math.abs(dx)*1.2)return;pull.vertical=true;cancelPress();}
   if(!event.cancelable){resetPull();return;}
   event.preventDefault();pull.distance=Math.min(84,Math.max(0,dy*.45));
   display(pull.distance,pull.distance>=54?'↻ Loslassen zum Aktualisieren':'↓ Zum Aktualisieren herunterziehen');
 },{passive:false});
 document.addEventListener('touchend',event=>{
   if(!pull)return;const ready=event.touches.length===0&&pull.vertical&&pull.distance>=54&&options.active();resetPull();if(ready)void refresh();
 },{passive:true});
 document.addEventListener('touchcancel',()=>{cancelPress();resetPull();},{passive:true});
 window.addEventListener('scroll',cancelPress,{passive:true});
 window.addEventListener('blur',()=>{cancelPress();resetPull();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelPress();resetPull();}});
 return {refresh};
}
