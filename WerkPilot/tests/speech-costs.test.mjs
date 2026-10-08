import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAssistantRequest,parseAssistantCosts,parseGermanNumber,bestTranscript} from '../dist/speech.js';
const treeContext={lines:[{service:'tree',qty:8}]};
const spokenOrder='Kannst du mir einen Auftrag kalkulieren? Ich habe acht Bäume, einen Rückschnitt, kalkuliere mir die Preise sowie Anfahrtskosten jeweils von Ort zu Ort, zum Beispiel eine halbe Stunde Anfahrtskosten sowie Maschinenmaterialskosten';

test('Kompletter mobiler Auftrag erhält acht Bäume und eine halbe Stunde Anfahrt',()=>{
 const parsed=parseAssistantRequest(spokenOrder);
 assert.deepEqual(parsed.lines,[{service:'tree',qty:8,unit:'Stück'}]);
 assert.deepEqual(parsed.costs,{travelHours:.5});
 assert.equal(parsed.intent,'clarify-costs');
 assert.equal(parsed.costOnly,false);
 assert.deepEqual(parsed.costIssues.map(issue=>issue.field),['material/rental']);
 assert.equal(parsed.route,null);
});

test('Fünfzehn Meter Radikalrückschnitt funktionieren mit und ohne Hecke',()=>{
 for(const phrase of ['15 Meter Radikalrückschnitt','fünfzehn Meter Radikalrückschnitt Hecke']){
  const parsed=parseAssistantRequest(phrase);
  assert.equal(parsed.intent,'calculation');
  assert.deepEqual(parsed.lines,[{service:'radical',qty:15,unit:'lfm'}]);
 }
});

test('Baumanzahl wird von Fahrt, Material und Maschinenkosten getrennt',()=>{
 const parsed=parseAssistantRequest('Acht Bäume zurückschneiden, Anfahrt 30 Minuten und 20 Kilometer, Material 20 Euro, Maschinenkosten 30 Euro');
 assert.equal(parsed.intent,'calculation');
 assert.deepEqual(parsed.lines,[{service:'tree',qty:8,unit:'Stück'}]);
 assert.deepEqual(parsed.costs,{travelHours:.5,km:20,material:20,rental:30});
});

test('Bruchteile natürlicher deutscher Anfahrtszeiten',()=>{
 for(const [duration,hours] of [['eine halbe Stunde',.5],['halbe Stunde',.5],['eine Dreiviertelstunde',.75],['dreiviertel Stunde',.75],['anderthalbe Stunden',1.5],['eineinhalb Stunden',1.5],['neunzig Minuten',1.5]]){
  const parsed=parseAssistantRequest(`Anfahrt ${duration}`,treeContext);
  assert.equal(parsed.intent,'calculation',duration);
  assert.equal(parsed.costs.travelHours,hours,duration);
  assert.equal(parsed.costOnly,true);
 }
 assert.equal(parseGermanNumber('einer halben'),.5);
});

test('Fahrzeit wird nicht als zusätzliche Gartenpflegezeit berechnet',()=>{
 for(const phrase of ['Gartenpflege zwei Stunden und Anfahrt dreißig Minuten','Anfahrt dreißig Minuten und Gartenpflege zwei Stunden']){
  const parsed=parseAssistantRequest(phrase);
  assert.equal(parsed.intent,'calculation');
  assert.deepEqual(parsed.lines,[{service:'landscape',qty:2,unit:'Std.'}]);
  assert.deepEqual(parsed.costs,{travelHours:.5});
 }
});

test('Explizite Fahrtpauschale bleibt zusätzlich zur tatsächlichen Fahrtzeit erhalten',()=>{
 const parsed=parseAssistantRequest('Anfahrt 30 Minuten, Fahrtpauschale 25 Euro',treeContext);
 assert.equal(parsed.intent,'calculation');
 assert.deepEqual(parsed.costs,{travelHours:.5,travelPrice:25});
});

test('Kosten-only Folgeantwort erhält sämtliche vorhandenen Leistungszeilen',()=>{
 const context={lines:[{service:'tree',qty:8},{service:'radical',qty:15}]};
 const parsed=parseAssistantRequest('20 Euro Material und 30 Euro Maschine',context);
 assert.equal(parsed.intent,'calculation');
 assert.equal(parsed.costOnly,true);
 assert.equal(parsed.correction,true);
 assert.deepEqual(parsed.lines,[{service:'tree',qty:8,unit:'Stück'},{service:'radical',qty:15,unit:'lfm'}]);
 assert.deepEqual(parsed.costs,{material:20,rental:30});
});

