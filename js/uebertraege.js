// ============================================
// Überträge: Geld von einer Kasse in eine andere.
//
// So sieht ein Übertrag in den Daten aus:
// {
//   id: "ueb_...",
//   vonKasseId: "kas_giro",
//   nachKasseId: "kas_haushalt",
//   betrag: 50000 (in Cent),
//   datum: "2026-11-01",
//   personId: ID der Person, für die der Übertrag zählt, oder null,
//   notiz: "Beitrag November",
//   vorlageId: null (später für Daueraufträge)
// }
//
// Ein Übertrag ist keine Ausgabe: Das Geld ist danach nur woanders.
//
// Die Person wird automatisch bestimmt: Geht Geld zwischen einer
// persönlichen und einer gemeinsamen Kasse hin und her, zählt der
// Übertrag für die Person der persönlichen Kasse. Beispiel:
// Girokonto (Ich) an Haushalt (gemeinsam) heißt "Ich zahlt ein".
// Das braucht später die Ausgleichsrechnung.
// ============================================

// Für welche Person zählt ein Übertrag zwischen diesen zwei Kassen?
function uebertragsPerson(von, nach) {
  if (!von || !nach) return null;
  if (von.art === "persoenlich" && nach.art === "gemeinsam") return von.personen[0] || null;
  if (von.art === "gemeinsam" && nach.art === "persoenlich") return nach.personen[0] || null;
  return null;
}

// Übertrag anhand seiner ID finden
function findeUebertrag(id) {
  return daten.uebertraege.find(function (u) { return u.id === id; });
}

