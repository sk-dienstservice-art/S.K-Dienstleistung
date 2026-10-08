import { defaults, services, equipment, statuses, calculate, migrateState, roundMoney, cents, today, validISODate } from './core.js';
import {QUOTE_STATUSES} from './quotes.js';

const TAX_MODES = ['small', 'standard', 'exempt'];
const TIME_KINDS = ['Arbeit', 'Fahrt', 'Rüsten'];
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const MONEY_LIMIT = 1e12;
const TEXT_FIELDS = { company:150, owner:100, address:300, email:200, phone:50, website:200, offerFooter:2000, quotePrefix:12, taxId:100, iban:100, currency:10, country:100, homeBase:200, serviceArea:500, region:100, voiceURI:1000 };
const NUMERIC_SETTINGS = { tax:[0,100], hourlyCost:[0,1e6], overhead:[0,1e6], targetMargin:[0,90], kmCost:[0,1e6], travelHourlyRate:[0,10000], travelKmRate:[0,100], disposalRate:[0,10000], transportHourlyRate:[0,10000], paymentDays:[1,3650], quoteDays:[1,365], nextQuoteNumber:[1,999999999], watchYear:[1900,9999], previousTurnover:[0,MONEY_LIMIT], externalTurnover:[0,MONEY_LIMIT], reservePercent:[0,100], speechRate:[.1,10] };
const COST_FIELDS = ['hourlyCost','overhead','kmCost','targetMargin','tax','taxMode'];
const CALC_FIELDS = ['serviceNet','hours','consumables','travelCost','extraCost','labor','overhead','costs','extras','net','tax','gross','profit','margin','suggested'];

const fail = (path, message) => { throw Error(`Sicherung: ${path} – ${message}`); };
const has = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
function record(value,path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path,'ein gültiger Datensatz fehlt.');
  const prototype=Object.getPrototypeOf(value);
  if(prototype!==null){
    const constructor=Object.getOwnPropertyDescriptor(prototype,'constructor')?.value;
    if(Object.getPrototypeOf(prototype)!==null || typeof constructor!=='function' || !/^function Object\(\)\s*\{\s*\[native code\]\s*\}$/.test(Function.prototype.toString.call(constructor)))fail(path,'ein einfacher JSON-Datensatz ohne geerbte Felder wird benötigt.');
  }
  return value;
}
function list(value,path,max) {
  if (!Array.isArray(value)) fail(path,'eine Liste wird erwartet.');
  if (value.length > max) fail(path,`zu viele Einträge (höchstens ${max}).`);
  for (let index=0;index<value.length;index++) if (!has(value,index)) fail(path,'die Liste enthält fehlende Einträge.');
  return value;
}
function text(value,path,max=5000,{required=false,fallback=''}={}) {
  if (value === undefined || value === null) { if(required) fail(path,'der Text fehlt.'); return fallback; }
  if (typeof value !== 'string' || value.length>max || /\u0000/.test(value)) fail(path,`gültigen Text mit höchstens ${max} Zeichen verwenden.`);
  if (required && !value.trim()) fail(path,'der Text darf nicht leer sein.');
  return value;
}
function identifier(value,path,{optional=false}={}) {
  if (optional && (value===undefined || value===null || value==='')) return '';
  if (typeof value!=='string' || !ID_PATTERN.test(value)) fail(path,'ungültige Kennung; nur Buchstaben, Zahlen, Bindestrich und Unterstrich bis 100 Zeichen sind erlaubt.');
  return value;
}
function finite(value,path,min=0,max=MONEY_LIMIT,{fallback,integer=false,money=false}={}) {
  if (value===undefined && fallback!==undefined) return fallback;
  if (typeof value!=='number' || !Number.isFinite(value) || value<min || value>max || integer&&!Number.isInteger(value)) fail(path,`eine gültige Zahl zwischen ${min} und ${max} wird benötigt.`);
  if (money && Math.abs(value-roundMoney(value))>1e-7) fail(path,'Geldbeträge dürfen höchstens zwei Nachkommastellen haben.');
  return money?roundMoney(value):value;
}
function date(value,path,{optional=false,past=false}={}) {
  if (optional && (value===undefined || value===null || value==='')) return '';
  if (!validISODate(value)) fail(path,'ein echtes Kalenderdatum im Format JJJJ-MM-TT wird benötigt.');
  if (past && value>today()) fail(path,'das Datum darf nicht in der Zukunft liegen.');
  return value;
}
function boolean(value,path,fallback=false) {
  if(value===undefined) return fallback;
  if(typeof value!=='boolean') fail(path,'der Wert muss wahr oder falsch sein.');
  return value;
}
function enumeration(value,values,path,fallback) {
  if(value===undefined && fallback!==undefined) return fallback;
  if(!values.includes(value)) fail(path,'unbekannter Auswahlwert.');
  return value;
}
function unique(items,path,key='id') {
  const seen=new Set();
  for(const item of items){const value=key===null?item:item[key];if(seen.has(value))fail(path,`doppelte Kennung oder Nummer „${String(value).slice(0,100)}“.`);seen.add(value);}
}