test('Ambigue kombinierte Eurokosten werden nicht dem Baum als Stückzahl zugeordnet',()=>{
 const parsed=parseAssistantRequest('Anfahrt eine halbe Stunde und Maschinenmaterialskosten 40 Euro',treeContext);
 assert.equal(parsed.intent,'clarify-costs');
 assert.equal(parsed.costOnly,true);
 assert.deepEqual(parsed.lines,[{service:'tree',qty:8,unit:'Stück'}]);
 assert.deepEqual(parsed.costs,{travelHours:.5});
 assert.ok(parsed.costIssues.some(issue=>issue.field==='material/rental'));
});

test('Ein einzelner Materialbetrag wird nicht als Maschinenbetrag wiederverwendet',()=>{
 const parsed=parseAssistantRequest('Material 20 Euro und Maschinenkosten',treeContext);
 assert.equal(parsed.intent,'clarify-costs');
 assert.deepEqual(parsed.costs,{material:20});
 assert.ok(parsed.costIssues.some(issue=>issue.field==='rental'));
});

test('Route erhält reale Ortsnamen, ohne eine Entfernung zu erfinden',()=>{
 const parsed=parseAssistantRequest('Anfahrt von Bad Homburg nach Frankfurt am Main, 30 Minuten Fahrt',treeContext);
 assert.equal(parsed.intent,'calculation');
 assert.deepEqual(parsed.route,{from:'Bad Homburg',to:'Frankfurt am Main'});
 assert.deepEqual(parsed.costs,{travelHours:.5});
 assert.equal('km' in parsed.costs,false);
});

test('Orte allein verlangen bestätigte Fahrtwerte',()=>{
 const parsed=parseAssistantRequest('von Köln nach Bonn',treeContext);
 assert.equal(parsed.intent,'clarify-costs');
 assert.deepEqual(parsed.route,{from:'Köln',to:'Bonn'});
 assert.deepEqual(parsed.costs,{});
 assert.ok(parsed.costIssues.some(issue=>issue.field==='travelHours/km'));
});

test('Von Ort zu Ort wird nicht als konkrete Route gespeichert',()=>{
 assert.equal(parseAssistantCosts('Anfahrtskosten jeweils von Ort zu Ort, eine halbe Stunde Anfahrt').route,null);
});

test('Explizite Nullkosten sind erlaubt',()=>{
 assert.equal(parseAssistantRequest('Materialkosten 0 Euro',treeContext).costs.material,0);
 assert.equal(parseAssistantRequest('Baumschnitt 8 Stück ohne Materialkosten').costs.material,0);
 assert.equal(parseAssistantRequest('Keine Maschinenmiete',treeContext).costs.rental,0);
});

test('Negative und widersprüchliche Kosten verlangen Bestätigung',()=>{
 const negative=parseAssistantRequest('Materialkosten minus zwanzig Euro',treeContext);
 assert.equal(negative.intent,'clarify-costs');
 assert.equal('material' in negative.costs,false);
 const conflict=parseAssistantRequest('Material 20 Euro und Material 30 Euro',treeContext);
 assert.equal(conflict.intent,'clarify-costs');
 assert.ok(conflict.costIssues.some(issue=>issue.field==='material'));
});

test('Explizite Kostenkorrektur übernimmt den neuen Betrag',()=>{
 const parsed=parseAssistantRequest('Materialkosten nicht 20 Euro sondern 30 Euro',treeContext);
 assert.equal(parsed.intent,'calculation');
 assert.deepEqual(parsed.costs,{material:30});
 const instead=parseAssistantRequest('Materialkosten 30 Euro statt 20 Euro',treeContext);
 assert.equal(instead.intent,'calculation');
 assert.deepEqual(instead.costs,{material:30});
});

test('Material, Miete und Entsorgung bleiben eigene Kostenpositionen',()=>{
 const parsed=parseAssistantRequest('20,50 Euro Material, 30 Euro Maschinenmiete, 15 Euro Entsorgung',treeContext);
 assert.equal(parsed.intent,'calculation');
 assert.deepEqual(parsed.costs,{material:20.5,rental:30,disposal:15});
});

test('Baumfällung wird nicht als kleiner Baumpflegeschnitt kalkuliert',()=>{
 assert.equal(parseAssistantRequest('8 Bäume fällen').intent,'calculation');
 assert.deepEqual(parseAssistantRequest('8 Bäume fällen').lines,[{service:'felling',qty:8,unit:'Stück'}]);
 assert.equal(parseAssistantRequest('Baumschnitt 2,5 Stück').intent,'clarify-quantity');
});

