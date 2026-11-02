// ============================================
// Live Abgleich der Daten zwischen den Handys eines Haushalts.
//
// In der Cloud liegt jeder Eintrag (Buchung, Kasse, Person ...) als
// eigenes Dokument unter haushalte/{id}/eintraege/{dokId}:
//   daten:     verschlüsselt { sammlung, eintrag } oder
//              verschlüsselt { sammlung, id, geloescht: true, zeit }
//   geaendert: Zeitpunkt auf dem Server (zum Abholen nur des Neuen)
//   von:       wer es hochgeladen hat
// Die dokId ist ein Prüfwert aus Haushalt und Eintrag. So verrät sie
// nicht, ob es eine Buchung, Kasse oder etwas anderes ist.
//
// Ablauf:
//   Hochladen:  Nach jedem Speichern werden die geänderten Einträge
//               und neuen Löschmarken verschlüsselt hochgeladen.
//   Empfangen:  Das Handy hört auf neue Dokumente im Haushalt und
//               übernimmt, was neuer ist als der eigene Stand.
//   Konflikt:   Wurde ein Eintrag auf beiden Handys geändert, gewinnt
//               die zuletzt gemachte Änderung.
//
// Auf dem Handy merkt sich der Abgleich (localStorage):
//   stand: für jeden Eintrag, welcher Stand schon abgeglichen ist
//   seit:  bis zu welchem Server Zeitpunkt schon abgeholt wurde
// ============================================

import * as cloud from "./cloud.js";
import * as tresor from "./verschluesselung.js";

const SPEICHER = "finanzplaner_abgleich";

// Bildschirme, die nur anzeigen. Kommen neue Daten, werden sie sofort
// neu gezeichnet. Formulare werden dabei nicht gestört.
const LESE_BILDSCHIRME = [
  "", "uebersicht", "kassen", "kasse", "monat", "diagramme", "ausgleich", "personen",
  "dauerauftraege", "schulden", "sparziele", "kategorien", "mehr", "abgleich"
];

// Zustand des Abgleichs
const status = {
  zustand: "aus",       // aus, verbinde, aktiv, offline, entscheidung, fehler
  ausstehend: 0,        // so viele Einträge warten aufs Hochladen
  letzterAbgleich: null,
  fehler: null,
  anzahlImHaushalt: 0
};

let haushaltId = null;
let schluessel = null;
let abmeldenVomLauschen = null;
let laeuftHochladen = false;
let nochmalHochladen = false;
let zeitgeber = null;
let wartendeEntscheidung = null; // beim ersten Abgleich: Daten aus dem Haushalt
const beobachter = [];

// ---------- Zustand für andere Teile der App ----------

export function holeStatus() {
  return Object.assign({}, status);
}

// Bei jeder Änderung des Zustands wird "rueckruf" aufgerufen
export function beobachte(rueckruf) {
  beobachter.push(rueckruf);
  rueckruf(holeStatus());
}

function melde(aenderung) {
  Object.assign(status, aenderung);
  beobachter.forEach(function (r) { try { r(holeStatus()); } catch (e) { /* egal */ } });
}

// ---------- Gemerkter Stand auf dem Handy ----------

function ladeStand() {
  try {
    const s = JSON.parse(localStorage.getItem(SPEICHER));
    if (s && s.haushaltId === haushaltId) return s;
  } catch (e) { /* neu anfangen */ }
  return { haushaltId: haushaltId, stand: {}, seit: null, ersterAbgleichFertig: false };
}

let gemerkt = null;

function speichereStand() {
  try { localStorage.setItem(SPEICHER, JSON.stringify(gemerkt)); } catch (e) { /* egal */ }
}

// Alles vergessen (z. B. beim Verlassen des Haushalts)
export function vergissStand() {
  localStorage.removeItem(SPEICHER);
}

// ---------- Hilfen ----------

// Schlüssel eines Eintrags, z. B. "buchungen:buc_123"
function kennung(sammlung, id) {
  return sammlung + ":" + id;
}

// Dokument ID in der Cloud: Prüfwert (SHA-256) aus Haushalt und Kennung
async function dokId(k) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(haushaltId + ":" + k));
  return Array.from(new Uint8Array(bytes)).slice(0, 20).map(function (b) {
    return b.toString(16).padStart(2, "0");
  }).join("");
}

