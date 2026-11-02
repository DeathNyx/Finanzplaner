// ============================================
// Buchungen erfassen, bearbeiten und löschen.
//
// So sieht eine Buchung in den Daten aus:
// {
//   id: "buc_...",
//   kasseId: "kas_...",
//   typ: "ausgabe" oder "einnahme",
//   betrag: 4000 (in Cent, immer positiv),
//   datum: "2026-11-02",
//   kategorieId: "kat_...",
//   notiz: "Wocheneinkauf",
//   bezahltVon: ID einer Person oder null (= aus dem Geld der Kasse),
//   anteile: nur bei Ausgaben in gemeinsamen Kassen, z. B.
//            { per_a: 2400, per_b: 1600 } (wer wie viel davon trägt),
//   vorlageId: null (später für Daueraufträge)
// }
//
// Die Anteile werden bei jeder Buchung fest gespeichert. Ändert man
// später die Aufteilung der Kasse, bleiben alte Buchungen unverändert.
// ============================================

// Bildschirm "Buchen": neue Buchung.
// "kasseId" ist gesetzt, wenn man von der Seite einer Kasse kommt.
function zeichneBuchen(bereich, kasseId) {
  buchungsFormular(bereich, null, kasseId);
}

// Bildschirm "Buchung": bestehende Buchung bearbeiten
function zeichneBuchung(bereich, id) {
  const buchung = findeBuchung(id);
  if (!buchung) {
    location.replace("#kassen");
    return;
  }
  document.getElementById("titel").textContent = "Buchung bearbeiten";
  buchungsFormular(bereich, buchung, null);
}

