# Windows PowerShell 5.1 or PowerShell 7.
# This only creates the missing Gradle wrapper. It does not build or install an APK.
# Official checksum source: https://gradle.org/release-checksums/#v8.11.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,
    [string]$JavaHome = ''
)

$ErrorActionPreference = 'Stop'
$WerkPilotGradleVersion = '8.11.1'
$WerkPilotDistributionSha = 'f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6'
$WerkPilotWrapperSha = '2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046'
$WerkPilotDistributionUrl = "https://services.gradle.org/distributions/gradle-$WerkPilotGradleVersion-bin.zip"
$WerkPilotUtf8 = New-Object System.Text.UTF8Encoding($false)

$WerkPilotSelectedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
if (Test-Path -LiteralPath (Join-Path $WerkPilotSelectedRoot 'android\settings.gradle')) {
    $WerkPilotAndroidRoot = Join-Path $WerkPilotSelectedRoot 'android'
} elseif (Test-Path -LiteralPath (Join-Path $WerkPilotSelectedRoot 'settings.gradle')) {
    $WerkPilotAndroidRoot = $WerkPilotSelectedRoot
} else {
    throw 'Projekt nicht gefunden. ProjectRoot muss auf WerkPilot mit android/ und dist/ oder direkt auf android/ zeigen.'
}
$WerkPilotWebRoot = Join-Path (Split-Path -Parent $WerkPilotAndroidRoot) 'dist'
foreach ($WerkPilotRequired in @(
    (Join-Path $WerkPilotAndroidRoot 'app\build.gradle'),
    (Join-Path $WerkPilotAndroidRoot 'app\src\main\java\de\werkpilot\app\MainActivity.java'),
    (Join-Path $WerkPilotWebRoot 'index.html'),
    (Join-Path $WerkPilotWebRoot 'app.js'),
    (Join-Path $WerkPilotWebRoot 'native.js')
)) {
    if (-not (Test-Path -LiteralPath $WerkPilotRequired -PathType Leaf)) {
        throw "Projektdatei fehlt: $WerkPilotRequired. Zuerst das komplette Quellprojekt anlegen."
    }
}
if (Test-Path -LiteralPath (Join-Path $WerkPilotAndroidRoot 'gradlew.bat')) {
    throw 'gradlew.bat ist bereits vorhanden. Dieses Skript ersetzt keine vorhandenen Wrapper-Dateien.'
}
if (Test-Path -LiteralPath (Join-Path $WerkPilotAndroidRoot 'gradle\wrapper')) {
    throw 'gradle/wrapper ist bereits vorhanden. Bestehende Dateien werden nicht ueberschrieben.'
}

