import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults, calculate, conflicts, validISODate, recordPayment, invoiceBalance, actualResult, expenseCost, financials} from '../dist/core.js';

const job=(overrides={})=>({id:'a',date:'2026-10-10',time:'09:00',duration:2,status:'Geplant',lines:[{service:'lawn',qty:100,rate:1}],factor:1,travelHours:0,setupHours:0,km:0,travelPrice:0,material:0,disposal:0,rental:0,tax:0,taxMode:'small',...overrides});
const state=(overrides={})=>({settings:{...defaults},jobs:[],invoices:[],expenses:[],timeEntries:[],...overrides});
const invoice=()=>({id:'invoice',calc:{net:100,tax:0,gross:100},payments:[],paid:''});

// These cover bugs exposed by a review of real operational boundaries, rather
// than just repeating the same arithmetic as the implementation.
test('Einsatz über Mitternacht reserviert auch den nächsten Tag',()=>{
  const evening=job({date:'2026-10-10',time:'22:00',duration:4});
  const nextDay=job({id:'b',date:'2026-10-11',time:'01:00',duration:1});
  assert.deepEqual(conflicts(evening,[nextDay]).map(j=>j.id),['b']);
  assert.deepEqual(conflicts(nextDay,[evening]).map(j=>j.id),['a']);
});
test('Mehrtägiger Einsatz kollidiert auch zwei Kalendertage später',()=>{
  const long=job({time:'09:00',duration:72});
  const during=job({id:'b',date:'2026-10-12',time:'08:00'});
  assert.deepEqual(conflicts(long,[during]).map(j=>j.id),['b']);
});
test('Angrenzende Termine über Tagesgrenzen bleiben ohne Konflikt',()=>{
  const evening=job({time:'22:00',duration:2});
  const midnight=job({id:'b',date:'2026-10-11',time:'00:00'});
  assert.equal(conflicts(evening,[midnight]).length,0);
});
test('Stornierte und erledigte Termine bleiben auch über Mitternacht frei',()=>{
  const evening=job({time:'22:00',duration:4});
  assert.equal(conflicts(evening,[job({id:'b',date:'2026-10-11',time:'01:00',status:'Storniert'}),job({id:'c',date:'2026-10-11',time:'01:00',status:'Erledigt'})]).length,0);
});
test('Echte ISO-Daten prüfen Monatslängen und gregorianische Schaltjahre',()=>{
  for(const value of ['2024-02-29','2000-02-29','2026-04-30','2026-12-31'])assert.equal(validISODate(value),true,value);
  for(const value of ['2026-02-29','1900-02-29','2026-04-31','2026-00-10','2026-13-01','2026-01-00','0000-01-01','2026-1-1',null])assert.equal(validISODate(value),false,String(value));
});
test('Ungültige Datums- und Zeitwerte reservieren keinen Scheinzeitraum',()=>{
  const planned=job();
  for(const invalid of [job({date:'2026-02-30'}),job({time:'24:00'}),job({time:'12:60'}),job({duration:-1})])assert.deepEqual(conflicts(invalid,[planned]),[]);
});
test('Gedruckte Positionsbeträge stimmen centgenau mit der Angebotssumme überein',()=>{
  const c=calculate(job({lines:[{service:'lawn',qty:1.5,rate:.01},{service:'hedge',qty:1.5,rate:.01},{service:'weeds',qty:1.5,rate:.01}]}));
  assert.equal(c.serviceNet,.06);
  assert.equal(c.net,.06);
  assert.equal(c.gross,.06);
});
test('Steuerbefreite Aufträge weisen auch bei widersprüchlichem Standard keine Umsatzsteuer aus',()=>{
  const c=calculate(job({taxMode:'exempt',tax:19}),{...defaults,taxMode:'standard',tax:19});
  assert.equal(c.tax,0);
  assert.equal(c.gross,c.net);
});
test('Gespeicherte Auftragspreise und Kostenannahmen ändern sich nicht durch neue Betriebseinstellungen',()=>{
  const historical=job({km:10,costSettings:{hourlyCost:20,overhead:5,kmCost:.2,targetMargin:30}});
  const old=calculate(historical,{...defaults,hourlyCost:20,overhead:5,kmCost:.2,targetMargin:30});
  const later=calculate(historical,{...defaults,hourlyCost:80,overhead:30,kmCost:2,targetMargin:70});
  for(const key of ['net','gross','labor','overhead','travelCost','costs','profit','suggested'])assert.equal(later[key],old[key],key);
});
test('Neuer Auftrag ohne Kostenstand verwendet aktuelle Betriebseinstellungen',()=>{
  const fresh=job({km:10}),before=calculate(fresh),after=calculate(fresh,{...defaults,hourlyCost:80,overhead:30,kmCost:2});
  assert.ok(after.costs>before.costs);
  assert.equal(after.travelCost,20);
});
test('Bestätigte vollständige Zeit von null verwendet keine Planstunden',()=>{
  const emptyActual=job({actualTimeComplete:true,actualCostsComplete:true});
  const actual=actualResult(state({jobs:[emptyActual]}),emptyActual);
  assert.equal(actual.complete,true);
  assert.equal(actual.hasTime,true);
  assert.equal(actual.hours,0);
  assert.equal(actual.costs,0);
  assert.equal(actual.profit,100);
});
test('Unvollständige leere Zeit bleibt dagegen als Planannahme erkennbar',()=>{
  const pending=job({actualCostsComplete:true}),actual=actualResult(state({jobs:[pending]}),pending);
  assert.equal(actual.hasTime,false);
  assert.equal(actual.complete,false);
  assert.ok(actual.hours>0);
});
test('Unmögliche Zahlungstage werden ohne Mutation abgelehnt',()=>{
  const i=invoice();
  for(const date of ['2020-02-30','2020-00-10','2020-04-31','2019-02-29'])assert.throws(()=>recordPayment(i,{date,amount:10}),/gültiges Zahlungsdatum/);
  assert.equal(i.payments.length,0);
  assert.equal(invoiceBalance(i).open,100);
});
test('Gültiger Schalttag kann als historischer Zahlungseingang erfasst werden',()=>{
  const i=invoice();
  recordPayment(i,{id:'p',date:'2020-02-29',amount:10});
  assert.equal(invoiceBalance(i).open,90);
});
test('Nachkalkulation verwendet eingefrorenen Rechnungsumsatz trotz später geänderter Auftragspreise',()=>{
  const edited=job({lines:[{service:'lawn',qty:100,rate:2}],actualTimeComplete:true,actualCostsComplete:true,costSettings:{hourlyCost:20,overhead:5,kmCost:.2,targetMargin:25}});
  const actual=actualResult(state({jobs:[edited],timeEntries:[{jobId:edited.id,minutes:120}],invoices:[{jobId:edited.id,calc:{net:100,tax:0,gross:100}}]}),edited);
  assert.equal(actual.plan.net,200);
  assert.equal(actual.revenue,100);
  assert.equal(actual.invoiced,true);
  assert.equal(actual.costs,50);
  assert.equal(actual.profit,50);
  assert.equal(actual.margin,50);
});
test('Ohne passende Rechnung bleibt der aktuelle Angebotswert Grundlage der Nachkalkulation',()=>{
  const pending=job({actualTimeComplete:true,actualCostsComplete:true});
  const actual=actualResult(state({invoices:[{jobId:'unrelated',calc:{net:999}}]}),pending);
  assert.equal(actual.revenue,100);
  assert.equal(actual.invoiced,false);
  assert.equal(actual.profit,100);
});

