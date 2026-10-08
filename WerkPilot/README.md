# WerkPilot 5.0 · Handwerk & Service

App für einen Handwerks- oder Dienstleistungs-Einzelbetrieb in Deutschland: mobile Web-Oberfläche, Desktop-Version und Android-Quellprojekt. Kein eigener API-Key erforderlich. Betriebsdaten bleiben lokal auf dem jeweiligen Gerät.

## Schnell starten

`WerkPilot.html` in einem modernen Desktop-Browser öffnen. Alternativ `npm run dev` im Quellcodeverzeichnis und `http://localhost:8080` öffnen (Python 3 erforderlich, keine npm-Installation nötig).

Unter Einstellungen Firmenangaben, tatsächlichen Steuermodus und reale Kosten eintragen. Beispieldaten nur im leeren Betrieb laden. Daten bleiben im jeweiligen Browser; JSON-Sicherung regelmäßig herunterladen.

## Neu in Version 5.0

- 59 Leistungsvorlagen in 17 Bereichen: Garten/Landschaft, Reinigung, Maler/Lackierer, Trockenbau, Boden, Fliesen/Fugen, Maurer, Putz, Pflaster, Holz/Zäune, Montage, Metall, Elektro, Sanitär/Heizung/Klima, Dach, Rückbau und individuelle Leistungen. Weitere Tätigkeiten über eine eigene Beschreibung, Einheit, Personenminuten und eigene Preise erfassen. Dies ist kein vollständiges Ausführungswissen für sämtliche Fachberufe.
- Material- und Einsatzplan mit transparenten Verbrauchsvorschlägen, Verschnitt/Reserve, eigenem Werkzeugbestand, Miete und tatsächlich bestätigten Kosten. Gleiches Material aus mehreren Positionen wird zusammengeführt. Neuberechnen berücksichtigt geänderte Mengen und erhält Einkaufspreise; eigene Zusatzpositionen bleiben erhalten. Geräte-Kaufpreise werden nicht als Mietkosten berechnet.
- Bestätigte Plansummen ersetzen nach ausdrücklicher Auswahl die Material-/Maschinenfelder. Katalog-Verbrauchsmaterial wird dann nicht zusätzlich gezählt. Ein eingeplanter, unbestätigter Ressourcenplan verhindert die verbindliche Angebotsfreigabe. Herstellerangaben, Aufbau und tatsächlicher Verbrauch bleiben zu prüfen.
- Fotos mit Mehrfachauswahl und Vorher-/Während-/Nachher-/Detailkennzeichnung. Beschreibungen bleiben beim Wechsel und Nachladen erhalten; erneutes Anhängen aktualisiert Angaben ohne Bildduplikat. Kompatibler Bilddecoder bei fehlgeschlagenem ImageBitmap, JPEG-Aufbereitung bis 1400 Pixel.
- Neuer Fotoerkennungsablauf: verifiziertes Transformers.js-3.7.2-Browserbundle und passende WASM-Dateien; CLIP mit q8, einem WASM-Thread und ohne Proxy-Worker. Fortschritt, Stoppen, Wiederholen und unterscheidbare Fehler für Verbindung, App-Freigaben, Speicher und WASM. Schwache Ergebnisse führen nicht zu automatischer Leistung oder erfundener Menge. Ein Gewerkefoto bestätigt keine konkrete Ausführungsleistung.
- Lokale Bildverarbeitung ohne eigenen API-Key und ohne Hochladen der Fotos zu einem KI-Server. Beim ersten Modellstart etwa 180 MB Internetdownload einplanen. Bibliothek und Modelldateinamen wurden gegen offizielle Quellen geprüft; eine echte Modellinferenz auf dem Handy wurde hier noch nicht durchgeführt. Anleitung: [BILDERKENNUNG.md](BILDERKENNUNG.md).
- Erweiterte Sprache für alle 43 neuen Profile. Umfangsfragen verhindern einen Austauschpreis für neue Elektroinstallation, einen Modulpreis für eine komplette Küche oder einen Reinigungsansatz für einen unklaren Malerauftrag. Entfernte Altbeläge werden nicht als neue Verlegung bepreist. Lokale Regeln ersetzen kein allgemeines Sprachmodell.
- Professionellere Gewerke-, Planungs- und Fotoansichten, größere Bedienflächen, korrigierte lange Firmennamen, Angebotsfilter und Kartenabstände. Keine tatsächliche Browser-/Handydarstellung in dieser Umgebung geprüft.
- Vollständiger originaler Gradle-Wrapper im Android-Projekt, einschließlich geprüfter JAR und gepinnter Distributions-Prüfsumme. `android/` direkt in Android Studio öffnen; optionales Windows-Buildskript. Version 5.0/50, SDK 35, AGP 8.9.2, Gradle 8.11.1. Bauanleitung: [android/README.md](android/README.md).
- 347 automatisierte Tests und 16 zusätzliche UI-Regressionen bestehen. Keine hier erzeugte APK, kein Gerätetest und keine Store-Veröffentlichung.

