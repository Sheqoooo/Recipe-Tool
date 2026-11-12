export function dockGeometry(input:{layoutHeight:number;viewportHeight:number;viewportTop:number;navHeight:number;composerHeight:number;focused:boolean}){
 const gap=Math.max(0,input.layoutHeight-input.viewportHeight-input.viewportTop);
 const keyboard=input.focused&&gap>120;
 return {keyboard,bottom:keyboard?gap:input.navHeight,suggestionHeight:Math.max(44,Math.min(340,input.viewportHeight-input.composerHeight-(keyboard?16:input.navHeight+24)))};
}
