# WerkPilot 5.0 – Pro-UI-Integrationsprüfung

Stand: 08.10.2026. Firmenarbeitsplatz, Angebote, eigene Leistungspreise, Handwerkskatalog, Einsatzplan und Fotoarbeitsplatz sind im aktuellen Quellprojekt verbunden. **18 Pro-UI-Tests und 23 neue Handwerks-/Foto-UI-Tests bestehen.** Der vollständige `npm test`-Lauf endet mit Exit-Code 0: 347 Node-Testfälle plus 16 separat gezählte bestehende UI-Regressionen.

Das ist eine automatisierte Integrationsprüfung mit VM, DOM- und Controller-Doubles sowie statischen Quellcodeprüfungen. Ein gerendertes Browser-/Android-Release wurde hier nicht geprüft.

## Geprüfte Produktabläufe

| Ablauf | Bestätigtes Verhalten |
| --- | --- |
| Eigenen Betrieb einrichten | Firmenbranding wird sicher dargestellt; fehlende Angaben führen zu erreichbaren Einrichtungsschritten. Ungültige Firmennamen und Kostenwerte werden vor Speicherung abgewiesen. Der lokale Arbeitsplatz zeigt keine fiktive Anmeldung oder Lizenzaktivierung. |
| Leistung wählen | 59 Vorlagen in 17 Bereichen; Gewerke-, Planungs- und Fotoansicht sind erreichbar. Handwerksaufträge zeigen ihr tatsächliches Gewerk statt eines Reinigungsbadges. Neue Handwerksentwürfe verwenden eigene Sätze ohne erfundene Anfahrt; weitere Leistungen ergänzen den vorhandenen Entwurf. |
| Eigenen Umfang beschreiben | Beschreibung, Einheit und Personenminuten lassen sich bearbeiten. Kundendruck stellt eingegebene Texte sicher dar. Die Minuten beeinflussen die interne Zeit-/Kostenplanung; gespeicherte Angebote behalten den ursprünglichen Stand. |
| Material und Maschinen planen | Vorschläge benötigen tatsächliche bestätigte Einsatzpreise, auch bei Bestand und 0 €. Kaufpreise werden nicht als Miete gerechnet. Bestehende Zusatzkosten werden nur nach ausdrücklicher Bestätigung ersetzt. Bestätigte Ressourcen ändern die Kalkulation ohne doppelte Katalog-Verbrauchskosten; Kundendruck benennt Material/Maschinen ohne interne Beschaffungsnotizen. |
| Auftrag speichern und sichern | Ungültige Ressourcen verhindern Änderungen am gespeicherten Auftrag. Backup erhält Ressourcen, eigene Zeiten/Einheiten, Aufmaß, Bildmetadaten und eingefrorene Angebotsstände. |
| Angebot versenden und überarbeiten | Ein Angebot erhält Nummer, Gültigkeit und unveränderlichen Kunden-/Firmen-/Preisstand. E-Mail öffnet nur einen Entwurf und bestätigt keinen Versand. Versand, Annahme, Ablehnung und Zurückziehen werden bewusst dokumentiert. Zurückziehen erhält den alten Stand und erlaubt eine neue Nummer; Angebote buchen keinen Umsatz. |
| Aufmaß und Fachfreigabe | Unvollständige Fäll-/regulierte Handwerksaufträge drucken als vorläufiger Angebotsentwurf. Eine Annahme solcher Stände wird blockiert. Ergänzungen am aktuellen Auftrag machen ein altes Angebot nicht nachträglich freigabefähig; ein neuer geprüfter Stand ist erforderlich. Checkboxen sind dokumentierte Angaben, keine automatisch erteilte Ausführungsberechtigung. |
| Sprachauftrag kalkulieren | Mehrteilige Fragen werden zusammen verarbeitet; bekannte Positionen bleiben bei Kostenkorrekturen und Mengenrückfragen erhalten. Eigene Preise, Fahrtzeit, Material und Gerätemiete werden getrennt übernommen. Unbestimmte Handwerksumfänge oder falsche Einheiten erzeugen Rückfragen; neue Sprachaufträge erfinden keine Kilometer. |
| Foto erkennen und bestätigen | Gepinnte Transformers.js-3.7.2-/q8-/WASM-Einzelthread-Konfiguration; Laden erst auf Anforderung. Fortschritt, Stoppen, Wiederholen und technische Fehlermeldung sind angeschlossen. Schwache Vergleiche übernehmen keine Leistung oder Menge. Ein erkannter Handwerksbereich verlangt die konkrete Tätigkeit; erst eine ausdrücklich bestätigte Leistung mit gültiger Menge ergänzt die Kalkulation. |
| Mehrere Fotos dokumentieren | Späte ältere Dateiverarbeitung und Analyse überschreiben keine neuere Auswahl. Vorher-/Nachher-/Detailangaben und Beschreibungen bleiben bei Wechsel und weiterer Dateiauswahl erhalten. Erneutes Anhängen aktualisiert Metadaten ohne Bildduplikate; bereits gespeicherte Angebote behalten ihre alten Fotos. Foto-only-Entwürfe enthalten keine erfundene Leistung oder Anfahrt. |

