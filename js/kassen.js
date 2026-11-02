// ============================================
// Bildschirme rund um Kassen: Liste und Formular.
//
// So sieht eine Kasse in den Daten aus:
// {
//   id: "kas_...",
//   name: "Haushalt",
//   farbe: "#1a7f37",
//   art: "persoenlich" oder "gemeinsam",
//   personen: [IDs der Personen],
//   startbetrag: 0 (in Cent),
//   startdatum: "2026-11-01",
//   aufteilung: null bei persönlich, sonst z. B.
//               { art: "gleich" }
//               { art: "prozent", prozente: { per_a: 60, per_b: 40 } }
//               { art: "selbst" }
//   archiviert: false
// }
// ============================================

// Namen der Personen einer Kasse, z. B. ["Ich", "Partnerin"]
function personenNamen(kasse) {
  return kasse.personen
    .map(findePerson)
    .filter(Boolean)
    .map(function (p) { return p.name; });
}

// Kurze Beschreibung der Aufteilung, z. B. "60/40 %"
function aufteilungText(kasse) {
  const a = kasse.aufteilung || { art: "gleich" };
  if (a.art === "prozent") {
    return kasse.personen.map(function (id) { return a.prozente[id] || 0; }).join("/") + "\u00a0%";
  }
  if (a.art === "selbst") return "selbst eintragen";
  return "gleich";
}

// Kurzbeschreibung einer Kasse, z. B. "Gemeinsam · Ich, Partnerin · 60/40 %"
function kassenBeschreibung(kasse) {
  const namen = personenNamen(kasse);
  if (kasse.art === "persoenlich") {
    return "Persönlich · " + (namen[0] || "ohne Person");
  }
  return "Gemeinsam · " + namen.join(", ") + " · " + aufteilungText(kasse);
}

// Eine Zeile in der Kassenliste
function kassenZeile(kasse) {
  const stand = kontostand(kasse);
  return (
    '<a class="kasse-zeile" href="#kasse/' + kasse.id + '" style="--kassenfarbe:' + kasse.farbe + '">' +
    '  <span class="zeile-text">' +
    "    <strong>" + schuetzeText(kasse.name) + "</strong>" +
    '    <small class="leise">' + schuetzeText(kassenBeschreibung(kasse)) + "</small>" +
    "  </span>" +
    '  <span class="betrag' + (stand < 0 ? " negativ" : "") + '">' + formatEuro(stand) + "</span>" +
    "</a>"
  );
}

// Hinweis, wenn es noch keine Personen gibt
function hinweisPersonenFehlen() {
  return (
    platzhalter("Bevor du eine Kasse anlegst, brauchst du mindestens eine Person, zum Beispiel dich selbst.") +
    '<a class="knopf" href="#person/neu">+ Person anlegen</a>'
  );
}


// ============================================
// Bildschirm "Kassen": Liste aller Kassen
// ============================================
function zeichneKassen(bereich) {
  if (daten.personen.length === 0) {
    bereich.innerHTML = hinweisPersonenFehlen();
    return;
  }

  const aktive = daten.kassen.filter(function (k) { return !k.archiviert; });
  const archivierte = daten.kassen.filter(function (k) { return k.archiviert; });
  let html = "";

  if (aktive.length === 0) {
    html += platzhalter("Noch keine Kassen. Lege zum Beispiel ein Girokonto, eine Haushaltskasse oder ein Sparkonto an.");
  } else {
    // Summe aller aktiven Kassen
    const gesamt = gesamtstand();
    html +=
      '<div class="karte gesamt">' +
      '  <span class="leise">Gesamt</span>' +
      '  <span class="betrag gross' + (gesamt < 0 ? " negativ" : "") + '">' + formatEuro(gesamt) + "</span>" +
      "</div>";

    html += '<div class="karte liste">' + aktive.map(kassenZeile).join("") + "</div>";
  }

  html += '<a class="knopf" href="#kasseform/neu">+ Neue Kasse</a>';

  // Archivierte Kassen zum Aufklappen
  if (archivierte.length > 0) {
    html +=
      '<details class="karte liste archiv">' +
      "  <summary>Archiviert (" + archivierte.length + ")</summary>" +
      archivierte.map(kassenZeile).join("") +
      "</details>";
  }

  bereich.innerHTML = html;
}


