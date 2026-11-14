// Pure configuration checks: no network access and no deployment side effects.
export function validateHosting(config) {
  if(!config.compatibility_flags?.includes('global_fetch_strictly_public')||config.compatibility_flags.includes('global_fetch_private_origin'))throw new Error('Source imports require strictly public global fetch routing.');
  for(const scope of [config,config.previews]) {
    if(['services','vpc_services','vpc_networks'].some(key=>scope?.[key]?.length))throw new Error('Do not bind private network or service fetch capabilities to the recipe importer.');
  }
  if(config.workers_dev!==true||config.preview_urls!==false)throw new Error('Use the protected workers.dev hostname; keep legacy version URLs disabled.');
  if(config.assets?.run_worker_first!==true)throw new Error('All assets must pass authentication.');
  const origin=config.vars?.APP_ORIGIN;
  let url;
  try { url=new URL(origin); } catch { throw new Error('Set an exact HTTPS workers.dev APP_ORIGIN.'); }
  const expected=new RegExp(`^${config.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.workers\\.dev$`);
  if(url.protocol!=='https:'||url.port||url.origin!==origin||!expected.test(url.hostname))throw new Error('APP_ORIGIN must match this Worker and the account workers.dev subdomain, without a path or port.');
  for(const [vars,environment] of [[config.vars,'production'],[config.previews?.vars,'preview']]) {
    if(vars?.AUTH_MODE!=='access'||vars.APP_ENV!==environment||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(vars.ACCESS_ISSUER??'')||!vars.ACCESS_AUD)throw new Error('Production and previews require Access issuer, audience and environment configuration.');
    if(['BRING_EMAIL','BRING_PASSWORD','BRING_CLIENT_KEY'].some(key=>key in vars))throw new Error('Bring credentials must be Worker Secrets.');
    if('OPENAI_API_KEY'in vars)throw new Error('API keys must be Worker Secrets.');
    if('BOOTSTRAP_ADMIN_EMAILS'in vars)throw new Error('Bootstrap administrator addresses must be Worker Secrets, not public configuration.');
  }
  if(config.previews.d1_databases?.length)throw new Error('Previews must not bind a database.');
}
