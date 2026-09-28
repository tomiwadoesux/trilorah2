// Local visual check of the shared projector QR card, using a sample link.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');
const ts=require('typescript');const QRCode=require('qrcode');
const filename=path.resolve(__dirname,'../shared/qrCard.ts');
const mod=new Module(filename,module);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
app.whenReady().then(async()=>{
 const url='https://trilorah.com/live/vrc';
 const qrSvg=await QRCode.toString(url,{type:'svg',margin:0,errorCorrectionLevel:'M'});
 const withImage=process.argv.includes('--background');
 const backgroundDataUrl=withImage?'data:image/jpeg;base64,'+fs.readFileSync(path.resolve(__dirname,'../artifacts/sample-background.jpg')).toString('base64'):undefined;
 const svg=mod.exports.buildQrCard({qrSvg,url,churchName:'Victory Royal Church',caption:'Follow along on your phone',backgroundDataUrl});
 const name=withImage?'congregation-qr-background':'congregation-qr-preview';
 const dir=path.resolve(__dirname,'../artifacts');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,name+'.svg'),svg);
 const win=new BrowserWindow({width:1280,height:720,useContentSize:true,show:false,webPreferences:{offscreen:true,backgroundThrottling:false}});
 await win.loadURL('data:text/html,'+encodeURIComponent('<style>body{margin:0;background:#090b0c}img{width:100%;height:100%;object-fit:contain}</style><img src="data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64')+'">'));
 win.showInactive();await new Promise(r=>setTimeout(r,500));
 const image=await win.webContents.capturePage();if(image.isEmpty())throw Error('Empty screenshot');
 fs.writeFileSync(path.join(dir,name+'.png'),image.toPNG());
 console.log('QR preview rendered');app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