## Neu in Version 4.0

- Firmenarbeitsplatz mit eigenem Firmennamen, Einrichtungsschritten, Angebotsverlauf und moderner Forest/Navy-Oberfläche. Separate eigene Leistungspreise und Verkaufssätze für Fahrtzeit/Kilometer. Gespeicherte Aufträge werden dadurch nicht neu bepreist.
- Nummerierte, eingefrorene Angebote mit Gültigkeit und Status Entwurf/Versendet/Angenommen/Abgelehnt/Zur Überarbeitung. E-Mail öffnet einen Entwurf; PDF selbst anhängen und tatsächlichen Versand separat dokumentieren. Überarbeitung bewahrt den alten Stand. Annahme bucht weder Zahlung noch einen Einsatz automatisch.
- Lokaler Fachkatalog für alle 16 Garten-/Landschafts-/Reinigungsleistungen: Fragen zum Aufmaß, Preisgrundlage, Ausstattung und abzugrenzende Zusatzarbeiten. Baumpflege vom Boden, Baumfällung und Grünschnitttransport sind eigenständige Positionen. Markt- und Mietpreise werden nicht erfunden.
- Ausgangsort 96268 Mitwitz; Einsatzgebiet Kronach, Sonnefeld, Stockheim und Gundelsdorf, anpassbar. Die App ermittelt keine reale Straßenentfernung: Start/Ziel festhalten, Kartenroute öffnen und bestätigte Kilometer/Gesamtfahrtzeit eingeben.
- Gewerblicher Kronach-Grünguttarif aus dem amtlich verlinkten Merkblatt Stand Januar 2025: 9 €/m³ plus 5 € je Rechnung netto. Für Kleinunternehmer wird mit angenommenen 19 % Lieferanten-Umsatzsteuer gerechnet, für Regelbesteuerer mit dem vereinfachten Nettokostenwert bei bestehender Abzugsberechtigung. Bestätigtes loses Volumen erforderlich. Baumstämme, Äste über 10 cm und Wurzelstöcke über 10 cm separat entsorgen. Aktuellen Tarif und Annahme vor Anlieferung bestätigen. Quelle und Grenzen: [REGIONALE-PREISQUELLEN.md](REGIONALE-PREISQUELLEN.md).
- Sprache erkennt Zahlwörter, Fahrzeit, Kilometer und ausdrückliche Material-/Maschinen-/Entsorgungskosten getrennt. Mehrteilige Ergebnisse werden gesammelt; eine erste abgeschlossene Frage bricht das Mikrofon nicht sofort ab. Kostenkorrekturen behalten den bisherigen Auftrag. Unklare Sammelbegriffe führen zur Rückfrage.
- Sprachvorschläge heben zu niedrige Leistungspreise anhand der erfassten Kostenbasis auf die Zielmarge an. Das sind interne Planungsannahmen, keine regionale Marktpreisgarantie. Mehr Aufwand im Formular über den Zeitfaktor und tatsächliche Kosten prüfen.
- Fällangebote verlangen Maße, Zugänglichkeit und dokumentierte Vor-Ort-Prüfung. Unvollständige Preisstände werden als Angebotsentwurf gedruckt. Erst bestätigte Angaben erlauben die verbindliche Freigabe im Angebotsablauf. Mehrere unterschiedliche Bäume getrennt aufmessen.
- Android bevorzugt ab Android 12 einen verfügbaren On-Device-Sprachdienst. Ohne passenden lokalen Dienst verwendet die App den Systemanbieter. Deutsche Offline-Modelle, Erkennungsqualität und Pausenverhalten hängen vom Gerät ab. Der Fachkatalog und die Berechnungen selbst arbeiten lokal.
- Datenmodell Version 3 übernimmt Sicherungen der Versionen 1 und 2 mit Angebotsliste und Aufmaß. Daten bleiben in IndexedDB, Android-Paket bleibt de.werkpilot.app mit versionCode 40. Vor jedem Update eine externe JSON-Sicherung anlegen und vorhandenen Signaturschlüssel beibehalten.

