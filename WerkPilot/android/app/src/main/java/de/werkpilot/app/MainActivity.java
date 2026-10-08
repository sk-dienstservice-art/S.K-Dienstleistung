package de.werkpilot.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.util.Base64;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Bundled app assets have their own HTTPS origin. No remote page is given the bridge. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String APP_URL = "https://" + HOST + "/assets/index.html";
    private static final int REQUEST_MIC = 41, REQUEST_PICK = 42, REQUEST_SAVE = 43;
    private static final int MAX_EXPORT_BYTES = 20 * 1024 * 1024;
    private static final String CSP = "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval'; "
            + "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; "
            + "img-src 'self' data: blob: https://huggingface.co; worker-src 'self' blob:; "
            + "connect-src 'self' https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://*.hf.co; "
            + "frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

    private WebView webView;
    private volatile boolean trustedPage;
    private volatile boolean destroyed, foreground;
    private ValueCallback<Uri[]> filePickerCallback;
    private byte[] pendingSave;
    private final ExecutorService files = Executors.newSingleThreadExecutor();
    private SpeechRecognizer recognizer;
    private int recognitionGeneration;
    private String recognitionId;
    private String pendingLanguage = "de-DE";
    private boolean pendingInterim;
    private int pendingAlternatives = 5;
    private TextToSpeech tts;
    private volatile String voicesJson = "[]";
    private boolean ttsReady;
    private String utteranceId;
    private final List<WebView> printViews = new ArrayList<>();

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        foreground = true;
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(244, 245, 240));
        configureWebView(webView);
        webView.addJavascriptInterface(new NativeBridge(), "NativeApp");
        webView.setWebViewClient(new AppClient());
        webView.setWebChromeClient(new AppChrome());
        webView.setDownloadListener((url, userAgent, disposition, mime, length) ->
                toast("Zum Speichern bitte die Exportfunktion in WerkPilot verwenden."));
        setContentView(webView);
        // Android 15 enforces edge-to-edge: keep tappable app controls outside system bars and keyboard.
        webView.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        initTts();
        // Persisted application records live in IndexedDB, independently of activity recreation.
        webView.loadUrl(APP_URL);
    }

    private void configureWebView(WebView target) {
        WebSettings settings = target.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setTextZoom(100);
        if (android.os.Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);
    }

    private static boolean isTrusted(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
                && uri.getPort() == -1 && uri.getUserInfo() == null
                && uri.getPath() != null && uri.getPath().startsWith("/assets/");
    }

    private boolean mayUseBridge() { return trustedPage && !destroyed && foreground; }

    private final class AppClient extends WebViewClient {
        @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            stopRecognition(false); stopTts(false);
            trustedPage = isTrusted(Uri.parse(url));
            if (!trustedPage) { view.stopLoading(); openExternal(Uri.parse(url)); }
        }

        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (isTrusted(request.getUrl())) return false;
            if (request.isForMainFrame()) openExternal(request.getUrl());
            return true;
        }

        @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Uri uri = Uri.parse(url);
            if (isTrusted(uri)) return false;
            openExternal(uri);
            return true;
        }

        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!"GET".equals(request.getMethod())) return blocked();
            if (HOST.equals(uri.getHost())) {
                if (!isTrusted(uri)) return blocked();
                String path = uri.getPath().substring("/assets/".length());
                if (path.isEmpty()) path = "index.html";
                if (!path.matches("[A-Za-z0-9_./-]+")) return blocked();
                for (String part : path.split("/")) if ("..".equals(part) || ".".equals(part)) return blocked();
                try {
                    InputStream stream = getAssets().open(path);
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-cache");
                    headers.put("X-Content-Type-Options", "nosniff");
                    headers.put("Content-Security-Policy", CSP);
                    return new WebResourceResponse(mimeFor(path), "UTF-8", 200, "OK", headers, stream);
                } catch (IOException ignored) { return missing(); }
            }
            // Optional photo-model resources and fonts may use HTTPS; no external document is loaded.
            if (request.isForMainFrame() || !"https".equals(uri.getScheme())) return blocked();
            String remoteHost = uri.getHost();
            boolean allowed = remoteHost != null && (remoteHost.equals("cdn.jsdelivr.net")
                    || remoteHost.equals("fonts.googleapis.com") || remoteHost.equals("fonts.gstatic.com")
                    || remoteHost.equals("huggingface.co") || remoteHost.endsWith(".huggingface.co")
                    || remoteHost.endsWith(".hf.co"));
            return allowed ? null : blocked();
        }
    }

    private static String mimeFor(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".webmanifest")) return "application/manifest+json";
        if (path.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }
    private static WebResourceResponse blocked() { return response(403, "Forbidden"); }
    private static WebResourceResponse missing() { return response(404, "Not Found"); }
    private static WebResourceResponse response(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason, Collections.emptyMap(),
                new ByteArrayInputStream(reason.getBytes(StandardCharsets.UTF_8)));
    }

    private void openExternal(Uri uri) {
        if (!foreground || uri == null) return;
        String scheme = uri.getScheme();
        if (!"https".equals(scheme) && !"mailto".equals(scheme) && !"tel".equals(scheme)) return;
        runOnUiThread(() -> {
            try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
            catch (ActivityNotFoundException ignored) { toast("Keine passende App zum Öffnen vorhanden."); }
        });
    }

    private final class AppChrome extends WebChromeClient {
        @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                    FileChooserParams params) {
            if (!mayUseBridge()) { callback.onReceiveValue(null); return true; }
            if (filePickerCallback != null) filePickerCallback.onReceiveValue(null);
            filePickerCallback = callback;
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            String[] requested = params.getAcceptTypes();
            boolean imagesOnly = requested.length > 0;
            for (String type : requested) if (!type.startsWith("image/")) imagesOnly = false;
            intent.setType(imagesOnly ? "image/*" : "*/*");
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
            try { startActivityForResult(intent, REQUEST_PICK); }
            catch (ActivityNotFoundException ignored) {
                filePickerCallback.onReceiveValue(null); filePickerCallback = null;
                toast("Dateiauswahl auf diesem Gerät nicht verfügbar.");
            }
            return true;
        }
        // WebView camera/microphone permission requests are deliberately not granted.
        // Voice uses the scoped native bridge; photos come through the Android picker.
    }

    private final class NativeBridge {
        @JavascriptInterface public void ready() {
            if (mayUseBridge()) runOnUiThread(() -> {
                emit("voices", "", new JSONObject());
            });
        }
        @JavascriptInterface public String getVoices() { return mayUseBridge() ? voicesJson : "[]"; }
        @JavascriptInterface public void startSpeech(String id, String language, boolean interim, int alternatives) {
            if (!mayUseBridge() || !validId(id)) return;
            runOnUiThread(() -> beginRecognition(id, language, interim, alternatives));
        }
        @JavascriptInterface public void abortSpeech(String id) {
            if (!mayUseBridge()) return;
            runOnUiThread(() -> { if (id != null && id.equals(recognitionId)) stopRecognition(false); });
        }
        @JavascriptInterface public void stopSpeech(String id) {
            if (!mayUseBridge()) return;
            runOnUiThread(() -> {
                if (id != null && id.equals(recognitionId) && recognizer != null) recognizer.stopListening();
            });
        }
        @JavascriptInterface public void speak(String id, String data) {
            if (!mayUseBridge() || !validId(id) || data == null || data.length() > 18000) return;
            runOnUiThread(() -> speakNative(id, data));
        }
        @JavascriptInterface public void cancelSpeech() {
            if (mayUseBridge()) runOnUiThread(() -> stopTts(false));
        }
        @JavascriptInterface public void saveFile(String filename, String mime, String base64) {
            if (!mayUseBridge() || base64 == null) return;
            if (base64.length() > ((MAX_EXPORT_BYTES + 2L) / 3L) * 4L) {
                runOnUiThread(() -> toast("Export zu groß. Höchstens 20 MB pro Datei möglich.")); return;
            }
            final byte[] bytes;
            try { bytes = Base64.decode(base64, Base64.NO_WRAP); }
            catch (IllegalArgumentException ignored) { return; }
            if (bytes.length > MAX_EXPORT_BYTES) return;
            runOnUiThread(() -> beginSave(filename, mime, bytes));
        }
        @JavascriptInterface public void printDocument(String html) {
            if (!mayUseBridge() || html == null || html.length() > 2_000_000) return;
            runOnUiThread(() -> beginPrint(html));
        }
    }

    private static boolean validId(String id) { return id != null && id.matches("[A-Za-z0-9_-]{1,64}"); }

    private void beginSave(String filename, String mime, byte[] bytes) {
        if (!mayUseBridge()) return;
        if (pendingSave != null) { toast("Bitte erst den laufenden Export beenden."); return; }
        String safeName = filename == null ? "WerkPilot-Export" : filename.replaceAll("[\\\\/\\p{Cntrl}]", "_");
        if (safeName.trim().isEmpty()) safeName = "WerkPilot-Export";
        if (safeName.length() > 120) safeName = safeName.substring(0, 120);
        String safeMime = mime != null && mime.matches("[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+") ? mime : "application/octet-stream";
        pendingSave = bytes;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(safeMime);
        intent.putExtra(Intent.EXTRA_TITLE, safeName);
        try { startActivityForResult(intent, REQUEST_SAVE); }
        catch (ActivityNotFoundException ignored) { pendingSave = null; toast("Speichern auf diesem Gerät nicht verfügbar."); }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == REQUEST_PICK) {
            ValueCallback<Uri[]> callback = filePickerCallback; filePickerCallback = null;
            if (callback == null) return;
            if (result != RESULT_OK || data == null) { callback.onReceiveValue(null); return; }
            ArrayList<Uri> uris = new ArrayList<>();
            if (data.getClipData() != null) {
                for (int i = 0; i < Math.min(30, data.getClipData().getItemCount()); i++) {
                    Uri uri = data.getClipData().getItemAt(i).getUri();
                    if (uri != null && "content".equals(uri.getScheme())) uris.add(uri);
                }
            } else if (data.getData() != null && "content".equals(data.getData().getScheme())) uris.add(data.getData());
            callback.onReceiveValue(uris.isEmpty() ? null : uris.toArray(new Uri[0]));
        } else if (request == REQUEST_SAVE) {
            byte[] bytes = pendingSave; pendingSave = null;
            if (result != RESULT_OK || data == null || bytes == null || data.getData() == null) return;
            Uri uri = data.getData();
            if (!"content".equals(uri.getScheme())) { toast("Ungültiger Speicherort."); return; }
            files.execute(() -> {
                try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                    if (out == null) throw new IOException("Speicherort nicht verfügbar");
                    out.write(bytes);
                    runOnUiThread(() -> toast("Datei gespeichert."));
                } catch (IOException | SecurityException ignored) {
                    runOnUiThread(() -> toast("Datei konnte nicht gespeichert werden. Bitte erneut versuchen."));
                }
            });
        }
    }

    private void beginRecognition(String id, String language, boolean interim, int alternatives) {
        if (!mayUseBridge()) return;
        stopTts(false);
        stopRecognition(false);
        recognitionId = id;
        pendingLanguage = language != null && language.matches("[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?") ? language : "de-DE";
        pendingInterim = interim;
        pendingAlternatives = Math.max(1, Math.min(5, alternatives));
        if (!hasOnDeviceRecognition() && !SpeechRecognizer.isRecognitionAvailable(this)) {
            recognitionError(id, "service-not-allowed"); return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_MIC);
            return;
        }
        startRecognizer();
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request != REQUEST_MIC || recognitionId == null) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED && foreground) startRecognizer();
        else recognitionError(recognitionId, "not-allowed");
    }

    private boolean hasOnDeviceRecognition() {
        if (android.os.Build.VERSION.SDK_INT < 31) return false;
        try { return SpeechRecognizer.isOnDeviceRecognitionAvailable(this); }
        catch (RuntimeException ignored) { return false; }
    }

    private SpeechRecognizer createRecognizer() {
        if (android.os.Build.VERSION.SDK_INT >= 31 && hasOnDeviceRecognition()) {
            try { return SpeechRecognizer.createOnDeviceSpeechRecognizer(this); }
            catch (RuntimeException ignored) {
                // Provider availability may change between the check and construction.
                // The system service can use the network; offline recognition is not promised.
            }
        }
        return SpeechRecognizer.createSpeechRecognizer(this);
    }

    private void startRecognizer() {
        if (!mayUseBridge() || recognitionId == null) return;
        final String id = recognitionId;
        final int generation = ++recognitionGeneration;
        try {
            recognizer = createRecognizer();
            recognizer.setRecognitionListener(new RecognitionListener() {
                private boolean current() { return generation == recognitionGeneration && id.equals(recognitionId) && foreground; }
                @Override public void onReadyForSpeech(Bundle params) { if (current()) emit("recognition-start", id, new JSONObject()); }
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float rmsDb) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() {}
                @Override public void onEvent(int type, Bundle params) {}
                @Override public void onPartialResults(Bundle results) { if (current()) sendResults(id, results, false); }
                @Override public void onResults(Bundle results) {
                    if (!current()) return;
                    sendResults(id, results, true);
                    stopRecognition(false);
                    emit("recognition-end", id, new JSONObject());
                }
                @Override public void onError(int error) { if (current()) recognitionError(id, speechError(error)); }
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, pendingLanguage);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, pendingInterim);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, pendingAlternatives);
            // Give a question followed by quantities time to form one request. These are
            // provider hints: Android recognition services can choose to ignore them.
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1000L);
            recognizer.startListening(intent);
        } catch (RuntimeException ignored) { recognitionError(id, "service-not-allowed"); }
    }

    private void sendResults(String id, Bundle results, boolean complete) {
        ArrayList<String> strings = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (strings == null || strings.isEmpty()) {
            if (complete) recognitionError(id, "no-speech");
            return;
        }
        float[] scores = results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
        JSONArray alternatives = new JSONArray();
        for (int i = 0; i < Math.min(pendingAlternatives, strings.size()); i++) {
            JSONObject alternative = new JSONObject();
            put(alternative, "transcript", strings.get(i));
            double confidence = scores != null && i < scores.length && !Float.isNaN(scores[i]) && !Float.isInfinite(scores[i]) && scores[i] >= 0
                    ? Math.max(0, Math.min(1, scores[i])) : 0;
            put(alternative, "confidence", confidence);
            alternatives.put(alternative);
        }
        JSONObject payload = new JSONObject();
        put(payload, "alternatives", alternatives); put(payload, "final", complete);
        emit("recognition-result", id, payload);
    }

    private void recognitionError(String id, String error) {
        stopRecognition(false);
        JSONObject payload = new JSONObject(); put(payload, "error", error);
        emit("recognition-error", id, payload);
        emit("recognition-end", id, new JSONObject());
    }
    private static String speechError(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "not-allowed";
            case SpeechRecognizer.ERROR_AUDIO: return "audio-capture";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "network";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
            case SpeechRecognizer.ERROR_NO_MATCH: return "no-speech";
            case SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED:
            case SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE: return "language-not-supported";
            case SpeechRecognizer.ERROR_CLIENT: return "aborted";
            default: return "service-not-allowed";
        }
    }
    private void stopRecognition(boolean notify) {
        String id = recognitionId;
        recognitionId = null; recognitionGeneration++;
        if (recognizer != null) {
            try { recognizer.cancel(); recognizer.destroy(); } catch (RuntimeException ignored) {}
            recognizer = null;
        }
        if (notify && id != null) {
            JSONObject payload = new JSONObject(); put(payload, "error", "aborted");
            emit("recognition-error", id, payload); emit("recognition-end", id, new JSONObject());
        }
    }

    private void initTts() {
        tts = new TextToSpeech(this, status -> runOnUiThread(() -> {
            if (destroyed || tts == null || status != TextToSpeech.SUCCESS) return;
            ttsReady = true;
            tts.setLanguage(Locale.GERMANY);
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { runOnUiThread(() -> { if (id.equals(utteranceId)) emit("tts-start", id, new JSONObject()); }); }
                @Override public void onDone(String id) { runOnUiThread(() -> {
                    if (id.equals(utteranceId)) { utteranceId = null; emit("tts-end", id, new JSONObject()); }
                }); }
                @Override public void onError(String id) { onError(id, TextToSpeech.ERROR); }
                @Override public void onError(String id, int errorCode) { runOnUiThread(() -> {
                    if (id.equals(utteranceId)) {
                        utteranceId = null; JSONObject payload = new JSONObject(); put(payload, "error", "synthesis-failed");
                        emit("tts-error", id, payload);
                    }
                }); }
            });
            updateVoices();
        }));
    }

    private void updateVoices() {
        JSONArray result = new JSONArray();
        Set<Voice> set = tts.getVoices();
        if (set != null) {
            List<Voice> sorted = new ArrayList<>(set);
            Collections.sort(sorted, (a, b) -> {
                if (a.isNetworkConnectionRequired() != b.isNetworkConnectionRequired()) return a.isNetworkConnectionRequired() ? 1 : -1;
                return a.getName().compareTo(b.getName());
            });
            Voice selected = tts.getVoice();
            for (Voice voice : sorted) {
                JSONObject item = new JSONObject();
                put(item, "voiceURI", voice.getName()); put(item, "name", voice.getName());
                put(item, "lang", voice.getLocale().toLanguageTag());
                put(item, "localService", !voice.isNetworkConnectionRequired());
                put(item, "default", selected != null && selected.getName().equals(voice.getName()));
                result.put(item);
            }
        }
        voicesJson = result.toString();
        emit("voices", "", new JSONObject());
    }

    private void speakNative(String id, String data) {
        if (!mayUseBridge()) return;
        stopRecognition(false); stopTts(false);
        JSONObject error = new JSONObject();
        if (!ttsReady) { put(error, "error", "synthesis-unavailable"); emit("tts-error", id, error); return; }
        try {
            JSONObject request = new JSONObject(data);
            String text = request.optString("text", "");
            if (text.isEmpty() || text.length() > 10000) throw new JSONException("Text zu lang");
            String selectedName = request.optString("voiceURI", "");
            Voice chosen = null;
            Set<Voice> set = tts.getVoices();
            if (set != null) for (Voice voice : set) {
                if (voice.getName().equals(selectedName) && "de".equals(voice.getLocale().getLanguage())) { chosen = voice; break; }
            }
            if (chosen != null) tts.setVoice(chosen);
            else if (tts.setLanguage(Locale.GERMANY) < TextToSpeech.LANG_AVAILABLE) {
                put(error, "error", "language-unavailable"); emit("tts-error", id, error); return;
            }
            tts.setSpeechRate((float) bounded(request.optDouble("rate", 1.08), .85, 1.25, 1.08));
            tts.setPitch((float) bounded(request.optDouble("pitch", 1), .9, 1.1, 1));
            Bundle params = new Bundle();
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, (float) bounded(request.optDouble("volume", 1), 0, 1, 1));
            utteranceId = id;
            if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, id) == TextToSpeech.ERROR) {
                utteranceId = null; put(error, "error", "synthesis-failed"); emit("tts-error", id, error);
            }
        } catch (JSONException | RuntimeException ignored) {
            utteranceId = null; put(error, "error", "synthesis-failed"); emit("tts-error", id, error);
        }
    }
    private static double bounded(double value, double min, double max, double fallback) {
        return !Double.isNaN(value) && !Double.isInfinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
    }
    private void stopTts(boolean notify) {
        String id = utteranceId; utteranceId = null;
        if (tts != null) tts.stop();
        if (notify && id != null) { JSONObject error = new JSONObject(); put(error, "error", "canceled"); emit("tts-error", id, error); }
    }

    private void beginPrint(String html) {
        if (!mayUseBridge()) return;
        if (!printViews.isEmpty()) { toast("Bitte zuerst den laufenden Druckdialog beenden."); return; }
        WebView printView = new WebView(this);
        configureWebView(printView);
        printView.getSettings().setJavaScriptEnabled(false);
        printView.setWebViewClient(new WebViewClient() {
            private boolean launched;
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) { return blocked(); }
            @Override public void onPageFinished(WebView view, String url) {
                if (launched || destroyed) return;
                launched = true;
                PrintManager manager = (PrintManager) getSystemService(PRINT_SERVICE);
                if (manager == null) { releasePrint(view); toast("Druckdienst nicht verfügbar."); return; }
                PrintDocumentAdapter source = view.createPrintDocumentAdapter("WerkPilot-Dokument");
                PrintDocumentAdapter wrapped = new PrintDocumentAdapter() {
                    @Override public void onStart() { source.onStart(); }
                    @Override public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes,
                                                    CancellationSignal signal, LayoutResultCallback callback, Bundle extras) {
                        source.onLayout(oldAttributes, newAttributes, signal, callback, extras);
                    }
                    @Override public void onWrite(PageRange[] pages, ParcelFileDescriptor destination,
                                                   CancellationSignal signal, WriteResultCallback callback) {
                        source.onWrite(pages, destination, signal, callback);
                    }
                    @Override public void onFinish() { source.onFinish(); runOnUiThread(() -> releasePrint(view)); }
                };
                try { manager.print("WerkPilot-Dokument", wrapped, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build()); }
                catch (RuntimeException ignored) { releasePrint(view); toast("Druckdialog konnte nicht geöffnet werden."); }
            }
        });
        printViews.add(printView);
        // JavaScript is disabled; CSS is supplied by printNative in the adapter.
        printView.loadDataWithBaseURL(APP_URL, html, "text/html", "UTF-8", null);
    }
    private void releasePrint(WebView view) { printViews.remove(view); view.destroy(); }

    private static void put(JSONObject target, String name, Object value) {
        try { target.put(name, value); } catch (JSONException ignored) {}
    }
    private void emit(String type, String id, JSONObject payload) {
        if (destroyed || webView == null || !trustedPage) return;
        String code = "window.__werkpilotNative&&window.__werkpilotNative.receive("
                + JSONObject.quote(type) + "," + JSONObject.quote(id) + "," + payload + ")";
        webView.evaluateJavascript(code, null);
    }
    private void toast(String text) { if (!destroyed) Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }

    @Override protected void onPause() {
        super.onPause(); foreground = false;
        stopRecognition(true); stopTts(true);
        emit("paused", "", new JSONObject());
    }
    @Override protected void onResume() {
        super.onResume(); foreground = true;
        if (webView != null) webView.onResume();
    }
    @Override public void onBackPressed() {
        if (webView != null && trustedPage) {
            webView.evaluateJavascript("window.__werkpilotNative&&window.__werkpilotNative.back()", result -> {
                if (!"true".equals(result)) MainActivity.super.onBackPressed();
            });
        } else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        stopRecognition(false); stopTts(false);
        destroyed = true;
        if (tts != null) { tts.shutdown(); tts = null; }
        if (filePickerCallback != null) { filePickerCallback.onReceiveValue(null); filePickerCallback = null; }
        pendingSave = null;
        for (WebView print : new ArrayList<>(printViews)) releasePrint(print);
        if (webView != null) { webView.removeJavascriptInterface("NativeApp"); webView.destroy(); webView = null; }
        files.shutdown();
        super.onDestroy();
    }
}
