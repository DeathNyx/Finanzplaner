// ============================================
// Bildschirm "Abgleich": gemeinsamer Haushalt mit der Partnerin.
//
// Drei Zustände:
//   1. nicht angemeldet:           Anmelden mit Google
//   2. angemeldet, ohne Haushalt:  Haushalt anlegen oder beitreten
//   3. im Haushalt:                Mitglieder, Einladung erstellen, verlassen
//
// Diese Datei ist ein "Modul" (type="module"). Sie trägt den
// Bildschirm selbst in die Liste der Bildschirme ein.
// ============================================

import * as cloud from "./cloud.js";
import { PASSWORT_MINDESTLAENGE } from "./verschluesselung.js";

// Zählt die Zeichenvorgänge, damit ein alter, noch ladender Vorgang
// nicht über einen neueren drüberzeichnet
let zeichnung = 0;

// Ist der Abgleich Bildschirm (noch) zu sehen?
function nochDa(nummer) {
  return nummer === zeichnung && location.hash.startsWith("#abgleich");
}

// Knopf während einer Aktion sperren und Text ändern
function beschaeftigt(knopf, text) {
  knopf.dataset.text = knopf.textContent;
  knopf.textContent = text;
  knopf.disabled = true;
}

function wiederFrei(knopf) {
  knopf.textContent = knopf.dataset.text;
  knopf.disabled = false;
}

// Kopfkarte mit dem angemeldeten Nutzer
function nutzerKarte(u) {
  return (
    '<div class="karte abgleich-nutzer">' +
    '  <span class="zeile-text zweizeilig"><small class="leise">Angemeldet als</small><span>' + schuetzeText(cloud.anzeigeName(u)) + "</span></span>" +
    '  <button type="button" id="abmelden" class="link-knopf">Abmelden</button>' +
    "</div>"
  );
}

// Passwortfelder mit "anzeigen" Häkchen
function passwortFeld(id, beschriftung, art) {
  return (
    '<label class="feld">' + beschriftung +
    '  <input id="' + id + '" type="password" autocomplete="' + art + '" autocapitalize="off" spellcheck="false">' +
    "</label>"
  );
}

// Alle Passwortfelder eines Formulars sichtbar oder unsichtbar machen
function anzeigenUmschalten(formular, haken) {
  haken.addEventListener("change", function () {
    formular.querySelectorAll('input[type="password"], input[data-passwort]').forEach(function (feld) {
      feld.dataset.passwort = "1";
      feld.type = haken.checked ? "text" : "password";
    });
  });
}


// ============================================
// Der Bildschirm
// ============================================
async function zeichneAbgleich(bereich) {
  const nummer = ++zeichnung;
  bereich.innerHTML = platzhalter("Verbindung wird hergestellt …");

  try {
    await cloud.laden();
  } catch (fehler) {
    if (!nochDa(nummer)) return;
    bereich.innerHTML =
      '<div class="karte warnung">Keine Verbindung zum Abgleich. Bist du online? Die App funktioniert trotzdem ganz normal.</div>' +
      '<button type="button" id="nochmal" class="knopf">Erneut versuchen</button>';
    document.getElementById("nochmal").addEventListener("click", function () { zeichneAbgleich(bereich); });
    return;
  }
  if (!nochDa(nummer)) return;

  const u = cloud.nutzer();
  if (!u) return zeichneAnmelden(bereich);
  if (!cloud.lokalerHaushalt()) return zeichneOhneHaushalt(bereich, u);
  return zeichneImHaushalt(bereich, u, nummer);
}

// ---------- 1. Nicht angemeldet ----------
function zeichneAnmelden(bereich) {
  bereich.innerHTML =
    '<div class="karte">' +
    "  <h2>Gemeinsam nutzen</h2>" +
    "  <p>Mit dem Abgleich nutzt ihr den Finanzplaner zu zweit auf zwei Handys. Was eine von euch bucht, sieht die andere.</p>" +
    '  <ul class="schritte">' +
    "    <li>Ihr meldet euch beide mit eurem Google Konto an.</li>" +
    "    <li>Eine Person legt einen Haushalt an, die andere tritt mit einem Einladungscode bei.</li>" +
    "    <li>Alles wird mit eurem Haushalts Passwort verschlüsselt. In der Cloud liegt nur Zeichensalat.</li>" +
    "  </ul>" +
    '  <p id="fehler" class="fehler" hidden></p>' +
    '  <button type="button" id="anmelden" class="knopf">Mit Google anmelden</button>' +
    "</div>";

  const knopf = document.getElementById("anmelden");
  knopf.addEventListener("click", async function () {
    beschaeftigt(knopf, "Anmeldung läuft …");
    try {
      await cloud.anmelden();
      zeichneAbgleich(bereich);
    } catch (fehler) {
      zeigeFehler(document.getElementById("fehler"), cloud.fehlerText(fehler));
      wiederFrei(knopf);
    }
  });
}

