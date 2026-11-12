import {dockGeometry} from '../src/shared/dock-geometry.js';
export function installShoppingDock(){
 const form=document.querySelector<HTMLElement>('#shopping-form')!,nav=document.querySelector<HTMLElement>('#app-navigation')!;
 const mobile=matchMedia('(max-width:699px), (max-width:1000px) and (pointer:coarse)');
 let scheduled=false;
 function update(){
  scheduled=false;
  if(!mobile.matches||document.body.dataset.view!=='shopping'){delete document.body.dataset.groceryKeyboard;return;}
  const viewport=window.visualViewport,navHeight=nav.getBoundingClientRect().height,composerHeight=form.getBoundingClientRect().height;
  const geometry=dockGeometry({layoutHeight:innerHeight,viewportHeight:viewport?.height||innerHeight,viewportTop:viewport?.offsetTop||0,navHeight,composerHeight,focused:form.contains(document.activeElement)});
  const style=document.body.style;
  style.setProperty('--grocery-dock-bottom',geometry.bottom+'px');style.setProperty('--grocery-nav-height',navHeight+'px');style.setProperty('--grocery-composer-height',composerHeight+'px');style.setProperty('--grocery-suggestion-height',geometry.suggestionHeight+'px');
  document.body.dataset.groceryKeyboard=String(geometry.keyboard);
 }
 const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}};
 new ResizeObserver(schedule).observe(form);new ResizeObserver(schedule).observe(nav);
 window.addEventListener('resize',schedule,{passive:true});window.visualViewport?.addEventListener('resize',schedule,{passive:true});window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
 document.addEventListener('focusin',schedule);document.addEventListener('focusout',schedule);mobile.addEventListener('change',schedule);
 schedule();return schedule;
}
