// ============================================
// Die einzelnen Bildschirme der App.
//
// Jeder Bildschirm hat:
//   titel:   steht oben in der Kopfzeile
//   tab:     welcher Knopf unten dabei blau leuchtet
//   zeichne: Funktion, die den Inhalt in den Bereich einsetzt
// ============================================

// Farben, aus denen man für Personen (und später Kassen) wählen kann
const FARBEN = [
  { wert: "#1f6feb", name: "Blau" },
  { wert: "#1a7f37", name: "Grün" },
  { wert: "#d1650f", name: "Orange" },
  { wert: "#8250df", name: "Lila" },
  { wert: "#bf3989", name: "Pink" },
  { wert: "#0a7f86", name: "Türkis" },
  { wert: "#cf222e", name: "Rot" },
  { wert: "#6e7781", name: "Grau" }
];

// Hilfsfunktion: eine Karte mit einem grauen Platzhaltertext
function platzhalter(text) {
  return '<div class="karte"><p class="leise">' + text + "</p></div>";
}

// Hilfsfunktion: ein runder Farbpunkt
function farbpunkt(farbe) {
  return '<span class="farbpunkt" style="background:' + schuetzeText(farbe) + '"></span>';
}

// Hilfsfunktion: Auswahl von Farben als runde Knöpfe.
// "gewaehlt" ist die Farbe, die am Anfang markiert ist.
function farbauswahl(gewaehlt) {
  let html = '<fieldset class="farbwahl"><legend>Farbe</legend>';
  FARBEN.forEach(function (farbe) {
    html +=
      '<label title="' + farbe.name + '">' +
      '<input type="radio" name="farbe" value="' + farbe.wert + '"' +
      (farbe.wert === gewaehlt ? " checked" : "") + ">" +
      '<span style="background:' + farbe.wert + '"></span>' +
      '<span class="nur-vorlesen">' + farbe.name + "</span>" +
      "</label>";
  });
  return html + "</fieldset>";
}

// Die erste Farbe, die noch niemand benutzt (sonst einfach Blau)
function freieFarbe(liste) {
  const benutzt = liste.map(function (eintrag) { return eintrag.farbe; });
  const frei = FARBEN.find(function (farbe) { return !benutzt.includes(farbe.wert); });
  return frei ? frei.wert : FARBEN[0].wert;
}