## Prüfungen und Aussagekraft

| Testdatei | Fälle | Art |
| --- | ---: | --- |
| tests/pro-ui.test.mjs | 18 | App-Handler mit VM und DOM-Doubles |
| tests/handwork-ui.test.mjs | 23 | Handwerk, Ressourcen und Fotos mit VM/DOM-/Controller-Doubles |
| tests/trades.test.mjs | 24 | Katalog, Einheiten und Materialannahmen |
| tests/planner.test.mjs | 17 | Ressourcen, bestätigte Kosten, Aktualisierung und Kalkulation |
| tests/photos.test.mjs | 8 | Bildaufbereitung mit simulierten Plattform-APIs |
| tests/vision.test.mjs | 20 | Lade-/Analysecontroller mit simuliertem Laufzeitmodul |
| tests/speech-trades.test.mjs | 24 | Konkrete Gewerke, Mengen, Einheiten und Gesprächskontext |
| tests/audit-ui.test.mjs | 16 separate Regressionen | Bestehende App-Abläufe mit DOM-Doubles |

Der vollständige Lauf ist in `/tmp/werkpilot-v5-tests.log` dokumentiert. Die VM-Harnesses verwenden den Standard-Bundler und alle importierten Fachmodule; Modulnamensräume bleiben getrennt. Paketstart und 20 leere Ansichten sowie 8 Ansichten mit Beispielbetrieb bestehen zusätzlich. Native Adapter-/Quellcodeprüfungen und die Prüfung des vollständigen originalen Gradle-Wrappers bestehen; sie ersetzen keine Android-Kompilierung.

Galerie, fünf Planungsschritte, Ressourcenfelder und Statusanzeigen wurden im Markup/CSS statisch korrigiert. Daraus folgt noch kein bestätigtes Layout auf realen Bildschirmgrößen.

Ausführen:

```sh
node tests/pro-ui.test.mjs
node tests/handwork-ui.test.mjs
node tests/audit-ui.test.mjs
npm test
```

## Offene praktische Prüfung

Chromium startet in dieser Umgebung wegen EPERM nicht; Browser-Screenshots und tatsächliche responsive Darstellung sind nicht geprüft. Android-APK/AAB-Build, Signierung, Installation und Update wurden hier ebenfalls nicht durchgeführt. Der originale Wrapper einschließlich JAR, gradlew und gradlew.bat liegt vollständig und mit geprüften SHA256-Angaben vor; die PowerShell-Skripte wurden hier nicht ausgeführt.

Mikrofon, hörbare Männerstimme, Reaktionszeit, native Galerie/Dateiauswahl, PDF-Druck und echte Bildmodellausführung auf Hardware bleiben offen. Öffentliche Modell-/CDN-Metadaten bestätigen die gewählte Konfiguration; 20 Controller-Mocktests belegen keine reale Inferenz. Die frühere allgemeine Foto-Fehlermeldung lässt die konkrete Ursache auf dem alten Handy weiterhin offen.

Vor kommerzieller Auslieferung bleiben signierter Build, Geräte-/Updateprüfungen und passende Verkaufs-/Support-/Datenschutzunterlagen erforderlich. [PRUEFBERICHT.md](PRUEFBERICHT.md), [VERKAUFSSTART.md](VERKAUFSSTART.md) und [android/README.md](android/README.md) beschreiben Lieferstand und nächste Schritte.
