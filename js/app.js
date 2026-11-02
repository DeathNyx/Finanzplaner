// ============================================
// Start der App und Navigation zwischen den Bildschirmen.
//
// So funktioniert es:
// Jeder Knopf ändert die Adresse, z. B. auf "#kassen".
// Die App merkt das und zeigt den passenden Bildschirm an.
// Dadurch funktioniert auch der Zurück Knopf am Handy.
//
// Manche Adressen haben einen Zusatz nach einem Schrägstrich,
// z. B. "#person/neu" oder "#person/per_abc123".
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
    zeichne: function (bereich) {
      bereich.innerHTML = platzhalter("Hier siehst du bald alle Kassen und dein Gesamtvermögen.");
    }
  },
  kassen: {
    titel: "Kassen",
    tab: "kassen",
    zeichne: zeichneKassen
  },
  kasse: {
    titel: "Kasse",
    tab: "kassen",
    zeichne: zeichneKasse
  },
  buchen: {
    titel: "Buchen",
    tab: "buchen",
    zeichne: function (bereich) {
      bereich.innerHTML = platzhalter("Hier erfasst du bald Ausgaben, Einnahmen und Überträge.");
    }
  },
  monat: {
    titel: "Monat",
    tab: "monat",
    zeichne: function (bereich) {
      bereich.innerHTML = platzhalter("Hier siehst du bald, was am Monatsende übrig bleibt.");
    }
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
  // "#person/neu" wird zu name = "person" und zusatz = "neu"
  const teile = location.hash.replace("#", "").split("/");
  let name = teile[0];
  const zusatz = teile[1];

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
  bildschirm.zeichne(bereich, zusatz);

  // Titel auch im Browser Tab anzeigen
  document.title = titel.textContent + " · Finanzplaner";

  // Falls beim Laden etwas schiefging, Hinweis ganz oben zeigen
  if (speicherWarnung) {
    bereich.insertAdjacentHTML("afterbegin",
      '<div class="karte warnung">' + schuetzeText(speicherWarnung) + "</div>");
  }

  // Den passenden Knopf unten farbig markieren
  document.querySelectorAll(".navi a").forEach(function (knopf) {
    knopf.classList.toggle("aktiv", knopf.dataset.ziel === bildschirm.tab);
  });

  // Nach oben scrollen, wenn man den Bildschirm wechselt
  window.scrollTo(0, 0);
}

// Beim Start mitzählen, wie oft die App geöffnet wurde (nur zum Testen)
daten.einstellungen.anzahlStarts = (daten.einstellungen.anzahlStarts || 0) + 1;
speichereDaten();

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
