import {test} from 'node:test';
import assert from 'node:assert/strict';
const services=['lawn','hedge','radical','shape','weeds','landscape','tree','felling','greenhaul','home','house','deep','window','stairs','office','practice'].map(id=>({id,name:id}));
import {VISION_RUNTIME,VISION_DISCLAIMER,buildVisionLabels,rankVisionResults,classifyVisionError,createPhotoRecognizer} from '../dist/vision.js';
const PHOTO='data:image/jpeg;base64,AAAA';
const groups=buildVisionLabels(services);
const label=id=>groups.find(group=>group.id===id).label;
const result=(id='lawn')=>[{label:label(id),score:.72},{label:label(id==='hedge'?'lawn':'hedge'),score:.2},{label:label('other'),score:.08}];
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
async function until(predicate){for(let i=0;i<30&&!predicate();i++)await Promise.resolve();assert.ok(predicate(),'expected asynchronous phase reached')}
function mock({classify=async()=>result(),load}={}){const options=[],imports=[],calls=[],states=[];const runtime={env:{backends:{onnx:{wasm:{numThreads:8,proxy:true}}}},async pipeline(task,model,settings){options.push({task,model,settings});settings.progress_callback({status:'progress',file:'onnx/vision_model_quantized.onnx',loaded:5,total:10,progress:50});if(load)await load.promise;return async(image,labels,settings)=>{calls.push({image,labels,settings});return classify(image,labels)}}};const recognizer=createPhotoRecognizer({services,importer:async url=>{imports.push(url);return runtime},support:()=>true,online:()=>true,onStatus:state=>states.push(state)});return {recognizer,runtime,options,imports,calls,states}}

