import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,migrateState,calculate,services} from '../dist/core.js';
import {createQuote,changeQuoteStatus,quoteSummary,quotePipeline} from '../dist/quotes.js';
import {validateBackup} from '../dist/backup.js';
const fixture=()=>{
 const company={...defaults,company:'Grün & Klar',owner:'Max Müller',address:'Wiesenweg 2, Berlin',quotePrefix:'ANG',quoteDays:30,nextQuoteNumber:1,website:'https://example.com',offerFooter:'Danke für Ihren Auftrag.',serviceRates:{lawn:1.25}};
 const customer={id:'customer-1',name:'Familie Schulz',address:'Gartenweg 1',email:'kunde@example.com',type:'Privatkunde',phone:'',notes:''};
 const job={id:'job-1',title:'Gartenpflege',customer:customer.id,status:'Angebot',date:'2020-10-10',time:'09:00',duration:2,lines:[{service:'lawn',qty:100,rate:1.25}],factor:1,travelHours:.5,setupHours:.25,km:10,travelPrice:15,material:5,disposal:10,rental:0,taxMode:'small',tax:0,photos:[],checks:[],notes:'Nur Gartenfläche',routeFrom:'Berlin',routeTo:'Mitte',actualTimeComplete:false,actualCostsComplete:false,siteDetails:{}};
 return {version:3,settings:company,customers:[customer],jobs:[job],invoices:[],quotes:[],expenses:[],owned:[],timeEntries:[],activeTimer:null,demo:false};
};
const make=(state=fixture(),extra={})=>createQuote(state,'job-1',{date:'2020-10-01',id:'quote-1',...extra});
const withQuote=(quote=make())=>{const state=fixture();state.quotes=[quote];return state};

