# Windows PowerShell 5.1 or PowerShell 7.
# Builds a real debug APK locally. Does not install SDK packages or create a release key.
[CmdletBinding()]
param(
    [string]$ProjectRoot = $PSScriptRoot,
    [string]$JavaHome = '',
    [string]$SdkRoot = ''
)

$ErrorActionPreference = 'Stop'
$WerkPilotUtf8 = New-Object System.Text.UTF8Encoding($false)
$WerkPilotSelectedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
if (Test-Path -LiteralPath (Join-Path $WerkPilotSelectedRoot 'android\settings.gradle')) {
    $WerkPilotAndroidRoot = Join-Path $WerkPilotSelectedRoot 'android'
} elseif (Test-Path -LiteralPath (Join-Path $WerkPilotSelectedRoot 'settings.gradle')) {
    $WerkPilotAndroidRoot = $WerkPilotSelectedRoot
} else {
    throw 'Projekt fehlt. ProjectRoot muss auf android/ oder den gemeinsamen WerkPilot-Projektordner zeigen.'
}
$WerkPilotWebRoot = Join-Path (Split-Path -Parent $WerkPilotAndroidRoot) 'dist'
foreach ($WerkPilotRequired in @('index.html', 'app.js', 'native.js')) {
    if (-not (Test-Path -LiteralPath (Join-Path $WerkPilotWebRoot $WerkPilotRequired) -PathType Leaf)) {
        throw "Web-Datei fehlt: dist/$WerkPilotRequired. Das komplette ZIP entpacken, nicht nur android/."
    }
}

