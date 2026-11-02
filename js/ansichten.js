// ============================================
// Gemeinsame Bausteine für alle Bildschirme
// (Farben, Farbpunkte, Fehlermeldungen ...)
// und der Bildschirm "Mehr".
// ============================================

// Farben, aus denen man für Personen und Kassen wählen kann
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

// Fehlermeldung im Formular anzeigen
function zeigeFehler(element, text) {
  element.textContent = text;
  element.hidden = false;
}

// Kurze Meldung unten einblenden, z. B. "Buchung gespeichert".
// Sie verschwindet nach ein paar Sekunden von selbst.
function zeigeMeldung(text) {
  let meldung = document.getElementById("meldung");
  if (!meldung) {
    meldung = document.createElement("div");
    meldung.id = "meldung";
    meldung.className = "meldung";
    meldung.setAttribute("role", "status");
    document.body.appendChild(meldung);
  }
  meldung.textContent = text;
  meldung.classList.add("sichtbar");
  clearTimeout(zeigeMeldung.zeitgeber);
  zeigeMeldung.zeitgeber = setTimeout(function () {
    meldung.classList.remove("sichtbar");
  }, 2500);
}

// Betrag mit Vorzeichen und Farbe, z. B. "+ 50,00 €" grün oder "− 12,00 €" rot
function betragMitVorzeichen(cent, typ) {
  const plus = typ === "einnahme";
  return '<span class="betrag ' + (plus ? "positiv" : "negativ") + '">' +
    (plus ? "+ " : "− ") + formatEuro(cent) + "</span>";
}

// Zum Umschalten zwischen dem Buchungs und dem Übertrag Formular:
// Hier werden schon gemachte Eingaben (Betrag, Datum ...) kurz abgelegt,
// damit sie im anderen Formular nicht neu getippt werden müssen.
let uebergabe = null;

// Holt die abgelegten Eingaben einmal ab (danach ist die Ablage leer)
function nimmUebergabe() {
  const inhalt = uebergabe || {};
  uebergabe = null;
  return inhalt;
}
