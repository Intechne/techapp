# TechApp V5 · Faz 4 — Tasarım sistemi ve beş sekmenin tam ürün/UX planı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open Circuit v2'yi token borcundan arındırıp tek bir kart ailesine oturtmak, beş sekmenin (Keşfet, Etkinlikler,
Fırsatlar, Topluluk, Profil) ve onboarding/auth/etkinlik detayı/katılım kartı/check-in ekranlarının içerik hiyerarşisini,
durumlarını ve tipografisini bitirmek — ekranlara uygulamadan önce **çalışan uygulamada render edilmiş önizlemeyle kullanıcı onayı** alarak.

**Architecture:** Önce temel (semantik token katmanı, hardcode koruma testi, `CardBase` + `PosterCard`/`RowCard`/`MiniCard`,
ölçüsü kartla aynı iskeletler, ikon anlam tablosu), sonra en kötü durum verisi + geliştirici önizleme rotası, sonra
**önizleme kapısı (Task 4, durma noktası)**, sonra sekme sekme uygulama. Davranış ve veri sözleşmeleri değişmez;
bu faz görsel ve UX katmanıdır. Hareket Faz 5'tedir (burada yalnız mevcut `PressableScale`).

**Tech Stack:** Expo SDK 57 · RN 0.86 · React Navigation 7 · `expo-image` (Faz 3b Task 4) · Jest/RNTL · Expo web + Android emülatör (`adb`).

