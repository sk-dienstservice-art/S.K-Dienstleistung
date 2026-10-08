import {bundleApp} from '../scripts/bundle.mjs';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

// These checks exercise user flows with DOM doubles; they are not visual or device tests.
function harness() {
  const element = () => ({
    innerHTML: '', textContent: '', value: '', style: {}, dataset: {}, open: false,
    disabled: false, files: [], listeners: {}, addEventListener(name, callback) { this.listeners[name] = callback; },
    showModal() { this.open = true; }, close() { this.open = false; },
    querySelector() { return element(); }, querySelectorAll() { return []; },
    classList: { toggle() {} }, setAttribute() {}, removeAttribute() {},
  });
  const elements = new Map();
  const context = vm.createContext({
    document: { querySelector(selector) { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); }, querySelectorAll() { return []; }, addEventListener() {} },
    window: {}, navigator: {}, location: { protocol: 'file:' }, crypto: webcrypto,
    structuredClone, console, Date, Intl, Map, Set, JSON, Number, String, Array, Math,
    setTimeout, clearTimeout, Blob, URL, TextEncoder, EventTarget, Event, DOMException,
    confirm: () => false,
    FormData: function (target) { return new Map(Object.entries(target.data || {})); },
  });
  vm.runInContext(bundleApp(process.cwd(),{stripBoot:true}), context);
  context.originalPersist = vm.runInContext('persist', context);
  vm.runInContext('render=()=>{};persist=async()=>{};', context);
  return { context, elements, run: source => vm.runInContext(source, context) };
}

let failures = 0;
async function check(name, callback) {
  try { await callback(); console.log('UI REGRESSION PASS:', name); }
  catch (error) { failures++; console.error('UI REGRESSION FAIL:', name, '\n ', error.message); }
}

await check('Activating an overlapping offer honours a declined conflict confirmation', async () => {
  const { run } = harness();
  run(`state=initial();state.customers=[{id:'customer',name:'Kunde'}];
    const first={...newDraft(),id:'first',customer:'customer',title:'Bestehender Einsatz',status:'Geplant',date:'2050-10-01',time:'09:00',duration:2};
    const offer={...first,id:'offer',title:'Angebot',status:'Angebot',time:'10:00'};
    state.jobs=[first,offer];`);
  await run("handleAction('job-status',{dataset:{id:'offer',status:'Geplant'}})");
  assert.equal(run("state.jobs.find(j=>j.id==='offer').status"), 'Angebot');
});

await check('Adding a measured photo service keeps already entered services', async () => {
  const { run, elements } = harness();
  run("state=initial();view='photos';draft=newDraft();draft.title='Garten und Fenster';draft.lines=[{service:'lawn',qty:200,rate:0.9}];bindPage()");
  const form = elements.get('#photo-measure-form');
  form.data = { 'photo-service': 'window', 'photo-qty': '20', 'photo-height': 'Erdgeschoss' };
  await form.onsubmit({ preventDefault() {}, target: form });
  assert.equal(run("draft.lines.some(l=>l.service==='lawn'&&l.qty===200)"), true);
  assert.equal(run("draft.lines.some(l=>l.service==='window'&&l.qty===20)"), true);
});

await check('A new photo calculation contains only the measured service', async () => {
  const { run, elements } = harness();
  run("state=initial();view='photos';draft=null;bindPage()");
  const form = elements.get('#photo-measure-form');
  form.data = { 'photo-service': 'window', 'photo-qty': '20', 'photo-height': 'Erdgeschoss' };
  await form.onsubmit({ preventDefault() {}, target: form });
  assert.equal(run('draft.lines.length'), 1);
  assert.equal(run('draft.lines[0].service'), 'window');
});

await check('Late model results cannot attach suggestions to a different photo', async () => {
  const { run, context } = harness();
  let resolve;
  context.modelResult = new Promise(res => { resolve = res; });
  run("view='photos';photo={name:'A',data:'data:image/jpeg;base64,QQ=='};photoSuggestions=[];photoRecognizer={recognize:()=>modelResult,cancel(){},retry(){},getState(){return{stage:'idle',busy:false}}}");
  const pending = run('analyzePhoto()');
  run("photo={name:'B',data:'data:image/jpeg;base64,Qg=='};photoSuggestions=[];");
  resolve({status:'ok',suggestions:[{service:{id:'lawn',name:'Rasen mähen'},score:.8}],alternatives:[]});
  await pending;
  assert.equal(run('photoSuggestions.length'), 0);
});

await check('An older image read cannot replace a more recently selected photo', async () => {
  const { run, context, elements } = harness();
  const pending = new Map();
  context.loadPhoto = file => new Promise(resolve => { pending.set(file.name, resolve); });
  run("view='photos';readImage=loadPhoto;bindPage()");
  const handler = elements.get('#photo-file').onchange;
  const first = handler({ target: { files: [{ name: 'A' }] } });
  const second = handler({ target: { files: [{ name: 'B' }] } });
  pending.get('B')({ name: 'B', data: 'B' }); await second;
  pending.get('A')({ name: 'A', data: 'A' }); await first;
  assert.equal(run('photo.name'), 'B');
});

