import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundleApp} from './bundle.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=process.argv[2]||path.join(root,'WerkPilot.html');
let script=bundleApp(root),css=fs.readFileSync(path.join(root,'dist/style.css'),'utf8');
const icon=fs.readFileSync(path.join(root,'dist/icon-192.png')).toString('base64');
script=script.replaceAll('src="icon-192.png"','src="data:image/png;base64,'+icon+'"');
let html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
 .replace('<link rel="manifest" href="manifest.webmanifest">','')
 .replace('<link rel="icon" href="icon.svg" type="image/svg+xml">','')
 .replace('<link rel="apple-touch-icon" href="apple-touch-icon.png">','')
 .replace('<script type="module" src="app.js"></script>','<script type="module">'+script.replaceAll('</script','<\\/script')+'</script>');
fs.writeFileSync(output,html);console.log('Ein-Datei-App erstellt: '+output);
