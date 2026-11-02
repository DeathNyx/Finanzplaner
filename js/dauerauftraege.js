// ============================================
// Daueraufträge: alles, was jeden Monat wiederkommt
// (Gehalt, Miete, Strom, Abos, Beitrag in die Haushaltskasse ...).
//
// So sieht ein Dauerauftrag in den Daten aus:
// {
//   id: "dau_...",
//   art: "ausgabe", "einnahme" oder "uebertrag",
//   name: "Miete",
//   betrag: 95000 (in Cent),
//   kasseId, kategorieId, bezahltVon   (bei Ausgabe und Einnahme)
//   vonKasseId, nachKasseId            (bei Übertrag)
//   tag: 1 (Tag im Monat, 1 bis 31),
//   startMonat: "2026-11",
//   endeMonat: null oder z. B. "2027-06",
//   pausiert: false,
//   zuletztGebucht: "2026-11" (letzter Monat, für den gebucht wurde)
// }
//
// Beim Öffnen der App prüft sie, ob ein Dauerauftrag fällig ist,
// und legt dann eine echte Buchung an (mit vorlageId = ID des Auftrags).
// "zuletztGebucht" verhindert, dass etwas doppelt gebucht wird.
// ============================================

// Dauerauftrag anhand seiner ID finden
function findeDauerauftrag(id) {
  return daten.dauerauftraege.find(function (d) { return d.id === id; });
}

// Letzter Tag eines Monats, z. B. 28 für "2027-02"
function letzterTag(monat) {
  const [jahr, m] = monat.split("-").map(Number);
  return new Date(jahr, m, 0).getDate();
}

// Datum, an dem ein Auftrag in einem Monat fällig ist.
// Tag 31 im Februar wird zum letzten Tag im Februar.
function faelligAm(auftrag, monat) {
  const tag = Math.min(auftrag.tag, letzterTag(monat));
  return monat + "-" + String(tag).padStart(2, "0");
}

// Ab welchem Monat muss als Nächstes gebucht werden?
function naechsterMonat(auftrag) {
  return auftrag.zuletztGebucht ? verschiebeMonat(auftrag.zuletztGebucht, 1) : auftrag.startMonat;
}

// Kurze Beschreibung, z. B. "jeden 1. · Girokonto"
function auftragBeschreibung(d) {
  let wo = "";
  if (d.art === "uebertrag") {
    const von = findeKasse(d.vonKasseId);
    const nach = findeKasse(d.nachKasseId);
    wo = (von ? von.name : "?") + " → " + (nach ? nach.name : "?");
  } else {
    const kasse = findeKasse(d.kasseId);
    wo = kasse ? kasse.name : "?";
  }
  let text = "jeden " + d.tag + ". · " + wo;
  if (d.endeMonat) text += " · bis " + formatMonat(d.endeMonat);
  if (d.pausiert) text = "Pausiert · " + text;
  else if (istBeendet(d) || schuldAbbezahlt(d)) text = "Beendet · " + text;
  return text;
}

// Gehört der Auftrag zu einer Schuld, die schon abbezahlt ist?
function schuldAbbezahlt(d) {
  const schuld = d.schuldId ? findeSchuld(d.schuldId) : null;
  return !!schuld && restbetrag(schuld) === 0;
}

// Ist der letzte Monat eines Auftrags schon vorbei?
function istBeendet(d) {
  return !!d.endeMonat && d.endeMonat < heute().slice(0, 7);
}

