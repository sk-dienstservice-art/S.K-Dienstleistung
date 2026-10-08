import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {initNative,saveNativeFile,printNative} from '../../dist/native.js';

const calls=[];
class TestWindow extends EventTarget{}
const win=new TestWindow();win.top=win;win.location={origin:'https://example.test'};
globalThis.window=win;
globalThis.document={documentElement:{dataset:{}},querySelector:()=>null};
assert.equal(initNative(),false,'Regular browsers must retain their own speech APIs.');
assert.equal(await saveNativeFile('test.txt','test','text/plain'),false);
assert.equal(printNative('test'),false);
win.location.origin='https://appassets.androidplatform.net';
win.NativeApp={
  ready(){calls.push(['ready']);},
  getVoices(){return JSON.stringify([{voiceURI:'de-local',name:'Deutsch lokal',lang:'de-DE',localService:true},null,{name:'invalid'}]);},
  startSpeech(...args){calls.push(['startSpeech',...args]);},stopSpeech(...args){calls.push(['stopSpeech',...args]);},
  abortSpeech(...args){calls.push(['abortSpeech',...args]);},speak(...args){calls.push(['speak',...args]);},
  cancelSpeech(){calls.push(['cancelSpeech']);},saveFile(...args){calls.push(['saveFile',...args]);},
  printDocument(...args){calls.push(['printDocument',...args]);}
};
assert.equal(initNative(),true);assert.equal(initNative(),true);
assert.equal(calls.filter(c=>c[0]==='ready').length,1,'Native initialization must be idempotent.');
assert.equal(document.documentElement.dataset.nativeApp,'android');
assert.equal(window.speechSynthesis.getVoices().length,1,'Malformed voices are ignored.');
let changes=0;window.speechSynthesis.addEventListener('voiceschanged',()=>changes++);
window.__werkpilotNative.receive('voices','',{});assert.equal(changes,1);

const recognition=new window.SpeechRecognition();recognition.maxAlternatives=12;recognition.interimResults=true;
let starts=0,results=0,ends=0,errors=0,lastResults;
recognition.onstart=()=>starts++;recognition.onresult=event=>{results++;lastResults=event.results;};
recognition.onend=()=>ends++;recognition.onerror=()=>errors++;
recognition.start();const id=calls.findLast(c=>c[0]==='startSpeech')[1];
assert.equal(calls.findLast(c=>c[0]==='startSpeech')[4],5);
assert.throws(()=>recognition.start(),{name:'InvalidStateError'});
window.__werkpilotNative.receive('recognition-start',id,{});assert.equal(starts,1);
window.__werkpilotNative.receive('recognition-result',id,{alternatives:[{transcript:'zweihundert Quadratmeter Rasen',confidence:1.8}],final:false});
assert.equal(results,1);assert.equal(lastResults[0].isFinal,false);assert.equal(lastResults[0][0].confidence,1);
window.__werkpilotNative.receive('recognition-result',id,{alternatives:[{transcript:'200 Quadratmeter Rasen',confidence:.9}],final:true});
assert.equal(results,2);assert.equal(lastResults[0].isFinal,true);
recognition.abort();assert.equal(ends,1);
window.__werkpilotNative.receive('recognition-result',id,{alternatives:[{transcript:'obsolete'}],final:true});
window.__werkpilotNative.receive('recognition-end',id,{});assert.equal(results,2);assert.equal(ends,1);
recognition.start();const id2=calls.findLast(c=>c[0]==='startSpeech')[1];
window.__werkpilotNative.receive('recognition-error',id2,{error:'not-allowed'});
window.__werkpilotNative.receive('recognition-end',id2,{});assert.equal(errors,1);assert.equal(ends,2);