await check('A failed payment write keeps the last durable ledger', async () => {
  const { run } = harness();
  run(`state=initial();state.invoices=[{id:'invoice',number:'RE-2050-0001',calc:{gross:100,net:100,tax:0},customer:{name:'Kunde'},payments:[],paid:''}];
    if(typeof durableState!=='undefined')durableState=structuredClone(state);
    recordPayment(state.invoices[0],{id:'payment',date:today(),amount:10});
    persist=originalPersist;db=null;`);
  assert.equal(await run('commit()'), false);
  assert.equal(run('invoiceBalance(state.invoices[0]).paid'), 0);
});

await check('An unsuccessful restore preserves existing data and the restore candidate', async () => {
  const { run } = harness();
  run(`state=initial();state.customers=[{id:'old',name:'Bestehender Kunde'}];
    if(typeof durableState!=='undefined')durableState=structuredClone(state);
    window.pendingRestore=initial();window.pendingRestore.customers=[{id:'restored',name:'Wiederhergestellter Kunde'}];
    persist=originalPersist;db=null;`);
  await run("handleAction('confirm-restore',{dataset:{}})");
  assert.equal(run('state.customers[0].id'), 'old');
  assert.equal(run('window.pendingRestore?.customers[0].id'), 'restored');
});

await check('Queued snapshots are rejected after a write failure and do not resurrect failed changes', async () => {
  const { run, context } = harness();
  let transactionNumber = 0;
  let written = { owned: [] };
  context.testDatabase = { transaction() {
    const shouldFail = ++transactionNumber === 1;
    const transaction = { error: Error('QuotaExceededError'), objectStore() { return { put(next) {
      queueMicrotask(() => {
        if (shouldFail) transaction.onerror();
        else { written = structuredClone(next); transaction.oncomplete(); }
      });
    } }; } };
    return transaction;
  } };
  run("state=initial();if(typeof durableState!=='undefined')durableState=structuredClone(state);persist=originalPersist;db=testDatabase;state.owned=['mower']");
  const first = run('persist()');
  run("state.owned.push('vacuum')");
  const second = run('persist()');
  const results = await Promise.allSettled([first, second]);
  assert.equal(results[0].status, 'rejected');
  assert.equal(results[1].status, 'rejected');
  assert.equal(transactionNumber, 1);
  assert.deepEqual(Array.from(run('state.owned')), Array.from(written.owned));
});

await check('Repeated payment submit before storage completes records only one payment', async () => {
  const { run, context, elements } = harness();
  let complete;
  context.pendingStore = new Promise(resolve => { complete = resolve; });
  run(`state=initial();state.invoices=[{id:'invoice',number:'RE-2050-0001',issued:today(),due:today(),calc:{gross:100,net:100,tax:0},customer:{name:'Kunde'},payments:[],paid:''}];
    if(typeof durableState!=='undefined')durableState=structuredClone(state);
    persist=()=>pendingStore;paymentDialog('invoice');`);
  const form = elements.get('#payment-form');
  form.data = { paid: run('today()'), amount: '10', method: 'Bar', note: 'Anzahlung' };
  const first = form.onsubmit({ preventDefault() {}, target: form });
  const second = form.onsubmit({ preventDefault() {}, target: form });
  const count = run('state.invoices[0].payments.length');
  complete(); await Promise.all([first, second]);
  assert.equal(count, 1);
  assert.equal(run('invoiceBalance(state.invoices[0]).paid'), 10);
});

await check('Retrying a payment after a failed write uses the current ledger', async () => {
  const { run, context, elements } = harness();
  let written;
  context.recoveredDatabase = { transaction() {
    const transaction = { objectStore() { return { put(next) {
      queueMicrotask(() => { written = structuredClone(next); transaction.oncomplete(); });
    } }; } };
    return transaction;
  } };
  run(`state=initial();state.invoices=[{id:'invoice',number:'RE-2050-0001',issued:today(),due:today(),calc:{gross:100,net:100,tax:0},customer:{name:'Kunde'},payments:[],paid:''}];
    if(typeof durableState!=='undefined')durableState=structuredClone(state);
    persist=originalPersist;db=null;paymentDialog('invoice');`);
  const form = elements.get('#payment-form');
  form.data = { paid: run('today()'), amount: '10', method: 'Bar', note: 'Anzahlung' };
  await form.onsubmit({ preventDefault() {}, target: form });
  assert.equal(run('invoiceBalance(state.invoices[0]).paid'), 0);
  run('db=recoveredDatabase');
  await form.onsubmit({ preventDefault() {}, target: form });
  assert.equal(run('invoiceBalance(state.invoices[0]).paid'), 10);
  assert.equal(written.invoices[0].payments.length, 1);
  assert.equal(written.invoices[0].payments[0].amount, 10);
});

