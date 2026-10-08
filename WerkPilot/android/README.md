# WerkPilot 5.0 für Android

Das Projekt erstellt eine Android-App mit WerkPilot-Symbol und lokaler Bedienoberfläche. `versionName` ist **5.0**, `versionCode` **50**. Der vollständige Gradle-Wrapper ist mitgeliefert: `gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar` und die Properties-Datei. Ein Bootstrap ist vor dem Öffnen in Android Studio **nicht nötig**. Hier wurde **kein APK gebaut**: Android SDK und die vollständige Buildumgebung fehlen. Die PowerShell-Skripte wurden hier nicht ausgeführt. [VERKAUFSSTART.md](../VERKAUFSSTART.md) beschreibt die noch offenen Schritte für eine kommerzielle Auslieferung.

## Android Studio: zum eigenen APK in vier Schritten

1. Das gesamte ZIP entpacken. Die Ordner `android/` und `dist/` müssen nebeneinander liegen. Nur `android/` zu entpacken reicht nicht.
2. [Android Studio](https://developer.android.com/studio) installieren. Im **SDK Manager** unter **SDK Platforms** Android SDK Platform **35** auswählen. Unter **SDK Tools → Show Package Details** Android SDK Build-Tools **35.0.0** sowie Platform-Tools installieren. Als Gradle JDK ein vollständiges **JDK 17 oder 21** verwenden; Android Studio enthält üblicherweise ein passendes JDK im Ordner `jbr`.
3. In Android Studio **Open** wählen und den entpackten Ordner `android/` öffnen. Unter **Settings → Build, Execution, Deployment → Build Tools → Gradle** die mitgelieferte Wrapper-Distribution und JDK 17/21 wählen. Gradle synchronisieren. Beim ersten Sync lädt der Wrapper Gradle 8.11.1 und die offiziellen Build-Abhängigkeiten aus dem Internet; eine globale Gradle-Installation ist nicht erforderlich.
4. **Build → Build App Bundle(s) / APK(s) → Build APK(s)** ausführen. Nach erfolgreichem Build liegt das echte Debug-APK hier:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Android Gradle Plugin **8.9.2**, Gradle **8.11.1**, SDK **35** und Build-Tools **35.0.0** sind aufeinander abgestimmt. Die mitgelieferte originale Wrapper-JAR wurde gegen die offizielle SHA256 geprüft. Die Properties-Datei enthält zusätzlich die SHA256 der Gradle-Distribution; damit prüft der Wrapper den heruntergeladenen Gradle-Inhalt vor Verwendung.

## Windows: optional über das Build-Skript

Nach Installation von Android Studio, SDK 35, Build-Tools 35.0.0 und JDK 17/21 im entpackten Ordner `android/` PowerShell öffnen:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Build-WerkPilot.ps1 -ProjectRoot .
```

Das Skript erkennt JDK und SDK, prüft den vorhandenen Wrapper und baut `:app:assembleDebug`. Es prüft Exit-Code, vorhandene APK-Datei und Ausgabe-Metadaten für Version 5.0/50. Es installiert keine SDK-Pakete, keine App und erzeugt keinen eigenen Release-Schlüssel. Die Debug-Signatur wird vom normalen Android-Buildsystem verwendet. Die Ausführungsoption gilt nur für diesen PowerShell-Prozess. Auch hier braucht der erste Build Internet für Gradle und die offiziellen Build-Abhängigkeiten.

Bei einem abweichenden Installationspfad:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Build-WerkPilot.ps1 -ProjectRoot . -JavaHome "C:\Program Files\Android\Android Studio\jbr" -SdkRoot "C:\Users\DEIN-NAME\AppData\Local\Android\Sdk"
```

Die Pfade durch die eigenen Ordner ersetzen. `JavaHome` muss `bin\java.exe` und `bin\javac.exe` enthalten. Das Build-Skript setzt den ausgewählten SDK-Pfad in der lokalen, nicht mitzuliefernden Datei `local.properties`; andere Einträge bleiben erhalten. Ein schon vorhandener Wrapper wird geprüft und nicht automatisch ersetzt.

## Wrapper-Bootstrap nur bei verlorenen Wrapper-Dateien

`Initialize-WerkPilotWrapper.ps1` bleibt als optionale Wiederherstellungshilfe enthalten. Es wird beim normalen Studio-Import nicht ausgeführt. Nur wenn der vollständige Wrapper in einer späteren Kopie fehlt, kann es die Dateien neu erzeugen:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Initialize-WerkPilotWrapper.ps1 -ProjectRoot .
```

Der optionale Bootstrap lädt die offizielle Gradle-Distribution von `services.gradle.org`, prüft ihre fest hinterlegte SHA256, erzeugt den Wrapper in einem leeren temporären Projekt und prüft zusätzlich die offizielle Wrapper-JAR-SHA256. Anschließend kopiert er die vier Wrapper-Dateien in `android/`. Prüfsummenquelle: [Gradle](https://gradle.org/release-checksums/). Der Download benötigt rund 130 MB; der erste Studio-Sync kann eine weitere Kopie für den normalen Gradle-Cache laden. Bereits vorhandene Wrapper-Dateien werden nicht überschrieben; bei einer unvollständigen vorhandenen Kopie meldet das Skript einen Fehler.

Unter macOS/Linux direkt den mitgelieferten Wrapper verwenden: falls der ZIP-Entpacker die Ausführungsrechte nicht erhalten hat, einmal `chmod +x gradlew` ausführen; anschließend `./gradlew :app:assembleDebug`. Die PowerShell-Skripte sind für Windows vorgesehen.

Für die Auslieferung an zahlende Betriebe in Android Studio **Build → Generate Signed App Bundle / APK** verwenden: eigener signierter APK-Release für direkte Installation oder App Bundle für den Play Store. Signaturschlüssel außerhalb des Quellpakets dauerhaft sichern. Updates brauchen dieselbe Signatur und einen höheren `versionCode`. Hier sind weder Schlüssel noch Passwörter hinterlegt. Mindestversion der App: Android 6.0 / API 23 mit aktuellem Android System WebView.

## Fotoerkennung und native Schutzmaßnahmen

Die v5-Fotoerkennung verwendet das gebündelte Browser-ESM von Transformers.js **3.7.2** (`dist/transformers.min.js`) und dessen zugehörige ONNX-WASM-Dateien von `cdn.jsdelivr.net`. Sie läuft mit `device: 'wasm'`, einem Thread und ohne Proxy-Worker. CLIP-Dateien werden optional von `huggingface.co` geladen; Weiterleitungen wie `cdn-lfs.huggingface.co` und `cas-bridge.xethub.hf.co` sind berücksichtigt. Nach dem Download wird das Bild auf dem Gerät klassifiziert; Aufmaß und tatsächlicher Aufwand müssen weiterhin bestätigt werden. Internet, genug Arbeitsspeicher und WebAssembly-Unterstützung des verwendeten System WebView sind nötig. Der Modellstart auf Android wurde hier nicht am Gerät geprüft.

Die bestehende CSP erlaubt hierfür jsDelivr-Skripte, `wasm-unsafe-eval` zur WebAssembly-Kompilierung und HTTPS-Modellabrufe von Hugging Face / `.hf.co`. Allgemeines JavaScript-`unsafe-eval`, fremde Frames und unverschlüsselte Verbindungen bleiben gesperrt. Für die gewählte Konfiguration ist keine zusätzliche CDN-Worker-Freigabe nötig. Die WebView lädt ausschließlich App-Dokumente unter `https://appassets.androidplatform.net/assets/`. Externe HTTPS-, E-Mail- und Telefonlinks öffnen die passende externe App; beliebiger Datei- und Content-Zugriff bleiben gesperrt.

## Vor dem ersten Einsatz am Gerät prüfen

- Kunde, Auftrag, Angebot, Rechnung und Zahlung erfassen; App neu starten und Bestand überprüfen. Start im Flugmodus prüfen.
- Fotos über die Android-Dateiauswahl importieren. Eine eigene native Kamera ist nicht eingebaut. Die Unterstützung der Dateiauswahl bei gesperrtem allgemeinem Content-Zugriff muss auf dem eigenen System WebView geprüft werden. Optionalen CLIP-Modellstart sowie den manuellen Ausweichweg ausprobieren.
- JSON-Sicherung außerhalb der App speichern und testweise wiederherstellen. Android-Exporte sind auf **20 MB je Datei** begrenzt. Browserbestand und native App teilen ihren Speicher nicht automatisch. Vor Deinstallation, Gerätewechsel oder Signaturwechsel exportieren; Deinstallation löscht App-Daten. Android-Cloud-Backups sind deaktiviert.
- Mikrofonberechtigung erteilen und einen mehrteiligen Auftrag sprechen. Zum Kontrollieren vorher automatisches Senden ausschalten. Den erkannten Text auf Vollständigkeit prüfen und ergänzen. Mikrofon und Antwort müssen beim Wechsel in den Hintergrund stoppen.
- Eine deutsche Stimme probehören. Android 12 / API 31 und neuer bevorzugt verfügbare On-Device-Erkennung; sonst wird der Systemdienst verwendet, der Internet benötigen kann. Ein deutsches Modell muss installiert sein. Die Pausenhinweise von 1.500/1.000 ms kann der Anbieter ignorieren. Eine bestimmte Männerstimme und vollständige Offline-Erkennung sind nicht auf jedem Gerät verfügbar; eigene API-Keys braucht die App nicht.
- Angebote und Rechnungen im nativen Druckdialog als PDF speichern; Empfänger, Beträge, Zahlungsziel und Seitenumbrüche kontrollieren. Der Druck nutzt eine separate WebView ohne JavaScript und ohne nachgeladene Ressourcen.
- Rücktaste / Zurück-Geste prüfen: Dialog schließen, zur Übersicht wechseln, App verlassen. Ein Update mit vorhandenen Geschäftsdaten testen.

Die fachlichen Finanzgrenzen gelten auch für Android: keine amtliche EÜR, keine nachgewiesen GoBD-konforme Buchhaltung, keine allgemeine KI oder automatische Steuerberatung. Die App speichert Betriebsdaten lokal und enthält weder Kontosynchronisation noch einen Lizenzserver.

## Adaptertest

Im gemeinsamen WerkPilot-Projektordner:

```sh
node android/tests/native.test.mjs
```

Dieser Test prüft simulierte Bridge-Callbacks und native Quellcode-Schutzregeln. Er ersetzt weder APK-Kompilierung noch Gerätetests. `dist/native.js` stellt `initNative()`, `saveNativeFile()` und `printNative()` bereit; im Browser bleiben dessen Web-APIs bestehen. Ein angeforderter Speicherdialog kann abgebrochen werden und ist keine Garantie für eine gespeicherte Sicherung.
