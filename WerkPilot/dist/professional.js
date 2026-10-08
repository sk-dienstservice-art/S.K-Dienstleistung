import {services,defaults,roundMoney,calculate} from './core.js';

export function configuredRate(service,settings={}) {
  const item=typeof service==='string'?services.find(s=>s.id===service):service;
  if(!item)throw Error('Unbekannte Dienstleistung.');
  const custom=settings.serviceRates?.[item.id];
  return Number.isFinite(custom)&&custom>=0?roundMoney(custom):item.rate;
}

export function configuredTravelPrice(job,settings={}) {
  return roundMoney((Number(job.travelHours)||0)*(settings.travelHourlyRate??defaults.travelHourlyRate)
    +(Number(job.km)||0)*(settings.travelKmRate??defaults.travelKmRate));
}

export function companySetup(state) {
  const s=state.settings||{};
  return [
    {id:'company',label:'Firmenname und Inhaber',done:!!(s.company?.trim()&&s.company!==defaults.company&&s.owner?.trim()),view:'settings'},
    {id:'address',label:'Geschäftsadresse und Kontakt',done:!!(s.address?.trim()&&(s.email?.trim()||s.phone?.trim())),view:'settings'},
    {id:'tax',label:'Steuerangaben für Dokumente',done:!!(s.taxId?.trim()&&s.businessStart),view:'settings'},
    {id:'prices',label:'Eigene Leistungs- und Fahrtpreise',done:Object.keys(s.serviceRates||{}).length>0,view:'rates'},
    {id:'customer',label:'Ersten Kunden anlegen',done:(state.customers||[]).length>0,action:'new-customer'},
    {id:'job',label:'Ersten Auftrag kalkulieren',done:(state.jobs||[]).length>0,action:'new-job'}
  ];
}

export function prepareAssistantDraft(base,parsed,settings,previous=null) {
  const continuing=!!(previous&&(parsed.correction||parsed.costOnly||parsed.followUpCosts));
  const job=structuredClone(continuing?previous:base);
  if(!continuing){job.km=0;job.travelHours=0;job.travelPrice=0;job.material=0;job.rental=0;job.disposal=0;}
  if(parsed.lines?.length)job.lines=parsed.lines.map(l=>({service:l.service,qty:l.qty,rate:configuredRate(l.service,settings)}));
  const costs=parsed.costs||{};
  for(const key of ['travelHours','km','material','rental','disposal','travelPrice']){
    if(costs[key]===undefined)continue;
    if(!Number.isFinite(costs[key])||costs[key]<0)throw Error('Ungültiger Kostenwert: '+key);
    job[key]=costs[key];
  }
  if(costs.travelPrice===undefined&&(costs.travelHours!==undefined||costs.km!==undefined)){
    job.travelPrice=configuredTravelPrice(job,settings);
  }
  if(parsed.route){job.routeFrom=parsed.route.from||'';job.routeTo=parsed.route.to||'';}
  return job;
}

/** Raise proposed service prices only when the recorded cost basis misses the target. */
export function priceForTargetMargin(input,settings) {
  const job=structuredClone(input);
  const before=calculate(job,settings),target=job.costSettings?.targetMargin??settings.targetMargin;
  let calc=before;
  if(calc.margin+0.000001<target&&calc.serviceNet===0&&job.lines?.length){
    const weight=job.lines.reduce((sum,line)=>sum+line.qty*((line.minutes??services.find(s=>s.id===line.service)?.minutes)||1),0);
    const shortfall=Math.max(0,calc.suggested-calc.net)+0.01;
    job.lines=job.lines.map(line=>({...line,rate:Math.ceil(shortfall*((line.minutes??services.find(s=>s.id===line.service)?.minutes)||1)/weight*100)/100}));
    calc=calculate(job,settings);
  }
  for(let attempt=0;attempt<3&&calc.margin+0.000001<target&&calc.serviceNet>0;attempt++){
    const scale=(calc.serviceNet+Math.max(0,calc.suggested-calc.net)+0.01)/calc.serviceNet;
    job.lines=job.lines.map(line=>({...line,rate:Math.ceil(line.rate*scale*100)/100}));
    calc=calculate(job,settings);
  }
  return {job,calc,adjusted:calc.net>before.net,before:before.net};
}

export function mergeSiteDetails(previous={},update={}) {
  const site={...previous,...update};
  const uncertain=new Set((previous.uncertain||[]).filter(key=>!Object.hasOwn(update,key)));
  for(const key of update.uncertain||[]){uncertain.add(key);delete site[key];}
  if(uncertain.size)site.uncertain=[...uncertain];else delete site.uncertain;
  return site;
}
