// These commands are preparation for the operator. This script is never run by tests or GitHub Actions.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validateHosting } from './hosting-guard.mjs';
const action=process.argv[2];
const config=JSON.parse(readFileSync('wrangler.production.jsonc','utf8'));
const fail=message=>{throw new Error(message);};
if(!['production','preview','migrate'].includes(action))fail('Unknown release action');
const vars=action==='preview'?config.previews.vars:config.vars;
if(vars.AUTH_MODE!=='access'||vars.APP_ENV!==(action==='preview'?'preview':'production'))fail('Releases require Access and the correct isolated environment.');
validateHosting(config);
if(['BRING_EMAIL','BRING_PASSWORD','BRING_CLIENT_KEY'].some(key=>key in vars))fail('Bring credentials must be Worker Secrets.');
if('OPENAI_API_KEY'in vars)fail('OPENAI_API_KEY must be a Worker Secret, never a config variable.');
if(Object.values(vars).some(v=>String(v).includes('REPLACE_WITH')))fail('Fill in Access and application configuration before release.');
if(config.assets.run_worker_first!==true)fail('All assets must pass authentication.');
if(action==='preview'){
  if(config.previews.d1_databases?.length||'OPENAI_API_KEY'in vars)fail('Preview must not bind a database or API secret.');
}else{
  const db=config.d1_databases?.[0];
  if(!db||db.database_name.includes('REPLACE_WITH')||db.database_id==='11111111-1111-4111-8111-111111111111')fail('Set the EXISTING D1 name and ID; do not create a new production database.');
  // Bootstrap administrators live in Worker Secrets, unavailable to this build process.
  // Their absence does not grant access: the runtime still requires active membership.
  if(action==='production'&&process.env.CONFIRM_PRODUCTION_DEPLOY!=='1')fail('Production deployment requires CONFIRM_PRODUCTION_DEPLOY=1.');
  if(action==='migrate'&&process.env.CONFIRM_PRODUCTION_MIGRATIONS!=='1')fail('Remote migration requires separate explicit approval: CONFIRM_PRODUCTION_MIGRATIONS=1.');
  if(process.env.WORKERS_CI_BRANCH&&process.env.WORKERS_CI_BRANCH!=='main')fail('Production operations are only allowed from main.');
}
const args=action==='migrate'?['d1','migrations','apply','DB','--remote']:action==='preview'?['preview']:['deploy'];
const result=spawnSync('npx',['wrangler',...args,'--config','wrangler.production.jsonc'],{stdio:'inherit'});
process.exit(result.status??1);
