// ============================================
// Start der App und Navigation zwischen den Bildschirmen.
//
// So funktioniert es:
// Jeder Knopf ändert die Adresse, z. B. auf "#kassen".
// Die App merkt das und zeigt den passenden Bildschirm an.
// Dadurch funktioniert auch der Zurück Knopf am Handy.
//
// Manche Adressen haben einen Zusatz nach einem Schrägstrich,
// z. B. "#person/neu" oder "#kasse/kas_abc123/2026-11".
// Der Zusatz sagt dem Bildschirm, was genau er zeigen soll.
// ============================================

// ============================================
// Liste aller Bildschirme.
//
// Jeder Bildschirm hat:
//   titel:   steht oben in der Kopfzeile
//   tab:     welcher Knopf unten dabei blau leuchtet
//   zeichne: Funktion, die den Inhalt in den Bereich einsetzt
// ============================================
const bildschirme = {
  uebersicht: {
    titel: "Übersicht",
    tab: "uebersicht",
    zeichne: zeichneUebersicht
  },
  kassen: {
    titel: "Kassen",
    tab: "kassen",
    zeichne: zeichneKassen
  },
  kasse: {
    titel: "Kasse",
    tab: "kassen",
    zeichne: zeichneKasseSeite
  },
  kasseform: {
    titel: "Kasse",
    tab: "kassen",
    zeichne: zeichneKassenFormular
  },
  buchen: {
    titel: "Buchen",
    tab: "buchen",
    zeichne: zeichneBuchen
  },
  buchung: {
    titel: "Buchung",
    tab: "kassen",
    zeichne: zeichneBuchung
  },
  ausgleich: {
    titel: "Ausgleich",
    tab: "kassen",
    zeichne: zeichneAusgleich
  },
  dauerauftraege: {
    titel: "Daueraufträge",
    tab: "mehr",
    zeichne: zeichneDauerauftraege
  },
  dauerauftrag: {
    titel: "Dauerauftrag",
    tab: "mehr",
    zeichne: zeichneDauerauftrag
  },
  schulden: {
    titel: "Schulden und Raten",
    tab: "mehr",
    zeichne: zeichneSchulden
  },
  schuld: {
    titel: "Schuld",
    tab: "mehr",
    zeichne: zeichneSchuld
  },
  kategorien: {
    titel: "Kategorien",
    tab: "mehr",
    zeichne: zeichneKategorienListe
  },
  kategorie: {
    titel: "Kategorie",
    tab: "mehr",
    zeichne: zeichneKategorie
  },
  backup: {
    titel: "Backup",
    tab: "mehr",
    zeichne: zeichneBackup
  },
  uebertrag: {
    titel: "Übertrag",
    // Neuer Übertrag gehört zu "Buchen", ein bestehender zu "Kassen"
    tab: function (zusatz) { return zusatz === "neu" ? "buchen" : "kassen"; },
    zeichne: zeichneUebertrag
  },
  monat: {
    titel: "Monatsübersicht",
    tab: "monat",
    zeichne: zeichneMonat
  },
  mehr: {
    titel: "Mehr",
    tab: "mehr",
    zeichne: zeichneMehr
  },
  personen: {
    titel: "Personen",
    tab: "mehr",
    zeichne: zeichnePersonen
  },
  person: {
    titel: "Person",
    tab: "mehr",
    zeichne: zeichnePerson
  }
};

// Welcher Bildschirm angezeigt wird, wenn nichts in der Adresse steht
const startBildschirm = "uebersicht";

// Zeigt den Bildschirm an, der gerade in der Adresse steht
function zeigeBildschirm() {
  // Vorher fällige Daueraufträge buchen (z. B. wenn ein neuer Monat begonnen hat)
  const gebucht = fuehreDauerauftraegeAus();
  if (gebucht > 0) {
    zeigeMeldung(gebucht === 1 ? "1 Dauerauftrag wurde gebucht" : gebucht + " Daueraufträge wurden gebucht");
  }

  // "#kasse/kas_abc/2026-11" wird zu name = "kasse",
  // zusatz = "kas_abc" und zusatz2 = "2026-11"
  const teile = location.hash.replace("#", "").split("/");
  let name = teile[0];
  const zusatz = teile[1];
  const zusatz2 = teile[2];

  // Unbekannte oder leere Adresse: zur Übersicht
  if (!bildschirme[name]) {
    name = startBildschirm;
  }

  const bildschirm = bildschirme[name];

  // Titel oben setzen (ein Bildschirm darf ihn danach noch ändern)
  const titel = document.getElementById("titel");
  titel.textContent = bildschirm.titel;

  // Inhalt zeichnen
  const bereich = document.getElementById("inhalt");
  bildschirm.zeichne(bereich, zusatz, zusatz2);

  // Titel auch im Browser Tab anzeigen
  document.title = titel.textContent + " · Finanzplaner";

  // Falls beim Laden etwas schiefging, Hinweis ganz oben zeigen
  if (speicherWarnung) {
    bereich.insertAdjacentHTML("afterbegin",
      '<div class="karte warnung">' + schuetzeText(speicherWarnung) + "</div>");
  }

  // Den passenden Knopf unten farbig markieren
  document.querySelectorAll(".navi a").forEach(function (knopf) {
    const tab = typeof bildschirm.tab === "function" ? bildschirm.tab(zusatz) : bildschirm.tab;
    knopf.classList.toggle("aktiv", knopf.dataset.ziel === tab);
  });

  // Nach oben scrollen, wenn man den Bildschirm wechselt
  window.scrollTo(0, 0);
}

// Den Testzähler aus Schritt 2 aufräumen, falls er noch gespeichert ist
if (daten.einstellungen.anzahlStarts !== undefined) {
  delete daten.einstellungen.anzahlStarts;
  speichereDaten();
}

// Zählt, wie oft innerhalb der App der Bildschirm gewechselt wurde
let anzahlWechsel = 0;

// Nach dem Speichern oder Abbrechen eines Formulars zurückgehen.
// Kam man aus der App, geht es einen Schritt zurück (wie der Zurück Knopf).
// Wurde das Formular direkt geöffnet, geht es zum angegebenen Ziel.
function zurueck(ziel) {
  if (anzahlWechsel > 0) {
    history.back();
  } else {
    location.replace(ziel);
  }
}

// Bei jeder Änderung der Adresse den Bildschirm neu anzeigen
window.addEventListener("hashchange", function () {
  anzahlWechsel++;
  zeigeBildschirm();
});

// Beim ersten Öffnen der Seite einmal anzeigen
zeigeBildschirm();