// Legt für einen Auftrag die Buchung (oder den Übertrag) eines Monats an
function bucheAuftrag(d, monat) {
  const datum = faelligAm(d, monat);

  if (d.art === "uebertrag") {
    daten.uebertraege.push({
      id: neueId("ueb"),
      vonKasseId: d.vonKasseId,
      nachKasseId: d.nachKasseId,
      betrag: d.betrag,
      datum: datum,
      personId: uebertragsPerson(findeKasse(d.vonKasseId), findeKasse(d.nachKasseId)),
      notiz: d.name,
      vorlageId: d.id
    });
    return;
  }

  const kasse = findeKasse(d.kasseId);
  if (!kasse) return;

  // Bei Raten: höchstens so viel buchen, wie noch offen ist
  let betrag = d.betrag;
  const schuld = d.schuldId ? findeSchuld(d.schuldId) : null;
  if (schuld) betrag = Math.min(betrag, restbetrag(schuld));
  if (betrag <= 0) return;

  // Bei Ausgaben in gemeinsamen Kassen: Aufteilung nach der aktuellen Regel der Kasse
  let anteile = null;
  if (d.art === "ausgabe" && kasse.art === "gemeinsam") {
    anteile = verteile(betrag, kasse.personen, regelGewichte(kasse));
  }

  daten.buchungen.push({
    id: neueId("buc"),
    kasseId: d.kasseId,
    typ: d.art,
    betrag: betrag,
    datum: datum,
    kategorieId: d.kategorieId,
    notiz: d.name,
    bezahltVon: kasse.art === "gemeinsam" ? d.bezahltVon || null : null,
    anteile: anteile,
    vorlageId: d.id,
    schuldId: d.schuldId || null
  });
}

// Bucht alle fälligen Daueraufträge bis heute.
// Gibt zurück, wie viele Buchungen angelegt wurden.
function fuehreDauerauftraegeAus() {
  const heuteText = heute();
  const dieserMonat = heuteText.slice(0, 7);
  let anzahl = 0;

  daten.dauerauftraege.forEach(function (d) {
    if (d.pausiert) return;

    let monat = naechsterMonat(d);
    // Monat für Monat nachholen, aber höchstens bis heute
    while (monat <= dieserMonat && (!d.endeMonat || monat <= d.endeMonat)) {
      if (faelligAm(d, monat) > heuteText) break; // in diesem Monat noch nicht fällig
      if (schuldAbbezahlt(d)) break;              // Schuld ist schon abbezahlt
      bucheAuftrag(d, monat);
      d.zuletztGebucht = monat;
      anzahl++;
      monat = verschiebeMonat(monat, 1);
    }
  });

  if (anzahl > 0) speichereDaten();
  return anzahl;
}

// Daueraufträge, die in einem Monat noch kommen werden (noch nicht gebucht).
// Überträge zählen nicht, weil sie das Gesamtergebnis nicht ändern.
function erwarteteDauerauftraege(monat) {
  return daten.dauerauftraege.filter(function (d) {
    if (d.pausiert || d.art === "uebertrag" || schuldAbbezahlt(d)) return false;
    if (monat < d.startMonat) return false;
    if (d.endeMonat && monat > d.endeMonat) return false;
    return monat >= naechsterMonat(d);
  });
}

// Summe pro Monat aller aktiven Aufträge einer Art
function monatlicheSumme(art) {
  return daten.dauerauftraege
    .filter(function (d) {
      if (d.pausiert || d.art !== art) return false;
      return !istBeendet(d) && !schuldAbbezahlt(d);
    })
    .reduce(function (summe, d) { return summe + d.betrag; }, 0);
}


