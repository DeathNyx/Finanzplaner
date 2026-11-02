// ============================================
// Die App auf dem Handy installieren (PWA) und
// den Speicher dauerhaft machen.
// ============================================

// Android und Chrome bieten das Installieren über ein Ereignis an.
// Wir merken es uns, um es später per Knopf auszulösen.
let installAngebot = null;

window.addEventListener("beforeinstallprompt", function (ereignis) {
  // Den automatischen Hinweis des Browsers unterdrücken, wir haben einen eigenen Knopf
  ereignis.preventDefault();
  installAngebot = ereignis;
});

window.addEventListener("appinstalled", function () {
  installAngebot = null;
  zeigeMeldung("App wurde installiert");
});

// Läuft die App gerade installiert (ohne Browserleiste)?
function laeuftAlsApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// Ist das ein iPhone oder iPad?
function istApple() {
  const ua = navigator.userAgent;
  // Neuere iPads geben sich als Mac aus, haben aber einen Touchscreen
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

// Den Browser bitten, die Daten dauerhaft zu behalten
// (sonst darf er sie bei knappem Speicher selbst löschen).
// Gibt ein Versprechen mit true oder false zurück.
function speicherDauerhaftMachen() {
  if (!navigator.storage || !navigator.storage.persist) return Promise.resolve(false);
  return navigator.storage.persisted().then(function (schon) {
    return schon ? true : navigator.storage.persist();
  }).catch(function () { return false; });
}

// Service Worker starten (für den Offline Betrieb).
// Funktioniert nur über https oder auf dem eigenen Rechner (localhost).
function starteServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;
  navigator.serviceWorker.register("sw.js").catch(function () {
    // Ohne Service Worker läuft die App trotzdem, nur nicht offline
  });
}


// ============================================
// Bildschirm "App installieren"
// ============================================
function zeichneInstallieren(bereich) {
  let html = "";

  if (laeuftAlsApp()) {
    html +=
      '<div class="karte">' +
      "  <h2>Läuft als App ✓</h2>" +
      '  <p class="leise">Der Finanzplaner ist installiert und funktioniert auch ohne Internet.</p>' +
      "</div>";
  } else if (istApple()) {
    html +=
      '<div class="karte">' +
      "  <h2>Auf dem iPhone installieren</h2>" +
      '  <ol class="schritte">' +
      "    <li>Öffne diese Seite in <strong>Safari</strong>.</li>" +
      "    <li>Tippe unten auf das <strong>Teilen Symbol</strong> (Quadrat mit Pfeil nach oben).</li>" +
      "    <li>Wähle <strong>„Zum Home-Bildschirm“</strong>. Falls du es nicht siehst, ganz nach unten scrollen.</li>" +
      "    <li>Tippe oben rechts auf <strong>„Hinzufügen“</strong>.</li>" +
      "  </ol>" +
      "</div>" +
      '<div class="karte warnung">' +
      "  <h2>Wichtig: Daten mitnehmen</h2>" +
      "  <p>Auf dem iPhone hat die installierte App einen eigenen Speicher. Deine Daten aus Safari sind dort nicht automatisch drin.</p>" +
      '  <ol class="schritte">' +
      '    <li>Hier in Safari: <a href="#backup">Backup speichern</a></li>' +
      "    <li>Die App vom Home-Bildschirm öffnen</li>" +
      "    <li>Dort: Mehr › Backup › Backup Datei auswählen</li>" +
      "  </ol>" +
      "  <p>Danach nur noch die App benutzen, nicht mehr Safari.</p>" +
      "</div>";
  } else {
    html +=
      '<div class="karte">' +
      "  <h2>Auf dem Handy installieren</h2>" +
      '  <p class="leise">Dann liegt der Finanzplaner mit eigenem Symbol auf deinem Startbildschirm, startet ohne Browserleiste und funktioniert auch ohne Internet. Deine Daten bleiben dabei erhalten.</p>' +
      (installAngebot
        ? '  <button type="button" id="installieren" class="knopf">App installieren</button>'
        : '  <p>Öffne das Menü deines Browsers (meist <strong>⋮</strong> oben rechts) und wähle <strong>„App installieren“</strong> oder <strong>„Zum Startbildschirm hinzufügen“</strong>.</p>') +
      "</div>";
  }

  // Speicherstatus
  html +=
    '<div class="karte">' +
    "  <h2>Dauerhafter Speicher</h2>" +
    '  <p id="speicherStatus" class="leise">Wird geprüft …</p>' +
    "</div>";

  bereich.innerHTML = html;

  const knopf = document.getElementById("installieren");
  if (knopf) {
    knopf.addEventListener("click", function () {
      if (!installAngebot) return;
      installAngebot.prompt();
      installAngebot.userChoice.then(function () {
        installAngebot = null;
        zeichneInstallieren(bereich);
      });
    });
  }

  // Speicher dauerhaft machen und Ergebnis anzeigen
  speicherDauerhaftMachen().then(function (dauerhaft) {
    const status = document.getElementById("speicherStatus");
    if (!status) return;
    status.textContent = dauerhaft
      ? "✓ Der Browser behält deine Daten dauerhaft und löscht sie nicht von selbst."
      : "Der Browser hat keinen dauerhaften Speicher zugesagt. Das ist normal, solange die App nicht installiert ist. Mach trotzdem regelmäßig ein Backup.";
  });
}
