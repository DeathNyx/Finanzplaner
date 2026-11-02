// ============================================
// Ausgleich in gemeinsamen Kassen: wer hat wie viel beigetragen,
// wer schuldet wem was.
//
// Die Rechnung selbst steht in rechnen.js (Funktion "ausgleich").
// Hier wird sie nur angezeigt.
//
// Eine erledigte Ausgleichszahlung sieht in den Daten so aus:
// { id, kasseId, vonPersonId, anPersonId, betrag, datum }
// Sie ändert den Kassenstand nicht (das Geld geht direkt von Person
// zu Person), aber sie gleicht die Salden aus.
// ============================================

// Name einer Person (oder "Unbekannt")
function personName(pid) {
  const p = findePerson(pid);
  return p ? p.name : "Unbekannt";
}

// Farbpunkt einer Person
function personPunkt(pid) {
  const p = findePerson(pid);
  return farbpunkt(p ? p.farbe : "#999");
}

// Saldo als Text: "+ 100,00 €" (bekommt) oder "− 100,00 €" (schuldet)
function saldoHtml(saldo) {
  if (saldo === 0) return '<span class="betrag">' + formatEuro(0) + "</span>";
  return betragMitVorzeichen(Math.abs(saldo), saldo > 0 ? "einnahme" : "ausgabe");
}

// Kurze Karte für die Seite einer gemeinsamen Kasse
function ausgleichKarte(kasse) {
  const a = ausgleich(kasse);
  let html = '<a class="karte ausgleich-karte" href="#ausgleich/' + kasse.id + '">' +
    '<div class="aufteilung-kopf"><strong>Ausgleich</strong><span class="pfeil">›</span></div>';

  if (a.zahlungen.length === 0 && a.einzahlen.length === 0) {
    html += '<p class="leise">Alles ausgeglichen ✓</p>';
  } else {
    a.zahlungen.forEach(function (z) {
      html += "<p>" + schuetzeText(personName(z.von)) + " zahlt " +
        "<strong>" + formatEuro(z.betrag) + "</strong> an " + schuetzeText(personName(z.an)) + "</p>";
    });
    a.einzahlen.forEach(function (s) {
      html += "<p>" + schuetzeText(personName(s.pid)) + " zahlt " +
        "<strong>" + formatEuro(s.offen) + "</strong> in die Kasse ein</p>";
    });
  }
  return html + "</a>";
}


