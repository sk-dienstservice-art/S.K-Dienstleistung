# WerkPilot 5.0 – Prüfbericht und Lieferstand

Stand: 08.10.2026. Version 5.0 ist im Quellprojekt umgesetzt. Der vollständige automatische Lauf von `npm test` endet mit Exit-Code 0: **347 Node-Testfälle und 16 zusätzliche bestehende UI-Regressionen** bestehen. Dazu kommen die separaten Workflow-, Render-, Formular-, Sprachablauf-, Paketstart- und nativen Adapterprüfungen.

Ein Android-APK wurde hier weder gebaut noch signiert oder auf einem Handy installiert. Ein vorhandenes APK erhält diese Änderungen erst durch ein neu gebautes, passend signiertes Update. Die zuvor gemeldete allgemeine Foto-Fehlermeldung belegt keine bestimmte Ursache auf dem alten Handy; diese bleibt ohne Gerätetest offen.

## Aktueller Funktionsstand

| Bereich | Umsetzung und geprüfte Grenzen |
| --- | --- |
| Betrieb und Preise | Eigenes Firmenbranding, Einrichtungsfortschritt und anpassbare Leistungs-/Fahrtsätze. Ungültige Firmen- und Kostenwerte werden vor dem Speichern abgewiesen. Gespeicherte Aufträge und Dokumente behalten ihre Kosten- und Preisbasis. |
| Fachkatalog | **59 Leistungsvorlagen in 17 Bereichen**: Garten/Landschaft, Reinigung und 15 Handwerksbereiche. Eigene Beschreibungen, Einheiten und Personenminuten sind möglich. Fachfragen, Ausstattung und Leistungsgrenzen sind lokal verfügbar. Vorlagenpreise und Verbrauchsannahmen bleiben bearbeitbare Planwerte. |
| Material und Maschinen | Mengen- und Ausstattungsvorschläge aus dem bestätigten Leistungsumfang. Tatsächliche Einsatz-/Mietpreise müssen bestätigt werden, auch 0 €. Kaufannahmen werden nicht als Miete übernommen. Übernehmen ersetzt bestehende Material-/Maschinenkosten erst nach Bestätigung; Katalog-Verbrauchsmaterial wird danach nicht doppelt gerechnet. Mengenänderungen benötigen eine erneute Bestätigung; eigene Zusatzpositionen und bekannte Einkaufspreise bleiben beim Aktualisieren erhalten. |
| Planung und Gewinn | Centgenaue Positionssummen, null Umsatzsteuer bei Kleinunternehmern/anderer Befreiung und konsistente Bruttokosten bei diesen Steuermodi. Terminüberschneidungen über Mitternacht werden erkannt. Gespeicherte Kostenannahmen, bestätigte tatsächliche Nullstunden und eingefrorener Rechnungsumsatz werden in der Nachkalkulation berücksichtigt. Gewinn ist ein Plan- bzw. Nachkalkulationswert nach den erfassten Angaben. |
| Angebote | Nummerierte, eingefrorene Kunden-/Firmen-/Leistungs-/Kosten-/Preisstände mit Gültigkeit und Statusverlauf. Versand und Kundenentscheidung werden ausdrücklich dokumentiert; eine E-Mail-Aktion öffnet nur einen Entwurf. Zurückziehen bewahrt die Historie und erlaubt eine neue Angebotsnummer. Angebote buchen keinen Zahlungseingang. |
| Aufmaß und Freigabe | Fehlendes Aufmaß, unbestätigte Ressourcen oder erforderliche Fach-/Sicherheits-/Zulassungsangaben ergeben einen vorläufigen Angebotsentwurf. Die App blockiert eine dokumentierte Annahme solcher Stände. Neue Angaben am Auftrag verändern einen alten Angebotsstand nicht; für die Freigabe ist ein neuer geprüfter Stand nötig. Checkboxen dokumentieren Angaben und ersetzen keine tatsächliche fachliche Prüfung. |
| Fotos | Mehrere Detail-/Vorher-/Nachherbilder, lokale Aufbereitung sowie Bildart und Beschreibung. Bestätigte Fotoleistungen ergänzen den bestehenden Entwurf; neue Fotoentwürfe enthalten keine erfundene Leistung, Menge oder Anfahrt. Späte Bild-/Analyseergebnisse überschreiben keine neuere Auswahl. Metadaten bleiben bei Bildwechsel/Nachladen erhalten und werden beim erneuten Anhängen ohne Bildduplikate aktualisiert. Alte Angebotsbilder bleiben eingefroren. |
| Bildmodell | Optionaler Erstdownload über jsDelivr/Hugging Face, ohne eigenen API-Key. Gepinntes Transformers.js-3.7.2-Browserbundle, CLIP mit q8, WASM-Einzelthread und ohne Proxy-Worker. Fortschritt, Stoppen, Wiederholen sowie unterscheidbare Verbindungs-, CSP-, Speicher- und WASM-Fehler. Schwache Vergleiche führen zu Alternativen und manueller Auswahl; ein Gewerkefoto bestätigt keine konkrete Tätigkeit oder Maße. Die Hardwareausführung ist noch offen. |
| Sprache | Mehrteilige Fragen, Zahlwörter und konkrete Handwerksleistungen mit passenden Mengen/Einheiten; Fahrt, Material, Maschinenmiete und Entsorgung bleiben getrennt. Unklare Umfänge führen zur Rückfrage. Kostenkorrekturen erhalten bekannte Positionen. Neue Sprachaufträge erfinden keine Kilometer. Deutsche Stimmenauswahl und kurze Antworten sind vorbereitet; verfügbare Männerstimme, Offline-Erkennung und reale Reaktionszeit hängen vom Gerät ab. |
| Finanzen und Sicherung | Zahlungen mit gültigen Daten und Restbetrag, Schutz gegen Doppelabsenden, Ausgabenkorrektur mit Belegfoto und Auftragszuordnung. Schreibfehler rollen zum letzten gespeicherten Bestand zurück. Datenmodell 3 prüft alte/neue Sicherungen, Referenzen, Angebots-/Rechnungsstände, Ressourcen, Aufmaß, Zahlungen und Bildmetadaten vor Übernahme. |
| Region und Alltag | Anpassbarer Standort Mitwitz, getrennte Fahrtsätze, lokale Fachfragen und quellenbezogene Kronacher Entsorgungsannahme. Ortsnamen ergeben keine erfundene Entfernung. „Heute wichtig“, Kundenkontakte, Tagespackliste, Kalenderexport, offene Forderungen und fehlende Abrechnung sind aus den gespeicherten Daten erreichbar. |
| Oberfläche und Installation | Handwerkskatalog, Einsatzplan und Fotoarbeitsplatz sind integriert. Galerie, fünf Planungsschritte, Ressourcenfelder und Statusanzeigen wurden statisch auf responsive Darstellung korrigiert. PWA-Manifest, PNG-Icons, bestätigte Installationszustände und begrenzter Offline-Cache sind automatisiert geprüft; tatsächliches Rendering und Installation bleiben Gerätetests. |
| Android | Version 5.0/50, SDK 35, AGP 8.9.2 und Gradle 8.11.1. Originaler vollständiger Wrapper mit gradlew, gradlew.bat, Wrapper-JAR und Properties liegt bei; JAR-SHA256 wurde gegen die offizielle Prüfsumme verifiziert, Distributions-SHA256 ist gepinnt. Kein Bootstrap vor Android Studio nötig. Native Bridge-/Sprach-/Quellcodeprüfungen bestehen; Build und PowerShell-Ausführung sind hier nicht erfolgt. |

