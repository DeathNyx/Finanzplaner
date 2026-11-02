// ============================================
// Backup: alle Daten als Datei sichern und wieder einlesen.
//
// Die Daten liegen nur in diesem Browser. Wird der Browser
// zurückgesetzt oder das Handy gewechselt, sind sie weg.
// Deshalb regelmäßig ein Backup machen!
//
// Aufbau einer Backup Datei:
// {
//   app: "finanzplaner",
//   version: 1,
//   exportiertAm: "2026-11-02T10:15:00.000Z",
//   daten: { personen: [...], kassen: [...], ... }
// }
// ============================================

// Unter diesem Namen liegt eine Sicherheitskopie vom Stand vor dem letzten Import
const SCHLUESSEL_VOR_IMPORT = SPEICHER_SCHLUESSEL + "_vor_import";

// Nach so vielen Tagen ohne Backup erinnert die Übersicht daran
const BACKUP_ERINNERUNG_TAGE = 30;

// Den Inhalt einer Backup Datei als Text erzeugen.
// Das heutige Datum steht schon als "letztes Backup" darin, damit die App
// es nach dem Einlesen noch weiß.
function backupText() {
  const kopie = Object.assign({}, daten, {
    einstellungen: Object.assign({}, daten.einstellungen, { letztesBackup: heute() })
  });
  return JSON.stringify({
    app: "finanzplaner",
    version: DATEN_VERSION,
    exportiertAm: new Date().toISOString(),
    daten: kopie
  }, null, 2);
}

// Dateiname mit Datum, z. B. "finanzplaner-backup-2026-11-02.json"
function backupDateiname() {
  return "finanzplaner-backup-" + heute() + ".json";
}

// Merkt sich, wann zuletzt ein Backup gemacht wurde
function merkeBackup() {
  daten.einstellungen.letztesBackup = heute();
  speichereDaten();
}

// Wie viele Tage ist das letzte Backup her? (null = noch nie)
function tageSeitBackup() {
  const letztes = daten.einstellungen.letztesBackup;
  if (!letztes) return null;
  const ms = new Date(heute()) - new Date(letztes);
  return Math.round(ms / 86400000);
}

// Soll die Übersicht an ein Backup erinnern?
function backupFaellig() {
  if (daten.buchungen.length === 0 && daten.kassen.length === 0) return false;
  const tage = tageSeitBackup();
  return tage === null || tage >= BACKUP_ERINNERUNG_TAGE;
}

// Prüft, ob ein eingelesenes Objekt ein gültiges Backup ist.
// Gibt die Daten zurück oder wirft einen Fehler mit verständlichem Text.
function pruefeBackup(objekt) {
  if (!objekt || typeof objekt !== "object") {
    throw new Error("Die Datei enthält keine Daten des Finanzplaners.");
  }

  // Ein Backup mit Hülle oder direkt das Datenpaket
  const inhalt = objekt.app === "finanzplaner" ? objekt.daten : objekt;
  const version = objekt.app === "finanzplaner" ? objekt.version : inhalt && inhalt.version;

  if (!inhalt || !Array.isArray(inhalt.personen) || !Array.isArray(inhalt.kassen) || !Array.isArray(inhalt.buchungen)) {
    throw new Error("Die Datei ist kein Backup des Finanzplaners.");
  }
  if (version > DATEN_VERSION) {
    throw new Error("Das Backup stammt von einer neueren Version der App und kann hier nicht eingelesen werden.");
  }

  // Alle Listen, die es geben muss, müssen auch Listen sein
  ["uebertraege", "dauerauftraege", "schulden", "kategorien", "ausgleiche", "sparziele"].forEach(function (name) {
    if (inhalt[name] !== undefined && !Array.isArray(inhalt[name])) {
      throw new Error("Die Datei ist beschädigt (" + name + ").");
    }
  });

  return inhalt;
}

