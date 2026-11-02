// ============================================
// Sparziele: auf etwas hinsparen, z. B. "Urlaub 2027: 3.000 €".
//
// Jedes Sparziel gehört zu genau einer Kasse. Der Fortschritt ist
// einfach der Stand dieser Kasse. Was du in die Kasse überträgst,
// zählt also automatisch.
//
// So sieht ein Sparziel in den Daten aus:
// {
//   id: "spa_...",
//   name: "Urlaub 2027",
//   kasseId: "kas_urlaub",
//   zielbetrag: 300000 (in Cent),
//   zielMonat: "2027-07" oder null (ohne Zieldatum)
// }
// ============================================

// Sparziel anhand seiner ID finden
function findeSparziel(id) {
  return daten.sparziele.find(function (z) { return z.id === id; });
}

// Das Sparziel einer Kasse (oder undefined)
function sparzielDerKasse(kasseId) {
  return daten.sparziele.find(function (z) { return z.kasseId === kasseId; });
}

// Wie viel fließt jeden Monat per Dauerauftrag in eine Kasse? (hinein minus hinaus)
// Seltenere Aufträge werden auf den Monat umgerechnet.
function sparrateProMonat(kasseId) {
  let rate = 0;
  daten.dauerauftraege.forEach(function (d) {
    if (d.pausiert || istBeendet(d) || schuldAbbezahlt(d)) return;
    if (d.art === "uebertrag") {
      if (d.nachKasseId === kasseId) rate += proMonat(d);
      if (d.vonKasseId === kasseId) rate -= proMonat(d);
      return;
    }
    if (d.kasseId !== kasseId) return;
    // Privat bezahlte Ausgaben ändern den Kassenstand nicht
    if (d.art === "ausgabe" && d.bezahltVon) return;
    rate += d.art === "einnahme" ? proMonat(d) : -proMonat(d);
  });
  return rate;
}

// Alles, was man über den Stand eines Sparziels wissen muss
function sparStatus(ziel) {
  const kasse = findeKasse(ziel.kasseId);
  const stand = kasse ? kontostand(kasse) : 0;
  const rest = Math.max(0, ziel.zielbetrag - stand);
  const prozent = ziel.zielbetrag > 0 ? Math.max(0, Math.min(100, Math.floor(stand / ziel.zielbetrag * 100))) : 100;
  const dieserMonat = heute().slice(0, 7);
  const rate = sparrateProMonat(ziel.kasseId);

  const status = {
    stand: stand,
    rest: rest,
    prozent: prozent,
    erreicht: rest === 0,
    rate: rate,
    monateBisZiel: null,  // Wie viele Monate bleiben bis zum Zieldatum?
    noetig: null,         // So viel müsste man pro Monat sparen
    voraussichtlich: null // Monat, in dem das Ziel bei der jetzigen Rate erreicht ist
  };

  if (ziel.zielMonat) {
    status.monateBisZiel = monatsAbstand(dieserMonat, ziel.zielMonat);
    status.noetig = status.monateBisZiel > 0 ? Math.ceil(rest / status.monateBisZiel) : rest;
  }
  if (!status.erreicht && rate > 0) {
    status.voraussichtlich = verschiebeMonat(dieserMonat, Math.ceil(rest / rate));
  }
  return status;
}

// Ein Satz, der erklärt, wie es um das Ziel steht
function sparText(ziel, s) {
  if (s.erreicht) return "Erreicht 🎉";

  const teile = [];
  if (ziel.zielMonat) {
    if (s.monateBisZiel <= 0) {
      teile.push("Das Zieldatum ist erreicht. Es fehlen noch " + formatEuro(s.rest) + ".");
    } else {
      teile.push("Nötig: " + formatEuro(s.noetig) + " im Monat bis " + formatMonat(ziel.zielMonat) + ".");
    }
  }

  if (s.rate > 0) {
    let satz = "Du sparst " + formatEuro(s.rate) + " im Monat";
    if (ziel.zielMonat && s.monateBisZiel > 0) {
      satz += s.rate >= s.noetig
        ? ", das reicht ✓ Ziel voraussichtlich im " + formatMonat(s.voraussichtlich) + "."
        : ". Es fehlen " + formatEuro(s.noetig - s.rate) + " im Monat, sonst wird es erst " + formatMonat(s.voraussichtlich) + ".";
    } else {
      satz += ". Ziel voraussichtlich im " + formatMonat(s.voraussichtlich) + ".";
    }
    teile.push(satz);
  } else {
    teile.push("Noch keine regelmäßige Sparrate.");
  }
  return teile.join(" ");
}