await check('The other-exemption mode clears the tax rate in the job form', async () => {
  const { run, elements } = harness();
  run("state=initial();draft=newDraft();view='calc';bindPage()");
  const form = elements.get('#job-form');
  form.data = { ...run('draft'), taxMode: 'exempt', tax: '19' };
  form.listeners.change({ target: { name: 'taxMode', value: 'exempt', dataset: {} } });
  assert.equal(run('draft.tax'), 0);
});

await check('Other-exemption documents explain the exemption without a 19% tax row', async () => {
  const { run } = harness();
  run("state=initial();const exemptJob={...newDraft(),taxMode:'exempt',tax:19};");
  const html = run('documentHTML(exemptJob)');
  assert.match(html, /Steuerbefreiungsgrund/);
  assert.ok(!html.includes('Umsatzsteuer (19 %):'));
});

await check('A typed question clears an older reply waiting for the device voice', async () => {
  const { run, context } = harness();
  let voices = [];
  const spoken = [];
  context.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  context.window.speechSynthesis = { getVoices() { return voices; }, cancel() {}, speak(utterance) { spoken.push(utterance.text); } };
  run("state=initial();view='assistant';state.settings.speech=false;state.settings.handsFree=true;voiceController.continueAllowed=true;speak('Veraltete Antwort')");
  assert.equal(run('voiceController.pendingSpeech'), 'Veraltete Antwort');
  await run("ask('Kalkuliere hundert Quadratmeter Rasen')");
  assert.equal(run('voiceController.pendingSpeech'), '');
  assert.equal(run('voiceController.continueAllowed'), false);
  voices = [{ name: 'Microsoft Stefan', lang: 'de-DE', voiceURI: 'stefan', localService: true }];
  run('refreshVoiceControls()');
  assert.equal(spoken.length, 0);
});

await check('Correcting an expense replaces its amount and reference while keeping its receipt', async () => {
  const { run, elements } = harness();
  run(`state=initial();state.jobs=[{...newDraft(),id:'job',title:'Fensterreinigung',actualCostsComplete:true}];
    state.expenses=[{id:'expense',date:today(),description:'Material',category:'Material',gross:100,tax:19,taxMode:'small',jobId:'job',reference:'Alt-001',receipt:{name:'original.jpg',data:'data:image/jpeg;base64,QQ=='}}]`);
  await run("expenseForm('','expense')");
  const form = elements.get('#expense-form');
  form.data = { description: 'Glasreiniger korrigiert', date: run('today()'), category: 'Material', gross: '25.50', tax: '19', taxMode: 'small', jobId: 'job', reference: 'Neu-002' };
  await form.onsubmit({ preventDefault() {}, target: form });
  assert.equal(run('state.expenses.length'), 1);
  assert.equal(run('state.expenses[0].id'), 'expense');
  assert.equal(run('state.expenses[0].gross'), 25.5);
  assert.equal(run('state.expenses[0].reference'), 'Neu-002');
  assert.equal(run('state.expenses[0].receipt.name'), 'original.jpg');
  assert.equal(run('state.expenses[0].receipt.data'), 'data:image/jpeg;base64,QQ==');
  assert.equal(run('state.jobs[0].actualCostsComplete'), false);
  assert.equal(run('actualResult(state,state.jobs[0]).expenseTotal'), 25.5);
});

await check('A failed checklist write redraws the durable checkbox state in the open dialog', async () => {
  const { run, context, elements } = harness();
  run(`state=initial();state.jobs=[{...newDraft(),id:'job',title:'Auftrag mit Checkliste'}];
    if(typeof durableState!=='undefined')durableState=structuredClone(state);
    persist=originalPersist;db=null;`);
  context.checkTarget = { dataset: { id: 'job', task: run('jobTasks(state.jobs[0])[0]') }, checked: true, closest() { return { classList: { toggle() {} } }; } };
  await run("handleAction('task-check',checkTarget)");
  assert.equal(run('state.jobs[0].checks.length'), 0);
  const html = elements.get('#dialog').innerHTML;
  assert.match(html, /Checkliste für den Einsatz/);
  assert.ok(!/data-action="task-check"[^>]*\schecked(?:\s|>)/.test(html));
});

await check('A failed completion write redraws the durable completeness setting', async () => {
  const { run, elements } = harness();
  run(`state=initial();state.jobs=[{...newDraft(),id:'job',title:'Nachkalkulation',actualTimeComplete:false}];
    if(typeof durableState!=='undefined')durableState=structuredClone(state);
    persist=originalPersist;db=null;`);
  await run("handleAction('actual-complete',{dataset:{id:'job',field:'actualTimeComplete'},checked:true})");
  assert.equal(run('state.jobs[0].actualTimeComplete'), false);
  const html = elements.get('#dialog').innerHTML;
  assert.match(html, /data-field="actualTimeComplete"/);
  assert.ok(!/data-field="actualTimeComplete"[^>]*\schecked(?:\s|>)/.test(html));
});

if (failures) process.exitCode = 1;