// Ersetzt alle Daten durch die neuen. Vorher wird der alte Stand gesichert.
function ersetzeDaten(neueDaten) {
  try {
    localStorage.setItem(SCHLUESSEL_VOR_IMPORT, JSON.stringify(daten));
  } catch (fehler) { /* Sicherheitskopie ist freiwillig */ }

  daten = ergaenzeFehlendes(neueDaten);
  speichereDaten();
}

// Kurze Zusammenfassung, z. B. "2 Personen, 4 Kassen, 37 Buchungen"
function datenZusammenfassung(d) {
  return d.personen.length + " Personen, " + d.kassen.length + " Kassen, " +
    d.buchungen.length + " Buchungen, " + (d.uebertraege || []).length + " Überträge";
}


// ============================================
// Bildschirm "Backup"
// ============================================
function zeichneBackup(bereich) {
  const tage = tageSeitBackup();
  let letztes = "Du hast noch kein Backup gemacht.";
  if (tage === 0) letztes = "Letztes Backup: heute ✓";
  else if (tage === 1) letztes = "Letztes Backup: gestern";
  else if (tage !== null) letztes = "Letztes Backup: vor " + tage + " Tagen";

  let vorImport = null;
  try { vorImport = localStorage.getItem(SCHLUESSEL_VOR_IMPORT); } catch (e) { /* egal */ }

  // Teilen von Dateien geht nur auf manchen Geräten (z. B. iPhone, Android)
  const kannTeilen = !!(navigator.canShare && navigator.share &&
    navigator.canShare({ files: [new File(["{}"], "test.json", { type: "application/json" })] }));

  bereich.innerHTML =
    '<div class="karte">' +
    "  <h2>Sichern</h2>" +
    '  <p class="leise">Deine Daten liegen nur in diesem Browser. Sichere sie regelmäßig als Datei, zum Beispiel in deiner Cloud oder per Mail an dich selbst.</p>' +
    '  <p class="' + (backupFaellig() ? "fehler" : "leise") + '">' + letztes + "</p>" +
    '  <p class="leise klein">Enthalten: ' + datenZusammenfassung(daten) + ".</p>" +
    (kannTeilen ? '  <button type="button" id="teilen" class="knopf">Backup teilen oder speichern</button>' : "") +
    '  <button type="button" id="herunterladen" class="knopf' + (kannTeilen ? " zweit" : "") + '">Backup herunterladen</button>' +
    "</div>" +

    '<div class="karte">' +
    "  <h2>Wiederherstellen</h2>" +
    '  <p class="leise">Wähle eine Backup Datei aus. Achtung: Dabei werden alle Daten in diesem Browser ersetzt.</p>' +
    '  <label class="knopf zweit datei-knopf">Backup Datei auswählen' +
    '    <input type="file" id="datei" accept=".json,application/json">' +
    "  </label>" +
    '  <p id="importMeldung" class="fehler" hidden></p>' +
    (vorImport ? '  <button type="button" id="rueckgaengig" class="knopf zweit">Stand vor dem letzten Einlesen zurückholen</button>' : "") +
    "</div>" +

    '<div class="karte">' +
    "  <h2>Ausprobieren</h2>" +
    '  <p class="leise">Lädt erfundene Beispieldaten (Personen, Kassen, Buchungen), damit du alles in Ruhe testen kannst. Deine aktuellen Daten werden dabei ersetzt, lassen sich aber mit dem Knopf oben zurückholen.</p>' +
    '  <button type="button" id="beispiel" class="knopf zweit">Beispieldaten laden</button>' +
    "</div>" +

    '<button type="button" id="allesLoeschen" class="knopf gefahr">Alle Daten löschen</button>';

  // Herunterladen
  document.getElementById("herunterladen").addEventListener("click", function () {
    const blob = new Blob([backupText()], { type: "application/json" });
    const adresse = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = adresse;
    link.download = backupDateiname();
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(adresse); }, 2000);
    merkeBackup();
    zeigeMeldung("Backup wurde erstellt");
    zeichneBackup(bereich);
  });

  // Teilen (öffnet am Handy das Teilen Menü: Dateien, Mail, Cloud ...)
  const knopfTeilen = document.getElementById("teilen");
  if (knopfTeilen) {
    knopfTeilen.addEventListener("click", function () {
      const datei = new File([backupText()], backupDateiname(), { type: "application/json" });
      navigator.share({ files: [datei], title: "Finanzplaner Backup" })
        .then(function () {
          merkeBackup();
          zeigeMeldung("Backup wurde geteilt");
          zeichneBackup(bereich);
        })
        .catch(function () { /* abgebrochen, nichts zu tun */ });
    });
  }

  // Datei einlesen
  const meldung = document.getElementById("importMeldung");
  document.getElementById("datei").addEventListener("change", function (ereignis) {
    const datei = ereignis.target.files[0];
    if (!datei) return;
    meldung.hidden = true;

    const leser = new FileReader();
    leser.onload = function () {
      let neueDaten;
      try {
        neueDaten = pruefeBackup(JSON.parse(leser.result));
      } catch (fehler) {
        meldung.textContent = fehler instanceof SyntaxError ? "Die Datei konnte nicht gelesen werden." : fehler.message;
        meldung.hidden = false;
        ereignis.target.value = "";
        return;
      }
      const frage = "Backup einlesen?\n\nIm Backup: " + datenZusammenfassung(neueDaten) +
        ".\n\nAlle aktuellen Daten in diesem Browser werden dadurch ersetzt.";
      if (!confirm(frage)) {
        ereignis.target.value = "";
        return;
      }
      ersetzeDaten(neueDaten);
      zeigeMeldung("Backup wurde eingelesen");
      location.hash = "#uebersicht";
    };
    leser.onerror = function () {
      meldung.textContent = "Die Datei konnte nicht gelesen werden.";
      meldung.hidden = false;
    };
    leser.readAsText(datei);
  });

  // Rückgängig: Stand vor dem letzten Einlesen
  const knopfZurueck = document.getElementById("rueckgaengig");
  if (knopfZurueck) {
    knopfZurueck.addEventListener("click", function () {
      if (!confirm("Den Stand von vor dem letzten Einlesen zurückholen? Die jetzigen Daten werden dabei ersetzt.")) return;
      let alt;
      try {
        alt = JSON.parse(localStorage.getItem(SCHLUESSEL_VOR_IMPORT));
      } catch (e) {
        alert("Die Sicherheitskopie ist nicht lesbar.");
        return;
      }
      daten = ergaenzeFehlendes(alt);
      speichereDaten();
      try { localStorage.removeItem(SCHLUESSEL_VOR_IMPORT); } catch (e) { /* egal */ }
      zeigeMeldung("Alter Stand ist zurück");
      location.hash = "#uebersicht";
    });
  }

  // Beispieldaten aus der Datei beispieldaten.json laden
  document.getElementById("beispiel").addEventListener("click", function () {
    if (!confirm("Beispieldaten laden? Deine aktuellen Daten werden ersetzt (du kannst sie danach zurückholen).")) return;
    fetch("beispieldaten.json")
      .then(function (antwort) {
        if (!antwort.ok) throw new Error();
        return antwort.json();
      })
      .then(function (inhalt) {
        ersetzeDaten(pruefeBackup(inhalt));
        zeigeMeldung("Beispieldaten geladen");
        location.hash = "#uebersicht";
      })
      .catch(function () {
        alert("Die Beispieldaten konnten nicht geladen werden.");
      });
  });

  // Alles löschen, mit doppelter Sicherheitsfrage
  document.getElementById("allesLoeschen").addEventListener("click", function () {
    if (!confirm("Wirklich ALLE Daten in diesem Browser löschen? Mach vorher am besten ein Backup.")) return;
    if (!confirm("Letzte Frage: Alles löschen? Das kann nicht rückgängig gemacht werden.")) return;
    daten = leereDaten();
    speichereDaten();
    zeigeMeldung("Alle Daten wurden gelöscht");
    location.hash = "#uebersicht";
  });
}