// ============================================
// Bildschirm "Kasse": Seite einer Kasse mit Stand und Buchungen.
// "monat" ist z. B. "2026-11". Fehlt er, wird der aktuelle Monat gezeigt.
// ============================================
function zeichneKasseSeite(bereich, id, monat) {
  const kasse = findeKasse(id);
  if (!kasse) {
    location.replace("#kassen");
    return;
  }

  document.getElementById("titel").textContent = kasse.name;
  if (!/^\d{4}-\d{2}$/.test(monat || "")) monat = heute().slice(0, 7);

  const stand = kontostand(kasse);
  const summen = monatsSummen(kasse.id, monat);
  const saldo = summen.ergebnis;

  // Buchungen und Überträge dieses Monats als eine Liste, die neuesten zuerst
  const eintraege = [];
  daten.buchungen.forEach(function (b) {
    if (b.kasseId === kasse.id && b.datum.startsWith(monat)) {
      eintraege.push({ datum: b.datum, nr: eintraege.length, html: buchungsZeile(b) });
    }
  });
  daten.uebertraege.forEach(function (u) {
    if ((u.vonKasseId === kasse.id || u.nachKasseId === kasse.id) && u.datum.startsWith(monat)) {
      eintraege.push({ datum: u.datum, nr: eintraege.length, html: uebertragsZeile(u, kasse.id) });
    }
  });
  // Bei gleichem Datum steht das zuletzt Eingetragene oben
  eintraege.sort(function (a, b) { return b.datum.localeCompare(a.datum) || (b.nr - a.nr); });

  let html = "";

  if (kasse.archiviert) {
    html += '<div class="karte warnung">Diese Kasse ist archiviert. Du kannst sie unter Bearbeiten wiederherstellen.</div>';
  }

  // Kopf mit Stand
  html +=
    '<div class="karte kassen-kopf" style="--kassenfarbe:' + kasse.farbe + '">' +
    '  <p class="leise">' + schuetzeText(kassenBeschreibung(kasse)) + "</p>" +
    '  <p class="leise klein">Aktueller Stand</p>' +
    '  <p class="betrag gross' + (stand < 0 ? " negativ" : "") + '">' + formatEuro(stand) + "</p>" +
    '  <p class="leise klein">Startbetrag ' + formatEuro(kasse.startbetrag) + " am " + formatDatum(kasse.startdatum) + "</p>" +
    "</div>" +
    '<div class="knopf-reihe">' +
    '  <a class="knopf" href="#buchen/' + kasse.id + '">+ Buchen</a>' +
    '  <a class="knopf zweit" href="#kasseform/' + kasse.id + '">Bearbeiten</a>' +
    "</div>";

  // Bei gemeinsamen Kassen: wer schuldet wem?
  if (kasse.art === "gemeinsam") {
    html += ausgleichKarte(kasse);
  }

  // Monat wählen
  html +=
    '<div class="monatswahl">' +
    '  <button type="button" class="link-knopf" data-monat="' + verschiebeMonat(monat, -1) + '" aria-label="Voriger Monat">‹</button>' +
    "  <strong>" + formatMonat(monat) + "</strong>" +
    '  <button type="button" class="link-knopf" data-monat="' + verschiebeMonat(monat, 1) + '" aria-label="Nächster Monat">›</button>' +
    "</div>";

  // Summen des Monats
  html +=
    '<div class="karte summen">' +
    '  <div><span class="leise">Einnahmen</span>' + betragMitVorzeichen(summen.einnahmen, "einnahme") + "</div>" +
    '  <div><span class="leise">Ausgaben</span>' + betragMitVorzeichen(summen.ausgaben, "ausgabe") + "</div>" +
    (summen.privat > 0
      ? '  <div><span class="leise">davon privat bezahlt</span>' + betragMitVorzeichen(summen.privat, "einnahme") + "</div>"
      : "") +
    (summen.uebertraege !== 0
      ? '  <div><span class="leise">Überträge</span>' +
        betragMitVorzeichen(Math.abs(summen.uebertraege), summen.uebertraege > 0 ? "einnahme" : "ausgabe") + "</div>"
      : "") +
    '  <div class="summe-gesamt"><span>Ergebnis</span><span class="betrag' + (saldo < 0 ? " negativ" : "") + '">' + formatEuro(saldo) + "</span></div>" +
    "</div>";

  // Liste der Buchungen
  if (eintraege.length === 0) {
    html += platzhalter("Keine Buchungen in diesem Monat.");
  } else {
    html += '<div class="karte liste">' + eintraege.map(function (e) { return e.html; }).join("") + "</div>";
  }

  bereich.innerHTML = html;

  // Monat wechseln, ohne dass jeder Wechsel im Verlauf landet
  bereich.querySelectorAll("[data-monat]").forEach(function (knopf) {
    knopf.addEventListener("click", function () {
      location.replace("#kasse/" + kasse.id + "/" + knopf.dataset.monat);
    });
  });
}

