import {services,equipment,requiredEquipment,calculate,roundMoney} from './core.js';
import {materialSuggestions} from './trades.js';

const BASE_MATERIALS={
 lawn:[['Schnittgutsäcke','Stück',.01,'Nach Schnittgutmenge und Wiederverwendung prüfen.']],
 hedge:[['Grünschnittsäcke','Stück',.1,'Grobe Verpackungsannahme, kein Volumenaufmaß.']],
 radical:[['Grünschnittsäcke','Stück',.2,'Lose Menge und geeignete Verladung separat aufnehmen.']],
 shape:[['Grünschnittsäcke','Stück',.1,'Verpackung passend zum tatsächlichen Schnittgut.']],
 weeds:[['Abfallsäcke','Stück',.02,'Befall und Materialtrennung prüfen.']],
 landscape:[['Abfallsäcke','Stück',1,'Planwert je Arbeitsstunde; Mulch/Pflanzen zusätzlich erfassen.']],
 home:[['Materialgerechter Reiniger','Liter',.005,'Nur grober Ansatz; Produktdosierung und Oberfläche bestätigen.']],
 house:[['Materialgerechter Reiniger','Liter',.005,'Produktdosierung und Oberfläche bestätigen.']],
 deep:[['Freigegebener Grundreiniger','Liter',.01,'Testfläche und Herstellerdosierung bestimmen den Verbrauch.']],
 window:[['Glasreiniger','Liter',.003,'Tatsächliches Verfahren und Herstellerdosierung prüfen.']],
 stairs:[['Materialgerechter Reiniger','Liter',.05,'Planwert je Etage; tatsächliche Fläche und Dosierung prüfen.']],
 office:[['Materialgerechter Reiniger','Liter',.004,'Leistungsverzeichnis und Dosierung bestätigen.']],
 practice:[['Mittel gemäß Hygieneplan','Liter',.006,'Kein Misch- oder Dosierungsrezept; freigegebene Mittel und Hygieneplan bestätigen.']]
};

export function suggestResources(job,owned=[]){
 const rows=[];
 for(const [index,line]of (job.lines||[]).entries()){
  if(!Number.isFinite(line.qty)||line.qty<=0)continue;
  const generic=(BASE_MATERIALS[line.service]||[]).map(([name,unit,factor,note],i)=>({id:line.service+'-'+i,name,unit,qty:Math.ceil(line.qty*factor*100)/100,note}));
  for(const [i,item]of [...generic,...materialSuggestions(line.service,line.qty)].entries())rows.push({id:'material-'+index+'-'+i,kind:'material',name:item.name,unit:item.unit,quantity:item.qty,unitCost:0,costConfirmed:false,use:true,note:item.note||''});
 }
 for(const eq of requiredEquipment(job).filter(Boolean))rows.push({id:'machine-'+eq.id,kind:'machine',equipmentId:eq.id,name:eq.name,unit:'Einsatz',quantity:1,unitCost:0,costConfirmed:false,use:true,mode:owned.includes(eq.id)?'owned':'rent',note:owned.includes(eq.id)?'Bestand bestätigt. Tatsächliche Einsatzkosten prüfen, auch 0 € ausdrücklich bestätigen.':'Verfügbarkeit und tatsächliche Miete/Einsatzkosten beim Anbieter bestätigen. Kaufpreis wird nicht als Miete gerechnet.'});
 const combined=[];
 for(const row of rows){const same=combined.find(r=>r.kind==='material'&&row.kind==='material'&&r.name===row.name&&r.unit===row.unit);if(same)same.quantity=roundMoney(same.quantity+row.quantity);else combined.push({...row,source:'suggestion'});}
 return combined;
}

export function refreshResourceSuggestions(existing,suggestions){
 const key=row=>row.kind==='machine'&&row.equipmentId?'machine-'+row.equipmentId:row.kind+'-'+row.name+'-'+row.unit;
 const previous=new Map((existing||[]).map(row=>[key(row),row]));
 const used=new Set((existing||[]).map(row=>row.id));
 const updated=(suggestions||[]).map(row=>{const old=previous.get(key(row));if(!old){const result=structuredClone(row),stem=String(result.id).slice(0,80);let n=1;while(used.has(result.id))result.id=stem+'-'+n++;used.add(result.id);return result;}const changed=old.quantity!==row.quantity;return {...structuredClone(row),id:old.id,unitCost:old.unitCost,costConfirmed:changed?false:old.costConfirmed,use:old.use,mode:old.mode||row.mode};});
 const current=new Set(updated.map(key));
 for(const row of existing||[])if(row.source!=='suggestion'&&!current.has(key(row)))updated.push(structuredClone(row));
 return updated;
}

export function resourceTotals(rows=[]){
 let material=0,rental=0;const missing=[];
 for(const row of rows){
  if(row.use!==true)continue;
  if(!['material','machine'].includes(row.kind)||!Number.isFinite(row.quantity)||row.quantity<=0||!Number.isFinite(row.unitCost)||row.unitCost<0||row.costConfirmed!==true){missing.push(row.name||'Unbekannte Position');continue;}
  const amount=roundMoney(row.quantity*row.unitCost);
  if(row.kind==='material')material=roundMoney(material+amount);else rental=roundMoney(rental+amount);
 }
 return {material,rental,total:roundMoney(material+rental),missing,complete:missing.length===0};
}

export function applyResourceCosts(job){
 const totals=resourceTotals(job.resources||[]);
 if(!(job.resources||[]).some(r=>r.use))throw Error('Mindestens eine Material- oder Maschinenposition auswählen.');
 if(!totals.complete)throw Error('Menge und Kosten bestätigen: '+totals.missing.join(', '));
 const updated=structuredClone(job);
 updated.material=totals.material;updated.rental=totals.rental;updated.resourceCostsApplied=true;
 return updated;
}

export function planningSummary(job,settings){
 const calc=calculate(job,settings),resources=resourceTotals(job.resources||[]),machines=requiredEquipment(job).filter(Boolean);
 return {personHours:calc.hours,recommendedDuration:Math.max(.25,Math.ceil(calc.hours*4)/4),resources,machines,serviceCount:(job.lines||[]).length,materialNotes:(job.resources||[]).filter(r=>r.kind==='material'&&r.use).map(r=>r.name+' · '+r.quantity+' '+r.unit),checks:[
  {id:'scope',label:'Leistungen und Aufmaß erfasst',done:(job.lines||[]).length>0&&(job.lines||[]).every(l=>services.some(s=>s.id===l.service)&&l.qty>0)},
  {id:'client',label:'Kunde zugeordnet',done:Boolean(job.customer)},
  {id:'resources',label:'Material und Maschinenkosten bestätigt',done:(job.resources||[]).some(r=>r.use)&&resources.complete&&job.resourceCostsApplied===true},
  {id:'date',label:'Einsatztermin eingetragen',done:Boolean(job.date)},
  {id:'margin',label:'Zielmarge erreicht',done:calc.margin+0.01>=Number(job.costSettings?.targetMargin??settings.targetMargin??25)}
 ]};
}