function eintraegeSammlung() {
  const fb = cloud.firebase();
  return fb.F.collection(fb.db, "haushalte", haushaltId, "eintraege");
}

// Ist dieses Handy noch "unbenutzt" (nur Standard Kategorien)?
function lokalUnbenutzt() {
  return ["personen", "kassen", "buchungen", "uebertraege", "dauerauftraege", "schulden", "sparziele", "ausgleiche"]
    .every(function (s) { return (daten[s] || []).length === 0; });
}

// ---------- Starten und Stoppen ----------

// Startet den Abgleich, wenn das Handy zu einem Haushalt gehört und angemeldet ist
export async function starte() {
  const h = cloud.lokalerHaushalt();
  if (!h) { stoppe(); melde({ zustand: "aus" }); return; }
  if (abmeldenVomLauschen && haushaltId === h.id) return; // läuft schon

  melde({ zustand: "verbinde", fehler: null });
  try {
    await cloud.laden();
  } catch (fehler) {
    melde({ zustand: "offline" });
    return;
  }

  const nutzer = cloud.nutzer();
  if (!nutzer) { melde({ zustand: "aus" }); return; }

  haushaltId = h.id;
  schluessel = await tresor.holeSchluessel(h.id);
  if (!schluessel) { melde({ zustand: "aus" }); return; }

  gemerkt = ladeStand();

  try {
    if (!gemerkt.ersterAbgleichFertig) {
      const fertig = await ersterAbgleich();
      if (!fertig) return; // wartet auf Entscheidung
    }
    lausche();
    melde({ zustand: navigator.onLine ? "aktiv" : "offline" });
    planeHochladen(0);
  } catch (fehler) {
    melde({ zustand: navigator.onLine ? "fehler" : "offline", fehler: cloud.fehlerText(fehler) });
  }
}

export function stoppe() {
  if (abmeldenVomLauschen) abmeldenVomLauschen();
  abmeldenVomLauschen = null;
  clearTimeout(zeitgeber);
  haushaltId = null;
  schluessel = null;
  wartendeEntscheidung = null;
  melde({ zustand: "aus", ausstehend: 0, fehler: null });
}

// ---------- Erster Abgleich ----------

// Gibt true zurück, wenn es normal weitergehen kann
async function ersterAbgleich() {
  const fb = cloud.firebase();
  const schnappschuss = await fb.F.getDocs(eintraegeSammlung());
  const pakete = [];
  let seit = null;
  for (const dok of schnappschuss.docs) {
    const d = dok.data();
    try {
      pakete.push(await tresor.entschluesseln(schluessel, d.daten));
    } catch (e) { /* nicht lesbar: überspringen */ }
    if (d.geaendert && (!seit || d.geaendert.toMillis() > seit.toMillis())) seit = d.geaendert;
  }

  // Haushalt noch leer: Dieses Handy lädt einfach alles hoch
  if (pakete.length === 0) {
    gemerkt.ersterAbgleichFertig = true;
    speichereStand();
    return true;
  }

  // Neues, leeres Handy: alles aus dem Haushalt übernehmen
  if (lokalUnbenutzt()) {
    uebernimmHaushalt(pakete, seit);
    return true;
  }

  // Beide Seiten haben Daten: nachfragen
  wartendeEntscheidung = { pakete: pakete, seit: seit };
  melde({ zustand: "entscheidung" });
  return false;
}

// Entscheidung beim ersten Abgleich: "haushalt" (Handy ersetzen) oder "zusammen"
export async function entscheide(wahl) {
  if (!wartendeEntscheidung) return;
  const { pakete, seit } = wartendeEntscheidung;
  wartendeEntscheidung = null;

  if (wahl === "haushalt") {
    uebernimmHaushalt(pakete, seit);
  } else {
    let geaendert = false;
    pakete.forEach(function (p) { if (wendeAn(p)) geaendert = true; });
    if (geaendert) speichereUebernommen();
    gemerkt.seit = seit ? { s: seit.seconds, n: seit.nanoseconds } : null;
    gemerkt.ersterAbgleichFertig = true;
    speichereStand();
  }

  lausche();
  melde({ zustand: "aktiv" });
  planeHochladen(0);
  neuZeichnen(true);
}

