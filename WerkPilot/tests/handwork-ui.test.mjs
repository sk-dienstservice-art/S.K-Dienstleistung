import vm from 'node:vm';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {bundleApp} from '../scripts/bundle.mjs';

// Runs real bundled application handlers with DOM/controller doubles.
// These checks do not claim browser rendering, model inference or Android testing.
const source=bundleApp(process.cwd(),{stripBoot:true});
function harness(){
 const elements=new Map(),listeners=new Map(),persisted=[],printed=[],opened=[],confirmations=[];
 function element(){return {innerHTML:'',textContent:'',value:'',style:{},dataset:{},files:[],listeners:{},attributes:{},disabled:false,open:false,
  addEventListener(name,callback){this.listeners[name]=callback},showModal(){this.open=true},close(){this.open=false},
  querySelector(){return element()},querySelectorAll(){return []},
  setAttribute(key,value){this.attributes[key]=String(value)},removeAttribute(key){delete this.attributes[key]},
  classList:{toggle(){},add(){},remove(){}},click(){if(this.href)opened.push(this.href)},
  getBoundingClientRect(){return{left:0,right:100,top:0,bottom:100}}};}
 const document={documentElement:{dataset:{},style:{setProperty(){}}},body:{dataset:{},classList:{toggle(){},add(){},remove(){}}},
  querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector)},
  querySelectorAll(selector){return selector==='form'?[...elements].filter(([key])=>key.endsWith('-form')).map(([,value])=>value):[]},
  createElement:element,addEventListener(name,callback){listeners.set(name,callback)}};
 const location={protocol:'file:',hostname:'',search:'',href:'file:///WerkPilot.html',origin:'null'};
 const window={document,location,persisted,opened,scrollTo(){},open(url){opened.push(url);return null},
  print(){printed.push(document.querySelector('#print').innerHTML)},matchMedia(){return{matches:false,addEventListener(){}}}};
 let timer=0;
 const context=vm.createContext({document,window,location,navigator:{},crypto:webcrypto,structuredClone,console,Date,Intl,Map,Set,JSON,Number,String,Array,Math,Promise,Blob,URL,URLSearchParams,TextEncoder,EventTarget,Event,DOMException,
  setTimeout(){return ++timer},clearTimeout(){},confirm(message){confirmations.push(message);return window.confirmResult!==false},
  FormData:function(target){return new Map(Object.entries(target.data||{}))}});
 vm.runInContext(source,context);
 const run=code=>vm.runInContext(code,context);
 run("persist=async()=>{durableState=structuredClone(state);window.persisted.push(structuredClone(state))};");
 async function action(action,details={}){
  const target={dataset:{action,...details},tagName:'BUTTON',closest(){return this},hasAttribute(){return false},matches(){return false}};
  await listeners.get('click')({target,preventDefault(){}});
 }
 function seed(){run(`state=initial();state.settings={...state.settings,company:'Werk & Grün',owner:'Max Beispiel',address:'Gartenweg 4, 10115 Berlin',email:'betrieb@example.com',phone:'030 123456',taxId:'12/345/67890',businessStart:'2025-01-02'};
  state.customers=[{id:'customer',name:'Familie Sommer',type:'Privatkunde',address:'Sommerweg 6, 10115 Berlin',email:'kunde@example.com',phone:'030 987654',notes:''}];
  state.jobs=[{...newDraft(),id:'job',title:'Wandbeschichtung',customer:'customer',lines:[{service:'paint_wall',qty:20,rate:14}],date:'',siteDetails:{siteInspected:true}}];durableState=structuredClone(state);`);}
 function photoFields(values={}){
  for(const [key,value]of Object.entries({'photo-service':'','photo-qty':'','photo-height':'','photo-stage':'before','photo-caption':'',...values}))document.querySelector('#'+key).value=String(value);
 }
 function mockVision({status={stage:'idle',message:'Bereit',busy:false},recognize=async()=>({status:'uncertain',suggestions:[],alternatives:[]})}={}){
  const calls={retry:0,cancel:0,recognize:[]};
  context.controller={getState:()=>status,retry(){calls.retry++},cancel(){calls.cancel++},async recognize(image,options){calls.recognize.push({image,options});return recognize(image,options)}};
  run('photoRecognizer=controller');return calls;
 }
 function initPhoto(){mockVision();run("view='photos';draft=null;photo={name:'Wand.jpg',data:'data:image/jpeg;base64,AAAA'};photoCollection=[photo];render()");photoFields();}
 function formDataForDraft(){const j=run('structuredClone(draft)');return {...j,...Object.fromEntries(Object.entries(j.siteDetails||{}).map(([key,value])=>['site-'+key,value===true?'on':value]))};}
 return {run,context,elements,window,persisted,printed,opened,confirmations,action,seed,photoFields,mockVision,initPhoto,formDataForDraft};
}
const plain=value=>JSON.parse(JSON.stringify(value));
const photoImage=name=>({name,data:'data:image/jpeg;base64,'+(name==='new.jpg'?'BBBB':'AAAA')});
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve};}

