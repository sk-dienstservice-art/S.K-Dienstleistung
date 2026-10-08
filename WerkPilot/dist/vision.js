// Browser bundle and WASM assets must come from the same pinned release.
// Verified against transformers.js tag 3.7.2: webpack BUNDLE_BUILD includes ORT;
// the .web build externalizes bare onnxruntime imports and cannot be used here.
export const VISION_RUNTIME={version:'3.7.2',moduleURL:'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/transformers.min.js',wasmPath:'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/',model:'Xenova/clip-vit-base-patch32'};
export const VISION_DISCLAIMER='Bildvorschläge beschreiben sichtbare Motive. Modellwerte sind keine verlässlichen Wahrscheinlichkeiten. Leistung, Maße, Aufwand, Schäden und Sicherheit vor Ort bestätigen.';
const LABEL_GROUPS=[
 {id:'lawn',label:'a photograph of a grassy lawn in a garden',services:['lawn']},
 {id:'hedge',label:'a photograph of a garden hedge or shaped green shrubs',services:['hedge','shape','radical']},
 {id:'weeds',label:'a photograph of weeds growing in a garden bed or pavement joints',services:['weeds']},
 {id:'landscape',label:'a photograph of a landscaped garden with flower beds and plants',services:['landscape']},
 {id:'tree',label:'a photograph of a tree with a trunk, crown and branches',services:['tree','felling']},
 {id:'greenhaul',label:'a photograph of a pile of cut branches, leaves and garden waste',services:['greenhaul']},
 {id:'home',label:'a photograph of a furnished residential room or home interior',services:['home','house']},
 {id:'deep',label:'a photograph of a dirty or stained indoor floor',services:['deep']},
 {id:'window',label:'a photograph of windows or glass panes in a building',services:['window']},
 {id:'stairs',label:'a photograph of an indoor staircase or stairwell',services:['stairs']},
 {id:'office',label:'a photograph of an office with work desks and chairs',services:['office']},
 {id:'practice',label:'a photograph of a medical clinic or examination room',services:['practice']},
 {id:'other',label:'a photograph unrelated to gardening, building maintenance or construction trades',services:[]}
];

