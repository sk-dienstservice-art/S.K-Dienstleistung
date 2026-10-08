import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preparePhoto} from '../dist/photos.js';

const file=(extra={})=>({name:'Auftrag.jpg',type:'image/jpeg',size:1000,...extra});
function setup(width=2800,height=1400){const calls=[];const image={width,height,close(){calls.push('close')}};const canvas={width:0,height:0,getContext(){return{fillRect(){calls.push('white')},drawImage(){calls.push('draw')}}},toDataURL(type,quality){calls.push([type,quality]);return'data:image/jpeg;base64,AAAA'}};return{image,canvas,calls,options:{createBitmap:async()=>image,makeCanvas:()=>canvas}}}

test('Große Fotos werden mit korrektem Seitenverhältnis auf 1400 Pixel vorbereitet',async()=>{
 const x=setup();const output=await preparePhoto(file(),x.options);assert.equal(x.canvas.width,1400);assert.equal(x.canvas.height,700);assert.equal(output.name,'Auftrag.jpg');assert.equal(output.data,'data:image/jpeg;base64,AAAA');assert.deepEqual(x.calls.slice(0,2),['white','draw']);assert.ok(x.calls.includes('close'));
});
test('Kleine Bilder werden nicht künstlich hochskaliert',async()=>{
 const x=setup(320,160);await preparePhoto(file(),x.options);assert.equal(x.canvas.width,320);assert.equal(x.canvas.height,160);
});
test('Ein fehlgeschlagenes ImageBitmap nutzt den kompatiblen Bilddecoder',async()=>{
 const x=setup(800,600);let fallback=0;await preparePhoto(file(),{...x.options,createBitmap:async()=>{throw Error('Unsupported')},decodeFallback:async()=>{fallback++;return x.image}});assert.equal(fallback,1);assert.ok(x.calls.includes('draw'));
});
test('Fehlende Dateitypen können bei eindeutiger JPG-Endung erkannt werden',async()=>{
 const x=setup();assert.equal((await preparePhoto(file({type:'',name:'Handy.JPEG'}),x.options)).name,'Handy.JPEG');
});
test('Ungeeignete Formate, fehlende Datei und übergroße Dateien ergeben klare Meldungen',async()=>{
 const x=setup();await assert.rejects(preparePhoto(null,x.options),/auswählen/);await assert.rejects(preparePhoto(file({name:'Bild.heic',type:'image/heic'}),x.options),/HEIC/);await assert.rejects(preparePhoto(file({size:21*1024*1024}),x.options),/20 MB/);
});
test('Ungültige Bildmaße werden zurückgewiesen und Bitmap-Ressourcen freigegeben',async()=>{
 for(const [w,h]of [[0,0],[20000,20000]]){const x=setup(w,h);await assert.rejects(preparePhoto(file(),x.options),/Bildgröße/);assert.ok(x.calls.includes('close'));}
});
test('Canvasfehler führen zu einer sichtbaren WebView-Empfehlung',async()=>{
 const x=setup();x.canvas.getContext=()=>null;await assert.rejects(preparePhoto(file(),x.options),/WebView/);assert.ok(x.calls.includes('close'));
});
test('Fehlgeschlagene JPG-Erzeugung erzeugt keinen scheinbar verwendbaren Fotoanhang',async()=>{
 const x=setup();x.canvas.toDataURL=()=> 'data:,';await assert.rejects(preparePhoto(file(),x.options),/JPG/);
});