test('Alle 59 Vorlagen und 17 Bereiche sowie die drei Arbeitsseiten sind erreichbar',async()=>{
 const h=harness();h.seed();assert.equal(h.run('services.length'),59);assert.equal(h.run('businessGroups.length'),17);
 const nav=Array.from(h.run('appNavigation().map(row=>row[0])'));for(const id of ['trades','planner','photos'])assert.ok(nav.includes(id));
 await h.action('open-trades');assert.equal(h.run('view'),'trades');assert.match(h.elements.get('#app').innerHTML,/59 passende Vorlagen/);
 await h.action('open-planner');assert.equal(h.run('view'),'planner');assert.match(h.elements.get('#app').innerHTML,/Material & Maschinen planen/);
 h.run("view='photos';render()");assert.equal(typeof h.elements.get('#photo-file').onchange,'function');assert.equal(typeof h.elements.get('#photo-measure-form').onsubmit,'function');
});

test('Handwerk und gemischte Aufträge zeigen ihre tatsächlichen Gewerke im Badge',()=>{
 const h=harness();h.seed();const html=h.run('categoryPill(state.jobs[0])');assert.match(html,/Maler/);assert.doesNotMatch(html,/Reinigung/);
 h.run("state.jobs[0].lines.push({service:'window',qty:1,rate:5})");const mixed=h.run('categoryPill(state.jobs[0])');assert.match(mixed,/Maler/);assert.match(mixed,/Gebäudereinigung/);
});

test('Eine neue Handwerkskalkulation nutzt eigene Sätze ohne erfundene Anfahrt',async()=>{
 const h=harness();h.seed();h.run("draft=null;state.settings.serviceRates={paint_wall:19.5}");await h.action('craft-add',{id:'paint_wall'});
 assert.deepEqual(plain(h.run('draft.lines')),[{service:'paint_wall',qty:10,rate:19.5}]);for(const key of ['km','travelHours','travelPrice'])assert.equal(h.run('draft.'+key),0);
 assert.equal(h.run('view'),'calc');assert.equal(h.persisted.length,0);
});

test('Eine weitere Vorlage ergänzt den bestehenden Auftrag und erhält Kundendaten und Kosten',async()=>{
 const h=harness();h.seed();h.run("draft=structuredClone(state.jobs[0]);draft.km=25;draft.travelHours=1;draft.material=18;draft.notes='Untergrund geprüft';draft.resourceCostsApplied=true");
 await h.action('craft-add',{id:'paint_ceiling'});assert.equal(h.run('draft.id'),'job');assert.equal(h.run('draft.lines.length'),2);assert.equal(h.run('draft.lines[0].service'),'paint_wall');
 assert.equal(h.run('draft.customer'),'customer');assert.equal(h.run('draft.km'),25);assert.equal(h.run('draft.material'),18);assert.equal(h.run('draft.notes'),'Untergrund geprüft');assert.equal(h.run('draft.resourceCostsApplied'),false);
});

