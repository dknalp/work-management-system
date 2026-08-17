# Files System Roadmap — Google Drive Benzeri

> Bu döküman, mevcut dosya sisteminin Google Drive seviyesine çıkarılması için planlanan tüm özellikleri öncelik sırasıyla listeler.

---

## Mevcut Durum

**Backend (`backend/app/routers/v1/files.py`):**
- `FileRecord` modeli (PostgreSQL metadata + R2/local depolama)
- CRUD: list, upload, folder create, rename, move, copy, trash, restore, permanent delete, empty trash
- Quota endpoint, zip download, search (isim bazlı), presigned URL'ler

**Frontend (`frontend/components/files/`):**
- List / grid görünüm, breadcrumb navigasyon
- Toolbar (upload, yeni klasör, görünüm değiştir)
- Drag-drop upload (FileDropZone)
- Clipboard (copy/cut/paste)
- Selection lasso (çoklu seçim)
- Preview panel (image + PDF)
- Arama (SearchResultsView)
- Çöp kutusu dialog'u

---

## Özellik Listesi

### 1. 🔗 Paylaşım & İzinler

**Ne yapılacak:**
- Dosya/klasörü belirli kullanıcılarla paylaş (view / edit / owner rolleri)
- Herkese açık ya da şifreli paylaşım linki oluştur
- Paylaşım linkine TTL (sona erme tarihi) atanabilir
- "Paylaş" dialog'u: kullanıcı ekle/çıkar, izin düzenle, link kopyala

**Backend:**
- Yeni tablo: `FileShare` (`file_id`, `shared_with_user_id` nullable, `share_token` nullable, `permission_level: view|edit|owner`, `expires_at` nullable)
- `POST /api/v1/files/share/{file_id}` — paylaşım oluştur / güncelle
- `GET /api/v1/files/share/{file_id}` — mevcut paylaşımları listele
- `DELETE /api/v1/files/share/{share_id}` — paylaşımı kaldır
- `GET /api/v1/files/public/{token}` — anonim erişim (token doğrulama)

**Frontend:**
- Share dialog bileşeni (kullanıcı arama input, izin dropdown, link oluştur butonu, TTL seçici)
- Toolbar ve sağ-tık menüsüne "Paylaş" seçeneği
- Paylaşılmış dosyalarda özel badge/ikon

**Zorluk:** Orta | **Öncelik:** 🔴 P0

---

### 2. ⭐ Yıldızlı / Sık Kullanılanlar

**Ne yapılacak:**
- Her dosya/klasör için yıldız toggle
- Sol sidebar'da "Yıldızlılar" bölümü (ayrı view)
- Grid/list'te yıldızlı dosyalarda dolu yıldız ikonu

**Backend:**
- `FileRecord` modeline `is_starred: bool = False` alanı ekle (migration)
- `POST /api/v1/files/star/{file_id}` — toggle (yıldızla / yıldızı kaldır)
- `GET /api/v1/files/starred` — yıldızlı dosyaları listele

**Frontend:**
- Her dosya satırı/kartında yıldız butonu
- Sidebar'a "Yıldızlılar" nav linki + view
- Toolbar'da "Sadece yıldızlıları göster" filtresi

**Zorluk:** Kolay | **Öncelik:** 🔴 P0

---

### 3. 🕐 Son Görüntülenenler

**Ne yapılacak:**
- Her dosya açma / indirme işleminde erişim kaydı tut
- Sidebar'da "Son Görüntülenenler" view'u (son 50 erişim, tarih sıralı)
- Ana files sayfasında "Son Görüntülenenler" hızlı erişim bölümü

**Backend:**
- Yeni tablo: `FileAccessLog` (`file_id`, `user_id`, `accessed_at`, `action: view|download`)
- `GET /api/v1/files/recent?limit=50` — kullanıcının son görüntüledikleri
- Mevcut download/preview endpoint'lerine log kaydı ekle

**Frontend:**
- Sidebar'a "Son Görüntülenenler" nav linki
- Recent view bileşeni (tarih gruplandırmalı: bugün, dün, bu hafta)
- Dosya açılırken API'ye erişim kaydı gönder

**Zorluk:** Kolay | **Öncelik:** 🔴 P0

---

### 4. 📦 Toplu İşlemler (Bulk Operations)

**Ne yapılacak:**
- Seçili birden fazla dosyaya: taşı, kopyala, çöpe at, indir (zip)
- Seçim yapıldığında ekranın altında floating action bar belir (Google Drive gibi)
- "Tümünü seç" checkbox'ı

