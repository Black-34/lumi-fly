# Lumi Fly

Handyspiel für Android und iOS (Capacitor 8).

- `source/lumi-fly.html` – Browser-Version (zum Weiterentwickeln)
- `tools/make_www.py` – macht daraus die App-Version `www/index.html` (Testmodus aus, echte Werbung/Käufe/Vibration)
- `www/native.js` – AdMob, Käufe (Google Play / App Store), Vibration, Zurück-Taste
- `native-res/` – App-Symbol und Startbild
- `.github/workflows/android.yml` – baut bei jedem Hochladen automatisch die Test-APK (und die .aab für den Play Store, sobald der Upload-Schlüssel hinterlegt ist)

Nach Änderungen am Spiel: `python3 tools/make_www.py source/lumi-fly.html www/index.html`
