import vm from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { bundleApp } from '../scripts/bundle.mjs';

// Operational flow checks with DOM doubles. No browser, networking, or device claims.
function harness() {
  const elements = new Map();
  const opened = [], persisted = [], printed = [];
  const timers = new Map(), documentListeners = new Map();
  let timerID = 0;
  function element() {
    return {
      innerHTML: '', textContent: '', value: '', style: {}, dataset: {}, open: false,
      disabled: false, files: [], listeners: {}, attributes: {},
      addEventListener(name, callback) { this.listeners[name] = callback; },
      showModal() { this.open = true; }, close() { this.open = false; },
      querySelector() { return element(); }, querySelectorAll() { return []; },
      setAttribute(key, value) { this.attributes[key] = String(value); },
      removeAttribute(key) { delete this.attributes[key]; },
      classList: { toggle() {}, add() {}, remove() {} },
      click() { if (this.href) opened.push(this.href); },
      getBoundingClientRect() { return { left: 0, right: 100, top: 0, bottom: 100 }; },
    };
  }
  const document = {
    documentElement: { dataset: {}, style: { setProperty() {} } },
    body: { dataset: {}, classList: { toggle() {}, add() {}, remove() {} } },
    querySelector(selector) { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); },
    querySelectorAll(selector) { return selector === 'form' ? [...elements].filter(([key]) => key.endsWith('-form')).map(([, value]) => value) : []; },
    createElement() { return element(); }, addEventListener(name, callback) { documentListeners.set(name, callback); },
  };
  const location = { protocol: 'file:', hostname: '', search: '', href: 'file:///WerkPilot.html', origin: 'null' };
  const window = { location, persisted, opened, document, savedStates: persisted, scrollTo() {},
    open(url) { opened.push(url); return null; },
    print() { printed.push(document.querySelector('#print').innerHTML); },
    matchMedia() { return { matches: false, addEventListener() {} }; },
  };
  const context = vm.createContext({
    document, window, location, navigator: {}, crypto: webcrypto, structuredClone,
    console, Date, Intl, Map, Set, JSON, Number, String, Array, Math, Promise,
    Blob, URL, URLSearchParams, TextEncoder, EventTarget, Event, DOMException,
    setTimeout(callback) { const id = ++timerID; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); }, confirm: () => true,
    FormData: function (target) { return new Map(Object.entries(target.data || {})); },
  });
  vm.runInContext(bundleApp(process.cwd(), { stripBoot: true }), context);
  vm.runInContext("persist=async()=>{durableState=structuredClone(state);window.persisted.push(structuredClone(state))};", context);
  const run = source => vm.runInContext(source, context);
  async function clickAction(action, details = {}) {
    const target = { dataset: { action, ...details }, tagName: 'BUTTON',
      closest() { return this; }, hasAttribute() { return false; }, matches() { return false; } };
    await documentListeners.get('click')({ target, preventDefault() {} });
  }
  function seed() {
    run(`state=initial();state.settings={...state.settings,company:'Grün & Klar',owner:'Max Beispiel',address:'Gartenweg 4, 10115 Berlin',email:'betrieb@example.com',phone:'+49 30 123456',taxId:'12/345/67890',iban:'DE89370400440532013000',businessStart:'2025-01-02',quotePrefix:'ANG',quoteDays:14,nextQuoteNumber:1};
      state.customers=[{id:'customer',name:'Familie Sommer',type:'Privatkunde',address:'Sommerweg 6, 10115 Berlin',email:'kunde@example.com',phone:'+49 30 987654',notes:''}];
      state.jobs=[{...newDraft(),id:'job',title:'Fensterpflege',customer:'customer',lines:[{service:'window',qty:20,rate:5}],travelPrice:15,siteDetails:{siteInspected:true,safetyPlanConfirmed:true},date:'2050-10-01',time:'09:00',duration:2}];
      durableState=structuredClone(state);`);
  }
  return { run, context, elements, opened, persisted, printed, seed, location, clickAction };
}

test('Ein eigener Betrieb erhält sein Branding sicher im Arbeitsplatz', () => {
  const h = harness(); h.seed();
  h.run("state.settings.company='Sommer & Sohn';view='workspace';render()");
  const html = h.elements.get('#app').innerHTML;
  assert.match(html, /Sommer &amp; Sohn/);
  assert.match(html, /Arbeitsplatz|Betrieb/);
  h.run("state.settings.company='<img src=x onerror=alert(1)>';render()");
  const escaped = h.elements.get('#app').innerHTML;
  assert.ok(escaped.includes('&lt;img'));
  assert.ok(!escaped.includes('<img src=x onerror=alert(1)>'));
});

