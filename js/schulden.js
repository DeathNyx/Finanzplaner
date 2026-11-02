// ============================================
// Schulden und Raten.
//
// So sieht eine Schuld in den Daten aus:
// {
//   id: "sch_...",
//   name: "Autokredit",
//   glaeubiger: "Sparkasse",
//   rest: 850000 (Restbetrag in Cent am Stichtag),
//   stichtag: "2026-11-02" (an diesem Tag galt der Restbetrag),
//   rate: 25000 (Monatsrate in Cent, 0 = keine feste Rate),
//   notiz: ""
// }
//
// Buchungen und Daueraufträge können zu einer Schuld gehören
// (Feld "schuldId"). Jede solche Buchung ab dem Stichtag
// verringert den Restbetrag. Der aktuelle Rest wird also immer
// neu ausgerechnet, genau wie die Kontostände.
// ============================================

// Schuld anhand ihrer ID finden
function findeSchuld(id) {
  return daten.schulden.find(function (s) { return s.id === id; });
}

// Alle Buchungen, die eine Schuld tilgen (ab dem Stichtag), neueste zuerst
function tilgungen(schuld) {
  return daten.buchungen
    .filter(function (b) { return b.schuldId === schuld.id && b.typ === "ausgabe" && b.datum >= schuld.stichtag; })
    .sort(function (a, b) { return b.datum.localeCompare(a.datum); });
}

// Aktueller Restbetrag: Rest am Stichtag minus alle Tilgungen seitdem
function restbetrag(schuld) {
  const getilgt = tilgungen(schuld).reduce(function (s, b) { return s + b.betrag; }, 0);
  return Math.max(0, schuld.rest - getilgt);
}

// Der Dauerauftrag, der die Rate bucht (falls es einen gibt)
function ratenAuftrag(schuld) {
  return daten.dauerauftraege.find(function (d) { return d.schuldId === schuld.id && !d.pausiert; });
}

// Voraussichtliches Ende (ohne Zinsen gerechnet).
// Gibt { raten, letzterMonat } zurück oder null, wenn es keine Rate gibt.
function voraussichtlichesEnde(schuld) {
  const rest = restbetrag(schuld);
  if (rest === 0) return { raten: 0, letzterMonat: null };
  if (!schuld.rate) return null;

  const raten = Math.ceil(rest / schuld.rate);
  // Erste noch offene Rate: laut Dauerauftrag, sonst nächster Monat
  const auftrag = ratenAuftrag(schuld);
  const ersterMonat = auftrag ? naechsterMonat(auftrag) : verschiebeMonat(heute().slice(0, 7), 1);
  return { raten: raten, letzterMonat: verschiebeMonat(ersterMonat, raten - 1) };
}

// Text zum Ende, z. B. "noch 17 Raten, voraussichtlich bis März 2028"
function endeText(schuld) {
  const ende = voraussichtlichesEnde(schuld);
  if (!ende) return "Ohne feste Rate lässt sich kein Ende berechnen.";
  if (ende.raten === 0) return "Abbezahlt 🎉";
  return "noch " + ende.raten + (ende.raten === 1 ? " Rate" : " Raten") +
    ", voraussichtlich bis " + formatMonat(ende.letzterMonat);
}

// Auswahlliste "Gehört zu Schuld" für Formulare
function schuldAuswahl(feldId, gewaehlt) {
  const offen = daten.schulden.filter(function (s) { return restbetrag(s) > 0 || s.id === gewaehlt; });
  if (offen.length === 0) return "";
  return (
    '<label class="feld">Rate oder Tilgung für (freiwillig)' +
    '  <select id="' + feldId + '"><option value="">Keine Schuld</option>' +
    offen.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === gewaehlt ? " selected" : "") + ">" + schuetzeText(s.name) + "</option>";
    }).join("") +
    "  </select>" +
    "</label>"
  );
}


// ============================================
// Bildschirm "Schulden": Liste
// ============================================
function zeichneSchulden(bereich) {
  let html = "";

  if (daten.schulden.length === 0) {
    html += platzhalter("Keine Schulden eingetragen. Hier kannst du Kredite, Ratenkäufe oder geliehenes Geld festhalten und sehen, wann alles abbezahlt ist.");
  } else {
    const offen = daten.schulden.filter(function (s) { return restbetrag(s) > 0; });
    const fertig = daten.schulden.filter(function (s) { return restbetrag(s) === 0; });
    const gesamtRest = offen.reduce(function (s, x) { return s + restbetrag(x); }, 0);
    const gesamtRate = offen.reduce(function (s, x) { return s + (x.rate || 0); }, 0);

    html +=
      '<div class="karte summen">' +
      '  <div><span class="leise">Restschuld gesamt</span><span class="betrag' + (gesamtRest > 0 ? " negativ" : "") + '">' + formatEuro(gesamtRest) + "</span></div>" +
      '  <div><span class="leise">Raten pro Monat</span><span class="betrag">' + formatEuro(gesamtRate) + "</span></div>" +
      "</div>";

    if (offen.length > 0) {
      html += '<div class="karte liste">' + offen.map(schuldZeile).join("") + "</div>";
    }
    if (fertig.length > 0) {
      html += '<h2 class="abschnitt">Abbezahlt 🎉</h2><div class="karte liste">' + fertig.map(schuldZeile).join("") + "</div>";
    }
  }

  html += '<a class="knopf" href="#schuld/neu">+ Schuld eintragen</a>';
  bereich.innerHTML = html;
}