## Prüfnachweise

Der vollständige Lauf ist in der Arbeitsumgebung unter `/tmp/werkpilot-v5-tests.log` protokolliert. Die 18 Node-Testzusammenfassungen ergeben zusammen 347 Fälle, alle mit null Fehlern. Die 16 zusätzlichen Legacy-UI-Regressionen werden separat gezählt.

| Ergänzte V5-Prüfungen | Bestandene Fälle |
| --- | ---: |
| Handwerkskatalog und Materialannahmen | 24 |
| Einsatz-/Ressourcenplanung | 17 |
| Fotoaufbereitung | 8 |
| Bildmodellcontroller mit simuliertem Laufzeitmodul | 20 |
| Sprachverständnis für Handwerk | 24 |
| Handwerks-, Ressourcen- und Foto-UI mit DOM-Doubles | 23 |
| Bestehende Pro-UI-Integration | 18 |

Weitere bestandene Prüfungen betreffen Kalkulation, Kleinunternehmer, Daten-/Geschäftsregeln, Sprache, Backup, Angebote, Fachwissen, PWA und Paketstart. Renderprüfungen umfassen **20 leere Ansichten und 8 mit Beispielbetrieb**. Der Standard-Bundler trennt Modulnamensräume; die Ein-Datei-Version startet im Pakettest einschließlich Datenladen und direktem Ansichtsaufruf. Native Prüfungen verwenden simulierte Bridge-Callbacks und statische Android-Quellcode-/Wrapperprüfungen.