// ============================================
// Bildschirm "Daueraufträge": Liste
// ============================================
function zeichneDauerauftraege(bereich) {
  let html = "";

  if (daten.dauerauftraege.length === 0) {
    html += platzhalter("Noch keine Daueraufträge. Lege hier an, was jeden Monat wiederkommt: Gehalt, Miete, Strom, Handy, Versicherungen, Abos oder deinen Beitrag in die Haushaltskasse.");
  } else {
    // Summen pro Monat
    html +=
      '<div class="karte summen">' +
      '  <p class="leise klein">Jeden Monat</p>' +
      '  <div><span class="leise">Feste Einnahmen</span>' + betragMitVorzeichen(monatlicheSumme("einnahme"), "einnahme") + "</div>" +
      '  <div><span class="leise">Fixkosten</span>' + betragMitVorzeichen(monatlicheSumme("ausgabe"), "ausgabe") + "</div>" +
      '  <div class="summe-gesamt"><span>Bleibt fest übrig</span><span class="betrag">' +
           formatEuro(monatlicheSumme("einnahme") - monatlicheSumme("ausgabe")) + "</span></div>" +
      "</div>";

    // Nach Art gruppiert
    [["einnahme", "Einnahmen"], ["ausgabe", "Fixkosten"], ["uebertrag", "Überträge"]].forEach(function (gruppe) {
      const liste = daten.dauerauftraege.filter(function (d) { return d.art === gruppe[0]; });
      if (liste.length === 0) return;
      html += '<h2 class="abschnitt">' + gruppe[1] + '</h2><div class="karte liste">';
      liste
        .sort(function (a, b) { return a.tag - b.tag; })
        .forEach(function (d) {
          html +=
            '<a class="zeile' + (d.pausiert || istBeendet(d) || schuldAbbezahlt(d) ? " pausiert" : "") + '" href="#dauerauftrag/' + d.id + '">' +
            '  <span class="zeile-text zweizeilig">' +
            "    <span>" + schuetzeText(d.name) + "</span>" +
            '    <small class="leise">' + schuetzeText(auftragBeschreibung(d)) + "</small>" +
            "  </span>" +
            (d.art === "uebertrag"
              ? '<span class="betrag">' + formatEuro(d.betrag) + "</span>"
              : betragMitVorzeichen(d.betrag, d.art)) +
            "</a>";
        });
      html += "</div>";
    });
  }

  html += '<a class="knopf" href="#dauerauftrag/neu">+ Neuer Dauerauftrag</a>';
  html += '<p class="leise klein">Die App bucht Daueraufträge automatisch, sobald sie fällig sind und du die App öffnest. Gebuchte Einträge erkennst du am 🔁.</p>';
  bereich.innerHTML = html;
}


