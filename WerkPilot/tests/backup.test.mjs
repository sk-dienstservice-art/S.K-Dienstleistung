import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, calculate, invoiceBalance } from '../dist/core.js';
import { validateBackup } from '../dist/backup.js';

function fixture() {
  const settings={...defaults,company:'Grün & Klar',owner:'Max Muster',taxMode:'small',tax:0,watchYear:2026};
  const customer={id:'kunde-1',name:'Familie Müller',address:'Parkstraße 14',email:'kunde@example.com',phone:'123',type:'Privatkunde',notes:'Zugang abstimmen'};
  const job={id:'auftrag-1',title:'Gartenpflege',customer:customer.id,status:'Erledigt',date:'2026-01-05',time:'09:00',duration:2,lines:[{service:'lawn',qty:100,rate:1}],factor:1,travelHours:0,setupHours:0,km:0,travelPrice:0,material:0,disposal:0,rental:0,tax:0,taxMode:'small',notes:'',photos:[{name:'garten.jpg',data:'data:image/jpeg;base64,/9j/AA=='}],checks:['Fläche auf Fremdkörper prüfen'],costSettings:{hourlyCost:20,overhead:5,kmCost:.5,targetMargin:25,taxMode:'small',tax:0},actualTimeComplete:true,actualCostsComplete:true};
  const invoice={id:'rechnung-1',jobId:job.id,number:'RE-2026-0001',issued:'2026-01-06',due:'2026-01-20',paid:'',payments:[{id:'zahlung-1',date:'2026-01-07',amount:30,method:'Überweisung',note:''}],job:structuredClone(job),company:structuredClone(settings),customer:structuredClone(customer),calc:calculate(job,settings)};
  return {version:2,settings,customers:[customer],jobs:[job],invoices:[invoice],expenses:[{id:'ausgabe-1',description:'Material',date:'2026-01-05',category:'Material',gross:11.9,tax:19,taxMode:'small',jobId:job.id,reference:'BELEG-1',receipt:null}],owned:['mower','ppe'],timeEntries:[{id:'zeit-1',jobId:job.id,date:'2026-01-05',kind:'Arbeit',minutes:90,note:'Mähen',source:'Manuell'}],activeTimer:null,demo:false};
}
const cloneFixture=mutate=>{const value=fixture();mutate(value);return value;};