// ============================================
// Bildschirm "Ausgleich" einer gemeinsamen Kasse
// ============================================
function zeichneAusgleich(bereich, kasseId) {
  const kasse = findeKasse(kasseId);
  if (!kasse || kasse.art !== "gemeinsam") {
    location.replace("#kassen");
    return;
  }

  document.getElementById("titel").textContent = "Ausgleich " + kasse.name;
  const a = ausgleich(kasse);
  let html = "";

  // 1) Wer zahlt wem?
  html += '<div class="karte"><h2>Wer zahlt wem?</h2>';
  if (a.zahlungen.length === 0 && a.einzahlen.length === 0) {
    html += "<p>Alles ausgeglichen ✓ Niemand schuldet jemandem etwas.</p>";
  }
  a.zahlungen.forEach(function (z, nummer) {
    html +=
      '<div class="zahlung">' +
      "  <p>" + personPunkt(z.von) + " <strong>" + schuetzeText(personName(z.von)) + "</strong> zahlt " +
      "<strong>" + formatEuro(z.betrag) + "</strong> an " + personPunkt(z.an) + " <strong>" + schuetzeText(personName(z.an)) + "</strong></p>" +
      '  <button type="button" class="knopf zweit" data-zahlung="' + nummer + '">Erledigt, Zahlung eintragen</button>' +
      "</div>";
  });
  a.einzahlen.forEach(function (s) {
    html += "<p>" + personPunkt(s.pid) + " <strong>" + schuetzeText(personName(s.pid)) + "</strong> zahlt " +
      "<strong>" + formatEuro(s.offen) + "</strong> in die Kasse ein. " +
      '<span class="leise">Trage dafür einen Übertrag oder eine Einnahme in die Kasse ein.</span></p>';
  });
  a.guthaben.forEach(function (g) {
    html += '<p class="leise">' + schuetzeText(personName(g.pid)) + " hat " + formatEuro(g.offen) + " Guthaben in der Kasse.</p>";
  });
  html += "</div>";

  // 2) Übersicht je Person
  html += '<div class="karte"><h2>Wer hat was beigetragen?</h2><p class="leise klein">Seit Beginn der Kasse</p>';
  a.personen.forEach(function (pid) {
    const k = a.konten[pid];
    html +=
      '<div class="person-ausgleich">' +
      '  <p class="person-kopf">' + personPunkt(pid) + " <strong>" + schuetzeText(personName(pid)) + "</strong></p>" +
      zeilePosten("Überträge in die Kasse", k.uebertraege) +
      zeilePosten("Eingezahlt", k.einzahlungen) +
      zeilePosten("Privat bezahlt", k.privat) +
      zeilePosten("Anteil an Startbetrag und Einnahmen", k.gemeinsam) +
      zeilePosten("Ausgleichszahlungen", k.ausgleich) +
      '  <div class="posten summe"><span>Beigetragen</span><span class="betrag">' + formatEuro(k.beitrag) + "</span></div>" +
      '  <div class="posten"><span>Anteil an den Ausgaben</span><span class="betrag">' + formatEuro(k.anteil) + "</span></div>" +
      '  <div class="posten summe"><span>Saldo</span>' + saldoHtml(k.saldo) + "</div>" +
      "</div>";
  });
  html += '<p class="leise klein">Saldo plus: bekommt Geld. Saldo minus: schuldet Geld. ' +
    "Alle Salden zusammen ergeben den Kassenstand von " + formatEuro(kontostand(kasse)) + ".</p></div>";

  // 3) Bisher eingetragene Ausgleichszahlungen
  const erledigt = daten.ausgleiche
    .filter(function (x) { return x.kasseId === kasse.id; })
    .sort(function (x, y) { return y.datum.localeCompare(x.datum); });
  if (erledigt.length > 0) {
    html += '<div class="karte"><h2>Erledigte Ausgleichszahlungen</h2>';
    erledigt.forEach(function (x) {
      html +=
        '<div class="posten">' +
        "  <span>" + formatDatum(x.datum) + " · " + schuetzeText(personName(x.vonPersonId)) + " an " +
        schuetzeText(personName(x.anPersonId)) + "</span>" +
        '  <span class="betrag">' + formatEuro(x.betrag) + "</span>" +
        '  <button type="button" class="link-knopf" data-loeschen="' + x.id + '" aria-label="Löschen">✕</button>' +
        "</div>";
    });
    html += "</div>";
  }

  html += '<div class="karte"><h2>So wird gerechnet</h2><p class="leise klein">' +
    "Beigetragen zählt alles, was eine Person in die Kasse gegeben oder privat für die Kasse bezahlt hat. " +
    "Der Anteil an den Ausgaben kommt aus der Aufteilung, die bei jeder Buchung gespeichert ist. " +
    "Startbetrag und Einnahmen ohne Person werden nach der Aufteilung der Kasse verteilt.</p></div>";

  bereich.innerHTML = html;

  // Zahlung als erledigt eintragen
  bereich.querySelectorAll("[data-zahlung]").forEach(function (knopf) {
    knopf.addEventListener("click", function () {
      const z = a.zahlungen[Number(knopf.dataset.zahlung)];
      const frage = "Hat " + personName(z.von) + " " + formatEuro(z.betrag) + " an " + personName(z.an) + " gezahlt? " +
        "Dann wird die Zahlung mit dem heutigen Datum eingetragen.";
      if (!confirm(frage)) return;
      daten.ausgleiche.push({
        id: neueId("aus"),
        kasseId: kasse.id,
        vonPersonId: z.von,
        anPersonId: z.an,
        betrag: z.betrag,
        datum: heute()
      });
      speichereDaten();
      zeigeMeldung("Ausgleich eingetragen");
      zeichneAusgleich(bereich, kasseId);
    });
  });

  // Ausgleichszahlung wieder löschen
  bereich.querySelectorAll("[data-loeschen]").forEach(function (knopf) {
    knopf.addEventListener("click", function () {
      if (!confirm("Diese Ausgleichszahlung wieder löschen?")) return;
      daten.ausgleiche = daten.ausgleiche.filter(function (x) { return x.id !== knopf.dataset.loeschen; });
      speichereDaten();
      zeichneAusgleich(bereich, kasseId);
    });
  });
}

// Eine Zeile in der Übersicht je Person (nur, wenn der Betrag nicht 0 ist)
function zeilePosten(text, betrag) {
  if (!betrag) return "";
  return '<div class="posten"><span class="leise">' + text + '</span><span class="betrag">' + formatEuro(betrag) + "</span></div>";
}