// Eine Zeile in der Schuldenliste mit Fortschrittsbalken
function schuldZeile(s) {
  const rest = restbetrag(s);
  const getilgt = s.rest > 0 ? Math.round((s.rest - rest) / s.rest * 100) : 100;
  const unterzeile = [s.glaeubiger];
  if (s.rate) unterzeile.push(formatEuro(s.rate) + " im Monat");
  return (
    '<a class="zeile schuld-zeile" href="#schuld/' + s.id + '">' +
    '  <span class="zeile-text zweizeilig">' +
    "    <span>" + schuetzeText(s.name) + "</span>" +
    '    <small class="leise">' + schuetzeText(unterzeile.filter(Boolean).join(" · ")) + "</small>" +
    '    <small class="leise">' + schuetzeText(endeText(s)) + "</small>" +
    '    <span class="balken"><span class="einnahme" style="width:' + getilgt + '%"></span></span>' +
    "  </span>" +
    '  <span class="betrag' + (rest > 0 ? " negativ" : "") + '">' + formatEuro(rest) + "</span>" +
    "</a>"
  );
}


// ============================================
// Bildschirm "Schuld": anlegen, bearbeiten, Verlauf
// ============================================
function zeichneSchuld(bereich, id) {
  const istNeu = id === "neu";
  const schuld = istNeu ? null : findeSchuld(id);

  if (!istNeu && !schuld) {
    location.replace("#schulden");
    return;
  }

  document.getElementById("titel").textContent = istNeu ? "Schuld eintragen" : schuld.name;
  let html = "";

  // Bei bestehenden Schulden: Stand, Ende und Verlauf zuerst
  if (!istNeu) {
    const rest = restbetrag(schuld);
    const auftrag = ratenAuftrag(schuld);
    const liste = tilgungen(schuld);

    html +=
      '<div class="karte">' +
      '  <p class="leise klein">Noch offen</p>' +
      '  <p class="betrag gross' + (rest > 0 ? " negativ" : "") + '">' + formatEuro(rest) + "</p>" +
      "  <p>" + schuetzeText(endeText(schuld)) + "</p>" +
      '  <p class="leise klein">Getilgt seit ' + formatDatum(schuld.stichtag) + ": " + formatEuro(schuld.rest - rest) +
           " von " + formatEuro(schuld.rest) + "</p>" +
      "</div>";

    // Rate automatisch buchen?
    if (auftrag) {
      html += '<div class="karte"><p>🔁 Die Rate wird automatisch gebucht: ' +
        '<a href="#dauerauftrag/' + auftrag.id + '">' + schuetzeText(auftrag.name) + "</a>, jeden " + auftrag.tag + ".</p></div>";
    } else if (rest > 0 && schuld.rate) {
      html += '<button type="button" id="ratenAuftrag" class="knopf">🔁 Rate als Dauerauftrag anlegen</button>';
    }
    if (rest > 0) {
      html += '<button type="button" id="sondertilgung" class="knopf zweit">Zahlung buchen</button>';
    }

    if (liste.length > 0) {
      html += '<h2 class="abschnitt">Gezahlt</h2><div class="karte liste">' +
        liste.map(function (b) { return buchungsZeile(b, true); }).join("") + "</div>";
    }

    html += '<h2 class="abschnitt">Angaben ändern</h2>';
  }

  html +=
    '<form id="schuldFormular" class="karte" novalidate>' +
    '  <label class="feld">Bezeichnung' +
    '    <input id="sName" type="text" maxlength="40" autocomplete="off" value="' + schuetzeText(schuld ? schuld.name : "") +
         '" placeholder="z. B. Autokredit">' +
    "  </label>" +
    '  <label class="feld">Gläubiger' +
    '    <input id="sGlaeubiger" type="text" maxlength="40" autocomplete="off" value="' + schuetzeText(schuld ? schuld.glaeubiger : "") +
         '" placeholder="z. B. Bank oder Person">' +
    "  </label>" +
    '  <label class="feld">Restbetrag in €' +
    '    <input id="sRest" type="text" inputmode="decimal" autocomplete="off" value="' + (schuld ? betragFuerEingabe(schuld.rest) : "") + '">' +
    "  </label>" +
    '  <label class="feld">Restbetrag gilt am' +
    '    <input id="sStichtag" type="date" value="' + (schuld ? schuld.stichtag : heute()) + '">' +
    "  </label>" +
    '  <p class="leise klein">Zahlungen ab diesem Tag ziehen sich automatisch vom Restbetrag ab.</p>' +
    '  <label class="feld">Monatsrate in € (freiwillig)' +
    '    <input id="sRate" type="text" inputmode="decimal" autocomplete="off" value="' + (schuld && schuld.rate ? betragFuerEingabe(schuld.rate) : "") + '">' +
    "  </label>" +
    '  <label class="feld">Notiz (freiwillig)' +
    '    <input id="sNotiz" type="text" maxlength="80" autocomplete="off" value="' + schuetzeText(schuld ? schuld.notiz || "" : "") + '">' +
    "  </label>" +
    '  <p class="leise klein">Das Ende wird ohne Zinsen berechnet. Bei Krediten mit Zinsen dauert es etwas länger.</p>' +
    '  <p id="fehler" class="fehler" hidden></p>' +
    '  <button type="submit" class="knopf">Speichern</button>' +
    '  <button type="button" id="abbrechen" class="knopf zweit">Abbrechen</button>' +
    "</form>" +
    (istNeu ? "" : '<button type="button" id="loeschen" class="knopf gefahr">Schuld löschen</button>');

  bereich.innerHTML = html;

  const formular = document.getElementById("schuldFormular");
  const fehler = document.getElementById("fehler");
  formular.addEventListener("input", function () { fehler.hidden = true; });

  formular.addEventListener("submit", function (ereignis) {
    ereignis.preventDefault();
    const name = document.getElementById("sName").value.trim();
    const rest = leseBetrag(document.getElementById("sRest").value);
    const stichtag = document.getElementById("sStichtag").value;
    const rateText = document.getElementById("sRate").value.trim();
    const rate = rateText === "" ? 0 : leseBetrag(rateText);

    if (name === "") return zeigeFehler(fehler, "Bitte gib eine Bezeichnung ein.");
    if (rest === null || rest < 0) return zeigeFehler(fehler, "Bitte gib einen gültigen Restbetrag ein.");
    if (!stichtag) return zeigeFehler(fehler, "Bitte wähle ein Datum für den Restbetrag.");
    if (rate === null || rate < 0) return zeigeFehler(fehler, "Die Monatsrate ist keine gültige Zahl.");

    const werte = {
      name: name,
      glaeubiger: document.getElementById("sGlaeubiger").value.trim(),
      rest: rest,
      stichtag: stichtag,
      rate: rate,
      notiz: document.getElementById("sNotiz").value.trim()
    };

    if (istNeu) {
      const neu = Object.assign({ id: neueId("sch") }, werte);
      daten.schulden.push(neu);
      speichereDaten();
      zeigeMeldung("Schuld gespeichert");
      // Gleich die Seite der neuen Schuld zeigen (dort kann man die Rate automatisch buchen lassen)
      location.replace("#schuld/" + neu.id);
    } else {
      Object.assign(schuld, werte);
      speichereDaten();
      zeigeMeldung("Gespeichert");
      zeichneSchuld(bereich, id);
    }
  });

  document.getElementById("abbrechen").addEventListener("click", function () {
    zurueck("#schulden");
  });

  if (istNeu) {
    document.getElementById("sName").focus();
    return;
  }

  // Rate als Dauerauftrag: Formular vorausgefüllt öffnen
  const knopfAuftrag = document.getElementById("ratenAuftrag");
  if (knopfAuftrag) {
    knopfAuftrag.addEventListener("click", function () {
      uebergabe = { art: "ausgabe", name: "Rate " + schuld.name, betrag: schuld.rate, schuldId: schuld.id };
      location.hash = "#dauerauftrag/neu";
    });
  }

  // Einmalige Zahlung (z. B. Sondertilgung) über das normale Buchen
  const knopfZahlung = document.getElementById("sondertilgung");
  if (knopfZahlung) {
    knopfZahlung.addEventListener("click", function () {
      uebergabe = { typ: "ausgabe", notiz: schuld.name, schuldId: schuld.id };
      location.hash = "#buchen";
    });
  }

  document.getElementById("loeschen").addEventListener("click", function () {
    if (!confirm("Schuld \"" + schuld.name + "\" löschen? Gebuchte Zahlungen bleiben als normale Ausgaben erhalten.")) return;
    // Verknüpfungen lösen, die Buchungen selbst bleiben
    daten.buchungen.forEach(function (b) { if (b.schuldId === schuld.id) b.schuldId = null; });
    daten.dauerauftraege.forEach(function (d) { if (d.schuldId === schuld.id) d.schuldId = null; });
    daten.schulden = daten.schulden.filter(function (s) { return s.id !== schuld.id; });
    speichereDaten();
    zeigeMeldung("Schuld gelöscht");
    zurueck("#schulden");
  });
}