test('Andere Steuerbefreiung zieht Lieferanten-Umsatzsteuer nicht automatisch als Vorsteuer ab',()=>{
  const expense={date:'2026-10-01',gross:119,tax:19,taxMode:'exempt'};
  assert.equal(expenseCost(expense,{...defaults,taxMode:'standard'}),119);
  const f=financials(state({settings:{...defaults,taxMode:'exempt'},expenses:[expense]}),'2026-10');
  assert.equal(f.deductibleExpenses,119);
  assert.equal(f.result,-119);
});
test('Nur ausdrücklich gespeicherte Regelbesteuerung verwendet vereinfachte Nettokosten',()=>{
  assert.equal(expenseCost({gross:119,tax:19,taxMode:'standard'},{...defaults,taxMode:'exempt'}),100);
  assert.equal(expenseCost({gross:119,tax:19},{...defaults,taxMode:'exempt'}),119);
});
test('Auch separat gedruckte Zusatzpositionen stimmen centgenau mit der Gesamtsumme überein',()=>{
  const c=calculate(job({lines:[],travelPrice:.005,material:.005,disposal:.005,rental:.005}));
  assert.equal(c.extraCost,.03);
  assert.equal(c.extras,.04);
  assert.equal(c.net,.04);
});
test('Normale Zusatzkosten mit zwei Nachkommastellen bleiben unverändert',()=>{
  const c=calculate(job({lines:[],travelPrice:12.34,material:1.11,disposal:2.22,rental:3.33}));
  assert.equal(c.extraCost,6.66);
  assert.equal(c.extras,19);
  assert.equal(c.net,19);
});
