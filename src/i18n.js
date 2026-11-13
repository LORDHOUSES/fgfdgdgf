import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

const S = {
  tr: {
    albums: 'Albümler', emptyAlbums: 'Albüm etiketi olan şarkılar burada gruplanır.', readingTags: 'Etiketler okunuyor {a}/{b}',
    account: 'Hesap', username: 'Kullanıcı adı', password: 'Şifre', signIn: 'Giriş yap', signUp: 'Hesap oluştur', signOut: 'Çıkış yap',
    syncNow: 'Eşitle', deleteAccount: 'Hesabı sil', deleteAccountAsk: 'Hesabın ve buluttaki verilerin kalıcı olarak silinir. Cihazdaki şarkıların durur.',
    synced: 'Eşitlendi', syncing: 'Eşitleniyor…', syncError: 'Eşitlenemedi, tekrar denenecek',
    accountHint: 'Favorilerin ve listelerin cihazların arasında eşitlenir. Cihazındaki dosyalar buluta gitmez.',
    accountSetup: 'Senkron sunucusu henüz bağlanmadı. Worker adresini src/config.js dosyasına yazınca burası açılır.',
    err_bad_username: 'Kullanıcı adı 3-24 karakter olmalı: harf, rakam, nokta, alt çizgi.', err_bad_password: 'Şifre en az 8 karakter olmalı.',
    err_username_taken: 'Bu kullanıcı adı alınmış.', err_bad_login: 'Kullanıcı adı ya da şifre hatalı.', err_network: 'Sunucuya ulaşılamadı. Bağlantını kontrol et.', err_other: 'Bir şeyler ters gitti, tekrar dene.',
    discover: 'Keşfet', search: 'Ara', library: 'Kitaplık', settings: 'Ayarlar',
    trending: 'Şu an yükselenler', allGenres: 'Tümü', recent: 'Son çalınanlar',
    offlineTitle: 'Çevrimdışısın', offlineBody: 'Cihazındaki ve indirdiğin şarkılar Kitaplık’ta çalmaya hazır.',
    openLibrary: 'Kitaplığı aç', retry: 'Yeniden dene', loadError: 'Liste yüklenemedi. Bağlantını kontrol et.',
    searchPlaceholder: 'Şarkı, sanatçı ara', inLibrary: 'Kitaplığında', online: 'Audius’ta',
    noResults: 'Sonuç bulunamadı', searchHint: 'Aradığın şarkıyı yaz, hem kitaplığında hem çevrimiçi arayalım.',
    searchOffline: 'Çevrimdışıyken sadece kitaplığında arama yapılır.',
    songs: 'Şarkılar', artists: 'Sanatçılar', playlists: 'Listeler', downloads: 'İndirilenler', favorites: 'Favoriler',
    scan: 'Cihazı tara', addFiles: 'Dosya ekle', shuffleAll: 'Karışık çal', play: 'Çal',
    emptySongs: 'Henüz şarkı yok. Cihazını tara ya da dosya ekle.',
    emptyDownloads: 'İndirdiğin şarkılar burada durur ve internetsiz çalar.',
    emptyFavorites: 'Kalp attığın şarkılar burada toplanır.',
    emptyPlaylists: 'İlk listeni oluştur.', emptyArtists: 'Şarkı ekleyince sanatçılar burada görünür.',
    newPlaylist: 'Yeni liste adı', create: 'Oluştur', tracksCount: '{n} şarkı',
    scanning: 'Cihaz taranıyor…', scanDone: '{n} şarkı bulundu', scanDenied: 'Müzik izni verilmedi. Ayarlardan izin verebilirsin.',
    scanLimited: 'Bu ortamda cihaz taraması kısıtlı. “Dosya ekle” ile devam et ya da APK sürümünü kur.',
    unknownArtist: 'Bilinmeyen sanatçı',
    queue: 'Sıra', upNext: 'Sıradakiler', sleep: 'Uyku zamanlayıcısı', sleepOff: 'Kapalı', minutes: '{n} dk',
    sleepSet: '{n} dakika sonra duracak', sleepCleared: 'Zamanlayıcı kapatıldı',
    playNext: 'Sıradaki olarak çal', addQueue: 'Sıraya ekle', addFav: 'Favorilere ekle', removeFav: 'Favorilerden çıkar',
    addToPlaylist: 'Listeye ekle', download: 'İndir', removeDownload: 'İndirmeyi sil',
    removeFromLibrary: 'Kitaplıktan kaldır', removeFromPlaylist: 'Listeden çıkar', deletePlaylist: 'Listeyi sil', cancel: 'Vazgeç',
    added: 'Sıraya eklendi', downloaded: 'İndirildi', downloading: 'İndiriliyor…', downloadFail: 'İndirilemedi',
    playFail: 'Bu şarkı çalınamadı, sıradakine geçildi', removed: 'Kaldırıldı', addedTo: '“{name}” listesine eklendi',
    needNet: 'Bunun için internet gerekiyor', filesAdded: '{n} dosya eklendi',
    language: 'Dil', auto: 'Cihaz dili', storage: 'Depolama', downloadsCount: '{n} indirilmiş şarkı',
    clearDownloads: 'İndirilenleri temizle', about: 'Hakkında',
    aboutBody: 'Cihazındaki müzikleri internetsiz, Audius kataloğunu çevrimiçi çalar.',
    sourceLocal: 'Cihazda', sourceOnline: 'Audius', sourceDownloaded: 'İndirildi', notPlaying: 'Bir şarkı seç',
  },
  en: {
    albums: 'Albums', emptyAlbums: 'Songs with an album tag are grouped here.', readingTags: 'Reading tags {a}/{b}',
    account: 'Account', username: 'Username', password: 'Password', signIn: 'Sign in', signUp: 'Create account', signOut: 'Sign out',
    syncNow: 'Sync', deleteAccount: 'Delete account', deleteAccountAsk: 'Your account and cloud data are deleted for good. Songs on this device stay.',
    synced: 'Synced', syncing: 'Syncing…', syncError: 'Couldn’t sync, will retry',
    accountHint: 'Your favorites and playlists sync across your devices. Files on your device are not uploaded.',
    accountSetup: 'The sync server isn’t connected yet. Add the Worker address to src/config.js to turn this on.',
    err_bad_username: 'Username must be 3–24 characters: letters, digits, dot, underscore.', err_bad_password: 'Password must be at least 8 characters.',
    err_username_taken: 'That username is taken.', err_bad_login: 'Wrong username or password.', err_network: 'Couldn’t reach the server. Check your connection.', err_other: 'Something went wrong, try again.',
    discover: 'Discover', search: 'Search', library: 'Library', settings: 'Settings',
    trending: 'Trending now', allGenres: 'All', recent: 'Recently played',
    offlineTitle: 'You’re offline', offlineBody: 'Songs on your device and your downloads are ready in Library.',
    openLibrary: 'Open library', retry: 'Try again', loadError: 'Couldn’t load the list. Check your connection.',
    searchPlaceholder: 'Search songs, artists', inLibrary: 'In your library', online: 'On Audius',
    noResults: 'No results', searchHint: 'Type a song and we’ll look in your library and online.',
    searchOffline: 'While offline, search covers your library only.',
    songs: 'Songs', artists: 'Artists', playlists: 'Playlists', downloads: 'Downloads', favorites: 'Favorites',
    scan: 'Scan device', addFiles: 'Add files', shuffleAll: 'Shuffle', play: 'Play',
    emptySongs: 'No songs yet. Scan your device or add files.',
    emptyDownloads: 'Downloaded songs live here and play without internet.',
    emptyFavorites: 'Songs you heart are collected here.',
    emptyPlaylists: 'Create your first playlist.', emptyArtists: 'Artists show up once you add songs.',
    newPlaylist: 'New playlist name', create: 'Create', tracksCount: '{n} songs',
    scanning: 'Scanning device…', scanDone: 'Found {n} songs', scanDenied: 'Music permission denied. You can allow it in Settings.',
    scanLimited: 'Device scanning is limited here. Use “Add files” or install the APK build.',
    unknownArtist: 'Unknown artist',
    queue: 'Queue', upNext: 'Up next', sleep: 'Sleep timer', sleepOff: 'Off', minutes: '{n} min',
    sleepSet: 'Stops in {n} minutes', sleepCleared: 'Timer turned off',
    playNext: 'Play next', addQueue: 'Add to queue', addFav: 'Add to favorites', removeFav: 'Remove from favorites',
    addToPlaylist: 'Add to playlist', download: 'Download', removeDownload: 'Remove download',
    removeFromLibrary: 'Remove from library', removeFromPlaylist: 'Remove from playlist', deletePlaylist: 'Delete playlist', cancel: 'Cancel',
    added: 'Added to queue', downloaded: 'Downloaded', downloading: 'Downloading…', downloadFail: 'Download failed',
    playFail: 'Couldn’t play this song, skipped to the next', removed: 'Removed', addedTo: 'Added to “{name}”',
    needNet: 'This needs an internet connection', filesAdded: 'Added {n} files',
    language: 'Language', auto: 'Device language', storage: 'Storage', downloadsCount: '{n} downloaded songs',
    clearDownloads: 'Clear downloads', about: 'About',
    aboutBody: 'Plays the music on your device offline and the Audius catalog online.',
    sourceLocal: 'On device', sourceOnline: 'Audius', sourceDownloaded: 'Downloaded', notPlaying: 'Pick a song',
  },
  ru: {
    albums: 'Альбомы', emptyAlbums: 'Здесь группируются песни с тегом альбома.', readingTags: 'Чтение тегов {a}/{b}',
    account: 'Аккаунт', username: 'Имя пользователя', password: 'Пароль', signIn: 'Войти', signUp: 'Создать аккаунт', signOut: 'Выйти',
    syncNow: 'Обновить', deleteAccount: 'Удалить аккаунт', deleteAccountAsk: 'Аккаунт и данные в облаке будут удалены навсегда. Песни на устройстве останутся.',
    synced: 'Синхронизировано', syncing: 'Синхронизация…', syncError: 'Не удалось синхронизировать, повторим позже',
    accountHint: 'Избранное и плейлисты синхронизируются между устройствами. Файлы с устройства не загружаются.',
    accountSetup: 'Сервер синхронизации ещё не подключён. Укажите адрес Worker в src/config.js.',
    err_bad_username: 'Имя: 3–24 символа — буквы, цифры, точка, подчёркивание.', err_bad_password: 'Пароль — минимум 8 символов.',
    err_username_taken: 'Это имя уже занято.', err_bad_login: 'Неверное имя или пароль.', err_network: 'Сервер недоступен. Проверьте соединение.', err_other: 'Что-то пошло не так, попробуйте ещё раз.',
    discover: 'Обзор', search: 'Поиск', library: 'Медиатека', settings: 'Настройки',
    trending: 'Сейчас в тренде', allGenres: 'Все', recent: 'Недавно слушали',
    offlineTitle: 'Нет сети', offlineBody: 'Песни на устройстве и загрузки готовы в Медиатеке.',
    openLibrary: 'Открыть медиатеку', retry: 'Повторить', loadError: 'Не удалось загрузить список. Проверьте соединение.',
    searchPlaceholder: 'Песни, исполнители', inLibrary: 'В медиатеке', online: 'В Audius',
    noResults: 'Ничего не найдено', searchHint: 'Введите название — поищем в медиатеке и онлайн.',
    searchOffline: 'Без сети поиск идёт только по медиатеке.',
    songs: 'Песни', artists: 'Исполнители', playlists: 'Плейлисты', downloads: 'Загрузки', favorites: 'Избранное',
    scan: 'Сканировать', addFiles: 'Добавить файлы', shuffleAll: 'Перемешать', play: 'Слушать',
    emptySongs: 'Песен пока нет. Просканируйте устройство или добавьте файлы.',
    emptyDownloads: 'Загруженные песни хранятся здесь и играют без интернета.',
    emptyFavorites: 'Здесь собираются песни, отмеченные сердцем.',
    emptyPlaylists: 'Создайте первый плейлист.', emptyArtists: 'Исполнители появятся, когда вы добавите песни.',
    newPlaylist: 'Название плейлиста', create: 'Создать', tracksCount: 'Песен: {n}',
    scanning: 'Сканирование…', scanDone: 'Найдено песен: {n}', scanDenied: 'Нет доступа к музыке. Разрешите его в настройках.',
    scanLimited: 'Сканирование здесь ограничено. Используйте «Добавить файлы» или установите APK.',
    unknownArtist: 'Неизвестный исполнитель',
    queue: 'Очередь', upNext: 'Далее', sleep: 'Таймер сна', sleepOff: 'Выкл.', minutes: '{n} мин',
    sleepSet: 'Остановится через {n} мин', sleepCleared: 'Таймер выключен',
    playNext: 'Играть следующей', addQueue: 'В очередь', addFav: 'В избранное', removeFav: 'Убрать из избранного',
    addToPlaylist: 'В плейлист', download: 'Скачать', removeDownload: 'Удалить загрузку',
    removeFromLibrary: 'Убрать из медиатеки', removeFromPlaylist: 'Убрать из плейлиста', deletePlaylist: 'Удалить плейлист', cancel: 'Отмена',
    added: 'Добавлено в очередь', downloaded: 'Загружено', downloading: 'Загрузка…', downloadFail: 'Не удалось скачать',
    playFail: 'Не удалось воспроизвести, включена следующая', removed: 'Удалено', addedTo: 'Добавлено в «{name}»',
    needNet: 'Нужен интернет', filesAdded: 'Добавлено файлов: {n}',
    language: 'Язык', auto: 'Язык устройства', storage: 'Хранилище', downloadsCount: 'Загружено песен: {n}',
    clearDownloads: 'Очистить загрузки', about: 'О приложении',
    aboutBody: 'Играет музыку с устройства без сети и каталог Audius онлайн.',
    sourceLocal: 'На устройстве', sourceOnline: 'Audius', sourceDownloaded: 'Загружено', notPlaying: 'Выберите песню',
  },
  ar: {
    albums: 'الألبومات', emptyAlbums: 'تُجمع هنا الأغاني التي تحمل وسم الألبوم.', readingTags: 'جارٍ قراءة الوسوم {a}/{b}',
    account: 'الحساب', username: 'اسم المستخدم', password: 'كلمة المرور', signIn: 'تسجيل الدخول', signUp: 'إنشاء حساب', signOut: 'تسجيل الخروج',
    syncNow: 'مزامنة', deleteAccount: 'حذف الحساب', deleteAccountAsk: 'سيُحذف حسابك وبياناتك السحابية نهائيًا. تبقى الأغاني على جهازك.',
    synced: 'تمت المزامنة', syncing: 'جارٍ المزامنة…', syncError: 'تعذّرت المزامنة، سنعيد المحاولة',
    accountHint: 'تُزامَن مفضلتك وقوائمك بين أجهزتك. ملفات جهازك لا تُرفع.',
    accountSetup: 'خادم المزامنة غير متصل بعد. أضف عنوان الـ Worker في src/config.js لتفعيله.',
    err_bad_username: 'اسم المستخدم 3–24 حرفًا: أحرف، أرقام، نقطة، شرطة سفلية.', err_bad_password: 'كلمة المرور 8 أحرف على الأقل.',
    err_username_taken: 'اسم المستخدم مستخدم بالفعل.', err_bad_login: 'اسم المستخدم أو كلمة المرور غير صحيحة.', err_network: 'تعذّر الوصول إلى الخادم. تحقق من الاتصال.', err_other: 'حدث خطأ ما، حاول مجددًا.',
    discover: 'اكتشف', search: 'بحث', library: 'المكتبة', settings: 'الإعدادات',
    trending: 'الرائج الآن', allGenres: 'الكل', recent: 'شُغّل مؤخرًا',
    offlineTitle: 'أنت غير متصل', offlineBody: 'الأغاني على جهازك وتنزيلاتك جاهزة في المكتبة.',
    openLibrary: 'افتح المكتبة', retry: 'أعد المحاولة', loadError: 'تعذّر تحميل القائمة. تحقق من الاتصال.',
    searchPlaceholder: 'ابحث عن أغنية أو فنان', inLibrary: 'في مكتبتك', online: 'على Audius',
    noResults: 'لا توجد نتائج', searchHint: 'اكتب اسم الأغنية وسنبحث في مكتبتك وعلى الإنترنت.',
    searchOffline: 'بدون اتصال يقتصر البحث على مكتبتك.',
    songs: 'الأغاني', artists: 'الفنانون', playlists: 'القوائم', downloads: 'التنزيلات', favorites: 'المفضلة',
    scan: 'افحص الجهاز', addFiles: 'أضف ملفات', shuffleAll: 'تشغيل عشوائي', play: 'تشغيل',
    emptySongs: 'لا توجد أغانٍ بعد. افحص جهازك أو أضف ملفات.',
    emptyDownloads: 'الأغاني المنزّلة تبقى هنا وتعمل بدون إنترنت.',
    emptyFavorites: 'الأغاني التي تعجبك تُجمع هنا.',
    emptyPlaylists: 'أنشئ قائمتك الأولى.', emptyArtists: 'يظهر الفنانون بعد إضافة الأغاني.',
    newPlaylist: 'اسم القائمة الجديدة', create: 'إنشاء', tracksCount: '{n} أغنية',
    scanning: 'جارٍ فحص الجهاز…', scanDone: 'تم العثور على {n} أغنية', scanDenied: 'لم يُسمح بالوصول للموسيقى. يمكنك السماح من الإعدادات.',
    scanLimited: 'فحص الجهاز محدود هنا. استخدم «أضف ملفات» أو ثبّت نسخة APK.',
    unknownArtist: 'فنان غير معروف',
    queue: 'قائمة الانتظار', upNext: 'التالي', sleep: 'مؤقت النوم', sleepOff: 'متوقف', minutes: '{n} د',
    sleepSet: 'سيتوقف بعد {n} دقيقة', sleepCleared: 'تم إيقاف المؤقت',
    playNext: 'شغّلها تاليًا', addQueue: 'أضف إلى الانتظار', addFav: 'أضف إلى المفضلة', removeFav: 'أزل من المفضلة',
    addToPlaylist: 'أضف إلى قائمة', download: 'تنزيل', removeDownload: 'احذف التنزيل',
    removeFromLibrary: 'أزل من المكتبة', removeFromPlaylist: 'أزل من القائمة', deletePlaylist: 'احذف القائمة', cancel: 'إلغاء',
    added: 'أُضيفت إلى الانتظار', downloaded: 'تم التنزيل', downloading: 'جارٍ التنزيل…', downloadFail: 'فشل التنزيل',
    playFail: 'تعذّر تشغيل الأغنية، تم الانتقال للتالية', removed: 'تمت الإزالة', addedTo: 'أُضيفت إلى «{name}»',
    needNet: 'يتطلب هذا اتصالًا بالإنترنت', filesAdded: 'أُضيف {n} ملف',
    language: 'اللغة', auto: 'لغة الجهاز', storage: 'التخزين', downloadsCount: '{n} أغنية منزّلة',
    clearDownloads: 'امسح التنزيلات', about: 'حول',
    aboutBody: 'يشغّل موسيقى جهازك بدون إنترنت وكتالوج Audius عبر الإنترنت.',
    sourceLocal: 'على الجهاز', sourceOnline: 'Audius', sourceDownloaded: 'منزّلة', notPlaying: 'اختر أغنية',
  },
};

export const LANGS = [
  { key: 'auto', label: null },
  { key: 'tr', label: 'Türkçe' },
  { key: 'en', label: 'English' },
  { key: 'ru', label: 'Русский' },
  { key: 'ar', label: 'العربية' },
];

function deviceLang() {
  try {
    const code = (getLocales()[0].languageCode || 'en').toLowerCase();
    return S[code] ? code : 'en';
  } catch (e) {
    return 'en';
  }
}

const Ctx = createContext(null);
const KEY = 'ls.lang';

export function I18nProvider({ children }) {
  const [pref, setPref] = useState('auto');
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => v && setPref(v)).catch(() => {});
  }, []);
  const lang = pref === 'auto' ? deviceLang() : pref;
  const t = useCallback(
    (key, vars) => {
      let s = (S[lang] && S[lang][key]) || S.en[key] || key;
      if (vars) Object.keys(vars).forEach((k) => (s = s.replace('{' + k + '}', vars[k])));
      return s;
    },
    [lang]
  );
  const setLang = useCallback((v) => {
    setPref(v);
    AsyncStorage.setItem(KEY, v).catch(() => {});
  }, []);
  const value = useMemo(() => ({ t, lang, pref, setLang, rtl: lang === 'ar' }), [t, lang, pref, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