# Android Studio normally includes a full JDK in its jbr directory.
$WerkPilotCandidates = New-Object 'System.Collections.Generic.List[string]'
if ($JavaHome) { $WerkPilotCandidates.Add($JavaHome) }
elseif ($env:JAVA_HOME) { $WerkPilotCandidates.Add($env:JAVA_HOME) }
if ($env:ProgramFiles) { $WerkPilotCandidates.Add((Join-Path $env:ProgramFiles 'Android\Android Studio\jbr')) }
if ($env:LOCALAPPDATA) { $WerkPilotCandidates.Add((Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr')) }
$WerkPilotJdkPath = $null
foreach ($WerkPilotCandidate in $WerkPilotCandidates) {
    $WerkPilotRelease = Join-Path $WerkPilotCandidate 'release'
    if (-not (Test-Path -LiteralPath (Join-Path $WerkPilotCandidate 'bin\java.exe'))) { continue }
    if (-not (Test-Path -LiteralPath (Join-Path $WerkPilotCandidate 'bin\javac.exe'))) { continue }
    if (-not (Test-Path -LiteralPath $WerkPilotRelease)) { continue }
    $WerkPilotReleaseText = [System.IO.File]::ReadAllText($WerkPilotRelease)
    $WerkPilotVersionMatch = [regex]::Match($WerkPilotReleaseText, '(?m)^JAVA_VERSION="(\d+)')
    if ($WerkPilotVersionMatch.Success -and $WerkPilotVersionMatch.Groups[1].Value -in @('17', '21')) {
        $WerkPilotJdkPath = $WerkPilotCandidate
        break
    }
    if ($JavaHome) { throw 'Das angegebene JavaHome muss ein vollstaendiges JDK 17 oder JDK 21 enthalten.' }
}
if (-not $WerkPilotJdkPath) {
    throw 'JDK 17 oder 21 nicht gefunden. Android Studio installieren oder -JavaHome "C:\Pfad\zum\jdk-21" angeben.'
}

$WerkPilotTempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('WerkPilot-Wrapper-' + [guid]::NewGuid().ToString('N'))
$WerkPilotOldJavaHome = $env:JAVA_HOME
$WerkPilotHadJavaHome = Test-Path Env:JAVA_HOME
$WerkPilotOldTls = [Net.ServicePointManager]::SecurityProtocol
try {
    New-Item -ItemType Directory -Path $WerkPilotTempRoot | Out-Null
    $WerkPilotZip = Join-Path $WerkPilotTempRoot 'gradle.zip'
    Write-Host 'Offizielles Gradle 8.11.1 wird heruntergeladen (rund 130 MB).'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri $WerkPilotDistributionUrl -OutFile $WerkPilotZip -TimeoutSec 600
    $WerkPilotActualSha = (Get-FileHash -LiteralPath $WerkPilotZip -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($WerkPilotActualSha -ne $WerkPilotDistributionSha) {
        throw 'Gradle-Pruefsumme stimmt nicht. Die heruntergeladene Datei wird nicht ausgefuehrt.'
    }
    Write-Host 'Gradle-Pruefsumme bestaetigt. Wrapper wird mit dem lokalen Android-Studio-JDK erzeugt.'
    $WerkPilotDistributionRoot = Join-Path $WerkPilotTempRoot 'distribution'
    Expand-Archive -LiteralPath $WerkPilotZip -DestinationPath $WerkPilotDistributionRoot

    # Isolated empty project: no Android SDK or app plugin is evaluated at this point.
    $WerkPilotBootstrapRoot = Join-Path $WerkPilotTempRoot 'bootstrap'
    New-Item -ItemType Directory -Path $WerkPilotBootstrapRoot | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $WerkPilotBootstrapRoot 'settings.gradle'), "rootProject.name = 'werkpilot-wrapper-bootstrap'`n", $WerkPilotUtf8)
    [System.IO.File]::WriteAllText((Join-Path $WerkPilotBootstrapRoot 'build.gradle'), '', $WerkPilotUtf8)
    $env:JAVA_HOME = $WerkPilotJdkPath
    $WerkPilotGradleBat = Join-Path $WerkPilotDistributionRoot "gradle-$WerkPilotGradleVersion\bin\gradle.bat"
    & $WerkPilotGradleBat '--no-daemon' '--console=plain' '-p' $WerkPilotBootstrapRoot 'wrapper' '--gradle-version' $WerkPilotGradleVersion '--distribution-type' 'bin' '--gradle-distribution-sha256-sum' $WerkPilotDistributionSha
    if ($LASTEXITCODE -ne 0) { throw "Wrapper-Erzeugung fehlgeschlagen (Gradle Exit $LASTEXITCODE)." }

    $WerkPilotGeneratedJar = Join-Path $WerkPilotBootstrapRoot 'gradle\wrapper\gradle-wrapper.jar'
    $WerkPilotActualWrapperSha = (Get-FileHash -LiteralPath $WerkPilotGeneratedJar -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($WerkPilotActualWrapperSha -ne $WerkPilotWrapperSha) {
        throw 'Wrapper-JAR-Pruefsumme stimmt nicht. Keine Wrapper-Dateien werden in das Projekt kopiert.'
    }
    $WerkPilotProperties = @"
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-$WerkPilotGradleVersion-bin.zip
distributionSha256Sum=$WerkPilotDistributionSha
networkTimeout=60000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
"@
    [System.IO.File]::WriteAllText((Join-Path $WerkPilotBootstrapRoot 'gradle\wrapper\gradle-wrapper.properties'), $WerkPilotProperties + "`n", $WerkPilotUtf8)
    New-Item -ItemType Directory -Path (Join-Path $WerkPilotAndroidRoot 'gradle\wrapper') | Out-Null
    Copy-Item -LiteralPath (Join-Path $WerkPilotBootstrapRoot 'gradlew') -Destination (Join-Path $WerkPilotAndroidRoot 'gradlew')
    Copy-Item -LiteralPath (Join-Path $WerkPilotBootstrapRoot 'gradlew.bat') -Destination (Join-Path $WerkPilotAndroidRoot 'gradlew.bat')
    Copy-Item -LiteralPath $WerkPilotGeneratedJar -Destination (Join-Path $WerkPilotAndroidRoot 'gradle\wrapper\gradle-wrapper.jar')
    Copy-Item -LiteralPath (Join-Path $WerkPilotBootstrapRoot 'gradle\wrapper\gradle-wrapper.properties') -Destination (Join-Path $WerkPilotAndroidRoot 'gradle\wrapper\gradle-wrapper.properties')
    Write-Host ''
    Write-Host 'Wrapper fertig. Es wurde noch kein APK gebaut.'
    Write-Host "Jetzt in Android Studio dieses Verzeichnis oeffnen: $WerkPilotAndroidRoot"
    Write-Host 'Gradle Distribution: Wrapper; Gradle JDK: das gleiche JDK 17 oder 21.'
    Write-Host 'Im SDK Manager Android SDK Platform 35 und Build-Tools 35.0.0 installieren.'
    Write-Host 'Beim ersten Sync kann Gradle fuer den normalen Wrapper-Cache erneut heruntergeladen werden.'
    Write-Host 'Anschliessend Build > Build App Bundle(s) / APK(s) > Build APK(s).'
    Write-Host 'APK-Pfad: app\build\outputs\apk\debug\app-debug.apk'
} finally {
    if ($WerkPilotHadJavaHome) { $env:JAVA_HOME = $WerkPilotOldJavaHome }
    else { Remove-Item Env:JAVA_HOME -ErrorAction SilentlyContinue }
    [Net.ServicePointManager]::SecurityProtocol = $WerkPilotOldTls
    if (Test-Path -LiteralPath $WerkPilotTempRoot) {
        Remove-Item -LiteralPath $WerkPilotTempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