const TRADE_LABELS={painting:'a photograph of painted interior walls or a room being painted',drywall:'a photograph of unfinished plasterboard walls or drywall construction',flooring:'a photograph of wooden, laminate or vinyl flooring',tiling:'a photograph of ceramic wall or floor tiles',masonry:'a photograph of a brick, stone or concrete block wall',plaster:'a photograph of rough plaster or rendering on a wall',paving:'a photograph of a paved driveway, path or concrete paving stones',carpentry:'a photograph of wooden carpentry, timber construction or wood fittings',assembly:'a photograph of furniture parts, cabinets or household fittings being assembled',metal:'a photograph of metal construction, railings or metal fittings',electrical:'a photograph of electrical sockets, switches, wiring or an electrical panel',building_services:'a photograph of plumbing pipes, taps, radiators or heating equipment',roofing:'a photograph of a building roof, roof tiles or gutters',demolition:'a photograph of building rubble or construction demolition debris'};
export function buildVisionLabels(services){
 const catalogue=new Map((services||[]).map(service=>[service.id,service])),groups=LABEL_GROUPS.filter(group=>group.id!=='other'&&group.services.some(id=>catalogue.has(id))).map(group=>({...group,services:group.services.map(id=>catalogue.get(id)).filter(Boolean)})),mapped=new Set(groups.flatMap(group=>group.services.map(service=>service.id)));
 for(const [category,label]of Object.entries(TRADE_LABELS)){const members=[...catalogue.values()].filter(service=>service.category===category&&!mapped.has(service.id));if(members.length){groups.push({id:'trade-'+category,label,services:members,categoryOnly:true});for(const service of members)mapped.add(service.id)}}
 const other=LABEL_GROUPS.find(group=>group.id==='other');groups.push({...other,services:[...catalogue.values()].filter(service=>!mapped.has(service.id)),categoryOnly:true});return groups;
}
export function rankVisionResults(results,groups,{minimumScore=.3,minimumGap=.08}={}){
 const labels=new Map(groups.map(group=>[group.label,group])),seen=new Set(),ranked=[];
 for(const result of Array.isArray(results)?results:[]){const group=labels.get(result?.label),score=result?.score;if(!group||seen.has(group.id)||typeof score!=='number'||!Number.isFinite(score)||score<0||score>1)continue;seen.add(group.id);ranked.push({group,score})}
 ranked.sort((a,b)=>b.score-a.score);const top=ranked[0],gap=top?top.score-(ranked[1]?.score||0):0;
 const uncertain=!top||top.group.id==='other'||top.score<minimumScore||gap<minimumGap;
 const alternatives=ranked.filter(item=>item.group.id!=='other').slice(0,3).map(({group,score})=>({category:group.id,categoryOnly:Boolean(group.categoryOnly),service:group.services[0],relatedServices:group.services.slice(1),score}));
 return {status:uncertain?'uncertain':'ok',suggestions:uncertain?[]:alternatives,alternatives,gap,reason:!top?'no-results':top.group.id==='other'?'unrelated':uncertain?'weak-or-ambiguous':null,disclaimer:VISION_DISCLAIMER};
}
class VisionFailure extends Error{constructor(code,message){super(message);this.code=code}}
export function classifyVisionError(error,{online=true}={}){
 const detail=String(error?.message||error||'Unbekannter Fehler').replace(/data:image\/[^\s]+/g,'[Foto]').slice(0,240),code=error?.code;
 if(code==='cancelled')return {reason:'cancelled',message:'Fotoerkennung gestoppt.'};
 if(code==='unsupported')return {reason:'unsupported',message:'Dieses Gerät unterstützt die benötigte WebAssembly-Bildverarbeitung nicht. Foto und manuelles Aufmaß bleiben verfügbar.'};
 if(code==='invalid-image')return {reason:'invalid-image',message:'Bitte ein gültiges JPG-, PNG- oder WebP-Foto auswählen. Externe Bildadressen werden nicht geladen.'};
 if(code==='offline'||!online)return {reason:'offline',message:'Keine Internetverbindung. Für den ersten Modellstart wird Internet benötigt. Ein bereits geladenes Modell kann in dieser Sitzung offline weiterarbeiten.'};
 if(code==='load-timeout')return {reason:'timeout',phase:'load',message:'Der Modelldownload hat zu lange gedauert. Verbindung prüfen und erneut versuchen. Ein bereits laufender Download kann im Hintergrund fertig werden.'};
 if(code==='inference-timeout')return {reason:'timeout',phase:'inference',message:'Die Fotoauswertung hat zu lange gedauert. Ein kleineres Foto versuchen; auf langsamen Geräten die App nach einem festhängenden Lauf neu öffnen.'};
 if(/content.security.policy|\bcsp\b|wasm-unsafe-eval|unsafe-eval|refused to (?:load|compile)/i.test(detail))return {reason:'csp',message:'Die App-Freigaben blockieren eine Modell- oder WASM-Datei. Die aktuelle App-Version verwenden.',detail};
 if(/out of memory|memory allocation|array buffer allocation|\boom\b/i.test(detail))return {reason:'memory',message:'Für dieses Bildmodell reicht der freie Gerätespeicher nicht. Andere Apps schließen, kleineres Foto verwenden oder manuell fortfahren.',detail};
 if(/webassembly|\bwasm\b|no available backend|simd|sharedarraybuffer/i.test(detail))return {reason:'wasm',message:'Die lokale Bildverarbeitung konnte nicht gestartet werden. Android System WebView bzw. Browser aktualisieren und die App neu öffnen.',detail};
 if(/fetch|network|download|importing|module specifier|404|403|failed to load/i.test(detail))return {reason:'network',message:'Eine Modelldatei konnte nicht geladen werden. Verbindung und App-Freigaben prüfen; erneut versuchen oder manuelles Aufmaß verwenden.',detail};
 return {reason:'model',message:'Das Bildmodell konnte dieses Foto nicht auswerten. Anderes Foto versuchen oder Leistung manuell auswählen.',detail};
}