**Backend:**
- `POST /api/v1/files/bulk-move` — body: `{ids: [...], dest_parent: "..."}`
- `POST /api/v1/files/bulk-copy` — body: `{ids: [...], dest_parent: "..."}`
- `DELETE /api/v1/files/bulk-trash` — body: `{ids: [...]}`
- (Bulk zip download zaten mevcut: `POST /api/v1/files/zip`)

**Frontend:**
- Seçim sayısı > 0 olduğunda floating action bar (taşı, kopyala, sil, zip indir, yıldız, paylaş)
- Taşı / Kopyala için hedef klasör seçici dialog (folder tree picker)

**Zorluk:** Orta | **Öncelik:** 🔴 P0

---

### 5. 🖱️ Sürükle-Bırak Klasör Taşıma (DnD Move)

**Ne yapılacak:**
- Bir dosyayı sürükleyip klasörün üzerine bırakınca o klasöre taşı
- Klasörleri de birbirinin içine sürükle-bırak ile taşı
- Üzerine gelindiğinde klasör highlight olsun

**Backend:** Değişiklik yok — mevcut `POST /api/v1/files/move/{file_id}` kullanılacak.

**Frontend:**
- dnd-kit ile dosya öğelerini draggable yap
- Klasörleri droppable target yap (hover highlight)
- Breadcrumb segmentlerini de drop target yap (üst klasöre taşımak için)
- Sürükleme sırasında drag overlay (dosya adı + ikon görüntüle)

**Zorluk:** Orta | **Öncelik:** 🔴 P0

---

### 6. 🔍 Gelişmiş Arama Filtreleri

**Ne yapılacak:**
- Şu an: sadece isim bazlı arama
- Eklenecek filtreler: dosya tipi, tarih aralığı, boyut aralığı, yıldızlı, paylaşılmış
- Arama kutusu altında genişleyen filtre paneli
- Son aramalar geçmişi (localStorage)

**Backend:**
- `GET /api/v1/files/search` endpoint'ine yeni query param'lar:
  - `type: file|folder`
  - `mime_category: image|video|audio|document|spreadsheet|code|archive`
  - `min_size`, `max_size` (byte)
  - `date_from`, `date_to` (ISO 8601)
  - `is_starred: bool`
  - `is_shared: bool`

**Frontend:**
- Arama input'unun yanına "Filtreler" butonu
- Genişleyen filtre paneli (dosya tipi checkbox'ları, tarih picker, boyut slider)
- Aktif filtreler chip'leri (her chip'in yanında kaldır butonu)
- Arama geçmişi dropdown (son 10 arama)

**Zorluk:** Kolay | **Öncelik:** 🟡 P1

---

### 7. 🎬 Video & Audio Preview

**Ne yapılacak:**
- Preview panelinde video oynatıcı (mp4, webm, mov, mkv)
- Audio oynatıcı (mp3, wav, ogg, m4a, flac)
- Tam ekran video modu

**Backend:** Değişiklik yok — mevcut presigned URL'ler yeterli.

**Frontend:**
- `file-preview-panel.tsx`'e video tipi için `<video>` elementi ekle (presigned URL src)
- Audio tipi için `<audio>` elementi (oynat/durdur, seek bar, süre)
- Tam ekran butonu (Fullscreen API)
- MIME type bazlı yönlendirme: `video/*` → video player, `audio/*` → audio player

**Zorluk:** Kolay | **Öncelik:** 🟡 P1

---

### 8. 📄 Office Döküman Preview

**Ne yapılacak:**
- `.docx`, `.xlsx`, `.pptx`, `.doc`, `.xls`, `.ppt` dosyalarını tarayıcıda önizle
- Hazır modül kullanımı (sıfırdan yazmak yerine)

**Seçilen Yaklaşım — Google Docs Viewer embed:**
- `https://docs.google.com/viewer?url=<presigned_url>&embedded=true` iframe
- Kurulum yok, backend değişikliği yok, ücretsiz

**Alternatif — WOPI/OnlyOffice (self-hosted):**
- OnlyOffice Document Server Docker container
- Tam edit desteği (sadece preview değil)
- `docker-compose.yml`'e `onlyoffice` servisi eklenir

**Frontend:**
- `file-preview-panel.tsx`'e office mime type'ları için iframe bileşeni ekle
- Google Docs Viewer URL'ini presigned URL'den oluştur
- Yüklenirken skeleton loader
- "Ayrı sekmede aç" fallback butonu

**Zorluk:** Kolay (Google Docs Viewer) / Zor (OnlyOffice) | **Öncelik:** 🟡 P1

---

### 9. 📝 Markdown & Kod Dosyası Preview

