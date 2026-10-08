import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createPlatform } from '../dist/platform.js';

class Events extends EventTarget {
  send(name, detail = {}) {
    const event = new Event(name, { cancelable: true });
    Object.assign(event, detail);
    this.dispatchEvent(event);
    return event;
  }
}

function browser(options = {}) {
  const win = new Events();
  const media = new Events();
  media.matches = options.standalone || false;
  Object.assign(win, {
    isSecureContext: options.secure ?? true,
    location: new URL(options.url || 'https://werkpilot.test/app/'),
    matchMedia: () => media,
    ...options.window
  });
  const registrations = [];
  const navigator = {
    userAgent: options.userAgent || 'Android Chrome',
    onLine: true,
    serviceWorker: {
      register: async url => { registrations.push(url); return options.registration || new Events(); }
    },
    ...options.navigator
  };
  const platform = createPlatform({ window: win, navigator, document: { baseURI: win.location.href } });
  return { win, media, navigator, registrations, platform };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('Lokale HTML-Datei und unsichere HTTP-Adresse versprechen keine Installation', async () => {
  for (const [url, reason] of [['file:///tmp/WerkPilot.html', 'local-file'], ['http://example.test/app/', 'insecure-origin']]) {
    const { platform, registrations } = browser({ url });
    platform.init();
    assert.equal(platform.getState().mode, 'unsupported');
    assert.equal(platform.getState().reason, reason);
    await settle();
    assert.equal(registrations.length, 0);
    assert.equal((await platform.request()).outcome, 'unavailable');
  }
});

test('Android-Prompt startet ausschließlich nach ausdrücklichem Installationsaufruf', async () => {
  const { win, platform } = browser();
  let prompts = 0;
  const states = [];
  platform.init(state => states.push(state.mode));
  const event = win.send('beforeinstallprompt', {
    prompt: async () => { prompts++; },
    userChoice: Promise.resolve({ outcome: 'accepted' })
  });
  assert.equal(event.defaultPrevented, true);
  assert.equal(prompts, 0);
  assert.equal(platform.getState().canPrompt, true);
  const result = await platform.request();
  assert.equal(result.outcome, 'accepted');
  assert.equal(prompts, 1);
  assert.equal(result.state.installed, false, 'Annahme allein beweist noch keine abgeschlossene Installation');
  assert.equal((await platform.request()).outcome, 'unavailable');
  win.send('appinstalled');
  assert.equal(platform.getState().mode, 'installed');
  assert.ok(states.includes('available'));
  assert.ok(states.includes('installed'));
});

test('Doppelter Klick verwendet denselben Browser-Prompt genau einmal', async () => {
  const { win, platform } = browser();
  platform.init();
  let prompts = 0;
  let answer;
  win.send('beforeinstallprompt', {
    prompt: async () => { prompts++; },
    userChoice: new Promise(resolve => { answer = resolve; })
  });
  const first = platform.request();
  const second = platform.request();
  await settle();
  answer({ outcome: 'dismissed' });
  assert.equal((await first).outcome, 'dismissed');
  assert.equal((await second).outcome, 'dismissed');
  assert.equal(prompts, 1);
  assert.equal(platform.getState().installed, false);
});

test('Fehlgeschlagenes Prompt blockiert einen späteren gültigen Installationsversuch nicht', async () => {
  const { win, platform } = browser();
  platform.init();
  win.send('beforeinstallprompt', { prompt: () => { throw Error('blocked'); } });
  assert.equal((await platform.request()).outcome, 'failed');
  win.send('beforeinstallprompt', { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  assert.equal((await platform.request()).outcome, 'accepted');
});

test('Installierte Standalone-App und iOS Home-Bildschirm werden erkannt', () => {
  assert.equal(browser({ standalone: true }).platform.getState().mode, 'installed');
  assert.equal(browser({ navigator: { standalone: true } }).platform.getState().mode, 'installed');
  const ipad = browser({ userAgent: 'Mozilla Macintosh Safari', navigator: { platform: 'MacIntel', maxTouchPoints: 5 } }).platform;
  assert.equal(ipad.getState().platform, 'ios');
  assert.equal(ipad.getState().mode, 'manual');
  assert.ok(ipad.getState().steps.some(step => step.includes('Home-Bildschirm')));
});

test('Native Android-Bridges benötigen weder Browser-Prompt noch Service Worker', async () => {
  for (const bridge of ['NativeApp', 'WerkPilotAndroid']) {
    const { platform, registrations } = browser({ window: { [bridge]: {} } });
    platform.init();
    assert.equal(platform.getState().mode, 'native');
    assert.equal(platform.getState().offlineReady, true);
    await settle();
    assert.equal(registrations.length, 0);
  }
});

test('Offline-Bereitschaft wird erst nach erfolgreicher Aktivierung gemeldet', async () => {
  const worker = new Events();
  worker.state = 'installing';
  const registration = new Events();
  registration.installing = worker;
  const { platform, registrations } = browser({ registration });
  platform.init();
  assert.equal(platform.getState().offlineReady, false);
  await settle();
  assert.equal(registrations[0], 'https://werkpilot.test/app/sw.js');
  worker.state = 'activated';
  worker.send('statechange');
  assert.equal(platform.getState().offlineReady, true);
});

test('Offline-Fehler bleiben sichtbar und verhindern falsche Bereitschaft', async () => {
  const { platform } = browser({ navigator: { serviceWorker: { register: async () => { throw Error('quota'); } } } });
  platform.init();
  await settle();
  assert.equal(platform.getState().offlineReady, false);
  assert.ok(platform.getState().offlineError.includes('noch nicht verfügbar'));
});

test('Installation ohne Service-Worker-Unterstützung bleibt als nicht unterstützt markiert', () => {
  const { platform } = browser({ navigator: { serviceWorker: undefined } });
  assert.equal(platform.getState().mode, 'unsupported');
  assert.equal(platform.getState().reason, 'service-worker-unavailable');
});

test('Callbacks erhalten Online-, Offline- und App-Moduswechsel; Abmeldung funktioniert', () => {
  const { win, media, navigator, platform } = browser();
  const states = [];
  const unsubscribe = platform.init(state => states.push(state));
  navigator.onLine = false;
  win.send('offline');
  assert.equal(states.at(-1).online, false);
  media.matches = true;
  media.send('change');
  assert.equal(states.at(-1).mode, 'installed');
  unsubscribe();
  const count = states.length;
  win.send('online');
  assert.equal(states.length, count);
  platform.destroy();
});

test('Manifest enthält gültige PNG-Größen, eigenständigen Start und App-Shortcuts', async () => {
  const manifest = JSON.parse(await readFile(new URL('../dist/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.id, './');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}` && icon.purpose === 'any');
    const png = await readFile(new URL(`../dist/${icon.src}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
  assert.deepEqual(manifest.shortcuts.map(shortcut => shortcut.url), ['./?view=calc', './?view=calendar', './?view=assistant', './?view=photos']);
});

async function serviceWorker() {
  const handlers = {};
  const stored = new Map();
  const deleted = [];
  const opened = [];
  let added = [];
  const cache = {
    addAll: async requests => { added = requests; },
    match: async key => stored.get(key)
  };
  const context = {
    self: { location: new URL('https://werkpilot.test/app/sw.js'), addEventListener: (name, handler) => { handlers[name] = handler; }, clients: { claim: async () => {} } },
    caches: { open: async name => { opened.push(name); return cache; }, keys: async () => ['werkpilot-v2.1', 'werkpilot-app-v3.0.0', 'werkpilot-app-v4.0.0', 'werkpilot-app-v5.0.0', 'unrelated-app'], delete: async name => { deleted.push(name); } },
    URL, Request, fetch: async request => ({ source: 'network', url: request.url })
  };
  vm.runInNewContext(await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8'), context);
  async function lifecycle(name) { let promise; handlers[name]({ waitUntil: pending => { promise = pending; } }); await promise; }
  function request(path, options = {}) {
    let response;
    handlers.fetch({ request: { url: new URL(path, 'https://werkpilot.test/app/').href, method: options.method || 'GET', mode: options.mode || 'cors', headers: new Headers(options.headers || {}) }, respondWith: promise => { response = promise; } });
    return response;
  }
  return { lifecycle, request, stored, deleted, opened, get added() { return added; } };
}

test('Service Worker speichert ausschließlich benannte App-Dateien und löscht keine fremden Caches', async () => {
  const sw = await serviceWorker();
  await sw.lifecycle('install');
  assert.ok(sw.added.every(request => request.url.startsWith('https://werkpilot.test/app/')));
  for (const asset of ['platform.js', 'quotes.js', 'professional.js', 'knowledge.js']) {
    assert.ok(sw.added.some(request => request.url.endsWith(`/${asset}`)), `${asset} gehört zur Offline-App`);
  }
  assert.ok(sw.added.every(request => request.cache === 'reload'));
  assert.deepEqual(sw.opened, ['werkpilot-app-v5.0.0']);
  await sw.lifecycle('activate');
  assert.deepEqual(sw.deleted, ['werkpilot-v2.1', 'werkpilot-app-v3.0.0', 'werkpilot-app-v4.0.0']);
  assert.equal(sw.deleted.includes('werkpilot-app-v5.0.0'), false, 'Der aktuelle Offline-Cache bleibt erhalten');
  assert.equal(sw.deleted.includes('unrelated-app'), false, 'Fremde Anwendungen behalten ihren Cache');
  for (const path of ['api/customers', 'photos/customer.jpg', 'backup.json', 'https://other.test/app.js']) assert.equal(sw.request(path), undefined);
  assert.equal(sw.request('app.js', { method: 'POST' }), undefined);
  assert.equal(sw.request('app.js', { headers: { Authorization: 'test' } }), undefined);
});

test('Offline-Navigation verwendet vollständige Appshell einschließlich Shortcut-Query', async () => {
  const sw = await serviceWorker();
  const response = { source: 'cached-index' };
  sw.stored.set('https://werkpilot.test/app/index.html', response);
  assert.equal(await sw.request('./?view=calendar', { mode: 'navigate' }), response);
  assert.equal(await sw.request('index.html?view=calc', { mode: 'navigate' }), response);
  assert.equal(sw.request('api/customers', { mode: 'navigate' }), undefined);
  for (const asset of ['core.js', 'quotes.js', 'professional.js', 'knowledge.js']) {
    const module = { source: 'cached-module', asset };
    sw.stored.set(`https://werkpilot.test/app/${asset}`, module);
    assert.equal(await sw.request(`${asset}?version=4`), module);
  }
});
