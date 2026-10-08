import { test } from 'node:test';
import assert from 'node:assert/strict';
import { services } from '../dist/core.js';
import { LOCAL_REGION, SITE_CHECKS, knowledgeFor, parseSiteDetails, assessSite, disposalEstimate } from '../dist/knowledge.js';

const job=(service='felling',overrides={})=>({title:'Geprüfter Auftrag',date:'2026-10-20',notes:'',lines:[{service,qty:1,rate:100}],...overrides});
const checkedDetails=()=>({treeHeight:8,trunkDiameter:40,greenVolume:2,access:'easy',siteInspected:true,qualifiedWorkers:true,permissionsChecked:true,safetyPlanConfirmed:true});

test('Alle aktuellen Garten- und Reinigungsleistungen besitzen einen strukturierten Fachkatalog',()=>{
  assert.equal(services.length,59);
  for(const service of services){const knowledge=knowledgeFor(service.id);assert.equal(knowledge.serviceId,service.id);assert.equal(knowledge.unit,service.unit);assert.ok(knowledge.summary.length>30);assert.ok(knowledge.questions.length>=4);assert.ok(knowledge.risks.length>=2);assert.ok(knowledge.offerNotes.length>=2);assert.ok(knowledge.pricingBasis.length>30);assert.match(knowledge.scopeNote,/Vor-Ort-Prüfung/);assert.deepEqual(knowledge.equipment,service.equipment);}
});
test('Rückgabe kann verändert werden, ohne den Katalog oder Leistungsdaten zu verändern',()=>{
  const first=knowledgeFor('practice');first.questions.push('Verändert');first.equipment.push('none');assert.ok(!knowledgeFor('practice').questions.includes('Verändert'));assert.ok(!services.find(s=>s.id==='practice').equipment.includes('none'));assert.equal(knowledgeFor('unknown'),null);assert.equal(knowledgeFor('__proto__'),null);
});
test('Pflege, Radikalschnitt, einfacher Baumschnitt und Fällung behalten unterschiedliche Leistungsgrenzen',()=>{
  assert.match(knowledgeFor('hedge').summary,/Pflegeschnitt/);assert.match(knowledgeFor('radical').risks.join(' '),/1\. März bis 30\. September/);assert.match(knowledgeFor('tree').summary,/vom Boden/);assert.match(knowledgeFor('tree').summary,/keine Fällung/);assert.match(knowledgeFor('felling').offerNotes.join(' '),/qualifizierte Personen/);
});
test('Reinigung unterscheidet Haushalt, Haus, Grundreinigung, Fenster, Treppen, Büro und Praxis',()=>{
  assert.match(knowledgeFor('home').questions.join(' '),/Aufräumen/);assert.match(knowledgeFor('house').offerNotes.join(' '),/Zusatzflächen/);assert.match(knowledgeFor('deep').questions.join(' '),/Probefläche/);assert.match(knowledgeFor('window').pricingBasis,/Seiten/);assert.match(knowledgeFor('stairs').pricingBasis,/Etagen/);assert.match(knowledgeFor('office').questions.join(' '),/vertrauliche/);assert.match(knowledgeFor('practice').risks.join(' '),/Instrumentenaufbereitung/);
});
test('Mitwitz-Region und verifizierter gewerblicher Tarif tragen Quelle und Stand',()=>{
  assert.equal(LOCAL_REGION.base,'96268 Mitwitz');assert.deepEqual(LOCAL_REGION.serviceAreas,['Kronach','Sonnefeld','Stockheim','Gundelsdorf']);assert.equal(LOCAL_REGION.disposal.provider.address,'Horb 12, 96268 Mitwitz');assert.equal(LOCAL_REGION.disposal.provider.operator,'Horst Barnickel');assert.equal(LOCAL_REGION.disposal.provider.phone,'0170 315 89 89');assert.equal(LOCAL_REGION.disposal.commercialFreeAllowance,0);assert.equal(LOCAL_REGION.disposal.sourceDate,'2025-01');assert.equal(LOCAL_REGION.verifiedAt,'2026-10-08');assert.match(LOCAL_REGION.disposal.sourceURL,/landkreis-kronach\.de/);assert.ok(Object.isFrozen(LOCAL_REGION.disposal));
});
test('Fällmenge wird nicht als Höhe, Stammdurchmesser oder Grünschnittvolumen ausgegeben',()=>{
  assert.deepEqual(parseSiteDetails('Zwei Bäume fällen'),{});assert.deepEqual(parseSiteDetails('100 m² Rasen und 30 Meter Hecke'),{});assert.deepEqual(parseSiteDetails('2 Bäume fällen, acht Meter hoch, Stammdurchmesser vierzig Zentimeter, drei Kubikmeter Grünschnitt, Zugang gut'),{treeHeight:8,trunkDiameter:40,greenVolume:3,access:'easy'});
});
test('Deutsche Dezimalmaße und kompakte cm/m³ werden mit eindeutigen Einheiten interpretiert',()=>{
  assert.deepEqual(parseSiteDetails('Baumhöhe: 8,5 m, Stammdurchmesser: 45cm, Grünschnitt 2,5m³, Zufahrt schmal'),{treeHeight:8.5,trunkDiameter:45,greenVolume:2.5,access:'limited'});
  assert.deepEqual(parseSiteDetails('Höhe acht komma fünf Meter, Durchmesser null komma vier Meter, Schnittgut anderthalb Kubikmeter'),{treeHeight:8.5,trunkDiameter:40,greenVolume:1.5});
});
test('Höhen, Mengen und Durchmesser werden nicht gegenseitig vertauscht',()=>{
  assert.deepEqual(parseSiteDetails('300 m² Rasen, Hecke 30 Meter, Baumhöhe 9 Meter, BHD 35 cm'),{treeHeight:9,trunkDiameter:35});
  assert.deepEqual(parseSiteDetails('500 m² Büro, 30 Fenster, Wasser 3 m³'),{});assert.deepEqual(parseSiteDetails('Aststärke 12 cm'),{});
});
test('Mehrere verschiedene Baumhöhen erzeugen Rückfragen statt einer beliebigen Maßannahme',()=>{
  const details=parseSiteDetails('Erster Baum acht Meter hoch, zweiter Baum zehn Meter hoch, Stammdurchmesser vierzig cm');assert.equal(details.treeHeight,undefined);assert.equal(details.trunkDiameter,40);assert.ok(details.uncertain.includes('treeHeight'));assert.equal(assessSite(job(),details).readyForBindingQuote,false);
  assert.equal(parseSiteDetails('Höhe 8 bis 10 Meter').treeHeight,undefined);
});
test('Unmögliche Maße und unbestätigte Spannen werden nicht als sichere Daten gesetzt',()=>{
  for(const raw of ['Höhe 0 Meter','Höhe minus acht Meter','Höhe 150 Meter','Stammdurchmesser 900 cm','Grünschnitt 20000 Kubikmeter']){const details=parseSiteDetails(raw);assert.ok(details.uncertain?.length);assert.equal(assessSite(job(),details).readyForBindingQuote,false);}
});
test('Zugang wird nur aus vorhandenen Angaben erkannt und behält Einschränkungen',()=>{
  assert.equal(parseSiteDetails('frei zugänglich').access,'easy');assert.equal(parseSiteDetails('Zugang eingeschränkt').access,'limited');assert.equal(parseSiteDetails('keine Zufahrt').access,'difficult');assert.equal(parseSiteDetails('Zugang schwierig').access,'difficult');assert.equal(parseSiteDetails('Zugang unbekannt').access,'unknown');assert.equal(parseSiteDetails('Baumhöhe acht Meter').access,undefined);
});
test('Fällung braucht bestätigte Maße, Zugang sowie vier tatsächliche Vor-Ort-Freigaben',()=>{
  const missing=assessSite(job(),{});assert.equal(missing.readyForBindingQuote,false);assert.ok(missing.missing.includes('Baumhöhe in Metern'));assert.ok(missing.missing.includes('Stammdurchmesser in Zentimetern'));assert.equal(SITE_CHECKS.length,4);
  for(const check of SITE_CHECKS){const details=checkedDetails();details[check.key]=false;assert.equal(assessSite(job(),details).readyForBindingQuote,false);assert.ok(assessSite(job(),details).missing.includes(check.label));}
  assert.equal(assessSite(job(),checkedDetails()).readyForBindingQuote,true);assert.equal(assessSite(job(),{...checkedDetails(),access:'unknown'}).readyForBindingQuote,false);
});
test('Erschwerter Zugang und mehrere Bäume bleiben als besondere Planungshinweise sichtbar',()=>{
  const result=assessSite(job('felling',{lines:[{service:'felling',qty:2,rate:100}]}),{...checkedDetails(),access:'difficult'});assert.match(result.warnings.join(' '),/jeden Baum/);assert.match(result.warnings.join(' '),/Erschwerter Zugang/);assert.match(result.warnings.join(' '),/Baumstämme/);
});
test('Fällung hat keine erfundene pauschale März-September-Sperre; örtliche Prüfung bleibt erforderlich',()=>{
  const result=assessSite(job('felling',{date:'2026-07-10'}),checkedDetails());assert.equal(result.readyForBindingQuote,true);assert.match(result.warnings.join(' '),/Vegetationszeit/);assert.match(result.warnings.join(' '),/Standort/);
});
test('Radikalschnitt benötigt einen zulässigen Termin und geklärte Schutzregeln',()=>{
  const blocked=assessSite(job('radical',{date:'2026-07-10'}),checkedDetails());assert.equal(blocked.readyForBindingQuote,false);assert.match(blocked.warnings.join(' '),/gesperrt/);assert.equal(assessSite(job('radical'),checkedDetails()).readyForBindingQuote,true);assert.equal(assessSite(job('radical',{date:''}),checkedDetails()).readyForBindingQuote,false);
});
test('Einfacher Baumpflegerückschnitt wird bei genannten Spezialarbeiten nicht still erweitert',()=>{
  assert.equal(assessSite(job('tree'),checkedDetails()).readyForBindingQuote,true);
  for(const notes of ['Kletterarbeit nötig','Hubarbeitsbühne verwenden','Mit Motorsäge','Baum fällen'])assert.equal(assessSite(job('tree',{notes}),checkedDetails()).readyForBindingQuote,false);
});
test('Grünschnitttransport braucht bestätigtes Volumen und lässt sich nicht aus Baumzahl kalkulieren',()=>{
  assert.equal(assessSite(job('greenhaul'),{}).readyForBindingQuote,false);assert.equal(assessSite(job('greenhaul'),checkedDetails()).readyForBindingQuote,true);assert.equal(assessSite(job('greenhaul'),{...checkedDetails(),greenVolume:0}).readyForBindingQuote,false);assert.match(assessSite(job('greenhaul'),checkedDetails()).warnings.join(' '),/Tarif/);
});
test('Fenster, Grundreinigung und Praxisreinigung verlangen ihre entscheidenden Vor-Ort-Abstimmungen',()=>{
  for(const service of ['window','deep','practice'])assert.equal(assessSite(job(service),{}).readyForBindingQuote,false);
  assert.match(assessSite(job('practice'),{}).warnings.join(' '),/Hygieneplan/);assert.match(assessSite(job('deep'),{}).missing.join(' '),/Probefläche/);assert.match(assessSite(job('window'),{}).missing.join(' '),/sichere Erreichbarkeit/);
});
test('Leerer oder unbekannter Leistungsumfang kann kein geprüftes Angebot ergeben',()=>{
  assert.equal(assessSite({lines:[]}).readyForBindingQuote,false);assert.equal(assessSite(job('unknown')).readyForBindingQuote,false);assert.equal(assessSite(job('lawn',{lines:[{service:'lawn',qty:NaN,rate:1}]})).readyForBindingQuote,false);
  assert.equal(assessSite({lines:[null]},null).readyForBindingQuote,false);assert.equal(assessSite(job('lawn',{lines:[{service:'lawn',qty:1}]})).readyForBindingQuote,false);
});
test('Gewerblicher Entsorgungswert enthält Mengenpreis, genau eine Rechnungspauschale und Umsatzsteuer',()=>{
  const result=disposalEstimate(3);assert.equal(result.volumeCostNet,27);assert.equal(result.invoiceFeeNet,5);assert.equal(result.net,32);assert.equal(result.vat,6.08);assert.equal(result.gross,38.08);assert.equal(result.cost,38.08);assert.equal(result.sourceDate,'2025-01');assert.equal(result.sourceURL,LOCAL_REGION.disposal.sourceURL);assert.match(result.caveat,/Tarifstand Januar 2025/);assert.match(result.caveat,/Transport/);
});
test('Eine kleine Gewerbemenge erhält keine private Freimenge und keine erfundene volle-m³-Mindestmenge',()=>{
  const result=disposalEstimate(.1);assert.equal(result.volumeCostNet,.9);assert.equal(result.net,5.9);assert.equal(result.gross,7.02);assert.match(result.caveat,/keine private Freimenge/);assert.match(result.caveat,/Kein belegtes Aufrunden/);
});
test('Kleinunternehmer und andere Steuerbefreiung planen Bruttokosten; Regelbesteuerung vereinfacht netto',()=>{
  for(const taxMode of ['small','exempt'])assert.equal(disposalEstimate(2,{taxMode}).cost,27.37);
  const result=disposalEstimate(2,{taxMode:'standard'});assert.equal(result.net,23);assert.equal(result.cost,23);assert.equal(result.gross,27.37);
});
test('Der angenommene Lieferanten-Steuersatz bleibt konfigurierbar und im Ergebnis erkennbar',()=>{
  const result=disposalEstimate(1,{vatRate:7});assert.equal(result.net,14);assert.equal(result.vat,.98);assert.equal(result.gross,14.98);assert.equal(result.vatRate,7);assert.match(result.caveat,/7 %/);
});
test('Unbekannte, null, negative, unbestätigte oder unzulässige Entsorgungsdaten werden nicht bepreist',()=>{
  for(const volume of [0,-1,NaN,Infinity,undefined,null,'2',10001])assert.throws(()=>disposalEstimate(volume),/Volumen|Grünschnittvolumen/);
  assert.throws(()=>disposalEstimate(2,{volumeConfirmed:false}),/vor Ort bestätigen/);assert.throws(()=>disposalEstimate(2,{woodIncluded:true}),/gesondert/);assert.throws(()=>disposalEstimate(2,{taxMode:'invalid'}),/Steuermodus/);assert.throws(()=>disposalEstimate(2,{vatRate:NaN}),/Umsatzsteuersatz/);
});
test('Entsorgungsdaten weisen Baumstämme generell und unzulässige Ast-/Wurzelstärken aus',()=>{
  assert.ok(LOCAL_REGION.disposal.excludedMaterials.includes('Baumstämme'));assert.match(LOCAL_REGION.disposal.excludedMaterials.join(' '),/mehr als 10 cm/);
  const parsed=parseSiteDetails('Baumstämme 3 Kubikmeter abtransportieren');assert.equal(parsed.greenVolume,undefined);assert.ok(parsed.uncertain.includes('greenVolume'));
});