// Das Formular für neue und bestehende Buchungen
function buchungsFormular(bereich, buchung, vorgewaehlteKasseId) {
  const istNeu = !buchung;

  // Zur Auswahl stehen alle aktiven Kassen. Beim Bearbeiten zusätzlich
  // die eigene Kasse der Buchung, auch wenn sie archiviert ist.
  const auswahlKassen = daten.kassen.filter(function (k) {
    return !k.archiviert || (buchung && k.id === buchung.kasseId);
  });

  if (auswahlKassen.length === 0) {
    bereich.innerHTML =
      platzhalter("Lege zuerst eine Kasse an. Danach kannst du hier Ausgaben und Einnahmen buchen.") +
      '<a class="knopf" href="#kasseform/neu">+ Neue Kasse</a>';
    return;
  }

  // Eingaben, die vom Übertrag Formular mitgebracht wurden (falls man umgeschaltet hat)
  const mit = istNeu ? nimmUebergabe() : {};

  // Welche Kasse am Anfang ausgewählt ist
  let startKasse = auswahlKassen[0];
  const gewuenscht = buchung ? buchung.kasseId : (mit.kasseId || vorgewaehlteKasseId);
  auswahlKassen.forEach(function (k) { if (k.id === gewuenscht) startKasse = k; });

  // Der "Zustand" merkt sich alles, was sich beim Ausfüllen ändert
  const zustand = {
    typ: buchung ? buchung.typ : (mit.typ || "ausgabe"),
    kasse: startKasse,
    betrag: buchung ? buchung.betrag : (mit.betrag || 0),
    // Personen, auf die aufgeteilt wird. Bei alten Buchungen genau die von damals.
    personen: buchung && buchung.anteile ? Object.keys(buchung.anteile) : startKasse.personen.slice(),
    // Gewichte für die Verteilung (z. B. 60 und 40)
    gewichte: buchung && buchung.anteile ? Object.assign({}, buchung.anteile) : regelGewichte(startKasse),
    anteile: {},
    // Ist die Aufteilung zum Ändern aufgeklappt?
    offen: false
  };
  zustand.anteile = verteile(zustand.betrag, zustand.personen, zustand.gewichte);
  zustand.offen = istNeu && regelIstSelbst(startKasse);

  bereich.innerHTML =
    '<form id="buchungFormular" class="karte" novalidate>' +
    '  <fieldset class="umschalter">' +
    '    <legend class="nur-vorlesen">Art der Buchung</legend>' +
    '    <label><input type="radio" name="typ" value="ausgabe"' + (zustand.typ === "ausgabe" ? " checked" : "") + "><span>Ausgabe</span></label>" +
    '    <label><input type="radio" name="typ" value="einnahme"' + (zustand.typ === "einnahme" ? " checked" : "") + "><span>Einnahme</span></label>" +
    // Übertrag gibt es nur bei neuen Buchungen (eine Buchung kann kein Übertrag werden)
    (istNeu ? '    <label><input type="radio" name="typ" value="uebertrag"><span>Übertrag</span></label>' : "") +
    "  </fieldset>" +
    '  <label class="feld">Betrag in €' +
    '    <input id="bBetrag" class="gross-eingabe" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' +
           (buchung ? betragFuerEingabe(buchung.betrag) : (mit.betrag ? betragFuerEingabe(mit.betrag) : "")) + '">' +
    "  </label>" +
    '  <label class="feld">Kasse' +
    '    <select id="bKasse">' +
    auswahlKassen.map(function (k) {
      return '<option value="' + k.id + '"' + (k.id === startKasse.id ? " selected" : "") + ">" + schuetzeText(k.name) + "</option>";
    }).join("") +
    "    </select>" +
    "  </label>" +
    '  <label class="feld">Kategorie <select id="bKategorie"></select></label>' +
    '  <label class="feld">Datum' +
    '    <input id="bDatum" type="date" value="' + (buchung ? buchung.datum : (mit.datum || heute())) + '">' +
    "  </label>" +
    '  <div id="bPerson"></div>' +
    '  <div id="bAufteilung"></div>' +
    '  <label class="feld">Notiz (freiwillig)' +
    '    <input id="bNotiz" type="text" maxlength="80" autocomplete="off" value="' +
           schuetzeText(buchung ? buchung.notiz || "" : (mit.notiz || "")) + '" placeholder="z. B. Wocheneinkauf">' +
    "  </label>" +
    '  <p id="fehler" class="fehler" hidden></p>' +
    '  <button type="submit" class="knopf">Speichern</button>' +
    '  <button type="button" id="abbrechen" class="knopf zweit">Abbrechen</button>' +
    "</form>" +
    (istNeu ? "" : '<button type="button" id="loeschen" class="knopf gefahr">Buchung löschen</button>');

  const formular = document.getElementById("buchungFormular");
  const feldBetrag = document.getElementById("bBetrag");
  const feldKasse = document.getElementById("bKasse");
  const feldKategorie = document.getElementById("bKategorie");
  const bereichPerson = document.getElementById("bPerson");
  const bereichAufteilung = document.getElementById("bAufteilung");
  const fehler = document.getElementById("fehler");

  // Muss die Ausgabe auf Personen aufgeteilt werden?
  function mitAufteilung() {
    return zustand.kasse.art === "gemeinsam" && zustand.typ === "ausgabe";
  }

  // Kategorien passend zum Typ (Ausgabe oder Einnahme) anzeigen
  function zeichneKategorien() {
    const vorher = feldKategorie.value || (buchung ? buchung.kategorieId : "");
    const passend = daten.kategorien.filter(function (k) { return k.typ === zustand.typ; });
    feldKategorie.innerHTML =
      '<option value="">Bitte wählen</option>' +
      passend.map(function (k) {
        return '<option value="' + k.id + '"' + (k.id === vorher ? " selected" : "") + ">" + schuetzeText(k.name) + "</option>";
      }).join("");
  }

  // Auswahl "Bezahlt von" (nur bei gemeinsamen Kassen)
  function zeichnePerson() {
    if (zustand.kasse.art !== "gemeinsam") {
      bereichPerson.innerHTML = "";
      return;
    }
    const vorher = document.getElementById("bBezahlt");
    const gewaehlt = vorher ? vorher.value : (buchung ? buchung.bezahltVon || "" : "");
    bereichPerson.innerHTML =
      '<label class="feld">' + (zustand.typ === "ausgabe" ? "Bezahlt von" : "Eingezahlt von") +
      '  <select id="bBezahlt">' +
      '    <option value="">Aus dem Geld der Kasse</option>' +
      zustand.kasse.personen.map(function (pid) {
        const p = findePerson(pid);
        return p ? '<option value="' + pid + '"' + (pid === gewaehlt ? " selected" : "") + ">" + schuetzeText(p.name) + "</option>" : "";
      }).join("") +
      "  </select>" +
      "</label>" +
      '<p id="bPersonHinweis" class="leise klein"></p>';
    zeigePersonHinweis();
  }

  // Erklärt kurz, was die Auswahl bei "Bezahlt von" bedeutet
  function zeigePersonHinweis() {
    const hinweis = document.getElementById("bPersonHinweis");
    const feld = document.getElementById("bBezahlt");
    if (!hinweis || !feld) return;
    const name = feld.value ? personName(feld.value) : "";
    if (zustand.typ === "ausgabe") {
      hinweis.textContent = name
        ? name + " hat privat bezahlt. Der Kassenstand ändert sich nicht, es zählt als Beitrag von " + name + "."
        : "Das Geld kommt aus der Kasse. Der Kassenstand wird kleiner.";
    } else {
      hinweis.textContent = name
        ? name + " zahlt Geld in die Kasse ein. Das zählt als Beitrag von " + name + "."
        : "Zum Beispiel eine Erstattung. Sie wird nach der Aufteilung der Kasse verteilt.";
    }
  }

  // Aufteilung anzeigen: zugeklappt als Übersicht, aufgeklappt zum Ändern
  function zeichneAufteilung() {
    if (!mitAufteilung()) {
      bereichAufteilung.innerHTML = "";
      return;
    }

    let html = '<div class="aufteilung"><div class="aufteilung-kopf"><strong>Aufteilung</strong>';

    if (!zustand.offen) {
      html += '<button type="button" id="aufteilungAendern" class="link-knopf">Anpassen</button></div>';
      zustand.personen.forEach(function (pid) {
        const p = findePerson(pid);
        html +=
          '<div class="anteil-zeile">' + farbpunkt(p ? p.farbe : "#999") +
          '<span class="zeile-text">' + schuetzeText(p ? p.name : "Unbekannt") + "</span>" +
          '<span class="betrag">' + formatEuro(zustand.anteile[pid]) + "</span></div>";
      });
    } else {
      html += '<button type="button" id="aufteilungRegel" class="link-knopf">Nach Kasse verteilen</button></div>';
      zustand.personen.forEach(function (pid) {
        const p = findePerson(pid);
        const wert = zustand.anteile[pid];
        html +=
          '<label class="anteil-zeile">' + farbpunkt(p ? p.farbe : "#999") +
          '<span class="zeile-text">' + schuetzeText(p ? p.name : "Unbekannt") + "</span>" +
          '<input type="text" inputmode="decimal" class="anteil-feld" data-person="' + pid + '" value="' +
          (wert === null || wert === undefined ? "" : betragFuerEingabe(wert)) + '"><span>€</span></label>';
      });
      html += '<p id="anteilSumme" class="leise"></p>';
    }

    html += "</div>";
    bereichAufteilung.innerHTML = html;
    zeigeAnteilSumme();
  }

  // Summe der Anteile in Cent (null, wenn ein Feld ungültig ist)
  function anteilSumme() {
    let summe = 0;
    for (const pid of zustand.personen) {
      const wert = zustand.anteile[pid];
      if (wert === null || wert === undefined || wert < 0) return null;
      summe += wert;
    }
    return summe;
  }

  // Unter den Anteilfeldern anzeigen, ob alles verteilt ist
  function zeigeAnteilSumme() {
    const anzeige = document.getElementById("anteilSumme");
    if (!anzeige) return;
    const summe = anteilSumme();
    if (summe === null) {
      anzeige.textContent = "Bitte in jedes Feld einen gültigen Betrag eintragen.";
      anzeige.className = "fehler";
    } else if (summe === zustand.betrag) {
      anzeige.textContent = "Verteilt: " + formatEuro(summe) + " von " + formatEuro(zustand.betrag) + " ✓";
      anzeige.className = "leise";
    } else if (summe < zustand.betrag) {
      anzeige.textContent = "Es fehlen noch " + formatEuro(zustand.betrag - summe) + ".";
      anzeige.className = "fehler";
    } else {
      anzeige.textContent = "Das sind " + formatEuro(summe - zustand.betrag) + " zu viel.";
      anzeige.className = "fehler";
    }
  }

  // Alte Fehlermeldung ausblenden, sobald man etwas ändert
  formular.addEventListener("input", function () { fehler.hidden = true; });
  formular.addEventListener("change", function () { fehler.hidden = true; zeigePersonHinweis(); });

  // Wechsel zwischen Ausgabe und Einnahme
  formular.querySelectorAll('input[name="typ"]').forEach(function (knopf) {
    knopf.addEventListener("change", function () {
      // Übertrag hat ein eigenes Formular. Die bisherigen Eingaben nehmen wir mit.
      if (knopf.value === "uebertrag") {
        uebergabe = {
          betrag: leseBetrag(feldBetrag.value) || 0,
          kasseId: feldKasse.value,
          datum: document.getElementById("bDatum").value,
          notiz: document.getElementById("bNotiz").value
        };
        location.replace(vorgewaehlteKasseId ? "#uebertrag/neu/" + vorgewaehlteKasseId : "#uebertrag/neu");
        return;
      }
      zustand.typ = knopf.value;
      feldKategorie.value = "";
      zeichneKategorien();
      zeichnePerson();
      zeichneAufteilung();
    });
  });

  // Betrag geändert: Anteile im gleichen Verhältnis neu verteilen
  feldBetrag.addEventListener("input", function () {
    const cent = leseBetrag(feldBetrag.value);
    zustand.betrag = cent !== null && cent > 0 ? cent : 0;
    zustand.anteile = verteile(zustand.betrag, zustand.personen, zustand.gewichte);
    zeichneAufteilung();
  });

  // Andere Kasse gewählt: Personen und Aufteilung der neuen Kasse übernehmen
  feldKasse.addEventListener("change", function () {
    zustand.kasse = findeKasse(feldKasse.value);
    zustand.personen = zustand.kasse.personen.slice();
    zustand.gewichte = regelGewichte(zustand.kasse);
    zustand.anteile = verteile(zustand.betrag, zustand.personen, zustand.gewichte);
    zustand.offen = regelIstSelbst(zustand.kasse);
    zeichnePerson();
    zeichneAufteilung();
  });

  // Knöpfe in der Aufteilung
  bereichAufteilung.addEventListener("click", function (ereignis) {
    if (ereignis.target.id === "aufteilungAendern") {
      zustand.offen = true;
      zeichneAufteilung();
      const erstes = bereichAufteilung.querySelector(".anteil-feld");
      if (erstes) erstes.focus();
    }
    if (ereignis.target.id === "aufteilungRegel") {
      zustand.personen = zustand.kasse.personen.slice();
      zustand.gewichte = regelGewichte(zustand.kasse);
      zustand.anteile = verteile(zustand.betrag, zustand.personen, zustand.gewichte);
      zeichneAufteilung();
    }
  });

  // Anteile von Hand ändern
  bereichAufteilung.addEventListener("input", function (ereignis) {
    const feld = ereignis.target;
    if (!feld.classList.contains("anteil-feld")) return;

    const pid = feld.dataset.person;
    const cent = leseBetrag(feld.value);
    zustand.anteile[pid] = cent;

    // Bei zwei Personen bekommt die andere automatisch den Rest
    if (zustand.personen.length === 2 && cent !== null && cent >= 0 && cent <= zustand.betrag) {
      const andere = zustand.personen.find(function (id) { return id !== pid; });
      zustand.anteile[andere] = zustand.betrag - cent;
      const anderesFeld = bereichAufteilung.querySelector('.anteil-feld[data-person="' + andere + '"]');
      if (anderesFeld) anderesFeld.value = betragFuerEingabe(zustand.anteile[andere]);
    }

    // Wenn alles gültig ist, merken wir uns das Verhältnis.
    // Ändert man danach den Betrag, bleibt das Verhältnis gleich.
    if (anteilSumme() !== null && anteilSumme() > 0) {
      zustand.gewichte = Object.assign({}, zustand.anteile);
    }
    zeigeAnteilSumme();
  });

  // Speichern
  formular.addEventListener("submit", function (ereignis) {
    ereignis.preventDefault();

    const betrag = leseBetrag(feldBetrag.value);
    const kategorieId = feldKategorie.value;
    const datum = document.getElementById("bDatum").value;
    const notiz = document.getElementById("bNotiz").value.trim();
    const feldBezahlt = document.getElementById("bBezahlt");

    if (betrag === null || betrag <= 0) {
      feldBetrag.focus();
      return zeigeFehler(fehler, "Bitte gib einen Betrag größer als 0 ein.");
    }
    if (!kategorieId) return zeigeFehler(fehler, "Bitte wähle eine Kategorie.");
    if (!datum) return zeigeFehler(fehler, "Bitte wähle ein Datum.");

    zustand.betrag = betrag;
    if (mitAufteilung() && anteilSumme() !== betrag) {
      zustand.offen = true;
      zeichneAufteilung();
      return zeigeFehler(fehler, "Die Aufteilung ergibt nicht den ganzen Betrag. Bitte prüfe die Anteile.");
    }

    const werte = {
      kasseId: zustand.kasse.id,
      typ: zustand.typ,
      betrag: betrag,
      datum: datum,
      kategorieId: kategorieId,
      notiz: notiz,
      bezahltVon: feldBezahlt && feldBezahlt.value ? feldBezahlt.value : null,
      anteile: null
    };

    // Anteile nur speichern, wenn wirklich aufgeteilt wird
    if (mitAufteilung()) {
      werte.anteile = {};
      zustand.personen.forEach(function (pid) { werte.anteile[pid] = zustand.anteile[pid]; });
    }

    if (istNeu) {
      daten.buchungen.push(Object.assign({ id: neueId("buc"), vorlageId: null }, werte));
    } else {
      Object.assign(buchung, werte);
    }
    speichereDaten();
    zeigeMeldung("Buchung gespeichert");

    // Danach die Seite der Kasse zeigen
    if (!istNeu || vorgewaehlteKasseId) {
      zurueck("#kasse/" + werte.kasseId);
    } else {
      location.replace("#kasse/" + werte.kasseId);
    }
  });

  document.getElementById("abbrechen").addEventListener("click", function () {
    zurueck(buchung ? "#kasse/" + buchung.kasseId : "#uebersicht");
  });

  if (!istNeu) {
    document.getElementById("loeschen").addEventListener("click", function () {
      if (!confirm("Buchung über " + formatEuro(buchung.betrag) + " wirklich löschen?")) return;
      daten.buchungen = daten.buchungen.filter(function (b) { return b.id !== buchung.id; });
      speichereDaten();
      zeigeMeldung("Buchung gelöscht");
      zurueck("#kasse/" + buchung.kasseId);
    });
  }

  // Beim Öffnen alles einmal zeichnen
  zeichneKategorien();
  zeichnePerson();
  zeichneAufteilung();
  if (istNeu) feldBetrag.focus();
}

// Hat die Kasse die Aufteilung "selbst eintragen"?
function regelIstSelbst(kasse) {
  return kasse.art === "gemeinsam" && kasse.aufteilung && kasse.aufteilung.art === "selbst";
}