**Ne yapılacak:**
- `.md` dosyaları render edilmiş markdown olarak göster
- `.js`, `.ts`, `.py`, `.json`, `.yaml`, `.html`, `.css` vb. syntax highlighted kod olarak göster

**Paketler:**
- Markdown: `react-markdown` + `remark-gfm`
- Kod: `shiki` (tema: `github-dark` / `github-light`)

**Backend:** Değişiklik yok.

**Frontend:**
- Dosya içeriğini presigned URL'den fetch et (küçük dosyalar için, max 1MB)
- `file-preview-panel.tsx`'e markdown ve kod preview bileşenleri ekle
- Dark/light mode ile uyumlu tema

**Zorluk:** Kolay | **Öncelik:** 🟡 P1

---

### 10. 📂 Klasör Rengi & Emoji İkonu

**Ne yapılacak:**
- Klasöre renk ata (8 seçenek: kırmızı, mavi, yeşil, sarı, mor, turuncu, pembe, gri)
- Klasöre emoji ikon seç
- Sağ-tık menüsüne "Rengi değiştir" ve "İkon seç" seçenekleri

**Backend:**
- `FileRecord` modeline `color: Optional[str]`, `icon_emoji: Optional[str]` ekle (migration)
- `PATCH /api/v1/files/customize/{file_id}` — `{color, icon_emoji}` body

**Frontend:**
- Renk seçici bileşen (8 renkli daire, seçili olanın üzerinde checkmark)
- Emoji picker (`emoji-mart` paketi ya da sınırlı emoji grid)
- Klasör ikonu renkle boyanmış olarak göster

**Zorluk:** Kolay | **Öncelik:** 🟡 P1

---

### 11. 📁 Çoklu Upload: İlerleme & Kuyruk

**Ne yapılacak:**
- Çok dosya sürüklendiğinde her biri için ayrı progress bar
- Upload kuyruğu paneli (köşede açılır panel, tamamlananlar ✓, devam edenler %)
- Hata olan dosyalar için "Tekrar dene" butonu
- Klasör drag-drop upload (`webkitdirectory`)

**Backend:** Değişiklik yok.

**Frontend:**
- Upload queue state yönetimi (her item: `{file, status: pending|uploading|done|error, progress}`)
- Toast yerine köşede kalıcı upload tray bileşeni
- `<input webkitdirectory>` ile tüm klasör yükleme desteği
- Her dosya için XMLHttpRequest (progress event almak için)

**Zorluk:** Orta | **Öncelik:** 🟡 P1

---

### 12. 📊 CSV / Spreadsheet Viewer

**Ne yapılacak:**
- `.csv`, `.tsv` dosyalarını tablo olarak göster
- Sütunları sıralama, satır sayısı göstergesi

**Paket:** `@tanstack/react-table` (zaten projede var) + `papaparse`

**Frontend:**
- CSV içeriğini fetch et, `papaparse` ile parse et
- `@tanstack/react-table` ile tablo render
- Basit sütun sıralama

**Zorluk:** Kolay | **Öncelik:** 🟢 P2

---

### 13. 📋 Dosya Aktivite Logu

**Ne yapılacak:**
- Her dosya üzerinde: yüklendi, indirildi, paylaşıldı, yeniden adlandırıldı, taşındı, silindi
- Preview panelinde "Aktivite" tab'ı

**Backend:**
- Yeni tablo: `FileActivityLog` (`id`, `file_id`, `user_id`, `action`, `detail: json`, `created_at`)
- Her dosya mutation endpoint'ine log kaydı ekle
- `GET /api/v1/files/activity/{file_id}?limit=50`

**Frontend:**
- Preview paneline "Aktivite" tab'ı
- Aktivite öğesi: avatar + isim + eylem + tarih (time-ago format)

**Zorluk:** Orta | **Öncelik:** 🟢 P2

---

### 14. 📐 Gelişmiş Görünüm Seçenekleri

**Ne yapılacak:**
- Sıralama: isim (A-Z / Z-A), tarih, boyut, tip
- Gruplandırma: tipe göre, tarihe göre (bugün / bu hafta / bu ay / daha eski)
- Yoğunluk: compact / comfortable / spacious
- Sütun görünümü (Miller Columns — macOS Finder tarzı)

**Backend:**
- `GET /api/v1/files/list` endpoint'ine `sort_by`, `sort_order` parametreleri ekle

**Frontend:**
- Toolbar'da sıralama dropdown ve gruplandırma menüsü
- Miller columns view bileşeni (yeni view modu)
- Density seçeneği (CSS class ile gap/padding değişimi)