// ---------- 2. Angemeldet, noch kein Haushalt ----------
function zeichneOhneHaushalt(bereich, u) {
  bereich.innerHTML =
    nutzerKarte(u) +

    '<form id="anlegenFormular" class="karte" novalidate>' +
    "  <h2>Haushalt anlegen</h2>" +
    '  <p class="leise">Für die erste Person. Danach kannst du deine Partnerin einladen.</p>' +
    passwortFeld("pw1", "Haushalts Passwort (mindestens " + PASSWORT_MINDESTLAENGE + " Zeichen)", "new-password") +
    passwortFeld("pw2", "Passwort wiederholen", "new-password") +
    '  <label class="schalter"><input type="checkbox" id="anzeigen1"><span>Passwort anzeigen</span></label>' +
    '  <div class="karte warnung klein">' +
    "    <strong>Wichtig:</strong> Mit diesem Passwort werden alle Daten verschlüsselt. Es lässt sich <strong>nicht wiederherstellen</strong>. " +
    "    Schreib es auf und bewahre es sicher auf. Deine Partnerin braucht es zum Beitreten." +
    "  </div>" +
    '  <label class="schalter"><input type="checkbox" id="notiert"><span>Ich habe das Passwort sicher notiert</span></label>' +
    '  <p id="fehlerAnlegen" class="fehler" hidden></p>' +
    '  <button type="submit" class="knopf">Haushalt anlegen</button>' +
    "</form>" +

    '<form id="beitretenFormular" class="karte" novalidate>' +
    "  <h2>Haushalt beitreten</h2>" +
    '  <p class="leise">Für die zweite Person: mit dem Einladungscode und dem Haushalts Passwort.</p>' +
    '  <label class="feld">Einladungscode' +
    '    <input id="code" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="z. B. 7Q4M-K2XP">' +
    "  </label>" +
    passwortFeld("pw3", "Haushalts Passwort", "current-password") +
    '  <label class="schalter"><input type="checkbox" id="anzeigen2"><span>Passwort anzeigen</span></label>' +
    '  <p id="fehlerBeitreten" class="fehler" hidden></p>' +
    '  <button type="submit" class="knopf zweit">Haushalt beitreten</button>' +
    "</form>";

  verbindeAbmelden(bereich);

  const anlegen = document.getElementById("anlegenFormular");
  const beitreten = document.getElementById("beitretenFormular");
  anzeigenUmschalten(anlegen, document.getElementById("anzeigen1"));
  anzeigenUmschalten(beitreten, document.getElementById("anzeigen2"));

  // Haushalt anlegen
  anlegen.addEventListener("submit", async function (ereignis) {
    ereignis.preventDefault();
    const fehler = document.getElementById("fehlerAnlegen");
    fehler.hidden = true;
    const pw1 = document.getElementById("pw1").value;
    const pw2 = document.getElementById("pw2").value;

    if (pw1.length < PASSWORT_MINDESTLAENGE) return zeigeFehler(fehler, "Das Passwort muss mindestens " + PASSWORT_MINDESTLAENGE + " Zeichen lang sein. Tipp: mehrere Wörter, z. B. „Sonne Kasse Fahrrad 7“.");
    if (pw1 !== pw2) return zeigeFehler(fehler, "Die beiden Passwörter sind nicht gleich.");
    if (!document.getElementById("notiert").checked) return zeigeFehler(fehler, "Bitte bestätige, dass du das Passwort sicher notiert hast.");

    const knopf = anlegen.querySelector('button[type="submit"]');
    beschaeftigt(knopf, "Haushalt wird angelegt …");
    try {
      await cloud.haushaltAnlegen(pw1);
      zeigeMeldung("Haushalt angelegt");
      zeichneAbgleich(bereich);
    } catch (f) {
      zeigeFehler(fehler, cloud.fehlerText(f));
      wiederFrei(knopf);
    }
  });

  // Haushalt beitreten
  beitreten.addEventListener("submit", async function (ereignis) {
    ereignis.preventDefault();
    const fehler = document.getElementById("fehlerBeitreten");
    fehler.hidden = true;
    const knopf = beitreten.querySelector('button[type="submit"]');
    beschaeftigt(knopf, "Wird geprüft …");
    try {
      await cloud.beitreten(document.getElementById("code").value, document.getElementById("pw3").value);
      zeigeMeldung("Haushalt beigetreten");
      zeichneAbgleich(bereich);
    } catch (f) {
      zeigeFehler(fehler, cloud.fehlerText(f));
      wiederFrei(knopf);
    }
  });
}

