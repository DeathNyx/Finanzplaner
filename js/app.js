// ============================================
// Start der App und Navigation zwischen den Bildschirmen.
//
// So funktioniert es:
// Jeder Knopf unten ändert die Adresse, z. B. auf "#kassen".
// Die App merkt das und zeigt den passenden Bildschirm an.
// Dadurch funktioniert auch der Zurück Knopf am Handy.
// ============================================

// Hilfsfunktion: eine Karte mit einem grauen Platzhaltertext
function platzhalter(text) {
  return '<div class="karte"><p class="leise">' + text + "</p></div>";
}

// Liste aller Bildschirme. Jeder hat einen Titel und eine
// Funktion "zeichne", die den Inhalt in den Bereich einsetzt.
const bildschirme = {
  uebersicht: {
    titel: "Übersicht",
    zeichne: function (bereich) {
      bereich.innerHTML = platzhalter("Hier siehst du bald alle Kassen und dein Gesamtvermögen.");
    }
  },
  kassen: {
    titel: "Kassen",
    zeichne: function (bereich) {
      bereich.innerHTML = platzhalter("Hier kannst du bald Kassen anlegen und bearbeiten.");
    }
  },
  buchen: {
    titel: "Buchen",
    zeichne: function (bereich) {
      bereich.innerHTML = platzhalter("Hier erfasst du bald Ausgaben, Einnahmen und Überträge.");
    }
  },
  monat: {
    titel: "Monat",
    zeichne: function (bereich) {
      bereich.innerHTML = platzhalter("Hier siehst du bald, was am Monatsende übrig bleibt.");
    }
  },
  mehr: {
    titel: "Mehr",
    zeichne: zeichneMehr
  }
};

// Bildschirm "Mehr". Enthält vorläufig einen Testbereich,
// mit dem du Speichern und Formatieren ausprobieren kannst.
function zeichneMehr(bereich) {
  bereich.innerHTML =
    platzhalter("Hier findest du bald Personen, Kategorien, Daueraufträge, Schulden und Backup.") +
    '<div class="karte">' +
    "  <h2>Testbereich</h2>" +
    '  <p class="leise">Dieser Bereich ist nur zum Ausprobieren und wird später entfernt.</p>' +
    "  <p>Heute ist der <strong>" + formatDatum(heute()) + "</strong> (" + formatMonat(heute().slice(0, 7)) + ").</p>" +
    "  <p>Die App wurde auf diesem Gerät schon <strong>" + daten.einstellungen.anzahlStarts + " mal</strong> geöffnet.</p>" +
    '  <label class="feld">Betrag eingeben' +
    '    <input id="testBetrag" type="text" inputmode="decimal" placeholder="z. B. 1234,5">' +
    "  </label>" +
    '  <p id="testErgebnis" class="leise">Noch nichts eingegeben.</p>' +
    "</div>";

  // Bei jeder Eingabe sofort das Ergebnis anzeigen
  const eingabe = document.getElementById("testBetrag");
  const ergebnis = document.getElementById("testErgebnis");
  eingabe.addEventListener("input", function () {
    const cent = leseBetrag(eingabe.value);
    if (eingabe.value.trim() === "") {
      ergebnis.textContent = "Noch nichts eingegeben.";
    } else if (cent === null) {
      ergebnis.textContent = "Das ist kein gültiger Betrag.";
    } else {
      ergebnis.textContent = "Anzeige: " + formatEuro(cent) + " · gespeichert als " + cent + " Cent";
    }
  });
}

// Welcher Bildschirm angezeigt wird, wenn nichts in der Adresse steht
const startBildschirm = "uebersicht";

// Zeigt den Bildschirm an, der gerade in der Adresse steht
function zeigeBildschirm() {
  // "#kassen" wird zu "kassen"
  let name = location.hash.replace("#", "");

  // Unbekannte oder leere Adresse: zur Übersicht
  if (!bildschirme[name]) {
    name = startBildschirm;
  }

  const bildschirm = bildschirme[name];

  // Titel oben und im Browser Tab setzen
  document.getElementById("titel").textContent = bildschirm.titel;
  document.title = bildschirm.titel + " · Finanzplaner";

  // Inhalt zeichnen
  const bereich = document.getElementById("inhalt");
  bildschirm.zeichne(bereich);

  // Falls beim Laden etwas schiefging, Hinweis ganz oben zeigen
  if (speicherWarnung) {
    bereich.insertAdjacentHTML("afterbegin",
      '<div class="karte warnung">' + schuetzeText(speicherWarnung) + "</div>");
  }

  // Den passenden Knopf unten farbig markieren
  document.querySelectorAll(".navi a").forEach(function (knopf) {
    knopf.classList.toggle("aktiv", knopf.dataset.ziel === name);
  });

  // Nach oben scrollen, wenn man den Bildschirm wechselt
  window.scrollTo(0, 0);
}

// Beim Start mitzählen, wie oft die App geöffnet wurde (nur zum Testen)
daten.einstellungen.anzahlStarts = (daten.einstellungen.anzahlStarts || 0) + 1;
speichereDaten();

// Bei jeder Änderung der Adresse den Bildschirm neu anzeigen
window.addEventListener("hashchange", zeigeBildschirm);

// Beim ersten Öffnen der Seite einmal anzeigen
zeigeBildschirm();
