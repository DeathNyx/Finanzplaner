// ============================================
// Die beiden Übersichten:
//   "Übersicht": Startbildschirm mit allen Kassen
//   "Monat":     Einnahmen, Ausgaben und was übrig bleibt
// ============================================


// ============================================
// Bildschirm "Übersicht" (Startbildschirm)
// ============================================
function zeichneUebersicht(bereich) {
  // Ganz am Anfang: kurze Anleitung statt leerer Seite
  if (daten.personen.length === 0 || daten.kassen.length === 0) {
    bereich.innerHTML = willkommen();
    return;
  }

  const aktive = daten.kassen.filter(function (k) { return !k.archiviert; });
  const monat = heute().slice(0, 7);
  const auswertung = monatsAuswertung(monat);
  const gesamt = gesamtstand();
  let html = "";

  // Gesamtvermögen
  html +=
    '<div class="karte gesamt-gross">' +
    '  <span class="leise">Gesamt in allen Kassen</span>' +
    '  <span class="betrag gross' + (gesamt < 0 ? " negativ" : "") + '">' + formatEuro(gesamt) + "</span>" +
    "</div>";

  // Kassen als Kacheln
  html += '<div class="kacheln">';
  aktive.forEach(function (k) {
    const stand = kontostand(k);
    html +=
      '<a class="kachel" href="#kasse/' + k.id + '" style="--kassenfarbe:' + k.farbe + '">' +
      '  <span class="kachel-name">' + schuetzeText(k.name) + "</span>" +
      '  <span class="betrag' + (stand < 0 ? " negativ" : "") + '">' + formatEuro(stand) + "</span>" +
      '  <small class="leise">' + (k.art === "gemeinsam" ? "Gemeinsam" : "Persönlich") + "</small>" +
      "</a>";
  });
  html += "</div>";

  // Offene Ausgleiche aus allen gemeinsamen Kassen
  let offen = "";
  aktive.forEach(function (k) {
    if (k.art !== "gemeinsam") return;
    const a = ausgleich(k);
    a.zahlungen.forEach(function (z) {
      offen += '<a class="zeile" href="#ausgleich/' + k.id + '"><span class="zeile-text zweizeilig">' +
        "<span>" + schuetzeText(personName(z.von)) + " zahlt " + formatEuro(z.betrag) + " an " + schuetzeText(personName(z.an)) + "</span>" +
        '<small class="leise">' + schuetzeText(k.name) + "</small></span>" +
        '<span class="pfeil">›</span></a>';
    });
    a.einzahlen.forEach(function (s) {
      offen += '<a class="zeile" href="#ausgleich/' + k.id + '"><span class="zeile-text zweizeilig">' +
        "<span>" + schuetzeText(personName(s.pid)) + " zahlt " + formatEuro(s.offen) + " in die Kasse ein</span>" +
        '<small class="leise">' + schuetzeText(k.name) + "</small></span>" +
        '<span class="pfeil">›</span></a>';
    });
  });
  if (offen) {
    html += '<h2 class="abschnitt">Offene Ausgleiche</h2><div class="karte liste">' + offen + "</div>";
  }

  // Dieser Monat in Kurzform
  html +=
    '<h2 class="abschnitt">' + formatMonat(monat) + "</h2>" +
    '<a class="karte summen kurz" href="#monat">' +
    '  <div><span class="leise">Einnahmen</span>' + betragMitVorzeichen(auswertung.einnahmen, "einnahme") + "</div>" +
    '  <div><span class="leise">Ausgaben</span>' + betragMitVorzeichen(auswertung.ausgaben, "ausgabe") + "</div>" +
    '  <div class="summe-gesamt"><span>Übrig</span><span class="betrag' + (auswertung.uebrig < 0 ? " negativ" : "") + '">' +
         formatEuro(auswertung.uebrig) + "</span></div>" +
    "</a>";

  // Die letzten fünf Buchungen
  const letzte = daten.buchungen
    .map(function (b, nr) { return { b: b, nr: nr }; })
    .sort(function (x, y) { return y.b.datum.localeCompare(x.b.datum) || (y.nr - x.nr); })
    .slice(0, 5);
  if (letzte.length > 0) {
    html += '<h2 class="abschnitt">Letzte Buchungen</h2><div class="karte liste">' +
      letzte.map(function (x) { return buchungsZeile(x.b, true); }).join("") + "</div>";
  }

  bereich.innerHTML = html;
}

// Anleitung für den allerersten Start
function willkommen() {
  const schritt1 = daten.personen.length > 0;
  const schritt2 = daten.kassen.length > 0;
  return (
    '<div class="karte">' +
    "  <h2>Willkommen 👋</h2>" +
    "  <p>So legst du los:</p>" +
    '  <ol class="schritte">' +
    "    <li" + (schritt1 ? ' class="erledigt"' : "") + '><a href="#personen">Personen anlegen</a>, zum Beispiel dich und deine Partnerin</li>' +
    "    <li" + (schritt2 ? ' class="erledigt"' : "") + '><a href="#kasseform/neu">Kassen anlegen</a>, zum Beispiel Girokonto und Haushalt</li>' +
    "    <li>Mit dem blauen <strong>+</strong> unten Ausgaben, Einnahmen und Überträge buchen</li>" +
    "  </ol>" +
    '  <p class="leise klein">Deine Daten bleiben nur auf diesem Gerät in diesem Browser.</p>' +
    "</div>" +
    '<a class="knopf" href="' + (schritt1 ? "#kasseform/neu" : "#person/neu") + '">' +
    (schritt1 ? "+ Erste Kasse anlegen" : "+ Erste Person anlegen") + "</a>"
  );
}