$WerkPilotJdkCandidates = New-Object 'System.Collections.Generic.List[string]'
if ($JavaHome) { $WerkPilotJdkCandidates.Add($JavaHome) }
else {
    if ($env:JAVA_HOME) { $WerkPilotJdkCandidates.Add($env:JAVA_HOME) }
    if ($env:ProgramFiles) { $WerkPilotJdkCandidates.Add((Join-Path $env:ProgramFiles 'Android\Android Studio\jbr')) }
    if ($env:LOCALAPPDATA) { $WerkPilotJdkCandidates.Add((Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr')) }
}
$WerkPilotJdkPath = $null
foreach ($WerkPilotCandidate in $WerkPilotJdkCandidates) {
    $WerkPilotRelease = Join-Path $WerkPilotCandidate 'release'
    if (-not (Test-Path -LiteralPath (Join-Path $WerkPilotCandidate 'bin\java.exe') -PathType Leaf)) { continue }
    if (-not (Test-Path -LiteralPath (Join-Path $WerkPilotCandidate 'bin\javac.exe') -PathType Leaf)) { continue }
    if (-not (Test-Path -LiteralPath $WerkPilotRelease -PathType Leaf)) { continue }
    $WerkPilotVersion = [regex]::Match([System.IO.File]::ReadAllText($WerkPilotRelease), '(?m)^JAVA_VERSION="(\d+)')
    if ($WerkPilotVersion.Success -and $WerkPilotVersion.Groups[1].Value -in @('17', '21')) {
        $WerkPilotJdkPath = (Resolve-Path -LiteralPath $WerkPilotCandidate).Path
        break
    }
}
if (-not $WerkPilotJdkPath) {
    throw 'Vollstaendiges JDK 17 oder 21 fehlt. Android Studio installieren oder -JavaHome "C:\Pfad\zum\jdk-21" angeben.'
}

$WerkPilotLocalProperties = Join-Path $WerkPilotAndroidRoot 'local.properties'
$WerkPilotLocalText = if (Test-Path -LiteralPath $WerkPilotLocalProperties) { [System.IO.File]::ReadAllText($WerkPilotLocalProperties) } else { '' }
$WerkPilotSdkCandidates = New-Object 'System.Collections.Generic.List[string]'
if ($SdkRoot) { $WerkPilotSdkCandidates.Add($SdkRoot) }
else {
    $WerkPilotSdkMatch = [regex]::Match($WerkPilotLocalText, '(?m)^\s*sdk\.dir\s*[=:]\s*(.*)$')
    if ($WerkPilotSdkMatch.Success) {
        $WerkPilotSdkProperty = [regex]::Replace($WerkPilotSdkMatch.Groups[1].Value.Trim(), '\\(u[0-9a-fA-F]{4}|.)', {
            param($WerkPilotEscaped)
            $WerkPilotValue = $WerkPilotEscaped.Groups[1].Value
            if ($WerkPilotValue -match '^u[0-9a-fA-F]{4}$') { return [string][char][Convert]::ToInt32($WerkPilotValue.Substring(1), 16) }
            return $WerkPilotValue
        })
        if ($WerkPilotSdkProperty) { $WerkPilotSdkCandidates.Add($WerkPilotSdkProperty) }
    }
    if ($env:ANDROID_HOME) { $WerkPilotSdkCandidates.Add($env:ANDROID_HOME) }
    if ($env:ANDROID_SDK_ROOT) { $WerkPilotSdkCandidates.Add($env:ANDROID_SDK_ROOT) }
    if ($env:LOCALAPPDATA) { $WerkPilotSdkCandidates.Add((Join-Path $env:LOCALAPPDATA 'Android\Sdk')) }
}
$WerkPilotSdkPath = $null
foreach ($WerkPilotCandidate in $WerkPilotSdkCandidates) {
    if (-not (Test-Path -LiteralPath (Join-Path $WerkPilotCandidate 'platforms\android-35\android.jar') -PathType Leaf)) { continue }
    if (-not (Test-Path -LiteralPath (Join-Path $WerkPilotCandidate 'build-tools\35.0.0\aapt2.exe') -PathType Leaf)) { continue }
    $WerkPilotSdkPath = (Resolve-Path -LiteralPath $WerkPilotCandidate).Path
    break
}
if (-not $WerkPilotSdkPath) {
    throw 'SDK 35 / Build-Tools 35.0.0 fehlen. In Android Studio > SDK Manager beides installieren, danach erneut starten. Anderer SDK-Ordner: -SdkRoot "C:\Android\Sdk".'
}

$WerkPilotOldJavaHome = $env:JAVA_HOME
$WerkPilotHadJavaHome = Test-Path Env:JAVA_HOME
$WerkPilotOldAndroidHome = $env:ANDROID_HOME
$WerkPilotHadAndroidHome = Test-Path Env:ANDROID_HOME
$WerkPilotOldSdkRoot = $env:ANDROID_SDK_ROOT
$WerkPilotHadSdkRoot = Test-Path Env:ANDROID_SDK_ROOT
try {
    $env:JAVA_HOME = $WerkPilotJdkPath
    $env:ANDROID_HOME = $WerkPilotSdkPath
    $env:ANDROID_SDK_ROOT = $WerkPilotSdkPath
    $WerkPilotWrapper = Join-Path $WerkPilotAndroidRoot 'gradlew.bat'
    if (-not (Test-Path -LiteralPath $WerkPilotWrapper -PathType Leaf)) {
        Write-Host 'Fehlender Gradle-Wrapper wird mit geprueftem Bootstrap erzeugt.'
        & (Join-Path $WerkPilotAndroidRoot 'Initialize-WerkPilotWrapper.ps1') -ProjectRoot $WerkPilotAndroidRoot -JavaHome $WerkPilotJdkPath
    }
    foreach ($WerkPilotRelative in @('gradlew', 'gradlew.bat', 'gradle\wrapper\gradle-wrapper.jar', 'gradle\wrapper\gradle-wrapper.properties')) {
        if (-not (Test-Path -LiteralPath (Join-Path $WerkPilotAndroidRoot $WerkPilotRelative) -PathType Leaf)) {
            throw "Wrapper unvollstaendig: $WerkPilotRelative fehlt. Bestehende Dateien werden nicht automatisch ersetzt."
        }
    }
    $WerkPilotWrapperJar = Join-Path $WerkPilotAndroidRoot 'gradle\wrapper\gradle-wrapper.jar'
    if ((Get-FileHash -LiteralPath $WerkPilotWrapperJar -Algorithm SHA256).Hash.ToLowerInvariant() -ne '2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046') {
        throw 'Vorhandenes Wrapper-JAR entspricht nicht dem geprueften Gradle-8.11.1-Wrapper.'
    }
    $WerkPilotWrapperProperties = [System.IO.File]::ReadAllText((Join-Path $WerkPilotAndroidRoot 'gradle\wrapper\gradle-wrapper.properties'))
    if ($WerkPilotWrapperProperties -notmatch '(?m)^distributionUrl=https\\?://services\.gradle\.org/distributions/gradle-8\.11\.1-bin\.zip\s*$'
        -or $WerkPilotWrapperProperties -notmatch '(?m)^distributionSha256Sum=f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6\s*$') {
        throw 'Gradle-Wrapper-Konfiguration passt nicht zu Version 8.11.1 mit gepinnter SHA256.'
    }

    # local.properties is ignored by Git and contains only this computer's SDK location.
    # Encode non-ASCII characters for the Java properties format (e.g. German user names).
    $WerkPilotSdkValue = New-Object System.Text.StringBuilder
    foreach ($WerkPilotCharacter in $WerkPilotSdkPath.Replace('\', '/').ToCharArray()) {
        if ([int]$WerkPilotCharacter -gt 126) { [void]$WerkPilotSdkValue.Append(('\u{0:x4}' -f [int]$WerkPilotCharacter)) }
        else { [void]$WerkPilotSdkValue.Append($WerkPilotCharacter) }
    }
    $WerkPilotPropertiesText = [regex]::Replace($WerkPilotLocalText, '(?m)^\s*sdk\.dir\s*[=:].*(\r?\n|$)', '')
    [System.IO.File]::WriteAllText($WerkPilotLocalProperties, $WerkPilotPropertiesText.TrimEnd() + "`n" + 'sdk.dir=' + $WerkPilotSdkValue.ToString() + "`n", $WerkPilotUtf8)
    Write-Host "JDK: $WerkPilotJdkPath"
    Write-Host "SDK: $WerkPilotSdkPath"
    Write-Host 'Debug-APK wird gebaut. Beim ersten Mal werden offizielle Build-Abhaengigkeiten heruntergeladen.'
    $WerkPilotPreviousErrorAction = $ErrorActionPreference
    try {
        # Windows PowerShell 5 can turn harmless native stderr output into exceptions.
        # The native process exit code, not the presence of stderr, decides success.
        $ErrorActionPreference = 'Continue'
        & $WerkPilotWrapper '--no-daemon' '--console=plain' '-p' $WerkPilotAndroidRoot ':app:assembleDebug'
        $WerkPilotBuildExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = $WerkPilotPreviousErrorAction }
    if ($WerkPilotBuildExit -ne 0) { throw "APK-Build fehlgeschlagen (Gradle Exit $WerkPilotBuildExit). Kein erfolgreicher Build wird behauptet." }
    $WerkPilotApk = Join-Path $WerkPilotAndroidRoot 'app\build\outputs\apk\debug\app-debug.apk'
    if (-not (Test-Path -LiteralPath $WerkPilotApk -PathType Leaf) -or (Get-Item -LiteralPath $WerkPilotApk).Length -eq 0) {
        throw 'Gradle meldet Erfolg, aber das erwartete APK fehlt oder ist leer.'
    }
    $WerkPilotMetadata = Join-Path $WerkPilotAndroidRoot 'app\build\outputs\apk\debug\output-metadata.json'
    if (-not (Test-Path -LiteralPath $WerkPilotMetadata -PathType Leaf)) { throw 'APK-Metadaten fehlen; Version kann nicht geprueft werden.' }
    $WerkPilotOutput = [System.IO.File]::ReadAllText($WerkPilotMetadata) | ConvertFrom-Json
    $WerkPilotElement = @($WerkPilotOutput.elements | Where-Object { $_.outputFile -eq 'app-debug.apk' })
    if ($WerkPilotElement.Count -ne 1 -or $WerkPilotElement[0].versionCode -ne 50 -or $WerkPilotElement[0].versionName -ne '5.0') {
        throw 'Das erzeugte APK ist nicht die erwartete Version 5.0 / versionCode 50.'
    }
    Write-Host ''
    Write-Host "APK erfolgreich gebaut: $WerkPilotApk"
    Write-Host 'Debug-Version zum Testen. Ein signierter Release-Build fuer den Verkauf wird separat in Android Studio erstellt.'
    Write-Output $WerkPilotApk
} finally {
    if ($WerkPilotHadJavaHome) { $env:JAVA_HOME = $WerkPilotOldJavaHome } else { Remove-Item Env:JAVA_HOME -ErrorAction SilentlyContinue }
    if ($WerkPilotHadAndroidHome) { $env:ANDROID_HOME = $WerkPilotOldAndroidHome } else { Remove-Item Env:ANDROID_HOME -ErrorAction SilentlyContinue }
    if ($WerkPilotHadSdkRoot) { $env:ANDROID_SDK_ROOT = $WerkPilotOldSdkRoot } else { Remove-Item Env:ANDROID_SDK_ROOT -ErrorAction SilentlyContinue }
}