// Fortschrittsbalken mit Beträgen
function sparBalken(ziel, s) {
  const kasse = findeKasse(ziel.kasseId);
  return (
    '<div class="posten"><span>' + formatEuro(s.stand) + " von " + formatEuro(ziel.zielbetrag) + "</span>" +
    '<span class="leise">' + s.prozent + " %</span></div>" +
    '<div class="balken gross"><span style="width:' + s.prozent + "%;background:" + (kasse ? kasse.farbe : "#1a7f37") + '"></span></div>'
  );
}

// Karte für ein Sparziel (Liste, Übersicht, Kassenseite)
function sparKarte(ziel) {
  const s = sparStatus(ziel);
  return (
    '<a class="karte spar-karte" href="#sparziel/' + ziel.id + '">' +
    '  <div class="aufteilung-kopf"><strong>🎯 ' + schuetzeText(ziel.name) + '</strong><span class="pfeil">›</span></div>' +
    sparBalken(ziel, s) +
    '  <p class="leise klein">' + schuetzeText(sparText(ziel, s)) + "</p>" +
    "</a>"
  );
}

// Eine Kasse, von der aus man spart: am liebsten eine persönliche, nicht die Zielkasse
function sparQuelle(zielKasseId) {
  const andere = daten.kassen.filter(function (k) { return !k.archiviert && k.id !== zielKasseId; });
  const persoenlich = andere.find(function (k) { return k.art === "persoenlich"; });
  return (persoenlich || andere[0] || {}).id || null;
}


// ============================================
// Bildschirm "Sparziele": Liste
// ============================================
function zeichneSparziele(bereich) {
  let html = "";
  if (daten.sparziele.length === 0) {
    html += platzhalter("Noch keine Sparziele. Lege eines an, zum Beispiel für den nächsten Urlaub, ein neues Sofa oder einen Notgroschen.");
  } else {
    // Offene zuerst, erreichte unten
    const sortiert = daten.sparziele.slice().sort(function (a, b) {
      return (sparStatus(a).erreicht ? 1 : 0) - (sparStatus(b).erreicht ? 1 : 0);
    });
    html += sortiert.map(sparKarte).join("");
  }
  html += '<a class="knopf" href="#sparziel/neu">+ Neues Sparziel</a>';
  bereich.innerHTML = html;
}


