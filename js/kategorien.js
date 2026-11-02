// ============================================
// Kategorien anlegen, umbenennen und löschen.
//
// So sieht eine Kategorie in den Daten aus:
// { id: "kat_...", name: "Lebensmittel", typ: "ausgabe" oder "einnahme" }
//
// Buchungen merken sich nur die ID. Deshalb kann man Kategorien
// umbenennen, ohne dass alte Buchungen etwas davon merken.
// ============================================

// Wie oft wird eine Kategorie benutzt? (Buchungen und Daueraufträge)
function kategorieNutzung(id) {
  const buchungen = daten.buchungen.filter(function (b) { return b.kategorieId === id; }).length;
  const auftraege = daten.dauerauftraege.filter(function (d) { return d.kategorieId === id; }).length;
  return { buchungen: buchungen, auftraege: auftraege, gesamt: buchungen + auftraege };
}


// ============================================
// Bildschirm "Kategorien": Liste
// ============================================
function zeichneKategorienListe(bereich) {
  let html = "";

  [["ausgabe", "Ausgaben"], ["einnahme", "Einnahmen"]].forEach(function (gruppe) {
    const liste = daten.kategorien
      .filter(function (k) { return k.typ === gruppe[0]; })
      .sort(function (a, b) { return a.name.localeCompare(b.name, "de"); });

    html += '<h2 class="abschnitt">' + gruppe[1] + '</h2><div class="karte liste">';
    liste.forEach(function (k) {
      const n = kategorieNutzung(k.id).buchungen;
      html +=
        '<a class="zeile" href="#kategorie/' + k.id + '">' +
        '  <span class="zeile-text">' + schuetzeText(k.name) + "</span>" +
        '  <small class="leise">' + (n === 1 ? "1 Buchung" : n + " Buchungen") + "</small>" +
        '  <span class="pfeil">›</span>' +
        "</a>";
    });
    html += "</div>";
  });

  html += '<a class="knopf" href="#kategorie/neu">+ Neue Kategorie</a>';
  bereich.innerHTML = html;
}


// ============================================
// Bildschirm "Kategorie": anlegen oder umbenennen
// ============================================
function zeichneKategorie(bereich, id) {
  const istNeu = id === "neu";
  const kategorie = istNeu ? null : findeKategorie(id);

  if (!istNeu && !kategorie) {
    location.replace("#kategorien");
    return;
  }

  document.getElementById("titel").textContent = istNeu ? "Neue Kategorie" : "Kategorie bearbeiten";

  bereich.innerHTML =
    '<form id="kategorieFormular" class="karte" novalidate>' +
    (istNeu
      ? '<fieldset class="umschalter">' +
        "  <legend>Art</legend>" +
        '  <label><input type="radio" name="typ" value="ausgabe" checked><span>Ausgabe</span></label>' +
        '  <label><input type="radio" name="typ" value="einnahme"><span>Einnahme</span></label>' +
        "</fieldset>"
      : '<p class="leise">' + (kategorie.typ === "ausgabe" ? "Kategorie für Ausgaben" : "Kategorie für Einnahmen") + "</p>") +
    '  <label class="feld">Name' +
    '    <input id="kName" type="text" maxlength="30" autocomplete="off" value="' + schuetzeText(kategorie ? kategorie.name : "") +
         '" placeholder="z. B. Haustier">' +
    "  </label>" +
    '  <p id="fehler" class="fehler" hidden></p>' +
    '  <button type="submit" class="knopf">Speichern</button>' +
    '  <button type="button" id="abbrechen" class="knopf zweit">Abbrechen</button>' +
    "</form>" +
    (istNeu ? "" : '<button type="button" id="loeschen" class="knopf gefahr">Kategorie löschen</button>');

  const formular = document.getElementById("kategorieFormular");
  const fehler = document.getElementById("fehler");
  formular.addEventListener("input", function () { fehler.hidden = true; });

  formular.addEventListener("submit", function (ereignis) {
    ereignis.preventDefault();
    const name = document.getElementById("kName").value.trim();
    const typ = istNeu ? formular.querySelector('input[name="typ"]:checked').value : kategorie.typ;

    if (name === "") return zeigeFehler(fehler, "Bitte gib einen Namen ein.");
    const doppelt = daten.kategorien.some(function (k) {
      return k.typ === typ && k.name.toLowerCase() === name.toLowerCase() && (!kategorie || k.id !== kategorie.id);
    });
    if (doppelt) return zeigeFehler(fehler, "Diese Kategorie gibt es schon.");

    if (istNeu) {
      daten.kategorien.push({ id: neueId("kat"), name: name, typ: typ });
    } else {
      kategorie.name = name;
    }
    speichereDaten();
    zeigeMeldung("Kategorie gespeichert");
    zurueck("#kategorien");
  });

  document.getElementById("abbrechen").addEventListener("click", function () {
    zurueck("#kategorien");
  });

  if (!istNeu) {
    document.getElementById("loeschen").addEventListener("click", function () {
      const nutzung = kategorieNutzung(kategorie.id);
      if (nutzung.gesamt > 0) {
        alert("\"" + kategorie.name + "\" wird noch in " + nutzung.buchungen + " Buchungen und " +
          nutzung.auftraege + " Daueraufträgen verwendet und kann deshalb nicht gelöscht werden. Du kannst sie aber umbenennen.");
        return;
      }
      if (!confirm("Kategorie \"" + kategorie.name + "\" löschen?")) return;
      daten.kategorien = daten.kategorien.filter(function (k) { return k.id !== kategorie.id; });
      speichereDaten();
      zeigeMeldung("Kategorie gelöscht");
      zurueck("#kategorien");
    });
  }

  if (istNeu) document.getElementById("kName").focus();
}
