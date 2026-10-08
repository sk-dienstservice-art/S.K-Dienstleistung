# Fotoerkennung in WerkPilot 5.0

Die bisherige Meldung „Bildmodell konnte nicht geladen oder ausgeführt werden“ hat die eigentliche Ursache verschluckt. Version 5 ersetzt diesen Ablauf durch eine geprüfte Browserbibliothek, feste WASM-Konfiguration und getrennte technische Fehlermeldungen. Die Ursache auf dem bisherigen Handy konnte ohne Gerätedaten nicht eindeutig festgestellt werden; der neue Modellstart wurde hier nicht am Gerät ausgeführt.

## Auf deinem Handy verwenden

1. Vor dem APK-Update eine externe JSON-Sicherung exportieren. Die Änderungen kommen erst mit dem neu gebauten APK auf das Handy; für ein Update dieselbe App-Kennung und Signatur verwenden.
2. Unter „Fotos & Erkennung“ JPG, PNG oder WebP wählen. HEIC vorher als JPG exportieren. Fotos werden auf maximal 1400 Pixel vorbereitet; mehrere Bilder lassen sich mit Beschreibung und Vorher-/Nachherkennzeichnung erfassen.
3. „Bild erkennen“ wählen. Für den ersten Start Internet und genug freien Arbeitsspeicher bereitstellen. Rund 180 MB Bibliotheks-/Modell-/WASM-Dateien werden vom jeweiligen Anbieter geladen; das Foto bleibt auf dem Gerät. Der Prozentsatz beschreibt eine einzelne Modelldatei, nicht den gesamten Vorgang.
4. Eine passende Leistung ausdrücklich wählen und eine gemessene Menge eingeben. Ein Handwerksmotiv ergibt zunächst einen Bereich; konkrete Tätigkeit, Zustand und sichere Ausführung werden dadurch nicht bestimmt. Bei unklarem Bild ist die manuelle Auswahl weiterhin möglich.
5. Die bestätigte Fotoleistung zur Kalkulation übernehmen; Material-/Maschinenvorschläge im Einsatzplan erstellen, reale Preise bestätigen und Zielmarge prüfen.

## Neue Fehlermeldungen

| Hinweis | Nächster Schritt |
| --- | --- |
| Keine Internetverbindung | Für den ersten Modellstart verbinden. Ein bereits in dieser Sitzung geladenes Modell kann lokal weiterarbeiten. Die erneute Initialisierung nach einem App-Neustart ohne Internet ist nicht garantiert. |
| Eine Modelldatei konnte nicht geladen werden | Verbindung prüfen, technische Meldung aufklappen und erneut versuchen. Die aktuelle native Version verwenden. |
| App-Freigaben blockieren eine Datei | Neues APK aus diesem Projekt bauen. Die bisherigen Freigaben eines fremden HTML-zu-APK-Builders können abweichen. |
| WASM/Bildverarbeitung konnte nicht gestartet werden | Android System WebView aktualisieren und App neu öffnen. |
| Gerätespeicher reicht nicht | Andere Apps schließen, kleineres Foto versuchen oder manuell fortfahren. |
| Download/Auswertung dauert zu lange | Erneut versuchen. Ein festhängender WASM-Lauf kann einen App-Neustart benötigen; Timer sind keine garantierte Unterbrechung einer blockierten CPU. |
| Kein eindeutiger Vorschlag | Tatsächliche Leistung selbst auswählen. Modellwerte sind keine kalibrierten Wahrscheinlichkeiten. |

Die Erkennung prüft keine Abmessungen, Schadstoffe, Elektrik, Dachschäden, Nester, Hygiene oder zulässige Arbeitsausführung. Materialverbrauch und Kosten werden anhand bestätigter Eingaben kalkuliert.

## Konfiguration und geprüfte Quellen

- Browserbundle: Transformers.js 3.7.2, `dist/transformers.min.js`. Die `.web`-Variante externalisiert Paketimporte und wird deshalb hier nicht eingesetzt. [Offizielle Buildkonfiguration](https://github.com/huggingface/transformers.js/blob/3.7.2/webpack.config.js).
- ONNX-WASM-Dateien aus derselben Versionsdistribution, `numThreads=1`, `proxy=false`, `device=wasm`. [ONNX-Backend](https://github.com/huggingface/transformers.js/blob/3.7.2/src/backends/onnx.js), [CDN-Dateiliste](https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/).
- Modell `Xenova/clip-vit-base-patch32`, `dtype=q8`. Die CLIP-Pipeline erwartet `onnx/model_quantized.onnx`; Datei vorhanden mit 153.695.702 Bytes laut LFS-Metadaten. [Pipeline](https://github.com/huggingface/transformers.js/blob/3.7.2/src/pipelines.js), [Quantisierung](https://github.com/huggingface/transformers.js/blob/3.7.2/src/utils/dtypes.js), [Modelldatei-Metadaten](https://huggingface.co/Xenova/clip-vit-base-patch32/raw/main/onnx/model_quantized.onnx), [Modellkarte](https://huggingface.co/Xenova/clip-vit-base-patch32).

20 Controller-/Modell-Mocktests, 8 Bildaufbereitungstests und die Fotoabläufe in den 23 neuen UI-Prüfungen bestehen. Sie ersetzen keine echte Inferenz, Mikrofonprüfung oder Android-Kompilierung.