// ============================================
// Bildschirm "Mehr": Menü mit weiteren Bereichen
// ============================================
function zeichneMehr(bereich) {
  bereich.innerHTML =
    '<nav class="menue karte">' +
    '  <a href="#personen">👤 Personen</a>' +
    '  <span class="bald">🏷️ Kategorien <small>kommt bald</small></span>' +
    '  <span class="bald">🔁 Daueraufträge <small>kommt bald</small></span>' +
    '  <span class="bald">📉 Schulden <small>kommt bald</small></span>' +
    '  <span class="bald">💾 Backup <small>kommt bald</small></span>' +
    "</nav>" +
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


// ============================================
// Bildschirm "Personen": Liste aller Personen
// ============================================
function zeichnePersonen(bereich) {
  let html = "";

  if (daten.personen.length === 0) {
    html += platzhalter("Noch keine Personen. Lege zuerst dich selbst an, danach zum Beispiel deine Partnerin.");
  } else {
    html += '<div class="liste karte">';
    daten.personen.forEach(function (person) {
      html +=
        '<a class="zeile" href="#person/' + person.id + '">' +
        farbpunkt(person.farbe) +
        '<span class="zeile-text">' + schuetzeText(person.name) + "</span>" +
        '<span class="pfeil">›</span>' +
        "</a>";
    });
    html += "</div>";
  }

  html += '<a class="knopf" href="#person/neu">+ Person hinzufügen</a>';
  bereich.innerHTML = html;
}


// ============================================
// Bildschirm "Person": anlegen oder bearbeiten
// "id" ist entweder "neu" oder die ID einer Person
// ============================================
function zeichnePerson(bereich, id) {
  const istNeu = id === "neu";
  const person = istNeu ? null : findePerson(id);

  // Person nicht gefunden (z. B. gelöscht): zurück zur Liste
  if (!istNeu && !person) {
    location.replace("#personen");
    return;
  }

  // Titel oben passend setzen
  document.getElementById("titel").textContent = istNeu ? "Neue Person" : "Person bearbeiten";

  const name = person ? person.name : "";
  const farbe = person ? person.farbe : freieFarbe(daten.personen);

  bereich.innerHTML =
    '<form id="personFormular" class="karte" novalidate>' +
    '  <label class="feld">Name' +
    '    <input id="personName" type="text" maxlength="30" autocomplete="off" value="' + schuetzeText(name) + '" placeholder="z. B. Ich oder Partnerin">' +
    "  </label>" +
    '  <p id="fehler" class="fehler" hidden></p>' +
    farbauswahl(farbe) +
    '  <button type="submit" class="knopf">Speichern</button>' +
    '  <button type="button" id="abbrechen" class="knopf zweit">Abbrechen</button>' +
    "</form>" +
    (istNeu ? "" : '<button type="button" id="loeschen" class="knopf gefahr">Person löschen</button>');

  const formular = document.getElementById("personFormular");
  const feldName = document.getElementById("personName");
  const fehler = document.getElementById("fehler");

  // Bei einer neuen Person gleich ins Namensfeld springen
  if (istNeu) feldName.focus();

  // Speichern
  formular.addEventListener("submit", function (ereignis) {
    // Verhindert, dass der Browser die Seite neu lädt
    ereignis.preventDefault();

    const neuerName = feldName.value.trim();
    const gewaehlteFarbe = formular.querySelector('input[name="farbe"]:checked').value;

    // Prüfen: Name darf nicht leer sein
    if (neuerName === "") {
      zeigeFehler(fehler, "Bitte gib einen Namen ein.");
      feldName.focus();
      return;
    }

    // Prüfen: Name darf nicht doppelt vorkommen
    const doppelt = daten.personen.some(function (p) {
      return p.name.toLowerCase() === neuerName.toLowerCase() && (!person || p.id !== person.id);
    });
    if (doppelt) {
      zeigeFehler(fehler, "Es gibt schon eine Person mit diesem Namen.");
      feldName.focus();
      return;
    }

    if (istNeu) {
      daten.personen.push({ id: neueId("per"), name: neuerName, farbe: gewaehlteFarbe });
    } else {
      // Nur Name und Farbe ändern. Die ID bleibt gleich,
      // deshalb passen alle Kassen und Buchungen weiterhin.
      person.name = neuerName;
      person.farbe = gewaehlteFarbe;
    }

    speichereDaten();
    // Zurück zur Liste. So landet man mit dem Zurück Knopf
    // später nicht wieder im Formular.
    zurueck("#personen");
  });

  // Abbrechen: einfach einen Schritt zurück
  document.getElementById("abbrechen").addEventListener("click", function () {
    zurueck("#personen");
  });

  // Löschen (nur bei bestehenden Personen)
  if (!istNeu) {
    document.getElementById("loeschen").addEventListener("click", function () {
      // Personen, die noch irgendwo vorkommen, dürfen nicht gelöscht werden.
      // Sonst wüssten alte Buchungen nicht mehr, wer bezahlt hat.
      if (personWirdVerwendet(person.id)) {
        alert(person.name + " gehört noch zu einer Kasse oder kommt in Buchungen vor und kann deshalb nicht gelöscht werden.");
        return;
      }
      if (!confirm(person.name + " wirklich löschen?")) return;

      daten.personen = daten.personen.filter(function (p) { return p.id !== person.id; });
      speichereDaten();
      zurueck("#personen");
    });
  }
}

// Fehlermeldung im Formular anzeigen
function zeigeFehler(element, text) {
  element.textContent = text;
  element.hidden = false;
}


// ============================================
// Liste aller Bildschirme
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
    zeichne: function (bereich) {
      bereich.innerHTML = platzhalter("Hier kannst du bald Kassen anlegen und bearbeiten.");
    }
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