// ============================================
// Bildschirm "Monat": Monatsübersicht über alle Kassen
// "monat" ist z. B. "2026-11", sonst der aktuelle Monat
// ============================================
function zeichneMonat(bereich, monat) {
  if (!/^\d{4}-\d{2}$/.test(monat || "")) monat = heute().slice(0, 7);
  const a = monatsAuswertung(monat);
  let html = "";

  // Monat wählen
  html +=
    '<div class="monatswahl">' +
    '  <button type="button" class="link-knopf" data-monat="' + verschiebeMonat(monat, -1) + '" aria-label="Voriger Monat">‹</button>' +
    "  <strong>" + formatMonat(monat) + "</strong>" +
    '  <button type="button" class="link-knopf" data-monat="' + verschiebeMonat(monat, 1) + '" aria-label="Nächster Monat">›</button>' +
    "</div>";

  // Das Wichtigste: was bleibt übrig?
  html +=
    '<div class="karte summen">' +
    '  <div><span class="leise">Einnahmen</span>' + betragMitVorzeichen(a.einnahmen, "einnahme") + "</div>" +
    '  <div><span class="leise">Ausgaben</span>' + betragMitVorzeichen(a.ausgaben, "ausgabe") + "</div>" +
    '  <div class="summe-gesamt gross-zeile"><span>Übrig am Monatsende</span><span class="betrag' +
         (a.uebrig < 0 ? " negativ" : " positiv") + '">' + formatEuro(a.uebrig) + "</span></div>" +
    "</div>";

  // Was in diesem Monat noch kommt (nur aktueller und kommende Monate)
  if (monat >= heute().slice(0, 7)) {
    html += erwartetKarte(monat, a);
  }

  if (a.einnahmen === 0 && a.ausgaben === 0) {
    html += platzhalter("In diesem Monat gibt es noch keine Einnahmen oder Ausgaben.");
  } else {
    // Ausgaben und Einnahmen nach Kategorie
    html += kategorienListe("Ausgaben nach Kategorie", a.ausgabenKategorien, a.ausgaben, "ausgabe");
    html += kategorienListe("Einnahmen nach Kategorie", a.einnahmenKategorien, a.einnahmen, "einnahme");

    // Je Kasse
    html += '<h2 class="abschnitt">Nach Kasse</h2><div class="karte liste">';
    daten.kassen.forEach(function (k) {
      const werte = a.proKasse[k.id];
      if (!werte) return;
      const ergebnis = werte.einnahmen - werte.ausgaben;
      html +=
        '<a class="kasse-zeile" href="#kasse/' + k.id + "/" + monat + '" style="--kassenfarbe:' + k.farbe + '">' +
        '  <span class="zeile-text">' +
        "    <strong>" + schuetzeText(k.name) + "</strong>" +
        '    <small class="leise">+ ' + formatEuro(werte.einnahmen) + " · − " + formatEuro(werte.ausgaben) + "</small>" +
        "  </span>" +
        '  <span class="betrag' + (ergebnis < 0 ? " negativ" : "") + '">' + formatEuro(ergebnis) + "</span>" +
        "</a>";
    });
    html += "</div>";
  }

  html += '<p class="leise klein">Überträge zwischen Kassen zählen hier nicht mit, weil das Geld dabei nur in eine andere Kasse wandert.</p>';

  bereich.innerHTML = html;

  bereich.querySelectorAll("[data-monat]").forEach(function (knopf) {
    knopf.addEventListener("click", function () {
      location.replace("#monat/" + knopf.dataset.monat);
    });
  });
}

// Liste von Kategorien mit Balken, der größte Posten zuerst
function kategorienListe(ueberschrift, werte, gesamt, typ) {
  const ids = Object.keys(werte).sort(function (x, y) { return werte[y] - werte[x]; });
  if (ids.length === 0) return "";

  let html = '<h2 class="abschnitt">' + ueberschrift + '</h2><div class="karte">';
  ids.forEach(function (id) {
    const kategorie = findeKategorie(id);
    const anteil = gesamt > 0 ? Math.round(werte[id] / gesamt * 100) : 0;
    html +=
      '<div class="kategorie">' +
      '  <div class="posten"><span>' + schuetzeText(kategorie ? kategorie.name : "Ohne Kategorie") + "</span>" +
      '<span class="leise klein">' + anteil + " %</span>" +
      '<span class="betrag">' + formatEuro(werte[id]) + "</span></div>" +
      '  <div class="balken"><span class="' + typ + '" style="width:' + anteil + '%"></span></div>' +
      "</div>";
  });
  return html + "</div>";
}

// Karte "Noch erwartet": Daueraufträge, die in diesem Monat noch gebucht werden,
// und was dann voraussichtlich übrig bleibt
function erwartetKarte(monat, auswertung) {
  const erwartet = erwarteteDauerauftraege(monat)
    .sort(function (x, y) { return x.tag - y.tag; });
  if (erwartet.length === 0) return "";

  let plus = 0;
  let minus = 0;
  let zeilen = "";
  erwartet.forEach(function (d) {
    if (d.art === "einnahme") plus += d.betrag;
    else minus += d.betrag;
    zeilen +=
      '<div class="posten"><span>' + formatDatum(faelligAm(d, monat)).slice(0, 6) + " " + schuetzeText(d.name) + "</span>" +
      betragMitVorzeichen(d.betrag, d.art) + "</div>";
  });

  const voraussichtlich = auswertung.uebrig + plus - minus;
  return (
    '<h2 class="abschnitt">Noch erwartet (Daueraufträge)</h2>' +
    '<div class="karte">' + zeilen +
    '  <div class="posten summe"><span>Voraussichtlich übrig</span><span class="betrag' +
         (voraussichtlich < 0 ? " negativ" : "") + '">' + formatEuro(voraussichtlich) + "</span></div>" +
    "</div>"
  );
}
