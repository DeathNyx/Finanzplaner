// ============================================
// Diagramme: Verlauf über mehrere Monate.
//
// Die Diagramme werden selbst als SVG gezeichnet (Grafik aus Code),
// ohne fremde Bibliothek. Jedes Diagramm hat:
//   - Antippen (oder Maus darüber) zeigt die genauen Beträge
//   - "Als Tabelle zeigen" mit allen Zahlen
// Farben kommen aus style.css (--serie-1, --serie-2 ...), damit
// heller und dunkler Modus an einer Stelle festgelegt sind.
// ============================================

// Auswahl oben auf dem Bildschirm (bleibt erhalten, solange die App offen ist)
const diagrammAuswahl = { monate: 6, kasseId: "", kategorieId: null };

// Maße der Zeichenfläche in Pixeln
const DIAGRAMM_HOEHE = 170;
const RAND = { oben: 14, rechts: 10, unten: 28, links: 48 };

// ---------- Kleine Helfer ----------

// Kurzer Monatsname für die Achse: "Nov", im Januar mit Jahr: "Jan 27"
function monatKurz(monat, mitJahr) {
  const [jahr, m] = monat.split("-").map(Number);
  const name = new Date(jahr, m - 1, 1).toLocaleDateString("de-DE", { month: "short" }).replace(".", "");
  return mitJahr ? name + " " + String(jahr).slice(2) : name;
}

// Betrag für die Achse: ganze Euro oder kurz in Tausend ("12 Tsd").
// Eine Achse nutzt immer nur eine Schreibweise.
function achsenText(cent, kurz) {
  const euro = cent / 100;
  const zahl = kurz
    ? new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(euro / 1000) + " Tsd"
    : new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(euro);
  return zahl.replace("-", "−");
}

// Schöne Achsenwerte (1, 2 oder 5 mal 10er Potenz), alles in Cent
function schoeneSkala(min, max, mitNull) {
  if (mitNull) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (max === min) {
    max = min + 10000; // ohne Werte: 0 bis 100 €
  }
  const grob = (max - min) / 4;
  const potenz = Math.pow(10, Math.floor(Math.log10(grob)));
  const anteil = grob / potenz;
  let schritt = (anteil <= 1 ? 1 : anteil <= 2 ? 2 : anteil <= 5 ? 5 : 10) * potenz;
  schritt = Math.max(100, schritt); // mindestens 1 €
  const unten = Math.floor(min / schritt) * schritt;
  const oben = Math.ceil(max / schritt) * schritt;
  const werte = [];
  for (let w = unten; w <= oben + 1; w += schritt) werte.push(w);
  return { min: unten, max: oben, werte: werte };
}

// Pfad einer Säule: 4px runde Ecken am Datenende, eckig an der Grundlinie
function saeulenPfad(x, breite, yNull, yWert) {
  const hoehe = Math.abs(yWert - yNull);
  if (hoehe < 0.5) return "";
  const r = Math.min(4, breite / 2, hoehe);
  const richtung = yWert < yNull ? 1 : -1; // nach oben: 1, nach unten: -1
  return "M" + x + "," + yNull +
    "V" + (yWert + richtung * r) +
    "Q" + x + "," + yWert + " " + (x + r) + "," + yWert +
    "H" + (x + breite - r) +
    "Q" + (x + breite) + "," + yWert + " " + (x + breite) + "," + (yWert + richtung * r) +
    "V" + yNull + "Z";
}

// Text sicher in ein Element schreiben (nie als HTML)
function element(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}


// ---------- Das Zeichengerüst für alle Verlaufsdiagramme ----------