// ============================================
// Bildschirm "Dauerauftrag": anlegen oder bearbeiten
// ============================================
function zeichneDauerauftrag(bereich, id) {
  const istNeu = id === "neu";
  const auftrag = istNeu ? null : findeDauerauftrag(id);

  if (!istNeu && !auftrag) {
    location.replace("#dauerauftraege");
    return;
  }

  document.getElementById("titel").textContent = istNeu ? "Neuer Dauerauftrag" : "Dauerauftrag bearbeiten";

  const kassen = daten.kassen.filter(function (k) {
    return !k.archiviert || (auftrag && [auftrag.kasseId, auftrag.vonKasseId, auftrag.nachKasseId].includes(k.id));
  });

  if (kassen.length === 0) {
    bereich.innerHTML = platzhalter("Lege zuerst eine Kasse an.") +
      '<a class="knopf" href="#kasseform/neu">+ Neue Kasse</a>';
    return;
  }

  // Vorausgefüllte Werte (z. B. von der Seite einer Schuld)
  const mit = istNeu ? nimmUebergabe() : {};
  const art = auftrag ? auftrag.art : (mit.art || "ausgabe");
  const dieserMonat = heute().slice(0, 7);

  function kassenOptionen(gewaehlt) {
    return kassen.map(function (k) {
      return '<option value="' + k.id + '"' + (k.id === gewaehlt ? " selected" : "") + ">" + schuetzeText(k.name) + "</option>";
    }).join("");
  }

  // Bei Überträgen: Ziel möglichst eine andere Kasse als die erste
  const zweiteKasse = kassen.length > 1 ? kassen[1].id : kassen[0].id;

  bereich.innerHTML =
    '<form id="auftragFormular" class="karte" novalidate>' +
    '  <fieldset class="umschalter">' +
    '    <legend class="nur-vorlesen">Art</legend>' +
    '    <label><input type="radio" name="art" value="ausgabe"' + (art === "ausgabe" ? " checked" : "") + "><span>Ausgabe</span></label>" +
    '    <label><input type="radio" name="art" value="einnahme"' + (art === "einnahme" ? " checked" : "") + "><span>Einnahme</span></label>" +
    '    <label><input type="radio" name="art" value="uebertrag"' + (art === "uebertrag" ? " checked" : "") + "><span>Übertrag</span></label>" +
    "  </fieldset>" +
    '  <label class="feld">Bezeichnung' +
    '    <input id="dName" type="text" maxlength="40" autocomplete="off" value="' + schuetzeText(auftrag ? auftrag.name : (mit.name || "")) +
         '" placeholder="z. B. Miete, Gehalt, Netflix">' +
    "  </label>" +
    '  <label class="feld">Betrag pro Monat in €' +
    '    <input id="dBetrag" class="gross-eingabe" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' +
         (auftrag ? betragFuerEingabe(auftrag.betrag) : (mit.betrag ? betragFuerEingabe(mit.betrag) : "")) + '">' +
    "  </label>" +
    // Teil für Ausgabe und Einnahme
    '  <div id="teilBuchung">' +
    '    <label class="feld">Kasse <select id="dKasse">' + kassenOptionen(auftrag ? auftrag.kasseId : kassen[0].id) + "</select></label>" +
    '    <label class="feld">Kategorie <select id="dKategorie"></select></label>' +
    '    <div id="dPersonBereich"></div>' +
    '    <div id="dSchuldBereich"></div>' +
    "  </div>" +
    // Teil für Übertrag
    '  <div id="teilUebertrag">' +
    '    <label class="feld">Von Kasse <select id="dVon">' + kassenOptionen(auftrag && auftrag.vonKasseId ? auftrag.vonKasseId : kassen[0].id) + "</select></label>" +
    '    <label class="feld">An Kasse <select id="dNach">' + kassenOptionen(auftrag && auftrag.nachKasseId ? auftrag.nachKasseId : zweiteKasse) + "</select></label>" +
    "  </div>" +
    '  <label class="feld">Tag im Monat' +
    '    <input id="dTag" type="number" min="1" max="31" step="1" inputmode="numeric" value="' + (auftrag ? auftrag.tag : 1) + '">' +
    "  </label>" +
    '  <p class="leise klein">Hat ein Monat weniger Tage, wird am letzten Tag gebucht.</p>' +
    '  <label class="feld">Erster Monat' +
    '    <input id="dStart" type="month" value="' + (auftrag ? auftrag.startMonat : dieserMonat) + '">' +
    "  </label>" +
    '  <label class="feld">Letzter Monat (freiwillig)' +
    '    <input id="dEnde" type="month" value="' + (auftrag && auftrag.endeMonat ? auftrag.endeMonat : "") + '">' +
    "  </label>" +
    '  <p class="leise klein">Leer lassen, wenn es kein Ende gibt. Für Raten trägst du den Monat der letzten Rate ein.</p>' +
    (istNeu ? "" :
      '  <label class="schalter"><input id="dPausiert" type="checkbox"' + (auftrag.pausiert ? " checked" : "") + "><span>Pausiert (wird nicht gebucht)</span></label>") +
    '  <p id="dHinweis" class="hinweis"></p>' +
    '  <p id="fehler" class="fehler" hidden></p>' +
    '  <button type="submit" class="knopf">Speichern</button>' +
    '  <button type="button" id="abbrechen" class="knopf zweit">Abbrechen</button>' +
    "</form>" +
    (istNeu ? "" :
      '<p class="leise klein">Schon gebuchte Einträge bleiben erhalten, wenn du den Auftrag änderst oder löschst. Änderungen gelten nur für kommende Monate.</p>' +
      '<button type="button" id="loeschen" class="knopf gefahr">Dauerauftrag löschen</button>');

  const formular = document.getElementById("auftragFormular");
  const fehler = document.getElementById("fehler");
  const feldKasse = document.getElementById("dKasse");
  const feldKategorie = document.getElementById("dKategorie");

  function gewaehlteArt() {
    return formular.querySelector('input[name="art"]:checked').value;
  }

  // Passende Teile ein und ausblenden
  function zeigeTeile() {
    const a = gewaehlteArt();
    document.getElementById("teilBuchung").hidden = a === "uebertrag";
    document.getElementById("teilUebertrag").hidden = a !== "uebertrag";
    zeichneKategorien();
    zeichnePerson();
    zeichneSchuldWahl();
    zeigeHinweis();
  }

  function zeichneKategorien() {
    const a = gewaehlteArt();
    if (a === "uebertrag") return;
    const vorher = feldKategorie.value || (auftrag ? auftrag.kategorieId : "");
    feldKategorie.innerHTML = '<option value="">Bitte wählen</option>' +
      daten.kategorien
        .filter(function (k) { return k.typ === a; })
        .map(function (k) {
          return '<option value="' + k.id + '"' + (k.id === vorher ? " selected" : "") + ">" + schuetzeText(k.name) + "</option>";
        }).join("");
  }

  // "Bezahlt von" nur bei gemeinsamen Kassen
  function zeichnePerson() {
    const bereichPerson = document.getElementById("dPersonBereich");
    const kasse = findeKasse(feldKasse.value);
    if (gewaehlteArt() === "uebertrag" || !kasse || kasse.art !== "gemeinsam") {
      bereichPerson.innerHTML = "";
      return;
    }
    const vorher = document.getElementById("dBezahlt");
    const gewaehlt = vorher ? vorher.value : (auftrag ? auftrag.bezahltVon || "" : "");
    bereichPerson.innerHTML =
      '<label class="feld">' + (gewaehlteArt() === "ausgabe" ? "Bezahlt von" : "Eingezahlt von") +
      ' <select id="dBezahlt"><option value="">Aus dem Geld der Kasse</option>' +
      kasse.personen.map(function (pid) {
        return '<option value="' + pid + '"' + (pid === gewaehlt ? " selected" : "") + ">" + schuetzeText(personName(pid)) + "</option>";
      }).join("") +
      "</select></label>";
  }

  // "Rate oder Tilgung für" nur bei Ausgaben
  function zeichneSchuldWahl() {
    const bereichSchuld = document.getElementById("dSchuldBereich");
    if (gewaehlteArt() !== "ausgabe") {
      bereichSchuld.innerHTML = "";
      return;
    }
    const vorher = document.getElementById("dSchuld");
    const gewaehlt = vorher ? vorher.value : (auftrag ? auftrag.schuldId || "" : (mit.schuldId || ""));
    bereichSchuld.innerHTML = schuldAuswahl("dSchuld", gewaehlt);
  }

  // Zeigt, wann zum ersten Mal gebucht wird
  function zeigeHinweis() {
    const hinweis = document.getElementById("dHinweis");
    const tag = Number(document.getElementById("dTag").value);
    const start = document.getElementById("dStart").value;
    if (!istNeu || !tag || !/^\d{4}-\d{2}$/.test(start)) {
      hinweis.textContent = "";
      return;
    }
    const erstes = faelligAm({ tag: Math.min(Math.max(tag, 1), 31) }, start);
    if (erstes <= heute()) {
      hinweis.textContent = "Achtung: Der " + formatDatum(erstes) + " ist schon vorbei. Die App bucht das gleich nach dem Speichern. " +
        "Hast du es schon von Hand gebucht, wähle als ersten Monat lieber den nächsten.";
    } else {
      hinweis.textContent = "Erste Buchung am " + formatDatum(erstes) + ".";
    }
  }

  formular.addEventListener("input", function () { fehler.hidden = true; zeigeHinweis(); });
  formular.addEventListener("change", function (ereignis) {
    fehler.hidden = true;
    if (ereignis.target.name === "art") {
      if (feldKategorie) feldKategorie.value = "";
      zeigeTeile();
    }
    if (ereignis.target.id === "dKasse") zeichnePerson();
    zeigeHinweis();
  });

  // Speichern
  formular.addEventListener("submit", function (ereignis) {
    ereignis.preventDefault();
    const a = gewaehlteArt();
    const name = document.getElementById("dName").value.trim();
    const betrag = leseBetrag(document.getElementById("dBetrag").value);
    const tag = Number(document.getElementById("dTag").value);
    const startMonat = document.getElementById("dStart").value;
    const endeMonat = document.getElementById("dEnde").value || null;
    const monatMuster = /^\d{4}-\d{2}$/;

    if (name === "") return zeigeFehler(fehler, "Bitte gib eine Bezeichnung ein, z. B. Miete.");
    if (betrag === null || betrag <= 0) return zeigeFehler(fehler, "Bitte gib einen Betrag größer als 0 ein.");
    if (!Number.isInteger(tag) || tag < 1 || tag > 31) return zeigeFehler(fehler, "Der Tag muss zwischen 1 und 31 liegen.");
    if (!monatMuster.test(startMonat)) return zeigeFehler(fehler, "Bitte wähle den ersten Monat.");
    if (endeMonat && !monatMuster.test(endeMonat)) return zeigeFehler(fehler, "Der letzte Monat ist ungültig.");
    if (endeMonat && endeMonat < startMonat) return zeigeFehler(fehler, "Der letzte Monat liegt vor dem ersten Monat.");

    const werte = {
      art: a,
      name: name,
      betrag: betrag,
      tag: tag,
      startMonat: startMonat,
      endeMonat: endeMonat,
      kasseId: null,
      kategorieId: null,
      bezahltVon: null,
      vonKasseId: null,
      nachKasseId: null,
      schuldId: null
    };

    if (a === "uebertrag") {
      werte.vonKasseId = document.getElementById("dVon").value;
      werte.nachKasseId = document.getElementById("dNach").value;
      if (werte.vonKasseId === werte.nachKasseId) return zeigeFehler(fehler, "Von und An müssen verschiedene Kassen sein.");
    } else {
      werte.kasseId = feldKasse.value;
      werte.kategorieId = feldKategorie.value;
      if (!werte.kategorieId) return zeigeFehler(fehler, "Bitte wähle eine Kategorie.");
      const feldBezahlt = document.getElementById("dBezahlt");
      werte.bezahltVon = feldBezahlt && feldBezahlt.value ? feldBezahlt.value : null;
      const feldSchuld = document.getElementById("dSchuld");
      if (a === "ausgabe" && feldSchuld && feldSchuld.value) werte.schuldId = feldSchuld.value;
    }

    if (istNeu) {
      daten.dauerauftraege.push(Object.assign({ id: neueId("dau"), pausiert: false, zuletztGebucht: null }, werte));
    } else {
      werte.pausiert = document.getElementById("dPausiert").checked;
      // Wurde der Start nach hinten verschoben, nichts vor dem neuen Start nachholen
      if (auftrag.zuletztGebucht && werte.startMonat > auftrag.zuletztGebucht) {
        auftrag.zuletztGebucht = verschiebeMonat(werte.startMonat, -1);
      }
      Object.assign(auftrag, werte);
    }

    speichereDaten();
    const gebucht = fuehreDauerauftraegeAus();
    zeigeMeldung(gebucht > 0 ? "Gespeichert und " + gebucht + " mal gebucht" : "Dauerauftrag gespeichert");
    zurueck("#dauerauftraege");
  });

  document.getElementById("abbrechen").addEventListener("click", function () {
    zurueck("#dauerauftraege");
  });

  if (!istNeu) {
    document.getElementById("loeschen").addEventListener("click", function () {
      if (!confirm("Dauerauftrag \"" + auftrag.name + "\" löschen? Schon gebuchte Einträge bleiben erhalten.")) return;
      daten.dauerauftraege = daten.dauerauftraege.filter(function (d) { return d.id !== auftrag.id; });
      speichereDaten();
      zeigeMeldung("Dauerauftrag gelöscht");
      zurueck("#dauerauftraege");
    });
  }

  zeigeTeile();
  if (istNeu) document.getElementById("dName").focus();
}
