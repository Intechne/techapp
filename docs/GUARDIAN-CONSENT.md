# Veli / yasal temsilci onayı

> Bu belge teknik modeli anlatır. Hukuki metin ya da uygunluk beyanı **içermez**; onay metni ve politika kararları Intechne'nin hukuk danışmanından gelmelidir.

## İlkeler

- Tek bir global "veli onaylı" boolean **yoktur**. Onay; kişiye, amaca ve konuya (belirli bir etkinlik kaydı) bağlıdır.
- Gereklilik etkinlik bazındadır: `events.guardian_required_under` (varsayılan 18; `NULL` = bu etkinlikte gerekmez). Karar sunucuda, gerçek doğum tarihinden hesaplanan yaşla verilir (`app.next_registration_status`).
- Reşit olmayan kullanıcı token'ı **göremez, üretemez, onayı uygulama içinden veremez**. v4'teki "Devam Et (Demo)" türü bir geçiş yoktur.

## Veri modeli

**`guardian_requests`**: `user_id`, `consent_purpose` (`event_participation` | `opportunity_application` | `team_membership`), `subject_type` + `subject_id`, `guardian_name`, `guardian_email`, `policy_version`, `status`, `verification_method` (`email_link`), `token_hash`, `revoke_token_hash`, `send_count`, `last_sent_at`, `requested_at`, `expires_at`, `confirmed_at`, `denied_at`, `revoked_at`, `decided_name`, `audit_metadata`.

**`consents`**: `user_id`, `purpose`, `policy_version`, `granted_by` (`self` | `guardian`), `guardian_request_id`, `subject_type`, `subject_id`, `granted_at`, `withdrawn_at`. Katılımcının kendi rızası da kayıt anında buraya yazılır.

İstemci `guardian_requests` tablosunu okuyamaz; sahibi yalnız `my_guardian_requests` görünümünü görür (token özetleri yok, e-posta `v•••@alan.com` biçiminde maskeli).

## Durum makinesi

```text
guardian_requests:   pending ──► approved ──► revoked
                        ├──────► denied
                        ├──────► expired      (72 saat)
                        └──────► revoked      (kayıt iptali / yeniden istek)

event_registrations: pending_guardian ──(approved)──► confirmed | pending_review
                                      ──(denied)────► cancelled  (guardian_denied)
                                      ──(expired)───► expired    (guardian_request_expired)
                     confirmed ──(guardian_revoke)──► cancelled  (guardian_revoked)
```

- **Yer tutma:** `pending_guardian` kayıt, kapasiteden bir yer tutar. İstek 72 saatte sonuçlanmazsa yer serbest kalır ve bekleme listesi ilerler (`app.promote_waitlist`).
- Süre dolumu şu an tembel çalışır (aynı etkinliğe yeni kayıt geldiğinde). Üretimde `pg_cron` ile `app.expire_guardian_requests()` zamanlanmalı (`docs/DATABASE.md`).
- Ret, iptal ve geri çekme bekleme listesini ilerletir; geri çekme `ticket_version`'ı artırarak QR'ı geçersiz kılar.

UI durumları (`guardianStatusView`): gerekli değil (kart gösterilmez) · veli onayı gerekli · gönderildi/bekleniyor · onaylandı · reddedildi · süresi doldu · geri çekildi.

## Token yaşam döngüsü

1. Katılımcı `create_guardian_request(registration_id, email, name)` çağırır. **Token üretilmez.** Kendi e-postasını veli olarak yazamaz (`guardian_email_same_as_user`). Varsa önceki bekleyen istek `revoked` olur.
2. `guardian-dispatch` Edge Function'ı önce çağıranın isteğin sahibi olduğunu (kendi RLS görünümünden) doğrular, sonra **service role** ile `issue_guardian_token` çağırır: 32 bayt rastgele token üretilir, veritabanına yalnız `sha256` özeti yazılır.
3. Token yalnız e-postaya girer; uygulamaya geri dönmez, loglanmaz.
4. Sınırlar: istek başına en çok **5 gönderim**, gönderimler arası en az **60 sn** (`429`). Yeniden gönderim önceki token'ı geçersiz kılar.
5. `guardian_request_preview(token)`: en az bilgi — katılımcının yalnız ilk adı, etkinlik, düzenleyen, son geçerlilik, `policy_version`. İletişim bilgisi dönmez.
6. `guardian_decide(token, approve, full_name, policy_version)`: tek kullanımlık; karar sonrası `token_hash` silinir. Sürüm uyuşmazsa `409 policy_version_mismatch`.
7. Onayda ayrı bir **geri çekme token'ı** üretilir ve veliye **bir kez** gösterilir. `guardian_revoke(revoke_token)` onayı geri alır.

## Veli sayfası

`apps/guardian-web/index.html` — tek dosyalık statik sayfa, Open Circuit görünümünde. Token URL **fragment**'ında taşınır (`…/guardian#<token>`), böylece sunucu loglarına ve referrer'a girmez; sayfada `noindex` ve `no-referrer` vardır. Sayfa yalnız anon key ile üç RPC'yi çağırır. Dağıtımda `__SUPABASE_URL__` ve `__SUPABASE_ANON_KEY__` yer tutucuları doldurulur. Geri çekme bağlantısı: `#<revoke_token>&revoke`.

## `guardian-dispatch` için sırlar

| Değişken | Açıklama |
|---|---|
| `RESEND_API_KEY` | E-posta sağlayıcısı anahtarı (sağlayıcı değiştirilebilir; yalnız bu fonksiyon etkilenir) |
| `GUARDIAN_PAGE_URL` | Veli sayfasının herkese açık adresi |
| `MAIL_FROM` | Doğrulanmış gönderici adresi |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` platform tarafından sağlanır. Hiçbiri mobil uygulamada bulunmaz.

## Kapsam dışı kalanlar

- **Fırsat başvuruları:** veli akışı henüz yok. `opportunities.guardian_required_under` yaşından küçük başvuranlar `submit_application` tarafından `403 guardian_consent_unavailable` ile reddedilir; kurum sütunu `NULL` yaparak reşit olmayanları doğrudan kabul edebilir.
- **Takım üyeliği:** reşit olmayanların takıma katılması veli onayına bağlanmadı (politika kararı bekliyor).

## Hukuk için açık sorular

1. Onay metninin içeriği ve sürümlemesi (`app.current_policy_version` şu an `…@2026-09-draft` döner).
2. E-posta bağlantısı + beyan edilen ad-soyad, veli kimliği için yeterli doğrulama gücünde mi? Daha güçlü yöntem gerekirse `verification_method` genişletilebilir.
3. Hangi işlemler için veli onayı gerçekten gerekli; yaş eşiği ne olmalı (şu an etkinlik başına ayarlanabilir, varsayılan 18).
4. Veli e-postası, `decided_name` ve rıza kayıtlarının saklama süresi; hesap silindiğinde ne kalmalı.
5. En küçük hesap yaşı (13) kararı.

## Doğrulama durumu

Veritabanı akışı otomatik testlidir (token'ı katılımcının alamaması, tek kullanım, sürüm denetimi, ret, süre dolumu, geri çekme). Uçtan uca akış 2026-09-19'da yerel yığında elle doğrulandı. `guardian-dispatch` Edge Function'ı ve gerçek e-posta teslimi **statik olarak hazırlandı, hiç çalıştırılmadı.**
