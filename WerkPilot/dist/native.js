// Only the packaged Android app provides this bridge. Browser and PWA behaviour stays unchanged.
const NATIVE_ORIGIN='https://appassets.androidplatform.net';
const MAX_EXPORT_BYTES=20*1024*1024;
let bridge=null,installed=false,sequence=0,activeRecognition=null,activeUtterance=null,synthesis=null;
const recognitions=new Map();
const nextId=prefix=>`${prefix}_${++sequence}`;

function fire(target,type,details={}){
  const event=Object.assign(new Event(type),details);
  if(typeof target[`on${type}`]==='function')target[`on${type}`](event);
  target.dispatchEvent(event);
}
function voiceList(){
  try{
    const voices=JSON.parse(bridge.getVoices());
    return Array.isArray(voices)?voices.filter(v=>v&&typeof v.voiceURI==='string'&&typeof v.lang==='string').map(v=>({
      voiceURI:v.voiceURI,name:String(v.name||v.voiceURI),lang:v.lang,localService:!!v.localService,default:!!v.default
    })):[];
  }catch{return []}
}
class NativeRecognition extends EventTarget{
  constructor(){super();this.lang='de-DE';this.continuous=false;this.interimResults=false;this.maxAlternatives=1;this._id=null;}
  start(){
    if(this._id)throw new DOMException('Spracheingabe läuft bereits.','InvalidStateError');
    if(activeRecognition)activeRecognition.abort();
    const id=nextId('r');this._id=id;activeRecognition=this;recognitions.set(id,this);
    try{bridge.startSpeech(id,String(this.lang||'de-DE'),!!this.interimResults,Math.max(1,Math.min(5,Number(this.maxAlternatives)||1)));}
    catch{finishRecognition(this,'service-not-allowed');}
  }
  stop(){if(this._id)bridge.stopSpeech(this._id);}
  abort(){
    if(!this._id)return;
    const id=this._id;
    try{bridge.abortSpeech(id);}finally{finishRecognition(this);}
  }
}
function finishRecognition(recognition,error=''){
  const id=recognition._id;if(!id)return;
  recognitions.delete(id);recognition._id=null;
  if(activeRecognition===recognition)activeRecognition=null;
  if(error)fire(recognition,'error',{error,message:error});
  fire(recognition,'end');
}
class NativeUtterance extends EventTarget{
  constructor(text=''){super();this.text=String(text);this.lang='de-DE';this.voice=null;this.rate=1;this.pitch=1;this.volume=1;}
}
class NativeSynthesis extends EventTarget{
  constructor(){super();this.speaking=false;this.pending=false;this.paused=false;}
  getVoices(){return voiceList();}
  speak(utterance){
    if(!utterance||typeof utterance.text!=='string')throw new TypeError('Eine Sprachantwort ist erforderlich.');
    this.cancel();
    if(activeRecognition)activeRecognition.abort();
    const id=nextId('u');activeUtterance={id,utterance};this.speaking=true;
    try{bridge.speak(id,JSON.stringify({text:utterance.text,voiceURI:utterance.voice?.voiceURI||'',rate:utterance.rate,pitch:utterance.pitch,volume:utterance.volume}));}
    catch{finishUtterance('synthesis-unavailable');}
  }
  cancel(){
    try{bridge.cancelSpeech();}catch{}
    if(activeUtterance)finishUtterance('canceled');
  }
  // Android's system TTS has no equivalent resume API. Cancelling is deterministic.
  pause(){this.cancel();}
  resume(){}
}
function finishUtterance(error=''){
  const pending=activeUtterance;activeUtterance=null;
  if(synthesis){synthesis.speaking=false;synthesis.pending=false;synthesis.paused=false;}
  if(!pending)return;
  fire(pending.utterance,error?'error':'end',error?{error}:{});
}