// Bildschirm "Übertrag": "id" ist "neu" oder die ID eines Übertrags.
// "kasseId" ist gesetzt, wenn man von der Seite einer Kasse kommt.
function zeichneUebertrag(bereich, id, kasseId) {
  const istNeu = id === "neu";
  const uebertrag = istNeu ? null : findeUebertrag(id);

  if (!istNeu && !uebertrag) {
    location.replace("#kassen");
    return;
  }

  document.getElementById("titel").textContent = istNeu ? "Buchen" : "Übertrag bearbeiten";

  // Aktive Kassen, beim Bearbeiten auch die beteiligten archivierten
  const auswahlKassen = daten.kassen.filter(function (k) {
    return !k.archiviert || (uebertrag && (k.id === uebertrag.vonKasseId || k.id === uebertrag.nachKasseId));
  });

  // Mitgebrachte Eingaben aus dem Buchungsformular
  const mit = istNeu ? nimmUebergabe() : {};

  if (auswahlKassen.length < 2) {
    bereich.innerHTML =
      platzhalter("Für einen Übertrag brauchst du mindestens zwei Kassen.") +
      '<a class="knopf" href="#kasseform/neu">+ Neue Kasse</a>';
    return;
  }

  // Startwerte für "von" und "nach"
  let vonId, nachId;
  if (uebertrag) {
    vonId = uebertrag.vonKasseId;
    nachId = uebertrag.nachKasseId;
  } else {
    const gewuenscht = mit.kasseId || kasseId;
    const von = auswahlKassen.find(function (k) { return k.id === gewuenscht; }) || auswahlKassen[0];
    vonId = von.id;
    // Als Ziel bevorzugt eine Kasse der anderen Art (persönlich an gemeinsam)
    const andere = auswahlKassen.filter(function (k) { return k.id !== vonId; });
    const passend = andere.find(function (k) { return k.art !== von.art; }) || andere[0];
    nachId = passend.id;
  }

  // Auswahlliste der Kassen
  function kassenOptionen(gewaehlt) {
    return auswahlKassen.map(function (k) {
      return '<option value="' + k.id + '"' + (k.id === gewaehlt ? " selected" : "") + ">" + schuetzeText(k.name) + "</option>";
    }).join("");
  }

  const startBetrag = uebertrag ? uebertrag.betrag : mit.betrag;

  bereich.innerHTML =
    '<form id="uebertragFormular" class="karte" novalidate>' +
    (istNeu ?
      '<fieldset class="umschalter">' +
      '  <legend class="nur-vorlesen">Art der Buchung</legend>' +
      '  <label><input type="radio" name="typ" value="ausgabe"><span>Ausgabe</span></label>' +
      '  <label><input type="radio" name="typ" value="einnahme"><span>Einnahme</span></label>' +
      '  <label><input type="radio" name="typ" value="uebertrag" checked><span>Übertrag</span></label>' +
      "</fieldset>" : "") +
    '  <label class="feld">Betrag in €' +
    '    <input id="uBetrag" class="gross-eingabe" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' +
           (startBetrag ? betragFuerEingabe(startBetrag) : "") + '">' +
    "  </label>" +
    '  <label class="feld">Von Kasse <select id="uVon">' + kassenOptionen(vonId) + "</select></label>" +
    '  <button type="button" id="tauschen" class="link-knopf tauschen">⇅ Tauschen</button>' +
    '  <label class="feld">An Kasse <select id="uNach">' + kassenOptionen(nachId) + "</select></label>" +
    '  <p id="uPerson" class="leise"></p>' +
    '  <label class="feld">Datum' +
    '    <input id="uDatum" type="date" value="' + (uebertrag ? uebertrag.datum : (mit.datum || heute())) + '">' +
    "  </label>" +
    '  <label class="feld">Notiz (freiwillig)' +
    '    <input id="uNotiz" type="text" maxlength="80" autocomplete="off" value="' +
           schuetzeText(uebertrag ? uebertrag.notiz || "" : (mit.notiz || "")) + '" placeholder="z. B. Beitrag November">' +
    "  </label>" +
    '  <p id="fehler" class="fehler" hidden></p>' +
    '  <button type="submit" class="knopf">Speichern</button>' +
    '  <button type="button" id="abbrechen" class="knopf zweit">Abbrechen</button>' +
    "</form>" +
    (istNeu ? "" : '<button type="button" id="loeschen" class="knopf gefahr">Übertrag löschen</button>');

  const formular = document.getElementById("uebertragFormular");
  const feldBetrag = document.getElementById("uBetrag");
  const feldVon = document.getElementById("uVon");
  const feldNach = document.getElementById("uNach");
  const fehler = document.getElementById("fehler");

  // Zeigt an, für wen der Übertrag zählt
  function zeigePerson() {
    const anzeige = document.getElementById("uPerson");
    const pid = uebertragsPerson(findeKasse(feldVon.value), findeKasse(feldNach.value));
    const person = pid ? findePerson(pid) : null;
    if (feldVon.value === feldNach.value) {
      anzeige.textContent = "";
    } else if (person) {
      anzeige.textContent = "Zählt als Beitrag von " + person.name + ".";
    } else {
      anzeige.textContent = "";
    }
  }

  formular.addEventListener("input", function () { fehler.hidden = true; });
  formular.addEventListener("change", function () { fehler.hidden = true; zeigePerson(); });

  // Zurück zu Ausgabe oder Einnahme: bisherige Eingaben mitnehmen
  formular.querySelectorAll('input[name="typ"]').forEach(function (knopf) {
    knopf.addEventListener("change", function () {
      if (knopf.value === "uebertrag") return;
      uebergabe = {
        typ: knopf.value,
        betrag: leseBetrag(feldBetrag.value) || 0,
        kasseId: feldVon.value,
        datum: document.getElementById("uDatum").value,
        notiz: document.getElementById("uNotiz").value
      };
      location.replace(kasseId ? "#buchen/" + kasseId : "#buchen");
    });
  });

  // Von und An tauschen
  document.getElementById("tauschen").addEventListener("click", function () {
    const merken = feldVon.value;
    feldVon.value = feldNach.value;
    feldNach.value = merken;
    zeigePerson();
  });

  // Speichern
  formular.addEventListener("submit", function (ereignis) {
    ereignis.preventDefault();

    const betrag = leseBetrag(feldBetrag.value);
    const datum = document.getElementById("uDatum").value;

    if (betrag === null || betrag <= 0) {
      feldBetrag.focus();
      return zeigeFehler(fehler, "Bitte gib einen Betrag größer als 0 ein.");
    }
    if (feldVon.value === feldNach.value) {
      return zeigeFehler(fehler, "Von und An müssen verschiedene Kassen sein.");
    }
    if (!datum) return zeigeFehler(fehler, "Bitte wähle ein Datum.");

    const werte = {
      vonKasseId: feldVon.value,
      nachKasseId: feldNach.value,
      betrag: betrag,
      datum: datum,
      personId: uebertragsPerson(findeKasse(feldVon.value), findeKasse(feldNach.value)),
      notiz: document.getElementById("uNotiz").value.trim()
    };

    if (istNeu) {
      daten.uebertraege.push(Object.assign({ id: neueId("ueb"), vorlageId: null }, werte));
    } else {
      Object.assign(uebertrag, werte);
    }
    speichereDaten();
    zeigeMeldung("Übertrag gespeichert");

    // Danach die Seite der Kasse zeigen, von der man kam
    const ziel = "#kasse/" + (kasseId || werte.vonKasseId);
    if (!istNeu || kasseId) {
      zurueck(ziel);
    } else {
      location.replace(ziel);
    }
  });

  document.getElementById("abbrechen").addEventListener("click", function () {
    zurueck(uebertrag ? "#kasse/" + uebertrag.vonKasseId : "#uebersicht");
  });

  if (!istNeu) {
    document.getElementById("loeschen").addEventListener("click", function () {
      if (!confirm("Übertrag über " + formatEuro(uebertrag.betrag) + " wirklich löschen?")) return;
      daten.uebertraege = daten.uebertraege.filter(function (u) { return u.id !== uebertrag.id; });
      speichereDaten();
      zeigeMeldung("Übertrag gelöscht");
      zurueck("#kasse/" + uebertrag.vonKasseId);
    });
  }

  zeigePerson();
  if (istNeu && !startBetrag) feldBetrag.focus();
}