test('Die Einrichtung nennt fehlende Angaben mit erreichbaren nächsten Schritten', () => {
  const h = harness();
  const checks = h.run('companySetup(state)');
  assert.ok(checks.length > 0);
  const missing = checks.filter(check => !check.done);
  assert.ok(missing.length > 0);
  assert.ok(missing.every(check => check.id && check.label && (check.action || check.view)));
  h.run("view='workspace';render()");
  assert.match(h.elements.get('#app').innerHTML, /Einricht|Start|Firmendaten|Firmenprofil/);
});

test('Leere Firmennamen werden nicht als gespeicherte Einrichtung bestätigt', async () => {
  const h = harness(); h.seed();
  h.run("view='settings';render()");
  const form = h.elements.get('#settings-form');
  form.data = { ...h.run('structuredClone(state.settings)'), company: '   ' };
  await form.onsubmit({ preventDefault() {}, target: form });
  assert.equal(h.run('state.settings.company'), 'Grün & Klar');
  assert.equal(h.persisted.length, 0);
  assert.match(h.elements.get('#toast').textContent, /Firm|Name|prüfen|ungültig/i);
});

test('Ungültige Kostenannahmen werden vor dem Speichern abgewiesen', async () => {
  const h = harness(); h.seed();
  h.run("view='settings';render()");
  const form = h.elements.get('#settings-form');
  form.data = { ...h.run('structuredClone(state.settings)'), hourlyCost: '-1', targetMargin: '101' };
  await form.onsubmit({ preventDefault() {}, target: form });
  assert.equal(h.run('state.settings.hourlyCost'), 24);
  assert.equal(h.run('state.settings.targetMargin'), 25);
  assert.equal(h.persisted.length, 0);
});

test('Vollständige Firmeneinstellungen werden gespeichert und sicher wieder angezeigt', async () => {
  const h = harness(); h.seed();
  h.run("view='settings';render()");
  const form = h.elements.get('#settings-form');
  form.data = { ...h.run('structuredClone(state.settings)'), company: '  Sonnenpflege & Co  ', quotePrefix: 'SP', quoteDays: '30', hourlyCost: '31.50' };
  await form.onsubmit({ preventDefault() {}, target: form });
  assert.equal(h.run('state.settings.company'), 'Sonnenpflege & Co');
  assert.equal(h.run('state.settings.hourlyCost'), 31.5);
  assert.equal(h.run('state.settings.quoteDays'), 30);
  assert.equal(h.persisted.at(-1).settings.company, 'Sonnenpflege & Co');
});

test('Der Workspace beschreibt Gerätespeicher und bietet keine fiktive Anmeldung an', () => {
  const h = harness(); h.seed();
  h.run("view='workspace';render()");
  const html = h.elements.get('#app').innerHTML;
  assert.match(html, /lokal|Gerät|Browser/);
  assert.ok(!/data-action="(?:login|sign-in|activate-license|purchase-license|cloud-sync)"/.test(html));
});

test('Ein Angebot wird als nummerierter unveränderlicher Entwurf gespeichert', async () => {
  const h = harness(); h.seed();
  await h.clickAction('create-offer', { id: 'job' });
  assert.equal(h.run('state.quotes.length'), 1);
  assert.equal(h.run('state.quotes[0].status'), 'draft');
  assert.equal(h.persisted.at(-1).quotes.length, 1);
  assert.match(h.run('state.quotes[0].number'), /^ANG-\d{4}-0001$/);
  assert.equal(h.run('state.quotes[0].calc.gross'), 115);
  const id = h.run('state.quotes[0].id');
  await h.run("handleAction('create-offer',{dataset:{id:'job'}})");
  assert.equal(h.run('state.quotes.length'), 1);
  assert.equal(h.run('state.quotes[0].id'), id);
});

test('E-Mail-Entwurf verändert keinen Versandstatus und bucht keinen Umsatz', async () => {
  const h = harness(); h.seed();
  await h.run("handleAction('create-offer',{dataset:{id:'job'}})");
  h.context.quoteID = h.run('state.quotes[0].id');
  await h.run("handleAction('offer-email',{dataset:{id:quoteID}})");
  assert.equal(h.run('state.quotes[0].status'), 'draft');
  assert.equal(h.run('state.quotes[0].events.length'), 1);
  assert.equal(h.run('state.invoices.length'), 0);
  assert.equal(h.run('financials(state).netRevenue'), 0);
  assert.ok(h.opened.some(url => String(url).startsWith('mailto:')) || h.location.href.startsWith('mailto:'));
});

