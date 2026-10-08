import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAssistantRequest,briefSpokenReply} from '../dist/speech.js';

test('Ein Terminhinweis verdrängt keine ausdrücklich angeforderte Kalkulation',()=>{
 for(const phrase of ['Kalkuliere den Rasen für 100 Quadratmeter am nächsten Mittwoch','Was kostet hundert Quadratmeter Rasen für den nächsten Termin?']){
  const parsed=parseAssistantRequest(phrase);
  assert.equal(parsed.intent,'calculation');
  assert.deepEqual(parsed.lines,[{service:'lawn',qty:100,unit:'m²'}]);
 }
 assert.equal(parseAssistantRequest('Welche nächsten Termine habe ich für die Hecke?').intent,'appointments');
});

test('Wohnung ist bei spezieller Reinigung ein Ort und kein zweiter Auftrag',()=>{
 for(const [phrase,id,qty] of [['Grundreinigung der Wohnung 100 qm','deep',100],['Fensterreinigung in meiner Wohnung 30 qm','window',30],['Haushaltsreinigung meiner Wohnung 50 qm','home',50]]){
  const parsed=parseAssistantRequest(phrase);
  assert.equal(parsed.intent,'calculation');
  assert.deepEqual(parsed.lines,[{service:id,qty,unit:'m²'}]);
 }
});

test('Explizit getrennte Wohnung und Fenster bleiben zwei Reinigungsleistungen',()=>{
 const parsed=parseAssistantRequest('Fenster 30 qm und Wohnung 100 qm reinigen');
 assert.equal(parsed.intent,'calculation');
 assert.deepEqual(parsed.lines,[{service:'window',qty:30,unit:'m²'},{service:'house',qty:100,unit:'m²'}]);
});

test('Verneinte Hecken-Schnittarten ändern keinen Pflegeschnitt in teureren Schnitt',()=>{
 for(const phrase of ['Hecke 20 Meter ohne Formschnitt','Hecke 20 Meter, aber keinen Radikalschnitt','Keinen Radikalschnitt, sondern 20 Meter Hecke schneiden']){
  const parsed=parseAssistantRequest(phrase);
  assert.equal(parsed.intent,'calculation',phrase);
  assert.deepEqual(parsed.lines,[{service:'hedge',qty:20,unit:'lfm'}],phrase);
 }
});

test('Negierte Leistungen und deren Mengen werden nicht kalkuliert',()=>{
 for(const phrase of ['Hundert Quadratmeter Rasen mähen, keine Hecke','100 qm Rasen und keine 20 Meter Hecke','100 qm Rasen ohne Hecke']){
  const parsed=parseAssistantRequest(phrase);
  assert.equal(parsed.intent,'calculation');
  assert.deepEqual(parsed.lines,[{service:'lawn',qty:100,unit:'m²'}]);
  assert.ok(parsed.excludedServices.includes('hedge'));
 }
});

test('Verneinte Leistung wird bei Korrekturen ausdrücklich zur Entfernung gemeldet',()=>{
 const parsed=parseAssistantRequest('Nicht Rasen mähen, sondern 20 Meter Hecke schneiden',{lines:[{service:'lawn',qty:100}]});
 assert.equal(parsed.intent,'calculation');
 assert.equal(parsed.correction,true);
 assert.deepEqual(parsed.excludedServices,['lawn']);
 assert.deepEqual(parsed.lines,[{service:'hedge',qty:20,unit:'lfm'}]);
});

test('Nicht nur und sondern auch sind keine Ausschlüsse oder Korrekturen',()=>{
 const parsed=parseAssistantRequest('Nicht nur 20 Meter Hecke, sondern auch 100 qm Rasen');
 assert.equal(parsed.intent,'calculation');
 assert.equal(parsed.correction,false);
 assert.deepEqual(parsed.excludedServices,[]);
 assert.equal(parsed.lines.length,2);
});

test('Getrennte Pflegeschnitte und radikale Schnitte behalten beide Mengen',()=>{
 const parsed=parseAssistantRequest('Hecke 20 Meter und Radikalschnitt 10 Meter');
 assert.equal(parsed.intent,'calculation');
 assert.deepEqual(parsed.lines,[{service:'hedge',qty:20,unit:'lfm'},{service:'radical',qty:10,unit:'lfm'}]);
});

test('Dezimal- und Tausenderzeichen trennen keine Leistungsmodifikatoren',()=>{
 for(const [phrase,qty] of [['Radikalschnitt 10,5 Meter Hecke',10.5],['Radikalschnitt 1.200 Meter Hecke',1200]]){
  const parsed=parseAssistantRequest(phrase);
  assert.equal(parsed.intent,'calculation');
  assert.deepEqual(parsed.lines,[{service:'radical',qty,unit:'lfm'}]);
 }
});

test('Kurzantwort-Limit gilt auch ohne abschließbare Sätze',()=>{
 for(const text of ['Abc '.repeat(150),'X'.repeat(600),'A'.repeat(230)+'.'])assert.ok(briefSpokenReply(text).length<=230);
});

test('Kurzantworten erhalten führende Mengen und Beträge',()=>{
 assert.equal(briefSpokenReply('200 Euro sind noch offen.'),'200 Euro sind noch offen.');
 assert.equal(briefSpokenReply('0,5 Stunden Fahrt einplanen.'),'0,5 Stunden Fahrt einplanen.');
 assert.equal(briefSpokenReply('1. Erfasse die Zeit.\n• Prüfe die Kosten.'),'Erfasse die Zeit. Prüfe die Kosten.');
});
