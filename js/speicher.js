// ============================================
// Laden und Speichern aller Daten im Browser (localStorage).
//
// Alle Daten liegen in einem einzigen Paket ("daten").
// Das Paket hat mehrere Listen, wie Schubladen in einem Schrank.
// Die Daten liegen auf diesem Gerät. Für den Abgleich zwischen zwei
// Handys merkt sich die App bei jedem Eintrag, wann er zuletzt
// geändert wurde, und führt eine Liste gelöschter Einträge.
// ============================================

// Unter diesem Namen liegen die Daten im Browser
const SPEICHER_SCHLUESSEL = "finanzplaner_daten";

// Versionsnummer des Datenaufbaus. Wenn wir den Aufbau später
// ändern, erkennt die App daran alte Daten und kann sie umbauen.
// Version 2: Zeitstempel "geaendert" an jedem Eintrag und Löschmarken.
const DATEN_VERSION = 2;

// Alle Listen mit Einträgen, die zwischen Handys abgeglichen werden.
// Die Einstellungen gehören nicht dazu, die bleiben pro Handy.
const SAMMLUNGEN = [
  "personen", "kassen", "buchungen", "uebertraege", "dauerauftraege",
  "schulden", "kategorien", "ausgleiche", "sparziele"
];

// Ein leeres Datenpaket, so wie es beim allerersten Start aussieht
function leereDaten() {
  return {
    version: DATEN_VERSION,
    personen: [],      // { id, name, farbe }
    kassen: [],        // { id, name, farbe, art, personen, startbetrag, startdatum, aufteilung, archiviert }
    buchungen: [],     // { id, kasseId, typ, betrag, datum, kategorieId, notiz, bezahltVon, anteile, vorlageId }
    uebertraege: [],   // { id, vonKasseId, nachKasseId, betrag, datum, personId, notiz, vorlageId }
    dauerauftraege: [],// Vorlagen für alles, was jeden Monat wiederkommt
    schulden: [],      // { id, name, glaeubiger, rest, stichtag, rate, notiz }
    ausgleiche: [],    // { id, kasseId, vonPersonId, anPersonId, betrag, datum }
    sparziele: [],     // { id, name, kasseId, zielbetrag, zielMonat }
    kategorien: standardKategorien(),
    geloescht: [],     // Löschmarken: { id, sammlung, zeit }
    einstellungen: {}
  };
}

// Kategorien, die es von Anfang an gibt. Man kann sie später ändern.
function standardKategorien() {
  const einnahmen = ["Gehalt", "Nebenjob", "Sonstiges"];
  const ausgaben = [
    "Miete", "Strom", "Handy", "Versicherungen", "Abos",
    "Lebensmittel", "Mobilität", "Freizeit", "Gesundheit", "Sonstiges"
  ];

  const liste = [];
  einnahmen.forEach(function (name) {
    liste.push({ id: neueId("kat"), name: name, typ: "einnahme" });
  });
  ausgaben.forEach(function (name) {
    liste.push({ id: neueId("kat"), name: name, typ: "ausgabe" });
  });
  return liste;
}

// Erzeugt eine eindeutige ID, z. B. "kas_lq3x9a_k2f8".
// Der Teil vorne zeigt, wozu die ID gehört (kas = Kasse, per = Person ...).
function neueId(praefix) {
  const zeit = Date.now().toString(36);
  const zufall = Math.random().toString(36).slice(2, 6);
  return praefix + "_" + zeit + "_" + zufall;
}