test('Freie Beschreibungen, Einheiten und Personenminuten werden bearbeitet und im Angebotsstand eingefroren',()=>{
 const h=harness();h.seed();h.run("draft=structuredClone(state.jobs[0]);draft.lines=[{service:'customwork',qty:3,rate:55}];draft.setupHours=0;draft.travelHours=0;draft.km=0;draft.travelPrice=0");
 h.context.description='Nordwand <img src=x onerror=alert(1)> & Prüfung';
 h.run("readDraft({dataset:{lineField:'description',index:'0'},value:description});readDraft({dataset:{lineField:'unit',index:'0'},value:'Pauschal'});readDraft({dataset:{lineField:'minutes',index:'0'},value:'75'});state.jobs[0]=structuredClone(draft);window.quote=createQuote(state,'job')");
 assert.equal(h.run('calculate(draft,state.settings).hours'),3.75);assert.equal(h.run('window.quote.job.lines[0].minutes'),75);
 assert.match(h.run('lineForm(draft.lines[0],0)'),/value="75"/);
 const pdf=h.run("documentHTML(window.quote.job,'Angebot',{...window.quote,issued:window.quote.created})");assert.match(pdf,/Pauschal/);assert.match(pdf,/&lt;img/);assert.match(pdf,/&amp; Prüfung/);assert.doesNotMatch(pdf,/<img src=x/);
 h.run("draft.lines[0].description='Anderer Umfang';draft.lines[0].minutes=10;state.settings.hourlyCost=999");assert.equal(h.run('window.quote.job.lines[0].minutes'),75);assert.ok(!h.run('window.quote.job.lines[0].description').includes('Anderer'));
 assert.match(h.run("documentHTML({...draft,lines:[{...draft.lines[0],unit:'<svg onload=alert(1)>'}]})"),/&lt;svg/);
});

test('Material- und Maschinenvorschläge verlangen bestätigte Istpreise, auch für Bestand',async()=>{
 const h=harness();h.seed();h.run("draft=structuredClone(state.jobs[0]);state.owned=['craft_paintkit'];view='planner'");await h.action('resource-suggest');
 const rows=plain(h.run('draft.resources'));assert.ok(rows.some(r=>r.kind==='material'));assert.ok(rows.some(r=>r.kind==='machine'&&r.mode==='owned'));
 assert.ok(rows.every(r=>r.unitCost===0&&r.costConfirmed===false));assert.ok(h.run('resourceTotals(draft.resources).missing.length')>0);
 const oldMaterial=h.run('draft.material');await h.action('resource-apply');assert.equal(h.run('draft.material'),oldMaterial);assert.equal(h.run('draft.resourceCostsApplied'),false);assert.match(h.elements.get('#toast').textContent,/bestätigen/);
 h.run('draft.resources.forEach(r=>r.costConfirmed=true)');await h.action('resource-apply');assert.equal(h.run('draft.resourceCostsApplied'),true);assert.equal(h.run('draft.rental'),0);
});

test('Maschinen-Kaufannahmen werden niemals als auftragsbezogene Miete übernommen',async()=>{
 const h=harness();h.seed();h.run("draft=structuredClone(state.jobs[0]);view='planner'");await h.action('resource-suggest');
 assert.ok(h.run("draft.resources.filter(r=>r.kind==='machine').some(r=>equipment.find(eq=>eq.id===r.equipmentId)?.price>0)"));
 assert.ok(h.run("draft.resources.filter(r=>r.kind==='machine').every(r=>r.unitCost===0&&r.costConfirmed===false)"));
 assert.match(h.elements.get('#app').innerHTML,/Kaufpreise sind keine Mietkosten/);
});

test('Das Übernehmen von Ressourcen ersetzt bestehende Zusatzkosten nur nach Bestätigung',async()=>{
 const h=harness();h.seed();h.run("draft=structuredClone(state.jobs[0]);view='planner';draft.material=90;draft.rental=50;draft.resources=[{id:'r1',kind:'material',name:'Farbe',unit:'Liter',quantity:2,unitCost:12,use:true,costConfirmed:true}]");
 h.window.confirmResult=false;await h.action('resource-apply');assert.equal(h.run('draft.material'),90);assert.equal(h.run('draft.rental'),50);assert.equal(h.run('draft.resourceCostsApplied'),false);assert.equal(h.confirmations.length,1);
 h.window.confirmResult=true;await h.action('resource-apply');assert.equal(h.run('draft.material'),24);assert.equal(h.run('draft.rental'),0);assert.equal(h.run('draft.resourceCostsApplied'),true);
});

