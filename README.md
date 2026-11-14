# Clef (web / iPhone)

Android uygulamasının web sürümü. iPhone'da Safari ile açılıp **Paylaş → Ana Ekrana Ekle** ile uygulama gibi kullanılır.

- Veriler cihazda saklanır (localStorage + IndexedDB). Sunucu yok.
- `.clef` dosyaları Android sürümüyle uyumludur. iReal bağlantıları içe aktarılırken Clef düzenine çevrilir.
- Yayınlamak için bu klasörün tamamı (https üzerinden) herhangi bir statik barındırmaya konabilir.
- Yerelde denemek: `python3 -m http.server 8000` (aynı Wi-Fi'da iPhone'dan `http://<mac-ip>:8000`).

Dosyalar: index.html, style.css, ui.js, sheet.js, ireal.js, lib.js, editor.js, app.js, sw.js, manifest.webmanifest, caveat.ttf, icon-*.png