/** Call once before app initVoice(). Returns false outside the trusted Android asset origin. */
export function initNative(){
  if(installed)return true;
  if(typeof window==='undefined'||window.location?.origin!==NATIVE_ORIGIN||window.top!==window)return false;
  const candidate=window.NativeApp;
  if(!candidate||!['getVoices','startSpeech','stopSpeech','abortSpeech','speak','cancelSpeech','saveFile','printDocument','ready'].every(k=>typeof candidate[k]==='function'))return false;
  bridge=candidate;synthesis=new NativeSynthesis();
  window.__werkpilotNative={
    receive(type,id,payload={}){
      if(type==='voices'){fire(synthesis,'voiceschanged');return;}
      if(type==='paused'){
        if(activeRecognition)activeRecognition.abort();
        synthesis.cancel();window.dispatchEvent(new Event('pagehide'));return;
      }
      if(type.startsWith('recognition-')){
        const recognition=recognitions.get(id);if(!recognition)return;
        if(type==='recognition-start'){fire(recognition,'start');return;}
        if(type==='recognition-error'){finishRecognition(recognition,String(payload.error||'service-not-allowed'));return;}
        if(type==='recognition-end'){finishRecognition(recognition);return;}
        if(type==='recognition-result'){
          const alternatives=Array.isArray(payload.alternatives)?payload.alternatives.filter(v=>v&&typeof v.transcript==='string').map(v=>({transcript:v.transcript,confidence:Math.max(0,Math.min(1,Number(v.confidence)||0))})):[];
          if(!alternatives.length)return;
          alternatives.isFinal=!!payload.final;alternatives.item=i=>alternatives[i];
          const results=[alternatives];results.item=i=>results[i];
          fire(recognition,'result',{results,resultIndex:0});return;
        }
      }
      if(!activeUtterance||activeUtterance.id!==id)return;
      if(type==='tts-start')fire(activeUtterance.utterance,'start');
      else if(type==='tts-end')finishUtterance();
      else if(type==='tts-error')finishUtterance(String(payload.error||'synthesis-failed'));
    },
    back(){
      const dialog=document.querySelector('dialog[open]');
      if(dialog){dialog.close();return true;}
      const event=new Event('werkpilot-native-back',{cancelable:true});
      window.dispatchEvent(event);return event.defaultPrevented;
    }
  };
  try{
    Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:NativeRecognition});
    Object.defineProperty(window,'webkitSpeechRecognition',{configurable:true,value:NativeRecognition});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:synthesis});
    Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:NativeUtterance});
  }catch{bridge=null;delete window.__werkpilotNative;return false;}
  installed=true;document.documentElement.dataset.nativeApp='android';
  bridge.ready();return true;
}

/** True means the native save dialog has been requested; its Android result is user controlled. */
export async function saveNativeFile(name,content,type='application/octet-stream'){
  if(!installed)return false;
  const blob=content instanceof Blob?content:new Blob([content],{type});
  if(blob.size>MAX_EXPORT_BYTES)throw new Error('Export zu groß. Höchstens 20 MB pro Datei möglich.');
  const dataUrl=await new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Exportdatei konnte nicht vorbereitet werden.'));reader.readAsDataURL(blob);
  });
  bridge.saveFile(String(name),String(type||blob.type||'application/octet-stream'),dataUrl.slice(dataUrl.indexOf(',')+1));
  return true;
}

/** A separate print WebView has JavaScript and all network resource requests disabled. */
export function printNative(html){
  if(!installed)return false;
  const css=`body{font:13px sans-serif;line-height:1.6;color:#222;margin:0;padding:24px}.invoicepage{padding:0}header{display:flex;justify-content:space-between;gap:20px}h1{font-size:27px}h2{font-size:18px}table{width:100%;border-collapse:collapse;text-align:left;white-space:normal}th{background:#eee}th,td{border-bottom:1px solid #ddd;padding:9px;vertical-align:top}td{font-size:12px}.sum{text-align:right}.total{font-size:20px}.pagebreak{page-break-before:always}@page{size:A4;margin:20mm}`;
  const content=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${String(html)}</body></html>`;
  if(content.length>2000000)throw new Error('Dokument zu groß zum Drucken.');
  bridge.printDocument(content);return true;
}