test('Bestätigte Material- und Maschinenkosten ändern Kosten und Preis ohne doppelte Verbrauchskosten',async()=>{
 const h=harness();h.seed();h.run("draft=structuredClone(state.jobs[0]);draft.lines=[{service:'lawn',qty:100,rate:1}];draft.material=0;draft.rental=0;view='planner';window.before=calculate(draft,state.settings);draft.resources=[{id:'m1',kind:'material',name:'Säcke',unit:'Stück',quantity:2,unitCost:5,use:true,costConfirmed:true},{id:'e1',kind:'machine',name:'Rasenmäher',unit:'Einsatz',quantity:1,unitCost:30,use:true,costConfirmed:true,mode:'rent'}]");
 assert.ok(h.run('window.before.consumables')>0);await h.action('resource-apply');assert.equal(h.run('draft.material'),10);assert.equal(h.run('draft.rental'),30);assert.equal(h.run('calculate(draft,state.settings).consumables'),0);
 assert.equal(h.run('calculate(draft,state.settings).net-window.before.net'),40);assert.equal(h.run('calculate(draft,state.settings).costs-window.before.costs'),h.run('40-window.before.consumables'));
 const once=h.run('calculate(draft,state.settings).costs');await h.action('resource-apply');assert.equal(h.run('calculate(draft,state.settings).costs'),once);
 h.run("updateResourceField({dataset:{resourceIndex:'0',resourceField:'unitCost'},value:'6'})");assert.equal(h.run('draft.resourceCostsApplied'),false);await h.action('resource-apply');assert.equal(h.run('draft.material'),12);assert.equal(h.run('calculate(draft,state.settings).consumables'),0);
});

test('Der Kundendruck benennt bestätigte Ressourcen sicher und ohne interne Beschaffungsnotizen',()=>{
 const h=harness();h.seed();h.run("draft=structuredClone(state.jobs[0]);draft.resources=[{id:'m1',kind:'material',name:'Farbe <script>bad()</script>',unit:'Liter',quantity:2,unitCost:5,use:true,costConfirmed:true,note:'INTERNE EINKAUFSNOTIZ'},{id:'e1',kind:'machine',name:'Rollgerüst',unit:'Einsatz',quantity:1,unitCost:30,use:true,costConfirmed:true,mode:'rent'}];draft=applyResourceCosts(draft)");
 const pdf=h.run('documentHTML(draft)');assert.match(pdf,/Vereinbartes Material/);assert.match(pdf,/Rollgerüst/);assert.match(pdf,/&lt;script&gt;bad/);assert.doesNotMatch(pdf,/<script>bad|INTERNE EINKAUFSNOTIZ/);
});

test('Backup erhält Ressourcen, eigene Zeiteinheiten, Fotoangaben und den eingefrorenen Angebotsstand',()=>{
 const h=harness();h.seed();h.run("state.jobs[0].lines=[{service:'customwork',qty:2,rate:50,description:'Mess- & Montagearbeit',unit:'Pauschal',minutes:75}];state.jobs[0].resources=[{id:'m1',kind:'material',name:'Montagekit',unit:'Stück',quantity:2,unitCost:7,use:true,costConfirmed:true,note:''}];state.jobs[0]=applyResourceCosts(state.jobs[0]);state.jobs[0].photos=[{name:'Detail.jpg',data:'data:image/jpeg;base64,AAAA',caption:'Bestand & Maße',stage:'detail'}];state.quotes=[createQuote(state,'job')];state.settings.nextQuoteNumber=2;window.restored=validateRestore(JSON.parse(JSON.stringify(state)))");
 assert.deepEqual(plain(h.run('window.restored.jobs[0].resources')),plain(h.run('state.jobs[0].resources')));
 assert.equal(h.run('window.restored.jobs[0].resourceCostsApplied'),true);assert.equal(h.run('window.restored.quotes[0].job.lines[0].minutes'),75);assert.equal(h.run('window.restored.quotes[0].job.photos[0].caption'),'Bestand & Maße');assert.equal(h.run('window.restored.quotes[0].calc.net'),129);
 assert.throws(()=>h.run('state.jobs[0].material=999;validateRestore(state)'),/Material|Maschinen|Kosten|resources/);
});