// JSON files cannot contain accessors/cycles. Reject them in direct calls too, and
// never spread untrusted settings into application state or retain prototype keys.
function inspectStructure(input) {
  const seen=new WeakSet();let nodes=0,stringBytes=0;
  function inspect(value,path,depth=0){
    if(depth>20 || ++nodes>5000000)fail(path,'die Sicherung ist zu komplex.');
    if(typeof value==='string'){stringBytes+=value.length;if(stringBytes>80*1024*1024)fail(path,'die Sicherung überschreitet 80 MB.');return;}
    if(value===null || typeof value!=='object')return;
    if(seen.has(value))fail(path,'zirkuläre Datensätze sind nicht erlaubt.');
    seen.add(value);
    if(!Array.isArray(value))record(value,path);
    for(const key of Object.getOwnPropertyNames(value)){
      if(['__proto__','prototype','constructor'].includes(key))fail(path,'unsichere Eigenschaft in der Sicherung.');
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(descriptor.get || descriptor.set)fail(path,'berechnete Eigenschaften sind nicht erlaubt.');
      if(Array.isArray(value)&&key==='length')continue;
      inspect(descriptor.value,`${path}.${key}`,depth+1);
    }
    seen.delete(value);
  }
  inspect(input,'Datei');
}

function settings(input,path,{snapshot=false}={}) {
  record(input,path);const output={...defaults};
  for(const [key,max]of Object.entries(TEXT_FIELDS))output[key]=text(input[key],`${path}.${key}`,max,{fallback:defaults[key]});
  if(snapshot && !has(input,'company'))fail(path+'.company','der gespeicherte Firmenname fehlt.');
  if(snapshot && !output.company.trim())fail(path+'.company','der gespeicherte Firmenname darf nicht leer sein.');
  for(const [key,[min,max]]of Object.entries(NUMERIC_SETTINGS))output[key]=finite(input[key],`${path}.${key}`,min,max,{fallback:defaults[key],integer:['watchYear','paymentDays','quoteDays','nextQuoteNumber'].includes(key)});
  output.taxMode=enumeration(input.taxMode,TAX_MODES,path+'.taxMode',output.tax===0?'exempt':'standard');
  if(output.taxMode!=='standard')output.tax=0;
  for(const key of ['speech','shortVoice','voiceAutoSubmit','handsFree'])output[key]=boolean(input[key],`${path}.${key}`,defaults[key]);
  output.businessStart=date(input.businessStart,path+'.businessStart',{optional:true});
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,11}$/.test(output.quotePrefix))fail(path+'.quotePrefix','1 bis 12 Buchstaben/Zahlen, Bindestrich oder Unterstrich verwenden.');
  output.serviceRates={};
  if(input.serviceRates!==undefined){record(input.serviceRates,path+'.serviceRates');for(const [service,value]of Object.entries(input.serviceRates)){if(!services.some(item=>item.id===service))fail(path+'.serviceRates','unbekannte Leistung.');output.serviceRates[service]=finite(value,path+'.serviceRates.'+service,0,100000);}}
  if(has(input,'lastBackupExportAt')){
    const timestamp=text(input.lastBackupExportAt,path+'.lastBackupExportAt',50);
    if(timestamp && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) || !validISODate(timestamp.slice(0,10)) || !Number.isFinite(Date.parse(timestamp))))fail(path+'.lastBackupExportAt','der Sicherungszeitpunkt ist ungültig.');
    output.lastBackupExportAt=timestamp;
  }
  return output;
}
function costSettings(input,path,fallback) {
  record(input,path);const output={};
  for(const key of COST_FIELDS){
    if(key==='taxMode')output[key]=enumeration(input[key],TAX_MODES,path+'.'+key,fallback.taxMode);
    else { const [min,max]=NUMERIC_SETTINGS[key];output[key]=finite(input[key],path+'.'+key,min,max,{fallback:fallback[key]}); }
  }
  if(output.taxMode!=='standard')output.tax=0;
  return output;
}
function customer(input,path,{snapshot=false}={}) {
  record(input,path);
  return {id:identifier(input.id,path+'.id',{optional:snapshot}),name:text(input.name,path+'.name',200,{required:true}),type:text(input.type,path+'.type',100,{fallback:'Privatkunde'}),address:text(input.address,path+'.address',1000),email:text(input.email,path+'.email',300),phone:text(input.phone,path+'.phone',100),notes:text(input.notes,path+'.notes',5000)};
}
function image(input,path) {
  record(input,path);const data=text(input.data,path+'.data',28*1024*1024,{required:true});
  const match=data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match || match[2].length%4!==0)fail(path,'nur vollständig codierte JPG-, PNG- oder WebP-Bilder sind zulässig.');
  const output={name:text(input.name,path+'.name',1000,{fallback:'Bild'}),data};
  if(has(input,'stage'))output.stage=enumeration(input.stage,['before','during','after','detail'],path+'.stage');
  if(has(input,'caption'))output.caption=text(input.caption,path+'.caption',1000);
  return output;
}
function resource(input,path){
  record(input,path);
  const output={id:identifier(input.id,path+'.id'),kind:enumeration(input.kind,['material','machine'],path+'.kind'),name:text(input.name,path+'.name',300,{required:true}),unit:text(input.unit,path+'.unit',30,{required:true}),quantity:finite(input.quantity,path+'.quantity',.000001,1e9),unitCost:finite(input.unitCost,path+'.unitCost',0,1e9),costConfirmed:boolean(input.costConfirmed,path+'.costConfirmed'),use:boolean(input.use,path+'.use'),note:text(input.note,path+'.note',2000)};
  if(has(input,'source'))output.source=enumeration(input.source,['manual','suggestion'],path+'.source');
  if(output.kind==='machine'){output.mode=enumeration(input.mode,['owned','rent'],path+'.mode','rent');output.equipmentId=enumeration(input.equipmentId??'', ['',...equipment.map(eq=>eq.id)],path+'.equipmentId');}
  return output;
}
function siteDetails(input,path) {
  if(input===undefined||input===null)return {};
  record(input,path);const output={};
  for(const [key,min,max]of [['treeHeight',.1,100],['trunkDiameter',.1,500],['greenVolume',0,10000]])if(has(input,key))output[key]=finite(input[key],path+'.'+key,min,max);
  if(has(input,'access'))output.access=enumeration(input.access,['easy','limited','difficult','unknown'],path+'.access');
  for(const key of ['siteInspected','qualifiedWorkers','permissionsChecked','safetyPlanConfirmed'])if(has(input,key))output[key]=boolean(input[key],path+'.'+key);
  return output;
}
function job(input,path,currentSettings) {
  record(input,path);
  const output={id:identifier(input.id,path+'.id'),title:text(input.title,path+'.title',500,{required:true}),customer:identifier(input.customer,path+'.customer',{optional:true}),status:enumeration(input.status,statuses,path+'.status'),date:date(input.date,path+'.date',{optional:true}),time:text(input.time,path+'.time',5),notes:text(input.notes,path+'.notes',20000),routeFrom:text(input.routeFrom,path+'.routeFrom',200),routeTo:text(input.routeTo,path+'.routeTo',200),siteDetails:siteDetails(input.siteDetails,path+'.siteDetails')};
  if(output.time&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(output.time))fail(path+'.time','eine gültige Uhrzeit im Format HH:MM wird benötigt.');
  output.lines=list(input.lines,path+'.lines',100).map((line,index)=>{const p=path+`.lines[${index}]`;record(line,p);const result={service:enumeration(line.service,services.map(s=>s.id),p+'.service'),qty:finite(line.qty,p+'.qty',.000001,1e9),rate:finite(line.rate,p+'.rate',0,1e9)};if(has(line,'description'))result.description=text(line.description,p+'.description',1000);if(has(line,'minutes'))result.minutes=finite(line.minutes,p+'.minutes',0,100000);if(has(line,'unit'))result.unit=enumeration(line.unit,['m²','lfm','m','Stück','Std.','Etage','m³','Liter','kg','Pauschal'],p+'.unit');return result;});
  if(!output.lines.length)fail(path+'.lines','mindestens eine Leistung wird benötigt.');
  for(const [key,fallback,min,max]of [['duration',2,.001,100000],['factor',1,.001,1000],['travelHours',0,0,100000],['setupHours',0,0,100000],['km',0,0,1e9],['travelPrice',0,0,MONEY_LIMIT],['material',0,0,MONEY_LIMIT],['disposal',0,0,MONEY_LIMIT],['rental',0,0,MONEY_LIMIT],['tax',currentSettings.tax,0,100]])output[key]=finite(input[key],path+'.'+key,min,max,{fallback});
  output.taxMode=enumeration(input.taxMode,TAX_MODES,path+'.taxMode',output.tax===0?'exempt':'standard');
  if(output.taxMode!=='standard')output.tax=0;
  output.photos=list(input.photos??[],path+'.photos',100).map((photo,index)=>image(photo,path+`.photos[${index}]`));
  output.checks=list(input.checks??[],path+'.checks',100).map((check,index)=>text(check,path+`.checks[${index}]`,1000,{required:true}));
  unique(output.checks,path+'.checks',null);
  output.resources=list(input.resources??[],path+'.resources',300).map((entry,index)=>resource(entry,path+`.resources[${index}]`));
  unique(output.resources,path+'.resources');
  output.resourceCostsApplied=boolean(input.resourceCostsApplied,path+'.resourceCostsApplied');
  if(output.resourceCostsApplied){let material=0,rental=0,selected=0;for(const row of output.resources){if(!row.use)continue;selected++;if(!row.costConfirmed)fail(path+'.resources','übernommene Kosten müssen bestätigt sein.');const amount=Math.round((row.quantity*row.unitCost+Number.EPSILON)*100)/100;if(row.kind==='material')material=Math.round((material+amount+Number.EPSILON)*100)/100;else rental=Math.round((rental+amount+Number.EPSILON)*100)/100;}if(!selected||cents(material)!==cents(output.material)||cents(rental)!==cents(output.rental))fail(path+'.resources','der Material-/Maschinenplan passt nicht zu den übernommenen Kosten.');}
  for(const key of ['actualTimeComplete','actualCostsComplete'])output[key]=boolean(input[key],path+'.'+key);
  if(has(input,'costSettings')&&input.costSettings!==null)output.costSettings=costSettings(input.costSettings,path+'.costSettings',{...currentSettings,tax:output.tax,taxMode:output.taxMode});
  if(has(input,'parentJob'))output.parentJob=identifier(input.parentJob,path+'.parentJob',{optional:true});
  if(has(input,'created'))output.created=date(input.created,path+'.created',{optional:true});
  const calc=calculate(output,currentSettings);for(const key of ['net','tax','gross','costs','hours'])if(!Number.isFinite(calc[key])||Math.abs(calc[key])>MONEY_LIMIT)fail(path,'die Mengen und Kosten ergeben einen zu großen oder ungültigen Betrag.');
  return output;
}
function invoice(input,path,currentSettings) {
  record(input,path);
  const output={id:identifier(input.id,path+'.id'),number:text(input.number,path+'.number',150,{required:true}),issued:date(input.issued,path+'.issued'),due:date(input.due,path+'.due'),paid:date(input.paid,path+'.paid',{optional:true,past:true})};
  output.company=settings(input.company,path+'.company',{snapshot:true});
  output.customer=customer(input.customer,path+'.customer',{snapshot:true});
  output.job=job(input.job,path+'.job',output.company);
  output.jobId=identifier(input.jobId??output.job.id,path+'.jobId');
  if(output.jobId!==output.job.id)fail(path+'.jobId','die Auftragskennung passt nicht zum gespeicherten Rechnungsstand.');
  record(input.calc,path+'.calc');const calculated=calculate(output.job,output.company);output.calc={};
  for(const key of CALC_FIELDS){const required=['net','tax','gross'].includes(key);output.calc[key]=finite(input.calc[key],path+'.calc.'+key,['profit','margin'].includes(key)?-MONEY_LIMIT:0,MONEY_LIMIT,{fallback:required?undefined:calculated[key],money:required});}
  if(cents(output.calc.net)+cents(output.calc.tax)!==cents(output.calc.gross))fail(path+'.calc','Netto und Umsatzsteuer ergeben nicht den Bruttobetrag.');
  if(output.job.taxMode!=='standard'&&output.calc.tax!==0)fail(path+'.calc','die Rechnung weist Umsatzsteuer trotz Steuerbefreiung aus. Prüfe den ursprünglichen Rechnungsstand; seine Beträge werden nicht automatisch geändert.');
  if(input.payments!==undefined){
    output.payments=list(input.payments,path+'.payments',10000).map((payment,index)=>{const p=path+`.payments[${index}]`;record(payment,p);return {id:identifier(payment.id,p+'.id'),date:date(payment.date,p+'.date',{past:true}),amount:finite(payment.amount,p+'.amount',.01,MONEY_LIMIT,{money:true}),method:text(payment.method,p+'.method',100,{fallback:'Übernommen'}),note:text(payment.note,p+'.note',2000)};});
    unique(output.payments,path+'.payments');
  }else if(output.paid && output.calc.gross>0){
    output.payments=[{id:('legacy-'+output.id).slice(0,100),date:output.paid,amount:output.calc.gross,method:'Übernommen',note:'Zahlung aus älterer WerkPilot-Version'}];
  }else output.payments=[];
  const paidCents=output.payments.reduce((sum,payment)=>sum+cents(payment.amount),0);
  if(paidCents>cents(output.calc.gross))fail(path+'.payments','die Zahlungen übersteigen den Rechnungsbetrag.');
  // The paid field is a derived legacy convenience flag; the ledger is authoritative.
  output.paid=paidCents>=cents(output.calc.gross)&&output.payments.length?[...output.payments].sort((a,b)=>a.date.localeCompare(b.date)).at(-1).date:'';
  return output;
}

