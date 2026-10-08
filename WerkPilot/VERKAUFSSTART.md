# WerkPilot 5.0 an andere Betriebe verkaufen

WerkPilot ist derzeit eine lokale App für Handwerks- und Dienstleistungsbetriebe in Deutschland. Jeder Käufer trägt seine eigenen Firmendaten, Preise und Kunden auf seinem Gerät ein. Der Android-Quellcode ist vorhanden; ein signierter Verkaufs-Build, eine Store-Veröffentlichung und Tests am echten Android-Gerät wurden hier nicht fertiggestellt. Diese Schritte fehlen für die tatsächliche Auslieferung.

## Vor dem ersten bezahlten Einsatz

| Schritt | Konkret noch zu erledigen |
| --- | --- |
| Signierter Android-Build | Projekt mit SDK 35, JDK 17/21 und Gradle 8.11.1 bauen. Einen Release-Build mit deinem eigenen Schlüssel signieren. App-Kennung, Marke und Schlüssel für spätere Updates dauerhaft sichern. Debug-APKs dienen der Prüfung. Anleitung: [android/README.md](android/README.md). |
| Test auf echten Geräten | Mindestens die vorgesehenen Android-Versionen und Geräte prüfen: Offline-Start, Berechtigungen, deutsche Sprache/Stimme, Fotos, PDF-Druck, Terminexport, Kunde → Auftrag → Angebot → Rechnung → Zahlung und Sicherung/Wiederherstellung. Ein Update mit alten Geschäftsdaten prüfen; dabei darf kein Datenbestand verloren gehen. Automatisierte JavaScript-Tests ersetzen diesen Gerätetest nicht. |
| Datenschutz und Store-Angaben | Eine passende Datenschutzerklärung mit deinem Anbieter- und Supportkontakt veröffentlichen. Lokale Kundendaten, Mikrofonberechtigung, optionalen Modell-Download und den möglichen externen Android-Sprachdienst richtig beschreiben. Für den Play Store Developer-Konto, Datenschutzerklärungs-URL, Datensicherheitsformular, Screenshots und die zum Einreichungszeitpunkt geltende Ziel-API vorbereiten. Eine Aussage „keine Datenübertragung“ wäre für alle optionalen Funktionen nicht zutreffend. |
| Verkaufsangebot und Support | Preis, Nutzungsumfang, Anzahl der erlaubten Geräte, Update-Zeitraum, Supportkontakt und Lieferweg festlegen. Dem Käufer die bestehende Leistungsbeschreibung und die Grenzen der Finanz- und Assistenzfunktionen zugänglich machen. Mitgelieferte Hinweise und Lizenztexte aus THIRD_PARTY_NOTICES.md und licenses/ erhalten; Bedingungen der optional bezogenen konvertierten Modelldateien vor eigener Weiterverteilung prüfen. |
| Betrieb und Datenübernahme | Mit einem echten Pilotbetrieb Firmendaten, Rechnungsangaben, eigene Stundenkosten und Preise einrichten. Regelmäßige externe JSON-Sicherungen vereinbaren; vor Gerätewechsel oder Deinstallation sichern. Browserbestand und native App teilen ihren Speicher nicht automatisch. Android-Exporte sind derzeit auf 20 MB je Datei begrenzt. |

Für eine direkte APK-Auslieferung ist keine Play-Store-Veröffentlichung nötig. Der signierte Build, der Gerätetest, klare Anbieterangaben und ein nachvollziehbarer Update- und Supportweg bleiben relevant. Ein eigenes API-Key-Konto des Käufers wird von den vorhandenen App-Funktionen nicht verlangt.

## Welche zusätzlichen Produkte einen Backend-Ausbau brauchen

Die derzeitige lokale App kann als Produkt mit vereinbarter Nutzung verkauft werden. Sie hat keinen Lizenzserver, keine automatische Abrechnung und keine technische Fernsperre. Eine Vertragslizenz setzt diese Infrastruktur nicht voraus.

Wenn du zusätzlich Teamkonten, gemeinsame Kunden und Termine auf mehreren Geräten, automatische Cloud-Sicherungen, einen zentralen Kundenbereich oder serverseitig durchgesetzte laufende Lizenzen anbieten möchtest, braucht das einen eigenen Backend-Ausbau mit Konten, Berechtigungen, Betrieb und laufender Betreuung. Diese Funktionen sind aktuell nicht eingebaut und keine Voraussetzung für den Verkauf der beschriebenen lokalen App.

## Was du gegenwärtig zusagen kannst

Zusagen beziehen sich auf die tatsächlich geprüften Funktionen: lokale Betriebsorganisation, Kalkulation nach eingegebenem Aufmaß, Dienstleistungskatalog, Geräteplanung und Einnahmen-/Ausgabenübersicht. Die Sprachfunktion verwendet den Dienst und die Stimmen des jeweiligen Geräts; eine bestimmte männliche Stimme und vollständige Offline-Spracherkennung sind nicht auf jedem Handy vorhanden. Das optionale Bildmodell schlägt Kategorien vor und ersetzt kein bestätigtes Aufmaß.

Die Finanzansicht ist keine amtliche EÜR und keine nachgewiesen GoBD-konforme Buchhaltung. Ein allgemeiner KI-Assistent mit frei verfügbarem Wissen, automatische Steuerberatung, Bank-/DATEV-Anbindung und vollständige rechtliche Konformität werden durch den aktuellen Stand nicht gewährleistet. Diese Grenzen gehören in die Leistungsbeschreibung, damit Käufer das vorhandene Produkt passend einsetzen können.