// ============================================
// Bildschirm "Sparziel": anlegen, bearbeiten, Stand
// ============================================
function zeichneSparziel(bereich, id) {
  const istNeu = id === "neu";
  const ziel = istNeu ? null : findeSparziel(id);

  if (!istNeu && !ziel) {
    location.replace("#sparziele");
    return;
  }

  document.getElementById("titel").textContent = istNeu ? "Neues Sparziel" : ziel.name;

  if (daten.personen.length === 0) {
    bereich.innerHTML = hinweisPersonenFehlen();
    return;
  }

  let html = "";

  // Bei bestehenden Zielen: Stand und Knöpfe zuerst
  if (!istNeu) {
    const s = sparStatus(ziel);
    const kasse = findeKasse(ziel.kasseId);
    html +=
      '<div class="karte">' + sparBalken(ziel, s) +
      (s.erreicht ? "" : '<p class="klein">Noch ' + formatEuro(s.rest) + "</p>") +
      '<p class="leise klein">' + schuetzeText(sparText(ziel, s)) + "</p>" +
      (kasse ? '<p class="leise klein">Gespart wird in der Kasse <a href="#kasse/' + kasse.id + '">' + schuetzeText(kasse.name) + "</a>.</p>" : "") +
      "</div>";

    if (!s.erreicht) {
      html += '<button type="button" id="einzahlen" class="knopf">Jetzt einzahlen</button>';
      // Sparrate anbieten: keine vorhanden, oder sie reicht nicht bis zum Zieldatum
      const reichtNicht = s.noetig !== null && s.monateBisZiel > 0 && s.rate < s.noetig;
      if (s.rate <= 0) {
        html += '<button type="button" id="sparrate" class="knopf zweit">🔁 Sparrate als Dauerauftrag anlegen</button>';
      } else if (reichtNicht) {
        html += '<button type="button" id="sparrate" class="knopf zweit">🔁 Zusätzliche Sparrate anlegen</button>';
      }
    }
    html += '<h2 class="abschnitt">Angaben ändern</h2>';
  }

  // Kassen zur Auswahl: aktive Kassen ohne eigenes Sparziel (plus die eigene)
  const freieKassen = daten.kassen.filter(function (k) {
    const vorhanden = sparzielDerKasse(k.id);
    return !k.archiviert && (!vorhanden || (ziel && vorhanden.id === ziel.id));
  });

  // Für eine neue Kasse: für wen?
  const fuerWen = daten.personen.map(function (p) {
    return '<option value="' + p.id + '">' + schuetzeText(p.name) + " (persönlich)</option>";
  }).join("") + (daten.personen.length >= 2 ? '<option value="gemeinsam">Gemeinsam, gleich aufgeteilt</option>' : "");

  html +=
    '<form id="sparFormular" class="karte" novalidate>' +
    '  <label class="feld">Wofür sparst du?' +
    '    <input id="zName" type="text" maxlength="40" autocomplete="off" value="' + schuetzeText(ziel ? ziel.name : "") + '" placeholder="z. B. Urlaub 2027">' +
    "  </label>" +
    '  <label class="feld">Zielbetrag in €' +
    '    <input id="zBetrag" type="text" inputmode="decimal" autocomplete="off" value="' + (ziel ? betragFuerEingabe(ziel.zielbetrag) : "") + '">' +
    "  </label>" +
    '  <label class="feld">Bis wann? (freiwillig)' +
    '    <input id="zMonat" type="month" value="' + (ziel && ziel.zielMonat ? ziel.zielMonat : "") + '">' +
    "  </label>" +
    '  <label class="feld">Kasse' +
    '    <select id="zKasse">' +
    (istNeu ? '<option value="neu">Neue Kasse anlegen</option>' : "") +
    freieKassen.map(function (k) {
      return '<option value="' + k.id + '"' + (ziel && ziel.kasseId === k.id ? " selected" : "") + ">" + schuetzeText(k.name) + "</option>";
    }).join("") +
    "    </select>" +
    "  </label>" +
    (istNeu
      ? '<label class="feld" id="zFuerWenFeld">Die neue Kasse gehört' +
        '  <select id="zFuerWen">' + fuerWen + "</select>" +
        "</label>" +
        '<p class="leise klein" id="zNeuHinweis">Die Kasse bekommt den Namen des Sparziels und startet mit 0 €.</p>'
      : "") +
    '  <p id="fehler" class="fehler" hidden></p>' +
    '  <button type="submit" class="knopf">Speichern</button>' +
    '  <button type="button" id="abbrechen" class="knopf zweit">Abbrechen</button>' +
    "</form>" +
    (istNeu ? "" :
      '<button type="button" id="loeschen" class="knopf gefahr">Sparziel löschen</button>' +
      '<p class="leise klein">Beim Löschen bleibt die Kasse mit ihrem Geld erhalten.</p>');

  bereich.innerHTML = html;

  const formular = document.getElementById("sparFormular");
  const fehler = document.getElementById("fehler");
  const feldKasse = document.getElementById("zKasse");

  // "Für wen" nur zeigen, wenn eine neue Kasse angelegt wird
  function zeigeFuerWen() {
    const feld = document.getElementById("zFuerWenFeld");
    if (!feld) return;
    const neu = feldKasse.value === "neu";
    feld.hidden = !neu;
    document.getElementById("zNeuHinweis").hidden = !neu;
  }
  feldKasse.addEventListener("change", zeigeFuerWen);
  formular.addEventListener("input", function () { fehler.hidden = true; });
  formular.addEventListener("change", function () { fehler.hidden = true; });
  zeigeFuerWen();

  formular.addEventListener("submit", function (ereignis) {
    ereignis.preventDefault();
    const name = document.getElementById("zName").value.trim();
    const zielbetrag = leseBetrag(document.getElementById("zBetrag").value);
    const zielMonat = document.getElementById("zMonat").value || null;
    let kasseId = feldKasse.value;

    if (name === "") return zeigeFehler(fehler, "Bitte gib ein, wofür du sparst.");
    if (zielbetrag === null || zielbetrag <= 0) return zeigeFehler(fehler, "Bitte gib einen Zielbetrag größer als 0 ein.");
    if (zielMonat && !/^\d{4}-\d{2}$/.test(zielMonat)) return zeigeFehler(fehler, "Das Zieldatum ist ungültig.");

    // Neue Kasse anlegen
    if (kasseId === "neu") {
      const doppelt = daten.kassen.some(function (k) { return k.name.toLowerCase() === name.toLowerCase(); });
      if (doppelt) return zeigeFehler(fehler, "Es gibt schon eine Kasse mit diesem Namen. Wähle sie oben aus oder nenne das Ziel anders.");

      const fuer = document.getElementById("zFuerWen").value;
      const gemeinsam = fuer === "gemeinsam";
      const neueKasse = {
        id: neueId("kas"),
        name: name,
        farbe: freieFarbe(daten.kassen),
        art: gemeinsam ? "gemeinsam" : "persoenlich",
        personen: gemeinsam ? daten.personen.map(function (p) { return p.id; }) : [fuer],
        startbetrag: 0,
        startdatum: heute(),
        aufteilung: gemeinsam ? { art: "gleich" } : null,
        archiviert: false
      };
      daten.kassen.push(neueKasse);
      kasseId = neueKasse.id;
    }

    if (!kasseId) return zeigeFehler(fehler, "Bitte wähle eine Kasse.");

    const werte = { name: name, zielbetrag: zielbetrag, zielMonat: zielMonat, kasseId: kasseId };
    if (istNeu) {
      const neu = Object.assign({ id: neueId("spa") }, werte);
      daten.sparziele.push(neu);
      speichereDaten();
      zeigeMeldung("Sparziel angelegt");
      location.replace("#sparziel/" + neu.id);
    } else {
      Object.assign(ziel, werte);
      speichereDaten();
      zeigeMeldung("Gespeichert");
      document.getElementById("titel").textContent = ziel.name;
      zeichneSparziel(bereich, id);
    }
  });

  document.getElementById("abbrechen").addEventListener("click", function () {
    zurueck("#sparziele");
  });

  if (istNeu) {
    document.getElementById("zName").focus();
    return;
  }

  // Jetzt einzahlen: Übertrag in die Kasse des Ziels
  const knopfEinzahlen = document.getElementById("einzahlen");
  if (knopfEinzahlen) {
    knopfEinzahlen.addEventListener("click", function () {
      uebergabe = { kasseId: sparQuelle(ziel.kasseId), nachKasseId: ziel.kasseId, notiz: ziel.name, zurueckZu: "#sparziel/" + ziel.id };
      location.hash = "#uebertrag/neu";
    });
  }

  // Sparrate als Dauerauftrag: monatlicher Übertrag, vorausgefüllt
  const knopfRate = document.getElementById("sparrate");
  if (knopfRate) {
    knopfRate.addEventListener("click", function () {
      const s = sparStatus(ziel);
      const vorschlag = s.noetig && s.noetig > 0 ? Math.max(0, s.noetig - Math.max(0, s.rate)) : 0;
      uebergabe = {
        art: "uebertrag",
        name: "Sparen " + ziel.name,
        betrag: vorschlag,
        vonKasseId: sparQuelle(ziel.kasseId),
        nachKasseId: ziel.kasseId,
        endeMonat: ziel.zielMonat
      };
      location.hash = "#dauerauftrag/neu";
    });
  }

  document.getElementById("loeschen").addEventListener("click", function () {
    if (!confirm("Sparziel \"" + ziel.name + "\" löschen? Die Kasse und ihr Geld bleiben erhalten.")) return;
    daten.sparziele = daten.sparziele.filter(function (z) { return z.id !== ziel.id; });
    speichereDaten();
    zeigeMeldung("Sparziel gelöscht");
    zurueck("#sparziele");
  });
}
