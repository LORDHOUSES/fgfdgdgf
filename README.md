# LS music

Cihazdaki müzikleri çevrimdışı, Audius kataloğunu çevrimiçi çalan Expo (React Native) uygulaması.

## Telefonda test (Android Studio yok)

1. Bilgisayarda Node 20+ kurulu olsun.
2. Bu klasörde: `npm install`
3. `npx expo start`
4. Telefona Play Store'dan **Expo Go** kur, terminaldeki QR kodu okut.
   Telefon ve bilgisayar aynı Wi-Fi'da değilse: `npx expo start --tunnel`

## APK almak (bulutta derlenir)

```
npm i -g eas-cli
eas login
eas build -p android --profile preview
```

Derleme bitince verilen linkten APK'yı telefona indirip kur.
Arka planda çalma, kilit ekranı kontrolleri ve tam cihaz taraması APK sürümünde çalışır.

## Hesap ve senkron (Cloudflare Worker + R2)

Favoriler ve çalma listeleri cihazlar arasında eşitlenir. Sunucu `worker/` klasöründe.

```
cd worker
npx wrangler login
npx wrangler r2 bucket create ls-music
npx wrangler secret put TOKEN_SECRET     # uzun, rastgele bir değer gir
npx wrangler deploy
```

Deploy bitince verilen adresi `src/config.js` içindeki `SYNC_URL` alanına yaz.
Boş bırakırsan Ayarlar'daki hesap bölümü kapalı görünür, uygulamanın geri kalanı çalışır.

## Yapı

- `App.js` — kabuk: açılış animasyonu, sekmeler, mini oynatıcı, tam ekran oynatıcı
- `src/player.js` — çalma motoru (sıra, karıştır, tekrar, uyku zamanlayıcısı)
- `src/library.js` — kitaplık: cihaz taraması, dosya ekleme, favoriler, listeler, indirmeler
- `src/tags.js` — MP3 / M4A / FLAC etiket ve kapak okuyucu
- `src/cloud.js` — hesap ve senkron
- `src/config.js` — senkron sunucusu adresi
- `src/audius.js` — Audius API (anahtar alırsan `API_KEY` alanına yaz)
- `src/i18n.js` — Türkçe, İngilizce, Rusça, Arapça
- `src/theme.js` — renkler, tipografi, yay ayarları
- `worker/` — senkron API'si
