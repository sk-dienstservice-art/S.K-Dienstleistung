import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseAssistantRequest,bestTranscript} from '../dist/speech.js';
import {craftServices} from '../dist/trades.js';
const examples=[
 ['paint_wall','50 qm Wand streichen',50],['paint_ceiling','20 qm Decke streichen',20],['paint_door','Drei Türen lackieren',3],
 ['drywall_wall','20 qm Trockenbauwand montieren',20],['drywall_ceiling','20 qm Decke mit Gipskarton abhängen',20],['drywall_spackle','20 qm verspachteln',20],
 ['floor_laminate','20 qm Laminat verlegen',20],['floor_vinyl','20 qm Vinyl verlegen',20],['floor_skirting','20 Meter Sockelleisten montieren',20],
 ['tile_floor','20 qm Bodenfliesen verlegen',20],['tile_wall','20 qm Wandfliesen verlegen',20],['tile_seal','20 Meter Silikonfugen erneuern',20],
 ['masonry_wall','20 qm Mauer errichten',20],['masonry_repair','2 Stunden Mauer reparieren',2],['masonry_joint','20 qm Mauer verfugen',20],
 ['plaster_interior','20 qm Innenwand verputzen',20],['plaster_facade','20 qm Fassade verputzen',20],['plaster_patch','2 Stunden Putz reparieren',2],
 ['paving_lay','20 qm Pflaster verlegen',20],['paving_base','20 qm Pflasterunterbau herstellen',20],['paving_edge','20 Meter Randsteine setzen',20],
 ['wood_deck','20 qm Holzterrasse bauen',20],['wood_fence','20 Meter Holzzaun bauen',20],['wood_repair','2 Stunden Holz reparieren',2],
 ['assemble_furniture','2 Stunden Möbelmontage',2],['assemble_kitchen','Acht Küchenmodule montieren',8],['assemble_door','Drei Türen montieren',3],
 ['metal_fence','20 Meter Metallzaun montieren',20],['metal_railing','20 Meter Metallgeländer montieren',20],['metal_repair','2 Stunden Metallreparatur',2],
 ['electrical_socket','Drei Steckdosen montieren',3],['electrical_light','Drei Lampen montieren',3],['electrical_check','2 Stunden Elektroprüfung',2],
 ['sanitary_fixture','Drei Armaturen installieren',3],['heating_service','2 Stunden Heizungswartung',2],['climate_service','2 Stunden Klimaanlage warten',2],
 ['roof_repair','2 Stunden Dachreparatur',2],['gutter_clean','20 Meter Dachrinne reinigen',20],['gutter_install','20 Meter Dachrinne montieren',20],
 ['demolition_surface','20 qm Bodenbelag entfernen',20],['demolition_partition','20 qm Trennwand abbrechen',20],['demolition_sort','2 Stunden Bauschutt sortieren',2],
 ['customwork','2 Stunden Sonderarbeit',2]
];

test('Alle 43 konkreten Handwerksleistungen treffen Katalog-ID, Menge und Einheit',()=>{
 assert.equal(examples.length,43);
 assert.deepEqual(new Set(examples.map(([id])=>id)),new Set(craftServices.map(s=>s.id)));
 for(const [id,phrase,qty] of examples){
  const parsed=parseAssistantRequest(phrase);
  assert.equal(parsed.intent,'calculation',phrase);
  assert.deepEqual(parsed.lines,[{service:id,qty,unit:craftServices.find(s=>s.id===id).unit}],phrase);
 }
});

test('Wände und Decken behalten getrennte Flächen in einer Äußerung',()=>{
 const parsed=parseAssistantRequest('Wand streichen 100 qm und Decke streichen 20 qm');
 assert.equal(parsed.intent,'calculation');
 assert.deepEqual(parsed.lines,[{service:'paint_wall',qty:100,unit:'m²'},{service:'paint_ceiling',qty:20,unit:'m²'}]);
});

test('Kompakte Quadratmeter-Abkürzungen gehen zwischen Garten und Handwerk nicht verloren',()=>{
 const parsed=parseAssistantRequest('100qm Rasen und 20qm Pflaster verlegen');
 assert.equal(parsed.intent,'calculation');
 assert.deepEqual(parsed.lines,[{service:'lawn',qty:100,unit:'m²'},{service:'paving_lay',qty:20,unit:'m²'}]);
});