test('Fachliche ASR-Auswahl behält den längeren Auftrag samt Kostenrückfrage',()=>{
 assert.equal(bestTranscript([{transcript:spokenOrder,confidence:.94},{transcript:'Ich habe acht Bäume',confidence:.7}]),spokenOrder);
});

test('Jede Interpretation trägt Kostenfelder für einen stabilen App-Vertrag',()=>{
 for(const phrase of ['Hallo','Stopp','Was steht heute an?','Welche Geräte für Fensterreinigung?','Übernehmen']){
  const parsed=parseAssistantRequest(phrase);
  assert.ok(parsed.costs&&typeof parsed.costs==='object');
  assert.ok(Array.isArray(parsed.costIssues));
  assert.equal(typeof parsed.costOnly,'boolean');
 }
});

test('Fragen nach Geräten und Material bleiben Ausstattung statt Kostenrückfrage',()=>{
 for(const phrase of ['Welche Maschinen für acht Bäume?','Welches Material für die Hecke?','Welche Materialien für Grundreinigung?'])assert.equal(parseAssistantRequest(phrase).intent,'equipment',phrase);
});

test('Fällauftrag mit Ausstattungsfrage erkennt Fällung statt kleinen Pflegerückschnitt',()=>{
 const parsed=parseAssistantRequest('Zwei Bäume zum Fällen. Wie ist der Preis und was für Maschinen benötige ich dafür?');
 assert.equal(parsed.intent,'calculation');assert.deepEqual(parsed.lines,[{service:'felling',qty:2,unit:'Stück'}]);assert.deepEqual(parsed.costIssues,[]);
});
test('Fällung, Grünschnitttransport und Zusatzkosten bleiben getrennte Positionen',()=>{
 const parsed=parseAssistantRequest('Kalkuliere zwei Bäume fällen und drei Kubikmeter Grünschnitt abtransportieren, 30 Minuten Anfahrt, Maschinenmiete 100 Euro, Material 20 Euro');
 assert.equal(parsed.intent,'calculation');assert.deepEqual(parsed.lines,[{service:'felling',qty:2,unit:'Stück'},{service:'greenhaul',qty:3,unit:'m³'}]);assert.deepEqual(parsed.costs,{travelHours:.5,rental:100,material:20});
});
test('Fehlendes Transportvolumen erhält die schon erkannte Fällanzahl für die Rückfrage',()=>{
 const parsed=parseAssistantRequest('2 Bäume fällen und Abtransport des Grünschnitts');
 assert.equal(parsed.intent,'clarify-quantity');assert.equal(parsed.service,'greenhaul');assert.deepEqual(parsed.lines,[{service:'felling',qty:2,unit:'Stück'}]);
});
test('Baumhöhe und Stammdurchmesser ersetzen keine Baumanzahl',()=>{
 const parsed=parseAssistantRequest('Zwei Bäume fällen, Höhe acht Meter, Stammdurchmesser 40 Zentimeter, Zugang frei');
 assert.equal(parsed.intent,'calculation');assert.deepEqual(parsed.lines,[{service:'felling',qty:2,unit:'Stück'}]);
});
test('Kubikmeter funktionieren ausgeschrieben, als m³ und als kompakte Eingabe',()=>{
 for(const phrase of ['Grünschnitt 3 Kubikmeter abtransportieren','3m³ Grünschnitt abtransportieren','3 m3 Grünschnitt abtransportieren','3 cbm Grünschnitt abtransportieren']){
  const parsed=parseAssistantRequest(phrase);assert.equal(parsed.intent,'calculation',phrase);assert.deepEqual(parsed.lines,[{service:'greenhaul',qty:3,unit:'m³'}],phrase);
 }
});
test('Ortsnamen der Mitwitzer Region erzeugen keine ausgedachten Kilometer',()=>{
 const parsed=parseAssistantRequest('von Mitwitz nach Kronach, eine halbe Stunde Anfahrt',treeContext);
 assert.equal(parsed.intent,'calculation');assert.deepEqual(parsed.route,{from:'Mitwitz',to:'Kronach'});assert.equal(parsed.costs.travelHours,.5);assert.equal(parsed.costs.km,undefined);
});

test('Die Erkennungsalternative verliert keine schon benannte Grünschnittleistung ohne Aufmaß',()=>{
 const whole='2 Bäume fällen und Abtransport des Grünschnitts';
 assert.equal(bestTranscript([{transcript:whole,confidence:.82},{transcript:'2 Bäume fällen',confidence:.97}]),whole);
});
