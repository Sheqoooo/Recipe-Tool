import {it,expect} from 'vitest';
import {bringItem} from '../src/shared/bring-item.js';
it('übernimmt nur verlässliche metrische Mengen und kennzeichnet fehlende Mengen',()=>{
 expect(bringItem({name:'Paprikapulver',amount:1,unit:'TL',note:''})).toEqual({name:'Paprikapulver',quantity:'1 TL'});
 expect(bringItem({name:'Salz',amount:null,unit:'',note:''})).toEqual({name:'Salz',quantity:'Menge offen'});
 expect(()=>bringItem({name:'x'.repeat(101),amount:1,unit:'g',note:''})).toThrow();
});
