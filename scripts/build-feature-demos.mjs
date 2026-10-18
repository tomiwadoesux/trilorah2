/** Package browser-captured native UI. No app engine, network bridge or scripts ship. */
import fs from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import { transform } from 'esbuild';
import { gzipSync } from 'node:zlib';
const input = 'artifacts/showcase/native';
const output = 'web/public/feature-demos';
await fs.mkdir(output, { recursive: true });
const clean = html => html
  .replace(/<(script|style|iframe|object|embed|audio|video)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<(?:link|meta|base|script)\b[^>]*>/gi, '')
  .replace(/\s(?:on\w+|srcdoc|autofocus|contenteditable|action|formaction|tabindex)=(?:"[^"]*"|'[^']*')/gi, '')
  .replace(/\s(?:src|href)="(?:https?:\/\/[^/]+)?\/hero-landscape\/dark.webp"/gi, ' src="/hero-landscape/dark.webp"')
  .replace(/\s(?:src|href)="(?!\/hero-landscape\/|data:image\/|#)[^"]*"/gi, '')
  .replace(/url\((?:&quot;|["'])?(?:https?:|file:)[^)]*\)/gi, 'none')
  .replace(/(<input\b[^>]*?)\svalue="[^"]*"/gi, '$1')
  .replaceAll('give@vrcministries.org','giving@example.org').replaceAll('vrcministries.org/give','example.org/give')
  .replaceAll('@vrcministries','@samplechurch').replaceAll('Pastor Dan','Sample preacher');
for (const group of ['service','screens','phone']) {
  const names = (await fs.readdir(input)).filter(name => name.startsWith(group+'-') && name.endsWith('.json'));
  const states = {}; const root = postcss.root(); const seen = new Set();
  function collect(node, context = []) {
    if (node.type === 'comment' || (node.type === 'atrule' && /^(import|font-face|charset)$/.test(node.name))) return;
    if (node.type === 'atrule' && node.nodes && !/keyframes$/.test(node.name) && node.nodes.some(child => !['decl','comment'].includes(child.type))) {
      node.nodes.forEach(child => collect(child,[...context,{name:node.name,params:node.params}])); return;
    }
    const key = JSON.stringify(context)+node.toString(); if(seen.has(key))return; seen.add(key);
    let result=node.clone(); for(let i=context.length-1;i>=0;i--)result=postcss.atRule(context[i]).append(result); root.append(result);
  }
  for(const name of names) {
    const capture=JSON.parse(await fs.readFile(path.join(input,name),'utf8'));
    states[name.replace('.json','')]={html:clean(capture.html),crop:capture.crop};
    postcss.parse(capture.css).nodes.forEach(node=>collect(node));
  }
  root.walkDecls(decl=>{decl.value=decl.value.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi,(all,q,url)=>url.startsWith('data:image/')||url.startsWith('#')?all:'none');});
  const additions=`@font-face{font-family:Geist;src:url('/hero-service/geist-variable.woff2') format('woff2');font-weight:100 900}@font-face{font-family:'Geist Mono';src:url('/hero-service/geist-mono-variable.woff2') format('woff2');font-weight:100 900}html,body{margin:0;overflow:hidden!important}html{color-scheme:dark}body{font-family:Geist,sans-serif}*{pointer-events:none!important;caret-color:transparent!important;animation:none!important;transition:none!important}.tri-dotted-surface::before{display:none!important}.tri-rounded-surface{transform:none!important;opacity:1!important}input,button,select,textarea{pointer-events:none!important}`;
  const css=(await transform(root.toString()+additions,{loader:'css',minify:true})).code;
  await fs.writeFile(path.join(output,group+'.css'),css);
  const data=JSON.stringify({states}); await fs.writeFile(path.join(output,group+'.json'),data);
  const document=`<!doctype html><html lang="en" data-theme="dark" data-density="comfortable" data-aurora="fern"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'"><link rel="stylesheet" href="/feature-demos/${group}.css"><title>Trilorah sample ${group}</title></head><body></body></html>`;
  await fs.writeFile(path.join(output,group+'.html'),document);
  console.log(group,Object.keys(states).length,'states;',Math.round((gzipSync(css).length+gzipSync(data).length)/1024)+' KB gzip');
}