function quote(input,path,currentSettings) {
  record(input,path);
  const output={id:identifier(input.id,path+'.id'),number:text(input.number,path+'.number',150,{required:true}),sequence:finite(input.sequence,path+'.sequence',1,999999999,{integer:true}),jobId:identifier(input.jobId,path+'.jobId'),created:date(input.created,path+'.created'),validUntil:date(input.validUntil,path+'.validUntil'),status:enumeration(input.status,QUOTE_STATUSES,path+'.status')};
  if(output.validUntil<output.created)fail(path+'.validUntil','die Gültigkeit darf nicht vor dem Angebotsdatum enden.');
  output.company=settings(input.company,path+'.company',{snapshot:true});
  if(output.number!==`${output.company.quotePrefix}-${output.created.slice(0,4)}-${String(output.sequence).padStart(4,'0')}`)fail(path+'.number','die Angebotsnummer passt nicht zum gespeicherten Präfix, Datum und Nummernkreis.');
  output.customer=customer(input.customer,path+'.customer',{snapshot:true});
  output.job=job(input.job,path+'.job',output.company);
  if(output.jobId!==output.job.id)fail(path+'.jobId','die Auftragskennung passt nicht zum eingefrorenen Angebotsstand.');
  if(!output.customer.id||output.customer.id!==output.job.customer)fail(path+'.customer','der eingefrorene Kunde passt nicht zum Angebotsauftrag.');
  record(input.calc,path+'.calc');const calculated=calculate(output.job,output.company);output.calc={};
  for(const key of CALC_FIELDS){output.calc[key]=finite(input.calc[key],path+'.calc.'+key,['profit','margin'].includes(key)?-MONEY_LIMIT:0,MONEY_LIMIT,{money:['net','tax','gross'].includes(key)});if(Math.abs(output.calc[key]-calculated[key])>1e-7)fail(path+'.calc.'+key,'der Betrag passt nicht zum eingefrorenen Leistungs- und Kostenstand.');}
  if(cents(output.calc.net)+cents(output.calc.tax)!==cents(output.calc.gross))fail(path+'.calc','Netto und Umsatzsteuer ergeben nicht den Bruttobetrag.');
  output.events=list(input.events,path+'.events',10000).map((event,index)=>{const p=path+`.events[${index}]`;record(event,p);return {status:enumeration(event.status,QUOTE_STATUSES,p+'.status'),date:date(event.date,p+'.date'),note:text(event.note,p+'.note',2000)};});
  if(!output.events.length||output.events[0].status!=='draft'||output.events[0].date!==output.created)fail(path+'.events','der Angebotsverlauf muss mit dem Entwurf am Angebotsdatum beginnen.');
  const transitions={draft:['sent','declined','withdrawn'],sent:['accepted','declined','withdrawn'],accepted:[],declined:[],withdrawn:[]};
  for(let index=1;index<output.events.length;index++){const previous=output.events[index-1],event=output.events[index];if(event.date<previous.date||!transitions[previous.status].includes(event.status))fail(path+'.events','der Angebotsverlauf enthält einen unzulässigen Statuswechsel.');if(['sent','accepted'].includes(event.status)&&event.date>output.validUntil)fail(path+'.events','das Angebot wurde nach Ablauf seiner Gültigkeit versendet oder angenommen.');}
  if(output.events.at(-1).status!==output.status)fail(path+'.status','der Status passt nicht zum letzten Eintrag im Angebotsverlauf.');
  return output;
}