test('Angebot wird ohne State-Mutation mit eigener Nummer und Gültigkeit erstellt',()=>{
 const state=fixture(),before=structuredClone(state),quote=make(state);
 assert.deepEqual(state,before);
 assert.equal(quote.number,'ANG-2020-0001');assert.equal(quote.validUntil,'2020-10-31');assert.equal(quote.status,'draft');assert.equal(quote.events[0].status,'draft');assert.equal(quote.sequence,1);
});
test('Angebot friert Kunde, Firmendaten, Preise, Kosten und Zusatzpositionen ein',()=>{
 const state=fixture(),quote=make(state),saved=structuredClone(quote);
 state.jobs[0].lines[0].qty=999;state.jobs[0].travelPrice=999;state.customers[0].name='Geändert';state.settings.company='Andere Firma';state.settings.serviceRates.lawn=10;
 assert.deepEqual(quote,saved);
 quote.job.lines[0].qty=5;assert.equal(state.jobs[0].lines[0].qty,999);
});
test('Bestehender Entwurf wird unverändert und ohne zweite Nummer wiederverwendet',()=>{
 const state=fixture();const original=make(state);state.quotes.push(original);state.jobs[0].lines[0].rate=999;
 const reused=createQuote(state,'job-1',{date:'2020-10-02'});
 assert.deepEqual(reused,original);assert.notEqual(reused,original);assert.equal(state.quotes.length,1);
});
test('Versendete und angenommene Angebote verhindern einen zweiten aktiven Stand',()=>{
 for(const status of ['sent','accepted']){let quote=changeQuoteStatus(make(),'sent',{date:'2020-10-02'});if(status==='accepted')quote=changeQuoteStatus(quote,'accepted',{date:'2020-10-03'});assert.throws(()=>make(withQuote(quote),{id:'quote-2'}),/bereits/);}
});
test('Nach Ablehnung entsteht neues Angebot mit neuer Nummer und ohne Historienverlust',()=>{
 const old=changeQuoteStatus(make(),'declined',{date:'2020-10-02'}),state=withQuote(old),next=make(state,{date:'2020-10-03',id:'quote-2'});
 assert.equal(next.sequence,2);assert.equal(next.number,'ANG-2020-0002');assert.equal(state.quotes[0].id,old.id);assert.equal(state.quotes[0].status,'declined');
});
test('Nummernkreis berücksichtigt alte Nummern, Einstellungen und Jahreswechsel',()=>{
 const old=changeQuoteStatus(make(),'declined',{date:'2020-10-02'}),state=withQuote(old);state.settings.nextQuoteNumber=10;
 const next=make(state,{date:'2021-01-01',id:'quote-2'});assert.equal(next.number,'ANG-2021-0010');
 state.settings.nextQuoteNumber=1;state.quotes[0].sequence=9;state.quotes[0].number='ANG-2020-0009';assert.equal(make(state,{id:'quote-2'}).sequence,10);
});
test('Kennungen, Präfix, Leistungsumfang und Gültigkeitsdaten werden geprüft',()=>{
 const state=fixture();assert.throws(()=>make(state,{id:'"><img'}),/kennung/i);assert.throws(()=>make(state,{date:'2020-02-30'}),/Kalenderdatum/);assert.throws(()=>make(state,{validUntil:'2020-09-30'}),/ablaufen/);
 state.settings.quotePrefix='<ANG>';assert.throws(()=>make(state),/präfix/);state.settings.quotePrefix='ANG';state.jobs[0].lines[0].service='unknown';assert.throws(()=>make(state),/Leistungsumfang/);
});
test('Statuswechsel bewahrt Snapshot und protokolliert Datum und Kundenrückmeldung',()=>{
 const draft=make(),sent=changeQuoteStatus(draft,'sent',{date:'2020-10-02',note:'PDF persönlich übergeben'}),accepted=changeQuoteStatus(sent,'accepted',{date:'2020-10-03',note:'Kunde bestätigt'});
 assert.equal(draft.status,'draft');assert.equal(sent.status,'sent');assert.equal(accepted.status,'accepted');assert.deepEqual(accepted.calc,draft.calc);assert.equal(accepted.events.length,3);assert.equal(accepted.events[2].note,'Kunde bestätigt');
});
test('Direkte Annahme und Änderungen abgeschlossener Angebote werden verhindert',()=>{
 const draft=make();assert.throws(()=>changeQuoteStatus(draft,'accepted',{date:'2020-10-02'}),/status/i);
 const accepted=changeQuoteStatus(changeQuoteStatus(draft,'sent',{date:'2020-10-02'}),'accepted',{date:'2020-10-03'});assert.throws(()=>changeQuoteStatus(accepted,'declined',{date:'2020-10-04'}),/status/i);
 const declined=changeQuoteStatus(draft,'declined',{date:'2020-10-02'});assert.throws(()=>changeQuoteStatus(declined,'draft',{date:'2020-10-03'}),/status/i);
});
test('Statusdaten bleiben chronologisch und gleiche Aktion erzeugt keinen doppelten Eintrag',()=>{
 const sent=changeQuoteStatus(make(),'sent',{date:'2020-10-05'});assert.throws(()=>changeQuoteStatus(sent,'accepted',{date:'2020-10-04'}),/letzten/);assert.throws(()=>changeQuoteStatus(sent,'declined',{date:'2020-02-30'}),/Kalenderdatum/);assert.deepEqual(changeQuoteStatus(sent,'sent',{date:'2020-10-06'}),sent);
});
test('Am letzten Gültigkeitstag ist Annahme möglich, danach erfordert sie neues Angebot',()=>{
 const sent=changeQuoteStatus(make(),'sent',{date:'2020-10-02'});assert.equal(changeQuoteStatus(sent,'accepted',{date:'2020-10-31'}).status,'accepted');assert.throws(()=>changeQuoteStatus(sent,'accepted',{date:'2020-11-01'}),/abgelaufen/);assert.equal(changeQuoteStatus(sent,'declined',{date:'2020-11-01'}).status,'declined');
});
test('Pipeline trennt Angebotsvolumen von Umsatz und führt abgelaufene Angebote auf',()=>{
 const sent=changeQuoteStatus(make(),'sent',{date:'2020-10-02'}),pipeline=quotePipeline([sent],'2020-10-05');assert.equal(pipeline.openNet,sent.calc.net);assert.equal(pipeline.followUps.length,1);assert.equal(pipeline.acceptedNet,0);
 const expired=quotePipeline([sent],'2020-11-01');assert.equal(expired.openNet,0);assert.equal(expired.expired,1);assert.equal(quoteSummary(sent,'2020-10-31').expired,false);
});
test('Versionsmigration behält Angebote und ergänzt leere Angebote für alte Betriebe',()=>{
 for(const version of [1,2]){const old=fixture();old.version=version;delete old.quotes;const migrated=migrateState(old);assert.equal(migrated.version,3);assert.deepEqual(migrated.quotes,[]);assert.equal(old.quotes,undefined);}
 const state=withQuote();assert.deepEqual(migrateState(state).quotes,state.quotes);
});
test('Sicherung erhält eingefrorene Angebotspreise trotz später geändertem Live-Auftrag',()=>{
 const state=withQuote();state.jobs[0].lines[0].rate=99;state.settings.company='Neuer Firmenname';const restored=validateBackup(state);
 assert.equal(restored.version,3);assert.equal(restored.quotes[0].job.lines[0].rate,1.25);assert.equal(restored.quotes[0].company.company,'Grün & Klar');assert.equal(restored.quotes[0].calc.net,state.quotes[0].calc.net);assert.equal(restored.quotes[0].job.routeFrom,'Berlin');
});
test('Sicherung prüft Angebotsreferenzen, Nummern, Beträge und Statushistorie gemeinsam',()=>{
 const original=withQuote();
 for(const mutate of [state=>state.quotes[0].jobId='missing',state=>state.quotes[0].number='ANG-2020-0099',state=>state.quotes[0].calc.net+=1,state=>state.quotes[0].status='accepted',state=>state.quotes[0].events[0].status='sent',state=>state.quotes[0].validUntil='2020-02-30',state=>state.quotes[0].job.customer='wrong']){const changed=structuredClone(original);mutate(changed);assert.throws(()=>validateBackup(changed),/Sicherung/);}
 assert.deepEqual(original.quotes[0],make());
});
test('Mehrere aktive oder doppelte Angebote werden vor Wiederherstellung abgewiesen',()=>{
 const state=withQuote();state.quotes.push({...structuredClone(state.quotes[0]),id:'quote-2',sequence:2,number:'ANG-2020-0002'});assert.throws(()=>validateBackup(state),/aktive Angebote/);
 state.quotes[1].status='declined';state.quotes[1].events.push({status:'declined',date:'2020-10-02',note:''});state.quotes[1].number=state.quotes[0].number;assert.throws(()=>validateBackup(state),/Nummer|doppelte/);
});
test('Preisvorlagen, Angebotsfuß, Webseite und Anfahrtsverkaufssätze bleiben im Backup erhalten',()=>{
 const state=fixture();state.settings.travelHourlyRate=60;state.settings.travelKmRate=.8;const restored=validateBackup(state);assert.deepEqual(restored.settings.serviceRates,{lawn:1.25});assert.equal(restored.settings.offerFooter,state.settings.offerFooter);assert.equal(restored.settings.website,state.settings.website);assert.equal(restored.settings.travelHourlyRate,60);assert.equal(restored.settings.travelKmRate,.8);
 for(const mutate of [state=>state.settings.serviceRates.unknown=1,state=>state.settings.serviceRates.lawn=-1,state=>state.settings.quoteDays=0,state=>state.settings.nextQuoteNumber=1.5,state=>state.settings.travelKmRate=101]){const bad=fixture();mutate(bad);assert.throws(()=>validateBackup(bad),/Sicherung/);}
});
test('Baumpflege liefert bestätigungsbedürftige Stückkalkulation und passende Geräte',()=>{
 const service=services.find(service=>service.id==='tree');assert.equal(service.unit,'Stück');assert.match(service.hint,/Startannahme|Unverbindliche/);assert.match(service.hint,/Keine Fällung/);const calc=calculate({...fixture().jobs[0],lines:[{service:'tree',qty:8,rate:75}],travelHours:.5,setupHours:0,travelPrice:22.5,material:0,disposal:0});assert.equal(calc.serviceNet,600);assert.equal(calc.hours,8.5);assert.equal(calc.net,622.5);
});
test('Baumfällung ist von Pflegerückschnitt getrennt und nennt nur anpassbare Planungswerte',()=>{
 const felling=services.find(service=>service.id==='felling'),greenhaul=services.find(service=>service.id==='greenhaul');
 assert.equal(felling.unit,'Stück');assert.equal(felling.rate,300);assert.equal(felling.minutes,240);assert.match(felling.hint,/keine recherchierten regionalen Marktpreise/);assert.match(felling.hint,/Qualifikation/);
 assert.equal(greenhaul.unit,'m³');assert.equal(greenhaul.rate,80);assert.match(greenhaul.hint,/Entsorgungsgebühren separat/);assert.ok(felling.equipment.includes('chainsawppe'));
});
test('Formales Fällungsangebot friert Maschinen-, Transport- und separat bestätigte Entsorgungskosten ein',()=>{
 const state=fixture();state.jobs[0].lines=[{service:'felling',qty:2,rate:300},{service:'greenhaul',qty:3,rate:80}];state.jobs[0].travelHours=.5;state.jobs[0].setupHours=.25;state.jobs[0].travelPrice=22.5;state.jobs[0].material=0;state.jobs[0].disposal=21;state.jobs[0].rental=100;
 const quote=make(state);assert.equal(quote.calc.serviceNet,840);assert.equal(quote.calc.net,983.5);assert.equal(quote.calc.hours,11.75);
 state.jobs[0].rental=999;state.jobs[0].disposal=999;state.settings.disposalRate=200;assert.equal(quote.calc.net,983.5);assert.equal(quote.job.rental,100);assert.equal(quote.job.disposal,21);
 const restored=validateBackup({...state,quotes:[quote]});assert.equal(restored.quotes[0].calc.net,983.5);
});
test('Unbekannter Entsorgungstarif wird nicht automatisch als amtlich bestätigte Gebühr berechnet',()=>{
 assert.equal(defaults.disposalRate,0);const state=fixture();state.jobs[0].lines=[{service:'felling',qty:2,rate:300}];state.jobs[0].disposal=0;state.jobs[0].material=0;state.jobs[0].travelPrice=0;state.settings.disposalRate=123;
 assert.equal(make(state).calc.net,600);assert.equal(make(state).job.disposal,0);
});
test('Region, Einsatzgebiet und bestätigte Planungsraten werden ohne Vermischung der Snapshots übernommen',()=>{
 const state=withQuote();state.settings.homeBase='Andere Stadt';state.settings.serviceArea='Anderes Gebiet';state.settings.region='Sachsen';state.settings.disposalRate=12;state.settings.transportHourlyRate=70;
 const restored=validateBackup(state);assert.equal(restored.settings.homeBase,'Andere Stadt');assert.equal(restored.settings.transportHourlyRate,70);assert.equal(restored.quotes[0].company.homeBase,'96268 Mitwitz');assert.equal(restored.quotes[0].company.region,'Bayern');assert.equal(restored.quotes[0].company.disposalRate,0);
});
test('Ungültige regionale Raten und überlange Gebietsangaben werden vor Wiederherstellung erkannt',()=>{
 for(const mutate of [state=>state.settings.disposalRate=-1,state=>state.settings.transportHourlyRate=Infinity,state=>state.settings.homeBase='X'.repeat(201),state=>state.settings.serviceArea='X'.repeat(501)]){const state=fixture();mutate(state);assert.throws(()=>validateBackup(state),/Sicherung/);}
});
test('Vor-Ort-Angaben bleiben als eigenes unveränderliches Angebots-Aufmaß gespeichert',()=>{
 const state=fixture();state.jobs[0].siteDetails={treeHeight:12,trunkDiameter:45,greenVolume:3,access:'limited',siteInspected:true,qualifiedWorkers:true,permissionsChecked:false,safetyPlanConfirmed:false};
 const quote=make(state);state.jobs[0].siteDetails.treeHeight=99;state.jobs[0].siteDetails.permissionsChecked=true;
 const restored=validateBackup({...state,quotes:[quote]});assert.equal(restored.jobs[0].siteDetails.treeHeight,99);assert.equal(restored.quotes[0].job.siteDetails.treeHeight,12);assert.equal(restored.quotes[0].job.siteDetails.permissionsChecked,false);assert.equal(restored.quotes[0].job.siteDetails.access,'limited');
});
test('Unvollständig geprüfte Fällungsentwürfe sind importierbar und behalten offene Angaben',()=>{
 const state=fixture();state.jobs[0].lines=[{service:'felling',qty:2,rate:300}];state.jobs[0].siteDetails={access:'unknown',permissionsChecked:false};state.quotes=[make(state)];
 const restored=validateBackup(state);assert.deepEqual(restored.quotes[0].job.siteDetails,{access:'unknown',permissionsChecked:false});assert.equal(restored.quotes[0].status,'draft');
});
test('Fehlende Vor-Ort-Daten werden bei Migration mit leerem Aufmaß ergänzt',()=>{
 const state=fixture();delete state.jobs[0].siteDetails;const migrated=migrateState(state);assert.deepEqual(migrated.jobs[0].siteDetails,{});assert.equal(state.jobs[0].siteDetails,undefined);assert.deepEqual(validateBackup(state).jobs[0].siteDetails,{});
});
test('Ungültige Maße, Zugänglichkeit und Wahrheitswerte werden sicher verworfen',()=>{
 for(const siteDetails of [{treeHeight:0},{treeHeight:101},{trunkDiameter:501},{greenVolume:-1},{greenVolume:10001},{access:'unrestricted'},{siteInspected:'true'},{qualifiedWorkers:1},{permissionsChecked:null},{safetyPlanConfirmed:[]}]){const state=fixture();state.jobs[0].siteDetails=siteDetails;assert.throws(()=>validateBackup(state),/Sicherung/);}
 const state=fixture();state.jobs[0].siteDetails={treeHeight:10,unknown:'discard'};assert.deepEqual(validateBackup(state).jobs[0].siteDetails,{treeHeight:10});
});
test('Entwurf und versendetes Angebot können zur Überarbeitung zurückgezogen werden',()=>{
 const draft=make(),withdrawnDraft=changeQuoteStatus(draft,'withdrawn',{date:'2020-10-02',note:'Aufmaß vervollständigen'}),sent=changeQuoteStatus(draft,'sent',{date:'2020-10-02'}),withdrawnSent=changeQuoteStatus(sent,'withdrawn',{date:'2020-10-03',note:'Preis korrigieren'});
 assert.equal(withdrawnDraft.status,'withdrawn');assert.equal(withdrawnSent.status,'withdrawn');assert.equal(draft.status,'draft');assert.equal(sent.status,'sent');assert.equal(withdrawnSent.events.at(-1).note,'Preis korrigieren');
});
test('Überarbeitetes Angebot erhält neue Nummer und bewahrt zurückgezogenen Leistungsstand',()=>{
 const state=fixture(),original=make(state),withdrawn=changeQuoteStatus(original,'withdrawn',{date:'2020-10-02'});state.quotes=[withdrawn];state.jobs[0].lines[0].rate=2;state.jobs[0].siteDetails={treeHeight:10};
 const revision=make(state,{date:'2020-10-03',id:'quote-2'});state.quotes.push(revision);
 assert.equal(revision.number,'ANG-2020-0002');assert.equal(revision.job.lines[0].rate,2);assert.equal(state.quotes[0].job.lines[0].rate,1.25);assert.equal(state.quotes[0].status,'withdrawn');assert.equal(state.quotes[0].events.at(-1).status,'withdrawn');
 const restored=validateBackup(state);assert.equal(restored.quotes.length,2);assert.equal(restored.quotes[0].number,'ANG-2020-0001');assert.equal(restored.quotes[0].status,'withdrawn');assert.equal(restored.quotes[1].number,'ANG-2020-0002');assert.equal(restored.quotes[1].status,'draft');
});
test('Annahme bleibt abgeschlossen und zurückgezogene Angebote werden nicht wieder aktiviert',()=>{
 const sent=changeQuoteStatus(make(),'sent',{date:'2020-10-02'}),accepted=changeQuoteStatus(sent,'accepted',{date:'2020-10-03'}),withdrawn=changeQuoteStatus(sent,'withdrawn',{date:'2020-10-03'});
 assert.throws(()=>changeQuoteStatus(accepted,'withdrawn',{date:'2020-10-04'}),/status/i);assert.throws(()=>changeQuoteStatus(withdrawn,'sent',{date:'2020-10-04'}),/status/i);assert.deepEqual(changeQuoteStatus(withdrawn,'withdrawn',{date:'2020-10-04'}),withdrawn);
});
test('Zurückziehen zur Überarbeitung zählt nicht als Kundenabsage in der Abschlussquote',()=>{
 const sent=changeQuoteStatus(make(),'sent',{date:'2020-10-02'}),accepted=changeQuoteStatus(sent,'accepted',{date:'2020-10-03'}),withdrawn=changeQuoteStatus(sent,'withdrawn',{date:'2020-10-03'}),pipeline=quotePipeline([accepted,withdrawn],'2020-10-04');
 assert.equal(pipeline.accepted,1);assert.equal(pipeline.declined,0);assert.equal(pipeline.withdrawn,1);assert.equal(pipeline.conversionRate,100);assert.equal(pipeline.open,0);assert.equal(pipeline.byStatus.withdrawn.count,1);
});
test('Wiederherstellung erlaubt keine manipulierte Rücknahme eines angenommenen Angebots',()=>{
 const quote=changeQuoteStatus(changeQuoteStatus(make(),'sent',{date:'2020-10-02'}),'accepted',{date:'2020-10-03'}),state=withQuote(quote);
 state.quotes[0].status='withdrawn';state.quotes[0].events.push({status:'withdrawn',date:'2020-10-04',note:'Manipulierter Wechsel'});assert.throws(()=>validateBackup(state),/unzulässigen Statuswechsel/);
});
