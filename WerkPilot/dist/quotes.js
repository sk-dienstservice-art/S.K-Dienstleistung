import {defaults,services,calculate,uid,today,validISODate,roundMoney} from './core.js';

export const QUOTE_STATUSES=['draft','sent','accepted','declined','withdrawn'];
const QUOTE_TRANSITIONS={draft:['sent','declined','withdrawn'],sent:['accepted','declined','withdrawn'],accepted:[],declined:[],withdrawn:[]};
const ID_PATTERN=/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const PREFIX_PATTERN=/^[A-Za-z0-9][A-Za-z0-9_-]{0,11}$/;

function quoteDate(value,label){if(!validISODate(value))throw Error(`${label}: Bitte ein echtes Kalenderdatum angeben.`);return value}
function addDays(date,days){const day=new Date(date+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+days);return day.toISOString().slice(0,10)}
function latestEventDate(quote){return quote.events?.at(-1)?.date||quote.created}
function existingQuotes(state){return state.quotes||[]}
function nextSequence(state){let next=Math.max(1,Number(state.settings?.nextQuoteNumber)||1);for(const quote of existingQuotes(state)){const value=Number.isSafeInteger(quote.sequence)?quote.sequence:Number(String(quote.number||'').split('-').at(-1));if(Number.isSafeInteger(value)&&value>=next)next=value+1}if(!Number.isSafeInteger(next)||next>999999999)throw Error('Die nächste Angebotsnummer ist ungültig. Bitte den Nummernkreis prüfen.');return next}

/** Create or reuse a frozen draft without mutating business state. */
export function createQuote(state,jobId,{date=today(),validUntil,id}={}){
 quoteDate(date,'Angebotsdatum');
 const job=state.jobs?.find(job=>job.id===jobId);if(!job)throw Error('Der Auftrag für das Angebot wurde nicht gefunden.');
 if(job.status==='Storniert')throw Error('Für einen stornierten Auftrag kann kein Angebot erstellt werden.');
 const quotes=existingQuotes(state).filter(quote=>quote.jobId===jobId);
 if(quotes.some(quote=>['sent','accepted'].includes(quote.status)))throw Error('Für diesen Auftrag besteht bereits ein versendetes oder angenommenes Angebot. Prüfe zuerst das bestehende Angebot.');
 const draft=quotes.find(quote=>quote.status==='draft');if(draft)return structuredClone(draft);
 const customer=state.customers?.find(customer=>customer.id===job.customer);if(!customer?.name?.trim())throw Error('Bitte dem Auftrag einen Kunden mit Namen zuordnen.');
 const company={...defaults,...state.settings},prefix=company.quotePrefix;
 if(typeof prefix!=='string'||!PREFIX_PATTERN.test(prefix))throw Error('Angebotspräfix: 1 bis 12 Buchstaben/Zahlen, Bindestrich oder Unterstrich verwenden.');
 const days=Number(company.quoteDays);if(!Number.isInteger(days)||days<1||days>365)throw Error('Die Angebotsgültigkeit muss zwischen 1 und 365 Tagen liegen.');
 validUntil=validUntil??addDays(date,days);quoteDate(validUntil,'Gültig bis');if(validUntil<date)throw Error('Das Angebot darf nicht vor seinem Angebotsdatum ablaufen.');
 const sequence=nextSequence(state),number=`${prefix}-${date.slice(0,4)}-${String(sequence).padStart(4,'0')}`;
 if(existingQuotes(state).some(quote=>quote.number===number))throw Error('Die Angebotsnummer ist bereits vergeben. Bitte den Nummernkreis prüfen.');
 const quoteId=id??uid();if(typeof quoteId!=='string'||!ID_PATTERN.test(quoteId)||existingQuotes(state).some(quote=>quote.id===quoteId))throw Error('Die Angebotskennung ist ungültig oder bereits vergeben.');
 const frozenJob=structuredClone(job),frozenCompany=structuredClone(company),calc=calculate(frozenJob,frozenCompany);
 if(!job.lines?.length||job.lines.some(line=>!services.some(service=>service.id===line.service)||!Number.isFinite(line.qty)||line.qty<=0||!Number.isFinite(line.rate)||line.rate<0)||!['net','tax','gross','costs'].every(key=>Number.isFinite(calc[key])&&calc[key]>=0))throw Error('Bitte zuerst einen gültigen Leistungsumfang kalkulieren.');
 return {id:quoteId,number,sequence,jobId,created:date,validUntil,status:'draft',job:frozenJob,customer:structuredClone(customer),company:frozenCompany,calc:structuredClone(calc),events:[{status:'draft',date,note:'Angebotsentwurf erstellt'}]};
}

