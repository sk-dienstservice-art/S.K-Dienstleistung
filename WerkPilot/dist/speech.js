// Local German command interpretation. No inference service or model download.
export function normalizeSpeech(text){return String(text??'').toLowerCase().normalize('NFKC').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/(?<![a-z])m\s*(?:³|3)\b/g,'kubikmeter').replace(/\b(?:cbm|kubik\s+metern?)\b/g,'kubikmeter').replace(/(?<![a-z])(?:qm|quadrat\s*meter|square meter)\b/g,'quadratmeter').replace(/m\s*(?:²|2)\b/g,'quadratmeter').replace(/\b(haecken|heken|haecke)\b/g,'hecke').replace(/\b(maeen|maen)\b/g,'maehen').replace(/\b(buero|buro)\b/g,'buero').replace(/\b(dreiviertel|viertel|halbe?)stunden?\b/g,'$1 stunde').replace(/(\d)(quadratmeter|meter|lfm|etage|stunden?|minuten?|std|stueck|baeume|baeumen|baum|tuere[n]?|tuer|kuechenmodule?|kuechenschraenke?|kueche[n]?|steckdose[n]?|leuchte[n]?|lampe[n]?|armatur(?:en)?|waschbecken|toilette[n]?|wc|kubikmeter|kilometer|km|m(?=\s|$))/g,'$1 $2').replace(/[!?;:]/g,' ').replace(/\s+/g,' ').trim()}
const germanSmall={null:0,ein:1,eins:1,eine:1,einen:1,einem:1,einer:1,zwei:2,zwo:2,drei:3,vier:4,fuenf:5,sechs:6,sieben:7,acht:8,neun:9,zehn:10,elf:11,zwoelf:12,dreizehn:13,vierzehn:14,fuenfzehn:15,sechzehn:16,siebzehn:17,achtzehn:18,neunzehn:19,zwanzig:20,dreissig:30,vierzig:40,fuenfzig:50,sechzig:60,siebzig:70,achtzig:80,neunzig:90};
function integerWords(s){if(!s)return 0;if(/^\d+$/.test(s))return Number(s);if(s in germanSmall)return germanSmall[s];for(const [word,value]of [['tausend',1000],['hundert',100]]){const index=s.indexOf(word);if(index>=0){const left=s.slice(0,index),right=s.slice(index+word.length).replace(/^und/,'');const a=left?integerWords(left):1,b=right?integerWords(right):0;return a===null||b===null||a<=0||a>=(value===100?10:1000)||b>=value?null:a*value+b}}const i=s.indexOf('und');if(i>0){const left=integerWords(s.slice(0,i)),right=integerWords(s.slice(i+3));if(left!==null&&right!==null&&left<10&&right>=20)return left+right}return null}
export function parseGermanNumber(raw){let t=normalizeSpeech(raw).trim();if(!t)return null;if(/^minus\s+/.test(t)){const n=parseGermanNumber(t.replace(/^minus\s+/,''));return n===null?null:-n}if(/^-\d/.test(t)){const n=parseGermanNumber(t.slice(1));return n===null?null:-n}if(/^(anderthalb(?:e|en|er|em)?|eineinhalb(?:e|en|er|em)?)$/.test(t.replace(/\s/g,'')))return 1.5;if(/^(?:ein(?:e|en|er|em)?\s+)?halb(?:e|en|er|em|es)?$/.test(t))return .5;if(/^(?:ein(?:e|en|er|em)?\s+)?(?:drei\s*viertel|dreiviertel)$/.test(t))return .75;if(/^(?:ein(?:e|en|er|em)?\s+)?viertel$/.test(t))return .25;const half=t.replace(/[\s-]/g,'').match(/^(.+)einhalb$/);if(half){const n=integerWords(half[1]);if(n!==null)return n+.5}if(/^\d+(?:[.,]\d+)*$/.test(t)){if(/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(t))t=t.replaceAll('.','');return /^\d+(?:[.,]\d+)?$/.test(t)?Number(t.replace(',','.')):null}const decimal=t.split(/\s*komma\s*/);if(decimal.length>2)return null;const whole=integerWords(decimal[0].replace(/[\s-]/g,''));if(whole===null)return null;if(decimal.length===1)return whole;const fraction=decimal[1].trim().split(/[\s-]+/).filter(Boolean);let digits='';for(const token of fraction){const n=/^\d+$/.test(token)?Number(token):integerWords(token);if(n===null||n>99)return null;digits+=String(n)}return digits?Number(whole+'.'+digits):null}
export function quantitiesFromSpeech(text){const t=normalizeSpeech(text),out=[],unitPattern=/\b(kubikmeter|quadratmeter|laufende(?:n|r)?\s+meter|lfm|meter|m|etagen?|stockwerke?|stunden?|std\.?|minuten?|min\.?|stueck|baeume|baeumen|baum|tuere[n]?|tuer|kuechenmodule?|kuechenschraenke?|kueche[n]?|steckdose[n]?|leuchte[n]?|lampe[n]?|armatur(?:en)?|waschbecken|toilette[n]?|wc|kilometer|km|euros?|eur)\b|€/g;let match;while((match=unitPattern.exec(t))){const before=t.slice(0,match.index).trimEnd(),tokens=before.split(/\s+/);let qty=null,start=match.index;for(let count=Math.min(9,tokens.length);count>=1;count--){const candidate=tokens.slice(-count).join(' '),n=parseGermanNumber(candidate);if(n!==null){qty=n;start=before.length-candidate.length;break}}if(qty===null)continue;const word=match[1]||match[0],unit=word==='kubikmeter'?'m³':word==='quadratmeter'?'m²':/^(?:kilometer|km)$/.test(word)?'km':/^(?:euros?|eur|€)$/.test(word)?'€':/stueck|baum|baeum|tuer|kueche|steckdose|leuchte|lampe|armatur|waschbecken|toilette|^wc$/.test(word)?'Stück':/meter|^m$|lfm/.test(word)?'lfm':/etage|stockwerk/.test(word)?'Etage':/^min/.test(word)?'Min.':'Std.';const prefix=t.slice(Math.max(0,start-18),start),suffix=t.slice(match.index+match[0].length,match.index+match[0].length+18);const dimension=/(?:hoehe|hoch|breite|durchmesser|bhd)\s*$/.test(prefix)||/^\s*(?:hoch|hoehe|breit|durchmesser)\b/.test(suffix);out.push({qty,unit,start,end:match.index+match[0].length,dimension})}return out}
// Concrete trade work is matched independently of catalogue prices. Shared
// nouns such as Wand/Decke only match when the requested action is present.
const speechTradePatterns=[
 ['paint_wall',/\b(?:wand|waende|waenden|wandanstrich\w*)\b/,/streich\w*|anstrich\w*|maler\w*/],
 ['paint_ceiling',/\b(?:decke[n]?|deckenanstrich\w*)\b/,/streich\w*|anstrich\w*|maler\w*/],
 ['paint_door',/\b(?:tuer|tuere|tueren|tuerlack\w*)\b/,/lackier\w*|streich\w*|anstrich\w*|lack\w*/],
 ['drywall_wall',/\b(?:trockenbauwand\w*|rigipswand\w*|gipskartonwand\w*|wand|waende|waenden)\b/,/trockenbau\w*|rigips\w*|gipskarton\w*/],
 ['drywall_ceiling',/\b(?:trockenbaudecke\w*|rigipsdecke\w*|gipskartondecke\w*|decke[n]?)\b/,/trockenbau\w*|rigips\w*|gipskarton\w*|ab(?:ge)?haeng\w*/],
 ['drywall_spackle',/\b(?:spachtel\w*|verspachtel\w*)\b/],
 ['floor_laminate',/\blaminat\w*\b/],
 ['floor_vinyl',/\b(?:vinyl\w*|designboden\w*)\b/],
 ['floor_skirting',/\b(?:sockelleiste[n]?|fussleiste[n]?|fussbodenleiste[n]?)\b/],
 ['tile_floor',/\b(?:bodenfliese[n]?|fliesenboden\w*|fussboden\w*|boden)\b/,/fliese\w*|fliesen\w*|keramik\w*/],
 ['tile_wall',/\b(?:wandfliese[n]?|fliesenwand\w*|wand|waende|waenden)\b/,/fliese\w*|fliesen\w*|keramik\w*/],
 ['tile_seal',/\b(?:silikonfuge[n]?|silikon\w*|dichtfuge[n]?|fuge[n]?)\b/,/silikon\w*|dichtfuge\w*/],
 ['masonry_wall',/\b(?:mauer\w*|mauerwerk\w*)\b/],
 ['masonry_repair',/\b(?:mauer\w*|mauerwerk\w*)\b/,/repar\w*|ausbesser\w*|instandsetz\w*|schad\w*/],
 ['masonry_joint',/\b(?:mauerfuge[n]?|klinkerfuge[n]?|verfug\w*|fuge[n]?)\b/,/mauer\w*|klinker\w*|ziegel\w*/],
 ['plaster_interior',/\b(?:innenputz\w*|innenwand\w*|innenwaend\w*|verputz\w*|wand|waende|waenden)\b/,/putz\w*|verputz\w*/],
 ['plaster_facade',/\b(?:fassade\w*|aussenputz\w*|aussenwand\w*|aussenwaend\w*)\b/,/putz\w*|verputz\w*/],
 ['plaster_patch',/\b(?:putz\w*|verputz\w*)\b/,/repar\w*|ausbesser\w*|instandsetz\w*|flick\w*|schad\w*/],
 ['paving_lay',/\b(?:pflaster\w*|pflasterung\w*)\b/],
 ['paving_base',/\b(?:pflasterunterbau\w*|pflasterbett\w*|unterbau\w*|schotterbett\w*|frostschutzschicht\w*|tragschicht\w*)\b/,/pflaster\w*|terrasse\w*|weg\w*/],
 ['paving_edge',/\b(?:randstein\w*|bordstein\w*|kantenstein\w*|randeinfassung\w*)\b/],
 ['wood_deck',/\b(?:holzterrasse\w*|terrassendiele[n]?|holzdeck\w*)\b/],
 ['wood_fence',/\b(?:holzzaun\w*|holzzaeun\w*|lattenzaun\w*|zaun\w*|zaeun\w*)\b/,/holz\w*|latten\w*/],
 ['wood_repair',/\bholz\w*\b/,/repar\w*|ausbesser\w*|instandsetz\w*/],
 ['assemble_furniture',/\b(?:moebel\w*|schrank\w*|regal\w*)\b/,/montier\w*|montage\w*|aufbau\w*|aufbauen\w*|zusammenbau\w*/],
 ['assemble_kitchen',/\bkueche\w*\b/,/montier\w*|montage\w*|aufbau\w*|einbau\w*/],
 ['assemble_door',/\b(?:tuer|tuere|tueren|tuereinbau\w*|tuermontage\w*)\b/,/montier\w*|montage\w*|einbau\w*|einsetz\w*|austausch\w*|erset\w*/],
 ['metal_fence',/\b(?:metallzaun\w*|stahlzaun\w*|gitterzaun\w*|zaun\w*|zaeun\w*)\b/,/metall\w*|stahl\w*|gitter\w*/],
 ['metal_railing',/\b(?:gelaender\w*|metallgelaender\w*|stahlgelaender\w*)\b/,/metall\w*|stahl\w*/],
 ['metal_repair',/\bmetall\w*\b/,/repar\w*|instandsetz\w*|schweiss\w*/],
 ['electrical_socket',/\bsteckdose\w*\b/],
 ['electrical_light',/\b(?:leuchte[n]?|lampe[n]?|leuchtenmontage\w*|lampenmontage\w*)\b/],
 ['electrical_check',/\b(?:elektro\w*|elektrik\w*|e[\s-]?check)\b/,/pruef\w*|check\w*|inspek\w*|mess\w*/],
 ['sanitary_fixture',/\b(?:armatur\w*|waschbecken\w*|wc|toilette[n]?|sanitaermontage\w*)\b/],
 ['heating_service',/\b(?:heizung\w*|heizkessel\w*|heizungsservice\w*)\b/,/wart\w*|service\w*|inspek\w*/],
 ['climate_service',/\b(?:klima\w*|klimaanlage\w*|klimageraet\w*)\b/,/wart\w*|service\w*|inspek\w*/],
 ['roof_repair',/\bdach\w*\b/,/repar\w*|ausbesser\w*|instandsetz\w*|flick\w*|schad\w*/],
 ['gutter_clean',/\b(?:dachrinne[n]?|regenrinne[n]?|rinnenreinigung\w*)\b/,/reinig\w*|saeuber\w*|sauber\w*/],
 ['gutter_install',/\b(?:dachrinne[n]?|regenrinne[n]?|rinnenmontage\w*)\b/,/montier\w*|montage\w*|einbau\w*|erset\w*|austausch\w*|installier\w*/],
 ['demolition_surface',/\b(?:belag\w*|bodenbelag\w*|laminat\w*|vinyl\w*|wandfliese[n]?|bodenfliese[n]?|fliese[n]?|tapete[n]?)\b/,/entfern\w*|rueckbau\w*|abriss\w*|abbruch\w*|abbau\w*/],
 ['demolition_partition',/\b(?:trennwand\w*|trockenbauwand\w*|wand|waende|waenden)\b/,/rueckbau\w*|abriss\w*|abbruch\w*|abbrech\w*|entfern\w*/],
 ['demolition_sort',/\b(?:bauschutt\w*|bauabfall\w*|rueckbaumaterial\w*|abbruchmaterial\w*)\b/,/sortier\w*|trenn\w*|sammel\w*|aufraeum\w*/],
 ['customwork',/\b(?:sonderarbeit\w*|individuelle\s+arbeit\w*|regiearbeit\w*|stundenlohnarbeit\w*|zusatzarbeit\w*)\b/]
];
const genericTradeRequests=[
 [/\b(?:wand|waende|waenden|decke[n]?)\b/,['paint_wall','paint_ceiling','drywall_wall','drywall_ceiling','tile_wall','plaster_interior','demolition_partition']],
 [/\b(?:tuer|tuere|tueren)\b/,['paint_door','assemble_door']],
 [/\b(?:moebel\w*|kueche\w*)\b/,['assemble_furniture','assemble_kitchen']],
 [/\bholz\w*\b/,['wood_deck','wood_fence','wood_repair']],
 [/\b(?:streich\w*|maler\w*|anstrich\w*|lackier\w*)\b/,['paint_wall','paint_ceiling','paint_door']],
 [/\b(?:trockenbau\w*|rigips\w*|gipskarton\w*)\b/,['drywall_wall','drywall_ceiling','drywall_spackle','demolition_partition']],
 [/\b(?:fliese[n]?|fliesenarbeit\w*|fliesenverleg\w*)\b/,['tile_floor','tile_wall','tile_seal','demolition_surface']],
 [/\b(?:elektro\w*|elektrik\w*|elektrisch\w*|steckdose\w*)\b/,['electrical_socket','electrical_light','electrical_check']],
 [/\bsanitaer\w*\b/,['sanitary_fixture']],
 [/\bheizung\w*\b/,['heating_service']],
 [/\bklima\w*\b/,['climate_service']],
 [/\b(?:dacharbeit\w*|dachdecker\w*|dach)\b/,['roof_repair','gutter_clean','gutter_install']],
 [/\b(?:verputz\w*|putzarbeit\w*)\b/,['plaster_interior','plaster_facade','plaster_patch']],
 [/\b(?:bodenarbeit\w*|bodenverleg\w*|bodenbelag\w*)\b/,['floor_laminate','floor_vinyl','floor_skirting','tile_floor','demolition_surface']],
 [/\b(?:zaun|zaeune|gelaender)\b/,['wood_fence','metal_fence','metal_railing']]
];
const tradeSpeechUnits={paint_wall:'m²',paint_ceiling:'m²',paint_door:'Stück',drywall_wall:'m²',drywall_ceiling:'m²',drywall_spackle:'m²',floor_laminate:'m²',floor_vinyl:'m²',floor_skirting:'lfm',tile_floor:'m²',tile_wall:'m²',tile_seal:'lfm',masonry_wall:'m²',masonry_repair:'Std.',masonry_joint:'m²',plaster_interior:'m²',plaster_facade:'m²',plaster_patch:'Std.',paving_lay:'m²',paving_base:'m²',paving_edge:'lfm',wood_deck:'m²',wood_fence:'lfm',wood_repair:'Std.',assemble_furniture:'Std.',assemble_kitchen:'Stück',assemble_door:'Stück',metal_fence:'lfm',metal_railing:'lfm',metal_repair:'Std.',electrical_socket:'Stück',electrical_light:'Stück',electrical_check:'Std.',sanitary_fixture:'Stück',heating_service:'Std.',climate_service:'Std.',roof_repair:'Std.',gutter_clean:'lfm',gutter_install:'lfm',demolition_surface:'m²',demolition_partition:'m²',demolition_sort:'Std.',customwork:'Std.'};
const speechServicePatterns=[['felling',/\b(?:faell\w*|baumfaell\w*|abholzen)\b/],['greenhaul',/\b(?:gruenschnitts?(?:transport\w*)?|gruenguts?(?:transport\w*)?|gruenabfalls?|abtransport(?:ieren)?|wegtransportieren)\b/],['tree',/\b(?:baeume|baeumen|baum|baumschnitt\w*|baumpflege\w*|baumrueckschnitt\w*)\b/],['radical',/\b(?:radikal\w*|auf stock|stark zurueck\w*)\b/],['shape',/\b(?:form\w*\s*(?:schnitt|schneid\w*)|formschnitt\w*)\b/],['hedge',/\bheck\w*\b/],['window',/\b(?:fenster\w*|glasreinig\w*|scheiben\w*)\b/],['deep',/\bgrundreinig\w*\b/],['stairs',/\b(?:trepp\w*|etagen? reinigen)\b/],['practice',/\bpraxis\w*\b/],['office',/\bbuero\w*\b/],['home',/\bhaushalt\w*\b/],['weeds',/\b(?:unkraut\w*|wildkraut\w*|fugen\w*)\b/],['lawn',/\b(?:rasen\w*|maeh\w*)\b/],['landscape',/\b(?:garten\w*|landschaft\w*|beet\w*)\b/],['house',/\b(?:hausreinig\w*|wohnung\w*|putzen|reinig\w*)\b/],...speechTradePatterns];
const serviceUnits={...tradeSpeechUnits,felling:'Stück',greenhaul:'m³',tree:'Stück',lawn:'m²',weeds:'m²',landscape:'Std.',hedge:'lfm',radical:'lfm',shape:'lfm',home:'m²',house:'m²',deep:'m²',window:'m²',stairs:'Etage',office:'m²',practice:'m²'};
// Keep category modifiers and negations within their own clause. This is a
// catalogue parser: ambiguous statements must trigger a question, not a price.
function clauseStart(text,index){let start=0;for(const match of text.slice(0,index).matchAll(/[,.;](?!\d)|(?<!\d)[,.;]|\b(?:und|aber|sondern|stattdessen|plus)\b/g))start=match.index+match[0].length;return start}
function isNegated(text,index){const prefix=text.slice(clauseStart(text,index),index).replace(/\bnicht\s+nur\b/g,'');return /\b(?:kein(?:e|en|em|er|es)?|ohne|nicht|keinesfalls)\b/.test(prefix)}
function serviceMentionNegated(text,match){return isNegated(text,match.index)||/^\s*(?:(?:bitte|diesmal)\s+)?(?:nicht|keinesfalls)\s+(?:maeh\w*|schneid\w*|reinig\w*|streich\w*|lackier\w*|montier\w*|verleg\w*|verputz\w*)\b/.test(text.slice(match.index+match[0].length))}
function clauseText(text,index){const start=clauseStart(text,index),tail=text.slice(index),boundary=tail.match(/[,.;](?!\d)|(?<!\d)[,.;]|\b(?:und|aber|sondern|stattdessen|plus)\b/);return text.slice(start,boundary?index+boundary.index:text.length)}
function validServiceContext(text,match,id,required){
 const clause=clauseText(text,match.index);
 if(id==='assemble_kitchen'&&!/\b(?:kuechenmodul\w*|kuechenschrank\w*|kuechenschraenk\w*|kuechenkorpus\w*)\b/.test(clause))return false;
 if(id==='electrical_socket'&&/\b(?:installier\w*|neuinstallation\w*)\b/.test(clause)&&!/\b(?:austausch\w*|wechsel\w*|erset\w*)\b/.test(clause))return false;
 if(required&&!required.test(clause))return false;
 if(Object.hasOwn(tradeSpeechUnits,id)&&id!=='gutter_clean'&&/\b(?:reinig\w*|putzen|saeuber\w*)\b/.test(clause)&&!/\b(?:verleg\w*|montier\w*|installier\w*|repar\w*|erneuer\w*|streich\w*|lackier\w*|rueckbau\w*|entfern\w*)\b/.test(clause))return false;
 return true;
}
function hasPositiveSpeechPattern(text,pattern){return [...text.matchAll(new RegExp(pattern.source,'g'))].some(match=>!serviceMentionNegated(text,match))}
function findSpeechServices(t){
 const found=[];
 for(const [id,re,required]of speechServicePatterns)for(const m of t.matchAll(new RegExp(re.source,'g'))){
  if(serviceMentionNegated(t,m)||!validServiceContext(t,m,id,required))continue;
  found.push({id,start:m.index,end:m.index+m[0].length,word:m[0],clause:clauseStart(t,m.index)})
 }
 const specificClean=['window','deep','stairs','practice','office','home'];
 const specificGarden=['lawn','weeds','hedge','radical','shape','paving_lay','paving_base','paving_edge','wood_deck','wood_fence','metal_fence'];
 const filtered=found.filter(s=>{
  const otherInClause=ids=>found.some(other=>ids.includes(other.id)&&other.clause===s.clause);
  if(s.id==='masonry_wall'&&otherInClause(['masonry_repair','masonry_joint']))return false;
  if(s.id==='plaster_interior'&&otherInClause(['plaster_facade','plaster_patch']))return false;
  if(s.id==='plaster_facade'&&otherInClause(['plaster_patch']))return false;
  if(s.id==='paving_lay'&&otherInClause(['paving_base','paving_edge']))return false;
  if(s.id==='drywall_wall'&&otherInClause(['demolition_partition']))return false;
  if(['floor_laminate','floor_vinyl','tile_floor','tile_wall'].includes(s.id)&&otherInClause(['demolition_surface']))return false;
  if(s.id==='weeds'&&/^fugen/.test(s.word)&&otherInClause(['tile_seal','masonry_joint']))return false;
  if(s.id==='tree'&&found.some(other=>other.id==='felling'&&other.clause===s.clause))return false;
  if(s.id==='radical'&&found.some(other=>other.id==='tree'&&other.clause===s.clause))return false;
  if(s.id==='hedge'&&found.some(other=>['radical','shape'].includes(other.id)&&other.clause===s.clause))return false;
  if(s.id==='house'){
   if(/^hausreinig/.test(s.word))return true;
   // "Grundreinigung der Wohnung" names one service. A separate clause
   // such as "... und Wohnung 100 qm reinigen" still names a second one.
   if(specificClean.some(id=>found.some(other=>other.id===id&&other.clause===s.clause)))return false;
   if(!/^wohnung/.test(s.word)&&found.some(other=>other.id!=='house'))return false;
  }
  if(s.id==='landscape'&&!/^(?:gartenpflege|landschaft|beet)/.test(s.word)&&found.some(other=>specificGarden.includes(other.id)&&other.clause===s.clause))return false;
  return true;
 }).sort((a,b)=>a.start-b.start);
 const seen=new Set();return filtered.filter(s=>{if(seen.has(s.id))return false;seen.add(s.id);return true})
}
// Explicit cost labels own their adjacent amounts. Service counts, durations
// without a travel label and unlabelled money are never invented cost values.
export function parseAssistantCosts(raw){
 const text=normalizeSpeech(raw),labels=[],costs={},issues=[],spans=[];
 const patterns=[
  ['ambiguous',/\bmaschinenmaterial(?:s)?kosten\b/g],
  ['travel',/\b(?:anfahrtskosten|anfahrtszeit|anfahrt|fahrkosten|fahrtkosten|fahrzeit|fahrtzeit|fahrtdauer|fahrtpauschale|anfahrts?pauschale|fahrstrecke|wegzeit|fahrt)\b/g],
  ['material',/\b(?:material(?:kosten)?|verbrauchsmaterial(?:kosten)?|montagematerial(?:kosten)?|reinigungsmittelkosten)\b/g],
  ['rental',/\b(?:maschinen?(?:kosten|miete)?|maschinenmietkosten|geraet(?:e)?(?:kosten|miete)|mietkosten|miete)\b/g],
  ['disposal',/\b(?:entsorgung(?:skosten)?|gruenabfallkosten)\b/g]
 ];
 for(const [field,re]of patterns)for(const match of text.matchAll(re)){if(field==='rental'&&/^maschinen?$/.test(match[0])&&/\b(?:welche[nsr]?|was fuer)\s*$/.test(text.slice(0,match.index)))continue;labels.push({field,start:match.index,end:match.index+match[0].length,word:match[0],assigned:false});}
 labels.sort((a,b)=>a.start-b.start);
 const issue=(field,message)=>{if(!issues.some(x=>x.field===field&&x.message===message))issues.push({field,message})};
 for(const label of labels){
  if(label.field==='ambiguous'){issue('material/rental','Maschinen- und Materialkosten bitte getrennt in Euro nennen.');continue}
  if(isNegated(text,label.start)){
   const field=label.field==='travel'?'travelPrice':label.field;costs[field]=0;label.assigned=true;
  }
 }
 const services=findSpeechServices(text);
 for(const measurement of quantitiesFromSpeech(text)){
  if(!['Std.','Min.','km','€'].includes(measurement.unit))continue;
  const beforeValue=text.slice(clauseStart(text,measurement.start),measurement.start);
  if(isNegated(text,measurement.start)||/\bstatt\s*$/.test(beforeValue)){spans.push({start:measurement.start,end:measurement.end});continue}
  const nearestAmbiguous=labels.filter(label=>label.field==='ambiguous').sort((a,b)=>Math.min(Math.abs(measurement.start-a.end),Math.abs(measurement.end-a.start))-Math.min(Math.abs(measurement.start-b.end),Math.abs(measurement.end-b.start)))[0];
  if(measurement.unit==='€'&&nearestAmbiguous&&clauseStart(text,nearestAmbiguous.start)===clauseStart(text,measurement.start)){spans.push({start:measurement.start,end:measurement.end});continue}
  let candidates=labels.filter(label=>label.field!=='ambiguous'&&!isNegated(text,label.start));
  if(measurement.unit!=='€')candidates=candidates.filter(label=>label.field==='travel');
  candidates=candidates.filter(label=>{
   const gap=label.end<=measurement.start?measurement.start-label.end:measurement.end<=label.start?label.start-measurement.end:0;
   if(gap>100)return false;
   const sameClause=clauseStart(text,label.start)===clauseStart(text,measurement.start);
   if(!sameClause&&services.some(s=>s.clause===clauseStart(text,measurement.start)&&serviceUnits[s.id]===measurement.unit))return false;
   if(!sameClause&&labels.some(other=>other!==label&&other.start>Math.min(label.start,measurement.start)&&other.end<Math.max(label.end,measurement.end)))return false;
   return true;
  });
  candidates.sort((a,b)=>{
   const distance=label=>Math.min(Math.abs(measurement.start-label.end),Math.abs(measurement.end-label.start));
   return distance(a)-distance(b)||(a.end<=measurement.start?-1:1)-(b.end<=measurement.start?-1:1);
  });
  const label=candidates[0];if(!label)continue;
  const field=measurement.unit==='€'?(label.field==='travel'?'travelPrice':label.field):measurement.unit==='km'?'km':'travelHours';
  // Preserve service hours when the nearest travel label belongs to another clause.
  if(field==='travelHours'&&services.some(s=>s.clause===clauseStart(text,measurement.start)&&serviceUnits[s.id]==='Std.')&&clauseStart(text,label.start)!==clauseStart(text,measurement.start))continue;
  spans.push({start:measurement.start,end:measurement.end});label.assigned=true;
  const value=measurement.unit==='Min.'?measurement.qty/60:measurement.qty;
  if(!Number.isFinite(value)||value<0||value>(field==='travelHours'?72:field==='km'?10000:100000)){
   issue(field,'Bitte einen gültigen, nicht negativen Kosten- oder Fahrtwert nennen.');continue;
  }
  if(Object.hasOwn(costs,field)&&costs[field]!==value){issue(field,'Mehrere Werte erkannt. Bitte den endgültigen Wert für diese Kostenposition nennen.');continue}
  costs[field]=value;
 }
 for(const label of labels){
  if(label.field==='ambiguous'||label.assigned||label.field==='travel'&&['travelHours','km','travelPrice'].some(field=>Object.hasOwn(costs,field))||label.field!=='travel'&&Object.hasOwn(costs,label.field))continue;
  issue(label.field==='travel'?'travelHours/km':label.field,label.field==='travel'?'Bitte Anfahrtszeit, Strecke in Kilometern oder Anfahrtspreis in Euro nennen.':`Bitte ${label.field==='material'?'Materialkosten':label.field==='rental'?'Maschinenkosten / Miete':'Entsorgungskosten'} in Euro nennen.`);
 }
 // A combined sum does not identify how much belongs to machine rental/material.
 if(/\bmaschinen(?:kosten)?\s+(?:und|sowie)\s+materialkosten\b/.test(text)&&quantitiesFromSpeech(text).filter(q=>q.unit==='€').length<2)issue('material/rental','Maschinen- und Materialkosten bitte getrennt in Euro nennen.');
 let route=null;
 const routeMatch=String(raw||'').match(/\bvon\s+(.{2,100}?)\s+nach\s+(.{2,100}?)(?=\s+(?:mit|für|fuer|bei|und|sowie|dann|eine?m?|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|halb\w*|dreiviertel\w*|anderthalb\w*|Anfahr\w*|Fahrt\w*|Material\w*|Maschinen\w*|\d)\b|[,.;!?]|$)/i);
 if(routeMatch){const from=routeMatch[1].trim(),to=routeMatch[2].trim();if(from&&to&&from.toLowerCase()!==to.toLowerCase())route={from,to}}
 if(route&&!['travelHours','km','travelPrice'].some(field=>Object.hasOwn(costs,field)))issue('travelHours/km','Start und Ziel erkannt. Bitte tatsächliche Fahrzeit oder Kilometer bestätigen; ich berechne keine Route automatisch.');
 return {costs,route,issues,spans,requested:labels.length>0||route!==null};
}