test('Browserbundle und WASM stammen aus derselben gepinnten Veröffentlichung',()=>{
 assert.match(VISION_RUNTIME.moduleURL,/@3\.7\.2\/dist\/transformers\.min\.js$/);assert.ok(!VISION_RUNTIME.moduleURL.includes('.web.'));assert.equal(VISION_RUNTIME.wasmPath,VISION_RUNTIME.moduleURL.replace('transformers.min.js',''));
});
test('Alle Leistungen sind sichtbar zugeordnet, riskante Tätigkeiten bleiben Alternativen statt Bilddiagnosen',()=>{
 const ids=groups.flatMap(group=>group.services.map(service=>service.id));for(const service of services)assert.ok(ids.includes(service.id),service.id);assert.equal(groups.find(group=>group.id==='tree').services[0].id,'tree');assert.ok(groups.find(group=>group.id==='tree').services.some(service=>service.id==='felling'));assert.ok(groups.find(group=>group.id==='hedge').services.some(service=>service.id==='radical'));assert.ok(groups.every(group=>!/needs (?:felling|radical)|must be cut/i.test(group.label)));
});
test('Starker Modellrang liefert unverbindliche Vorschläge und keine Maße oder Sicherheitsfreigaben',()=>{
 const ranked=rankVisionResults(result('tree'),groups);assert.equal(ranked.status,'ok');assert.equal(ranked.suggestions[0].service.id,'tree');assert.ok(ranked.suggestions[0].relatedServices.some(service=>service.id==='felling'));assert.match(ranked.disclaimer,/keine verlässlichen Wahrscheinlichkeiten/);assert.equal(ranked.area,undefined);assert.equal(ranked.safetyApproved,undefined);
});
test('Schwache und mehrdeutige Scores liefern keine automatisch auswählbare Leistung',()=>{
 for(const items of [[{label:label('lawn'),score:.22},{label:label('hedge'),score:.2}],[{label:label('lawn'),score:.5},{label:label('hedge'),score:.49}]]){const ranked=rankVisionResults(items,groups);assert.equal(ranked.status,'uncertain');assert.deepEqual(ranked.suggestions,[]);assert.ok(ranked.alternatives.length);}
});
test('Fremdes Motiv, leere Ergebnisse und defekte Scores werden zurückgewiesen',()=>{
 assert.equal(rankVisionResults([{label:label('other'),score:.8},{label:label('lawn'),score:.1}],groups).reason,'unrelated');assert.equal(rankVisionResults([],groups).reason,'no-results');assert.equal(rankVisionResults([{label:'unknown',score:1},{label:label('lawn'),score:Infinity},{label:label('hedge'),score:-1}],groups).reason,'no-results');
});
test('Laden erfolgt erst auf Wunsch, dann einmal mit WASM Einzelthread ohne Proxy',async()=>{
 const m=mock();assert.equal(m.imports.length,0);const response=await m.recognizer.recognize(PHOTO,{imageId:'photo-1'});assert.equal(response.status,'ok');assert.equal(m.runtime.env.backends.onnx.wasm.numThreads,1);assert.equal(m.runtime.env.backends.onnx.wasm.proxy,false);assert.equal(m.runtime.env.backends.onnx.wasm.wasmPaths,VISION_RUNTIME.wasmPath);assert.equal(m.options[0].settings.device,'wasm');assert.equal(m.options[0].settings.dtype,'q8');assert.equal(m.runtime.env.allowLocalModels,false);assert.equal(m.calls[0].image,PHOTO);await m.recognizer.recognize(PHOTO);assert.equal(m.imports.length,1);assert.equal(m.options.length,1);assert.equal(m.recognizer.getState().modelReady,true);
});
test('Downloadfortschritt nennt eine einzelne Datei und echten Prozentsatz',async()=>{
 const m=mock();await m.recognizer.recognize(PHOTO);const progress=m.states.find(state=>state.progress);assert.deepEqual(progress.progress,{file:'vision_model_quantized.onnx',loaded:5,total:10,percent:50});assert.equal(m.states.at(-1).busy,false);
});
test('Zwei gleichzeitige Fotoanfragen teilen den Modelldownload und nur die jüngste antwortet',async()=>{
 const load=deferred(),m=mock({load});const first=m.recognizer.recognize(PHOTO,{imageId:'old'});await until(()=>m.options.length===1);const latest=m.recognizer.recognize(PHOTO,{imageId:'new'});load.resolve();assert.equal((await first).status,'cancelled');assert.equal((await latest).status,'ok');assert.equal(m.imports.length,1);assert.equal(m.calls.length,1);assert.equal(m.recognizer.getState().imageId,'new');
});
test('Wartende Analyse eines alten Fotos überschreibt weder neuen Status noch Ergebnisse',async()=>{
 const firstRun=deferred();let runs=0,active=0,maxActive=0;const m=mock({classify:async()=>{active++;maxActive=Math.max(maxActive,active);const value=++runs===1?await firstRun.promise:result('hedge');active--;return value}});
 const first=m.recognizer.recognize(PHOTO,{imageId:'old'});await until(()=>runs===1);const latest=m.recognizer.recognize(PHOTO,{imageId:'new'});assert.equal((await first).status,'cancelled');firstRun.resolve(result('lawn'));const response=await latest;assert.equal(response.suggestions[0].service.id,'hedge');assert.equal(maxActive,1);assert.equal(m.recognizer.getState().imageId,'new');
});
test('Stoppen beantwortet laufende Anfragen sofort und unterdrückt späte Ergebnisse',async()=>{
 const analysis=deferred(),m=mock({classify:()=>analysis.promise});const response=m.recognizer.recognize(PHOTO);await until(()=>m.calls.length===1);m.recognizer.cancel();assert.equal((await response).status,'cancelled');analysis.resolve(result());await Promise.resolve();assert.equal(m.recognizer.getState().stage,'cancelled');assert.equal(m.states.at(-1).busy,false);
});
test('Fehlgeschlagener Download kann ohne dauerhaft vergiftetes Ladeversprechen wiederholt werden',async()=>{
 const m=mock();let attempts=0;const recognizer=createPhotoRecognizer({services,support:()=>true,online:()=>true,importer:async()=>{if(++attempts===1)throw Error('Failed to fetch dynamically imported module');return m.runtime}});assert.equal((await recognizer.recognize(PHOTO)).reason,'network');recognizer.retry();assert.equal((await recognizer.recognize(PHOTO)).status,'ok');assert.equal(attempts,2);assert.equal(recognizer.getState().detail,null);
});
test('Erststart offline ist klar benannt; bereits geladene Modelle arbeiten offline weiter',async()=>{
 let connected=false,imports=0;const m=mock();const recognizer=createPhotoRecognizer({services,support:()=>true,online:()=>connected,importer:async()=>{imports++;return m.runtime}});assert.equal((await recognizer.recognize(PHOTO)).reason,'offline');assert.equal(imports,0);connected=true;await recognizer.recognize(PHOTO);connected=false;assert.equal((await recognizer.recognize(PHOTO)).status,'ok');assert.equal(imports,1);
});
test('Ungültige Fotos, URLs und fehlende Geräteunterstützung lösen keinen Modellimport aus',async()=>{
 let imports=0;const recognizer=createPhotoRecognizer({services,support:()=>true,online:()=>true,importer:async()=>{imports++;throw Error('unexpected import')}});for(const image of ['https://example.com/private-photo.jpg','data:image/svg+xml;base64,AAAA',null])assert.equal((await recognizer.recognize(image)).reason,'invalid-image');const unsupported=createPhotoRecognizer({services,support:()=>false,online:()=>true,importer:async()=>{imports++}});assert.equal((await unsupported.recognize(PHOTO)).reason,'unsupported');assert.equal(imports,0);
});
test('Ladezeitüberschreitung beendet Warten, späte Bereitschaft setzt keine alten Fotoergebnisse',async()=>{
 const load=deferred(),m=mock({load}),states=[];const recognizer=createPhotoRecognizer({services,support:()=>true,online:()=>true,importer:async()=>m.runtime,loadTimeoutMs:3,onStatus:state=>states.push(state)});const response=await recognizer.recognize(PHOTO);assert.equal(response.reason,'timeout');assert.equal(response.phase,'load');load.resolve();await until(()=>recognizer.getState().modelReady);assert.equal(recognizer.getState().stage,'error');assert.ok(!states.some(state=>state.stage==='ready'));recognizer.retry();assert.equal((await recognizer.recognize(PHOTO)).status,'ok');
});
test('Auswertungszeitüberschreitung erzeugt nachvollziehbare Meldung und keine falschen Resultate',async()=>{
 const run=deferred(),m=mock({classify:()=>run.promise});const recognizer=createPhotoRecognizer({services,support:()=>true,online:()=>true,importer:async()=>m.runtime,inferenceTimeoutMs:3});const response=await recognizer.recognize(PHOTO);assert.equal(response.reason,'timeout');assert.equal(response.phase,'inference');assert.deepEqual(response.suggestions,[]);run.resolve(result());await Promise.resolve();assert.equal(recognizer.getState().stage,'error');
});
test('CSP, Speicher- und WASM-Probleme erhalten unterschiedliche verständliche Fehler',()=>{
 assert.equal(classifyVisionError(Error('Refused to compile wasm because wasm-unsafe-eval CSP')).reason,'csp');assert.equal(classifyVisionError(Error('Out of memory')).reason,'memory');assert.equal(classifyVisionError(Error('WebAssembly CompileError SIMD unsupported')).reason,'wasm');assert.equal(classifyVisionError(Error('HTTP 404 failed to fetch')).reason,'network');assert.equal(classifyVisionError(Error('Bad image dimensions')).reason,'model');assert.match(VISION_DISCLAIMER,/vor Ort bestätigen/);
});
test('Fehler im UI-Statuscallback beschädigen das Modell nicht',async()=>{
 const m=mock();const recognizer=createPhotoRecognizer({services,support:()=>true,online:()=>true,importer:async()=>m.runtime,onStatus(){throw Error('Detached UI')}});assert.equal((await recognizer.recognize(PHOTO)).status,'ok');
});
test('Freigeben verhindert Wiederbelebung durch spätes Modell und beendet Ressourcen',async()=>{
 const load=deferred();let disposed=0;const runtime={env:{backends:{onnx:{wasm:{}}}},pipeline:async()=>{await load.promise;const classify=async()=>result();classify.dispose=()=>{disposed++};return classify}};const recognizer=createPhotoRecognizer({services,support:()=>true,online:()=>true,importer:async()=>runtime});const resultPromise=recognizer.recognize(PHOTO);await Promise.resolve();recognizer.dispose();assert.equal((await resultPromise).status,'cancelled');load.resolve();await until(()=>disposed===1);assert.equal(recognizer.getState().stage,'disposed');assert.equal((await recognizer.recognize(PHOTO)).status,'cancelled');
});
test('Gewerkefotos werden Kategorien zugeordnet und geben keine technischen Prüfungen frei',()=>{
 const craft=[{id:'socket_check',name:'Steckdose prüfen',category:'electrical'},{id:'light_mount',name:'Leuchte montieren',category:'electrical'},{id:'tap_fix',name:'Armatur',category:'building_services'},{id:'custom_work',name:'Sonderarbeit',category:'custom'}],labels=buildVisionLabels([...services,...craft]),electrical=labels.find(group=>group.id==='trade-electrical');
 assert.ok(electrical.categoryOnly);assert.deepEqual(electrical.services.map(service=>service.id),['socket_check','light_mount']);assert.match(electrical.label,/photograph of electrical sockets/);const ranked=rankVisionResults([{label:electrical.label,score:.8},{label:labels.find(group=>group.id==='other').label,score:.1}],labels);assert.ok(ranked.suggestions[0].categoryOnly);assert.equal(ranked.suggestions[0].safetyApproved,undefined);assert.ok(labels.find(group=>group.id==='other').services.some(service=>service.id==='custom_work'));
});
test('Aktueller Gesamtkatalog einschließlich Gewerken besitzt Kategorien oder ausdrücklichen manuellen Fallback',async()=>{
 const {services:catalogue}=await import('../dist/core.js'),labels=buildVisionLabels(catalogue),covered=new Set(labels.flatMap(group=>group.services.map(service=>service.id)));for(const service of catalogue)assert.ok(covered.has(service.id),service.id);
 for(const category of ['painting','electrical','building_services','roofing'])assert.ok(labels.some(group=>group.id==='trade-'+category&&group.services.length),category);
});
