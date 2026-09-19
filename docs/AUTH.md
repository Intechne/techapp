# Kimlik doğrulama ve oturum

## İlkeler

- İstemcide `loggedIn = true` benzeri bir bayrak **yoktur**. Oturum yalnız Supabase Auth'un verdiği token'lardan oluşur.
- Oturum kimlik taşır, yetki taşımaz. Roller ve yaş grubu her zaman `my_account_state` RPC'sinden okunur.
- Misafir keşif serbesttir; auth yalnız bir eylem gerektirdiğinde devreye girer.

## Akış

```text
E-posta → OTP → oturum → (profil eksikse) ad + doğum tarihi + eğitim aşaması → bekleyen eyleme dönüş
```

1. `AuthEmailScreen` → `signInWithEmailOtp` (`supabase.auth.signInWithOtp`, `shouldCreateUser: true`). Hesap yoksa aynı adımda oluşur; şifre yoktur.
2. `AuthOtpScreen` → `verifyOtp` (`type: 'email'`). 60 sn sonra yeniden kod istenebilir. Hatalı/eski kod → `otp_invalid`.
3. Doğrulamadan hemen sonra `my_account_state` çağrılır; `profile_complete` değilse `ProfileBootstrap` ekranına geçilir, aksi halde `popTo('Main')`.
4. `ProfileBootstrapScreen` → `complete_profile_bootstrap` RPC. Misafirken seçilen eğitim aşaması ve ilgi alanları buradan sunucuya yazılır.
5. `Main`'e dönülünce alttaki ekran (ör. `EventDetail`) `PendingIntent`'i tüketir ve kullanıcıyı `EventRegistration`'a taşır.

`features/auth/authService.ts` API'si: `signInWithEmailOtp`, `verifyOtp`, `getSession`, `restoreSession`, `refreshSession`, `signOut`, `deleteAccount`.

## Profil bootstrap kuralları (sunucu)

- Doğum tarihi gelecekte olamaz, 100 yıldan eski olamaz; sunucu saati `Europe/Istanbul` ile hesaplanır.
- Doğum tarihi **bir kez yazılır**. Sonradan farklı bir tarih → `409 birth_date_locked`; doğrudan `UPDATE` → tetikleyici `403`.
- En küçük hesap yaşı `app.min_account_age()` = **13**. Bu bir ürün kararıdır ve **hukuki incelemeyi bekliyor**; yasal gereklilik iddiası değildir.
- İstemci `lib/dates.ts` ile aynı denetimleri hızlı geri bildirim için yapar (31.02 gibi takvim dışı tarihler reddedilir); belirleyici olan sunucudur.
- Eğitim aşaması yaş değildir: üniversiteli otomatik 18+ sayılmaz. Yaşa bağlı her karar `app.age_years()` üzerinden verilir.

## Oturum saklama

`lib/secureSessionStorage.ts`, supabase-js için depolama adaptörüdür:

- iOS Keychain / Android Keystore (`expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Token'lar AsyncStorage'a yazılmaz.
- SecureStore değerleri ~2 KB ile sınırlı olduğu için oturum **1800 karakterlik parçalara** bölünür (`<key>.0 … <key>.n`).
- Yarım kalmış yazma (eksik parça) bozuk token yerine "oturum yok" olarak ele alınır.
- Web yalnız geliştirme hedefidir ve `localStorage` kullanır.
- Yenileme: `autoRefreshToken`; uygulama arka plana geçince durur, öne gelince başlar (`AppState`).

## Çıkış ve hesap silme

- **`signOut`:** Supabase çıkışı + `queryClient.clear()` + `AsyncStorage.clear()`. Ağ hatasında bile yerel oturum ve önbellek temizlenir.
- **`deleteAccount`:** `delete-account` Edge Function'ı kullanıcının JWT'siyle çağrılır; fonksiyon service role ile kanıt/avatar dosyalarını siler, ardından `auth.users` kaydını kaldırır (profil, kayıt, rıza satırları `on delete cascade`). Yerel temizlik **yalnız sunucu başarı dönünce** yapılır; hata olursa kullanıcıya "Hesabın silinmedi" denir.
- `audit_events` yalnız id ve makine kodu tutar. Saklama süresi bir politika kararıdır; burada tanımlanmadı.

## Supabase panelinde yapılacaklar

- Email sağlayıcısı açık; **e-posta OTP** etkin, OTP uzunluğu **6**.
- E-posta şablonu bağlantı yerine `{{ .Token }}` kodunu göstermeli.
- Üretim için **özel SMTP** (varsayılan gönderici hız sınırlıdır).
- Hız sınırları ve OTP süresi pilot öncesi gözden geçirilmeli.

## Yerel geliştirme

`supabase/dev/start.mjs` içindeki `/auth/v1` uçları GoTrue ile uyumlu **yalnız geliştirme amaçlı** küçük bir taklittir: `/otp`, `/verify`, `/token?grant_type=refresh_token`, `/logout`, `/user`. Kod e-postayla gönderilmez, terminale yazılır. Uygulama kodu değişmeden gerçek `supabase-js` istemcisiyle çalışır. `127.0.0.1` dışına bağlanmaz; staging/production'da kullanılmaz.

## Doğrulama durumu

OTP akışı (yanlış kod reddi, doğru kod, oturumun sayfa yenilemede korunması, bekleyen eyleme dönüş) 2026-09-19'da Expo web + yerel yığın üzerinde elle doğrulandı. Gerçek Supabase Auth, gerçek e-posta teslimi ve native SecureStore davranışı: **statik olarak hazırlandı, gerçek cihaz doğrulaması bekliyor.** Parçalı depolama mantığı birim testlidir.
