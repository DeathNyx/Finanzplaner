// ============================================
// Service Worker: ein kleiner Helfer, der im Hintergrund läuft.
//
// Er legt alle Dateien der App im Speicher des Handys ab
// (das nennt man "Cache"). So startet die App auch ohne Internet.
//
// Vorgehen bei jeder Anfrage: "Netz zuerst".
//   1. Versuchen, die neueste Datei aus dem Internet zu holen
//      (und gleich im Cache aktualisieren).
//   2. Klappt das nicht (offline oder zu langsam), die Datei
//      aus dem Cache nehmen.
// So bekommst du Updates sofort und bist trotzdem offline abgesichert.
//
// Wichtig: Kommt eine neue Datei zur App dazu, muss sie unten in
// DATEIEN eingetragen und die VERSION um eins erhöht werden.
// ============================================

const VERSION = 5;
const CACHE_NAME = "finanzplaner-v" + VERSION;

// Nach so vielen Millisekunden ohne Antwort wird der Cache genommen
const WARTEZEIT = 3000;

// Alle Dateien, die für den Start ohne Internet nötig sind
const DATEIEN = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.webmanifest",
  "./beispieldaten.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./js/format.js",
  "./js/speicher.js",
  "./js/rechnen.js",
  "./js/ansichten.js",
  "./js/personen.js",
  "./js/kassen.js",
  "./js/buchungen.js",
  "./js/uebertraege.js",
  "./js/ausgleich.js",
  "./js/uebersicht.js",
  "./js/dauerauftraege.js",
  "./js/schulden.js",
  "./js/sparziele.js",
  "./js/diagramme.js",
  "./js/kategorien.js",
  "./js/backup.js",
  "./js/installieren.js",
  "./js/hinweise.js",
  "./js/app.js",
  "./js/firebase-konfig.js",
  "./js/verschluesselung.js",
  "./js/cloud.js",
  "./js/abgleich.js"
];

// Installation: alle Dateien in den Cache legen
self.addEventListener("install", function (ereignis) {
  ereignis.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(DATEIEN); })
      .then(function () { return self.skipWaiting(); })
  );
});

// Aktivierung: alte Caches früherer Versionen aufräumen
self.addEventListener("activate", function (ereignis) {
  ereignis.waitUntil(
    caches.keys()
      .then(function (namen) {
        return Promise.all(namen
          .filter(function (name) { return name.startsWith("finanzplaner-") && name !== CACHE_NAME; })
          .map(function (name) { return caches.delete(name); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

// Jede Anfrage der App: Netz zuerst, sonst Cache
self.addEventListener("fetch", function (ereignis) {
  const anfrage = ereignis.request;

  // Nur eigene Dateien und nur Lesen (GET) behandeln
  if (anfrage.method !== "GET" || new URL(anfrage.url).origin !== self.location.origin) return;

  ereignis.respondWith(netzZuerst(anfrage));
});

function netzZuerst(anfrage) {
  // Anfrage ans Internet, die bei Erfolg auch den Cache auffrischt
  const ausDemNetz = fetch(anfrage).then(function (antwort) {
    if (antwort.ok) {
      const kopie = antwort.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(anfrage, kopie); });
    }
    return antwort;
  });

  // Nach der Wartezeit aufgeben (z. B. bei sehr schlechtem Netz)
  const zuLangsam = new Promise(function (_, ablehnen) {
    setTimeout(function () { ablehnen(new Error("zu langsam")); }, WARTEZEIT);
  });

  return Promise.race([ausDemNetz, zuLangsam]).catch(function () {
    return ausDemCache(anfrage).then(function (gespeichert) {
      // Nichts im Cache: doch noch auf das Netz warten
      return gespeichert || ausDemNetz;
    });
  });
}

function ausDemCache(anfrage) {
  return caches.match(anfrage, { ignoreSearch: true }).then(function (gespeichert) {
    // Beim Öffnen der App (Seitenaufruf) notfalls die Startseite nehmen
    if (!gespeichert && anfrage.mode === "navigate") {
      return caches.match("./index.html");
    }
    return gespeichert;
  });
}