test('Vollständige Sicherung erhält eingefrorene Rechnung, Kosten und Centzahlungen ohne Mutation',()=>{
  const original=fixture(),before=structuredClone(original),restored=validateBackup(original);
  assert.deepEqual(original,before);assert.notEqual(restored,original);assert.notEqual(restored.invoices[0].job,original.invoices[0].job);
  assert.deepEqual(restored.invoices[0].calc,original.invoices[0].calc);assert.deepEqual(invoiceBalance(restored.invoices[0]),{paid:30,open:70,settled:false,partial:true});
  restored.jobs[0].lines[0].qty=200;assert.equal(original.jobs[0].lines[0].qty,100);assert.equal(restored.jobs[0].costSettings.hourlyCost,20);
});
test('Version 1 ohne neue optionale Felder übernimmt Vollzahlung genau einmal',()=>{
  const original=fixture();original.version=1;delete original.timeEntries;delete original.activeTimer;delete original.settings.taxMode;
  for(const job of [original.jobs[0],original.invoices[0].job]){delete job.taxMode;delete job.costSettings;delete job.photos;delete job.checks;delete job.actualTimeComplete;delete job.actualCostsComplete;}
  delete original.invoices[0].payments;original.invoices[0].paid='2026-01-07';delete original.invoices[0].company.taxMode;
  const first=validateBackup(original),second=validateBackup(first);assert.equal(first.version,3);assert.equal(first.settings.taxMode,'exempt');assert.equal(first.invoices[0].payments.length,1);assert.equal(first.invoices[0].payments[0].amount,100);assert.equal(second.invoices[0].payments.length,1);assert.equal(original.version,1);
});
test('Leere Betriebe mit Version 1 und 2 sowie minimalen Legacy-Einstellungen sind importierbar',()=>{
  for(const version of [1,2]){const restored=validateBackup({version,settings:{company:'Mein Betrieb',tax:0},customers:[],jobs:[],invoices:[],expenses:[],owned:[]});assert.equal(restored.jobs.length,0);assert.equal(restored.timeEntries.length,0);assert.equal(restored.settings.hourlyCost,defaults.hourlyCost);}
});
test('Gemeinsam referenzierte Objekte eines direkten Aufrufs werden sicher kopiert',()=>{
  const original=fixture();original.invoices[0].company=original.settings;original.invoices[0].job=original.jobs[0];assert.doesNotThrow(()=>validateBackup(original));
});
test('Unbekannte Felder werden entfernt; bekannte Hinweise mit Sonderzeichen bleiben erhalten',()=>{
  const original=fixture();original.settings.untrustedHTML='<script>alert(1)</script>';original.jobs[0].unknown={trusted:true};original.settings.lastBackupExportAt='2026-01-08T09:10:11.000Z';original.customers[0].notes='Bitte <Tor> schließen & Schlüssel zurückgeben.';
  const restored=validateBackup(original);assert.equal(restored.settings.untrustedHTML,undefined);assert.equal(restored.jobs[0].unknown,undefined);assert.equal(restored.settings.lastBackupExportAt,original.settings.lastBackupExportAt);assert.equal(restored.customers[0].notes,original.customers[0].notes);
});
test('Ungültiger Backup-Zeitpunkt wird erkannt',()=>{assert.throws(()=>validateBackup(cloneFixture(s=>s.settings.lastBackupExportAt='2026-02-30T09:00:00Z')),/Sicherungszeitpunkt/);});
test('Kennungen mit HTML-Attributen werden in sämtlichen Sammlungen verworfen',()=>{
  for(const change of [s=>s.customers[0].id='x" onclick="alert(1)',s=>s.jobs[0].id='x"',s=>s.invoices[0].id='x"',s=>s.invoices[0].payments[0].id='x"',s=>s.expenses[0].id='x"',s=>s.timeEntries[0].id='x"'])assert.throws(()=>validateBackup(cloneFixture(change)),/Kennung/);
});
test('Doppelte IDs sowie doppelte Rechnungsnummern werden abgewiesen',()=>{
  for(const collection of ['customers','jobs','invoices','expenses','timeEntries'])assert.throws(()=>validateBackup(cloneFixture(s=>s[collection].push(structuredClone(s[collection][0])))),/doppelte/);
  assert.throws(()=>validateBackup(cloneFixture(s=>{const invoice=structuredClone(s.invoices[0]);invoice.id='rechnung-2';invoice.payments=[];s.invoices.push(invoice);})),/Rechnungsnummern/);
  assert.throws(()=>validateBackup(cloneFixture(s=>s.invoices[0].payments.push(structuredClone(s.invoices[0].payments[0])))),/doppelte/);
});
test('Leere IDs, zu lange IDs und unsichere Referenzen werden erkannt',()=>{
  for(const id of ['', '-abc', 'a'.repeat(101), 'a:b'])assert.throws(()=>validateBackup(cloneFixture(s=>s.jobs[0].id=id)),/Kennung/);
  assert.throws(()=>validateBackup(cloneFixture(s=>s.jobs[0].customer='kunde" onclick="evil')),/Kennung/);
});
test('Fehlende Kunden, Aufträge und ursprüngliche Folgeaufträge werden erkannt',()=>{
  for(const change of [s=>s.jobs[0].customer='fehlt',s=>s.jobs[0].parentJob='fehlt',s=>s.invoices[0].jobId='fehlt',s=>s.expenses[0].jobId='fehlt',s=>s.timeEntries[0].jobId='fehlt'])assert.throws(()=>validateBackup(cloneFixture(change)),/fehlt|passt nicht/);
});
test('Lückenhafte Rechnungs-Snapshots werden vor der Wiederherstellung abgefangen',()=>{
  for(const change of [s=>delete s.invoices[0].issued,s=>delete s.invoices[0].due,s=>delete s.invoices[0].number,s=>delete s.invoices[0].customer,s=>delete s.invoices[0].customer.name,s=>delete s.invoices[0].company,s=>delete s.invoices[0].company.company,s=>delete s.invoices[0].job,s=>delete s.invoices[0].job.lines,s=>delete s.invoices[0].calc.net,s=>s.invoices[0].job.lines=[]])assert.throws(()=>validateBackup(cloneFixture(change)),/Sicherung:/);
});
test('Februar, Monatslängen, Schaltjahre und Uhrzeiten werden tief geprüft',()=>{
  for(const change of [s=>s.jobs[0].date='2026-02-30',s=>s.jobs[0].date='2025-02-29',s=>s.invoices[0].issued='2026-13-01',s=>s.invoices[0].due='2026-04-31',s=>s.expenses[0].date='2026-01-00',s=>s.timeEntries[0].date='2026-02-30',s=>s.invoices[0].payments[0].date='2026-02-30'])assert.throws(()=>validateBackup(cloneFixture(change)),/Kalenderdatum/);
  assert.doesNotThrow(()=>validateBackup(cloneFixture(s=>s.jobs[0].date='2024-02-29')));
  for(const time of ['24:00','09:75','9:00','00:00:00'])assert.throws(()=>validateBackup(cloneFixture(s=>s.jobs[0].time=time)),/Uhrzeit|Text/);
});
test('Nichtfinite und nichtnumerische Mengen, Sätze und Einstellungen ändern die Quelle nicht',()=>{
  for(const bad of [NaN,Infinity,-Infinity,'10',null]){const original=fixture();original.jobs[0].lines[0].qty=bad;assert.throws(()=>validateBackup(original),/gültige Zahl/);assert.equal(original.jobs[0].lines[0].qty,bad);}
  for(const change of [s=>s.settings.hourlyCost=-1,s=>s.settings.tax=101,s=>s.settings.targetMargin=91,s=>s.settings.reservePercent=101,s=>s.settings.taxMode='whatever',s=>s.jobs[0].costSettings.overhead=NaN,s=>s.jobs[0].tax=101,s=>s.expenses[0].tax=101])assert.throws(()=>validateBackup(cloneFixture(change)),/Sicherung:/);
});
test('Bruttobetrag, Centpräzision und Zahlungen werden zusammen geprüft',()=>{
  for(const change of [s=>s.invoices[0].calc.gross=101,s=>s.invoices[0].calc.net=-1,s=>s.invoices[0].calc.gross=100.001,s=>s.invoices[0].payments[0].amount=100.01,s=>s.invoices[0].payments[0].amount=0,s=>s.invoices[0].payments[0].amount=.001])assert.throws(()=>validateBackup(cloneFixture(change)),/Sicherung:/);
  const original=fixture();original.invoices[0].payments.push({id:'zahlung-2',date:'2026-01-08',amount:70});const restored=validateBackup(original);assert.equal(restored.invoices[0].paid,'2026-01-08');assert.equal(invoiceBalance(restored.invoices[0]).open,0);
});
test('Veraltetes paid-Flag folgt Zahlungsprotokoll und verändert keine Beträge',()=>{
  const original=fixture();original.invoices[0].paid='2026-01-10';const restored=validateBackup(original);assert.equal(restored.invoices[0].paid,'');assert.equal(restored.invoices[0].payments[0].amount,30);assert.equal(original.invoices[0].paid,'2026-01-10');
});
test('Alte Steuerbefreiung mit 19-Prozent-Annahme wird bei steuerfreiem Rechnungsbetrag bereinigt',()=>{
  const original=fixture();original.settings.taxMode='exempt';original.settings.tax=19;original.jobs[0].taxMode='exempt';original.jobs[0].tax=19;original.jobs[0].costSettings.taxMode='exempt';original.jobs[0].costSettings.tax=19;original.invoices[0].job.taxMode='exempt';original.invoices[0].job.tax=19;original.invoices[0].company.taxMode='exempt';original.invoices[0].company.tax=19;
  const restored=validateBackup(original);assert.equal(restored.settings.tax,0);assert.equal(restored.jobs[0].tax,0);assert.equal(restored.jobs[0].costSettings.tax,0);assert.equal(restored.invoices[0].calc.tax,0);assert.equal(restored.invoices[0].calc.gross,100);assert.equal(restored.invoices[0].job.tax,0);assert.equal(original.invoices[0].job.tax,19);
});
test('Rechnung mit gespeicherter Umsatzsteuer trotz Steuerbefreiung erfordert Prüfung statt Summenänderung',()=>{
  const original=fixture();original.invoices[0].job.taxMode='exempt';original.invoices[0].job.tax=19;original.invoices[0].calc.tax=19;original.invoices[0].calc.gross=119;
  assert.throws(()=>validateBackup(original),/Umsatzsteuer trotz Steuerbefreiung/);assert.equal(original.invoices[0].calc.gross,119);
});
test('Bilder lassen keine zusätzlichen Attribute, SVG, defekte Base64-Daten oder falsche Datentypen zu',()=>{
  for(const data of ['data:image/jpeg;base64,/9j/AA==" onerror="alert(1)','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,%%%','https://example.com/photo.jpg','data:image/jpeg;base64,','data:image/jpeg;base64,/9j/AA='])assert.throws(()=>validateBackup(cloneFixture(s=>s.jobs[0].photos[0].data=data)),/Bilder|codierte|Text/);
  assert.throws(()=>validateBackup(cloneFixture(s=>s.expenses[0].receipt={name:'x',data:'data:image/png;base64,AAAA"'})),/codierte/);
});
test('Checklisten und Gerätebestand erlauben nur gültige, eindeutige Einträge',()=>{
  for(const change of [s=>s.jobs[0].checks=[{}],s=>s.jobs[0].checks=['x','x'],s=>s.owned=['mower','mower'],s=>s.owned=['unknown'],s=>s.jobs[0].lines[0].service='unknown'])assert.throws(()=>validateBackup(cloneFixture(change)),/Sicherung:/);
});
test('Zukünftige Zahlungen, Ausgaben und Zeitprotokolle sind ungültig',()=>{
  for(const change of [s=>s.invoices[0].payments[0].date='2999-01-01',s=>s.expenses[0].date='2999-01-01',s=>s.timeEntries[0].date='2999-01-01'])assert.throws(()=>validateBackup(cloneFixture(change)),/Zukunft/);
});
test('Aktive Stoppuhren verweisen auf echte Aufträge und gültige Startzeiten',()=>{
  const original=fixture();original.activeTimer={jobId:'auftrag-1',kind:'Fahrt',started:Date.now()-1000};assert.equal(validateBackup(original).activeTimer.kind,'Fahrt');
  for(const timer of [{jobId:'fehlt',kind:'Arbeit',started:1},{jobId:'auftrag-1',kind:'unknown',started:1},{jobId:'auftrag-1',kind:'Arbeit',started:Infinity},{jobId:'auftrag-1',kind:'Arbeit',started:Date.now()+120000}])assert.throws(()=>validateBackup(cloneFixture(s=>s.activeTimer=timer)),/Sicherung:/);
});
test('Unbekannte Versionen, fehlende Listen und übergroße Sammlungen werden erkannt',()=>{
  assert.throws(()=>validateBackup({...fixture(),version:4}),/Version/);
  assert.throws(()=>validateBackup(cloneFixture(s=>delete s.expenses)),/Liste/);
  assert.throws(()=>validateBackup(cloneFixture(s=>s.jobs=new Array(20001).fill({}))),/zu viele/);
  assert.throws(()=>validateBackup(cloneFixture(s=>s.jobs[0].photos=new Array(101).fill({}))),/zu viele/);
});
test('Sparse Arrays und unerwartete Objektarten werden abgewiesen',()=>{
  assert.throws(()=>validateBackup(cloneFixture(s=>s.customers=new Array(1))),/fehlende Einträge/);
  assert.throws(()=>validateBackup(cloneFixture(s=>s.settings=new Date())),/Datensatz/);
});
test('Prototype-Pollution-Payloads werden in allen Tiefen abgefangen',()=>{
  for(const field of ['__proto__','prototype','constructor']){const original=fixture();Object.defineProperty(original.settings,field,{enumerable:true,value:{polluted:true}});assert.throws(()=>validateBackup(original),/unsichere Eigenschaft/);assert.equal({}.polluted,undefined);}
  const original=fixture();Object.defineProperty(original.jobs[0].lines[0],'__proto__',{enumerable:true,value:{polluted:true}});assert.throws(()=>validateBackup(original),/unsichere/);
});
test('Accessor-Felder und zyklische Strukturen werden abgefangen, ohne sie aufzurufen',()=>{
  const original=fixture();let accessed=false;Object.defineProperty(original.settings,'hourlyCost',{enumerable:true,get(){accessed=true;return 10;}});assert.throws(()=>validateBackup(original),/berechnete Eigenschaften/);assert.equal(accessed,false);
  const cyclic=fixture();cyclic.settings.loop=cyclic;assert.throws(()=>validateBackup(cyclic),/zirkuläre/);
});
test('Geerbte Kosten und Kennungen werden nicht als Sicherungsdaten vertraut',()=>{
  const original=fixture();original.settings=Object.assign(Object.create({hourlyCost:0}),{company:'Test',tax:0});assert.throws(()=>validateBackup(original),/geerbte Felder/);
});
