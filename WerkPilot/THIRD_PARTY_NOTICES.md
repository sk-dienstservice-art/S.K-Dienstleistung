# Fremdkomponenten und Lizenztexte

Stand: 08.10.2026. Die folgenden Komponenten werden als Bauwerkzeug oder optionaler Bildruntime verwendet. Die zugehörigen offiziellen Lizenztexte liegen unter `licenses/`. WerkPilot-eigener Anwendungscode und deine Vertriebslizenz sind damit nicht gleichgesetzt; Lizenz, Lieferumfang und Support deines Produkts separat festlegen.

| Komponente | Verwendung | Lizenztext / Quelle |
| --- | --- | --- |
| Gradle Wrapper aus Gradle 8.11.1 | Originale Startskripte und Wrapper-JAR liegen im Android-Projekt. Die Distribution wird beim ersten Build mit Prüfsumme geladen. | Apache 2.0, [mitgelieferter Text](licenses/Gradle-8.11.1-LICENSE.txt), [Originalquelle](https://github.com/gradle/gradle/tree/v8.11.1). |
| Transformers.js 3.7.2 | Optionaler Browserbundle wird beim Modellstart von jsDelivr geladen. | Apache 2.0, [mitgelieferter Text](licenses/Transformers-js-3.7.2-LICENSE.txt), [Originalquelle](https://github.com/huggingface/transformers.js/tree/3.7.2). |
| ONNX Runtime | Bestandteil der Transformers.js-Browserdistribution für lokale WASM-Ausführung. | MIT, [mitgelieferter Referenztext](licenses/ONNX-Runtime-LICENSE.txt), [Originalquelle](https://github.com/microsoft/onnxruntime/tree/v1.22.0). Die Runtime-Version des verwendeten Bundles ist 1.22.0-dev.20250409-89f8206ba4. |
| OpenAI CLIP | Basis des optionalen Bildmodells; die ONNX-Konvertierung wird vom Modellrepository bezogen. | MIT für das OpenAI/CLIP-Repository, [mitgelieferter Text](licenses/OpenAI-CLIP-LICENSE.txt), [Originalquelle](https://github.com/openai/CLIP), [konvertiertes Modell](https://huggingface.co/Xenova/clip-vit-base-patch32). |

CLIP-Gewichte und die Bildbibliothek sind nicht im Quell-ZIP gebündelt. Vor einer eigenen Bündelung oder Weiterverteilung von Modelldateien deren Bedingungen und aktuelle Modellhinweise prüfen; der Text des OpenAI-Code-Repositories ersetzt keine Prüfung aller konvertierten Dateien. Angaben zur Bildfunktion und Quellen stehen in [BILDERKENNUNG.md](BILDERKENNUNG.md).

Die Wrapper-JAR enthält außerdem ihre ursprüngliche eingebettete Lizenz. Vorhandene Lizenz-/Urheberhinweise in den Startskripten beibehalten. Android SDK, Android Gradle Plugin und weitere Build-Abhängigkeiten werden aus ihren offiziellen Quellen bezogen und sind nicht als Distributionsarchive in diesem Projektpaket enthalten.