// Ersetzt alle Daten dieses Handys durch die des Haushalts (mit Sicherheitskopie)
function uebernimmHaushalt(pakete, seit) {
  try {
    localStorage.setItem(SPEICHER_SCHLUESSEL + "_vor_abgleich", JSON.stringify(daten));
  } catch (e) { /* Sicherheitskopie ist freiwillig */ }

  const einstellungen = daten.einstellungen;
  daten = leereDaten();
  daten.kategorien = [];
  daten.einstellungen = einstellungen; // Einstellungen bleiben pro Handy
  gemerkt.stand = {};
  pakete.forEach(wendeAn);
  speichereUebernommen();

  gemerkt.seit = seit ? { s: seit.seconds, n: seit.nanoseconds } : null;
  gemerkt.ersterAbgleichFertig = true;
  speichereStand();
  neuZeichnen(true);
}

// ---------- Empfangen ----------

function lausche() {
  if (abmeldenVomLauschen) abmeldenVomLauschen();
  const fb = cloud.firebase();
  const F = fb.F;

  // Nur abholen, was seit dem letzten Abgleich neu ist
  let abfrage = eintraegeSammlung();
  if (gemerkt.seit) {
    abfrage = F.query(abfrage, F.where("geaendert", ">=", new F.Timestamp(gemerkt.seit.s, gemerkt.seit.n)));
  }

  abmeldenVomLauschen = F.onSnapshot(abfrage, async function (schnappschuss) {
    let geaendert = false;
    for (const aenderung of schnappschuss.docChanges()) {
      if (aenderung.type === "removed") continue;
      const dok = aenderung.doc;
      if (dok.metadata.hasPendingWrites) continue; // eigenes, noch nicht bestätigt
      const d = dok.data();
      if (!d.geaendert) continue;

      let paket;
      try {
        paket = await tresor.entschluesseln(schluessel, d.daten);
      } catch (e) {
        melde({ fehler: "Einige Einträge konnten nicht entschlüsselt werden." });
        continue;
      }
      if (wendeAn(paket)) geaendert = true;

      // Merken, bis wohin schon abgeholt wurde
      const s = gemerkt.seit;
      if (!s || d.geaendert.seconds > s.s || (d.geaendert.seconds === s.s && d.geaendert.nanoseconds > s.n)) {
        gemerkt.seit = { s: d.geaendert.seconds, n: d.geaendert.nanoseconds };
      }
    }
    speichereStand();
    if (geaendert) {
      speichereUebernommen();
      neuZeichnen(false);
    }
    melde({
      zustand: navigator.onLine ? "aktiv" : "offline",
      letzterAbgleich: new Date(),
      anzahlImHaushalt: Object.keys(gemerkt.stand).length
    });
  }, function (fehler) {
    melde({ zustand: "fehler", fehler: cloud.fehlerText(fehler) });
  });
}

// Übernimmt ein Paket vom anderen Handy, wenn es neuer ist.
// Gibt true zurück, wenn sich auf diesem Handy etwas geändert hat.
function wendeAn(paket) {
  const liste = daten[paket.sammlung];
  if (!Array.isArray(liste)) return false;
  const id = paket.geloescht ? paket.id : paket.eintrag.id;
  const k = kennung(paket.sammlung, id);
  const lokal = liste.find(function (e) { return e.id === id; });
  const marke = (daten.geloescht || []).find(function (m) { return m.id === id; });

  // Löschmarke vom anderen Handy
  if (paket.geloescht) {
    gemerkt.stand[k] = "x" + paket.zeit;
    if (lokal && lokal.geaendert > paket.zeit) return false; // hier danach noch geändert
    let geaendert = false;
    if (lokal) {
      daten[paket.sammlung] = liste.filter(function (e) { return e.id !== id; });
      geaendert = true;
    }
    if (!marke) {
      daten.geloescht.push({ id: id, sammlung: paket.sammlung, zeit: paket.zeit });
      geaendert = true;
    }
    return geaendert;
  }

  // Eintrag vom anderen Handy
  const fremd = paket.eintrag;
  if (marke && marke.zeit >= fremd.geaendert) return false; // hier später gelöscht
  if (lokal && lokal.geaendert >= fremd.geaendert) {
    if (lokal.geaendert === fremd.geaendert) gemerkt.stand[k] = fremd.geaendert;
    return false; // eigener Stand ist gleich oder neuer
  }

  if (marke) {
    // Wurde nach dem Löschen woanders neu angelegt: Löschmarke entfernen
    daten.geloescht = daten.geloescht.filter(function (m) { return m.id !== id; });
  }
  if (lokal) {
    // Im selben Objekt ersetzen, damit offene Bildschirme ihn weiter finden
    Object.keys(lokal).forEach(function (s) { delete lokal[s]; });
    Object.assign(lokal, fremd);
  } else {
    liste.push(Object.assign({}, fremd));
  }
  gemerkt.stand[k] = fremd.geaendert;
  return true;
}