Für den Verkauf fehlen weiterhin ein tatsächlich gebautes/signiertes und auf Geräten geprüftes Release sowie die zu eurem Vertrieb passenden Lizenz-, Support- und Datenschutzunterlagen. Ein Verkaufsplan mit konkreten offenen Punkten steht in [VERKAUFSSTART.md](VERKAUFSSTART.md). Keine fertige APK wurde in dieser Umgebung gebaut.

## Neu in Version 3.0

- Handy-Startseite mit Monatszahlungen, Tageseinsätzen, vier Schnellaktionen und festem unteren Menü. Einheitliche Abstände, größere Bedienflächen, sichere Ränder für Systemleisten und lesbare Auftrags-, Rechnungs- und Ausgabenkarten.
- „Heute wichtig“ zeigt überfällige Restzahlungen, erledigte unberechnete Aufträge, vergangene offene Einsätze und Kalkulationen unter Zielmarge. Sicherungsexport nach sieben Tagen erinnern; der Exportzeitpunkt bestätigt keine tatsächlich aufbewahrte Datei.
- Kunden direkt anrufen, Route zur gespeicherten Adresse öffnen oder E-Mail-App öffnen; eigene Kundensuche. Öffnen einer Kontakt-App versendet nichts automatisch.
- Ausgaben korrigieren, einem anderen Auftrag zuordnen und falsch erfasste Einträge nach Bestätigung entfernen. Vorhandene Belegfotos bleiben bei einer Korrektur erhalten.
- Sichere Wiederherstellung: echte Kalenderdaten, Referenzen, Rechnungsstände, Zahlungen und Bilder werden vor dem Ersetzen geprüft. Speicherfehler rollen auf den zuletzt gespeicherten Stand zurück. Doppelte Formularsendungen werden verhindert. Ein beschädigter gespeicherter Bestand bleibt geschützt und kann als ungeprüfte Rohdaten exportiert werden.
- Terminüberschneidungen auch über Mitternacht; Konfliktprüfung beim Planen über Statuswechsel. Gespeicherte Kostenannahmen und Rechnungsumsätze bleiben für die Nachkalkulation stabil.
- Gesprochene Negationen wie „keine Hecke“ und „kein Radikalschnitt“ werden berücksichtigt. Datumshinweise verdrängen keine Kalkulation. Neue Fragen verwerfen wartende alte Sprachantworten. Fotoaufmaß ergänzt bestehende Leistungen; verspätete Ergebnisse ändern kein anderes Foto.

## Auf dem Handy installieren

**Web-App:** `dist/` muss auf einem HTTPS-Webserver liegen. Einmal öffnen, „Mehr → App installieren“ wählen und die verfügbaren Schritte befolgen. Auf Android startet nach erfolgreicher Installation das eigene Home-Symbol im App-Modus. Auf iPhone: Safari → Teilen → Zum Home-Bildschirm. Nach erfolgreichem Appshell-Download startet die Oberfläche auch ohne Internet. Erster Bildmodell-Download und der Sprachdienst können Internet benötigen. Die lokale Datei `WerkPilot.html` ist eine Desktop-Vorschau und lässt sich nicht vom Dateipfad als PWA installieren. In dieser Umgebung wurde keine HTTPS-Version veröffentlicht.

**Android-App:** `android/` und `dist/` gemeinsam entpacken. Die Oberfläche wird direkt in die App eingebaut und benötigt keinen Webserver. Native Spracheingabe/TTS, Dateiauswahl, Dateiexport und PDF-Druck sind vorbereitet. Das Android-Projekt muss zunächst in Android Studio zu einer APK gebaut werden; [genaue Anleitung](android/README.md). **Ein fertiges APK ist nicht enthalten, der Android-Code wurde hier nicht kompiliert.** SDK/Compiler/Gradle fehlten und der Download war nicht möglich. Keine Play-Store-Veröffentlichung. Native Exporte sind auf 20 MB pro Datei begrenzt.

