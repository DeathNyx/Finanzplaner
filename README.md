# Finanzplaner

Persönliche Finanzplanung mit Kassen. Läuft im Browser, auch am Handy, ganz ohne Installation.

**Wichtig:** Alle Daten bleiben nur in deinem Browser auf deinem Gerät (localStorage). Es gibt keinen Server und keine Cloud. Mach deshalb regelmäßig unter **Mehr › Backup** eine Sicherung.

## Was die App kann

- **Kassen:** persönliche und gemeinsame Kassen mit Farbe, Startbetrag und Personen
- **Aufteilung** bei gemeinsamen Kassen: gleich, Prozent oder bei jeder Buchung selbst eintragen
- **Buchungen:** Ausgaben und Einnahmen mit Kategorie, Datum und „bezahlt von“
- **Überträge** zwischen Kassen
- **Ausgleich:** wer hat wie viel beigetragen, wer schuldet wem was
- **Übersicht** über alle Kassen und **Monatsübersicht** mit Kategorien
- **Daueraufträge** für Gehalt, Miete, Abos und monatliche Überträge, automatisch gebucht
- **Schulden und Raten** mit Restbetrag und voraussichtlichem Ende
- **Sparziele** mit Fortschritt, nötiger Sparrate und voraussichtlichem Erreichen
- **Backup** als Datei exportieren und wieder einlesen
- **Beispieldaten** zum Ausprobieren (Mehr › Backup › Beispieldaten laden)
- **Hinweise auf anstehende Zahlungen** und Warnung, wenn eine Kasse nicht reicht
- **Als App installierbar** (PWA): eigenes Symbol auf dem Startbildschirm, funktioniert auch ohne Internet (Mehr › App installieren)

## Dateien

| Datei | Aufgabe |
|---|---|
| `index.html` | Die eine Seite der App |
| `style.css` | Aussehen, mobil zuerst, mit dunklem Modus |
| `js/format.js` | Euro und Datum im deutschen Format |
| `js/speicher.js` | Laden und Speichern im Browser |
| `js/rechnen.js` | Kontostände, Aufteilung, Ausgleich, Monatsauswertung |
| `js/ansichten.js` | Gemeinsame Bausteine und das Menü „Mehr“ |
| `js/personen.js` | Personen |
| `js/kassen.js` | Kassen und die Seite einer Kasse |
| `js/buchungen.js` | Ausgaben und Einnahmen buchen |
| `js/uebertraege.js` | Überträge zwischen Kassen |
| `js/ausgleich.js` | Ausgleich in gemeinsamen Kassen |
| `js/uebersicht.js` | Startbildschirm und Monatsübersicht |
| `js/dauerauftraege.js` | Daueraufträge |
| `js/schulden.js` | Schulden und Raten |
| `js/sparziele.js` | Sparziele mit Fortschritt |
| `js/kategorien.js` | Kategorien |
| `js/backup.js` | Backup und Beispieldaten |
| `js/installieren.js` | App installieren, Offline Betrieb starten |
| `js/hinweise.js` | Anstehende Zahlungen, Warnungen und Einstellungen |
| `js/app.js` | Start der App und Navigation |
| `beispieldaten.json` | Erfundene Beispieldaten, keine echten Finanzdaten |
| `manifest.webmanifest` | Ausweis der App: Name, Symbol, Farben |
| `sw.js` | Service Worker: speichert die App für den Offline Betrieb |
| `icons/` | App Symbole (`icon.svg` ist die Vorlage) |
