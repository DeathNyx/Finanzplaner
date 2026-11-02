// ============================================
// Deutsches Format für Beträge und Datum.
//
// Wichtig: Intern speichern wir Beträge in Cent (ganze Zahlen)
// und Datum als "JJJJ-MM-TT". Nur für die Anzeige wandeln
// wir in "1.234,56 €" und "TT.MM.JJJJ" um.
// ============================================

// Werkzeug des Browsers, das Euro Beträge deutsch formatiert
const euroFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR"
});

// Cent in Euro Text umwandeln: 123456 wird zu "1.234,56 €".
// Negative Beträge bekommen ein echtes Minuszeichen (−), das ist besser lesbar.
function formatEuro(cent) {
  return euroFormat.format((cent || 0) / 100).replace("-", "−");
}

// Cent als Text für ein Eingabefeld: 123456 wird zu "1234,56".
// Ohne Tausenderpunkte und ohne €, damit man es leicht ändern kann.
function betragFuerEingabe(cent) {
  return ((cent || 0) / 100).toFixed(2).replace(".", ",");
}

// Eingabe des Nutzers in Cent umwandeln.
// Erlaubt z. B. "1.234,56", "12,5", "12.50", "7", "-3,20", "5 €".
// Gibt null zurück, wenn die Eingabe keine gültige Zahl ist.
function leseBetrag(text) {
  if (text === undefined || text === null) return null;

  // Leerzeichen und Euro Zeichen entfernen, langes Minus wie kurzes behandeln
  let t = String(text).replace(/[\s€]/g, "").replace("−", "-");
  if (t === "") return null;

  if (t.includes(",")) {
    // Deutsches Format: Punkte sind Tausender, Komma ist das Dezimalzeichen
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (!/^-?\d+\.\d{1,2}$/.test(t)) {
    // Kein Komma: Ein Punkt mit 1 oder 2 Stellen danach ("12.50") gilt als
    // Dezimalpunkt. Sonst sind Punkte Tausender ("1.234") und fliegen raus.
    t = t.replace(/\./g, "");
  }

  // Jetzt darf nur noch eine normale Zahl übrig sein
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;

  // In Cent umrechnen und runden, damit keine Kommafehler entstehen
  return Math.round(parseFloat(t) * 100);
}

// Interne Schreibweise in deutsches Datum: "2026-11-02" wird zu "02.11.2026"
function formatDatum(iso) {
  if (!iso) return "";
  const [jahr, monat, tag] = iso.split("-");
  return tag + "." + monat + "." + jahr;
}

// Deutsches Datum in interne Schreibweise: "2.11.2026" wird zu "2026-11-02".
// Gibt null zurück, wenn es das Datum nicht gibt (z. B. 31.02.2026).
function leseDatum(text) {
  const treffer = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(text).trim());
  if (!treffer) return null;

  const tag = Number(treffer[1]);
  const monat = Number(treffer[2]);
  const jahr = Number(treffer[3]);

  // Prüfen, ob es den Tag wirklich gibt
  const probe = new Date(jahr, monat - 1, tag);
  if (probe.getFullYear() !== jahr || probe.getMonth() !== monat - 1 || probe.getDate() !== tag) {
    return null;
  }
  return isoDatum(probe);
}

// Ein Datum Objekt in "JJJJ-MM-TT" umwandeln (nach deutscher Ortszeit)
function isoDatum(datum) {
  const j = datum.getFullYear();
  const m = String(datum.getMonth() + 1).padStart(2, "0");
  const t = String(datum.getDate()).padStart(2, "0");
  return j + "-" + m + "-" + t;
}

// Das heutige Datum als "JJJJ-MM-TT"
function heute() {
  return isoDatum(new Date());
}

// Monatsname: "2026-11" wird zu "November 2026"
function formatMonat(jahrMonat) {
  const [jahr, monat] = jahrMonat.split("-").map(Number);
  return new Date(jahr, monat - 1, 1).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric"
  });
}

// Text sicher machen, bevor er in die Seite eingesetzt wird.
// So kann ein Name wie "<b>Anna</b>" die Seite nicht durcheinanderbringen.
function schuetzeText(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Monat verschieben: ("2026-11", -1) ergibt "2026-10", ("2026-12", 1) ergibt "2027-01"
function verschiebeMonat(jahrMonat, schritte) {
  const [jahr, monat] = jahrMonat.split("-").map(Number);
  const datum = new Date(jahr, monat - 1 + schritte, 1);
  return isoDatum(datum).slice(0, 7);
}
