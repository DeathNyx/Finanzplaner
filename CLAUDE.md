# Finanzplaner

## Über mich
- Ich bin Anfänger im Programmieren und will dabei lernen.
- Erkläre jeden Schritt kurz und einfach auf Deutsch.
- Sag mir nach jedem Schritt, wie ich das Ergebnis selbst testen kann.

## Ziel der App
Eine persönliche Finanzplanung, die im Browser läuft und auch am Handy gut bedienbar ist.

## Kassen (Kernfunktion)
- Beliebig viele Kassen anlegen, umbenennen, archivieren und löschen
- Personen frei anlegen (z. B. ich und meine Partnerin) und Kassen zuordnen
- Jede Kasse ist entweder persönlich (eine Person) oder gemeinsam (mehrere Personen)
- Pro Kasse einstellbar: Name, Farbe, Startbetrag, Personen
- Gemeinsame Kassen mit frei wählbarem Aufteilungsschlüssel: gleich, feste Prozente oder feste Beträge
- Jede Buchung gehört zu einer Kasse und hat optional die Person, die bezahlt hat
- Überträge zwischen Kassen (z. B. monatlicher Beitrag von persönlicher in gemeinsame Kasse)
- Ausgleichsrechnung für gemeinsame Kassen: wer hat wie viel gezahlt, wer schuldet wem was
- Übersicht pro Kasse und als Gesamtübersicht über alle Kassen
- Alle Einstellungen der Kassen jederzeit änderbar, ohne dass alte Buchungen verloren gehen

## Funktionen Version 1
- Einnahmen erfassen (Gehalt, Nebenjob, Sonstiges), einmalig oder monatlich
- Fixkosten erfassen (Miete, Strom, Handy, Versicherungen, Abos)
- Variable Ausgaben mit Kategorie und Datum
- Raten und Schulden: Gläubiger, Restbetrag, Monatsrate, voraussichtliches Ende
- Monatsübersicht: Einnahmen, Ausgaben, was am Monatsende übrig bleibt
- Backup: alle Daten als Datei exportieren und wieder importieren

## Später Version 2
- Diagramme nach Kategorien und Monaten
- Sparziele mit Fortschritt
- Hinweise auf anstehende Zahlungen
- Als App auf dem Handy installierbar (PWA)

## Technik
- Reines HTML, CSS und JavaScript, kein Framework, keine Installation nötig
- Daten nur lokal im Browser speichern (localStorage), keine Cloud, kein Server
- Beträge in Euro im deutschen Format (1.234,56 €), Datum als TT.MM.JJJJ
- Mobil zuerst: große Schaltflächen, gut lesbar auf dem Handy
- Wenige, übersichtliche Dateien, Kommentare im Code auf Deutsch

## Arbeitsweise
- Ich arbeite nur vom Smartphone aus (Claude App, Code Tab, GitHub im Handy Browser)
- Die App wird über GitHub Pages veröffentlicht, damit ich sie am Handy nutzen kann
- Wenn ich etwas in GitHub selbst tun muss, erkläre die Schritte für die Handy Ansicht
- Niemals echte Finanzdaten ins Repository schreiben, nur Code und Beispieldaten
- Erst einen Plan zeigen, dann umsetzen
- In kleinen Schritten arbeiten, nach jedem Schritt auf mein OK warten
- Keine Gedankenstriche in Texten der App