test('Tür lackieren und montieren sind verschiedene konkrete Arbeiten',()=>{
 assert.equal(parseAssistantRequest('3 Türen lackieren').lines[0].service,'paint_door');
 assert.equal(parseAssistantRequest('3 Türen montieren').lines[0].service,'assemble_door');
 assert.equal(parseAssistantRequest('3Türen lackieren').lines[0].qty,3);
});

test('Allgemeine Elektro- und Sanitäranfragen verlangen einen konkreten Leistungsumfang',()=>{
 for(const phrase of ['Elektro zehn Quadratmeter','Kalkuliere Sanitär für drei Stunden','Wie mache ich Elektroarbeiten?']){
  const parsed=parseAssistantRequest(phrase);
  assert.equal(parsed.intent,'clarify-service',phrase);
  assert.equal(parsed.lines.length,0,phrase);
 }
});

test('Unbestimmte Fliesen, Malerarbeit und Trockenbau werden nicht als Wandarbeit angenommen',()=>{
 for(const phrase of ['20 qm Fliesen verlegen','100 qm streichen','20 qm Trockenbau']){
  assert.equal(parseAssistantRequest(phrase).intent,'clarify-service',phrase);
 }
});

test('Reinigungsaufträge werden nicht durch genannte Bodenmaterialien in Verlegearbeiten geändert',()=>{
 const parsed=parseAssistantRequest('20 qm Laminat reinigen');
 assert.equal(parsed.intent,'calculation');
 assert.deepEqual(parsed.lines,[{service:'house',qty:20,unit:'m²'}]);
});

test('Fugenarbeiten werden nicht als Unkrautentfernung bepreist',()=>{
 const parsed=parseAssistantRequest('20 Meter Fugen mit Silikon erneuern');
 assert.equal(parsed.intent,'calculation');
 assert.deepEqual(parsed.lines,[{service:'tile_seal',qty:20,unit:'lfm'}]);
});

test('Negierte alte Bodenleistung wird für eine klare Korrektur ausgeschlossen',()=>{
 const parsed=parseAssistantRequest('Nicht 100 qm Laminat sondern 20 qm Vinyl',{lines:[{service:'floor_laminate',qty:100}]});
 assert.equal(parsed.intent,'calculation');
 assert.equal(parsed.correction,true);
 assert.deepEqual(parsed.excludedServices,['floor_laminate']);
 assert.deepEqual(parsed.lines,[{service:'floor_vinyl',qty:20,unit:'m²'}]);
});

test('Handwerksmengen sind unabhängig von Anfahrt und Montagematerialkosten',()=>{
 const parsed=parseAssistantRequest('20 qm Laminat verlegen, 30 Minuten Anfahrt, Montagematerial 50 Euro');
 assert.equal(parsed.intent,'calculation');
 assert.deepEqual(parsed.lines,[{service:'floor_laminate',qty:20,unit:'m²'}]);
 assert.deepEqual(parsed.costs,{travelHours:.5,material:50});
});

test('Nur Kosten ergänzen erhält vorherige Handwerkszeilen und deren Katalogeinheiten',()=>{
 const parsed=parseAssistantRequest('Materialkosten 50 Euro',{lines:[{service:'floor_laminate',qty:20},{service:'paint_wall',qty:100}]});
 assert.equal(parsed.intent,'calculation');
 assert.equal(parsed.costOnly,true);
 assert.deepEqual(parsed.lines,[{service:'floor_laminate',qty:20,unit:'m²'},{service:'paint_wall',qty:100,unit:'m²'}]);
});

test('Mengenrückfragen für Handwerk verwenden den bestehenden Gesprächskontext',()=>{
 const initial=parseAssistantRequest('Was kostet Laminat verlegen?');
 assert.equal(initial.intent,'clarify-quantity');
 assert.equal(initial.service,'floor_laminate');
 assert.deepEqual(parseAssistantRequest('fünfzig',{pendingService:'floor_laminate'}).lines,[{service:'floor_laminate',qty:50,unit:'m²'}]);
});

test('Stückleistungen erlauben keine halben Steckdosen oder Türen',()=>{
 assert.equal(parseAssistantRequest('2,5 Steckdosen montieren').intent,'clarify-quantity');
 assert.equal(parseAssistantRequest('2,5 Türen montieren').intent,'clarify-quantity');
});