// Bildschirm neu zeichnen (nur wenn gerade nichts eingegeben wird)
function neuZeichnen(immer) {
  const name = location.hash.replace("#", "").split("/")[0];
  if (immer || LESE_BILDSCHIRME.includes(name)) {
    zeigeBildschirm();
  } else {
    zeigeMeldung("Neue Daten aus dem Haushalt");
  }
}

// ---------- Hochladen ----------

// Hochladen etwas später starten (mehrere Änderungen auf einmal)
function planeHochladen(verzoegerung) {
  clearTimeout(zeitgeber);
  zeitgeber = setTimeout(hochladen, verzoegerung);
}

// Was muss noch hochgeladen werden?
function ausstehendeAenderungen() {
  const liste = [];
  SAMMLUNGEN.forEach(function (s) {
    (daten[s] || []).forEach(function (e) {
      const k = kennung(s, e.id);
      if (gemerkt.stand[k] !== e.geaendert) {
        liste.push({ k: k, marke: e.geaendert, paket: { sammlung: s, eintrag: e } });
      }
    });
  });
  (daten.geloescht || []).forEach(function (m) {
    const k = kennung(m.sammlung, m.id);
    const vorhanden = (daten[m.sammlung] || []).some(function (e) { return e.id === m.id; });
    if (!vorhanden && gemerkt.stand[k] !== "x" + m.zeit) {
      liste.push({ k: k, marke: "x" + m.zeit, paket: { sammlung: m.sammlung, id: m.id, geloescht: true, zeit: m.zeit } });
    }
  });
  return liste;
}

export async function hochladen() {
  if (!haushaltId || !schluessel || status.zustand === "entscheidung" || !gemerkt.ersterAbgleichFertig) return;
  if (laeuftHochladen) { nochmalHochladen = true; return; }
  laeuftHochladen = true;

  const fb = cloud.firebase();
  const F = fb.F;
  const nutzer = cloud.nutzer();

  try {
    const liste = ausstehendeAenderungen();
    melde({ ausstehend: liste.length });

    // In Paketen zu höchstens 400 Einträgen schicken
    for (let start = 0; start < liste.length; start += 400) {
      const teil = liste.slice(start, start + 400);
      const stapel = F.writeBatch(fb.db);
      for (const a of teil) {
        stapel.set(F.doc(eintraegeSammlung(), await dokId(a.k)), {
          daten: await tresor.verschluesseln(schluessel, a.paket),
          geaendert: F.serverTimestamp(),
          von: nutzer.uid
        });
      }
      await stapel.commit(); // wartet ohne Internet, bis wieder Netz da ist
      teil.forEach(function (a) { gemerkt.stand[a.k] = a.marke; });
      speichereStand();
      melde({ ausstehend: Math.max(0, liste.length - start - teil.length) });
    }
    melde({
      zustand: "aktiv", fehler: null, letzterAbgleich: new Date(),
      anzahlImHaushalt: Object.keys(gemerkt.stand).length
    });
  } catch (fehler) {
    melde({ zustand: navigator.onLine ? "fehler" : "offline", fehler: cloud.fehlerText(fehler) });
  }

  laeuftHochladen = false;
  if (nochmalHochladen) {
    nochmalHochladen = false;
    planeHochladen(0);
  }
}

// Nach jedem Speichern hochladen (kurz warten, falls mehrere Änderungen kommen)
window.addEventListener("finanzplaner:gespeichert", function () {
  if (haushaltId) {
    melde({ ausstehend: ausstehendeAenderungen().length });
    planeHochladen(800);
  }
});

// Wieder online: Abgleich fortsetzen
window.addEventListener("online", function () {
  if (status.zustand === "offline" || status.zustand === "fehler") starte();
  else if (haushaltId) planeHochladen(0);
});
window.addEventListener("offline", function () {
  if (haushaltId) melde({ zustand: "offline" });
});
