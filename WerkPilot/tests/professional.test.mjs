import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,calculate} from '../dist/core.js';
import {configuredRate,configuredTravelPrice,prepareAssistantDraft,priceForTargetMargin,mergeSiteDetails} from '../dist/professional.js';

const job=()=>({id:'job',lines:[{service:'lawn',qty:250,rate:.05},{service:'hedge',qty:15,rate:1}],factor:1.5,travelHours:.5,setupHours:.25,km:20,travelPrice:22.5,material:80,rental:100,disposal:38.08,taxMode:'small',tax:0});
test('Ein Angebot erreicht die Zielmarge auch mit hohen durchgereichten Zusatzkosten',()=>{
 const source=job(),copy=structuredClone(source),priced=priceForTargetMargin(source,defaults);
 assert.deepEqual(source,copy);assert.ok(priced.adjusted);assert.ok(priced.calc.margin>=defaults.targetMargin);
 for(const field of ['travelPrice','material','rental','disposal'])assert.equal(priced.job[field],source[field]);
 assert.ok(priced.job.lines.every((line,index)=>line.rate>=source.lines[index].rate));
});
test('Eine profitable Kalkulation behält ihre bereits hinterlegten Preise',()=>{
 const source={...job(),lines:[{service:'lawn',qty:250,rate:10}]};const priced=priceForTargetMargin(source,defaults);
 assert.equal(priced.adjusted,false);assert.deepEqual(priced.job.lines,source.lines);
});
test('Gespeicherte Kostenannahmen und Zielmarge haben Vorrang vor späteren Firmenänderungen',()=>{
 const source={...job(),costSettings:{hourlyCost:40,overhead:12,kmCost:.6,targetMargin:40}};
 const priced=priceForTargetMargin(source,{...defaults,targetMargin:5,hourlyCost:1});
 assert.ok(priced.calc.margin>=40);assert.equal(calculate(priced.job,defaults).net,priced.calc.net);
});
test('Ein versehentlicher Nullpreis wird im Sprachvorschlag kostenbasiert statt verlustbringend angeboten',()=>{
 const priced=priceForTargetMargin({...job(),lines:[{service:'lawn',qty:100,rate:0}]},defaults);
 assert.ok(priced.adjusted);assert.ok(priced.job.lines[0].rate>0);assert.ok(priced.calc.margin>=defaults.targetMargin);
});
test('Fahrtzeit und Kilometer ergeben getrennte Verkaufskomponenten',()=>{
 assert.equal(configuredTravelPrice({travelHours:.5,km:0},defaults),22.5);
 assert.equal(configuredTravelPrice({travelHours:.5,km:20},defaults),35.5);
});
test('Eine frische Sprachkalkulation übernimmt keine erfundenen Standardkilometer',()=>{
 const source={...job(),km:10,travelHours:.5,travelPrice:15};
 const result=prepareAssistantDraft(source,{lines:[{service:'tree',qty:8}],costs:{travelHours:.5,material:20,rental:30}},defaults);
 assert.equal(result.km,0);assert.equal(result.travelHours,.5);assert.equal(result.travelPrice,22.5);assert.equal(result.rental,30);assert.equal(result.material,20);assert.equal(result.disposal,0);
});
test('Kostenkorrekturen erhalten übrige Kosten und das bestehende Aufmaß',()=>{
 const previous=job(),result=prepareAssistantDraft(job(),{costOnly:true,costs:{material:25}},defaults,previous);
 assert.equal(result.material,25);assert.equal(result.rental,100);assert.equal(result.disposal,38.08);assert.deepEqual(result.lines,previous.lines);
});
test('Ein ausdrücklicher Fahrtpreis verdrängt die automatisch errechnete Pauschale',()=>{
 const result=prepareAssistantDraft(job(),{costs:{travelHours:.5,km:20,travelPrice:40}},defaults);
 assert.equal(result.travelPrice,40);assert.equal(configuredRate('tree',{serviceRates:{tree:90}}),90);
});
test('Widersprüchliche neue Maße entfernen den alten sicheren Maßwert',()=>{
 assert.deepEqual(mergeSiteDetails({treeHeight:8,access:'easy'},{uncertain:['treeHeight']}),{access:'easy',uncertain:['treeHeight']});
 assert.deepEqual(mergeSiteDetails({access:'easy',uncertain:['treeHeight']},{treeHeight:10}),{access:'easy',treeHeight:10});
});