/** Return the next status with a dated history; completed or withdrawn offers remain final. */
export function changeQuoteStatus(quote,status,{date=today(),note=''}={}){
 if(!QUOTE_STATUSES.includes(status)||!QUOTE_STATUSES.includes(quote.status))throw Error('Unbekannter Angebotsstatus.');
 quoteDate(date,'Statusdatum');if(date<quote.created||date<latestEventDate(quote))throw Error('Ein Statusdatum darf nicht vor dem letzten Angebotsschritt liegen.');
 if(typeof note!=='string'||note.length>2000)throw Error('Die Angebotsnotiz darf höchstens 2.000 Zeichen enthalten.');
 if(status===quote.status)return structuredClone(quote);
 if(!QUOTE_TRANSITIONS[quote.status].includes(status))throw Error('Dieser Angebotsstatus kann nicht mehr geändert werden. Ein neuer Umfang benötigt ein neues Angebot.');
 if(['sent','accepted'].includes(status)&&quote.validUntil<date)throw Error('Dieses Angebot ist abgelaufen. Bitte zur Überarbeitung zurückziehen und ein neues Angebot mit aktueller Gültigkeit erstellen.');
 const result=structuredClone(quote);result.status=status;result.events??=[];result.events.push({status,date,note:note.trim()});return result;
}

export function quoteSummary(quote,reference=today()){
 quoteDate(reference,'Auswertungsdatum');
 const open=['draft','sent'].includes(quote.status),expired=open&&quote.validUntil<reference;
 const daysRemaining=Math.round((Date.parse(quote.validUntil+'T00:00:00Z')-Date.parse(reference+'T00:00:00Z'))/86400000);
 return {status:quote.status,open,expired,active:open&&!expired,daysRemaining,net:quote.calc.net,gross:quote.calc.gross,needsFollowUp:quote.status==='sent'&&!expired&&Math.round((Date.parse(reference+'T00:00:00Z')-Date.parse(latestEventDate(quote)+'T00:00:00Z'))/86400000)>=3};
}

/** Pipeline figures represent offer values, never booked revenue. */
export function quotePipeline(stateOrQuotes,reference=today()){
 quoteDate(reference,'Auswertungsdatum');const quotes=Array.isArray(stateOrQuotes)?stateOrQuotes:existingQuotes(stateOrQuotes);
 const byStatus=Object.fromEntries(QUOTE_STATUSES.map(status=>[status,{count:0,net:0,gross:0}]));let open=0,openNet=0,openGross=0;const expiredQuotes=[],followUps=[];
 for(const quote of quotes){const summary=quoteSummary(quote,reference),group=byStatus[quote.status];if(!group)continue;group.count++;group.net=roundMoney(group.net+summary.net);group.gross=roundMoney(group.gross+summary.gross);if(summary.expired)expiredQuotes.push(quote);if(summary.needsFollowUp)followUps.push(quote);if(summary.active){open++;openNet=roundMoney(openNet+summary.net);openGross=roundMoney(openGross+summary.gross)}}
 const decided=byStatus.accepted.count+byStatus.declined.count;
 return {total:quotes.length,byStatus,draft:byStatus.draft.count,sent:byStatus.sent.count,accepted:byStatus.accepted.count,declined:byStatus.declined.count,withdrawn:byStatus.withdrawn.count,open,openNet,openGross,acceptedNet:byStatus.accepted.net,acceptedGross:byStatus.accepted.gross,expired:expiredQuotes.length,expiredQuotes,followUps,conversionRate:decided?byStatus.accepted.count/decided*100:0};
}