// Daten aus dem Browser laden.
// Gibt es noch keine, bekommt man ein leeres Paket.
function ladeDaten() {
  let text = null;
  try {
    text = localStorage.getItem(SPEICHER_SCHLUESSEL);
  } catch (fehler) {
    // Manche Browser (z. B. privater Modus) erlauben keinen Speicher
    speicherWarnung = "Dein Browser erlaubt kein Speichern. Daten gehen beim Schließen verloren.";
    return leereDaten();
  }

  if (!text) {
    return leereDaten();
  }

  try {
    const geladen = JSON.parse(text);

    // Ältere Daten werden gleich umgebaut. Vorher eine Sicherheitskopie anlegen.
    if ((geladen.version || 1) < DATEN_VERSION) {
      try {
        const kopieName = SPEICHER_SCHLUESSEL + "_vor_umstellung_v" + DATEN_VERSION;
        if (!localStorage.getItem(kopieName)) localStorage.setItem(kopieName, text);
      } catch (e) { /* Sicherheitskopie ist freiwillig */ }
    }

    return ergaenzeFehlendes(geladen);
  } catch (fehler) {
    // Die gespeicherten Daten sind kaputt. Wir löschen sie NICHT,
    // sondern legen sie zur Sicherheit unter einem anderen Namen ab.
    try {
      localStorage.setItem(SPEICHER_SCHLUESSEL + "_defekt", text);
    } catch (e) { /* nichts zu tun */ }
    speicherWarnung = "Die gespeicherten Daten waren beschädigt. Sie wurden gesichert und die App startet leer.";
    return leereDaten();
  }
}

// Falls in älteren Daten eine Liste fehlt, wird sie leer ergänzt.
// Danach wird der Aufbau auf die aktuelle Version gebracht.
function ergaenzeFehlendes(geladen) {
  const vorlage = leereDaten();
  Object.keys(vorlage).forEach(function (schluessel) {
    if (geladen[schluessel] === undefined) {
      geladen[schluessel] = vorlage[schluessel];
    }
  });
  return baueUm(geladen);
}

// Bringt ältere Daten auf den aktuellen Aufbau
function baueUm(d) {
  if ((d.version || 1) < 2) {
    // Version 2: Jeder Eintrag bekommt einen Zeitstempel
    const jetzt = new Date().toISOString();
    SAMMLUNGEN.forEach(function (sammlung) {
      (d[sammlung] || []).forEach(function (eintrag) {
        if (!eintrag.geaendert) eintrag.geaendert = jetzt;
      });
    });
    if (!Array.isArray(d.geloescht)) d.geloescht = [];
  }
  d.version = DATEN_VERSION;
  return d;
}


// ============================================
// Änderungen erkennen (für den Abgleich zwischen Handys)
//
// Beim Speichern vergleicht die App jeden Eintrag mit dem zuletzt
// gespeicherten Stand:
//   - neu oder geändert: bekommt den Zeitstempel "geaendert"
//   - verschwunden: kommt auf die Liste "geloescht" (Löschmarke)
// So muss nicht jeder Bildschirm selbst daran denken.
// ============================================

// Zuletzt gespeicherter Stand: { sammlung: { id: Fingerabdruck } }
let letzterStand = {};

// Ein "Fingerabdruck" eines Eintrags: sein Inhalt als Text, ohne Zeitstempel
function fingerabdruck(eintrag) {
  const kopie = Object.assign({}, eintrag);
  delete kopie.geaendert;
  return JSON.stringify(kopie);
}

// Den jetzigen Stand als Vergleichsgrundlage merken
function merkeStand() {
  letzterStand = {};
  SAMMLUNGEN.forEach(function (sammlung) {
    const abdruecke = {};
    (daten[sammlung] || []).forEach(function (e) { abdruecke[e.id] = fingerabdruck(e); });
    letzterStand[sammlung] = abdruecke;
  });
}

// Neue und geänderte Einträge mit Zeitstempel versehen, gelöschte vermerken
function markiereAenderungen() {
  const jetzt = new Date().toISOString();
  if (!Array.isArray(daten.geloescht)) daten.geloescht = [];

  SAMMLUNGEN.forEach(function (sammlung) {
    const vorher = letzterStand[sammlung] || {};
    const vorhanden = {};

    (daten[sammlung] || []).forEach(function (e) {
      vorhanden[e.id] = true;
      if (vorher[e.id] !== fingerabdruck(e) || !e.geaendert) {
        e.geaendert = jetzt;
      }
    });

    Object.keys(vorher).forEach(function (id) {
      if (!vorhanden[id] && !istGeloescht(id)) {
        daten.geloescht.push({ id: id, sammlung: sammlung, zeit: jetzt });
      }
    });
  });
}

