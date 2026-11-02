// ============================================
// Hinweise auf anstehende Zahlungen.
//
// Grundlage sind die Daueraufträge: Die App schaut, welche in den
// nächsten Tagen fällig werden, und rechnet für jede Kasse vor,
// ob das Geld reicht.
//
// Ein "Termin" sieht so aus:
// {
//   datum: "2026-11-15",
//   name: "Miete",
//   art: "ausgabe", "einnahme" oder "uebertrag",
//   betrag: 110000,
//   kasseId / vonKasseId / nachKasseId,
//   privat: true, wenn eine Person privat bezahlt (Kassenstand bleibt gleich),
//   gebucht: true bei heute schon automatisch gebuchten Einträgen,
//   link: wohin ein Antippen führt
// }
// ============================================

// Standardwerte der Einstellungen
const HINWEIS_TAGE_STANDARD = 7;

// Wie viele Tage im Voraus sollen Zahlungen angezeigt werden?
function hinweisTage() {
  return daten.einstellungen.hinweisTage || HINWEIS_TAGE_STANDARD;
}

// Sollen Warnungen angezeigt werden, wenn eine Kasse nicht reicht?
function warnungenAn() {
  return daten.einstellungen.warnungen !== false;
}

// Alle Termine von heute bis in "tage" Tagen, nach Datum sortiert.
// Heute schon automatisch gebuchte Einträge sind mit gebucht: true dabei.
function anstehendeZahlungen(tage) {
  const heuteText = heute();
  const bis = plusTage(heuteText, tage);
  const termine = [];

  // 1) Heute schon gebucht (damit man sieht, was heute passiert ist)
  daten.buchungen.forEach(function (b) {
    if (!b.vorlageId || b.datum !== heuteText) return;
    termine.push({
      datum: b.datum, name: b.notiz || "Dauerauftrag", art: b.typ, betrag: b.betrag,
      kasseId: b.kasseId, privat: privatBezahlt(b), gebucht: true, link: "#buchung/" + b.id
    });
  });
  daten.uebertraege.forEach(function (u) {
    if (!u.vorlageId || u.datum !== heuteText) return;
    termine.push({
      datum: u.datum, name: u.notiz || "Übertrag", art: "uebertrag", betrag: u.betrag,
      vonKasseId: u.vonKasseId, nachKasseId: u.nachKasseId, gebucht: true, link: "#uebertrag/" + u.id
    });
  });

  // 2) Was noch kommt
  daten.dauerauftraege.forEach(function (d) {
    kommendeTermine(d, bis).forEach(function (t) {
      if (t.datum < heuteText) return;
      const kasse = d.kasseId ? findeKasse(d.kasseId) : null;
      termine.push({
        datum: t.datum, name: d.name, art: d.art, betrag: t.betrag,
        kasseId: d.kasseId, vonKasseId: d.vonKasseId, nachKasseId: d.nachKasseId,
        privat: d.art === "ausgabe" && !!d.bezahltVon && !!kasse && kasse.art === "gemeinsam",
        gebucht: false, link: "#dauerauftrag/" + d.id
      });
    });
  });

  return termine.sort(function (a, b) { return a.datum.localeCompare(b.datum); });
}

// Betrifft ein Termin diese Kasse?
function terminBetrifft(t, kasseId) {
  return t.kasseId === kasseId || t.vonKasseId === kasseId || t.nachKasseId === kasseId;
}

// Um wie viel ändert ein Termin den Stand einer Kasse?
function terminWirkung(t, kasseId) {
  if (t.art === "uebertrag") {
    if (t.nachKasseId === kasseId) return t.betrag;
    if (t.vonKasseId === kasseId) return -t.betrag;
    return 0;
  }
  if (t.kasseId !== kasseId || t.privat) return 0;
  return t.art === "einnahme" ? t.betrag : -t.betrag;
}

// Reicht das Geld in einer Kasse für die anstehenden Termine?
// Gibt null zurück, wenn alles reicht, sonst { datum, tiefster, schonJetzt }.
// Es wird Tag für Tag gerechnet, damit Geld, das am selben Tag
// hereinkommt (z. B. Gehalt), mitzählt.
function kassenWarnung(kasse, termine) {
  let stand = kontostand(kasse);
  if (stand < 0) return { datum: heute(), tiefster: stand, schonJetzt: true };

  let ersterMinusTag = null;
  let tiefster = 0;
  const offen = termine.filter(function (t) { return !t.gebucht && terminBetrifft(t, kasse.id); });

  let i = 0;
  while (i < offen.length) {
    const tag = offen[i].datum;
    while (i < offen.length && offen[i].datum === tag) {
      stand += terminWirkung(offen[i], kasse.id);
      i++;
    }
    if (stand < 0 && !ersterMinusTag) ersterMinusTag = tag;
    if (stand < tiefster) tiefster = stand;
  }

  return ersterMinusTag ? { datum: ersterMinusTag, tiefster: tiefster, schonJetzt: false } : null;
}