/** Validate and migrate a complete backup without mutating or retaining input objects. */
export function validateBackup(input) {
  record(input,'Datei');
  if(![1,2,3].includes(input.version))fail('Version','nur WerkPilot-Sicherungen der Version 1, 2 oder 3 werden unterstützt.');
  inspectStructure(input);
  const output={version:input.version,settings:settings(input.settings,'Einstellungen'),customers:[],jobs:[],invoices:[],quotes:[],expenses:[],owned:[],timeEntries:[],activeTimer:null,demo:boolean(input.demo,'Beispielbetrieb')};
  output.customers=list(input.customers,'Kunden',20000).map((entry,index)=>customer(entry,`Kunde ${index+1}`));unique(output.customers,'Kunden');
  output.jobs=list(input.jobs,'Aufträge',20000).map((entry,index)=>job(entry,`Auftrag ${index+1}`,output.settings));unique(output.jobs,'Aufträge');
  const customerIds=new Set(output.customers.map(c=>c.id)),jobIds=new Set(output.jobs.map(j=>j.id));
  for(const entry of output.jobs){if(entry.customer&&!customerIds.has(entry.customer))fail('Auftrag '+entry.title,'der zugeordnete Kunde fehlt in der Sicherung.');if(entry.parentJob&&!jobIds.has(entry.parentJob))fail('Auftrag '+entry.title,'der ursprüngliche Auftrag fehlt in der Sicherung.');}
  output.invoices=list(input.invoices,'Rechnungen',20000).map((entry,index)=>invoice(entry,`Rechnung ${index+1}`,output.settings));unique(output.invoices,'Rechnungen');unique(output.invoices,'Rechnungsnummern','number');unique(output.invoices.flatMap(i=>i.payments),'Zahlungen');
  for(const entry of output.invoices)if(!jobIds.has(entry.jobId))fail('Rechnung '+entry.number,'der zugehörige Auftrag fehlt in der Sicherung.');
  output.quotes=list(input.version===3?input.quotes:(input.quotes??[]),'Angebote',20000).map((entry,index)=>quote(entry,`Angebot ${index+1}`,output.settings));unique(output.quotes,'Angebote');unique(output.quotes,'Angebotsnummern','number');unique(output.quotes,'Angebotsfolgenummern','sequence');
  const activeOffers=new Set();
  for(const entry of output.quotes){if(!jobIds.has(entry.jobId))fail('Angebot '+entry.number,'der zugehörige Auftrag fehlt in der Sicherung.');if(['draft','sent','accepted'].includes(entry.status)){if(activeOffers.has(entry.jobId))fail('Angebote','mehrere aktive Angebote für denselben Auftrag sind nicht zulässig.');activeOffers.add(entry.jobId);}}
  output.expenses=list(input.expenses,'Ausgaben',20000).map((entry,index)=>{const p=`Ausgabe ${index+1}`;record(entry,p);const result={id:identifier(entry.id,p+'.id'),description:text(entry.description,p+'.description',1000,{required:true}),date:date(entry.date,p+'.date',{past:true}),category:text(entry.category,p+'.category',100,{fallback:'Sonstiges'}),gross:finite(entry.gross,p+'.gross',0,MONEY_LIMIT,{money:true}),tax:finite(entry.tax,p+'.tax',0,100),taxMode:enumeration(entry.taxMode,TAX_MODES,p+'.taxMode',output.settings.taxMode),jobId:identifier(entry.jobId,p+'.jobId',{optional:true}),reference:text(entry.reference,p+'.reference',1000),receipt:entry.receipt===undefined||entry.receipt===null?null:image(entry.receipt,p+'.receipt')};if(result.jobId&&!jobIds.has(result.jobId))fail(p+'.jobId','der zugeordnete Auftrag fehlt.');return result;});unique(output.expenses,'Ausgaben');
  output.owned=list(input.owned,'Gerätebestand',equipment.length).map((value,index)=>enumeration(value,equipment.map(item=>item.id),`Gerätebestand ${index+1}`));unique(output.owned,'Gerätebestand',null);
  output.timeEntries=list(input.timeEntries??[],'Zeitprotokoll',100000).map((entry,index)=>{const p=`Zeiteintrag ${index+1}`;record(entry,p);const result={id:identifier(entry.id,p+'.id'),jobId:identifier(entry.jobId,p+'.jobId'),date:date(entry.date,p+'.date',{past:true}),minutes:finite(entry.minutes,p+'.minutes',.000001,100000),kind:enumeration(entry.kind,TIME_KINDS,p+'.kind'),note:text(entry.note,p+'.note',2000),source:text(entry.source,p+'.source',100,{fallback:'Manuell'})};if(!jobIds.has(result.jobId))fail(p+'.jobId','der zugeordnete Auftrag fehlt.');return result;});unique(output.timeEntries,'Zeitprotokoll');
  if(input.activeTimer!==undefined && input.activeTimer!==null){record(input.activeTimer,'Stoppuhr');const timer={jobId:identifier(input.activeTimer.jobId,'Stoppuhr.jobId'),kind:enumeration(input.activeTimer.kind,TIME_KINDS,'Stoppuhr.kind'),started:finite(input.activeTimer.started,'Stoppuhr.started',1,Date.now()+60000,{integer:true})};if(!jobIds.has(timer.jobId))fail('Stoppuhr','der zugeordnete Auftrag fehlt.');output.activeTimer=timer;}
  return migrateState(output);
}
