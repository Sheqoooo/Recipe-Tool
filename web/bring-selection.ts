import type {BringExportResult} from '../src/shared/types.js';

/** Ephemeral selection for this opened recipe; never changes recipe or pantry data. */
export function installBringSelection(root:HTMLElement,options:{enabled:boolean;send:(index:number)=>Promise<BringExportResult>;notify:(text:string,error?:boolean)=>void}){
 const boxes=[...root.querySelectorAll<HTMLInputElement>('[data-bring-exclude]')];
 const buttons=[...root.querySelectorAll<HTMLButtonElement>('[data-bring-ingredient]')];
 const all=root.querySelector<HTMLButtonElement>('[data-bring-selection]')!;
 const help=root.querySelector<HTMLElement>('.bring-selection-help')!;
 const sent=new Set<number>(),pending=new Set<number>();let busy=false,progress='';
 const selected=()=>boxes.flatMap((box,index)=>!box.checked&&!sent.has(index)?[index]:[]);
 function update(){
  boxes.forEach((box,index)=>{
   box.disabled=!options.enabled||busy||pending.has(index);
   const button=buttons[index];button.disabled=!options.enabled||busy||box.checked||sent.has(index)||pending.has(index);
   button.textContent=pending.has(index)?'…':sent.has(index)?'✓':'＋';
   button.setAttribute('aria-busy',String(pending.has(index)));
  });
  all.disabled=!options.enabled||busy||pending.size>0||!selected().length;
  all.textContent=busy?progress:'An Bring! senden ('+selected().length+')';
  all.setAttribute('aria-busy',String(busy));
  help.textContent='× schließt Zutaten vom Versand aus.';
 }
 root.addEventListener('change',event=>{if(event.target instanceof HTMLInputElement&&event.target.matches('[data-bring-exclude]'))update();});
 root.addEventListener('click',async event=>{
  const target=event.target instanceof Element?event.target.closest<HTMLButtonElement>('button'):null;
  if(!target||target.disabled||busy||!options.enabled)return;
  if(target===all){
   if(pending.size)return;
   const indices=selected();if(!indices.length)return;
   busy=true;let completed=0;
   try{
    for(const index of indices){
     progress='Senden … '+(completed+1)+'/'+indices.length;update();
     await options.send(index);sent.add(index);completed++;
    }
    // Only a fully confirmed selection resets exclusions and completion marks.
    boxes.forEach(box=>{box.checked=false;});sent.clear();
    options.notify(completed+(completed===1?' Zutat':' Zutaten')+' an Bring! gesendet.');
   }catch(error){
    options.notify(completed+' von '+indices.length+' Zutaten bestätigt. '+(error instanceof Error?error.message:'Übertragung fehlgeschlagen.')+' Bereits bestätigte Zutaten bleiben markiert.',true);
   }finally{busy=false;update();}
   return;
  }
  if(target.dataset.bringIngredient===undefined)return;
  const index=Number(target.dataset.bringIngredient);if(!boxes[index]||boxes[index].checked||pending.has(index)||sent.has(index))return;
  pending.add(index);update();
  try{
   const result=await options.send(index);sent.add(index);
   options.notify(result.existing?'Diese Zutat wurde vor Kurzem bereits an Bring! gesendet.':'Zutat an „'+result.list_name+'“ gesendet.');
  }catch(error){options.notify(error instanceof Error?error.message:'Übertragung fehlgeschlagen.',true);}
  finally{pending.delete(index);update();}
 });
 update();
}