// Eine Zeile in der Buchungsliste.
// Mit "mitKasse" steht zusätzlich der Name der Kasse dabei.
function buchungsZeile(b, mitKasse) {
  const kategorie = findeKategorie(b.kategorieId);
  const person = b.bezahltVon ? findePerson(b.bezahltVon) : null;

  // Kleine Zeile unter dem Namen: Datum, Notiz, wer bezahlt hat
  const details = [formatDatum(b.datum)];
  if (mitKasse) {
    const kasse = findeKasse(b.kasseId);
    if (kasse) details.push(kasse.name);
  }
  // Notiz nur zeigen, wenn sie nicht genau wie die Kategorie heißt
  if (b.notiz && (!kategorie || b.notiz !== kategorie.name)) details.push(b.notiz);
  if (person) details.push((b.typ === "ausgabe" ? "privat bezahlt von " : "eingezahlt von ") + person.name);

  return (
    '<a class="zeile" href="#buchung/' + b.id + '">' +
    '  <span class="zeile-text zweizeilig">' +
    "    <span>" + (b.vorlageId ? "🔁 " : "") + schuetzeText(kategorie ? kategorie.name : "Ohne Kategorie") + "</span>" +
    '    <small class="leise">' + schuetzeText(details.join(" · ")) + "</small>" +
    "  </span>" +
    betragMitVorzeichen(b.betrag, b.typ) +
    "</a>"
  );
}


// Eine Zeile für einen Übertrag. Aus Sicht der Kasse "kasseId":
// Geht Geld hinaus, steht dort "An ..." in Rot, kommt es herein "Von ..." in Grün.
function uebertragsZeile(u, kasseId) {
  const hinaus = u.vonKasseId === kasseId;
  const andere = findeKasse(hinaus ? u.nachKasseId : u.vonKasseId);
  const person = u.personId ? findePerson(u.personId) : null;

  const details = [formatDatum(u.datum)];
  if (u.notiz) details.push(u.notiz);
  if (person) details.push("Beitrag von " + person.name);

  return (
    '<a class="zeile" href="#uebertrag/' + u.id + '">' +
    '  <span class="zeile-text zweizeilig">' +
    "    <span>" + (u.vorlageId ? "🔁 " : "⇄ ") + (hinaus ? "An " : "Von ") + schuetzeText(andere ? andere.name : "gelöschte Kasse") + "</span>" +
    '    <small class="leise">' + schuetzeText(details.join(" · ")) + "</small>" +
    "  </span>" +
    betragMitVorzeichen(u.betrag, hinaus ? "ausgabe" : "einnahme") +
    "</a>"
  );
}