test('Ungültige Planerwerte werden vor Änderung des gespeicherten Auftrags abgewiesen',async()=>{
 const h=harness();h.seed();h.run("draft=structuredClone(state.jobs[0]);draft.resources=[{id:'bad',kind:'material',name:'Farbe',unit:'Liter',quantity:2,unitCost:-4,costConfirmed:true,use:true}];view='calc';render()");
 const form=h.elements.get('#job-form');form.data=h.formDataForDraft();await form.onsubmit({target:form,preventDefault(){}});
 assert.equal(h.run('state.jobs[0].resources.length'),0);assert.equal(h.persisted.length,0);assert.notEqual(h.run('draft'),null);assert.match(h.elements.get('#toast').textContent,/unitCost|Kosten|Zahl|Bereich/);
});

test('Qualifikations- und Aufmaßprüfungen gelten für den eingefrorenen Elektro-Angebotsstand',async()=>{
 const h=harness();h.seed();h.run("state.jobs[0].lines=[{service:'electrical_socket',qty:2,rate:75}];state.jobs[0].siteDetails={}");
 assert.match(h.run('siteDetailsForm(state.jobs[0])'),/site-qualifiedWorkers/);assert.match(h.run('siteDetailsForm(state.jobs[0])'),/site-permissionsChecked/);
 await h.action('create-offer',{id:'job'});const id=h.run('state.quotes[0].id');await h.action('offer-print',{id});assert.match(h.printed.at(-1),/Angebotsentwurf|Vorläufiger Preisstand/);
 await h.action('offer-status',{id,status:'sent'});await h.action('offer-status',{id,status:'accepted'});assert.equal(h.run('state.quotes[0].status'),'sent');assert.match(h.elements.get('#toast').textContent,/Qualifikation|Freigabe|fehlen/);
 h.run("state.jobs[0].siteDetails={siteInspected:true,qualifiedWorkers:true,permissionsChecked:true,safetyPlanConfirmed:true}");await h.action('offer-status',{id,status:'accepted'});assert.equal(h.run('state.quotes[0].status'),'sent');
 await h.action('offer-status',{id,status:'withdrawn'});await h.action('create-offer',{id:'job'});const revised=h.run('state.quotes[1].id');await h.action('offer-status',{id:revised,status:'sent'});await h.action('offer-status',{id:revised,status:'accepted'});
 assert.equal(h.run('state.quotes[1].status'),'accepted');assert.equal(h.run('state.quotes[0].status'),'withdrawn');assert.equal(h.run('validateRestore(state).quotes.length'),2);
});

test('Fotofehler zeigen die konkrete technische Meldung sicher und bieten einen echten Wiederholungsversuch',async()=>{
 const h=harness();h.seed();h.initPhoto();const calls=h.mockVision({status:{stage:'error',busy:false,message:'Modelldownload unterbrochen',detail:'Fetch failed <script>alert(1)</script>'},recognize:async()=>({status:'uncertain',suggestions:[],alternatives:[]})});
 h.run('render()');const html=h.elements.get('#app').innerHTML;assert.match(html,/Modelldownload unterbrochen/);assert.match(html,/Technische Meldung/);assert.match(html,/Fetch failed &lt;script&gt;/);assert.doesNotMatch(html,/<script>alert/);assert.match(html,/data-action="photo-retry"/);
 await h.action('photo-retry');assert.equal(calls.retry,1);assert.equal(calls.recognize.length,1);assert.equal(calls.recognize[0].image.name,'Wand.jpg');
});

test('Ein schwacher Modellvergleich erzeugt weder eine Leistung noch eine erfundene Menge',async()=>{
 const h=harness();h.seed();h.initPhoto();h.context.candidate=h.run("services.find(s=>s.id==='paint_wall')");h.mockVision({recognize:async()=>({status:'uncertain',suggestions:[],alternatives:[{service:h.context.candidate,score:.18,categoryOnly:true}]})});
 await h.action('analyze-photo');assert.equal(h.run('draft'),null);assert.equal(h.run('photoSuggestions.length'),0);assert.equal(h.run('photoServiceChoice'),'');assert.equal(h.run('photoQuantity'),'');
 assert.match(h.elements.get('#app').innerHTML,/nicht eindeutig/);assert.match(h.elements.get('#app').innerHTML,/keine kalibrierte Wahrscheinlichkeit/);
});