const utterance=new window.SpeechSynthesisUtterance('Preis zweihundert Euro');utterance.voice=window.speechSynthesis.getVoices()[0];
let spoken=0,canceled=0;utterance.onend=()=>spoken++;utterance.onerror=()=>canceled++;
window.speechSynthesis.speak(utterance);const speechId=calls.findLast(c=>c[0]==='speak')[1];
assert.equal(JSON.parse(calls.findLast(c=>c[0]==='speak')[2]).voiceURI,'de-local');
window.speechSynthesis.cancel();window.__werkpilotNative.receive('tts-end',speechId,{});
assert.equal(spoken,0);assert.equal(canceled,1);
window.speechSynthesis.speak(utterance);const speechId2=calls.findLast(c=>c[0]==='speak')[1];
window.__werkpilotNative.receive('tts-end',speechId2,{});window.__werkpilotNative.receive('tts-end',speechId2,{});
assert.equal(spoken,1);assert.equal(window.speechSynthesis.speaking,false);
recognition.start();let pageHidden=0;window.addEventListener('pagehide',()=>pageHidden++);
window.__werkpilotNative.receive('paused','',{});assert.equal(pageHidden,1);assert.equal(ends,3);

globalThis.FileReader=class{
  readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result=`data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;this.onload();});}
};
assert.equal(await saveNativeFile('Sicherung.json','{"version":2}','application/json'),true);
const save=calls.findLast(c=>c[0]==='saveFile');assert.equal(save[1],'Sicherung.json');assert.equal(Buffer.from(save[3],'base64').toString(),'{"version":2}');
await assert.rejects(saveNativeFile('too-big.bin',new Blob([new Uint8Array(20*1024*1024+1)])),/20 MB/);
assert.equal(printNative('<article>Rechnung</article>'),true);
const printed=calls.findLast(c=>c[0]==='printDocument')[1];assert.match(printed,/<style>/);assert.match(printed,/<article>Rechnung<\/article>/);

const java=await readFile(new URL('../app/src/main/java/de/werkpilot/app/MainActivity.java',import.meta.url),'utf8');
assert.match(java,/setAllowFileAccess\(false\)/);assert.match(java,/setAllowContentAccess\(false\)/);
assert.match(java,/MIXED_CONTENT_NEVER_ALLOW/);assert.match(java,/frame-src 'none'/);
assert.match(java,/script-src 'self' https:\/\/cdn\.jsdelivr\.net 'wasm-unsafe-eval'/);
assert.match(java,/worker-src 'self' blob:/);assert.doesNotMatch(java,/'unsafe-eval'/);
assert.match(java,/https:\/\/\*\.huggingface\.co https:\/\/\*\.hf\.co/);
assert.match(java,/ACTION_CREATE_DOCUMENT/);assert.match(java,/requestPermissions/);
assert.match(java,/uri\.getPort\(\) == -1/);assert.match(java,/MAX_EXPORT_BYTES/);
// Source checks verify compatibility guards and availability/fallback wiring. They do not
// simulate an Android provider or establish whether a device honours the pause hints.
assert.match(java,/SDK_INT < 31\) return false;\s*try \{ return SpeechRecognizer\.isOnDeviceRecognitionAvailable\(this\);/);
assert.match(java,/!hasOnDeviceRecognition\(\) && !SpeechRecognizer\.isRecognitionAvailable\(this\)/);
assert.match(java,/if \(android\.os\.Build\.VERSION\.SDK_INT >= 31 && hasOnDeviceRecognition\(\)\)\s*\{\s*try \{ return SpeechRecognizer\.createOnDeviceSpeechRecognizer\(this\);/);
assert.match(java,/return SpeechRecognizer\.createSpeechRecognizer\(this\);/);
assert.match(java,/EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L/);
assert.match(java,/EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1000L/);
// Direct Studio import requires the real wrapper, not a placeholder or only bootstrap instructions.
const wrapperJar=await readFile(new URL('../gradle/wrapper/gradle-wrapper.jar',import.meta.url));
assert.equal(createHash('sha256').update(wrapperJar).digest('hex'),'2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046');
const wrapperProperties=await readFile(new URL('../gradle/wrapper/gradle-wrapper.properties',import.meta.url),'utf8');
assert.match(wrapperProperties,/^distributionUrl=https\\?:\/\/services\.gradle\.org\/distributions\/gradle-8\.11\.1-bin\.zip\s*$/m);
assert.match(wrapperProperties,/^distributionSha256Sum=f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6\s*$/m);
for(const file of ['gradlew','gradlew.bat'])assert.ok((await readFile(new URL('../'+file,import.meta.url))).length>0);
console.log('Native adapter, Android source guards and verified complete Gradle wrapper passed. Android compilation/device checks remain required.');
