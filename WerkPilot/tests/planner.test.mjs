import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculate,defaults,services,requiredEquipment} from '../dist/core.js';
import {suggestResources,refreshResourceSuggestions,resourceTotals,applyResourceCosts,planningSummary} from '../dist/planner.js';
import {validateBackup} from '../dist/backup.js';
import {assessSite} from '../dist/knowledge.js';
import {createQuote} from '../dist/quotes.js';

const job=()=>({id:'job',title:'Materialplanung',customer:'client',status:'Angebot',date:'2026-10-20',time:'09:00',duration:2,lines:[{service:'lawn',qty:100,rate:1}],factor:1,travelHours:0,setupHours:0,km:0,travelPrice:0,material:0,disposal:0,rental:0,notes:'',photos:[],checks:[],taxMode:'small',tax:0,siteDetails:{}});
const material=(extra={})=>({id:'material',kind:'material',name:'Produkt',unit:'Liter',quantity:2.5,unitCost:10,costConfirmed:true,use:true,note:'',...extra});
const machine=(extra={})=>({id:'machine',kind:'machine',name:'Mäher',equipmentId:'mower',unit:'Einsatz',quantity:1,unitCost:12,costConfirmed:true,use:true,mode:'rent',note:'',...extra});
const state=(j=job())=>({version:3,settings:{...defaults},customers:[{id:'client',name:'Kunde'}],jobs:[j],invoices:[],quotes:[],expenses:[],owned:[],timeEntries:[],activeTimer:null,demo:false});

