#!/usr/bin/env python3
"""Build and verify local WerkPilot source packages; never builds or signs an APK."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tempfile
import zipfile


ROOT = Path(__file__).resolve().parents[1]
RELEASE = "5.0"
WRAPPER_SHA256 = "2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046"
DISTRIBUTION_SHA256 = "f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6"
DIRECTORIES = {"dist", "android", "scripts", "tests", "licenses"}
IGNORED_DIRECTORIES = {
    ".git", ".openai", ".gradle", ".idea", "node_modules", "build", "__pycache__",
}
SECRET_NAMES = {"local.properties", "key.properties", "keystore.properties", ".env"}
SECRET_SUFFIXES = {".jks", ".keystore", ".pem", ".key", ".p12", ".pfx"}
SOURCE_SUFFIXES = {
    ".js", ".mjs", ".py", ".css", ".html", ".json", ".webmanifest", ".png",
    ".svg", ".xml", ".gradle", ".properties", ".java", ".ps1", ".md", ".txt",
    ".bat",
}
REQUIRED = {
    "package.json", "START-HIER.txt", "README.md", "PRUEFBERICHT.md",
    "VERKAUFSSTART.md", "BILDERKENNUNG.md", "THIRD_PARTY_NOTICES.md",
    "dist/index.html", "dist/app.js", "dist/native.js", "dist/trades.js",
    "dist/planner.js", "dist/photos.js", "dist/vision.js", "dist/style.css",
    "dist/sw.js", "dist/manifest.webmanifest", "android/settings.gradle",
    "android/app/build.gradle", "android/README.md", "android/Build-WerkPilot.ps1",
    "android/gradlew", "android/gradlew.bat", "android/gradle/wrapper/gradle-wrapper.jar",
    "android/gradle/wrapper/gradle-wrapper.properties", "android/tests/native.test.mjs",
    "scripts/build-download.mjs", "scripts/bundle.mjs", "scripts/package-release.py",
    "licenses/Gradle-8.11.1-LICENSE.txt", "licenses/Transformers-js-3.7.2-LICENSE.txt",
    "licenses/ONNX-Runtime-LICENSE.txt", "licenses/OpenAI-CLIP-LICENSE.txt",
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def forbidden(path):
    return (
        any(part in IGNORED_DIRECTORIES for part in path.parts)
        or path.name in SECRET_NAMES
        or path.name.startswith(".env")
        or path.suffix.lower() in SECRET_SUFFIXES
    )


def source_files():
    files = {}
    for path in sorted(ROOT.rglob("*")):
        relative = path.relative_to(ROOT)
        if not path.is_file() or forbidden(relative):
            continue
        if path.is_symlink():
            raise ValueError("Symlink cannot be packaged: " + str(relative))
        if len(relative.parts) == 1:
            include = path.suffix == ".md" or path.name in {"package.json", "START-HIER.txt"}
        else:
            include = relative.parts[0] in DIRECTORIES and (
                path.suffix in SOURCE_SUFFIXES
                or relative.as_posix() in {
                    "android/gradlew", "android/gradle/wrapper/gradle-wrapper.jar",
                }
            )
        if include:
            files[relative.as_posix()] = path.read_bytes()
    missing = REQUIRED.difference(files)
    if missing:
        raise ValueError("Required source files missing: " + ", ".join(sorted(missing)))
    if json.loads(files["package.json"])["version"] != "5.0.0":
        raise ValueError("Unexpected package version")
    android = files["android/app/build.gradle"].decode("utf-8")
    if not re.search(r"versionCode\s+50\b", android) or "versionName '5.0'" not in android:
        raise ValueError("Unexpected Android version")
    if digest(files["android/gradle/wrapper/gradle-wrapper.jar"]) != WRAPPER_SHA256:
        raise ValueError("Gradle wrapper checksum mismatch")
    properties = files["android/gradle/wrapper/gradle-wrapper.properties"].decode("utf-8")
    if "distributionSha256Sum=" + DISTRIBUTION_SHA256 not in properties:
        raise ValueError("Gradle distribution checksum missing")
    if "gradle-8.11.1-bin.zip" not in properties:
        raise ValueError("Unexpected Gradle distribution")
    return files


def atomic_write(path, data):
    handle, name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(data)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def verify_zip(path, entries):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or set(names) != set(entries):
            raise ValueError("ZIP entries differ from planned source files")
        if archive.testzip() is not None:
            raise ValueError("ZIP CRC verification failed")
        for name, data in entries.items():
            entry_path = Path(name)
            if entry_path.is_absolute() or ".." in entry_path.parts or forbidden(entry_path):
                raise ValueError("Unexpected ZIP path: " + name)
            if archive.read(name) != data:
                raise ValueError("ZIP file differs from current source: " + name)
        wrapper_names = [name for name in names if name.endswith("android/gradlew")]
        for name in wrapper_names:
            mode = archive.getinfo(name).external_attr >> 16
            if not mode & stat.S_IXUSR:
                raise ValueError("Gradle launch script has no executable flag")


def write_zip(path, entries):
    handle, name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    os.close(handle)
    temporary = Path(name)
    try:
        with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for filename, data in sorted(entries.items()):
                entry = zipfile.ZipInfo(filename, date_time=(2026, 10, 8, 0, 0, 0))
                entry.create_system = 3
                entry.compress_type = zipfile.ZIP_DEFLATED
                mode = 0o755 if filename.endswith("android/gradlew") else 0o644
                entry.external_attr = (stat.S_IFREG | mode) << 16
                archive.writestr(entry, data)
        verify_zip(temporary, entries)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def build_html(output):
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js is needed to build the standalone HTML")
    with tempfile.TemporaryDirectory(prefix="werkpilot-package-") as temporary:
        html_path = Path(temporary) / "WerkPilot.html"
        subprocess.run([node, str(ROOT / "scripts/build-download.mjs"), str(html_path)],
                       cwd=ROOT, check=True, capture_output=True, text=True)
        data = html_path.read_bytes()
        html = data.decode("utf-8")
        modules = re.findall(r'<script type="module">([\s\S]*?)</script>', html)
        if len(modules) != 1 or "WerkPilot 5.0" not in html:
            raise ValueError("Standalone HTML version or module missing")
        for name in ("createPhotoRecognizer", "planningSummary", "craftServices"):
            if name not in modules[0]:
                raise ValueError("Standalone HTML is missing module: " + name)
        check_path = Path(temporary) / "standalone.mjs"
        check_path.write_text(modules[0], encoding="utf-8")
        subprocess.run([node, "--check", str(check_path)], check=True, capture_output=True, text=True)
        atomic_write(output / "WerkPilot.html", data)
        return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="Local output directory")
    output = parser.parse_args().output.expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    files = source_files()
    html = build_html(output)
    source_entries = {"WerkPilot/" + name: data for name, data in files.items()}
    android_path = output / ("WerkPilot-" + RELEASE + "-Android-Studio.zip")
    write_zip(android_path, source_entries)
    atomic_write(output / "WerkPilot-Studio.zip", android_path.read_bytes())
    verify_zip(output / "WerkPilot-Studio.zip", source_entries)
    atomic_write(output / "WerkPilot-Android.zip", android_path.read_bytes())
    verify_zip(output / "WerkPilot-Android.zip", source_entries)
    full_entries = {"Quellcode/" + name: data for name, data in files.items()}
    full_entries["WerkPilot.html"] = html
    for name, data in files.items():
        if "/" not in name and (name.endswith(".md") or name == "START-HIER.txt"):
            full_entries[name] = data
    write_zip(output / "WerkPilot.zip", full_entries)
    atomic_write(output / "START-HIER.txt", files["START-HIER.txt"])
    names = ["WerkPilot-Studio.zip", android_path.name, "WerkPilot-Android.zip", "WerkPilot.zip", "WerkPilot.html", "START-HIER.txt"]
    checksums = "".join(digest((output / name).read_bytes()) + "  " + name + "\n" for name in names)
    atomic_write(output / "WerkPilot-SHA256.txt", checksums.encode("utf-8"))
    for name in names:
        path = output / name
        print(str(path) + " (" + str(path.stat().st_size) + " bytes)")
    print("Verified: current sources, ZIP CRCs, Gradle wrapper, versions and standalone JS syntax.")
    print("No APK was compiled or signed. Follow android/README.md to build in Android Studio.")


if __name__ == "__main__":
    main()
