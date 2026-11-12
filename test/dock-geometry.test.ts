import {it,expect} from 'vitest';
import {dockGeometry} from '../src/shared/dock-geometry.js';
it('places the composer above navigation when the keyboard is closed',()=>{
 expect(dockGeometry({layoutHeight:844,viewportHeight:844,viewportTop:0,navHeight:86,composerHeight:80,focused:false})).toEqual({keyboard:false,bottom:86,suggestionHeight:340});
});
it('places input above the keyboard and bounds suggestions to visible space',()=>{
 const result=dockGeometry({layoutHeight:844,viewportHeight:380,viewportTop:20,navHeight:86,composerHeight:130,focused:true});
 expect(result).toEqual({keyboard:true,bottom:444,suggestionHeight:234});
});
it('ignores small browser chrome changes and handles short landscape viewports',()=>{
 expect(dockGeometry({layoutHeight:844,viewportHeight:800,viewportTop:0,navHeight:70,composerHeight:80,focused:true}).keyboard).toBe(false);
 const result=dockGeometry({layoutHeight:390,viewportHeight:140,viewportTop:0,navHeight:70,composerHeight:130,focused:true});expect(result.suggestionHeight).toBe(44);
});