Vor dem Wechsel von Browser/Web-App/Android-App eine JSON-Sicherung exportieren und in der neuen App importieren. Die Speicher werden nicht automatisch zusammengeführt. Nach Deinstallation ist der native App-Speicher gelöscht; eine Sicherung außerhalb der App aufbewahren.

## Sprache

- Deutscher Mengenparser für Zahlwörter, Dezimalzahlen, qm/m², Meter, Etagen, Stunden und Minuten. Mehrere Dienstleistungen pro Satz; Heckenhöhe wird nicht als Schnittlänge gezählt. Falsche Einheiten, fehlende oder mehrdeutige Mengen führen zu kurzen Nachfragen.
- Gesprächskontext: „Was brauche ich dafür?“, „Nein, hundertfünfzig Quadratmeter“, „Nein, bei der Hecke vierzig Meter“. Eine reine Zahlenantwort kann die vorher erfragte Einheit verwenden. „Ja bitte“ öffnet einen Entwurf nur nach einer konkreten Übernahmefrage. Aufträge werden nicht per Sprachsatz automatisch gespeichert.
- Mikrofon über die obere Leiste oder im Assistenten öffnen. Zwischenergebnisse erscheinen sofort im Textfeld; mehrteilige Anfragen werden bis zum Erkennungsende beziehungsweise einer kurzen Sprechpause gesammelt. Automatisches Senden standardmäßig aktiv, bei Bedarf abschaltbar. Laufende Teilergebnisse verhindern vorzeitiges Absenden.
- Kurze gesprochene Rückantwort statt vollständiger Listen/Kalkulationen; ausführliche Angaben bleiben im Chat. Lokale Interpretation ohne Sprachmodell-Download oder Inferenzanfrage. Das Sammeln zusammengehöriger Satzteile berücksichtigt eine kurze Pause; die tatsächliche Erkennungsdauer hängt vom Gerät ab.
- Deutsche Stimmenauswahl, Probehören, drei Sprechtempi und bevorzugte bekannte Männerstimmen. Lokale Männerstimmen haben Vorrang vor Netzwerkstimmen. Der Browser meldet kein zuverlässiges Geschlechtsmerkmal; die Vorauswahl verwendet bekannte Stimmennamen. Manuelle Auswahl wird respektiert. Eine nicht vorhandene Männerstimme kann die App nicht installieren oder erzeugen. Die Ansicht erklärt fehlende Stimmen.
- „Stoppen“ beendet Mikrofon und Sprachausgabe, verspätete Ereignisse werden verworfen. Optional nach jeder Antwort weiter zuhören. Beim Seitenwechsel oder Ausblenden der App stoppt die Sprachsitzung. Browserfehler wie fehlende Berechtigung, Mikrofon, Sprache oder Verbindung werden sichtbar gemeldet.
- Stimme und Spracheinstellungen bleiben in der Sicherung gespeichert; bestehende Betriebsdaten bleiben kompatibel.

Zum Start: Fachassistent öffnen, „Stimme testen“, verfügbare deutsche Männerstimme auswählen, dann Mikrofon antippen. Für Spracheingabe Chrome oder Edge mit funktionierendem Browser-Sprachdienst ausprobieren. Browser und Betriebssystem bestimmen die tatsächlich verfügbaren Stimmen. Die Spracherkennung kann einen Browser-Onlinedienst verwenden; ohne Internet ist sie nicht für jedes Gerät verfügbar. Qualität und Endpunkterkennung hängen von Mikrofon, Umgebung und Dienst ab. Sofortige Antworten in allen Browsern werden nicht garantiert. Kein freies ChatGPT-Sprachmodell und kein echter Hör-/Mikrofontest in dieser Umgebung.

## Funktionen aus Version 2

