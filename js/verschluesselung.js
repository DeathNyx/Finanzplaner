// ============================================
// Verschlüsselung der Daten mit dem Haushalts Passwort.
//
// So funktioniert es:
// 1. Aus dem Passwort und einem "Salz" (Zufallswert, gehört zum
//    Haushalt) wird ein Schlüssel berechnet. Das dauert absichtlich
//    etwa eine Sekunde, damit niemand Millionen Passwörter
//    durchprobieren kann (Verfahren: PBKDF2).
// 2. Mit diesem Schlüssel wird jeder Eintrag verschlüsselt, bevor er
//    in die Cloud geht (Verfahren: AES-GCM mit 256 Bit, wie bei
//    Onlinebanking). Jeder Eintrag bekommt dabei einen eigenen
//    Zufallswert ("iv"), damit gleiche Inhalte unterschiedlich aussehen.
// 3. AES-GCM erkennt außerdem jede Veränderung: Wurde der
//    Zeichensalat manipuliert oder ist das Passwort falsch, schlägt
//    das Entschlüsseln fehl, statt falsche Daten zu liefern.
//
// Das Passwort selbst wird nirgends gespeichert. Auf dem Handy wird
// nur der fertige Schlüssel abgelegt, und zwar so, dass er sich nicht
// auslesen, sondern nur benutzen lässt.
//
// Benutzt die eingebaute Web Crypto Schnittstelle des Browsers.
// ============================================

// So oft wird beim Berechnen des Schlüssels gerechnet (Empfehlung für PBKDF2 mit SHA-256)
const DURCHLAEUFE = 600000;

// Mindestlänge für das Haushalts Passwort
export const PASSWORT_MINDESTLAENGE = 12;

// Bekannter Text zum Prüfen, ob ein Passwort stimmt
const PRUEFTEXT = "finanzplaner-passwort-ok";

const kodierer = new TextEncoder();
const dekodierer = new TextDecoder();

// ---------- Hilfen: Bytes <-> Text (Base64) ----------

function zuBase64(bytes) {
  let text = "";
  new Uint8Array(bytes).forEach(function (b) { text += String.fromCharCode(b); });
  return btoa(text);
}

function ausBase64(text) {
  const roh = atob(text);
  const bytes = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
  return bytes;
}

// Zufällige Bytes (z. B. für Salz und iv)
function zufall(anzahl) {
  return crypto.getRandomValues(new Uint8Array(anzahl));
}

// ---------- Schlüssel ----------

// Neues Salz für einen Haushalt (als Text, darf öffentlich sein)
export function neuesSalz() {
  return zuBase64(zufall(16));
}

// Prüft ein neues Passwort. Gibt einen Hinweis zurück oder null, wenn es passt.
export function pruefePasswort(passwort) {
  if (!passwort || passwort.length < PASSWORT_MINDESTLAENGE) {
    return "Das Passwort muss mindestens " + PASSWORT_MINDESTLAENGE + " Zeichen lang sein. Tipp: mehrere Wörter, z. B. „Sonne Kasse Fahrrad 7“.";
  }
  return null;
}

// Berechnet aus Passwort und Salz den Schlüssel.
// Der Schlüssel lässt sich nur benutzen, nicht auslesen ("extractable: false").
export async function schluesselAusPasswort(passwort, salz) {
  const grundlage = await crypto.subtle.importKey(
    "raw", kodierer.encode(passwort.normalize("NFC")), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: ausBase64(salz), iterations: DURCHLAEUFE, hash: "SHA-256" },
    grundlage,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ---------- Ver- und Entschlüsseln ----------

// Verschlüsselt ein beliebiges Objekt (z. B. eine Buchung).
// Ergebnis: { iv, inhalt } als Text, beides darf in die Cloud.
export async function verschluesseln(schluessel, objekt) {
  const iv = zufall(12);
  const klartext = kodierer.encode(JSON.stringify(objekt));
  const geheim = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, schluessel, klartext);
  return { iv: zuBase64(iv), inhalt: zuBase64(geheim) };
}

// Entschlüsselt ein Paket { iv, inhalt } wieder zum Objekt.
// Wirft einen Fehler bei falschem Schlüssel oder veränderten Daten.
export async function entschluesseln(schluessel, paket) {
  const klartext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ausBase64(paket.iv) }, schluessel, ausBase64(paket.inhalt)
  );
  return JSON.parse(dekodierer.decode(klartext));
}

// Erstellt einen Prüfwert, mit dem sich später ein Passwort testen lässt
export async function erstellePruefwert(schluessel) {
  return verschluesseln(schluessel, PRUEFTEXT);
}

// Stimmt der Schlüssel (also das Passwort) zum Prüfwert?
export async function stimmtSchluessel(schluessel, pruefwert) {
  try {
    return (await entschluesseln(schluessel, pruefwert)) === PRUEFTEXT;
  } catch (fehler) {
    return false;
  }
}


// ============================================
// Schlüssel auf dem Handy merken (IndexedDB)
//
// Damit das Passwort nur einmal eingegeben werden muss, wird der
// fertige Schlüssel im Browser abgelegt. Er bleibt "nicht auslesbar":
// Man kann damit ver- und entschlüsseln, ihn aber nicht als Text
// herausholen.
// ============================================

const DB_NAME = "finanzplaner_tresor";
const DB_ABLAGE = "schluessel";

function oeffneTresor() {
  return new Promise(function (fertig, fehler) {
    const anfrage = indexedDB.open(DB_NAME, 1);
    anfrage.onupgradeneeded = function () { anfrage.result.createObjectStore(DB_ABLAGE); };
    anfrage.onsuccess = function () { fertig(anfrage.result); };
    anfrage.onerror = function () { fehler(anfrage.error); };
  });
}

function tresorAktion(modus, aktion) {
  return oeffneTresor().then(function (db) {
    return new Promise(function (fertig, fehler) {
      const vorgang = db.transaction(DB_ABLAGE, modus);
      const anfrage = aktion(vorgang.objectStore(DB_ABLAGE));
      vorgang.oncomplete = function () { db.close(); fertig(anfrage.result); };
      vorgang.onerror = function () { db.close(); fehler(vorgang.error); };
    });
  });
}

// Schlüssel für einen Haushalt merken
export function merkeSchluessel(haushaltId, schluessel) {
  return tresorAktion("readwrite", function (ablage) { return ablage.put(schluessel, haushaltId); });
}

// Gemerkten Schlüssel holen (oder undefined)
export function holeSchluessel(haushaltId) {
  return tresorAktion("readonly", function (ablage) { return ablage.get(haushaltId); });
}

// Schlüssel vergessen (z. B. beim Verlassen des Haushalts)
export function vergissSchluessel(haushaltId) {
  return tresorAktion("readwrite", function (ablage) { return ablage.delete(haushaltId); });
}