**Zorluk:** Orta | **Öncelik:** 🟢 P2

---

### 15. 💾 Depolama Analitikleri (Quota Dashboard)

**Ne yapılacak:**
- Kullanıcıya depolama kullanımı breakdown: image, video, audio, döküman, arşiv, diğer
- Admin'den kullanıcı bazlı quota limiti tanımlama
- 80% / 95% dolduğunda uyarı banner'ı
- Görsel quota bar (renk kodlu: yeşil → sarı → kırmızı)

**Backend:**
- `User` modeline `storage_quota_bytes: Optional[int]` ekle (null = limitsiz)
- `GET /api/v1/files/quota` endpoint'ini zenginleştir: breakdown by mime_category ekle
- Admin endpoint: `PATCH /api/v1/admin/users/{user_id}/quota`

**Frontend:**
- Sidebar alt kısmında quota progress bar
- Files sayfasında "Depolama" bölümü (donut chart — recharts, zaten projede var)
- Quota aşıldığında upload'ı engelle + uyarı

**Zorluk:** Kolay | **Öncelik:** 🟢 P2

---

### 16. 📌 Pinned Shortcuts (DB Destekli)

**Ne yapılacak:**
- Mevcut `usePinnedFolders` hook'u localStorage kullanıyor — bunu DB'ye taşı
- Pinned item'lar tüm cihazlarda senkronize olsun
- Sürükle-bırak ile yeniden sıralama

**Backend:**
- Yeni tablo: `FilePinned` (`user_id`, `file_id`, `pinned_at`, `display_order`)
- `POST/DELETE/GET /api/v1/files/pins`

**Frontend:**
- `usePinnedFolders` hook'unu API'ye bağla (localStorage fallback kaldır)
- Sidebar "Sabitlenmiş" bölümü sürükle-bırak ile yeniden sıralama

**Zorluk:** Kolay | **Öncelik:** 🟢 P2

---

## Öncelik Özeti

| Öncelik | # | Özellik |
|---------|---|---------|
| 🔴 P0 — Hemen | 1 | Paylaşım & İzinler |
| 🔴 P0 — Hemen | 2 | Yıldızlı Dosyalar |
| 🔴 P0 — Hemen | 3 | Son Görüntülenenler |
| 🔴 P0 — Hemen | 4 | Toplu İşlemler (bulk move/copy/trash) |
| 🔴 P0 — Hemen | 5 | DnD Klasör Taşıma |
| 🟡 P1 — Kısa vadeli | 6 | Gelişmiş Arama Filtreleri |
| 🟡 P1 — Kısa vadeli | 7 | Video & Audio Preview |
| 🟡 P1 — Kısa vadeli | 8 | Office Döküman Preview (Google Docs Viewer) |
| 🟡 P1 — Kısa vadeli | 9 | Markdown & Kod Preview |
| 🟡 P1 — Kısa vadeli | 10 | Klasör Rengi & Emoji |
| 🟡 P1 — Kısa vadeli | 11 | Upload Queue & Progress |
| 🟢 P2 — Orta vadeli | 12 | CSV / Spreadsheet Viewer |
| 🟢 P2 — Orta vadeli | 13 | Dosya Aktivite Logu |
| 🟢 P2 — Orta vadeli | 14 | Gelişmiş Görünüm Seçenekleri |
| 🟢 P2 — Orta vadeli | 15 | Depolama Analitikleri |
| 🟢 P2 — Orta vadeli | 16 | Pinned Shortcuts (DB Destekli) |

---

## DB Migration Özeti

```sql
-- FileRecord'a yeni alanlar
ALTER TABLE file_records ADD COLUMN is_starred BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE file_records ADD COLUMN color VARCHAR(20);
ALTER TABLE file_records ADD COLUMN icon_emoji VARCHAR(10);
ALTER TABLE file_records ADD COLUMN description TEXT;

-- Kullanıcı quota
ALTER TABLE users ADD COLUMN storage_quota_bytes BIGINT;

-- Yeni tablolar
CREATE TABLE file_shares (...);
CREATE TABLE file_access_logs (...);
CREATE TABLE file_activity_logs (...);
CREATE TABLE file_pins (...);
```

---

## Paket Gereksinimleri

**Frontend (yeni eklenecek):**
- `react-markdown` + `remark-gfm` — Markdown preview
- `shiki` — Syntax highlighting
- `papaparse` — CSV parse
- `emoji-mart` — Emoji picker (klasör ikonları için)

**Backend (yeni eklenecek):**
- Değişiklik yok — mevcut bağımlılıklar yeterli

---

*Son güncelleme: 2026-08-17*