// A conversational quantity correction may reuse the previous service. An
// unknown new object must not inherit an unrelated earlier gardening price.
function quantityContextAllowed(text){
 let remaining=text;
 for(const span of quantitiesFromSpeech(text).sort((a,b)=>b.start-a.start))remaining=remaining.slice(0,span.start)+' '+remaining.slice(span.end);
 remaining=remaining.replace(/[.,()]/g,' ').replace(/\b(?:bitte|nein|doch|statt|stattdessen|es|sind|ist|ich|habe|wir|haben|auf|fuer|den|die|das|dem|der|und|nur|noch|jetzt|insgesamt|davon|kannst|du|mir|mich|wie|viel|auftrag|kalkulation|hoehe|hoch|breit|breite|lang|laenge|zugang|gut|schlecht)\b|\b(?:kalkulier\w*|berechn\w*|rechne\w*|rechnen|kostet|kosten|aender\w*|korrigier\w*|mach\w*|streich\w*|lackier\w*)\b/g,' ').replace(/\s+/g,' ').trim();
 return !remaining;
}

export function parseAssistantRequest(raw,context={}){
 const text=normalizeSpeech(raw),services=findSpeechServices(text),costInfo=parseAssistantCosts(raw);
 const measurements=quantitiesFromSpeech(text).filter(q=>!q.dimension&&!isNegated(text,q.start)&&!costInfo.spans.some(span=>q.start>=span.start&&q.end<=span.end));
 const service=services[0]?.id;
 const excludedServices=speechServicePatterns.filter(([id,re,required])=>[...text.matchAll(new RegExp(re.source,'g'))].some(m=>serviceMentionNegated(text,m)&&validServiceContext(text,m,id,required))).map(([id])=>id).filter(id=>!services.some(s=>s.id===id));
 const result={text,services:services.map(s=>s.id),excludedServices,lines:[],costs:costInfo.costs,route:costInfo.route,costIssues:costInfo.issues,costOnly:false};
 const wantsCalculation=/\b(?:kalkulier\w*|berechn\w*|preis\w*|kostet|kosten|angebot|rechne|rechnen)\b/.test(text),hasCalculation=services.length>0&&(measurements.length>0||wantsCalculation)||costInfo.requested;
 const costReply=extra=>{const coveredVolume=result.lines.some(l=>l.service==='greenhaul'&&l.qty>0);const issues=costInfo.issues.filter(issue=>!(coveredVolume&&issue.field==='disposal'));return {...result,...extra,costIssues:issues,intent:issues.length?'clarify-costs':'calculation'}};
 if(context.pendingTakeover&&/^(?:ja|ja bitte|bitte|okay|ok|mach das|gerne)[.,]?$/.test(text))return {...result,intent:'takeover'};
 if(context.pendingTakeover&&/^(?:nein|nein danke|lieber nicht)[.,]?$/.test(text))return {...result,intent:'decline'};
 if(/^(?:bitte\s+)?(?:stopp?|aufhoeren|ruhe|sei still|hoer auf)(?:\s+bitte)?[.,]?$/.test(text))return {...result,intent:'stop'};
 if(/^(?:bitte\s+)?(?:nochmal|wiederhol\w*|noch einmal)(?:\s+bitte)?[.,]?$/.test(text))return {...result,intent:'repeat'};
 if(/\b(?:ausfuehrlich|details|genauer erklaeren)\b/.test(text))return {...result,intent:'details'};
 if(/\b(?:uebernehmen|uebernimm|mach daraus (?:einen )?auftrag|in die kalkulation)\b/.test(text))return {...result,intent:'takeover'};
 if(/^(?:hallo|hey|servus|guten tag|guten morgen)[.,]?$/.test(text))return {...result,intent:'greeting'};
 let scopeClarification='';
 if(!services.some(s=>s.id==='assemble_kitchen')&&/\bkueche\w*\b/.test(text)&&/\b(?:montier\w*|montage\w*|einbau\w*|aufbau\w*)\b/.test(text))scopeClarification='Der Katalog zählt einzelne Küchenmodule. Wie viele bestätigte Module sollen mechanisch montiert werden? Fachanschlüsse und Zusatzarbeiten bitte separat nennen.';
 if(!services.some(s=>s.id==='electrical_socket')&&/\bsteckdose\w*\b/.test(text)&&/\b(?:installier\w*|neuinstallation\w*)\b/.test(text))scopeClarification='Der Katalog enthält den bestätigten Steckdosenaustausch. Eine neue Elektroinstallation benötigt einen eigenen, vom Fachbetrieb geklärten Leistungsumfang und Preis.';
 if(services.some(s=>s.id==='roof_repair')&&/\b(?:foto\w*|bild\w*)\b/.test(text)&&!measurements.length)return {...result,services:['roof_repair'],intent:'clarify-service',clarification:'Aus einem Foto kann ich den Dachschaden nicht verlässlich diagnostizieren oder einen Reparaturumfang bestätigen. Bitte Vor-Ort-Prüfung, freigegebene Arbeiten und bestätigten Zeitaufwand angeben.'};
 const contextService=context.pendingService||(context.lines?.length===1?context.lines[0].service:null),paintingIds=['paint_wall','paint_ceiling','paint_door'];
 if(hasPositiveSpeechPattern(text,/\b(?:streich\w*|lackier\w*|anstrich\w*)\b/)&&!services.some(s=>paintingIds.includes(s.id))&&!(services.length===0&&paintingIds.includes(contextService)))return {...result,services:paintingIds,intent:'clarify-service',clarification:'Welche Oberfläche soll bearbeitet werden: Wand, Decke oder Tür? Bitte den bestätigten Umfang mit Quadratmetern oder Stück nennen.'};
 const genericTrade=genericTradeRequests.find(([pattern,ids])=>hasPositiveSpeechPattern(text,pattern)&&!services.some(s=>ids.includes(s.id))&&!(!services.length&&ids.includes(contextService)));
 if(!services.length&&genericTrade)return {...result,services:genericTrade[1],intent:'clarify-service',...(scopeClarification?{clarification:scopeClarification}:{})};
 if(!hasCalculation&&/\b(?:termine?|kalender|naechst\w*|ansteh\w*)\b|was (?:steht|liegt) .*an|was habe ich (?:heute|morgen)/.test(text))return {...result,intent:'appointments',day:/\bmorgen\b/.test(text)?'tomorrow':/\bheute\b/.test(text)?'today':'next'};
 if(/\b(?:umsatz|einnahm\w*|buchhalt\w*|rechnungen?|forderungen?)\b|geld (?:bekommen|verdient)|wie viel .*eingenommen/.test(text)&&!services.length)return {...result,intent:'finance'};
 if(/\b(?:geraet\w*|werkzeug\w*|ausruest\w*)\b|\bwelche(?:n|s)?\s+(?:material(?:ien)?|maschinen?|geraete?|werkzeuge?)(?:\s|$)|was (?:brauche|brauch|benoetige) ich/.test(text)&&!wantsCalculation&&!Object.keys(costInfo.costs).length)return {...result,intent:'equipment',services:services.length?result.services:(context.lines||[]).map(l=>l.service)};
 
 if(!services.length&&!measurements.length&&costInfo.requested){
  if(context.lines?.length){const lines=context.lines.map(l=>({service:l.service,qty:l.qty,unit:serviceUnits[l.service]}));return costReply({lines,services:lines.map(l=>l.service),costOnly:true,correction:true})}
  return {...result,intent:costInfo.issues.length?'clarify-costs':'clarify-service',costOnly:true};
 }
 const bareNumber=parseGermanNumber(text.replace(/^(?:nein[,.]?|doch[,.]?|es sind|stattdessen|bitte)\s+/,''));
 if(!measurements.length&&bareNumber!==null){
  const id=context.pendingService||(context.lines?.length===1?context.lines[0].service:null);
  if(id)measurements.push({qty:bareNumber,unit:serviceUnits[id],start:0,end:text.length});
  else if(context.lines?.length>1)return {...result,intent:'clarify-service',services:context.lines.map(l=>l.service)};
 }
 const correction=/\b(?:nein|doch|statt|aendere|korrigier\w*|es sind|mach (?:es|das))\b/.test(text)||(/\bsondern\b/.test(text)&&!/\bnicht\s+nur\b/.test(text))||excludedServices.length>0&&(context.lines?.length||0)>0;
 if(measurements.length||wantsCalculation||correction){
  let mentioned=services;
  if(!mentioned.length&&measurements.length&&bareNumber===null&&!quantityContextAllowed(text))return {...result,intent:'clarify-service'};
  if(!mentioned.length&&context.pendingService)mentioned=[{id:context.pendingService,start:0,end:0}];
  if(!mentioned.length&&context.lines?.length===1)mentioned=[{id:context.lines[0].service,start:0,end:0}];
  if(!mentioned.length&&context.lines?.length>1&&measurements.length)return {...result,intent:'clarify-service',services:context.lines.map(l=>l.service)};
  if(!mentioned.length)return {...result,intent:costInfo.issues.length?'clarify-costs':'clarify-service'};
  const used=new Set();
  for(const s of mentioned){
   const candidates=measurements.map((q,i)=>({...q,i})).filter(q=>!used.has(q.i));
   candidates.sort((a,b)=>Math.min(Math.abs(a.end-s.start),Math.abs(a.start-s.end))-Math.min(Math.abs(b.end-s.start),Math.abs(b.start-s.end)));
   const q=candidates[0];
   if(!q||q.qty<=0||q.qty>1000000||serviceUnits[s.id]==='Stück'&&!Number.isInteger(q.qty))return {...result,intent:'clarify-quantity',service:s.id,unit:serviceUnits[s.id]};
   if(q.unit!==serviceUnits[s.id]&&!(serviceUnits[s.id]==='Std.'&&q.unit==='Min.'))return {...result,intent:'clarify-unit',service:s.id,unit:serviceUnits[s.id],received:q.unit};
   used.add(q.i);result.lines.push({service:s.id,qty:q.unit==='Min.'?q.qty/60:q.qty,unit:serviceUnits[s.id]});
  }
  if(used.size<measurements.length)return {...result,intent:'clarify-multiple',service:mentioned[0].id};
  return costReply({correction});
 }
 if(costInfo.issues.length)return {...result,intent:'clarify-costs'};
 if(/\b(?:gewinn|marge|lohn|rentab\w*|verdien\w*)\b/.test(text))return {...result,intent:'profit'};
 if(service)return {...result,intent:'procedure',service};
 return {...result,intent:'unknown'};
}
export function bestTranscript(alternatives,context={}){const choices=Array.from(alternatives||[]);return choices.map((a,i)=>{const parsed=parseAssistantRequest(a.transcript,context);const structured=parsed.lines.length>0&&['calculation','clarify-costs','clarify-quantity','clarify-unit','clarify-multiple'].includes(parsed.intent);const score=(structured?10+Object.keys(parsed.costs||{}).length*.3+Math.min(3,parsed.lines.length-1)*.1+Math.min(2,Math.max(0,parsed.services.length-parsed.lines.length))*.25:parsed.intent==='calculation'?10:parsed.intent.startsWith('clarify')?3:parsed.intent!=='unknown'?6:0)+(Number(a.confidence)||0)-i*.1;return {...a,score}}).sort((a,b)=>b.score-a.score)[0]?.transcript||''}
export function isMaleVoice(voice){return /\b(?:male|maennlich|männlich|stefan|hans|conrad|daniel|markus|marcus|ralf|florian|michael|martin|thomas|jonas|yannick|kasper|paul)\b/i.test(voice.name||'')&&!/female/i.test(voice.name||'')}
export function chooseGermanVoice(voices,preferred=''){const german=Array.from(voices||[]).filter(v=>/^de(?:[-_]|$)/i.test(v.lang||''));return german.map((v,i)=>({v,score:(preferred&&v.voiceURI===preferred?1000:0)+(isMaleVoice(v)?100:0)+(v.localService?50:0)+(/neural|natural|premium/i.test(v.name)?10:0)-i*.01})).sort((a,b)=>b.score-a.score)[0]?.v||null}
export function spokenMoney(amount){return new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(amount)||0)+' Euro'}
export function briefSpokenReply(text){const limit=230;let t=String(text||'').replace(/^(?:•\s*|\d+[.)]\s+)/gm,'').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();if(t.length<=limit)return t;const sentences=t.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[t];let out='';for(const sentence of sentences){if(out.length+sentence.length>limit)break;out+=sentence}if(out.trim())return out.trim();const suffix='. Details stehen im Chat.';return t.slice(0,limit-suffix.length).replace(/\s+\S*$/,'').trimEnd().replace(/[.,;:]$/,'')+suffix}