// Gelbe Hinweise für alle aktiven Kassen (oder nur eine)
function warnungenHtml(termine, nurKasse) {
  if (!warnungenAn()) return "";
  const kassen = nurKasse ? [nurKasse] : daten.kassen.filter(function (k) { return !k.archiviert; });
  let html = "";
  kassen.forEach(function (k) {
    const w = kassenWarnung(k, termine);
    if (!w) return;
    const text = w.schonJetzt
      ? schuetzeText(k.name) + " ist im Minus: " + formatEuro(w.tiefster)
      : schuetzeText(k.name) + " reicht " + (tageBis(w.datum) <= 1 ? tagText(w.datum).toLowerCase() : "ab " + formatDatum(w.datum).slice(0, 6)) +
        " nicht. Tiefster Stand: " + formatEuro(w.tiefster);
    html += '<a class="karte warnung erinnerung" href="#kasse/' + k.id + '">⚠️ ' + text + "</a>";
  });
  return html;
}

// Eine Zeile in der Liste "Demnächst"
function terminZeile(t, ausSichtVon) {
  let wo = "";
  if (t.art === "uebertrag") {
    const von = findeKasse(t.vonKasseId);
    const nach = findeKasse(t.nachKasseId);
    wo = (von ? von.name : "?") + " → " + (nach ? nach.name : "?");
  } else {
    const kasse = findeKasse(t.kasseId);
    wo = kasse ? kasse.name : "";
  }

  // Vorzeichen: Überträge aus Sicht einer bestimmten Kasse, sonst neutral
  let betrag;
  if (t.art === "uebertrag") {
    betrag = ausSichtVon
      ? betragMitVorzeichen(t.betrag, t.nachKasseId === ausSichtVon ? "einnahme" : "ausgabe")
      : '<span class="betrag">' + formatEuro(t.betrag) + "</span>";
  } else {
    betrag = betragMitVorzeichen(t.betrag, t.art);
  }

  return (
    '<a class="zeile' + (t.gebucht ? " gebucht" : "") + '" href="' + t.link + '">' +
    '  <span class="termin-tag"><strong>' + tagText(t.datum) + "</strong><small>" + kurzDatum(t.datum) + "</small></span>" +
    '  <span class="zeile-text zweizeilig">' +
    "    <span>" + schuetzeText(t.name) + "</span>" +
    '    <small class="leise">' + schuetzeText(wo) + (t.gebucht ? " · gebucht ✓" : "") + "</small>" +
    "  </span>" +
    betrag +
    "</a>"
  );
}

// Bereich "Demnächst" mit Warnungen.
// Ohne "kasse" für alle Kassen (Übersicht), mit "kasse" nur für diese.
function demnaechstHtml(kasse) {
  const tage = hinweisTage();
  let termine = anstehendeZahlungen(tage);
  const warnungen = warnungenHtml(termine, kasse);

  if (kasse) termine = termine.filter(function (t) { return terminBetrifft(t, kasse.id); });
  if (termine.length === 0) return warnungen;

  return warnungen +
    '<h2 class="abschnitt">Demnächst <small>(' + tage + " Tage)</small></h2>" +
    '<div class="karte liste">' +
    termine.map(function (t) { return terminZeile(t, kasse ? kasse.id : null); }).join("") +
    "</div>";
}


// ============================================
// Bildschirm "Einstellungen"
// ============================================
function zeichneEinstellungen(bereich) {
  const tage = hinweisTage();

  bereich.innerHTML =
    '<form id="einstellungenFormular" class="karte">' +
    "  <h2>Hinweise auf anstehende Zahlungen</h2>" +
    '  <fieldset class="umschalter">' +
    "    <legend>So viele Tage im Voraus anzeigen</legend>" +
    [3, 7, 14, 30].map(function (n) {
      return '<label><input type="radio" name="tage" value="' + n + '"' + (n === tage ? " checked" : "") + "><span>" + n + "</span></label>";
    }).join("") +
    "  </fieldset>" +
    '  <label class="schalter"><input id="warnungen" type="checkbox"' + (warnungenAn() ? " checked" : "") + ">" +
    "    <span>Warnen, wenn eine Kasse für die anstehenden Zahlungen nicht reicht</span></label>" +
    '  <p class="leise klein">Die Hinweise erscheinen, sobald du die App öffnest. Benachrichtigungen bei geschlossener App bräuchten einen Server, deshalb gibt es sie hier nicht.</p>' +
    "</form>";

  // Jede Änderung wird sofort gespeichert
  document.getElementById("einstellungenFormular").addEventListener("change", function () {
    daten.einstellungen.hinweisTage = Number(bereich.querySelector('input[name="tage"]:checked').value);
    daten.einstellungen.warnungen = document.getElementById("warnungen").checked;
    speichereDaten();
    zeigeMeldung("Gespeichert");
  });
}