**Spec:** `docs/superpowers/specs/2026-11-11-techapp-v5-design.md` (§2 hedef 4, §5 ekran tablosu, §6) · `CLAUDE.md` "Tasarım sistemi" · Yol haritası: `docs/superpowers/plans/2026-11-12-techapp-v5-roadmap.md`
**Uygulanan ilkeler:** emil-design-eng (görünmeyen ayrıntı, tutarlılık), apple-design (tipografi, geri bildirim, sadelik), break-ui (en kötü veri), find-animation-opportunities (bu fazda hareket eklenmez; adaylar Faz 5'e not edilir).

## Global Constraints

- Dal `feat/v5-design-system`; ekran uygulamaları (Task 5–10) Task 4 onayından **sonra** başlar. Destructive git yok (stash dahil).
- Token kaynağı `design-source/tokens.json` → `tokens.ts`; yeni token yalnız `elevation` ve semantik renk katmanı (spec §5: "tip ölçeği ve token'lar değişmez, yalnız motion ve elevation eklenir"). Renk paleti değişmez: Iris `#4B46D6`, Lime `#D9F36E`, Ink `#20241F`, Canvas `#F6F7F2`, Moss `#157461`/`#E5F3EB`, Apricot `#FFD1BD`, Danger `#B8323D`/`#FFF0F1`.
- Fontlar Manrope (başlık) + DM Sans (gövde); min yazı 12; dokunma hedefi ≥44; gutter 20; 390 referans / 320 minimum; radius yalnız 14/22/26/999 (+ `small: 8` iskelet/rozet için mevcut).
- Yasak: gamer/cyberpunk/neon, her karta gradient, glassmorphism, banka uygulaması havası, Youthall/Yirmi Üç/Apple/Linear kopyası; dekoratif döngü/paralaks.
- İkon yalnız `<TechIcon>`; anlam tablosu (aşağıda) dışına çıkılmaz. Alt sekmede etiket her zaman görünür.
- Dark mode **açılmaz** (`userInterfaceStyle: light` kalır); yalnız semantik token hazırlığı.
- Her task: `verify` yeşil, `npx hig-doctor apps/mobile --fail-on serious` → 0; UI task'ı web (390 ve 320) + Android emülatör ekran görüntüsü ve %200 yazı ölçeği görüntüsüyle biter. Durum ve hata metinleri yalnız `Status.tsx` / `errors.ts`.

## Review Focus

1. **Uzun Türkçe adlar:** "Şehit Öğretmen Ayşe Gülşen Çağlayan Mesleki ve Teknik Anadolu Lisesi Robotik Takımı" kart, başlık ve sekme başlıklarında taşmaz; ad tam okunabilir (detayda sarılır, kartta 2–3 satır) (Task 2 fixture testi).
2. **Sayılar 0/1/999+:** "0 üye", "1 üye", "999+ üye", kalan kontenjan 0 ve rozet `99+` — çoğul/tekil ve genişlik bozulmaz; sayı ve tarih asla kesilmez (Task 2 testi).
3. **Görsel yok / bozuk görsel:** kapaksız ya da 404 kapaklı kart yedek posterle aynı yükseklikte; liste zıplamaz (Task 2 testi).
4. **%200 yazı ölçeği + 320 dp:** CTA'lar, durum çizgisi ve alt sekme kırılmaz, yatay kaydırma oluşmaz (Task 4 kapısı ve her ekran task'ının Step 4'ü).
5. **İşlem yapılamayan durum:** kaydı kapalı/dolu/yaşa uygun olmayan etkinlikte ekranda tek başına pasif bir birincil düğme kalmaz; neden + yapılabilecek ikincil eylem görünür (Task 6 testi).

---

## Tasarım kararları (tüm task'ların ortak sözleşmesi)

### Tipografi ve boşluk
| Rol | Varyant | Kural |
|---|---|---|
| Sekme kökü manşeti | `display` 32 | Yalnız beş sekme kökünde, en fazla 2 satır, bir kez. Detay ekranlarında yok |
| Detay başlığı | `title` 24 | İçeriğin adı; sarılır, kesilmez |
| Bölüm | `section` 20 | Bölümler arası `space[7]` (32), başlık→içerik `space[3]` |
| Kart başlığı | `cardTitle` 17 | Poster kartta en çok 3, satır kartta 2 satır |
| Gövde / ikincil | `body` 16 / `bodySmall` 14 | Açıklamalar 2 satırda kesilir (kart), detayda tam |
| Meta / etiket | `caption` 12 / `eyebrow` 12 | `eyebrow` (BÜYÜK HARF) yalnız kategorik etiket (tür, durum); **kurum/takım/kişi adı asla büyük harfe çevrilmez** |
| Sayılar | — | Sayaç, tarih ve kontenjanda `fontVariant: ['tabular-nums']`; kesilmez |

Ekran iç boşluğu gutter 20; kart içi `space[4]`; liste aralığı `space[3]`; kart ailesinde köşe `radius.card` (22) — mevcut 19 ve 30 değerleri kalkar.

### İkon anlamı (ledger + denetim)
| İkon | Yalnız şu anlam | Düzeltilen kullanım |
|---|---|---|
| `clock` | zaman, son tarih, bekleme | `Notice` warning tonu → `warning` |
| `shield` | veli onayı, güvenlik, gizlilik | `Notice` danger ve OTP hatası → `error` |
| `robot` | robotik kategori | fırsat `competition` → `badge`; takım kartlarında `categoryIcon` (3b Task 7) |
| `verified` | kurum doğrulaması / doğrulanmış deneyim | — |
| `offline` | bağlantı yok | çevrimdışı kart etiketi tonu apricot → nötr (ink üstünde), tasarım sahibi Task 4'te onaylar |
| saat glifi rozet içinde | check-in sonucu | 24 px glif 40 px yuvarlak rozet içinde (ledger: görsel ağırlık) |

### Kart ailesi
| Bileşen | Kullanım | Anatomi |
|---|---|---|
| `CardBase` | hepsinin tabanı | `surface` zemin, `border`, `radius.card`, `PressableScale`, `accessibilityLabel` = `cardLabel(parts)`, isteğe bağlı sağ üst kaydet yuvası (`BookmarkButton`) |
| `PosterCard` | etkinlik, kurs | 16:10 `CoverImage` (thumb) veya yedek poster → durum satırı (tür etiketi + uygunluk etiketi + kaydet) → başlık → 2 meta satırı (tarih·yer; hedef kitle·ücret) |
| `RowCard` | fırsat, takım, kurum, kayıt, başvuru, bildirim, arama sonucu | 46 px öncü karo (logo / kapak thumb / kategori ikonu) → başlık + ikincil (2 satır) + dipnot → sağda chevron **veya** durum etiketi **veya** kaydet |
| `MiniCard` | Keşfet raylarında takım/kurs | 2 sütun ızgara, sabit min yükseklik, başlık 2 satır, gövde 2 satır |
| `HeroCard` | Keşfet vitrini, ekranda bir tane | korunur; `#7C78E8` → `tones.iris.fg` türevi token |
Mevcut `EventCard`, `ListCard`, `OpportunityCard`, `TeamCard`, `CommunityCard`, `OpportunityCardView` bu üçüne taşınır (adlar kaldırılır; `index.ts` dışa aktarımları güncellenir). "ÖRNEK" etiketi tek kaynaktan (`DemoTag`); ad içindeki "(örnek)" yalnız seed verisidir, kodda eklenmez.

### Durumlar (her liste ekranı)
`loading` = aynı bileşenin iskelet varyantı (`PosterCardSkeleton`, `RowCardSkeleton`; yükseklik `cardMetrics`'ten) · `empty` = hiç içerik yok: davet eden metin + tek eylem · `filtered-empty` = filtre/arama varken sonuç yok: "Bu filtrelerle sonuç yok" + "Filtreleri temizle" · `error` = `ErrorState` (yeniden deneme yalnız `retryable`) · `offline` = önbellekli veri + `OfflineBanner`; veri yoksa çevrimdışı `ErrorState` · sayfalama sonu = "Hepsi bu kadar" yok, yalnız boşluk.

### Dark mode hazırlığı
`tokens.json`'a `semantic.light` (bg.canvas, bg.surface, text.primary, text.secondary, border.default, action.primary, …) ve `"status": "draft"` işaretli `semantic.dark`; bileşenler semantik adları kullanır, `semantic.dark` uygulamaya import edilmez. Kontrast testi iki haritayı da denetler (Faz 5 Task 6'daki araçla).

---

### Task 1: Token borcu, semantik katman ve hardcode koruması

**Files:** Modify `design-source/tokens.json`, `apps/mobile/src/design-system/tokens.ts`, `design-system/components/{Surface.tsx,Content.tsx,States.tsx,Form.tsx}`, `features/{opportunities/DeadlinesScreen.tsx,opportunities/MyApplicationsScreen.tsx,opportunities/OpportunityCardView.tsx,onboarding/OnboardingScreen.tsx,events/RegistrationStatusScreen.tsx,events/ParticipationCardScreen.tsx,auth/StartupUnavailableScreen.tsx,auth/AuthOtpScreen.tsx,profile/ProfileScreen.tsx}`, `design-source/ICON-SYSTEM.md` (anlam tablosu); Create `apps/mobile/src/design-system/__tests__/noHardcodedStyle.test.ts`

**Interfaces:** Produces `semantic` (light), `elevation: { none: 0, raised: 2, sheet: 8 }` (Android `elevation` + iOS gölge eşlemesi tek yardımcıda: `elevationStyle(level)`), notice tonları token'dan (`noticeTones` dışa aktarılır).

- [ ] **Step 1: Failing test** `noHardcodedStyle.test.ts`: `src/features/**` ve `src/design-system/components/**` kaynaklarında `#[0-9A-Fa-f]{3,8}`, `rgba(`, `fontSize: <sayı>`, `borderRadius: <sayı>` (yalnız `size / 2` gibi türetilmiş ifadeler serbest) bulunmaz; izin listesi boş. Bugün 30+ eşleşme ile FAIL eder (denetim: Surface.tsx 73/71/105, Content.tsx 84/94/124, States.tsx 78, Form.tsx 104–119, ekranlar).
- [ ] **Step 2:** FAIL (eşleşmeler listelenir).
- [ ] **Step 3:** Değerler token'a taşınır (yeni renk icat edilmez: `#4A4583`→`tones.iris.fg`, `#FFF1E9`/`#763C2C`→`tones.apricot`, `#7C78E8`→`semantic.light.decor.irisMuted` = Iris'in %60'ı olarak tanımlanır, `#253E35`→`tones.ink.bg`, 19/30/32→`radius.card`, OTP 22→`type.title` türevi); `noticeTones.danger.icon = 'error'`, `warning.icon = 'warning'`.
- [ ] **Step 4:** `verify` yeşil; web'de değişen her ekranın önce/sonra görüntüsü (görsel fark yalnız yuvarlatma 19→22 ve ikonlar).
- [ ] **Step 5: Commit** `refactor(design): token borcu kapandı — semantik katman, elevation, hardcode koruma testi, ikon anlamları`

### Task 2: Kart ailesi tek tabanda + iskeletler

**Files:** Create `apps/mobile/src/design-system/components/cards/{CardBase.tsx,PosterCard.tsx,RowCard.tsx,MiniCard.tsx,BookmarkButton.tsx,DemoTag.tsx,metrics.ts,label.ts}`, `design-system/__tests__/{cards.test.tsx,cardLabel.test.ts}`, `apps/mobile/src/dev/fixtures/worstCase.ts`; Modify `design-system/components/{Content.tsx,States.tsx}`, `design-system/index.ts`, tüm kart kullanan ekranlar (yalnız bileşen değişimi; düzen Task 5–10'da)

**Interfaces:**
- Produces `PosterCardProps = { title: string; typeLabel: string; availability?: StatusView; dateLabel: string; placeLabel: string; audienceLabel?: string; feeLabel?: string; cover: { path: string | null; blurhash: string | null }; fallback: { tone: Tone; icon: TechIconName; line: string }; isDemo?: boolean; saved?: boolean; onToggleSave?: () => void; onPress: () => void }`; `RowCardProps = { leading: { kind: 'icon'; icon: TechIconName } | { kind: 'image'; path: string | null; fallbackIcon: TechIconName }; title: string; secondary?: string; footnote?: string; trailing?: { kind: 'chevron' } | { kind: 'status'; view: StatusView } | { kind: 'bookmark'; saved: boolean; onToggle: () => void }; isDemo?: boolean; onPress?: () => void }`; `MiniCardProps = { icon: TechIconName; title: string; body?: string; onPress?: () => void }`.
- Produces `cardMetrics: { poster: { coverAspect: 1.6; bodyMinHeight: number }; row: { minHeight: number }; mini: { minHeight: 136 } }`; `cardLabel(parts: (string | null | undefined)[]): string` (boşları atar, ". " ile birleştirir); `formatCount(n: number, noun: { one: string; other: string }): string` (Türkçede çoğul eki yok: "0 üye", "1 üye", "999 üye", `≥1000` → "1.000+ üye" — `tr-TR` biçimi).
- `worstCase.ts`: uzun ad/kurum/şehir, tek harfli ad, kırılmaz tek kelime (`Mühendislikbilimleriuygulamaları`), emoji, sayılar 0/1/999/12000, kapaksız, kırık kapak URL'si, boş açıklama, 6000 karakter açıklama.

- [ ] **Step 1: Failing testler:** her kart worst-case fixture ile render olur ve başlık metni kesilmeden `accessibilityLabel`'da tam bulunur; `PosterCard` kapaksız/kapaklı aynı `cardMetrics` yüksekliğinde; iskelet varyantı aynı yükseklikte; `RowCard` trailing tek seçimli (tip düzeyinde, `@ts-expect-error` testi); `BookmarkButton` a11y "Kaydet"/"Kaydı kaldır", dokunma alanı ≥44; `formatCount` örnekleri; `DemoTag` yalnız `isDemo` iken; kurum adı `eyebrow` içinde büyük harfe çevrilmez.
- [ ] **Step 2:** FAIL → **Step 3:** uygula; eski kart adları kaldırılır, kullanım yerleri derlenir → **Step 4:** `verify` yeşil.
- [ ] **Step 5: Commit** `feat(design): kart ailesi — CardBase üzerinde PosterCard, RowCard, MiniCard; aynı ölçülü iskeletler`

### Task 3: En kötü durum verisi ve geliştirici önizleme rotası

**Files:** Create `apps/mobile/src/dev/DesignPreviewScreen.tsx`, `apps/mobile/src/dev/__tests__/devOnly.test.ts`, `supabase/dev/seed-worst-case.sql`; Modify `apps/mobile/src/navigation/{RootNavigator.tsx,linking.ts,types.ts}`, `supabase/dev/start.mjs` (`--worst-case` bayrağı), `docs/TESTING.md`

**Interfaces:** Produces rota `DesignPreview` yalnız `__DEV__ && env.appEnv === 'local'` iken kayıtlı (`techapp://design-preview`); ekranın üstünde "Demo veri / En kötü durum" anahtarı (break-ui); seed: tüm satırlar `is_demo = true`, yalnız yerel yığına `npm run db:dev -- --reset --worst-case` ile.

- [ ] **Step 1: Failing test** `devOnly.test.ts`: `appEnv` `development|preview|production` iken `DesignPreview` rotası yığında yok ve derin bağlantı eşleşmez; `npx expo export --platform android` çıktısında (test, export dizinini okuyan ayrı bir `npm run check:no-dev-preview` script'i) `worstCase` fixture işaret dizesi bulunmaz.
- [ ] **Step 2:** FAIL → **Step 3:** uygula (önizleme ekranı: kart ailesinin tüm varyantları × iki veri seti × durumlar: loading/empty/filtered-empty/error/offline) → **Step 4:** `verify` + `check:no-dev-preview` yeşil.
- [ ] **Step 5: Commit** `chore(dev): en kötü durum verisi ve yalnız yerelde açılan tasarım önizleme rotası`

### Task 4: ⛔ Render edilmiş önizleme kapısı (kullanıcı onayı — durma noktası)

**Files:** Create `docs/design/faz4-preview/REVIEW.md` + yalnız sıkıştırılmış kontak sayfaları (`docs/design/faz4-preview/*.png`, toplam ≤ 3 MB; ham görüntüler repoya girmez, scratchpad'de kalır)

Önizlenecek: (a) kart ailesi sayfası (Task 3 rotası, iki veri seti); (b) **her sekmeden bir ekran**, gerçek ekran bileşenleriyle yerel yığında worst-case seed üzerinde ve Task 5–9'daki hiyerarşiye göre **dalda taslak olarak** uygulanmış hâliyle: Keşfet ana, Etkinlikler listesi, Fırsatlar listesi, Topluluk ana, Profil (giriş yapmış); (c) etkinlik detayı (kaydı kapalı ve açık).

- [ ] **Step 1:** Web önizleme (Expo web) 390×844 ve 320×640, yazı ölçeği 1.0; Android emülatör (`Medium_Phone_API_36.1`) yazı ölçeği 1.0 ve 2.0 (`adb shell settings put system font_scale 2.0`), `adb exec-out screencap -p`.
- [ ] **Step 2:** `REVIEW.md`: her ekran için kontak sayfası, break-ui bulgu listesi (ne kırıldı / düzeltme / karar gereken), kullanıcıya sorular (ör. çevrimdışı etiketi tonu, eyebrow kuralı, kapaksız poster grafiği, Keşfet bölüm sırası).
- [ ] **Step 3:** Kullanıcıya sun; **onay gelene kadar Task 5–10 başlamaz.** Geri bildirim → Task 1–3'te düzeltme turu → bu adım tekrar. Onay tarihi ve onaylanan kontak sayfaları `REVIEW.md`'ye yazılır.
- [ ] **Step 4: Commit** `docs(design): Faz 4 önizleme kapısı — kart ailesi ve beş sekme, onay kaydı`. Taslak ekran değişiklikleri kaybolmasın diye ayrı `feat/v5-design-preview` dalında `wip(design): önizleme taslağı — onay bekliyor` olarak commit'lenir (stash yok); bu dal birleştirilmez, onaydan sonra Task 5–10 değişiklikleri `feat/v5-design-system`'de task başına temiz commit'lerle yeniden kurulur.

---

## Sekme planları (Task 5–10 bu tabloları uygular)

### Keşfet
| Ekran | İşi | Hiyerarşi (yukarıdan aşağı) | Durumlar · kararlar |
|---|---|---|---|
| Keşfet ana | "Bugün ne yapabilirim?" sorusuna 10 sn'de cevap | başlık çubuğu (marka · bildirim zili rozetli · Katılımlarım) → selam + manşet (`display`, 2 satır) → arama alanı (dokununca Arama ekranı; yerinde arama yok) → ilgi çipleri → vitrin (`HeroCard`, yalnız kaydı açık) → Yaklaşan etkinlikler (3 `PosterCard`) → Sıradaki adımın (3 fırsat `RowCard`) → Birlikte üretenler (2 `MiniCard`) → Gelişim (2 kurs `MiniCard`) | vitrin yoksa liste yukarı çıkar (boşluk bırakılmaz); bölüm boşsa gizlenir; tüm bölümler boşsa tek `EmptyState` ("Şu an yayında içerik yok — ilgi alanlarını genişlet"); ilgi filtresiyle boş → filtered-empty yalnız etkinlik bölümünde; misafirde zil yok |
| Arama | birleşik sonuç | arama alanı (otomatik odak) → son aramalar yok (PII riski yok ama gereksiz; karar) → gruplar: Etkinlikler, Fırsatlar, Takımlar, Eğitimler (her grup 5 `RowCard` + "Tümünü gör") | <2 karakter: ipucu; sonuç yok: "“…” için sonuç yok" + öneri çipleri; grup hatası satır içi |
| Bildirimler | olanları tek yerde | Bugün / Bu hafta / Daha önce; `RowCard` (ikon = tür, okunmamış nokta Iris) | boş: "Henüz bildirim yok. Kayıt ve başvuru güncellemelerin burada görünür." |

### Etkinlikler
| Ekran | İşi | Hiyerarşi | Durumlar · kararlar |
|---|---|---|---|
| Liste | uygun etkinliği bul | manşet → Katılımlarım + Filtrele (native sheet: tür, biçim, şehir, tarih aralığı, yalnız kaydı açık) → tür çipleri → `PosterCard` listesi (sayfalı) | aktif filtre sayısı Filtrele düğmesinde ("Filtrele · 2"); filtered-empty; sonsuz kaydırma alt iskeleti |
| Detay | karar vermek ve kaydolmak | kapak (16:10 full) → durum etiketleri (tür · uygunluk · ÖRNEK) → başlık (`title`) → özet → meta blok (tarih-saat, yer, hedef kitle·ücret, son kayıt, kontenjan) → düzenleyen (`OrganizerRow` → kurum profili) → Neler olacak → Program → Bu etkinliğe hazırlan → Bilmen gerekenler → Gönüllü ol; yapışkan alt eylem | **tek uyarı kutusu**: birden çok engel nedeni varsa en belirleyici tek `Notice` (öncelik: kayıtlı → kapandı → dolu → yaş → takım) + "Diğer nedenler" ayrıntısı; kayıt yapılamıyorsa alt alanda pasif birincil düğme yerine neden satırı + ikincil eylem ("Kaydet", "Takımını bul", "Benzer etkinlikler"); başlık çubuğu "Etkinlik" yerine boş, geri + paylaş + kaydet |
| Kayıt / durum / veli | ne oldu, sırada ne var | mevcut `StatusTimeline` korunur; sonuç başlığı + kart özeti + süreç + tek birincil eylem | veli e-postası maskeli; `expires_at` sunucudan; iptal ikincil-tehlike düğmesi, onay modalı |
| Katılım kartı | kapıda hızlı okutma | ad, etkinlik, QR (yüksek kontrast, sessiz alan ≥4 modül), kısa kod (`title`, `tabular-nums`, harf aralığı token), parlaklık ipucu, çevrimdışı etiketi | çevrimdışı etiketi nötr ton (karar Task 4); kart ekranında dekor yok |
| Check-in (görevli) | sıradaki kişiyi hızla geçirmek | kamera → sonuç bloğu (ikon rozeti + başlık + ad) → "Sıradaki" | sonuç bloğu tek a11y duyurusu (Faz 5'te çift okuma düzeltilir); kısa kod alanı her zaman görünür (Huawei) |

### Fırsatlar
| Ekran | İşi | Hiyerarşi | Durumlar · kararlar |
|---|---|---|---|
| Liste | kaçırmamak | manşet → Son tarihler · Başvurularım → tür çipleri → `RowCard` (öncü: kurum logosu, yoksa tür ikonu; dipnot: son başvuru + kalan gün etiketi; sağda kaydet) | son tarihi geçmiş fırsat listede yok; "SON 1 GÜN" etiketi `danger` değil `apricot` (panik değil uyarı) |
| Detay | başvurmaya karar | kapak/poster → etiketler → başlık → özet → meta (son tarih, yer/çevrim içi, hedef kitle, yaş) → beceriler → kurum → paylaşılacak veri önizlemesi → yapışkan "Başvurunu hazırla" | yaş uymuyorsa nedeni + "Kaydet" |
| Başvuru / Başvurularım / Son tarihler | — | mevcut akış korunur; `RowCard` + `Status.tsx` etiketleri | Son tarihler: Bu hafta / Bu ay / Sonra grupları |
| Kurum profili | güven | logo + ad + doğrulama → hakkında → etkinlikler → fırsatlar | (3b Task 14) |

### Topluluk
| Ekran | İşi | Hiyerarşi | Durumlar · kararlar |
|---|---|---|---|
| Ana | kendine ekip bulmak | manşet → "Takımım" kısayolu (varsa, tek satır `RowCard`) → Takımlar/Topluluklar segment → `RowCard` (öncü: kapak thumb ya da `categoryIcon`; dipnot: kategori · şehir · `formatCount` üye) → "Takım kur" kartı | robot ikonu yalnız robotik; "(örnek)" ad + "Örnek" dipnot tekrarı yerine `DemoTag` |
| Takım profili | katılmaya karar | kapak (`TeamCover` kapaklı/kapaksız) → durum etiketleri → üye sayısı · şehir → Hakkında → Rol dağılımı → Açık roller → Projeler → Etkinlikler; yapışkan eylem | 18 yaş altı ad yok (sunucu); "1 üye" gibi az veride bölümler gizlenir |
| Takım alanı / görev | işi yürütmek | mevcut kanban korunur; görev kartı `RowCard` türevi; öncelik etiketi | — |

### Profil
| Ekran | İşi | Hiyerarşi | Durumlar · kararlar |
|---|---|---|---|
| Profil (giriş) | "yaptıkların seni anlatsın" | üst kart (avatar hero'ya **taşmaz**: avatar + ad + eğitim aşaması tek satır kartta; e-posta profil kartında gösterilmez, Ayarlar > Hesap'ta) → sayaçlar (Deneyim · Doğrulanmış · Katılım) → Yaklaşan (≤3) → Deneyimler/Katılımlar/Takımlar segment → Kaydedilenler · Bildirimler · Ayarlar girişleri | sayaç 0 iken bile kart dengeli; `formatCount` |
| Misafir profil | değer önerisi | başlık + üç fayda (ikon + tek satır: katıl, doğrulat, paylaş) + tek birincil "Giriş yap veya hesap oluştur" | boş alan kalmaz |
| Deneyim / CV / Gönüllü | — | mevcut; `ProvenanceBadge` "Kendi beyanı" / "Doğrulanmış" ayrımı korunur | — |

### Onboarding ve auth
| Ekran | Karar |
|---|---|
| Onboarding | poster tipografisi korunur; 3 adım (değer → eğitim aşaması → ilgi alanları) + "Şimdilik geç"; ilerleme noktaları değil "2/3" metni (a11y); `#253E35` → token |
| AuthEmail / AuthOtp | tek görev ekranı; OTP alanı `textContentType="oneTimeCode"`, harf aralığı/yazı boyu token (HIG Doctor bulgusu); hata ikonu `error` |
| ProfileBootstrap | ad, doğum tarihi (neden istendiği tek satır), eğitim aşaması; 18 yaş altı bilgi notu sunucu cevabından |
| StartupUnavailable | radius 28 → `radius.hero`; dürüst metin korunur |

---

### Task 5: Keşfet (ana, arama girişi, bildirim rozeti)

**Files:** Modify `features/discovery/DiscoverScreen.tsx`, `design-system/components/Screen.tsx` (`AppHeader` sağ yuva), testler `features/discovery/__tests__/discoverScreen.test.tsx` (yeni)
- [ ] **Step 1: Failing testler:** bölüm sırası tablodaki gibi; vitrin yokken boşluk yok (ilk eleman "Yaklaşan etkinlikler" başlığı); tüm bölümler boşken tek `EmptyState`; arama alanına dokunma `navigate('Search')`; misafirde zil yok; her bölüm başlığının "Tümünü gör" eylemi doğru sekmeye.
- [ ] **Step 2–4:** FAIL → uygula (Task 4'te onaylı taslaktan) → `verify`; web 390/320 + emülatör 1.0/2.0 görüntüleri; worst-case seed ile.
- [ ] **Step 5: Commit** `feat(mobile): Keşfet yeni hiyerarşi — onaylı kart ailesi, bölüm kuralları, arama ve bildirim girişleri`

### Task 6: Etkinlikler (liste, filtre, detay, kayıt/durum, katılım kartı, check-in)

**Files:** Modify `features/events/{EventsListScreen.tsx,EventDetailScreen.tsx,RegistrationStatusScreen.tsx,ParticipationCardScreen.tsx,labels.ts}`, `features/checkin/CheckInScreen.tsx`, `features/guardian/GuardianRequestScreen.tsx`; Create `features/events/{detailBlocker.ts,EventFiltersScreen.tsx}`, `__tests__/{detailBlocker.test.ts,eventsList.test.tsx}`
**Interfaces:** Produces `primaryBlocker(reasons: string[], registered: boolean): { reason: string; secondary: 'save'|'find_team'|'similar'|null } | null` (öncelik: kayıtlı → `registration_closed` → `event_full` → yaş → `team_registration_only`); `EventFiltersScreen` native-stack `presentation: 'formSheet'` (`sheetAllowedDetents: [0.6, 1]`), filtre durumu route param ile döner.
- [ ] **Step 1: Failing testler:** `primaryBlocker(['registration_closed','team_registration_only'], false)` → `registration_closed` + ikincil `similar`; kayıt yapılamazken ekranda `disabled` birincil düğme yok; liste filtered-empty "Filtreleri temizle" tüm filtreleri sıfırlar; Filtrele düğmesi etiketi aktif filtre sayısını içerir; katılım kartında kısa kod `tabular-nums`.
- [ ] **Step 2–4:** FAIL → uygula → `verify`; web + emülatör görüntüleri (kaydı açık/kapalı/dolu/16 yaş veli bekliyor/kart/check-in üç sonuç).
- [ ] **Step 5: Commit** `feat(mobile): Etkinlikler — filtre sheet'i, tek engel kutusu, pasif birincil düğme yok, kart ve check-in görsel geçişi`

### Task 7: Fırsatlar (liste, detay, başvuru, son tarihler, başvurularım)

**Files:** Modify `features/opportunities/*Screen.tsx`, `features/opportunities/labels.ts` (`competition` → `badge`); Create `__tests__/opportunitiesList.test.tsx`
- [ ] **Step 1: Failing testler:** tür ikonu tablosu (`competition → badge`, robot yok); kalan gün etiketi tonu (`≤1 gün` apricot, `≤7` iris, sonrası yok); geçmiş son tarihli fırsat listede yok; Son tarihler gruplaması.
- [ ] **Step 2–4:** FAIL → uygula → `verify`; görüntüler.
- [ ] **Step 5: Commit** `feat(mobile): Fırsatlar görsel geçişi — RowCard, ikon anlamları, son tarih tonları`

### Task 8: Topluluk (ana, takım profili, takım alanı, takım kur)

**Files:** Modify `features/community/CommunityScreen.tsx`, `features/teams/{TeamDetailScreen.tsx,TeamCover.tsx,TeamWorkspaceScreen.tsx,TeamTaskEditorScreen.tsx,CreateTeamScreen.tsx}`; Create `features/community/__tests__/communityScreen.test.tsx`
- [ ] **Step 1: Failing testler:** "Takımım" yalnız etkin üyelikte; liste kartında `DemoTag` + ad tekrarı yok; `formatCount` "1 üye"/"999 üye"; boş bölümler gizli.
- [ ] **Step 2–4:** FAIL → uygula → `verify`; görüntüler (uzun takım adı, 0 üye, kapaksız/kapaklı).
- [ ] **Step 5: Commit** `feat(mobile): Topluluk görsel geçişi — takım kartları, Takımım kısayolu, profil bölümleri`

### Task 9: Profil (giriş yapmış, misafir, deneyim, girişler)

**Files:** Modify `features/profile/{ProfileScreen.tsx,ExperienceDetailScreen.tsx,ExperienceEditorScreen.tsx,EditProfileScreen.tsx}`; Create `features/profile/__tests__/profileScreen.test.tsx`
- [ ] **Step 1: Failing testler:** avatar hero dışına taşmaz (üst kart tek blok, `onLayout` testi yerine yapı testi: avatar ve ad aynı kartın çocukları); e-posta profil ekranında yok; misafir: üç fayda + tek birincil eylem; Kaydedilenler/Bildirimler/Ayarlar girişleri yalnız ilgili modül birleştiyse (yoksa giriş gösterilmez).
- [ ] **Step 2–4:** FAIL → uygula → `verify`; görüntüler (yetişkin, 16 yaş, misafir, 0 deneyim, 12 deneyim).
- [ ] **Step 5: Commit** `feat(mobile): Profil yeniden düzen — üst kart, sayaçlar, Yaklaşan, misafir değer önerisi`

### Task 10: Onboarding ve auth

**Files:** Modify `features/onboarding/OnboardingScreen.tsx`, `features/auth/{AuthEmailScreen.tsx,AuthOtpScreen.tsx,ProfileBootstrapScreen.tsx,StartupUnavailableScreen.tsx}`
- [ ] **Step 1: Failing testler:** onboarding adım metni "2/3" a11y etiketinde; OTP alanı `textContentType="oneTimeCode"` + `autoComplete="one-time-code"`; OTP hata `Notice` ikonu `error`.
- [ ] **Step 2–4:** FAIL → uygula → `verify`; `npx hig-doctor` OTP bulgusu kapanmış; görüntüler.
- [ ] **Step 5: Commit** `feat(mobile): onboarding ve giriş ekranları görsel geçişi; OTP alanı HIG bulgusu kapandı`

### Task 11: Kapanış — denetim ve belgeler

**Files:** Modify `IMPLEMENTATION-STATUS.md`, `docs/KNOWN-ISSUES.md`, `design-source/URUN-VE-UX.md`, `design-source/ICON-SYSTEM.md`, `docs/audits/` (yeni HIG Doctor raporu)
- [ ] **Step 1:** `npx hig-doctor apps/mobile --fail-on serious` → 0; rapor `docs/audits/<tarih>-hig-doctor.md`.
- [ ] **Step 2:** Tüm ekranların son kontak sayfası (`docs/design/faz4-final/`, ≤3 MB) — Task 4'te onaylananla yan yana; sapma varsa kullanıcıya not.
- [ ] **Step 3: Commit** `docs(design): Faz 4 kapanışı — denetim, son görüntüler, kart ailesi ve ikon anlamı belgesi`

---

## Self-review (yazar notu)

- **Kapsam:** beş sekme + onboarding/auth/detay/kart/check-in için iş, hiyerarşi, durumlar (tablolar); kart ailesi (T2); tipografi/boşluk (karar tablosu); ikon anlamı ve ledger (`competition` robot, kalkan, saat rozeti, apricot çevrimdışı) (T1, T6, T7); dark mode hazırlığı (T1); render edilmiş önizleme kapısı (T4) ve break-ui verisi (T2–3).
- **Faz 3b'ye bağımlılık:** Arama, Bildirimler, Kurum profili, Kaydedilenler, kapaklar ilgili 3b task'ı birleşmişse giydirilir; birleşmemişse Task 5–9'da o satır atlanır ve `REVIEW.md`'ye not düşülür.
- **Hareket:** bu fazda yeni animasyon yok (sheet geçişi native); adaylar Faz 5 planında.
- **Orantı:** kod yok; her ekran için yalnız karar ve test adı.
