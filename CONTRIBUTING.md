# Katkı rehberi

Hoş geldin. Bu belge, depoda ilk kez çalışan birinin **sormadan** iş çıkarabilmesi için yazıldı. Önce [`README.md`](README.md) ile yerel ortamı kur.

## Çalışma akışı

1. `main` her zaman yeşil kalır. Doğrudan `main`'e push edilmez; her değişiklik PR ile gelir.
2. Dal adı: `feat/<kısa-konu>`, `fix/<kısa-konu>`, `docs/<…>`, `chore/<…>` — ör. `feat/opportunity-application`.
3. Commit mesajı [Conventional Commits](https://www.conventionalcommits.org/): `feat(mobile): …`, `fix(db): …`, `docs: …`. Kapsamlar: `mobile`, `admin`, `db`, `functions`, `guardian-web`, `docs`.
4. PR açmadan önce: **`npm run verify`** yeşil olmalı. CI aynı komutları çalıştırır.
5. PR küçük ve tek konulu olsun. Şablondaki kontrol listesini doldur. UI değişikliğinde ekran görüntüsü ekle.
6. Bir fazı/özelliği bitirdiysen [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md) ve ilgili `docs/*.md` dosyasını **aynı PR'da** güncelle. Doğrulamadığın şeyi ✅ işaretleme.

## Kod düzeni (mobil)

```text
apps/mobile/src/
  app/             Uygulama kökü, provider'lar
  navigation/      Tipli React Navigation yapısı, deep link
  design-system/   Token'lar, <Text>, <TechIcon>, ortak bileşenler — ekranlar SADECE buradan UI alır
  features/<alan>/ api.ts (sunucu çağrıları) · labels.ts (saf dönüşümler) · *Screen.tsx
  lib/             supabase istemcisi, hata sözleşmesi, tarih, güvenli oturum deposu, üretilmiş DB tipleri
```

- Sunucu verisi **TanStack Query**'de yaşar; context'e/AsyncStorage'a kopyalanmaz. Yerel state yalnız UI içindir (filtre, form, sheet).
- Hata gösterimi `lib/errors.ts` üzerinden: `toAppError(e).message`. Ham backend mesajı ekrana basılmaz.
- Durum metinleri (`KATILIMIN ONAYLANDI` vb.) tek yerde: `design-system/components/Status.tsx`.
- Her sunucu destekli ekranda şu durumlar düşünülür: yükleniyor · boş · filtreli boş · hata + tekrar dene · yenileme.
- Erişilebilirlik: dokunma hedefi ≥ 44, ikon-only düğmede `accessibilityLabel`, en küçük yazı 12, 320 pt genişlikte kırılmayan yerleşim.

## Tarifler

### Yeni tablo veya sunucu fonksiyonu
1. `supabase/migrations/` altına **yeni** bir dosya ekle (`YYYYMMDDHHMMSS_konu.sql`). Uygulanmış migration düzenlenmez.
2. Aynı dosyada: `enable row level security` + politikalar + `updated_at` trigger'ı + `revoke/grant execute`.
3. Yetki taşıyan yazma işlemi → `SECURITY DEFINER` fonksiyon, `set search_path = ''`, hatalar `app.fail(http_status, 'machine_code')`.
4. `supabase/tests/` altına test yaz: mutlu yol + **yetkisiz kullanıcı** + **başka kurum/takım** + gerekiyorsa eşzamanlılık.
5. `npm run db:test` → `npm run db:dev -- --reset` → `npm run db:types:local` → üretilen tip dosyasını commit'le.
6. Yeni hata kodunun Türkçe metnini `apps/mobile/src/lib/errors.ts` (ve panelde kullanılıyorsa `apps/admin/src/lib.ts`) içine ekle.

### Yeni ekran
1. `features/<alan>/api.ts` içine çağrıyı yaz (tipli, `toAppError` ile).
2. Ekranı `design-system` bileşenleriyle kur; yeni bir görsel kalıp gerekiyorsa önce bileşeni design-system'e ekle.
3. `navigation/types.ts` + `RootNavigator.tsx` içine kaydet. Giriş gerektiren eylemde `usePendingIntent` ile kullanıcıyı kaldığı yere döndür.
4. Saf mantık için jest testi, kritik bileşen için Testing Library testi ekle.
5. Çalışan uygulamada gözle doğrula (en az tarayıcı önizlemesi; mümkünse development build).

### Yeni ikon
SVG'yi `design-source/icons/` içine koy (24×24, stroke 1.75, round cap/join, `currentColor`) → `npm --prefix apps/mobile run icons`.

## Yapılmayacaklar

- İstemcide yetki bayrağı, sahte başarı durumu, "demo için geç" düğmesi.
- Gizli anahtarı koda, `.env.example`'a, dokümana, PR açıklamasına yazmak.
- Remote veritabanında `supabase db reset`; geçmiş migration'ı değiştirmek.
- `@expo/vector-icons` veya ekran içinde hardcode renk/ölçü (lint bunu yakalar).
- Hukuki metin uydurmak. Onay/politika metinleri hukuk ekibinden gelir ve sürümlenir.
- Kişisel veriyi log'a, analytics'e, QR'a veya URL'e koymak.

## Yardım

Takıldığın yerde issue aç (şablonlar hazır) ya da PR'ı taslak (draft) olarak açıp soruyu oraya yaz.
