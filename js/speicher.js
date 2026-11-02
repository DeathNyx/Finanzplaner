// ============================================
// Laden und Speichern aller Daten im Browser (localStorage).
//
// Alle Daten liegen in einem einzigen Paket ("daten").
// Das Paket hat mehrere Listen, wie Schubladen in einem Schrank.
// Die Daten bleiben nur auf diesem Gerät in diesem Browser.
// ============================================

// Unter diesem Namen liegen die Daten im Browser
const SPEICHER_SCHLUESSEL = "finanzplaner_daten";

// Versionsnummer des Datenaufbaus. Wenn wir den Aufbau später
// ändern, erkennt die App daran alte Daten und kann sie umbauen.
const DATEN_VERSION = 1;

// Ein leeres Datenpaket, so wie es beim allerersten Start aussieht
function leereDaten() {
  return {
    version: DATEN_VERSION,
    personen: [],      // { id, name, farbe }
    kassen: [],        // { id, name, farbe, art, personen, startbetrag, startdatum, aufteilung, archiviert }
    buchungen: [],     // { id, kasseId, typ, betrag, datum, kategorieId, notiz, bezahltVon, anteile, vorlageId }
    uebertraege: [],   // { id, vonKasseId, nachKasseId, betrag, datum, personId, notiz, vorlageId }
    dauerauftraege: [],// Vorlagen für alles, was jeden Monat wiederkommt
    schulden: [],      // { id, glaeubiger, restbetrag, rate, ... }
    kategorien: standardKategorien(),
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

// Falls in älteren Daten eine Liste fehlt, wird sie leer ergänzt
function ergaenzeFehlendes(geladen) {
  const vorlage = leereDaten();
  Object.keys(vorlage).forEach(function (schluessel) {
    if (geladen[schluessel] === undefined) {
      geladen[schluessel] = vorlage[schluessel];
    }
  });
  return geladen;
}

// Das aktuelle Datenpaket im Browser speichern.
// Gibt true zurück, wenn es geklappt hat.
function speichereDaten() {
  try {
    localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(daten));
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
  return inKasse || inBuchung || inUebertrag;
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
  return inBuchung || inUebertrag || inDauerauftrag;
}

// Hier merken wir uns eine Warnung, falls beim Laden etwas schiefging
let speicherWarnung = null;

// Die Daten werden einmal beim Start geladen und liegen dann hier bereit.
// Alle anderen Teile der App lesen und ändern dieses Paket.
let daten = ladeDaten();