test('Ein erkannter Handwerksbereich verlangt die konkrete Leistung statt automatisch eine Wandposition einzusetzen',async()=>{
 const h=harness();h.seed();h.initPhoto();await h.action('photo-trade',{id:'paint_wall'});const dialog=h.elements.get('#dialog').innerHTML;
 assert.match(dialog,/paint_wall/);assert.match(dialog,/paint_ceiling/);assert.match(dialog,/paint_door/);assert.equal(h.run('photoServiceChoice'),'');assert.equal(h.run('photoQuantity'),'');assert.equal(h.run('draft'),null);
 await h.action('photo-service',{id:'paint_ceiling'});assert.equal(h.run('photoServiceChoice'),'paint_ceiling');assert.equal(h.run('photoQuantity'),'');assert.equal(h.run('draft'),null);
});

test('Fotoleistungen benötigen eine bestätigte gültige Menge und ergänzen erst dann die Kalkulation',async()=>{
 const h=harness();h.seed();h.initPhoto();let form=h.elements.get('#photo-measure-form');
 for(const values of [{'photo-service':'','photo-qty':'30'},{'photo-service':'paint_wall','photo-qty':''},{'photo-service':'paint_wall','photo-qty':'-1'},{'photo-service':'paint_wall','photo-qty':'1000001'}]){form.data=values;await form.onsubmit({target:form,preventDefault(){}});assert.equal(h.run('draft'),null);}
 form.data={'photo-service':'paint_wall','photo-qty':'30','photo-height':'Zwei Beschichtungen bestätigt','photo-stage':'detail','photo-caption':'Nordwand < & Maße'};await form.onsubmit({target:form,preventDefault(){}});
 assert.equal(h.run('draft.lines.length'),1);assert.equal(h.run('draft.lines[0].qty'),30);assert.equal(h.run('draft.lines[0].service'),'paint_wall');assert.equal(h.run('draft.photos[0].stage'),'detail');assert.equal(h.run('draft.photos[0].caption'),'Nordwand < & Maße');
 for(const key of ['km','travelHours','travelPrice'])assert.equal(h.run('draft.'+key),0);assert.equal(h.persisted.length,0);
 const draftID=h.run('draft.id');h.run("view='photos';render()");form=h.elements.get('#photo-measure-form');form.data={'photo-service':'paint_ceiling','photo-qty':'12'};await form.onsubmit({target:form,preventDefault(){}});
 assert.equal(h.run('draft.id'),draftID);assert.equal(h.run('draft.lines.length'),2);assert.equal(h.run('draft.photos.length'),1);
});

test('Mehrfach-Fotoauswahl verwirft eine verspätete ältere Bildverarbeitung',async()=>{
 const h=harness();h.seed();h.initPhoto();const old=deferred(),next=deferred();h.context.decode=file=>file.name==='old.jpg'?old.promise:next.promise;h.run('readImage=file=>decode(file)');
 const input=h.elements.get('#photo-file');const first=input.onchange({target:{files:[{name:'old.jpg'}]}}),second=input.onchange({target:{files:[{name:'new.jpg'}]}});
 next.resolve(photoImage('new.jpg'));await second;old.resolve(photoImage('old.jpg'));await first;
 assert.equal(h.run('photo.name'),'new.jpg');assert.ok(!Array.from(h.run('photoCollection.map(p=>p.name)')).includes('old.jpg'));assert.equal(h.run('photoServiceChoice'),'');assert.equal(h.run('photoQuantity'),'');
});

test('Die Analyse eines früheren Fotos kann die Vorschläge für das aktuelle Foto nicht überschreiben',async()=>{
 const h=harness();h.seed();h.initPhoto();const delayed=deferred();const calls=h.mockVision({recognize:()=>delayed.promise});const analysis=h.run('analyzePhoto()');
 h.run("photoCollection.push({name:'Aktuell.jpg',data:'data:image/jpeg;base64,BBBB'})");await h.action('photo-select',{index:'1'});delayed.resolve({status:'ok',suggestions:[{service:h.run("services.find(s=>s.id==='lawn')"),score:.95}]});await analysis;
 assert.equal(h.run('photo.name'),'Aktuell.jpg');assert.equal(h.run('photoSuggestions.length'),0);assert.equal(h.run('photoRecognitionResult'),null);assert.ok(calls.cancel>0);
});