Die Bildkonfiguration wurde zusätzlich gegen die offiziellen Dateien geprüft: q8 erwartet das vorhandene kombinierte Modell model_quantized.onnx (153.695.702 Bytes). Zusammen mit Bibliothek, Tokenizer und WASM sind ungefähr 180 MB Erstdownload plausibel; die Anzeige „bis ca. 200 MB“ passt. Diese Kontrolle lädt kein vollständiges Modell und führt keine Inferenz aus. Quellen: [Transformers.js 3.7.2](https://github.com/huggingface/transformers.js/tree/3.7.2), [Modellmetadaten](https://huggingface.co/Xenova/clip-vit-base-patch32/raw/main/onnx/model_quantized.onnx), [CDN-Dateien](https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/).

## Offene praktische Prüfungen

- **Browserdarstellung und Screenshots:** Chromium konnte hier wegen EPERM nicht starten. Markup, CSS und simulierte DOM-Abläufe sind geprüft; ein tatsächlicher visueller Nachweis liegt nicht vor.
- **Android-Build und Update:** SDK/Buildumgebung fehlen. APK/AAB, Signierung, Installation und ein Update mit alten Geschäftsdaten müssen am vorgesehenen Build-/Testsystem geprüft werden. Die PowerShell-Skripte wurden hier nicht ausgeführt.
- **Sprache am Gerät:** Mikrofonberechtigungen, deutscher Sprachdienst, hörbare Männerstimme, Reaktionszeit und Offline-Verfügbarkeit benötigen reale Tests.
- **Fotos am Gerät:** Galerie/Kamera, erster Modellstart, Cache, Speicherbedarf und echte CLIP-Inferenz auf den vorgesehenen Geräten sind offen. Die Ursache des früheren Fotoerkennungsfehlers am alten Handy ist weiterhin nicht nachgewiesen.
- **Ausgabe und Datenübernahme:** Native Dateiauswahl, externer JSON-Export/-Restore, PDF-Druck und Kalenderexport müssen praktisch geprüft werden. Android-Exporte sind auf 20 MB je Datei begrenzt; Browser und Android-App teilen ihren Speicher nicht automatisch.

## Voraussetzungen für Verkauf und Auslieferung

Das Quellprojekt ist kein bereits ausgeliefertes Android-Release. Für zahlende Betriebe fehlen weiterhin ein gebautes und signiertes Release, Geräte-/Updateprüfungen und die zum Vertrieb passenden Anbieter-, Lizenz-, Support- und Datenschutzunterlagen. Die konkreten Schritte stehen in [VERKAUFSSTART.md](VERKAUFSSTART.md); die Buildanleitung in [android/README.md](android/README.md). Eine Store-Veröffentlichung wurde hier nicht durchgeführt.

Die App führt lokale Daten pro Gerät. Lizenzserver, gemeinsame Teamdaten und automatische Cloud-Synchronisation sind nicht eingebaut. Die Finanzübersicht erzeugt keine amtliche EÜR, nachgewiesen GoBD-konforme Ablage oder strukturierte E-Rechnung. Fachassistent und Bildvorschläge ersetzen weder bestätigtes Aufmaß noch fachliche Ausführungsprüfung.
