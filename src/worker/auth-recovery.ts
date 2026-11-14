const styles=`html{color-scheme:light dark;font-family:system-ui,sans-serif}body{margin:0;min-height:100svh;display:grid;place-items:center;background:Canvas;color:CanvasText}main{max-width:30rem;padding:2rem;line-height:1.6}h1{line-height:1.2}a{display:inline-block;padding:.8rem 1.1rem;background:#253528;color:#fff;border-radius:.7rem;text-decoration:none}small{display:block;margin-top:1.5rem;opacity:.75}`;
export function needsSignInPage(request:Request):boolean {
  return request.method==='GET'&&!new URL(request.url).pathname.startsWith('/api/')&&(request.headers.get('Accept')||'').includes('text/html');
}
export function signInPage():Response {
  // Static public recovery instructions only: no app assets, identity or source data.
  return new Response(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Erneut anmelden · Futterluke</title><style>${styles}</style></head><body><main><p aria-hidden="true">🍋</p><h1>Bitte erneut anmelden</h1><p>Deine Anmeldung konnte nicht bestätigt werden. Melde dich über Cloudflare Access erneut an.</p><a href="/cdn-cgi/access/logout">Erneut anmelden</a><small>Damit wird deine Cloudflare-Access-Sitzung beendet, gegebenenfalls auch für andere geschützte Apps dieses Teams. Öffne Futterluke anschließend nach etwa 30 Sekunden wieder.</small><p><a href="/">Futterluke öffnen</a></p></main></body></html>`,{status:401,headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  }});
}
