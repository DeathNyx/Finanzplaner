// ============================================
// Bildschirme rund um Personen: Liste und Formular.
// ============================================

// ============================================
// Bildschirm "Personen": Liste aller Personen
// ============================================
function zeichnePersonen(bereich) {
  let html = "";

  if (daten.personen.length === 0) {
    html += platzhalter("Noch keine Personen. Lege zuerst dich selbst an, danach zum Beispiel deine Partnerin.");
  } else {
    html += '<div class="liste karte">';
    daten.personen.forEach(function (person) {
      html +=
        '<a class="zeile" href="#person/' + person.id + '">' +
        farbpunkt(person.farbe) +
        '<span class="zeile-text">' + schuetzeText(person.name) + "</span>" +
        '<span class="pfeil">›</span>' +
        "</a>";
    });
    html += "</div>";
  }

  html += '<a class="knopf" href="#person/neu">+ Person hinzufügen</a>';
  bereich.innerHTML = html;
}


// ============================================
// Bildschirm "Person": anlegen oder bearbeiten
// "id" ist entweder "neu" oder die ID einer Person
// ============================================
function zeichnePerson(bereich, id) {
  const istNeu = id === "neu";
  const person = istNeu ? null : findePerson(id);

  // Person nicht gefunden (z. B. gelöscht): zurück zur Liste
  if (!istNeu && !person) {
    location.replace("#personen");
    return;
  }

  // Titel oben passend setzen
  document.getElementById("titel").textContent = istNeu ? "Neue Person" : "Person bearbeiten";

  const name = person ? person.name : "";
  const farbe = person ? person.farbe : freieFarbe(daten.personen);

  bereich.innerHTML =
    '<form id="personFormular" class="karte" novalidate>' +
    '  <label class="feld">Name' +
    '    <input id="personName" type="text" maxlength="30" autocomplete="off" value="' + schuetzeText(name) + '" placeholder="z. B. Ich oder Partnerin">' +
    "  </label>" +
    '  <p id="fehler" class="fehler" hidden></p>' +
    farbauswahl(farbe) +
    '  <button type="submit" class="knopf">Speichern</button>' +
    '  <button type="button" id="abbrechen" class="knopf zweit">Abbrechen</button>' +
    "</form>" +
    (istNeu ? "" : '<button type="button" id="loeschen" class="knopf gefahr">Person löschen</button>');

  const formular = document.getElementById("personFormular");
  const feldName = document.getElementById("personName");
  const fehler = document.getElementById("fehler");

  // Sobald man etwas ändert, verschwindet eine alte Fehlermeldung
  formular.addEventListener("input", function () { fehler.hidden = true; });

  // Bei einer neuen Person gleich ins Namensfeld springen
  if (istNeu) feldName.focus();

  // Speichern
  formular.addEventListener("submit", function (ereignis) {
    // Verhindert, dass der Browser die Seite neu lädt
    ereignis.preventDefault();

    const neuerName = feldName.value.trim();
    const gewaehlteFarbe = formular.querySelector('input[name="farbe"]:checked').value;

    // Prüfen: Name darf nicht leer sein
    if (neuerName === "") {
      zeigeFehler(fehler, "Bitte gib einen Namen ein.");
      feldName.focus();
      return;
    }

    // Prüfen: Name darf nicht doppelt vorkommen
    const doppelt = daten.personen.some(function (p) {
      return p.name.toLowerCase() === neuerName.toLowerCase() && (!person || p.id !== person.id);
    });
    if (doppelt) {
      zeigeFehler(fehler, "Es gibt schon eine Person mit diesem Namen.");
      feldName.focus();
      return;
    }

    if (istNeu) {
      daten.personen.push({ id: neueId("per"), name: neuerName, farbe: gewaehlteFarbe });
    } else {
      // Nur Name und Farbe ändern. Die ID bleibt gleich,
      // deshalb passen alle Kassen und Buchungen weiterhin.
      person.name = neuerName;
      person.farbe = gewaehlteFarbe;
    }

    speichereDaten();
    // Zurück zur Liste. So landet man mit dem Zurück Knopf
    // später nicht wieder im Formular.
    zurueck("#personen");
  });

  // Abbrechen: einfach einen Schritt zurück
  document.getElementById("abbrechen").addEventListener("click", function () {
    zurueck("#personen");
  });

  // Löschen (nur bei bestehenden Personen)
  if (!istNeu) {
    document.getElementById("loeschen").addEventListener("click", function () {
      // Personen, die noch irgendwo vorkommen, dürfen nicht gelöscht werden.
      // Sonst wüssten alte Buchungen nicht mehr, wer bezahlt hat.
      if (personWirdVerwendet(person.id)) {
        alert(person.name + " gehört noch zu einer Kasse oder kommt in Buchungen vor und kann deshalb nicht gelöscht werden.");
        return;
      }
      if (!confirm(person.name + " wirklich löschen?")) return;

      daten.personen = daten.personen.filter(function (p) { return p.id !== person.id; });
      speichereDaten();
      zurueck("#personen");
    });
  }
}