- Ausdrücklicher Kleinunternehmer-Modus nach § 19 UStG. Neue Aufträge ohne Umsatzsteuerausweis und automatischer Steuerbefreiungshinweis auf Angebots-/Rechnungsvorlagen. Bestehende Aufträge und Rechnungsstände werden beim Betriebswechsel nicht umgeschrieben.
- Ausgaben mit enthaltenem Lieferanten-Steuersatz, Belegnummer und optionaler Auftragszuordnung. Kleinunternehmer-Kostenwerte enthalten Umsatzsteuer, ohne Vorsteuerabzug. Der Steuermodus einer Ausgabe bleibt gespeichert.
- Teilzahlungen mit Datum, Zahlungsart, Notiz und centgenauem Restbetrag. Zahlungseingänge werden nach Zahlungsdatum ausgewertet. Falsch erfasste Einträge können nach Bestätigung entfernt werden; das ist keine Kunden-Rückerstattung.
- Anzeige aller offenen Rechnungen unabhängig vom Ausstellungsmonat. Zahlungserinnerungen berücksichtigen Teilzahlungen.
- Persistierte Stoppuhr für Arbeit, Fahrt und Rüsten. Zeit manuell erfassen und korrigieren; Personenminuten und monatlicher CSV-Export.
- Nachkalkulation mit gespeicherten Kostenannahmen, erfasster Zeit und zugeordneten Ausgaben. Fehlende Daten bleiben als Planannahmen erkennbar. Vollständigkeit von Zeiten und direkten Kosten wird explizit bestätigt; auch 0 € direkte Kosten sind möglich. Neue Einträge setzen die entsprechende Vollständigkeitsmarkierung zurück.
- Einzelne, wöchentliche, zweiwöchentliche und vierwöchentliche Folgeaufträge (bis 12 Termine). Überschneidungen und Radikalschnitt-Sperrzeit werden vor dem Anlegen der gesamten Serie geprüft. Fotos, Zeitdaten und abgehakte Checklisten werden nicht kopiert.
- Jahresüberwachung der Kleinunternehmer-Umsatzgrenzen, zusätzlicher Umsatz außerhalb der App, Vorjahresvergleich und Tätigkeitsbeginn. Keine automatische Einstufung des Steuerstatus.
- Jahresbericht und CSV, frei gewählte Planungsrücklage, Startcheck für Firmen- und Rechnungsangaben.
- Kompatible Übernahme von Version-1-JSON-Sicherungen. Alte Vollzahlungen werden genau einmal in Zahlungseinträge überführt. Ein alter 0-%-Satz wird nicht ungeprüft als § 19 eingestuft.

## Vorhandene Funktionen

59 Handwerks-/Dienstleistungsvorlagen, Kunden und Aufträge, Fotoanhänge, Kosten- und Margenkalkulation, Gerätebestand/Packlisten, Einsatzchecklisten, Kalender und ICS-Export. Eingefrorene Rechnungsentwürfe mit fortlaufender Nummer und druckbarer PDF-Vorlage. Regelbasierter Fachassistent, browserabhängige Spracheingabe und Sprachausgabe. Optionale lokale CLIP-Bildklassifikation via Transformers.js.

## Daten aus Version 1 übernehmen

1. In der alten App unter Einstellungen die JSON-Sicherung herunterladen.
2. Neue HTML-Datei öffnen und unter Einstellungen die Sicherung auswählen.
3. Umfang prüfen, gegebenenfalls den bestehenden neuen Datenbestand sichern und den Import bestätigen.
4. Tatsächlichen Steuermodus prüfen. Bestehende Aufträge behalten die alte Behandlung; in der Kalkulation einzeln ändern, falls erforderlich.

IndexedDB-Datenbankname ist unverändert. Bei gleicher Browser-Origin können Daten automatisch migriert werden; heruntergeladene Dateipfade und Browser verhalten sich unterschiedlich. Für eine verlässliche Übernahme die JSON-Sicherung nutzen.

## Fachliche Annahmen und Grenzen

Deutschland, Euro. Gesetzesstand am 08.10.2026 anhand der folgenden amtlichen Quellen geprüft:

- § 19 UStG: https://www.gesetze-im-internet.de/ustg_1980/__19.html
- § 34a UStDV: https://www.gesetze-im-internet.de/ustdv_1980/__34a.html
- BMF-Schreiben vom 18.03.2025, Tätigkeitsaufnahme: https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Umsatzsteuer/Umsatzsteuer-Anwendungserlass/2025-03-18-sonderregelung-kleinunternehmer.pdf?__blob=publicationFile&v=2

