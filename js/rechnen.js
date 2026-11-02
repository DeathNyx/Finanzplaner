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

// Verteilt einen Betrag (in Cent) nach Gewichten auf Personen.
// Beispiel: 1000 Cent mit Gewichten 60 und 40 ergibt 600 und 400.
// Es geht dabei kein Cent verloren: Was beim Abrunden übrig bleibt,
// bekommen die Personen mit dem größten Rest (bei Gleichstand die erste).
// Ohne Gewichte wird gleich verteilt.
function verteile(betrag, personenIds, gewichte) {
  const ergebnis = {};
  if (personenIds.length === 0) return ergebnis;

  let summeGewichte = 0;
  personenIds.forEach(function (id) { summeGewichte += (gewichte && gewichte[id]) || 0; });

  // Keine brauchbaren Gewichte: alle gleich
  const gewicht = function (id) {
    return summeGewichte > 0 ? (gewichte[id] || 0) : 1;
  };
  const gesamt = summeGewichte > 0 ? summeGewichte : personenIds.length;

  let verteilt = 0;
  const reste = [];
  personenIds.forEach(function (id, nummer) {
    const genau = betrag * gewicht(id) / gesamt;
    const ganz = Math.floor(genau);
    ergebnis[id] = ganz;
    verteilt += ganz;
    reste.push({ id: id, rest: genau - ganz, nummer: nummer });
  });

  // Übrige Cent verteilen
  reste.sort(function (a, b) { return (b.rest - a.rest) || (a.nummer - b.nummer); });
  let uebrig = betrag - verteilt;
  for (let i = 0; uebrig > 0; i++, uebrig--) {
    ergebnis[reste[i % reste.length].id]++;
  }
  return ergebnis;
}

// Die Gewichte, die eine Kasse für neue Buchungen vorschlägt:
// bei Prozent die Prozente, sonst alle gleich
function regelGewichte(kasse) {
  const a = kasse.aufteilung;
  if (a && a.art === "prozent") return Object.assign({}, a.prozente);
  const gleich = {};
  kasse.personen.forEach(function (id) { gleich[id] = 1; });
  return gleich;
}

// Einnahmen und Ausgaben einer Kasse in einem Monat ("2026-11")
function monatsSummen(kasseId, monat) {
  const summen = { einnahmen: 0, ausgaben: 0 };
  daten.buchungen.forEach(function (b) {
    if (b.kasseId !== kasseId || !b.datum.startsWith(monat)) return;
    if (b.typ === "einnahme") summen.einnahmen += b.betrag;
    if (b.typ === "ausgabe") summen.ausgaben += b.betrag;
  });
  return summen;
}