// Speichert Daten, die vom anderen Handy kamen. Sie werden NICHT als
// eigene Änderung markiert, sonst würden sie gleich wieder hochgeladen.
function speichereUebernommen() {
  merkeStand();
  try {
    localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(daten));
    return true;
  } catch (fehler) {
    return false;
  }
}

// Wurde ein Eintrag mit dieser ID einmal gelöscht?
function istGeloescht(id) {
  return (daten.geloescht || []).some(function (m) { return m.id === id; });
}

// Das aktuelle Datenpaket im Browser speichern.
// Gibt true zurück, wenn es geklappt hat.
function speichereDaten() {
  markiereAenderungen();
  merkeStand();
  try {
    localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(daten));
    // Dem Abgleich Bescheid geben, dass es etwas Neues zum Hochladen gibt
    window.dispatchEvent(new Event("finanzplaner:gespeichert"));
    return true;
  } catch (fehler) {
    alert("Speichern hat nicht geklappt. Vielleicht ist der Speicher des Browsers voll.");
    return false;
  }
}

// ============================================
// Hilfsfunktionen zum Suchen in den Daten
// ============================================

// Person anhand ihrer ID finden (oder undefined, wenn es sie nicht gibt)
function findePerson(id) {
  return daten.personen.find(function (p) { return p.id === id; });
}

// Prüft, ob eine Person noch irgendwo vorkommt:
// in einer Kasse, als Zahler einer Buchung oder bei einem Übertrag
function personWirdVerwendet(id) {
  const inKasse = daten.kassen.some(function (k) { return (k.personen || []).includes(id); });
  const inBuchung = daten.buchungen.some(function (b) {
    return b.bezahltVon === id || (b.anteile && b.anteile[id] !== undefined);
  });
  const inUebertrag = daten.uebertraege.some(function (u) { return u.personId === id; });
  const inAusgleich = daten.ausgleiche.some(function (a) { return a.vonPersonId === id || a.anPersonId === id; });
  const inDauerauftrag = daten.dauerauftraege.some(function (d) { return d.bezahltVon === id; });
  return inKasse || inBuchung || inUebertrag || inAusgleich || inDauerauftrag;
}

// Kategorie anhand ihrer ID finden
function findeKategorie(id) {
  return daten.kategorien.find(function (k) { return k.id === id; });
}

// Buchung anhand ihrer ID finden
function findeBuchung(id) {
  return daten.buchungen.find(function (b) { return b.id === id; });
}

// Kasse anhand ihrer ID finden
function findeKasse(id) {
  return daten.kassen.find(function (k) { return k.id === id; });
}

// Prüft, ob in einer Kasse schon etwas gebucht wurde
// (Buchungen, Überträge oder Daueraufträge)
function kasseWirdVerwendet(id) {
  const inBuchung = daten.buchungen.some(function (b) { return b.kasseId === id; });
  const inUebertrag = daten.uebertraege.some(function (u) {
    return u.vonKasseId === id || u.nachKasseId === id;
  });
  const inDauerauftrag = daten.dauerauftraege.some(function (d) {
    return d.kasseId === id || d.vonKasseId === id || d.nachKasseId === id;
  });
  const inAusgleich = daten.ausgleiche.some(function (a) { return a.kasseId === id; });
  return inBuchung || inUebertrag || inDauerauftrag || inAusgleich;
}

// Hier merken wir uns eine Warnung, falls beim Laden etwas schiefging
let speicherWarnung = null;

// Die Daten werden einmal beim Start geladen und liegen dann hier bereit.
// Alle anderen Teile der App lesen und ändern dieses Paket.
let daten = ladeDaten();

// Der geladene Stand ist die Grundlage für das Erkennen von Änderungen
merkeStand();
