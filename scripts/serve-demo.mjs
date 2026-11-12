// Static files only, loopback only. There are deliberately no API routes.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const files={'/':['index.html','text/html; charset=utf-8'],'/index.html':['index.html','text/html; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8']};
createServer(async(req,res)=>{
  const file=files[new URL(req.url,'http://127.0.0.1').pathname];
  if(!file||req.method!=='GET'){res.writeHead(404);res.end('Not found');return;}
  try{const data=await readFile('.runtime/demo/'+file[0]);res.writeHead(200,{'Content-Type':file[1],'Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'"});res.end(data);}
  catch{res.writeHead(503);res.end('Run npm run build:demo first.');}
}).listen(8788,'127.0.0.1',()=>process.stdout.write('Design-Demo: http://127.0.0.1:8788 (no OpenAI / no D1)\n'));