/** Local inference after explicit lazy downloads; image data never goes to a server. */
export function createPhotoRecognizer({services,onStatus=()=>{},importer=url=>import(url),support=()=>typeof WebAssembly==='object'&&typeof WebAssembly.instantiate==='function'&&typeof globalThis.Image==='function',online=()=>globalThis.navigator?.onLine!==false,loadTimeoutMs=180000,inferenceTimeoutMs=45000,minimumScore=.3,minimumGap=.08}={}){
 const groups=buildVisionLabels(services);let generation=0,disposed=false,model=null,loadPromise=null,inferenceTail=Promise.resolve(),activeImage=null;
 const waits=new Set();let state={stage:'idle',status:'idle',message:'Foto auswählen und Erkennung starten.',busy:false,progress:null,reason:null,imageId:null,modelReady:false};
 function emit(stage,message,extra={},token=generation){if(disposed||token!==generation)return;state={...state,stage,status:stage,message,progress:null,reason:null,detail:null,phase:null,...extra,modelReady:Boolean(model)};try{onStatus({...state,progress:state.progress?{...state.progress}:null})}catch{}}
 function invalidate(){generation++;for(const cancel of [...waits])cancel();waits.clear();return generation}
 function deadline(promise,ms,code,token){return new Promise((resolve,reject)=>{let done=false;const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);waits.delete(cancel);fn(value)},cancel=()=>finish(reject,new VisionFailure('cancelled','Gestoppt'));const timer=setTimeout(()=>finish(reject,new VisionFailure(code,'Zeitüberschreitung')),Math.max(1,Number(ms)||1));waits.add(cancel);Promise.resolve(promise).then(value=>token===generation&&!disposed?finish(resolve,value):cancel(),error=>finish(reject,error));if(token!==generation||disposed)cancel()})}
 async function loadModel(){
  if(model)return model;if(loadPromise)return loadPromise;
  emit('loading-library','Bildbibliothek wird geladen …',{busy:true});
  const attempt=(async()=>{const runtime=await importer(VISION_RUNTIME.moduleURL);if(typeof runtime.pipeline!=='function'||!runtime.env?.backends?.onnx?.wasm)throw new VisionFailure('unsupported','WASM-Bibliothek fehlt.');
   runtime.env.allowLocalModels=false;runtime.env.allowRemoteModels=true;const wasm=runtime.env.backends.onnx.wasm;wasm.numThreads=1;wasm.proxy=false;wasm.wasmPaths=VISION_RUNTIME.wasmPath;
   if(!disposed&&activeImage!==null)emit('downloading-model','Bildmodell wird geladen. Beim ersten Start werden größere Dateien heruntergeladen …',{busy:true});
   const pipeline=await runtime.pipeline('zero-shot-image-classification',VISION_RUNTIME.model,{device:'wasm',dtype:'q8',progress_callback:event=>{if(disposed||activeImage===null||!state.busy)return;const file=typeof event?.file==='string'?event.file.split('/').at(-1):'',loaded=Number(event?.loaded),total=Number(event?.total),progress=Number(event?.progress);const percent=Number.isFinite(progress)?Math.max(0,Math.min(100,progress)):Number.isFinite(loaded)&&Number.isFinite(total)&&total>0?Math.max(0,Math.min(100,loaded/total*100)):null;if(event?.status==='progress')emit('downloading-model','Modelldatei wird geladen …',{busy:true,progress:{file,loaded:Number.isFinite(loaded)?loaded:null,total:Number.isFinite(total)?total:null,percent}});else if(event?.status==='ready')emit('initializing-model','Lokale Bildverarbeitung wird vorbereitet …',{busy:true});}});
   if(typeof pipeline!=='function')throw Error('Das Bildmodell wurde nicht korrekt geladen.');if(disposed){await pipeline.dispose?.();throw new VisionFailure('cancelled','Gestoppt')}model=pipeline;return pipeline;})();
  loadPromise=attempt;attempt.catch(()=>{if(loadPromise===attempt)loadPromise=null});return attempt;
 }
 async function recognize(image,{imageId}={}){
  const token=invalidate();if(disposed)return {status:'cancelled',reason:'disposed',suggestions:[],alternatives:[]};activeImage=imageId??token;const requestImageId=activeImage;
  const payload=typeof image==='string'?image:image?.data;state={...state,imageId:activeImage};
  const cancelled=()=>({status:'cancelled',reason:'cancelled',suggestions:[],alternatives:[],disclaimer:VISION_DISCLAIMER});
  try{
   emit('checking','Fotoerkennung wird geprüft …',{busy:true});
   if(typeof payload!=='string'||payload.length>12*1024*1024||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(payload))throw new VisionFailure('invalid-image','Ungültiges lokales Foto.');
   if(!support())throw new VisionFailure('unsupported','WebAssembly fehlt.');
   if(!model&&!loadPromise&&!online())throw new VisionFailure('offline','Erstdownload ohne Verbindung nicht möglich.');
   const classifier=await deadline(loadModel(),loadTimeoutMs,'load-timeout',token);if(token!==generation||disposed)return cancelled();
   emit('analyzing','Foto wird auf diesem Gerät ausgewertet …',{busy:true});
   const run=inferenceTail.catch(()=>{}).then(()=>{if(token!==generation||disposed)throw new VisionFailure('cancelled','Gestoppt');return classifier(payload,groups.map(group=>group.label),{hypothesis_template:'This is {}.'})});inferenceTail=run.catch(()=>{});
   const results=await deadline(run,inferenceTimeoutMs,'inference-timeout',token);if(token!==generation||disposed)return cancelled();
   const ranked=rankVisionResults(results,groups,{minimumScore,minimumGap}),message=ranked.status==='ok'?'Bildvorschläge bereit. Die passende Leistung und das Aufmaß bitte selbst bestätigen.':'Kein eindeutiger Bildvorschlag. Wähle die Leistung manuell; mögliche Alternativen sind unverbindlich.';
   emit(ranked.status==='ok'?'ready':'uncertain',message,{busy:false,reason:ranked.reason});activeImage=null;return {...ranked,message,imageId:requestImageId};
  }catch(error){if(token!==generation||disposed||error?.code==='cancelled')return cancelled();const failure=classifyVisionError(error,{online:online()});emit('error',failure.message,{busy:false,reason:failure.reason,detail:failure.detail,phase:failure.phase});activeImage=null;return {status:'error',imageId:requestImageId,...failure,suggestions:[],alternatives:[],disclaimer:VISION_DISCLAIMER};}
 }
 function cancel(){invalidate();activeImage=null;emit('cancelled','Fotoerkennung gestoppt.',{busy:false,imageId:null});}
 function retry(){if(disposed)return;invalidate();activeImage=null;emit('idle','Erneut bereit. Fotoerkennung starten.',{busy:false,imageId:null});}
 function dispose(){if(disposed)return;cancel();disposed=true;const current=model;model=null;state={...state,stage:'disposed',status:'disposed',busy:false,modelReady:false};inferenceTail.finally(()=>current?.dispose?.()).catch(()=>{});}
 return {recognize,cancel,retry,dispose,getState:()=>({...state,progress:state.progress?{...state.progress}:null,modelReady:Boolean(model)})};
}