// ---------- 3. Im Haushalt ----------
async function zeichneImHaushalt(bereich, u, nummer) {
  bereich.innerHTML = nutzerKarte(u) + platzhalter("Haushalt wird geladen …");
  verbindeAbmelden(bereich);

  let info;
  try {
    info = await cloud.haushaltInfo();
  } catch (fehler) {
    if (!nochDa(nummer)) return;
    bereich.innerHTML = nutzerKarte(u) +
      '<div class="karte warnung">' + schuetzeText(cloud.fehlerText(fehler)) + "</div>" +
      '<button type="button" id="nochmal" class="knopf">Erneut versuchen</button>';
    verbindeAbmelden(bereich);
    document.getElementById("nochmal").addEventListener("click", function () { zeichneAbgleich(bereich); });
    return;
  }
  if (!nochDa(nummer)) return;

  // Haushalt gibt es nicht mehr, oder man ist mit einem anderen Konto angemeldet
  if (info.zustand === "nichtGefunden") {
    bereich.innerHTML = nutzerKarte(u) +
      '<div class="karte warnung">Dieses Handy ist mit einem Haushalt verbunden, zu dem dein Google Konto nicht (mehr) gehört. ' +
      "Bist du mit dem richtigen Konto angemeldet?</div>" +
      '<button type="button" id="loesen" class="knopf gefahr">Verbindung auf diesem Handy lösen</button>';
    verbindeAbmelden(bereich);
    document.getElementById("loesen").addEventListener("click", async function () {
      if (!confirm("Verbindung zum Haushalt auf diesem Handy lösen? Deine Daten auf dem Handy bleiben erhalten.")) return;
      await cloud.verbindungLoesen();
      zeichneAbgleich(bereich);
    });
    return;
  }

  // Das Handy kennt den Schlüssel nicht mehr: Passwort neu eingeben
  if (info.zustand === "schluesselFehlt") {
    bereich.innerHTML = nutzerKarte(u) +
      '<form id="pwFormular" class="karte" novalidate>' +
      "  <h2>Passwort eingeben</h2>" +
      '  <p class="leise">Dieses Handy kennt das Haushalts Passwort nicht mehr. Bitte gib es noch einmal ein.</p>' +
      passwortFeld("pw4", "Haushalts Passwort", "current-password") +
      '  <p id="fehler" class="fehler" hidden></p>' +
      '  <button type="submit" class="knopf">Bestätigen</button>' +
      "</form>";
    verbindeAbmelden(bereich);
    const formular = document.getElementById("pwFormular");
    formular.addEventListener("submit", async function (ereignis) {
      ereignis.preventDefault();
      const knopf = formular.querySelector('button[type="submit"]');
      beschaeftigt(knopf, "Wird geprüft …");
      try {
        await cloud.passwortErneutEingeben(document.getElementById("pw4").value);
        zeichneAbgleich(bereich);
      } catch (f) {
        zeigeFehler(document.getElementById("fehler"), cloud.fehlerText(f));
        wiederFrei(knopf);
      }
    });
    return;
  }

  // Alles in Ordnung
  bereich.innerHTML =
    nutzerKarte(u) +
    '<div class="karte">' +
    "  <h2>☁️ Haushalt verbunden ✓</h2>" +
    "  <p>" + (info.anzahl === 1 ? "Mitglied" : "Mitglieder") + ": <strong>" + schuetzeText(info.namen.join(", ")) + "</strong></p>" +
    '  <p class="leise klein">Der Abgleich der Buchungen kommt im nächsten Schritt. Bis dahin bleiben deine Daten nur auf diesem Handy.</p>' +
    "</div>" +

    '<div class="karte">' +
    "  <h2>Partnerin einladen</h2>" +
    '  <p class="leise">Erstelle einen Einladungscode und schick ihn ihr. Das Passwort sagst du ihr am besten persönlich und nicht im selben Chat.</p>' +
    '  <div id="einladung"></div>' +
    '  <p id="fehlerEinladung" class="fehler" hidden></p>' +
    '  <button type="button" id="einladen" class="knopf">Einladung erstellen</button>' +
    "</div>" +

    '<button type="button" id="verlassen" class="knopf gefahr">Haushalt verlassen</button>' +
    '<p class="leise klein">Beim Verlassen bleiben deine Daten auf diesem Handy erhalten. Nur der Abgleich endet.</p>';

  verbindeAbmelden(bereich);

  // Einladung erstellen
  const knopfEinladen = document.getElementById("einladen");
  knopfEinladen.addEventListener("click", async function () {
    const fehler = document.getElementById("fehlerEinladung");
    fehler.hidden = true;
    beschaeftigt(knopfEinladen, "Einladung wird erstellt …");
    try {
      const e = await cloud.einladungErstellen();
      const bis = formatDatum(isoDatum(e.gueltigBis));
      document.getElementById("einladung").innerHTML =
        '<p class="einladungscode">' + schuetzeText(e.code) + "</p>" +
        '<p class="leise klein">Gültig bis ' + bis + ".</p>" +
        '<button type="button" id="teilen" class="knopf zweit">Code teilen</button>';
      document.getElementById("teilen").addEventListener("click", function () {
        const text = "Tritt meinem Finanzplaner Haushalt bei. Einladungscode: " + e.code + " (gültig bis " + bis + "). " +
          "App öffnen: https://deathnyx.github.io/Finanzplaner/ und dann Mehr › Abgleich › Haushalt beitreten. Das Passwort sage ich dir persönlich.";
        if (navigator.share) {
          navigator.share({ title: "Finanzplaner Einladung", text: text }).catch(function () { /* abgebrochen */ });
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function () { zeigeMeldung("Text kopiert"); });
        }
      });
      knopfEinladen.dataset.text = "Neue Einladung erstellen";
    } catch (f) {
      zeigeFehler(fehler, cloud.fehlerText(f));
    }
    wiederFrei(knopfEinladen);
  });

  // Haushalt verlassen
  document.getElementById("verlassen").addEventListener("click", async function () {
    const letzte = info.anzahl === 1;
    const frage = letzte
      ? "Du bist das einzige Mitglied. Wenn du den Haushalt verlässt, kann niemand mehr darauf zugreifen. Wirklich verlassen? Deine Daten auf diesem Handy bleiben erhalten."
      : "Haushalt wirklich verlassen? Deine Daten auf diesem Handy bleiben erhalten, aber der Abgleich endet.";
    if (!confirm(frage)) return;
    const knopf = this;
    beschaeftigt(knopf, "Wird verlassen …");
    try {
      await cloud.haushaltVerlassen();
      zeigeMeldung("Haushalt verlassen");
      zeichneAbgleich(bereich);
    } catch (f) {
      alert(cloud.fehlerText(f));
      wiederFrei(knopf);
    }
  });
}

// Knopf "Abmelden" in der Nutzerkarte
function verbindeAbmelden(bereich) {
  const knopf = document.getElementById("abmelden");
  if (!knopf) return;
  knopf.addEventListener("click", async function () {
    await cloud.abmelden();
    zeigeMeldung("Abgemeldet");
    zeichneAbgleich(bereich);
  });
}


// ============================================
// Bildschirm in die Liste eintragen
// ============================================
bildschirme.abgleich = {
  titel: "Abgleich",
  tab: "mehr",
  zeichne: zeichneAbgleich
};

// Wurde die App direkt mit #abgleich geöffnet, jetzt richtig anzeigen
if (location.hash.startsWith("#abgleich")) zeigeBildschirm();