test('Maschinenvorschläge unterscheiden Bestand und Miete ohne einen Kaufpreis zu übernehmen',()=>{
 const rows=suggestResources(job(),['mower']);const mower=rows.find(r=>r.equipmentId==='mower');assert.equal(mower.mode,'owned');assert.equal(mower.unitCost,0);assert.equal(mower.costConfirmed,false);assert.equal(rows.find(r=>r.equipmentId==='trimmer').mode,'rent');assert.equal(resourceTotals(rows).complete,false);
});
test('Materialvorschläge sind mengenabhängig und tragen prüfbare Verbrauchsannahmen',()=>{
 const j={...job(),lines:[{service:'paint_wall',qty:100,rate:12}]};const rows=suggestResources(j);assert.ok(rows.some(r=>r.kind==='material'&&r.quantity>0));assert.ok(rows.filter(r=>r.kind==='material').every(r=>r.note.length>10&&r.costConfirmed===false));assert.ok(rows.some(r=>r.kind==='machine'));
});
test('Geräte werden gewerkübergreifend nur einmal vorgeschlagen',()=>{
 const j={...job(),lines:[{service:'lawn',qty:100},{service:'hedge',qty:10}]};const rows=suggestResources(j);assert.equal(rows.filter(r=>r.equipmentId==='ppe').length,1);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
});
test('Gleiches Material mehrerer Leistungspositionen wird mengenmäßig zusammengeführt',()=>{
 const j={...job(),lines:[{service:'paint_wall',qty:100,rate:12},{service:'paint_wall',qty:50,rate:12}]};
 const single=suggestResources({...j,lines:[j.lines[0]]}).filter(r=>r.kind==='material');const doubled=suggestResources(j).filter(r=>r.kind==='material');assert.equal(single.length,doubled.length);for(const row of single){assert.ok(doubled.find(r=>r.name===row.name).quantity>row.quantity);}
});
test('Neuberechnen passt Mengen an, erhält Einkaufspreise und verlangt bei neuen Mengen Bestätigung',()=>{
 const suggestions=suggestResources(job()),initial=suggestions.map(row=>({...row,unitCost:5,costConfirmed:true}));const more=suggestResources({...job(),lines:[{service:'lawn',qty:200,rate:1}]});const updated=refreshResourceSuggestions([...initial,material({id:'manual',name:'Eigenes Zusatzprodukt',source:'manual'})],more);const bags=updated.find(r=>r.kind==='material'&&r.source==='suggestion');assert.equal(bags.unitCost,5);assert.equal(bags.costConfirmed,false);assert.equal(bags.quantity,2);assert.ok(updated.some(r=>r.name==='Eigenes Zusatzprodukt'));assert.equal(initial[0].quantity,1);
});
test('Eigene Positionen behalten eindeutige Kennungen beim erneuten Erstellen der Vorschläge',()=>{
 const original=suggestResources(job())[0];const renamed={...original,name:'Eigenes Spezialprodukt',source:'manual'};const rows=refreshResourceSuggestions([renamed],suggestResources(job()));assert.ok(rows.some(r=>r.name==='Eigenes Spezialprodukt'&&r.id===renamed.id));assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
});
test('Nicht ausgewählte und unbestätigte Preise gehören nicht zu bestätigten Kosten',()=>{
 const t=resourceTotals([material(),machine({costConfirmed:false}),material({id:'unused',quantity:99,unitCost:100,use:false})]);assert.equal(t.material,25);assert.equal(t.rental,0);assert.equal(t.complete,false);assert.deepEqual(t.missing,['Mäher']);
});
test('Null Euro verlangt eine ausdrückliche Bestätigung und ist danach zulässig',()=>{
 assert.equal(resourceTotals([machine({unitCost:0,costConfirmed:false})]).complete,false);assert.equal(resourceTotals([machine({unitCost:0,costConfirmed:true})]).complete,true);
});
test('Ungültige Mengen und Preise lassen sich nicht als bestätigte Kosten übernehmen',()=>{
 for(const row of [material({quantity:0}),material({quantity:-1}),material({unitCost:-1}),material({unitCost:NaN}),material({quantity:Infinity})])assert.throws(()=>applyResourceCosts({...job(),resources:[row]}),/bestätigen/);
 assert.throws(()=>applyResourceCosts({...job(),resources:[]}),/auswählen/);
});
test('Übernahme ersetzt Zusatzkosten auf einer Kopie und zählt Verbrauchsmaterial nicht doppelt',()=>{
 const original={...job(),material:99,rental:99,resources:[material(),machine()]};const j=applyResourceCosts(original),c=calculate(j,defaults),old=calculate(job(),defaults);assert.equal(original.material,99);assert.equal(j.material,25);assert.equal(j.rental,12);assert.equal(j.resourceCostsApplied,true);assert.equal(c.consumables,0);assert.equal(old.consumables,1.5);assert.equal(c.extraCost,37);assert.equal(c.net,137);assert.equal(c.costs,c.labor+c.overhead+37);
});
test('Einzelpositionen werden vor dem Addieren centgenau gerundet',()=>{
 const t=resourceTotals([material({id:'a',quantity:1,unitCost:.105}),material({id:'b',quantity:1,unitCost:.105})]);assert.equal(t.material,.22);
});
test('Eigene Minuten pro Einheit verändern die Kostenbasis ohne den Verkaufspreis umzuschreiben',()=>{
 const j={...job(),lines:[{service:'customwork',qty:10,rate:20,description:'Montage',unit:'Stück',minutes:12}]};const c=calculate(j,defaults);assert.equal(c.hours,2);assert.equal(c.serviceNet,200);assert.equal(c.labor,48);assert.equal(planningSummary(j,defaults).recommendedDuration,2);
});
test('Planungsfortschritt beruht auf tatsächlichen Kunden-, Termin- und Kostenangaben',()=>{
 const j=applyResourceCosts({...job(),resources:[material(),machine()]});const summary=planningSummary(j,defaults);assert.equal(summary.checks.find(c=>c.id==='resources').done,true);assert.equal(summary.checks.find(c=>c.id==='client').done,true);assert.ok(summary.personHours>0);assert.ok(summary.machines.every(Boolean));assert.equal(summary.serviceCount,1);
});
test('Materialplan und eigene Leistungsbeschreibung überstehen Sicherung und eingefrorenes Angebot',()=>{
 const j=applyResourceCosts({...job(),lines:[{service:'customwork',qty:4,rate:55,description:'Eigene Montage',unit:'Stück',minutes:30}],resources:[material(),machine()],photos:[{name:'Foto',data:'data:image/jpeg;base64,AAAA',stage:'after',caption:'Abnahme'}]});const s=state(j);const q=createQuote(s,j.id,{date:'2026-10-08',validUntil:'2026-11-08'});s.quotes.push(q);s.settings.nextQuoteNumber=2;const restored=validateBackup(s);assert.deepEqual(restored.jobs[0].resources,j.resources);assert.equal(restored.jobs[0].lines[0].description,'Eigene Montage');assert.equal(restored.jobs[0].lines[0].unit,'Stück');assert.equal(restored.jobs[0].lines[0].minutes,30);assert.equal(restored.jobs[0].photos[0].caption,'Abnahme');assert.equal(restored.quotes[0].job.resources[0].unitCost,10);
});
test('Manipulierte übernommene Ressourcenpreise oder unbelegte Bestätigung werden beim Import abgewiesen',()=>{
 const j=applyResourceCosts({...job(),resources:[material(),machine()]});for(const mutate of [s=>{s.jobs[0].resources[0].unitCost=500},s=>{s.jobs[0].resources[0].costConfirmed=false},s=>{s.jobs[0].resources[0].quantity=-1},s=>{s.jobs[0].resources[0].id=s.jobs[0].resources[1].id},s=>{s.jobs[0].resources[1].equipmentId='unknown'}]){const s=state(j);mutate(s);assert.throws(()=>validateBackup(s));}
});
test('Qualifikationspflichtige Gewerke benötigen dokumentierte Freigaben im Angebotsablauf',()=>{
 const service=services.find(s=>s.category==='electrical'),j={...job(),lines:[{service:service.id,qty:1,rate:100}]};assert.equal(assessSite(j,{}).readyForBindingQuote,false);assert.equal(assessSite(j,{siteInspected:true,qualifiedWorkers:true,safetyPlanConfirmed:true,permissionsChecked:true}).readyForBindingQuote,true);
});
test('Ein ausgewählter, unbestätigter Materialplan bleibt vor verbindlicher Freigabe offen',()=>{
 const j={...job(),resources:[material({costConfirmed:false})]};assert.equal(assessSite(j,{}).readyForBindingQuote,false);assert.equal(assessSite(applyResourceCosts({...j,resources:[material()]}),{}).readyForBindingQuote,true);
});
