// sw.js — service worker : ouverture rapide, lecture hors ligne, mises à jour.
// À CHAQUE PUBLICATION : augmenter VERSION (la même que dans config.js).
const VERSION = '1.15.0';
const CACHE = `app-club-${VERSION}`;

// Les fichiers de l'app, gardés pour l'ouverture hors ligne.
const FICHIERS = [
  './', 'index.html', 'style.css', 'app.js', 'config.js', 'client.js', 'auth.js', 'etat.js', 'outils.js',
  'donnees.js', 'demo.js', 'demo-donnees.js', 'avatar.js', 'installation.js', 'texte-riche.js', 'gestes.js', 'brouillons.js', 'rendu.js', 'actions.js', 'import-excel.js', 'lecteur-xlsx.js',
  'ecrans/communs.js', 'ecrans/connexion.js', 'ecrans/accueil.js', 'ecrans/calendrier.js', 'ecrans/course.js',
  'ecrans/entrainement.js', 'ecrans/mes-courses.js', 'ecrans/plus.js', 'ecrans/donnees.js',
  'manifest.webmanifest', 'icons/icone.svg', 'icons/icone-192.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)));
  // Pas de skipWaiting ici : l'app propose « Recharger » et décide du moment.
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k.startsWith('app-club-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (ev) => {
  if (ev.data === 'activer') self.skipWaiting();
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Données Supabase : jamais en cache, toujours le réseau.
  if (url.hostname.endsWith('.supabase.co')) return;

  // La page elle-même : réseau d'abord (pour voir les nouvelles versions), cache si hors ligne.
  if (req.mode === 'navigate') {
    ev.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }

  // Polices et bibliothèque Supabase (autres domaines) : cache puis mise à jour en arrière-plan.
  if (url.origin !== self.location.origin) {
    if (!/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.hostname)) return;
    ev.respondWith(
      caches.open(CACHE).then(async (c) => {
        const enCache = await c.match(req);
        const reseau = fetch(req).then((rep) => { if (rep.ok || rep.type === 'opaque') c.put(req, rep.clone()); return rep; }).catch(() => enCache);
        return enCache || reseau;
      }),
    );
    return;
  }

  // Fichiers de l'app : cache d'abord (version figée par VERSION), réseau sinon.
  ev.respondWith(caches.match(req).then((enCache) => enCache || fetch(req)));
});