test('Versand und Annahme werden bewusst im Verlauf gespeichert', async () => {
  const h = harness(); h.seed();
  await h.run("handleAction('create-offer',{dataset:{id:'job'}})");
  h.context.quoteID = h.run('state.quotes[0].id');
  await h.run("handleAction('offer-status',{dataset:{id:quoteID,status:'sent'}})");
  assert.equal(h.run('state.quotes[0].status'), 'sent');
  await h.run("handleAction('offer-status',{dataset:{id:quoteID,status:'accepted'}})");
  assert.equal(h.run('state.quotes[0].status'), 'accepted');
  assert.deepEqual(Array.from(h.run('state.quotes[0].events.map(event=>event.status)')), ['draft', 'sent', 'accepted']);
  assert.equal(h.persisted.at(-1).quotes[0].status, 'accepted');
  assert.equal(h.run('state.invoices.length'), 0);
  assert.equal(h.run('financials(state).netRevenue'), 0);
});

test('Eine Ablehnung erhält das Angebot und löscht den Auftrag nicht', async () => {
  const h = harness(); h.seed();
  await h.run("handleAction('create-offer',{dataset:{id:'job'}})");
  h.context.quoteID = h.run('state.quotes[0].id');
  await h.run("handleAction('offer-status',{dataset:{id:quoteID,status:'declined'}})");
  assert.equal(h.run('state.quotes[0].status'), 'declined');
  assert.equal(h.run('state.jobs.length'), 1);
  assert.equal(h.persisted.at(-1).quotes[0].status, 'declined');
});

test('Der Angebotsdruck verwendet gespeicherten Kunden, Betrieb und Preis', async () => {
  const h = harness(); h.seed();
  await h.run("handleAction('create-offer',{dataset:{id:'job'}})");
  h.context.quoteID = h.run('state.quotes[0].id');
  await h.run("handleAction('offer-print',{dataset:{id:quoteID}})");
  const before = h.printed.at(-1);
  assert.match(before, /Grün &amp; Klar/);
  assert.match(before, /Familie Sommer/);
  assert.match(before, /Gültig|gültig/);
  h.run("state.settings.company='Neuer Firmenname';state.customers[0].name='Neuer Kunde';state.jobs[0].title='Geänderter Umfang';state.jobs[0].lines[0].rate=500");
  await h.run("handleAction('offer-print',{dataset:{id:quoteID}})");
  assert.equal(h.printed.at(-1), before);
});

test('Angebote ohne zugeordneten Kunden erzeugen keine falsche Erfolgsmeldung', async () => {
  const h = harness(); h.seed();
  h.run("state.jobs[0].customer=''");
  await h.clickAction('create-offer', { id: 'job' });
  assert.equal(h.run('state.quotes.length'), 0);
  assert.equal(h.persisted.length, 0);
  assert.match(h.elements.get('#toast').textContent, /Kund|zuordnen|prüfen/i);
});

test('Die Sprachkalkulation übernimmt Baum, Fahrt und Kosten mit eigenen Betriebspreisen', () => {
  const h = harness(); h.seed();
  h.run("state.settings.serviceRates={tree:110};state.settings.travelHourlyRate=60;state.settings.travelKmRate=1");
  const reply = h.run("answer('Kalkuliere einen Baum, 30 Minuten Anfahrt, 20 Euro Material und 15 Euro Gerätemiete')");
  assert.equal(h.run('window.assistantDraft.lines[0].service'), 'tree');
  assert.equal(h.run('window.assistantDraft.lines[0].qty'), 1);
  assert.equal(h.run('window.assistantDraft.lines[0].rate'), 110);
  assert.equal(h.run('window.assistantDraft.travelHours'), 0.5);
  assert.equal(h.run('window.assistantDraft.km'), 0);
  assert.equal(h.run('window.assistantDraft.travelPrice'), 30);
  assert.equal(h.run('window.assistantDraft.material'), 20);
  assert.equal(h.run('window.assistantDraft.rental'), 15);
  assert.equal(h.run('calculate(window.assistantDraft,state.settings).gross'), 175);
  assert.match(reply, /175,00/);
  assert.ok(!reply.includes('10 km Fahrt'));
  assert.equal(h.run('state.jobs.length'), 1);
  assert.equal(h.persisted.length, 0);
});

