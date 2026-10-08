import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tradeGroups,craftServices,craftEquipment,craftKnowledge,materialSuggestions} from '../dist/trades.js';
import {services,equipment} from '../dist/core.js';

const legacyServiceIds=['lawn','hedge','radical','shape','weeds','landscape','home','house','deep','window','stairs','office','practice','tree','felling','greenhaul'];
const legacyEquipmentIds=['chainsaw','chainsawppe','trailer','mower','trimmer','hedgetrimmer','lopper','secateurs','tarp','weeder','rake','ppe','vacuum','mop','cloths','cleaners','gloves','squeegee','pole','machine','disinfectant','sign'];
const findMaterial=(service,id,qty)=>materialSuggestions(service,qty).find(item=>item.id===`${service}_${id}`);

test('Katalog enthält 14 Fachgruppen mit jeweils drei Leistungen und eine frei benennbare Leistung',()=>{
  assert.equal(tradeGroups.length,15);assert.equal(craftServices.length,43);assert.equal(craftEquipment.length,23);
  for(const group of tradeGroups){assert.ok(group.name);assert.ok(group.icon);assert.ok(group.description.length>20);assert.equal(craftServices.filter(service=>service.category===group.id).length,group.id==='custom'?1:3);}
});
test('Katalog-IDs sind sicher und innerhalb ihrer Sammlung eindeutig',()=>{
  for(const collection of [tradeGroups,craftServices,craftEquipment]){assert.equal(new Set(collection.map(item=>item.id)).size,collection.length);for(const item of collection)assert.match(item.id,/^[a-z][a-z0-9_]{0,99}$/);}
});
test('Vorhandene Garten-/Reinigungsleistungen und Geräte werden weder ersetzt noch doppelt definiert',()=>{
  for(const id of legacyServiceIds){assert.ok(!craftServices.some(service=>service.id===id));assert.ok(services.some(service=>service.id===id));}
  for(const id of legacyEquipmentIds){assert.ok(!craftEquipment.some(item=>item.id===id));assert.ok(equipment.some(item=>item.id===id));}
  assert.ok(craftEquipment.every(item=>item.id.startsWith('craft_')));
});
test('Jede Leistung ist mit dem bisherigen Kalkulationsschema kompatibel',()=>{
  for(const service of craftServices){assert.ok(typeof service.name==='string');assert.ok(tradeGroups.some(group=>group.id===service.category));assert.ok(['m²','lfm','Stück','Std.'].includes(service.unit));for(const field of ['rate','minutes','material'])assert.ok(Number.isFinite(service[field])&&service[field]>=0,`${service.id}.${field}`);assert.ok(service.rate>0);assert.ok(service.minutes>0);assert.equal(service.material,0);assert.ok(service.equipment.length>=2);assert.equal(service.tasks.length,4);assert.match(service.hint,/kein recherchierter Marktpreis 2026/);assert.match(service.hint,/Personenminuten/);assert.match(service.hint,/gesondert erfassen/);}
});
test('Alle Geräteverweise sind auflösbar und weisen geeignete Planungsgrenzen aus',()=>{
  for(const service of craftServices)for(const id of service.equipment)assert.ok(craftEquipment.some(item=>item.id===id),`${service.id}: ${id}`);
  for(const item of craftEquipment){assert.ok(tradeGroups.some(group=>group.id===item.category));assert.ok(item.name);assert.ok(Number.isFinite(item.price)&&item.price>=0);assert.match(item.desc,/kein recherchierter Händlerpreis 2026/);}
  assert.equal(craftEquipment.find(item=>item.id==='craft_roofaccess').price,0);assert.match(craftEquipment.find(item=>item.id==='craft_roofaccess').desc,/offene Planungskosten/);
});
test('Der Fachkatalog besitzt für jede Tätigkeit eigene Aufmaßfragen und Angebotsgrundlagen',()=>{
  for(const service of craftServices){const knowledge=craftKnowledge(service.id);assert.equal(knowledge.serviceId,service.id);assert.ok(knowledge.summary.includes(service.name));assert.equal(knowledge.questions.length,4);assert.ok(knowledge.risks.length>=2);assert.ok(knowledge.offerNotes.length>=3);assert.match(knowledge.pricingBasis,/konkreter Leistungsumfang/);assert.match(knowledge.offerNotes.join(' '),/keine Marktpreis-, DIN- oder Ausführungsgarantie/);}
});
test('Elektro, Sanitär/Heizung/Klima, Dächer und Rückbau setzen fachliche Qualifikation voraus',()=>{
  assert.match(craftKnowledge('electrical_socket').risks.join(' '),/qualifizierte.*Fachbetriebe/);assert.match(craftKnowledge('electrical_check').questions.join(' '),/Eintragungen/);
  assert.match(craftKnowledge('sanitary_fixture').risks.join(' '),/Trinkwasser/);assert.match(craftKnowledge('climate_service').questions.join(' '),/Zertifizierungen/);assert.match(craftServices.find(service=>service.id==='climate_service').hint,/Zertifizierung/);
  assert.match(craftKnowledge('roof_repair').risks.join(' '),/Absturzrisiko/);assert.match(craftKnowledge('demolition_partition').risks.join(' '),/nicht tragend|tragend/);assert.match(craftKnowledge('demolition_surface').risks.join(' '),/Asbest/);
});
test('Montage schließt regulierte Fachanschlüsse nicht still ein',()=>{
  const kitchen=craftKnowledge('assemble_kitchen');assert.match(kitchen.risks.join(' '),/Elektro-, Gas- und Wasseranschlüsse/);assert.match(kitchen.summary,/Fachanschlüsse gesondert/);assert.match(craftKnowledge('metal_railing').questions.join(' '),/Statik/);
});
test('Universelle Leistung bleibt ein frei benennbarer Zeitauftrag ohne erfundenen Materialverbrauch',()=>{
  const service=craftServices.find(service=>service.id==='customwork');assert.equal(service.category,'custom');assert.equal(service.unit,'Std.');assert.equal(service.minutes,60);assert.match(service.name,/frei benennen/);assert.match(craftKnowledge('customwork').questions.join(' '),/konkrete Tätigkeit/);assert.match(craftKnowledge('customwork').risks.join(' '),/keine Ausführungsberechtigung/);assert.deepEqual(materialSuggestions('customwork',10),[]);
});
test('Unbekannte Leistungen erzeugen weder Wissensbehauptungen noch Materialmengen',()=>{
  for(const id of ['none','__proto__','constructor','']){assert.equal(craftKnowledge(id),null);assert.deepEqual(materialSuggestions(id,10),[]);}
});
test('Wissens- und Materialrückgaben halten keine veränderbaren Referenzen auf den Katalog',()=>{
  const knowledge=craftKnowledge('paint_wall');knowledge.questions.push('Verändert');knowledge.risks[0]='Verändert';assert.ok(!craftKnowledge('paint_wall').questions.includes('Verändert'));assert.ok(!craftKnowledge('paint_wall').risks.includes('Verändert'));
  const first=materialSuggestions('paint_wall',10);first[0].qty=999;first[0].name='Verändert';assert.equal(findMaterial('paint_wall','wallpaint',10).qty,2.2);assert.notEqual(findMaterial('paint_wall','wallpaint',10).name,'Verändert');
});
test('Materialempfehlungen haben positive Mengen, eindeutige IDs und ausdrückliche Verbrauchsannahmen',()=>{
  for(const service of craftServices){const materials=materialSuggestions(service.id,1);assert.equal(new Set(materials.map(item=>item.id)).size,materials.length);for(const item of materials){assert.ok(item.name);assert.ok(['L','kg','m²','m³','lfm','Stück','Set','Kartusche'].includes(item.unit));assert.ok(Number.isFinite(item.qty)&&item.qty>0,`${service.id}:${item.id}`);assert.match(item.note,/Mengenschlüssel/);assert.match(item.note,/Reserve|reserve/);assert.match(item.note,/Herstellerverbrauch/);assert.match(item.note,/Kein technischer oder DIN-Nachweis/);}}
});
test('Malerbedarf berücksichtigt Beschichtungsanzahl und zusätzliche Reserve sichtbar',()=>{
  const paint=findMaterial('paint_wall','wallpaint',100);assert.equal(paint.qty,22);assert.match(paint.note,/zwei Beschichtungen/);assert.match(paint.note,/10 %/);
  assert.equal(findMaterial('paint_ceiling','ceilingpaint',50).qty,13.2);assert.equal(findMaterial('paint_door','doorfinish',2).qty,1.32);
});
test('Trockenbau-Wandfläche zählt die vereinbarten beiden Beplankungsseiten',()=>{
  assert.equal(findMaterial('drywall_wall','wallboards',10).qty,22);assert.equal(findMaterial('drywall_ceiling','ceilingboards',10).qty,11);assert.match(findMaterial('drywall_wall','wallboards',10).note,/beidseitig/);assert.match(craftServices.find(service=>service.id==='drywall_wall').hint,/einseitig gemessene Wandfläche/);
});
test('Boden und Fliesen unterscheiden Nettofläche, Verschnitt und optionale Aufbauteile',()=>{
  assert.equal(findMaterial('floor_laminate','laminate',30).qty,33);assert.equal(findMaterial('floor_vinyl','vinyl',25).qty,27);assert.equal(findMaterial('tile_floor','floortiles',20).qty,22);assert.match(findMaterial('floor_vinyl','vinyladhesive',10).note,/bei Klickboden abwählen/);assert.match(findMaterial('floor_laminate','laminateunderlay',10).note,/integrierte Unterlage/);
});
test('Baustoffvolumen haben richtige m³-Einheiten und ausdrücklich genannte Beispielstärken',()=>{
  const base=findMaterial('paving_base','baseaggregate',100);assert.equal(base.unit,'m³');assert.equal(base.qty,23);assert.match(base.note,/20 cm/);assert.match(base.note,/Verdichtungsreserve/);
  const bedding=findMaterial('paving_edge','edgebedding',10);assert.equal(bedding.unit,'m³');assert.equal(bedding.qty,.33);assert.match(bedding.note,/Aufbauquerschnitt/);
});
test('Mörtel und Putz sind Produkt-/Dickenannahmen und keine DIN-Mengenbehauptungen',()=>{
  const plaster=findMaterial('plaster_interior','interiorplaster',10);assert.equal(plaster.qty,165);assert.match(plaster.note,/10 mm/);assert.match(plaster.note,/andere Produkte und Dicken neu berechnen/);
  const stone=findMaterial('masonry_wall','masonrystones',10);assert.equal(stone.qty,105);assert.match(stone.note,/0,50 × 0,20 m/);
});
test('Zählbare Bestellpositionen werden auf volle Einheiten aufgerundet',()=>{
  const seal=findMaterial('tile_seal','sealant',12);assert.equal(seal.qty,2);assert.equal(seal.unit,'Kartusche');assert.match(seal.note,/volle Beschaffungseinheiten/);
  assert.equal(findMaterial('assemble_door','doorset',1.1).qty,2);assert.equal(findMaterial('electrical_socket','socket',2).qty,2);
});
test('Zaunpfosten berücksichtigen den Endpfosten statt einer rein proportionalen Schätzung',()=>{
  assert.equal(findMaterial('wood_fence','fenceposts',2).qty,2);assert.equal(findMaterial('wood_fence','fenceposts',4).qty,3);assert.equal(findMaterial('wood_fence','fenceposts',10).qty,6);assert.match(findMaterial('wood_fence','fenceposts',10).note,/Endpfosten/);assert.match(findMaterial('wood_fence','fenceposts',10).note,/keine Fundamentplanung/);
});
test('Kundengestellte Geräte und Fertigteile werden nicht als verbrauchte Rohstoffe dargestellt',()=>{
  assert.match(findMaterial('assemble_kitchen','kitchenmodule',1).note,/Kundengestellung/);assert.match(findMaterial('electrical_light','light',1).note,/Kundengestellung/);assert.match(findMaterial('metal_railing','railing',5).note,/keinen Verschnitt für Fertigsysteme/);assert.equal(findMaterial('metal_railing','railing',5).qty,5);
});
test('Stunden und Rückbaufläche erfinden keine Ersatzteil-, Abfall- oder Schadstoffmengen',()=>{
  for(const service of craftServices.filter(service=>service.unit==='Std.'))assert.deepEqual(materialSuggestions(service.id,8),[]);
  for(const id of ['demolition_surface','demolition_partition'])assert.deepEqual(materialSuggestions(id,100),[]);
});
test('Ungültige Mengen oder automatische String-Konvertierung erzeugen keine Materialbestellung',()=>{
  for(const qty of [undefined,null,NaN,Infinity,-Infinity,-1,0,'10',1000001])assert.deepEqual(materialSuggestions('paint_wall',qty),[]);
});
test('Kleine bestätigte Maße ergeben positive, begrenzt aufgerundete Materialmengen',()=>{
  assert.equal(findMaterial('paint_wall','wallpaint',.001).qty,.001);assert.match(findMaterial('paint_wall','wallpaint',.001).note,/0,001 Materialeinheiten/);
  for(const service of craftServices)for(const item of materialSuggestions(service.id,.01))assert.ok(item.qty>0&&Number.isFinite(item.qty));
});
test('Mengenskalierung verändert flächenbezogene Mengen proportional ohne doppelte Reserve',()=>{
  const small=findMaterial('tile_floor','floortiles',10),large=findMaterial('tile_floor','floortiles',20);assert.equal(large.qty,small.qty*2);assert.equal(large.qty,22);
  assert.equal(findMaterial('wood_deck','deckboards',10).qty,11);assert.equal(findMaterial('paving_lay','pavers',10).qty,10.5);
});