// ============================================
// Bildschirm "Kasse bearbeiten": anlegen oder ändern
// "id" ist entweder "neu" oder die ID einer Kasse
// ============================================
function zeichneKassenFormular(bereich, id) {
  const istNeu = id === "neu";
  const kasse = istNeu ? null : findeKasse(id);

  if (!istNeu && !kasse) {
    location.replace("#kassen");
    return;
  }

  document.getElementById("titel").textContent = istNeu ? "Neue Kasse" : "Kasse bearbeiten";

  if (daten.personen.length === 0) {
    bereich.innerHTML = hinweisPersonenFehlen();
    return;
  }

  // Der "Entwurf" merkt sich die Auswahl, während man das Formular ausfüllt.
  // Erst beim Speichern wird daraus die echte Kasse.
  const entwurf = {
    art: kasse ? kasse.art : "persoenlich",
    personen: kasse ? kasse.personen.slice() : [daten.personen[0].id],
    aufteilungArt: kasse && kasse.aufteilung ? kasse.aufteilung.art : "gleich",
    prozente: kasse && kasse.aufteilung && kasse.aufteilung.prozente
      ? Object.assign({}, kasse.aufteilung.prozente)
      : {}
  };

  bereich.innerHTML =
    '<form id="kasseFormular" class="karte" novalidate>' +
    '  <label class="feld">Name' +
    '    <input id="kasseName" type="text" maxlength="40" autocomplete="off" value="' +
           schuetzeText(kasse ? kasse.name : "") + '" placeholder="z. B. Girokonto oder Haushalt">' +
    "  </label>" +
    farbauswahl(kasse ? kasse.farbe : freieFarbe(daten.kassen)) +
    '  <label class="feld">Startbetrag in €' +
    '    <input id="kasseStart" type="text" inputmode="decimal" value="' +
           betragFuerEingabe(kasse ? kasse.startbetrag : 0) + '">' +
    "  </label>" +
    '  <label class="feld">Startdatum' +
    '    <input id="kasseDatum" type="date" value="' + (kasse ? kasse.startdatum : heute()) + '">' +
    "  </label>" +
    '  <fieldset class="umschalter">' +
    "    <legend>Art der Kasse</legend>" +
    '    <label><input type="radio" name="art" value="persoenlich"' + (entwurf.art === "persoenlich" ? " checked" : "") + "><span>Persönlich</span></label>" +
    '    <label><input type="radio" name="art" value="gemeinsam"' + (entwurf.art === "gemeinsam" ? " checked" : "") + "><span>Gemeinsam</span></label>" +
    "  </fieldset>" +
    '  <div id="kasseTeil"></div>' +
    '  <p id="fehler" class="fehler" hidden></p>' +
    '  <button type="submit" class="knopf">Speichern</button>' +
    '  <button type="button" id="abbrechen" class="knopf zweit">Abbrechen</button>' +
    "</form>" +
    (istNeu ? "" :
      '<button type="button" id="archivieren" class="knopf zweit">' +
        (kasse.archiviert ? "Kasse wiederherstellen" : "Kasse archivieren") + "</button>" +
      '<p class="leise klein">Archivierte Kassen werden ausgeblendet. Ihre Buchungen bleiben erhalten.</p>' +
      '<button type="button" id="loeschen" class="knopf gefahr">Kasse löschen</button>');

  const formular = document.getElementById("kasseFormular");
  const teil = document.getElementById("kasseTeil");
  const fehler = document.getElementById("fehler");

  // Prüft, ob die gemerkten Prozente genau zu den gewählten Personen passen
  function prozentePassen() {
    const schluessel = Object.keys(entwurf.prozente);
    return schluessel.length === entwurf.personen.length &&
      entwurf.personen.every(function (pid) { return typeof entwurf.prozente[pid] === "number"; });
  }

  // Summe der Prozente
  function prozentSumme() {
    return entwurf.personen.reduce(function (s, pid) { return s + (entwurf.prozente[pid] || 0); }, 0);
  }

  // Zeichnet den Teil des Formulars, der sich je nach Auswahl ändert:
  // Personen und Aufteilung
  function zeichneTeil() {
    let html = "";

    if (entwurf.art === "persoenlich") {
      // Genau eine Person auswählen
      html += '<fieldset class="auswahl"><legend>Person</legend>';
      daten.personen.forEach(function (p) {
        html +=
          '<label><input type="radio" name="person" value="' + p.id + '"' +
          (entwurf.personen[0] === p.id ? " checked" : "") + ">" +
          farbpunkt(p.farbe) + "<span>" + schuetzeText(p.name) + "</span></label>";
      });
      html += "</fieldset>";
      teil.innerHTML = html;
      return;
    }

    // Gemeinsam: mehrere Personen ankreuzen
    html += '<fieldset class="auswahl"><legend>Personen</legend>';
    daten.personen.forEach(function (p) {
      html +=
        '<label><input type="checkbox" name="personen" value="' + p.id + '"' +
        (entwurf.personen.includes(p.id) ? " checked" : "") + ">" +
        farbpunkt(p.farbe) + "<span>" + schuetzeText(p.name) + "</span></label>";
    });
    html += "</fieldset>";

    if (daten.personen.length < 2) {
      html += '<p class="leise">Für eine gemeinsame Kasse brauchst du mindestens zwei Personen. <a href="#person/neu">Person anlegen</a></p>';
      teil.innerHTML = html;
      return;
    }

    if (entwurf.personen.length < 2) {
      html += '<p class="leise">Wähle mindestens zwei Personen aus.</p>';
      teil.innerHTML = html;
      return;
    }

    // Aufteilung wählen
    const a = entwurf.aufteilungArt;
    html +=
      '<fieldset class="umschalter">' +
      "  <legend>Aufteilung der Ausgaben</legend>" +
      '  <label><input type="radio" name="aufteilung" value="gleich"' + (a === "gleich" ? " checked" : "") + "><span>Gleich</span></label>" +
      '  <label><input type="radio" name="aufteilung" value="prozent"' + (a === "prozent" ? " checked" : "") + "><span>Prozent</span></label>" +
      '  <label><input type="radio" name="aufteilung" value="selbst"' + (a === "selbst" ? " checked" : "") + "><span>Selbst</span></label>" +
      "</fieldset>";

    if (a === "gleich") {
      const gleich = gleicheProzente(entwurf.personen);
      html += '<p class="leise">Alle tragen gleich viel: ' +
        entwurf.personen.map(function (pid) { return gleich[pid]; }).join("/") + " %.</p>";
    }

    if (a === "prozent") {
      html += '<div class="prozente">';

      // Bei genau zwei Personen gibt es zusätzlich einen Schieberegler
      if (entwurf.personen.length === 2) {
        html +=
          '<input type="range" id="prozentRegler" min="0" max="100" step="1" value="' +
          entwurf.prozente[entwurf.personen[0]] + '" aria-label="Aufteilung">';
      }

      entwurf.personen.forEach(function (pid) {
        const p = findePerson(pid);
        html +=
          '<label class="prozent-zeile">' + farbpunkt(p.farbe) +
          '<span class="zeile-text">' + schuetzeText(p.name) + "</span>" +
          '<input type="number" class="prozent-feld" data-person="' + pid + '" min="0" max="100" step="1" inputmode="numeric" value="' +
          entwurf.prozente[pid] + '"><span>%</span></label>';
      });
      html += '<p id="prozentSumme" class="leise"></p></div>';
    }

    if (a === "selbst") {
      html += '<p class="leise">Bei jeder Buchung trägst du selbst ein, wer wie viel trägt. Die App schlägt dabei eine gleiche Aufteilung vor.</p>';
    }

    if (!istNeu) {
      html += '<p class="leise klein">Änderungen an der Aufteilung gelten nur für neue Buchungen. Alte Buchungen behalten ihre Aufteilung.</p>';
    }

    teil.innerHTML = html;
    zeigeSumme();
  }

  // Zeigt unter den Prozentfeldern an, ob die Summe stimmt
  function zeigeSumme() {
    const anzeige = document.getElementById("prozentSumme");
    if (!anzeige) return;
    const summe = prozentSumme();
    if (summe === 100) {
      anzeige.textContent = "Summe: 100 % ✓";
      anzeige.className = "leise";
    } else {
      anzeige.textContent = "Summe: " + summe + " %. " +
        (summe < 100 ? "Es fehlen noch " + (100 - summe) + " %." : "Das sind " + (summe - 100) + " % zu viel.");
      anzeige.className = "fehler";
    }
  }

  // Bei Prozent: Wenn die Werte nicht passen, gleich verteilt vorschlagen
  function prozenteVorbereiten() {
    if (!prozentePassen()) {
      entwurf.prozente = gleicheProzente(entwurf.personen);
    }
  }

  // Sobald man etwas ändert, verschwindet eine alte Fehlermeldung
  formular.addEventListener("input", function () { fehler.hidden = true; });
  formular.addEventListener("change", function () { fehler.hidden = true; });

  // Wechsel zwischen Persönlich und Gemeinsam
  formular.querySelectorAll('input[name="art"]').forEach(function (knopf) {
    knopf.addEventListener("change", function () {
      entwurf.art = knopf.value;
      if (entwurf.art === "persoenlich") {
        // Bei persönlich bleibt nur die erste Person übrig
        entwurf.personen = entwurf.personen.slice(0, 1);
        if (entwurf.personen.length === 0) entwurf.personen = [daten.personen[0].id];
      }
      prozenteVorbereiten();
      zeichneTeil();
    });
  });

  // Auswahl von Personen und Aufteilung (alles im wechselnden Teil)
  teil.addEventListener("change", function (ereignis) {
    const feld = ereignis.target;

    if (feld.name === "person") {
      entwurf.personen = [feld.value];
    }

    if (feld.name === "personen") {
      // Reihenfolge wie in der Personenliste, damit es immer gleich aussieht
      const angekreuzt = Array.from(teil.querySelectorAll('input[name="personen"]:checked'))
        .map(function (k) { return k.value; });
      entwurf.personen = daten.personen
        .map(function (p) { return p.id; })
        .filter(function (pid) { return angekreuzt.includes(pid); });
      prozenteVorbereiten();
      zeichneTeil();
    }

    if (feld.name === "aufteilung") {
      entwurf.aufteilungArt = feld.value;
      prozenteVorbereiten();
      zeichneTeil();
    }
  });

  // Prozente ändern (Schieberegler oder Zahlenfeld)
  teil.addEventListener("input", function (ereignis) {
    const feld = ereignis.target;
    const zwei = entwurf.personen.length === 2;

    if (feld.id === "prozentRegler") {
      const wert = Number(feld.value);
      entwurf.prozente[entwurf.personen[0]] = wert;
      entwurf.prozente[entwurf.personen[1]] = 100 - wert;
    } else if (feld.classList.contains("prozent-feld")) {
      // Auf eine ganze Zahl zwischen 0 und 100 begrenzen
      let wert = Math.round(Number(feld.value));
      if (isNaN(wert)) wert = 0;
      wert = Math.max(0, Math.min(100, wert));
      entwurf.prozente[feld.dataset.person] = wert;

      // Bei zwei Personen bekommt die andere automatisch den Rest
      if (zwei) {
        const andere = entwurf.personen.find(function (pid) { return pid !== feld.dataset.person; });
        entwurf.prozente[andere] = 100 - wert;
      }
    } else {
      return;
    }

    // Die anderen Felder und den Regler auf den neuen Stand bringen
    teil.querySelectorAll(".prozent-feld").forEach(function (f) {
      if (f !== feld) f.value = entwurf.prozente[f.dataset.person];
    });
    const regler = document.getElementById("prozentRegler");
    if (regler && regler !== feld) regler.value = entwurf.prozente[entwurf.personen[0]];

    zeigeSumme();
  });

  // Speichern
  formular.addEventListener("submit", function (ereignis) {
    ereignis.preventDefault();
    fehler.hidden = true;

    const name = document.getElementById("kasseName").value.trim();
    const farbe = formular.querySelector('input[name="farbe"]:checked').value;
    const startText = document.getElementById("kasseStart").value;
    const startbetrag = startText.trim() === "" ? 0 : leseBetrag(startText);
    const startdatum = document.getElementById("kasseDatum").value;

    // Alle Eingaben prüfen, bei einem Fehler abbrechen
    if (name === "") return zeigeFehler(fehler, "Bitte gib einen Namen ein.");

    const doppelt = daten.kassen.some(function (k) {
      return k.name.toLowerCase() === name.toLowerCase() && (!kasse || k.id !== kasse.id);
    });
    if (doppelt) return zeigeFehler(fehler, "Es gibt schon eine Kasse mit diesem Namen.");

    if (startbetrag === null) return zeigeFehler(fehler, "Der Startbetrag ist keine gültige Zahl.");
    if (!startdatum) return zeigeFehler(fehler, "Bitte wähle ein Startdatum.");

    if (entwurf.art === "persoenlich" && entwurf.personen.length !== 1) {
      return zeigeFehler(fehler, "Bitte wähle eine Person aus.");
    }
    if (entwurf.art === "gemeinsam" && entwurf.personen.length < 2) {
      return zeigeFehler(fehler, "Eine gemeinsame Kasse braucht mindestens zwei Personen.");
    }
    if (entwurf.art === "gemeinsam" && entwurf.aufteilungArt === "prozent" && prozentSumme() !== 100) {
      return zeigeFehler(fehler, "Die Prozente müssen zusammen 100 % ergeben. Aktuell sind es " + prozentSumme() + " %.");
    }

    // Aufteilung zusammenbauen
    let aufteilung = null;
    if (entwurf.art === "gemeinsam") {
      aufteilung = { art: entwurf.aufteilungArt };
      if (entwurf.aufteilungArt === "prozent") {
        aufteilung.prozente = {};
        entwurf.personen.forEach(function (pid) { aufteilung.prozente[pid] = entwurf.prozente[pid]; });
      }
    }

    const werte = {
      name: name,
      farbe: farbe,
      art: entwurf.art,
      personen: entwurf.personen.slice(),
      startbetrag: startbetrag,
      startdatum: startdatum,
      aufteilung: aufteilung
    };

    if (istNeu) {
      daten.kassen.push(Object.assign({ id: neueId("kas"), archiviert: false }, werte));
    } else {
      // Bestehende Kasse ändern. Die ID bleibt gleich,
      // deshalb gehören alle Buchungen weiterhin zu ihr.
      Object.assign(kasse, werte);
    }

    speichereDaten();
    zurueck("#kassen");
  });

  document.getElementById("abbrechen").addEventListener("click", function () {
    zurueck("#kassen");
  });

  if (!istNeu) {
    // Archivieren oder wiederherstellen
    document.getElementById("archivieren").addEventListener("click", function () {
      kasse.archiviert = !kasse.archiviert;
      speichereDaten();
      zurueck("#kassen");
    });

    // Löschen ist nur erlaubt, wenn in der Kasse noch nichts gebucht wurde
    document.getElementById("loeschen").addEventListener("click", function () {
      if (kasseWirdVerwendet(kasse.id)) {
        alert("In dieser Kasse gibt es schon Buchungen. Damit nichts verloren geht, kannst du sie nur archivieren.");
        return;
      }
      if (!confirm("Kasse \"" + kasse.name + "\" wirklich löschen?")) return;

      daten.kassen = daten.kassen.filter(function (k) { return k.id !== kasse.id; });
      speichereDaten();
      zurueck("#kassen");
    });
  }

  // Beim Öffnen: Prozente vorbereiten und wechselnden Teil zeichnen
  if (entwurf.art === "gemeinsam") prozenteVorbereiten();
  zeichneTeil();
  if (istNeu) document.getElementById("kasseName").focus();
}
