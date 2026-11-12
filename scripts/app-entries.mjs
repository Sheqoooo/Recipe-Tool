export const appDefinitions=[{key:'recipes',name:'Futterluke',description:'Dein gemeinsames Kochbuch',start:'/recipes/'},{key:'shopping',name:'Einkaufsliste',description:'Deine gemeinsame Einkaufsliste',start:'/shopping/'}];
export function appIconPath(app,size){return app.key==='shopping'?'/icons/shopping-bag-'+(app.iconAppearance||'auto')+'-'+size+'-v2.png':'/icons/recipes-'+size+'.png';}
export function appManifest(app){return {id:app.start,name:app.name,short_name:app.name,description:app.description,lang:'de',start_url:app.start,scope:'/',display:'standalone',background_color:'#ffffff',theme_color:'#ffffff',icons:[180,192,512].map(size=>({src:appIconPath(app,size),sizes:size+'x'+size,type:'image/png',purpose:'any'}))};}
export function appHtml(html,app){return html.replace('<title>Futterluke · Dein Kochbuch</title>','<title>'+app.name+'</title>').replace('href="./style.css"','href="/style.css"').replace('src="./app.js"','src="/app.js"').replace('</head>',`<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="${app.name}">
<link rel="apple-touch-icon" sizes="180x180" href="${appIconPath(app,180)}">
<link rel="icon" type="image/png" href="${appIconPath(app,192)}">
<link rel="manifest" href="/${app.key}${app.iconAppearance==='dark'?'-dark':''}.webmanifest">
</head>`);}
