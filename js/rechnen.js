// ============================================
// Alles, was die App ausrechnet.
//
// Grundregel: Kontostände werden nie gespeichert, sondern
// immer neu aus Startbetrag, Buchungen und Überträgen berechnet.
// So kann ein Stand nie "falsch" gespeichert sein.
// ============================================

// Wurde eine Ausgabe privat von einer Person bezahlt (nicht aus der Kasse)?
// Dann ändert sie den Kassenstand nicht, zählt aber als Beitrag dieser Person.
function privatBezahlt(b) {
  return b.typ === "ausgabe" && !!b.bezahltVon;
}

// Aktueller Stand einer Kasse in Cent:
// Startbetrag + Einnahmen − Ausgaben aus der Kasse + Überträge hinein − Überträge hinaus
function kontostand(kasse) {
  let stand = kasse.startbetrag || 0;

  daten.buchungen.forEach(function (b) {
    if (b.kasseId !== kasse.id) return;
    if (b.typ === "einnahme") stand += b.betrag;
    if (b.typ === "ausgabe" && !privatBezahlt(b)) stand -= b.betrag;
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

  // Negative Beträge: wie positive verteilen und dann umdrehen
  if (betrag < 0) {
    const positiv = verteile(-betrag, personenIds, gewichte);
    personenIds.forEach(function (id) { ergebnis[id] = -positiv[id]; });
    return ergebnis;
  }

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

// Einnahmen, Ausgaben und Überträge einer Kasse in einem Monat ("2026-11")
function monatsSummen(kasseId, monat) {
  const summen = { einnahmen: 0, ausgaben: 0, privat: 0, uebertraege: 0 };
  daten.buchungen.forEach(function (b) {
    if (b.kasseId !== kasseId || !b.datum.startsWith(monat)) return;
    if (b.typ === "einnahme") summen.einnahmen += b.betrag;
    if (b.typ === "ausgabe") summen.ausgaben += b.betrag;
    // Privat bezahlte Ausgaben verringern den Kassenstand nicht
    if (privatBezahlt(b)) summen.privat += b.betrag;
  });
  // Überträge: hinein zählt plus, hinaus zählt minus
  daten.uebertraege.forEach(function (u) {
    if (!u.datum.startsWith(monat)) return;
    if (u.nachKasseId === kasseId) summen.uebertraege += u.betrag;
    if (u.vonKasseId === kasseId) summen.uebertraege -= u.betrag;
  });
  // Ergebnis: um so viel hat sich der Stand im Monat verändert
  summen.ergebnis = summen.einnahmen - (summen.ausgaben - summen.privat) + summen.uebertraege;
  return summen;
}

// ============================================
// Ausgleichsrechnung für eine gemeinsame Kasse.
//
// Für jede Person gilt:
//   Beigetragen − Anteil an den Ausgaben = Saldo
//
// Beigetragen sind:
//   + Überträge in die Kasse (z. B. vom eigenen Girokonto)
//   − Überträge aus der Kasse zurück aufs eigene Konto
//   + Einzahlungen (Einnahme mit "Eingezahlt von")
//   + Ausgaben, die man privat bezahlt hat
//   + Ausgleichszahlungen, die man an andere geleistet hat
//   − Ausgleichszahlungen, die man bekommen hat
//   + Anteil an allem ohne Person (Startbetrag, sonstige Einnahmen),
//     verteilt nach der Aufteilung der Kasse
//
// Positiver Saldo: Die Person bekommt Geld. Negativer Saldo: Sie schuldet.
// Alle Salden zusammen ergeben genau den Kassenstand.
// ============================================
function ausgleich(kasse) {
  const personen = [];
  const konten = {};

  // Konto einer Person holen (wird beim ersten Mal angelegt)
  function konto(pid) {
    if (!konten[pid]) {
      konten[pid] = { uebertraege: 0, einzahlungen: 0, privat: 0, ausgleich: 0, gemeinsam: 0, anteil: 0 };
      personen.push(pid);
    }
    return konten[pid];
  }

  // Alles ohne Person nach der Regel der Kasse verteilen
  function nachRegel(betrag) {
    const teile = verteile(betrag, kasse.personen, regelGewichte(kasse));
    kasse.personen.forEach(function (pid) { konto(pid).gemeinsam += teile[pid]; });
  }

  kasse.personen.forEach(konto);

  if (kasse.startbetrag) nachRegel(kasse.startbetrag);

  daten.buchungen.forEach(function (b) {
    if (b.kasseId !== kasse.id) return;

    if (b.typ === "einnahme") {
      if (b.bezahltVon) konto(b.bezahltVon).einzahlungen += b.betrag;
      else nachRegel(b.betrag);
    }

    if (b.typ === "ausgabe") {
      // Wer trägt wie viel? Gespeicherte Anteile, sonst Regel der Kasse
      const anteile = b.anteile || verteile(b.betrag, kasse.personen, regelGewichte(kasse));
      Object.keys(anteile).forEach(function (pid) { konto(pid).anteil += anteile[pid]; });
      if (b.bezahltVon) konto(b.bezahltVon).privat += b.betrag;
    }
  });

  daten.uebertraege.forEach(function (u) {
    if (u.nachKasseId === kasse.id) {
      if (u.personId) konto(u.personId).uebertraege += u.betrag;
      else nachRegel(u.betrag);
    }
    if (u.vonKasseId === kasse.id) {
      if (u.personId) konto(u.personId).uebertraege -= u.betrag;
      else nachRegel(-u.betrag);
    }
  });

  (daten.ausgleiche || []).forEach(function (a) {
    if (a.kasseId !== kasse.id) return;
    konto(a.vonPersonId).ausgleich += a.betrag;
    konto(a.anPersonId).ausgleich -= a.betrag;
  });

  // Summen und Saldo je Person
  personen.forEach(function (pid) {
    const k = konten[pid];
    k.beitrag = k.uebertraege + k.einzahlungen + k.privat + k.ausgleich + k.gemeinsam;
    k.saldo = k.beitrag - k.anteil;
  });

  // Wer zahlt wem? Personen mit Schulden zahlen an Personen mit Guthaben.
  const schuldner = personen
    .filter(function (pid) { return konten[pid].saldo < 0; })
    .map(function (pid) { return { pid: pid, offen: -konten[pid].saldo }; })
    .sort(function (a, b) { return b.offen - a.offen; });
  const glaeubiger = personen
    .filter(function (pid) { return konten[pid].saldo > 0; })
    .map(function (pid) { return { pid: pid, offen: konten[pid].saldo }; })
    .sort(function (a, b) { return b.offen - a.offen; });

  const zahlungen = [];
  let i = 0;
  let j = 0;
  while (i < schuldner.length && j < glaeubiger.length) {
    const betrag = Math.min(schuldner[i].offen, glaeubiger[j].offen);
    zahlungen.push({ von: schuldner[i].pid, an: glaeubiger[j].pid, betrag: betrag });
    schuldner[i].offen -= betrag;
    glaeubiger[j].offen -= betrag;
    if (schuldner[i].offen === 0) i++;
    if (glaeubiger[j].offen === 0) j++;
  }

  return {
    personen: personen,
    konten: konten,
    zahlungen: zahlungen,
    // Was danach noch übrig ist:
    // Guthaben bleibt in der Kasse, Schulden müssen in die Kasse eingezahlt werden
    guthaben: glaeubiger.filter(function (g) { return g.offen > 0; }),
    einzahlen: schuldner.filter(function (s) { return s.offen > 0; })
  };
}

// ============================================
// Auswertung eines Monats über alle Kassen.
//
// Gezählt werden alle Einnahmen und Ausgaben in allen Kassen
// (auch archivierten, damit alte Monate richtig bleiben).
// Überträge zählen nicht: Das Geld ist dabei nur woanders.
// ============================================
function monatsAuswertung(monat) {
  const ergebnis = {
    einnahmen: 0,
    ausgaben: 0,
    proKasse: {},          // kasseId: { einnahmen, ausgaben }
    ausgabenKategorien: {},  // kategorieId: Betrag
    einnahmenKategorien: {}
  };

  daten.buchungen.forEach(function (b) {
    if (!b.datum.startsWith(monat)) return;

    if (!ergebnis.proKasse[b.kasseId]) ergebnis.proKasse[b.kasseId] = { einnahmen: 0, ausgaben: 0 };
    const kasse = ergebnis.proKasse[b.kasseId];

    if (b.typ === "einnahme") {
      ergebnis.einnahmen += b.betrag;
      kasse.einnahmen += b.betrag;
      ergebnis.einnahmenKategorien[b.kategorieId] = (ergebnis.einnahmenKategorien[b.kategorieId] || 0) + b.betrag;
    }
    if (b.typ === "ausgabe") {
      ergebnis.ausgaben += b.betrag;
      kasse.ausgaben += b.betrag;
      ergebnis.ausgabenKategorien[b.kategorieId] = (ergebnis.ausgabenKategorien[b.kategorieId] || 0) + b.betrag;
    }
  });

  ergebnis.uebrig = ergebnis.einnahmen - ergebnis.ausgaben;
  return ergebnis;
}
