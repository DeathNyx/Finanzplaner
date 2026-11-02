// ============================================
// Start der App und Navigation zwischen den Bildschirmen.
//
// So funktioniert es:
// Jeder Knopf unten ändert die Adresse, z. B. auf "#kassen".
// Die App merkt das und zeigt den passenden Bildschirm an.
// Dadurch funktioniert auch der Zurück Knopf am Handy.
// ============================================

// Liste aller Bildschirme: Titel und vorläufiger Inhalt.
// Später ersetzen wir die Platzhalter durch echte Inhalte.
const bildschirme = {
  uebersicht: {
    titel: "Übersicht",
    inhalt: "Hier siehst du bald alle Kassen und dein Gesamtvermögen."
  },
  kassen: {
    titel: "Kassen",
    inhalt: "Hier kannst du bald Kassen anlegen und bearbeiten."
  },
  buchen: {
    titel: "Buchen",
    inhalt: "Hier erfasst du bald Ausgaben, Einnahmen und Überträge."
  },
  monat: {
    titel: "Monat",
    inhalt: "Hier siehst du bald, was am Monatsende übrig bleibt."
  },
  mehr: {
    titel: "Mehr",
    inhalt: "Hier findest du bald Personen, Kategorien, Daueraufträge, Schulden und Backup."
  }
};

// Welcher Bildschirm angezeigt wird, wenn nichts in der Adresse steht
const startBildschirm = "uebersicht";

// Zeigt den Bildschirm an, der gerade in der Adresse steht
function zeigeBildschirm() {
  // "#kassen" wird zu "kassen"
  let name = location.hash.replace("#", "");

  // Unbekannte oder leere Adresse: zur Übersicht
  if (!bildschirme[name]) {
    name = startBildschirm;
  }

  const bildschirm = bildschirme[name];

  // Titel oben und im Browser Tab setzen
  document.getElementById("titel").textContent = bildschirm.titel;
  document.title = bildschirm.titel + " · Finanzplaner";

  // Inhalt einsetzen
  document.getElementById("inhalt").innerHTML =
    '<div class="karte"><p class="leise">' + bildschirm.inhalt + "</p></div>";

  // Den passenden Knopf unten farbig markieren
  document.querySelectorAll(".navi a").forEach(function (knopf) {
    knopf.classList.toggle("aktiv", knopf.dataset.ziel === name);
  });

  // Nach oben scrollen, wenn man den Bildschirm wechselt
  window.scrollTo(0, 0);
}

// Bei jeder Änderung der Adresse den Bildschirm neu anzeigen
window.addEventListener("hashchange", zeigeBildschirm);

// Beim ersten Öffnen der Seite einmal anzeigen
zeigeBildschirm();