test('Eine gesprochene Kostenkorrektur erhält den Leistungsumfang und andere Kosten', () => {
  const h = harness(); h.seed();
  h.run("state.settings.serviceRates={tree:110};state.settings.travelHourlyRate=60;answer('Kalkuliere einen Baum, 30 Minuten Anfahrt, 20 Euro Material und 15 Euro Gerätemiete')");
  h.run("answer('Nein, Materialkosten 25 Euro')");
  assert.equal(h.run('window.assistantDraft.lines[0].service'), 'tree');
  assert.equal(h.run('window.assistantDraft.lines[0].qty'), 1);
  assert.equal(h.run('window.assistantDraft.material'), 25);
  assert.equal(h.run('window.assistantDraft.rental'), 15);
  assert.equal(h.run('window.assistantDraft.travelHours'), 0.5);
  assert.equal(h.run('window.assistantDraft.travelPrice'), 30);
  assert.equal(h.run('calculate(window.assistantDraft,state.settings).gross'), 180);
  h.run("answer('Übernehmen')");
  assert.equal(h.run('view'), 'calc');
  assert.equal(h.run('draft.material'), 25);
  assert.equal(h.run('draft.rental'), 15);
  assert.equal(h.run('state.jobs.length'), 1);
  assert.equal(h.persisted.length, 0);
});

test('Ein längerer Sprachauftrag bleibt nach der ersten abgeschlossenen Frage offen',async()=>{
 const h=harness();h.seed();const sessions=[];
 h.context.window.SpeechRecognition=class{constructor(){sessions.push(this)}start(){this.onstart?.()}abort(){this.aborted=true}};
 h.run("view='assistant';render();voice()");const session=sessions[0],before=h.run('chatMessages.length');
 const first=[{transcript:'Kannst du mir einen Auftrag kalkulieren?',confidence:.9}];first.isFinal=true;
 session.onresult({results:[first]});assert.equal(h.run('chatMessages.length'),before);assert.equal(session.aborted,undefined);
 const second=[{transcript:'Acht Bäume zurückschneiden, 30 Minuten Anfahrt, 20 Euro Material und 30 Euro Maschinenmiete',confidence:.9}];second.isFinal=true;
 session.onresult({results:[first,second]});assert.equal(h.run('chatMessages.length'),before);
 session.onend();assert.equal(h.run('chatMessages.length'),before+2);assert.equal(h.run('window.assistantDraft.lines[0].qty'),8);assert.equal(h.run('window.assistantDraft.travelHours'),.5);assert.equal(h.run('window.assistantDraft.material'),20);assert.equal(h.run('window.assistantDraft.rental'),30);
 session.onresult({results:[second]});assert.equal(h.run('chatMessages.length'),before+2);
});

test('Grünschnittvolumen als Folgeantwort erhält die beiden zuerst erkannten Fällbäume',()=>{
 const h=harness();h.seed();const question=h.run("answer('2 Bäume fällen und Abtransport des Grünschnitts')");
 assert.match(question,/m³|Kubikmeter/);assert.equal(h.run('window.assistantDraft.lines[0].qty'),2);
 h.run("answer('drei Kubikmeter')");assert.equal(h.run("window.assistantDraft.lines.find(l=>l.service==='felling').qty"),2);assert.equal(h.run("window.assistantDraft.lines.find(l=>l.service==='greenhaul').qty"),3);assert.equal(h.run('window.assistantDraft.disposal'),38.08);
});

test('Ein Fällpreis ohne Aufmaß bleibt im Kundendruck ein vorläufiger Entwurf',async()=>{
 const h=harness();h.seed();h.run("state.jobs[0].lines=[{service:'felling',qty:2,rate:300}];state.jobs[0].siteDetails={}");
 await h.run("handleAction('create-offer',{dataset:{id:'job'}})");h.context.quoteID=h.run('state.quotes[0].id');
 await h.run("handleAction('offer-print',{dataset:{id:quoteID}})");assert.match(h.printed.at(-1),/Angebotsentwurf/);assert.match(h.printed.at(-1),/Baumhöhe|Stammdurchmesser/);
 await h.run("handleAction('offer-status',{dataset:{id:quoteID,status:'sent'}})");await h.run("handleAction('offer-status',{dataset:{id:quoteID,status:'accepted'}})");assert.equal(h.run('state.quotes[0].status'),'sent');assert.match(h.elements.get('#toast').textContent,/Freigabe|fehlen/);
});

test('Eine Überarbeitung erhält den alten Preis und vergibt eine neue Angebotsnummer',async()=>{
 const h=harness();h.seed();await h.run("handleAction('create-offer',{dataset:{id:'job'}})");h.context.quoteID=h.run('state.quotes[0].id');
 await h.run("handleAction('offer-status',{dataset:{id:quoteID,status:'withdrawn'}})");h.run('state.jobs[0].lines[0].rate=6');
 await h.run("handleAction('create-offer',{dataset:{id:'job'}})");assert.equal(h.run('state.quotes.length'),2);assert.equal(h.run('state.quotes[0].status'),'withdrawn');assert.equal(h.run('state.quotes[0].calc.gross'),115);assert.equal(h.run('state.quotes[1].calc.gross'),135);assert.match(h.run('state.quotes[1].number'),/0002$/);
});