test('Falsche Handwerkseinheiten bleiben eine ausdrückliche Rückfrage',()=>{
 const parsed=parseAssistantRequest('20 Meter Laminat verlegen');
 assert.equal(parsed.intent,'clarify-unit');
 assert.equal(parsed.unit,'m²');
});

test('Auswahl von Spracherkennungsalternativen kennt die neuen Handwerkskategorien',()=>{
 assert.equal(bestTranscript([{transcript:'zwanzig Quadratmeter Lampen verlegen',confidence:.9},{transcript:'zwanzig Quadratmeter Laminat verlegen',confidence:.75}]),'zwanzig Quadratmeter Laminat verlegen');
});

test('Eine unbestimmte Wand wird mit früherem Rasenkontext nicht als Rasen berechnet',()=>{
 const parsed=parseAssistantRequest('Kalkuliere 20 qm Wand',{lines:[{service:'lawn',qty:100}]});
 assert.equal(parsed.intent,'clarify-service');
 assert.equal(parsed.lines.length,0);
 assert.ok(parsed.services.includes('paint_wall'));
});

test('Neue Elektroinstallation wird nicht mit dem Austauschpreis einer Steckdose angeboten',()=>{
 assert.equal(parseAssistantRequest('4 Steckdosen neu installieren').intent,'clarify-service');
 assert.equal(parseAssistantRequest('4 Steckdosen austauschen').intent,'calculation');
});


test('Eine komplette Küche wird nicht als ein einziges Küchenmodul bepreist',()=>{
 const parsed=parseAssistantRequest('Eine Küche montieren');
 assert.equal(parsed.intent,'clarify-service');
 assert.match(parsed.clarification,/Küchenmodule/);
 assert.deepEqual(parseAssistantRequest('Acht Küchenmodule montieren').lines,[{service:'assemble_kitchen',qty:8,unit:'Stück'}]);
});

test('Dachschäden auf Bildern führen zu Umfangsfragen und keiner Diagnose',()=>{
 const parsed=parseAssistantRequest('Was ist mit dem Dachschaden auf dem Foto?');
 assert.equal(parsed.intent,'clarify-service');
 assert.match(parsed.clarification,/nicht verlässlich diagnostizieren/);
 assert.equal(parsed.lines.length,0);
});

test('Unbekannte neue Objekte bekommen keinen Preis aus der zuletzt besprochenen Gartenleistung',()=>{
 const context={lines:[{service:'lawn',qty:100}]};
 assert.equal(parseAssistantRequest('Kalkuliere 20 qm Lamellendach',context).intent,'clarify-service');
 assert.equal(parseAssistantRequest('Nein, fünfzig Quadratmeter',context).intent,'calculation');
});

test('Betriebsräume streichen wird nicht mit dem Reinigungsprofil berechnet',()=>{
 for(const phrase of ['100qm Büro streichen','50 qm Praxis streichen']){
  const parsed=parseAssistantRequest(phrase);
  assert.equal(parsed.intent,'clarify-service',phrase);
  assert.equal(parsed.lines.length,0,phrase);
  assert.deepEqual(parsed.services,['paint_wall','paint_ceiling','paint_door']);
 }
});

test('Verneintes Streichen verändert einen bestätigten Reinigungsauftrag nicht',()=>{
 const parsed=parseAssistantRequest('100qm Büro reinigen, aber nicht streichen');
 assert.equal(parsed.intent,'calculation');
 assert.deepEqual(parsed.lines,[{service:'office',qty:100,unit:'m²'}]);
});

test('Eine Menge mit Malerverb kann eine bestehende konkrete Malerrückfrage beantworten',()=>{
 const parsed=parseAssistantRequest('fünfzig Quadratmeter streichen',{pendingService:'paint_wall'});
 assert.equal(parsed.intent,'calculation');
 assert.deepEqual(parsed.lines,[{service:'paint_wall',qty:50,unit:'m²'}]);
});

test('Altbeläge entfernen verwendet keinen Verlegepreis für neue Beläge',()=>{
 for(const phrase of ['20qm Laminat entfernen','20qm Wandfliesen entfernen']){
  const parsed=parseAssistantRequest(phrase);
  assert.equal(parsed.intent,'calculation',phrase);
  assert.deepEqual(parsed.lines,[{service:'demolition_surface',qty:20,unit:'m²'}],phrase);
 }
});
