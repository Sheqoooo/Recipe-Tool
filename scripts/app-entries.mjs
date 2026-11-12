export const appDefinitions=[{key:'recipes',name:'Futterluke',description:'Dein gemeinsames Kochbuch',start:'/recipes/'},{key:'shopping',name:'Einkaufsliste',description:'Deine gemeinsame Einkaufsliste',start:'/shopping/'}];
export function appManifest(app){return {id:app.start,name:app.name,short_name:app.name,description:app.description,lang:'de',start_url:app.start,scope:'/',display:'standalone',background_color:'#ffffff',theme_color:'#ffffff',icons:[180,192,512].map(size=>({src:'/icons/'+app.key+'-'+size+'.png',sizes:size+'x'+size,type:'image/png',purpose:'any'}))};}
export function appHtml(html,app){return html.replace('<title>Futterluke · Dein Kochbuch</title>','<title>'+app.name+'</title>').replace('href="./style.css"','href="/style.css"').replace('src="./app.js"','src="/app.js"').replace('</head>',`<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="${app.name}">
<link rel="apple-touch-icon" sizes="180x180" href="/icons/${app.key}-180.png">
<link rel="icon" type="image/png" href="/icons/${app.key}-192.png">
<link rel="manifest" href="/${app.key}.webmanifest">
</head>`);}