Allgemein: Vorjahr höchstens 25.000 €, laufendes Jahr höchstens 100.000 €; im Jahr der Tätigkeitsaufnahme überwacht die App 25.000 €. Bereits der Umsatz, der die aktuelle Grenze überschreitet, kann steuerpflichtig sein. Die App zählt gewöhnliche Garten- und Reinigungszahlungen ohne Umsatzsteuer plus manuell ergänzte zusätzliche Umsätze. Gesetzliche Sonderumsätze/Ausnahmen, andere Tätigkeiten, Steuerverzicht oder ausländische Regelungen werden nicht abschließend geprüft. Einstellungen und Umsatzdaten müssen vollständig und richtig sein. Nur echte Zahlungen buchen. Zusätzliche Umsätze nicht doppelt eintragen; die Zusatzfelder beziehen sich auf das eingestellte Überwachungsjahr und müssen beim Jahreswechsel überprüft werden.

Finanzübersicht ist eine betriebliche Einnahmen-Ausgaben-Übersicht, keine amtliche EÜR, keine vollständige steuerliche Gewinnermittlung und keine GoBD-konforme Software. Geräteauszahlungen sind enthalten, steuerliche Abschreibungen und Privatanteile fehlen. Regelbesteuerung verwendet vereinfachte Nettokosten ohne umfassende Vorsteuerprüfung. Kalkulatorische Eigenarbeit ist kein gebuchter Zahlungsabfluss. Rücklagenprozent ist ein frei gewählter Sparwert, keine Einkommensteuerberechnung.

PDF-Dokumente sind prüfbare Vorlagen. Keine automatisch strukturierte E-Rechnung, ELSTER-/Bank-/DATEV-Anbindung, Stornorechnungen, Kundenerstattungen, Mehrbenutzerrechte oder Cloud-Synchronisation. Änderungen an gespeicherten Aufträgen ändern den früheren Rechnungsstand nicht. Fehler in ausgestellten Rechnungen müssen außerhalb dieses einfachen Entwurfsablaufs fachlich korrigiert werden.

Fachassistent ist katalog- und regelbasiert, kein allgemeines ChatGPT-Modell. Spracheingabe ist browserabhängig und kann einen externen Browser-Sprachdienst verwenden. Fotoauswertung benötigt beim ersten Start Internet und bis ca. 200 MB Modelldownload (jsDelivr/Hugging Face). Das Bildmodell läuft lokal, liefert Vorschläge, keine sicheren Maße, Schäden oder Preise. Die Oberfläche verwendet Systemschriften und benötigt keinen externen Schrift-Download. Sprache und Bildmodell sind in dieser Ausführungsumgebung weiterhin nicht praktisch verifiziert.

## Prüfen und neu bauen

`npm test`: 347 gezählte Logik-, Sprach-, Backup-, Angebots-, Fachkatalog-, UI- und PWA-Tests sowie 16 zusätzliche UI-Regressionen, Workflow-, Render-, Formular-, Sprachablauf-, Paketstart- und native Adapterprüfungen. DOM-/Android-Doubles ersetzen weder echte Browserdarstellung noch Mikrofon-/Hörtest oder Android-Kompilierung. Details in [PRUEFBERICHT.md](PRUEFBERICHT.md).

`node scripts/build-download.mjs /absoluter/Pfad/WerkPilot.html`: reproduzierbare Ein-Datei-Version.

`python scripts/package-release.py --output /absoluter/Pfad`: aktuelle HTML-Version und geprüfte Quell-ZIPs erstellen. Fremdkomponenten und mitgelieferte Lizenztexte: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Echter Browsertest und Live-Veröffentlichung sind weiterhin offen. Registrierte Sites-Identität bleibt in .openai/hosting.json erhalten; es wurde keine neue Site angelegt. Die erforderlichen Sites-Publishing-Helfer sind in dieser Umgebung nicht vorhanden. Vorige Netzwerk-/Browserausführungen wurden blockiert bzw. abgebrochen. Das Downloadpaket benötigt keine Veröffentlichung.
