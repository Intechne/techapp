# Faz 5 Task 4 report

Status: DONE (audit only; no product code changed). Branch feat/v5-product.
Deliverables: docs/qa/a11y-scripts.md, docs/qa/2026-11-14-a11y-android.md, docs/qa/2026-11-14-a11y-ios.md ("yapılmadı — Xcode/iOS cihaz yok").
Method: live TalkBack NOT run; accessibility-tree audit via uiautomator dumps (stated in docs). Announcements marked "jest testiyle kapsandı" (T5, T11) or "doğrulanamadı" (T14 rotor).
Steps: 24 total, 18 geçti, 3 kaldı, 3 doğrulanamadı (TalkBack-tree 14: 9/2/3; font 200% 5: 4/1; 320 dp 5: 5/0).
Findings: P1=1 (F-01 Button loading leaves content-desc "busy", label lost), P2=2 (F-02 tab labels ignore font scale; F-03 blocker Notice not alert, split, triple-read), P3=8 (F-04..F-11).
Font 200%: only tab labels fail (not scaled); all else fine. 320 dp: pass (pilot's "Etkinlikl…" truncation gone); 320dp+200% leaves ~50% viewport; tab labels tight at 320dp (risk when Task 5 enables scaling).
Cleanup: dev client removed, preview APK reinstalled+launched twice, 5.0.0, reverse removed, font/wm reset, env x3 restored, metro.config.js md5 44114fa0 restored, shim removed, own expo/db:dev stopped; 54329 untouched. Screenshots stay in $S/shots/5-4-*.
Concerns: TalkBack package exists in the image but was not enabled (instruction); F-10 (font change resets nav) only seen in dev client; heading flag unobservable.