test('Vorher-/Nachhermetadaten bleiben beim Foto wechseln erhalten und Anhängen dupliziert keine Bilder',async()=>{
 const h=harness();h.seed();h.initPhoto();h.run("photoCollection.push({name:'Fertig.jpg',data:'data:image/jpeg;base64,BBBB',stage:'after',caption:'Fertige Decke'})");
 h.photoFields({'photo-stage':'detail','photo-caption':'Nordwand & Aufmaß'});await h.action('photo-select',{index:'1'});
 assert.equal(h.run('photoCollection[0].stage'),'detail');assert.equal(h.run('photoCollection[0].caption'),'Nordwand & Aufmaß');assert.equal(h.run('photoStage'),'after');assert.equal(h.run('photoCaption'),'Fertige Decke');
 h.photoFields({'photo-stage':'after','photo-caption':'Fertige Decke'});await h.action('photo-attach-all');assert.equal(h.run('draft.photos.length'),2);assert.equal(h.run('draft.lines.length'),0);
 for(const key of ['km','travelHours','travelPrice'])assert.equal(h.run('draft.'+key),0);await h.action('photo-attach-all');assert.equal(h.run('draft.photos.length'),2);
 assert.equal(h.run('draft.photos[0].caption'),'Nordwand & Aufmaß');assert.equal(h.run('draft.photos[1].stage'),'after');
});

test('Ein Foto ohne Aufmaß wird nur als Dokumentation ohne erfundene Leistung oder Anfahrt angehängt',async()=>{
 const h=harness();h.seed();h.initPhoto();h.photoFields({'photo-stage':'before','photo-caption':'Bestandsaufnahme'});await h.action('attach-photo');
 assert.equal(h.run('draft.lines.length'),0);assert.equal(h.run('draft.photos.length'),1);assert.equal(h.run('draft.photos[0].caption'),'Bestandsaufnahme');for(const key of ['km','travelHours','travelPrice'])assert.equal(h.run('draft.'+key),0);
});

test('Eine weitere Dateiauswahl erhält die noch nicht angehängte Beschreibung des bisherigen Fotos',async()=>{
 const h=harness();h.seed();h.initPhoto();h.photoFields({'photo-stage':'detail','photo-caption':'Aufmaß Nordwand'});
 h.context.decode=async()=>photoImage('new.jpg');h.run('readImage=file=>decode(file)');
 await h.elements.get('#photo-file').onchange({target:{files:[{name:'new.jpg'}]}});
 assert.equal(h.run('photoCollection[0].caption'),'Aufmaß Nordwand');assert.equal(h.run('photoCollection[0].stage'),'detail');assert.equal(h.run('photo.name'),'new.jpg');
});

test('Erneutes Anhängen aktualisiert Fotoangaben im Auftrag ohne das gleiche Bild zu duplizieren',async()=>{
 const h=harness();h.seed();h.initPhoto();h.photoFields({'photo-stage':'before','photo-caption':'Bestand'});await h.action('attach-photo');
 h.run("state.jobs[0].photos=structuredClone(draft.photos);window.quoteBeforePhotoEdit=createQuote(state,'job')");
 h.photoFields({'photo-stage':'detail','photo-caption':'Bestand mit gemessenen Maßen'});await h.action('attach-photo');
 assert.equal(h.run('draft.photos.length'),1);assert.equal(h.run('draft.photos[0].stage'),'detail');assert.equal(h.run('draft.photos[0].caption'),'Bestand mit gemessenen Maßen');
 h.photoFields({'photo-stage':'after','photo-caption':'Abnahme bestätigt'});await h.action('photo-attach-all');assert.equal(h.run('draft.photos.length'),1);assert.equal(h.run('draft.photos[0].stage'),'after');assert.equal(h.run('draft.photos[0].caption'),'Abnahme bestätigt');
 assert.equal(h.run('window.quoteBeforePhotoEdit.job.photos[0].stage'),'before');assert.equal(h.run('window.quoteBeforePhotoEdit.job.photos[0].caption'),'Bestand');
});
