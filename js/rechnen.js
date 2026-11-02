// ============================================
// Alles, was die App ausrechnet.
//
// Grundregel: Kontostände werden nie gespeichert, sondern
// immer neu aus Startbetrag, Buchungen und Überträgen berechnet.
// So kann ein Stand nie "falsch" gespeichert sein.
// ============================================

// Aktueller Stand einer Kasse in Cent:
// Startbetrag + Einnahmen − Ausgaben + Überträge hinein − Überträge hinaus
function kontostand(kasse) {
  let stand = kasse.startbetrag || 0;

  daten.buchungen.forEach(function (b) {
    if (b.kasseId !== kasse.id) return;
    if (b.typ === "einnahme") stand += b.betrag;
    if (b.typ === "ausgabe") stand -= b.betrag;
  });

  daten.uebertraege.forEach(function (u) {
    if (u.nachKasseId === kasse.id) stand += u.betrag;
    if (u.vonKasseId === kasse.id) stand -= u.betrag;
  });

  return stand;
}

// Summe aller Kassen, die nicht archiviert sind
function gesamtstand() {
  return daten.kassen
    .filter(function (k) { return !k.archiviert; })
    .reduce(function (summe, k) { return summe + kontostand(k); }, 0);
}

// Verteilt 100 % möglichst gleich auf die Personen.
// Bei 3 Personen: 34, 33, 33 (der Rest geht an die ersten).
function gleicheProzente(personenIds) {
  const ergebnis = {};
  const anzahl = personenIds.length;
  if (anzahl === 0) return ergebnis;

  const grund = Math.floor(100 / anzahl);
  let rest = 100 - grund * anzahl;
  personenIds.forEach(function (id) {
    ergebnis[id] = grund + (rest > 0 ? 1 : 0);
    rest--;
  });
  return ergebnis;
}