// Zeichnet Achsen und Gitter und liefert die Umrechnung Wert -> Pixel.
// "monate" sind die Monate auf der x-Achse.
function zeichneRahmen(svg, breite, monate, skala) {
  const plotBreite = breite - RAND.links - RAND.rechts;
  const band = plotBreite / monate.length;
  const y = function (wert) {
    return RAND.oben + (skala.max - wert) / (skala.max - skala.min) * DIAGRAMM_HOEHE;
  };
  const xMitte = function (i) { return RAND.links + band * i + band / 2; };
  let inhalt = "";

  // Waagerechte Gitterlinien mit Beträgen (ab 10.000 € auf der Achse alles in Tausend)
  const kurz = skala.werte.some(function (w) { return Math.abs(w) >= 1000000; });
  skala.werte.forEach(function (w) {
    const yy = Math.round(y(w)) + 0.5;
    inhalt += '<line class="' + (w === 0 ? "achse" : "gitter") + '" x1="' + RAND.links + '" x2="' + (breite - RAND.rechts) +
      '" y1="' + yy + '" y2="' + yy + '"/>';
    inhalt += '<text class="achsen-text" x="' + (RAND.links - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + achsenText(w, kurz) + "</text>";
  });

  // Monate unten (bei wenig Platz nur jeden zweiten, den letzten immer)
  const jedenZweiten = band < 26;
  let letztesJahr = null;
  monate.forEach(function (m, i) {
    if (jedenZweiten && (monate.length - 1 - i) % 2 !== 0) return;
    // Jahreszahl beim ersten sichtbaren Monat und immer, wenn ein neues Jahr beginnt
    const jahr = m.slice(0, 4);
    const mitJahr = jahr !== letztesJahr;
    letztesJahr = jahr;
    inhalt += '<text class="achsen-text" x="' + xMitte(i) + '" y="' + (RAND.oben + DIAGRAMM_HOEHE + 18) +
      '" text-anchor="middle">' + monatKurz(m, mitJahr) + "</text>";
  });

  svg.insertAdjacentHTML("beforeend", inhalt);
  return { y: y, xMitte: xMitte, band: band, plotBreite: plotBreite };
}

// Leeres SVG in passender Größe
function neuesSvg(behaelter, beschreibung) {
  const breite = Math.max(260, Math.floor(behaelter.clientWidth));
  const hoehe = RAND.oben + DIAGRAMM_HOEHE + RAND.unten;
  behaelter.innerHTML =
    '<svg class="diagramm-svg" width="' + breite + '" height="' + hoehe + '" viewBox="0 0 ' + breite + " " + hoehe +
    '" role="img"></svg><div class="diagramm-tipp" hidden></div>';
  const svg = behaelter.querySelector("svg");
  svg.setAttribute("aria-label", beschreibung);
  return { svg: svg, breite: breite, tipp: behaelter.querySelector(".diagramm-tipp") };
}

// Macht jeden Monat antippbar: zeigt die Beträge aller Reihen dieses Monats.
// "zeilen(i)" liefert [{ farbe, wert, name }] für den Monat i.
function machAntippbar(svg, tipp, rahmen, monate, zeilen, beimZeigen) {
  const hoehe = RAND.oben + DIAGRAMM_HOEHE;
  let ziele = "";
  monate.forEach(function (m, i) {
    const x = RAND.links + rahmen.band * i;
    ziele += '<rect class="trefferflaeche" x="' + x + '" y="0" width="' + rahmen.band + '" height="' + (hoehe + RAND.unten) +
      '" tabindex="0" data-i="' + i + '"/>';
  });
  svg.insertAdjacentHTML("beforeend", '<rect class="markierung" x="0" y="' + RAND.oben + '" width="0" height="' + DIAGRAMM_HOEHE + '"/>' + ziele);

  const markierung = svg.querySelector(".markierung");

  function zeige(i) {
    // Monat leicht hinterlegen
    markierung.setAttribute("x", RAND.links + rahmen.band * i);
    markierung.setAttribute("width", rahmen.band);
    markierung.classList.add("sichtbar");
    if (beimZeigen) beimZeigen(i);

    // Inhalt: Monat als Überschrift, darunter Wert zuerst, dann Name
    tipp.textContent = "";
    tipp.appendChild(element("div", "tipp-titel", formatMonat(monate[i])));
    zeilen(i).forEach(function (z) {
      const zeile = element("div", "tipp-zeile");
      const strich = element("span", "tipp-strich");
      strich.style.background = z.farbe;
      zeile.appendChild(strich);
      zeile.appendChild(element("strong", "", z.wert));
      zeile.appendChild(element("span", "leise", z.name));
      tipp.appendChild(zeile);
    });
    tipp.hidden = false;

    // Neben den Monat setzen, aber im Rahmen bleiben
    const mitte = rahmen.xMitte(i);
    const breite = tipp.offsetWidth;
    const links = Math.max(0, Math.min(svg.clientWidth - breite, mitte - breite / 2));
    tipp.style.left = links + "px";
  }

  function verstecke() {
    tipp.hidden = true;
    markierung.classList.remove("sichtbar");
    if (beimZeigen) beimZeigen(null);
  }

  svg.querySelectorAll(".trefferflaeche").forEach(function (ziel) {
    const i = Number(ziel.dataset.i);
    ziel.addEventListener("pointerenter", function () { zeige(i); });
    ziel.addEventListener("pointerdown", function () { zeige(i); });
    ziel.addEventListener("focus", function () { zeige(i); });
    ziel.addEventListener("blur", verstecke);
  });
  // Mit der Maus: beim Verlassen ausblenden. Am Handy bleibt es stehen, bis man woanders tippt.
  svg.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") verstecke(); });
  svg.verstecke = verstecke;
}


// ---------- Säulendiagramm (eine oder zwei Reihen, auch mit Minuswerten) ----------
// reihen: [{ name, farbe (CSS Variable), werte: [...] }]
// mitVorzeichen: Säulen über 0 bekommen "farbePlus", unter 0 "farbeMinus"
function saeulenDiagramm(behaelter, monate, reihen, beschreibung, mitVorzeichen) {
  const leinwand = neuesSvg(behaelter, beschreibung);
  let min = 0;
  let max = 0;
  reihen.forEach(function (r) { r.werte.forEach(function (w) { min = Math.min(min, w); max = Math.max(max, w); }); });
  const skala = schoeneSkala(min, max, true);
  const rahmen = zeichneRahmen(leinwand.svg, leinwand.breite, monate, skala);

  // Säulen: höchstens 24px breit, 2px Abstand zwischen Säulen eines Monats
  const anzahl = reihen.length;
  const saeulenBreite = Math.max(3, Math.min(24, (rahmen.band * 0.7 - (anzahl - 1) * 2) / anzahl));
  const gruppe = anzahl * saeulenBreite + (anzahl - 1) * 2;
  const yNull = rahmen.y(0);
  let saeulen = "";
  monate.forEach(function (m, i) {
    const start = rahmen.xMitte(i) - gruppe / 2;
    reihen.forEach(function (r, nr) {
      const wert = r.werte[i];
      const farbe = mitVorzeichen ? (wert >= 0 ? r.farbePlus : r.farbeMinus) : r.farbe;
      const pfad = saeulenPfad(start + nr * (saeulenBreite + 2), saeulenBreite, yNull, rahmen.y(wert));
      if (pfad) saeulen += '<path d="' + pfad + '" style="fill:var(' + farbe + ')"/>';
    });
  });
  leinwand.svg.insertAdjacentHTML("beforeend", saeulen);

  machAntippbar(leinwand.svg, leinwand.tipp, rahmen, monate, function (i) {
    return reihen.map(function (r) {
      const wert = r.werte[i];
      const farbe = mitVorzeichen ? (wert >= 0 ? r.farbePlus : r.farbeMinus) : r.farbe;
      return { farbe: "var(" + farbe + ")", wert: formatEuro(wert), name: r.name };
    });
  });
}


// ---------- Liniendiagramm (eine Reihe) ----------
function linienDiagramm(behaelter, monate, werte, name, farbe, beschreibung) {
  const leinwand = neuesSvg(behaelter, beschreibung);
  const min = Math.min.apply(null, werte);
  const max = Math.max.apply(null, werte);
  // Etwas Luft über und unter der Linie, die Null nur zeigen, wenn sie nah ist
  const luft = Math.max(10000, (max - min) * 0.15);
  const skala = schoeneSkala(min - luft, max + luft, min <= 0);
  const rahmen = zeichneRahmen(leinwand.svg, leinwand.breite, monate, skala);

  const punkte = werte.map(function (w, i) { return [rahmen.xMitte(i), rahmen.y(w)]; });
  const linie = punkte.map(function (p, i) { return (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("");
  const letzter = punkte[punkte.length - 1];

  leinwand.svg.insertAdjacentHTML("beforeend",
    '<path class="linie" d="' + linie + '" style="stroke:var(' + farbe + ')"/>' +
    // Endpunkt mit Ring in Flächenfarbe und Wert daneben
    '<circle class="endpunkt" cx="' + letzter[0] + '" cy="' + letzter[1] + '" r="4" style="fill:var(' + farbe + ')"/>' +
    '<circle class="fadenpunkt" r="4" cx="0" cy="0" style="fill:var(' + farbe + ')"/>' +
    '<line class="fadenkreuz" x1="0" x2="0" y1="' + RAND.oben + '" y2="' + (RAND.oben + DIAGRAMM_HOEHE) + '"/>');

  // Wert am Ende der Linie, nach links ausgerichtet, damit er nicht übersteht.
  // Kommt die Linie von oben, steht er unter dem Punkt, sonst darüber.
  const wertText = formatEuro(werte[werte.length - 1]);
  const vorletzter = punkte.length > 1 ? punkte[punkte.length - 2] : letzter;
  const vonOben = vorletzter[1] < letzter[1];
  const textY = vonOben ? letzter[1] + 20 : letzter[1] - 10;
  leinwand.svg.insertAdjacentHTML("beforeend",
    '<text class="wert-text" x="' + (letzter[0] + 4) + '" y="' + Math.max(12, textY) + '" text-anchor="end">' + wertText + "</text>");

  const fadenkreuz = leinwand.svg.querySelector(".fadenkreuz");
  const fadenpunkt = leinwand.svg.querySelector(".fadenpunkt");
  machAntippbar(leinwand.svg, leinwand.tipp, rahmen, monate, function (i) {
    return [{ farbe: "var(" + farbe + ")", wert: formatEuro(werte[i]), name: name }];
  }, function (i) {
    // Fadenkreuz und Punkt auf den gewählten Monat setzen
    if (i === null) {
      fadenkreuz.classList.remove("sichtbar");
      fadenpunkt.classList.remove("sichtbar");
      return;
    }
    fadenkreuz.setAttribute("x1", punkte[i][0]);
    fadenkreuz.setAttribute("x2", punkte[i][0]);
    fadenkreuz.classList.add("sichtbar");
    fadenpunkt.classList.add("sichtbar");
    fadenpunkt.setAttribute("cx", punkte[i][0]);
    fadenpunkt.setAttribute("cy", punkte[i][1]);
  });
  // Die Markierung (Hinterlegung) braucht die Linie nicht, das Fadenkreuz reicht
  leinwand.svg.querySelector(".markierung").classList.add("aus");
}


// ---------- Tabellenansicht (für jedes Diagramm) ----------
// spalten: ["Monat", "Einnahmen", ...], zeilen: [["Nov 2026", "1.234,00 €", ...], ...]
function tabellenAnsicht(spalten, zeilen) {
  const details = element("details", "tabellen-ansicht");
  details.appendChild(element("summary", "", "Als Tabelle zeigen"));
  const tabelle = element("table");
  const kopf = element("tr");
  spalten.forEach(function (s) { kopf.appendChild(element("th", "", s)); });
  tabelle.appendChild(kopf);
  zeilen.forEach(function (z) {
    const tr = element("tr");
    z.forEach(function (zelle) { tr.appendChild(element("td", "", zelle)); });
    tabelle.appendChild(tr);
  });
  details.appendChild(tabelle);
  return details;
}

// Legende: farbiges Kästchen und Name
function legende(eintraege) {
  return '<div class="legende">' + eintraege.map(function (e) {
    return '<span><i style="background:var(' + e.farbe + ')"></i>' + schuetzeText(e.name) + "</span>";
  }).join("") + "</div>";
}


// ============================================
// Bildschirm "Diagramme"
// ============================================
function zeichneDiagramme(bereich) {
  const a = diagrammAuswahl;

  // Gewählte Kasse gibt es nicht mehr? Dann alle Kassen
  if (a.kasseId && !findeKasse(a.kasseId)) a.kasseId = "";

  const d = verlaufsDaten(a.monate, a.kasseId);
  const monate = d.monate.map(function (m) { return m.monat; });
  const zeitraum = formatMonat(d.vonMonat) + " bis " + formatMonat(d.bisMonat);
  const gibtBuchungen = d.monate.some(function (m) { return m.einnahmen || m.ausgaben; });

  // Auswahl der Kategorie für Diagramm 4: sonst die größte
  if (!d.kategorien.some(function (k) { return k.id === a.kategorieId; })) {
    a.kategorieId = d.kategorien.length ? d.kategorien[0].id : null;
  }

  // Filter in einer Zeile ganz oben
  let html =
    '<div class="filter-zeile">' +
    '  <fieldset class="umschalter klein-umschalter">' +
    '    <legend class="nur-vorlesen">Zeitraum</legend>' +
    [6, 12].map(function (n) {
      return '<label><input type="radio" name="zeitraum" value="' + n + '"' + (a.monate === n ? " checked" : "") + "><span>" + n + " Monate</span></label>";
    }).join("") +
    "  </fieldset>" +
    '  <select id="filterKasse" aria-label="Kassen">' +
    '    <option value="">Alle Kassen</option>' +
    daten.kassen.map(function (k) {
      return '<option value="' + k.id + '"' + (k.id === a.kasseId ? " selected" : "") + ">" + schuetzeText(k.name) + (k.archiviert ? " (archiviert)" : "") + "</option>";
    }).join("") +
    "  </select>" +
    "</div>" +
    '<p class="leise klein">' + zeitraum + ". Überträge zwischen Kassen zählen nicht als Einnahme oder Ausgabe.</p>";

  if (!gibtBuchungen) {
    html += platzhalter("In diesem Zeitraum gibt es noch keine Einnahmen oder Ausgaben.");
  } else {
    html +=
      '<figure class="karte diagramm" id="dEinAus"><figcaption><h2>Einnahmen und Ausgaben</h2>' +
      legende([{ farbe: "--serie-1", name: "Einnahmen" }, { farbe: "--serie-2", name: "Ausgaben" }]) +
      '</figcaption><div class="diagramm-flaeche"></div></figure>' +

      '<figure class="karte diagramm" id="dUebrig"><figcaption><h2>Übrig je Monat</h2>' +
      legende([{ farbe: "--plus", name: "Übrig" }, { farbe: "--minus", name: "Mehr ausgegeben" }]) +
      '</figcaption><div class="diagramm-flaeche"></div></figure>' +

      '<figure class="karte diagramm" id="dKategorien"><figcaption><h2>Ausgaben nach Kategorie</h2>' +
      '<p class="leise klein">Summe im Zeitraum. Tippe eine Kategorie an, um ihren Verlauf zu sehen.</p></figcaption>' +
      '<div class="kategorie-balken"></div></figure>' +

      '<figure class="karte diagramm" id="dKategorie"><figcaption><h2 id="dKategorieTitel"></h2></figcaption>' +
      '<div class="diagramm-flaeche"></div></figure>';
  }

  html +=
    '<figure class="karte diagramm" id="dVermoegen"><figcaption><h2>' + (a.kasseId ? "Stand der Kasse" : "Gesamtvermögen") + "</h2>" +
    '<p class="leise klein">' + (a.kasseId ? "Stand am Monatsende" : "Summe aller Kassen am Monatsende (ohne archivierte)") + "</p>" +
    '</figcaption><div class="diagramm-flaeche"></div></figure>';

  bereich.innerHTML = html;

  // Filter ändern: alles neu zeichnen
  bereich.querySelectorAll('input[name="zeitraum"]').forEach(function (knopf) {
    knopf.addEventListener("change", function () { a.monate = Number(knopf.value); zeichneDiagramme(bereich); });
  });
  document.getElementById("filterKasse").addEventListener("change", function (e) {
    a.kasseId = e.target.value;
    zeichneDiagramme(bereich);
  });

  const tabelleMonate = function (spalten, werte) {
    return tabellenAnsicht(["Monat"].concat(spalten), d.monate.map(function (m, i) {
      return [formatMonat(m.monat)].concat(werte(m, i));
    }));
  };

  if (gibtBuchungen) {
    // 1) Einnahmen und Ausgaben
    const ein = document.querySelector("#dEinAus .diagramm-flaeche");
    saeulenDiagramm(ein, monate, [
      { name: "Einnahmen", farbe: "--serie-1", werte: d.monate.map(function (m) { return m.einnahmen; }) },
      { name: "Ausgaben", farbe: "--serie-2", werte: d.monate.map(function (m) { return m.ausgaben; }) }
    ], "Einnahmen und Ausgaben je Monat, " + zeitraum);
    document.getElementById("dEinAus").appendChild(tabelleMonate(["Einnahmen", "Ausgaben"], function (m) {
      return [formatEuro(m.einnahmen), formatEuro(m.ausgaben)];
    }));

    // 2) Übrig je Monat (über oder unter null)
    const uebrig = document.querySelector("#dUebrig .diagramm-flaeche");
    saeulenDiagramm(uebrig, monate, [
      { name: "Übrig", farbePlus: "--plus", farbeMinus: "--minus", werte: d.monate.map(function (m) { return m.uebrig; }) }
    ], "Übrig je Monat, " + zeitraum, true);
    document.getElementById("dUebrig").appendChild(tabelleMonate(["Übrig"], function (m) { return [formatEuro(m.uebrig)]; }));

    // 3) Kategorien als waagerechte Balken
    zeichneKategorienBalken(d);
    // 4) Verlauf der gewählten Kategorie
    zeichneKategorieVerlauf(d, monate);
  }

  // 5) Vermögen
  const verm = document.querySelector("#dVermoegen .diagramm-flaeche");
  linienDiagramm(verm, monate, d.monate.map(function (m) { return m.vermoegen; }),
    a.kasseId ? "Stand" : "Vermögen", "--serie-1", "Vermögen am Monatsende, " + zeitraum);
  document.getElementById("dVermoegen").appendChild(tabelleMonate(["Stand"], function (m) { return [formatEuro(m.vermoegen)]; }));

  // Tippt man außerhalb eines Diagramms, verschwinden die Anzeigen
  // (als Eigenschaft gesetzt, damit es beim Neuzeichnen nicht doppelt passiert)
  bereich.onpointerdown = function (e) {
    if (e.target.closest(".diagramm-svg")) return;
    bereich.querySelectorAll(".diagramm-svg").forEach(function (svg) { if (svg.verstecke) svg.verstecke(); });
  };
}

// Diagramm 3: waagerechte Balken, größte Kategorie oben, antippbar
function zeichneKategorienBalken(d) {
  const behaelter = document.querySelector("#dKategorien .kategorie-balken");
  const groesster = d.kategorien.length ? d.kategorien[0].betrag : 1;
  behaelter.textContent = "";

  d.kategorien.forEach(function (k) {
    const kategorie = findeKategorie(k.id);
    const knopf = element("button", "kategorie-zeile");
    knopf.type = "button";
    knopf.setAttribute("aria-pressed", k.id === diagrammAuswahl.kategorieId ? "true" : "false");
    const kopf = element("span", "posten");
    kopf.appendChild(element("span", "", kategorie ? kategorie.name : "Ohne Kategorie"));
    kopf.appendChild(element("span", "betrag", formatEuro(k.betrag)));
    knopf.appendChild(kopf);
    const spur = element("span", "kategorie-spur");
    const balken = element("span", "kategorie-fuellung");
    balken.style.width = Math.max(1, k.betrag / groesster * 100) + "%";
    spur.appendChild(balken);
    knopf.appendChild(spur);
    knopf.addEventListener("click", function () {
      diagrammAuswahl.kategorieId = k.id;
      behaelter.querySelectorAll(".kategorie-zeile").forEach(function (z) { z.setAttribute("aria-pressed", "false"); });
      knopf.setAttribute("aria-pressed", "true");
      zeichneKategorieVerlauf(d, d.monate.map(function (m) { return m.monat; }));
      document.getElementById("dKategorie").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    behaelter.appendChild(knopf);
  });

  // Tabelle ist hier die Liste selbst (Name und Betrag stehen als Text da)
}

// Diagramm 4: eine Kategorie im Verlauf
function zeichneKategorieVerlauf(d, monate) {
  const id = diagrammAuswahl.kategorieId;
  const kategorie = findeKategorie(id);
  const name = kategorie ? kategorie.name : "Ohne Kategorie";
  document.getElementById("dKategorieTitel").textContent = name + " je Monat";

  const figur = document.getElementById("dKategorie");
  const alteTabelle = figur.querySelector(".tabellen-ansicht");
  if (alteTabelle) alteTabelle.remove();

  const werte = d.monate.map(function (m) { return m.kategorien[id] || 0; });
  saeulenDiagramm(figur.querySelector(".diagramm-flaeche"), monate,
    [{ name: name, farbe: "--serie-2", werte: werte }], name + " je Monat");
  figur.appendChild(tabellenAnsicht(["Monat", name], d.monate.map(function (m, i) {
    return [formatMonat(m.monat), formatEuro(werte[i])];
  })));
}

// Beim Drehen des Handys oder Ändern der Fenstergröße neu zeichnen
let diagrammZeitgeber = null;
window.addEventListener("resize", function () {
  clearTimeout(diagrammZeitgeber);
  diagrammZeitgeber = setTimeout(function () {
    if (location.hash.startsWith("#diagramme")) zeichneDiagramme(document.getElementById("inhalt"));
  }, 250);
});
