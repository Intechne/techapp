# TechApp · Yönetim paneli

Etkinlik düzenleyen kurum ekipleri ve Intechne yöneticileri için operasyon paneli. Vite · React 19 · TypeScript · Supabase JS.

```bash
npm install
npm run dev         # http://127.0.0.1:5180
npm run typecheck
```

Yerelde giriş: `organizator@techapp.test` — kod, `npm run db:dev` terminalinde görünür. Panel hesap **oluşturmaz**; yalnız bir kurumda rolü olan kullanıcılar içeri girer.

| Ekran | Yetki (sunucuda zorlanır) |
|---|---|
| Etkinlik listesi / oluştur / düzenle | kurum `owner`, `admin`, `editor` |
| Yayın akışı: taslak → inceleme → **yayın** | yayın yalnız Intechne platform yöneticisi |
| Kayıt listesi, değerlendirme | kurum üyeleri · değerlendirme: `owner`, `admin`, `reviewer` |
| Web giriş kontrolü (kamera / okuyucu / elle) | `owner`, `admin`, `checkin_staff` |

Panel bir SPA'dır ve mobil uygulamayla aynı *publishable* key'i kullanır: arayüz yalnız neyin **gösterileceğine** karar verir, neyin **yapılabileceğine** veritabanı (RLS + fonksiyonlar) karar verir. Kurumlar katılımcıların yalnız adını ve kayıt durumunu görür.
