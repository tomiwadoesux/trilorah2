// Capture the real congregation components using local sample data only.
// Run: env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron scripts/capture-companion.cjs
const { app, BrowserWindow } = require('electron');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.resolve(__dirname, '..');
const web = path.join(root, 'web');
const out = path.join(root, 'artifacts', 'congregation-review');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'trilorah-companion-review-'));
const viewports = [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 430, height: 932 }];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
app.setPath('userData', path.join(temp, 'profile'));

async function buildFixture() {
  const esbuild = require('esbuild');
  // Compile from today's sources rather than reusing a possibly stale Next build.
  execFileSync(process.execPath, [
    path.join(web, 'node_modules/tailwindcss/lib/cli.js'),
    '-i', path.join(web, 'src/app/globals.css'),
    '-c', path.join(web, 'tailwind.config.ts'),
    '-o', path.join(temp, 'globals.css'),
  ], {
    cwd: web,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const service = {
    id: 'sample-service', account_id: 'sample-church', preacher_id: null,
    started_at: new Date(Date.now() - 600000).toISOString(), ended_at: null,
    sermon_title: 'Walking by faith', publish_transcript: true,
    audience_training_enabled: false, stream_url: null,
  };
  const data = {
    services: service,
    transcript_chunks: [{
      id: 'c1', text: 'Faith is trusting God even when we cannot see the whole path. We do not have to know every step before we take the next one. His word is a lamp unto our feet and a light unto our path.',
      is_final: true, timestamp: new Date(Date.now() - 60000).toISOString(),
      segment_type: 'sermon', words: null, offset_ms: 0,
    }],
    detected_verses: ['Proverbs 3:5–6', 'Psalm 119:105', 'Hebrews 11:1'].map((ref, i) => ({
      id: `v${i + 1}`, ref, pushed_to_live: true,
      pushed_at: new Date(Date.now() - (i + 1) * 60000).toISOString(),
    })),
    segments: { type: 'sermon' },
    sermon_notes: {
      title: 'Walking by faith', theme: 'Trusting God with the next step.', is_live: true,
      main_points: [
        { point: 'Trust beyond what you can see', explanation: 'Faith begins with the character of God, even when the way ahead is uncertain.', scriptures: ['Proverbs 3:5–6'] },
        { point: 'Let the Word guide your steps', explanation: 'Make room to listen, then respond with one faithful step.', scriptures: ['Psalm 119:105'] },
      ],
      applications: ['Choose one area to surrender to God this week.'],
      memorable_quotes: ['We do not have to know every step before we take the next one.'],
    },
  };
  const stub = `const fixture=${JSON.stringify(data)};
    window.updateCompanionFixture=(next)=>Object.assign(fixture,next);
    export function createClient(){return {
      from(table){const data=fixture[table]??null;const q=new Proxy({}, {get(_,key){
        if(key==='then')return (resolve,reject)=>Promise.resolve({data,error:null}).then(resolve,reject);
        return ()=>q;
      }});return q;},
      channel(){const c={on(){return c},subscribe(callback){callback?.('SUBSCRIBED');return c}};return c;},
      removeChannel(){}
    }};`;
  const account = {
    id: 'sample-church', name: 'Victory Royal Church', slug: 'sample',
    // Display fixture only: no destination is opened and no transaction occurs.
    giving_methods: { customUrl: 'https://example.com/give', note: 'Sample church giving information.' },
  };
  const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
    import Companion from ${JSON.stringify(path.join(web, 'src/app/live/[slug]/CompanionClient.tsx'))};
    window.fetch=async()=>({ok:false,json:async()=>null});
    const account=${JSON.stringify(account)};
    const root=createRoot(document.getElementById('root'));
    window.renderCompanionFixture=(overrides={},serviceOverrides={})=>root.render(<Companion key={JSON.stringify([overrides,serviceOverrides])} account={{...account,...overrides}} initialService={{...${JSON.stringify(service)},...serviceOverrides}}/>);
    window.renderCompanionFixture();`;
  await esbuild.build({
    stdin: { contents: entry, resolveDir: web, loader: 'tsx' },
    bundle: true, outfile: path.join(temp, 'app.js'), jsx: 'automatic',
    alias: { '@': path.join(web, 'src'), react: path.join(web, 'node_modules/react'), 'react-dom': path.join(web, 'node_modules/react-dom') },
    plugins: [{ name: 'isolated-companion-fixture', setup(build) {
      build.onResolve({ filter: /^@\/lib\/supabase\/browser$/ }, () => ({ path: 'mock', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: stub, loader: 'js' }));
    } }],
  });
  const font = fs.readFileSync(path.join(web, 'src/app/fonts/tt-hoves-pro-variable.woff2')).toString('base64');
  fs.writeFileSync(path.join(temp, 'index.html'), `<!doctype html><html lang="en"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    <link rel="stylesheet" href="globals.css"><link rel="stylesheet" href="app.css">
    <style>@font-face{font-family:'TT Hoves Review';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:50 900;font-style:normal;font-display:swap}:root{--font-heading:'TT Hoves Review'}body{margin:0}</style>
    </head><body><div id="root"></div><script src="app.js"></script></body></html>`);
}

app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  await buildFixture();
  const report = { sampleData: true, network: 'Blocked; fixture replaces Supabase and fetch', viewports: [], checks: [] };
  const windows = [];
  function check(name, passed, details) {
    report.checks.push({ name, passed, details });
  }
  try {
    for (const viewport of viewports) {
      const window = new BrowserWindow({
        ...viewport, useContentSize: true, show: false,
        webPreferences: { offscreen: true, backgroundThrottling: false, partition: `companion-review-${viewport.width}` },
      });
      windows.push(window);
      window.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }));
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      const js = code => window.webContents.executeJavaScript(code);
      const prefix = `${viewport.width}x${viewport.height}`;
      await window.loadFile(path.join(temp, 'index.html'));
      window.showInactive();
      await js('document.fonts.ready.then(()=>true)');
      await wait(250);

      async function inspect(name) {
        const metrics = await js(`(()=>{
          const nav=document.querySelector('nav[aria-label="Service sections"]');
          const rect=nav.getBoundingClientRect();
          const buttonGradients=[...document.querySelectorAll('button')].flatMap(el=>['', '::before', '::after'].filter(pseudo=>getComputedStyle(el,pseudo||null).backgroundImage.includes('gradient')).map(pseudo=>({label:el.getAttribute('aria-label')||el.textContent.trim(),pseudo})));
          return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth,
            nav:{top:rect.top,bottom:rect.bottom,left:rect.left,right:rect.right},
            tabs:[...nav.querySelectorAll('button')].map(el=>el.textContent.trim()),buttonGradients,
            hasChurchCard:!!document.querySelector('.companion-church')};
        })()`);
        check(`${prefix} ${name}: no horizontal overflow`, metrics.scrollWidth <= viewport.width + 1 && metrics.bodyScrollWidth <= viewport.width + 1, metrics);
        check(`${prefix} ${name}: navigation inside viewport`, metrics.nav.top >= 0 && metrics.nav.bottom <= viewport.height + 1 && metrics.nav.left >= 0 && metrics.nav.right <= viewport.width + 1, metrics.nav);
        check(`${prefix} ${name}: flat buttons`, metrics.buttonGradients.length === 0, metrics.buttonGradients);
        check(`${prefix} ${name}: no church card panel`, !metrics.hasChurchCard);
        return metrics;
      }
      async function shot(name) {
        await js(`(()=>{const el=document.querySelector('.transcript-words');if(el&&!document.querySelector('dialog[open]')){el.dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:-500}));el.scrollTo({top:0,behavior:'instant'});}})()`);
        await wait(180);
        const image = await window.webContents.capturePage();
        if (image.isEmpty()) throw new Error(`Empty screenshot: ${prefix} ${name}`);
        const filename = `${prefix}-${name}.png`;
        fs.writeFileSync(path.join(out, filename), image.toPNG());
        return filename;
      }
      async function tab(label) {
        await js(`(()=>{const button=[...document.querySelectorAll('nav button')].find(el=>el.textContent.trim()===${JSON.stringify(label)});if(!button)throw Error('Missing tab: '+${JSON.stringify(label)});button.click();})()`);
        await wait(120);
      }

      const captures = [];
      for (const [label, name] of [['Transcript', 'transcript'], ['Verses', 'scriptures'], ['Notes', 'notes'], ['Give', 'give']]) {
        await tab(label);
        if (label === 'Verses') check(`${prefix}: published scripture fixtures are visible`, await js(`document.body.textContent.includes('Proverbs 3:5–6') && document.body.textContent.includes('Hebrews 11:1')`));
        if (label === 'Give') check(`${prefix}: sample giving link rendered`, await js(`!!document.querySelector('a[href="https://example.com/give"]')`));
        await inspect(name);
        captures.push(await shot(name));
      }

      await tab('Transcript');
      await js(`document.querySelector('button[aria-label="Reading options"]').click()`);
      await wait(220);
      const dialog = await js(`(()=>{const el=document.querySelector('dialog');const r=el.getBoundingClientRect();return {open:el.open,modal:el.matches(':modal'),focusInside:el.contains(document.activeElement),left:r.left,right:r.right,top:r.top,bottom:r.bottom,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}})()`);
      check(`${prefix}: reading dialog is modal with focus inside`, dialog.open && dialog.modal && dialog.focusInside, dialog);
      check(`${prefix}: reading dialog fits viewport`, dialog.left >= -1 && dialog.right <= viewport.width + 1 && dialog.top >= -1 && dialog.bottom <= viewport.height + 1 && dialog.scrollWidth <= dialog.clientWidth + 1, dialog);
      await inspect('reading dialog');
      captures.push(await shot('reading-options'));
      window.webContents.focus();
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
      await wait(120);
      const closed = await js(`({closed:!document.querySelector('dialog').open,triggerFocused:document.activeElement===document.querySelector('button[aria-label="Reading options"]')})`);
      check(`${prefix}: Escape closes reading dialog and restores focus`, closed.closed && closed.triggerFocused, closed);

      // Giving is conditional; the three reading destinations remain available.
      await js(`window.renderCompanionFixture({giving_methods:null})`);
      await wait(150);
      const withoutGiving = await inspect('no giving configured');
      check(`${prefix}: unconfigured giving is hidden`, !withoutGiving.tabs.includes('Give') && ['Transcript','Verses','Notes'].every(label=>withoutGiving.tabs.includes(label)), withoutGiving.tabs);

      if (viewport.width === 320) {
        // Exercise the two conditional controls on the narrowest viewport.
        // Fresh timestamps keep the correction window real, without freezing timers.
        await js(`(()=>{
          const now=Date.now();
          const text='Faith is trusting God with the next step.';
          window.updateCompanionFixture({
            detected_verses:[{id:'fresh-verse',ref:'Proverbs 3:5–6',pushed_to_live:true,pushed_at:new Date(now).toISOString()}],
            transcript_chunks:[{id:'timed-chunk',text,is_final:true,timestamp:new Date(now).toISOString(),segment_type:'sermon',offset_ms:0,
              words:text.split(' ').map((w,index)=>({w,s:index*.7,e:(index+1)*.7}))}]
          });
          window.renderCompanionFixture({}, {audience_training_enabled:true,started_at:new Date(now-8000).toISOString()});
        })()`);
        await wait(120);
        await tab('Verses');
        const corrections = await js(`(()=>{
          const feedback=document.querySelector('.companion-scripture-feedback');
          if(!feedback)return {present:false,buttons:[]};
          const reference=feedback.parentElement.querySelector('.companion-scripture-copy').getBoundingClientRect();
          return {present:true,referenceBottom:reference.bottom,buttons:[...feedback.querySelectorAll('button')].map(button=>{
            const rect=button.getBoundingClientRect();return {label:button.textContent.trim(),top:rect.top,height:rect.height,left:rect.left,right:rect.right};
          })};
        })()`);
        check(`${prefix}: correction choices appear below reference`, corrections.present && corrections.buttons.length === 2 && corrections.buttons.every(button=>button.top >= corrections.referenceBottom), corrections);
        check(`${prefix}: correction targets are at least 44px and fit`, corrections.buttons.length === 2 && corrections.buttons.every(button=>button.height >= 44 && button.left >= 0 && button.right <= viewport.width), corrections.buttons);
        await inspect('scripture corrections');
        captures.push(await shot('scriptures-corrections'));

        await tab('Transcript');
        const syncTrigger = await js(`(()=>{const button=document.querySelector('button[aria-label="Adjust transcript sync"]');if(!button)return null;const rect=button.getBoundingClientRect();return {width:rect.width,height:rect.height};})()`);
        check(`${prefix}: sync trigger is at least 44px`, !!syncTrigger && syncTrigger.width >= 44 && syncTrigger.height >= 44, syncTrigger);
        await js(`(()=>{const button=document.querySelector('button[aria-label="Adjust transcript sync"]');button.focus();button.click();})()`);
        await wait(180);
        const syncDialog = await js(`(()=>{const el=document.querySelector('.companion-sync-dialog');if(!el)return null;const rect=el.getBoundingClientRect();return {open:el.open,modal:el.matches(':modal'),focusInside:el.contains(document.activeElement),left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};})()`);
        check(`${prefix}: sync dialog is modal with focus inside`, !!syncDialog && syncDialog.open && syncDialog.modal && syncDialog.focusInside, syncDialog);
        check(`${prefix}: sync dialog fits viewport`, !!syncDialog && syncDialog.left >= -1 && syncDialog.right <= viewport.width + 1 && syncDialog.top >= -1 && syncDialog.bottom <= viewport.height + 1 && syncDialog.scrollWidth <= syncDialog.clientWidth + 1, syncDialog);
        await inspect('transcript sync');
        captures.push(await shot('transcript-sync'));
        window.webContents.focus();
        window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
        window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
        await wait(120);
        const syncClosed = await js(`({closed:!document.querySelector('.companion-sync-dialog[open]'),triggerFocused:document.activeElement===document.querySelector('button[aria-label="Adjust transcript sync"]')})`);
        check(`${prefix}: Escape closes sync dialog and restores focus`, syncClosed.closed && syncClosed.triggerFocused, syncClosed);
      }
      report.viewports.push({ ...viewport, captures });
      window.close();
    }
  } finally {
    for (const window of windows) if (!window.isDestroyed()) window.close();
    report.passed = report.viewports.length === viewports.length && report.checks.every(result => result.passed);
    fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(report, null, 2) + '\n');
  }
  const failures = report.checks.filter(result => !result.passed);
  console.log(JSON.stringify({ output: out, screenshots: report.viewports.reduce((sum, viewport) => sum + viewport.captures.length, 0), checks: report.checks.length, failures }, null, 2));
  app.exit(failures.length ? 1 : 0);
}).catch(error => { console.error(error); app.exit(1); });
