/** Installation and offline status. Prompts require an explicit user action. */
export function createPlatform(environment = {}) {
  const win = environment.window ?? globalThis.window;
  const nav = environment.navigator ?? win?.navigator ?? globalThis.navigator;
  const doc = environment.document ?? win?.document ?? globalThis.document;
  const listeners = new Set();
  let started = false;
  let deferredPrompt = null;
  let installedEvent = false;
  let pendingRequest = null;
  let offlineReady = false;
  let offlineError = '';
  let accepted = false;
  let mediaQuery;
  const cleanup = [];

  function platformName() {
    const userAgent = nav?.userAgent || '';
    if (/Android/i.test(userAgent)) return 'android';
    if (/iPhone|iPad|iPod/i.test(userAgent)
      || (/Macintosh|MacIntel/i.test(`${userAgent} ${nav?.platform || ''}`) && nav?.maxTouchPoints > 1)) return 'ios';
    return 'desktop';
  }

  function nativeApp() { return Boolean(win?.NativeApp || win?.WerkPilotAndroid); }

  function secureLocation() {
    const location = win?.location;
    if (!location || win?.isSecureContext === false) return false;
    return location.protocol === 'https:' || (location.protocol === 'http:'
      && /^(localhost|127\.0\.0\.1|\[?::1\]?)$/i.test(location.hostname));
  }

  function getState() {
    const platform = platformName();
    const standalone = Boolean(nav?.standalone || mediaQuery?.matches
      || win?.matchMedia?.('(display-mode: standalone)')?.matches);
    const common = {
      platform, installed: nativeApp() || installedEvent || standalone,
      canPrompt: false, online: nav?.onLine !== false,
      offlineReady: nativeApp() || offlineReady, offlineError, steps: []
    };
    if (nativeApp()) return {
      ...common, mode: 'native', reason: 'native-app',
      message: 'WerkPilot läuft als installierte Android-App.'
    };
    if (common.installed) return {
      ...common, mode: 'installed', reason: standalone ? 'standalone' : 'appinstalled',
      message: standalone ? 'WerkPilot läuft als App.' : 'WerkPilot ist installiert. Öffne es über das Symbol auf deinem Home-Bildschirm.'
    };
    if (!win || win.location?.protocol === 'file:') return {
      ...common, mode: 'unsupported', reason: 'local-file',
      message: 'Diese HTML-Datei lässt sich nicht als Handy-App installieren. Öffne die veröffentlichte HTTPS-Version oder installiere das Android-Paket.'
    };
    if (!secureLocation()) return {
      ...common, mode: 'unsupported', reason: 'insecure-origin',
      message: 'Für die Installation und Offline-Nutzung wird eine HTTPS-Adresse benötigt.'
    };
    if (!nav?.serviceWorker) return {
      ...common, mode: 'unsupported', reason: 'service-worker-unavailable',
      message: 'Dieser Browser unterstützt die Offline-App nicht. Öffne die HTTPS-Version in Chrome, Edge oder Safari.'
    };
    if (deferredPrompt) return {
      ...common, mode: 'available', reason: 'browser-prompt', canPrompt: true,
      message: 'Du kannst WerkPilot jetzt installieren und über ein eigenes App-Symbol starten.'
    };
    const acceptance = accepted ? 'Die Installation wurde bestätigt. Prüfe das neue App-Symbol auf deinem Home-Bildschirm. ' : '';
    if (platform === 'ios') return {
      ...common, mode: 'manual', reason: 'ios-menu',
      message: `${acceptance}Öffne WerkPilot in Safari und füge es dem Home-Bildschirm hinzu.`,
      steps: ['Diese HTTPS-Seite in Safari öffnen.', 'Teilen öffnen und „Zum Home-Bildschirm“ wählen.', '„Als Web-App öffnen“ aktivieren, falls angeboten, und „Hinzufügen“ wählen.']
    };
    if (platform === 'android') return {
      ...common, mode: 'manual', reason: 'android-menu',
      message: `${acceptance}Öffne das Browsermenü und suche nach „App installieren“ oder „Zum Startbildschirm hinzufügen“. Das Angebot hängt vom Browser ab.`,
      steps: ['Diese HTTPS-Seite in Chrome öffnen.', 'Das Menü ⋮ öffnen und „App installieren“ wählen, falls angeboten.', 'Bei „Zum Startbildschirm hinzufügen“ prüfen, ob eine App oder nur eine Verknüpfung erstellt wird.']
    };
    return {
      ...common, mode: 'manual', reason: 'desktop-menu',
      message: `${acceptance}Chrome oder Edge bietet die Installation im Adressfeld oder Browsermenü an, sobald die App installierbar ist.`,
      steps: ['Die HTTPS-Version in Chrome oder Edge öffnen.', 'Im Adressfeld oder Menü nach „App installieren“ suchen.']
    };
  }

  function emit() {
    const state = getState();
    for (const listener of listeners) listener(state);
    return state;
  }

  function on(target, name, callback) {
    target?.addEventListener?.(name, callback);
    cleanup.push(() => target?.removeEventListener?.(name, callback));
  }

  function registerOffline() {
    if (nativeApp() || !secureLocation() || !nav?.serviceWorker?.register) return;
    const base = doc?.baseURI || win?.location?.href;
    let workerURL;
    try { workerURL = new URL('./sw.js', base).href; }
    catch { return; }
    Promise.resolve().then(() => nav.serviceWorker.register(workerURL)).then(registration => {
      if (registration.active) { offlineReady = true; emit(); }
      const observe = worker => {
        if (!worker) return;
        const changed = () => {
          if (worker.state === 'activated') { offlineReady = true; offlineError = ''; emit(); }
          if (worker.state === 'redundant' && !registration.active) {
            offlineError = 'Die Offline-Dateien konnten nicht vollständig gespeichert werden. Öffne die App bei bestehender Verbindung erneut.';
            emit();
          }
        };
        on(worker, 'statechange', changed);
        changed();
      };
      observe(registration.installing);
      on(registration, 'updatefound', () => observe(registration.installing));
      if (nav.serviceWorker.ready?.then) nav.serviceWorker.ready.then(() => {
        offlineReady = true;
        offlineError = '';
        emit();
      }).catch(() => {});
    }).catch(() => {
      offlineReady = false;
      offlineError = 'Die Offline-App ist noch nicht verfügbar. Prüfe Verbindung und Browserberechtigungen und öffne die Seite erneut.';
      emit();
    });
  }

  function init(listener) {
    if (typeof listener === 'function') listeners.add(listener);
    if (!started) {
      started = true;
      mediaQuery = win?.matchMedia?.('(display-mode: standalone)');
      on(win, 'beforeinstallprompt', event => {
        if (!secureLocation() || nativeApp() || getState().installed) return;
        event.preventDefault();
        deferredPrompt = event;
        accepted = false;
        emit();
      });
      on(win, 'appinstalled', () => {
        deferredPrompt = null;
        installedEvent = true;
        accepted = false;
        emit();
      });
      on(win, 'online', emit);
      on(win, 'offline', emit);
      if (mediaQuery?.addEventListener) on(mediaQuery, 'change', emit);
      else if (mediaQuery?.addListener) {
        mediaQuery.addListener(emit);
        cleanup.push(() => mediaQuery.removeListener?.(emit));
      }
      registerOffline();
    }
    if (typeof listener === 'function') listener(getState());
    return () => listeners.delete(listener);
  }

  async function request() {
    if (pendingRequest) return pendingRequest;
    if (!deferredPrompt || getState().installed) return { outcome: 'unavailable', state: getState() };
    const prompt = deferredPrompt;
    // Browser install events are single-use, including after dismissal.
    deferredPrompt = null;
    pendingRequest = Promise.resolve().then(async () => {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        accepted = choice?.outcome === 'accepted';
        return { outcome: accepted ? 'accepted' : 'dismissed', state: getState() };
      } catch {
        accepted = false;
        return { outcome: 'failed', state: getState() };
      } finally {
        pendingRequest = null;
        emit();
      }
    });
    return pendingRequest;
  }

  return { init, getState, request, destroy() {
    cleanup.splice(0).forEach(remove => remove());
    listeners.clear();
    deferredPrompt = null;
    started = false;
  } };
}

let browserPlatform;
function defaultPlatform() { return browserPlatform ||= createPlatform(); }
export function initPlatform(onChange) { return defaultPlatform().init(onChange); }
export function getInstallState() { return defaultPlatform().getState(); }
export function requestInstall() { return defaultPlatform().request(); }
