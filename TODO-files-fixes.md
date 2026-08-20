# Files Sistemi — Bug Fixes & Google Drive Entegrasyonu

> Hazırlanma tarihi: 2026-08-20  
> Kapsam: Backend (FastAPI/Python) + Frontend (Next.js/TypeScript)  
> Tahmini süre: ~2 gün

---

## 🐛 BUG FIXES (Önce Bunlar)

### FIX-1 — `asyncio.get_event_loop()` → `asyncio.get_running_loop()`
**Dosya:** `backend/app/r2.py`  
**Sorun:** Python 3.10+ `get_event_loop()` deprecate edildi. Upload sırasında `_head()` fonksiyonu `asyncio.get_event_loop().run_in_executor(...)` çağırıyor.  
**Ek konum:** `backend/app/routers/v1/files.py` — upload endpoint içinde inline `asyncio.get_event_loop()` kullanımı (satır ~300).  
**Fix:**
```python
# ÖNCE
loop = asyncio.get_event_loop()
await loop.run_in_executor(None, fn)

# SONRA
loop = asyncio.get_running_loop()
await loop.run_in_executor(None, fn)
```
- [ ] `r2.py` içindeki tüm `get_event_loop()` çağrılarını `get_running_loop()` yap
- [ ] `files.py` upload endpoint içindeki inline `get_event_loop()` çağrısını da düzelt

---

### FIX-2 — R2 Client Singleton (`@lru_cache`)
**Dosya:** `backend/app/r2.py`  
**Sorun:** `get_r2_client()` her çağrıda yeni boto3 client oluşturuyor. High concurrency'de connection churn yaşanır.  
**Fix:**
```python
from functools import lru_cache

@lru_cache(maxsize=1)
def get_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=...,
        aws_access_key_id=...,
        aws_secret_access_key=...,
        region_name="auto",
    )
```
> ⚠️ `lru_cache` ile env var'lar uygulama başlarken bir kez okunur. Env değişirse restart gerekir — bu kabul edilebilir.

- [ ] `get_r2_client()` fonksiyonuna `@lru_cache(maxsize=1)` ekle

---

### FIX-3 — `search` Endpoint `is_starred` Filtresi Kırık
**Dosya:** `backend/app/routers/v1/files.py` (~satır 927)  
**Sorun:** Kod `getattr(FileRecord, "starred", None)` ile yanlış alan adı arıyor. `FileRecord`'da alan `is_starred`. `getattr` `None` döndürdüğü için starred filtresi hiç uygulanmıyor.  
**Fix:**
```python
# ÖNCE (kırık)
if is_starred is not None:
    starred_val = getattr(FileRecord, "starred", None)
    if starred_val is not None:
        stmt = stmt.where(FileRecord.starred == is_starred)

# SONRA (düzgün)
if is_starred is not None:
    stmt = stmt.where(FileRecord.is_starred == is_starred)
```
- [ ] `search_files` içindeki `is_starred` filtre bloğunu düzelt

---

### FIX-4 — Quota'da Soft-Deleted Dosyalar Sayılıyor
**Dosya:** `backend/app/routers/v1/files.py` (~satır 756)  
**Durum:** `get_quota` endpoint'i zaten `FileRecord.is_deleted == False` filter'ı uyguluyor — yani soft-deleted dosyalar sayılmıyor. Ancak upload akışında `size` bilinmediğinde head request atılıyor ve başarısız olursa `pass` ile geçiliyor. Bu durumda o dosyanın `size=None` kalıyor ve quota hesabına katılmıyor (eksik sayım).  
**Fix:** Upload tamamlandıktan sonra `size` hâlâ `None` ise fallback olarak `size=0` set etmek yerine bir warning log at ve `FileRecord` kaydını size ile güncelle.
```python
# files.py upload endpoint — size None kalırsa
if size is None:
    import logging
    logging.getLogger(__name__).warning("Could not determine file size for %s", r2_key)
    size = 0  # quota sayımı için güvenli fallback
```
- [ ] Upload endpoint'inde `size is None` durumuna `size = 0` fallback ekle ve log at

---

### FIX-5 — `_cascade_rename` SQLAlchemy `startswith` — Index Kullanımı
**Dosya:** `backend/app/routers/v1/files.py` (~satır 207)  
**Durum:** `col(FileRecord.path).startswith(old_prefix + "/")` SQL `LIKE 'prefix/%'` üretir. `path` kolonu index'li (`index=True` modelde), bu yüzden prefix LIKE sorguları B-tree index kullanır. Şu anki implementasyon fonksiyonel ama sonuçları Python'da loop ile güncelliyor (N adet UPDATE). Yüzlerce alt öğe varsa yavaş olabilir.  
**Fix:** Bulk UPDATE ile değiştir (SQLAlchemy 2.x `update()` + `synchronize_session=False`):
```python
from sqlalchemy import update as sa_update

# Tek sorguda tüm path'leri güncelle
session.exec(
    sa_update(FileRecord)
    .where(
        FileRecord.owner_id == owner_id,
        col(FileRecord.path).startswith(old_prefix + "/"),
    )
    .values(
        path=func.concat(new_prefix, func.substr(FileRecord.path, len(old_prefix) + 1)),
        parent_path=...,  # parent_path için ayrı hesap gerekebilir
        updated_at=now,
    )
)
```
> ⚠️ `parent_path` her satır için farklı hesaplanıyor (path'in son segmenti), bu yüzden SQL'de yapmak tricky. Basit fix: mevcut Python loop'u koru ama transaction içinde kalmasını garantile (zaten `session.commit()` sonunda yapılıyor — OK). Büyük tree'ler için gerçek optimizasyon gerekirse o zaman tackle et.  
**Karar:** Şimdilik mevcut implementasyonu koru, yorum ekle. Kritik değil.

- [ ] `_cascade_rename` fonksiyonuna büyük tree uyarısı ve `session.commit()` garantisi ile ilgili yorum ekle
- [ ] İleride gerekirse bulk UPDATE migration'ı aç

---

### FIX-6 — Frontend `sourceFilter` Dead Code Temizliği
**Dosya:** `frontend/components/files/file-explorer.tsx`  
**Sorun:** `sourceFilter?: "all" | "disk" | "drive"` prop'u `?source=disk` query parametresi gönderiyor ama backend `/list` endpoint'i `source` parametresi kabul etmiyor — parametre yok sayılıyor.  
**Fix seçenekleri:**
- A) Kısa vade: `sourceFilter` prop'unu kaldır, `file-client-page.tsx` ve `file-breadcrumbs.tsx`'ten de sil. Dead code temiz kalır.
- B) Uzun vade: Google Drive entegrasyonu yapıldıktan sonra bu prop anlamlı hale gelecek — o zaman backend'e `source` parametresi ekle.  
**Karar:** Google Drive entegrasyonu planlandığı için prop'u şimdilik bırak ama prop'a `// TODO: backend henüz source param desteklemiyor` yorumu ekle.

- [ ] `file-explorer.tsx` satır ~191'e `// TODO: backend /list source param henüz yok` yorumu ekle
- [ ] `isDrivePath` ve `sourceFilter` prop'larını Google Drive entegrasyonu tamamlanınca aktif et

---

## 🔗 GOOGLE DRIVE ENTEGRASYONU

### DRIVE-1 — Google API Console Kurulumu (Manuel Adımlar)
Bu adımlar kod değil, Google Cloud Console'da yapılır.

- [ ] [Google Cloud Console](https://console.cloud.google.com) → yeni proje oluştur (veya mevcut kullan)
- [ ] **APIs & Services → Enable APIs** → "Google Drive API" etkinleştir
- [ ] **APIs & Services → Enable APIs** → "Google Picker API" etkinleştir
- [ ] **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
  - Application type: "Web application"
  - Authorized JavaScript origins: `http://localhost:3000` (dev) + production URL
  - Authorized redirect URIs: gerekmiyor (token frontend'de alınıyor, Picker flow)
- [ ] **APIs & Services → Credentials → Create Credentials → API Key**
  - Bu key sadece Picker widget için (public, restrict to Picker API)
- [ ] **OAuth consent screen** yapılandır
  - Scopes: `https://www.googleapis.com/auth/drive.readonly`
  - Test users ekle (yayına almadan önce)
- [ ] Elde edilen değerleri not et:
  - `GOOGLE_OAUTH_CLIENT_ID` → backend + frontend
  - `GOOGLE_PICKER_API_KEY` → sadece frontend (public)

---

### DRIVE-2 — Backend: Bağımlılıklar
**Dosya:** `backend/requirements.txt`

- [ ] Şu satırları ekle:
```
google-auth>=2.28.0
google-auth-oauthlib>=1.2.0
google-api-python-client>=2.120.0
```
- [ ] `pip install -r requirements.txt` ile kur

---

### DRIVE-3 — Backend: `google_drive.py` Yardımcı Modülü
**Dosya:** `backend/app/google_drive.py` (yeni dosya)

- [ ] Aşağıdaki fonksiyonları implement et:

```python
"""Google Drive API helpers — import-only integration (Approach A)."""

from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2.credentials import Credentials
import io

def get_drive_service(access_token: str):
    """Build a Drive v3 service from a short-lived access token."""
    creds = Credentials(token=access_token)
    return build("drive", "v3", credentials=creds, cache_discovery=False)

async def get_drive_file_metadata(service, file_id: str) -> dict:
    """Return name, mimeType, size for a Drive file."""
    fields = "id,name,mimeType,size,exportLinks"
    return service.files().get(fileId=file_id, fields=fields,
                               supportsAllDrives=True).execute()

async def download_drive_file(service, file_id: str, mime_type: str) -> tuple[io.BytesIO, str, str, int]:
    """
    Download a Drive file as BytesIO.
    Google Workspace docs (Docs/Sheets/Slides) are exported to their
    Office equivalent; binary files are downloaded directly.
    Returns: (bytes_io, filename, resolved_mime_type, size_bytes)
    """
    EXPORT_FORMATS = {
        "application/vnd.google-apps.document": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"),
        "application/vnd.google-apps.spreadsheet": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"),
        "application/vnd.google-apps.presentation": ("application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx"),
        "application/vnd.google-apps.drawing": ("image/png", ".png"),
    }
    # ... implementation
```

---

### DRIVE-4 — Backend: `POST /api/v1/files/import-from-drive` Endpoint
**Dosya:** `backend/app/routers/v1/files.py`

- [ ] Yeni Pydantic schema ekle (`DriveImportBody`):
```python
class DriveImportBody(BaseModel):
    file_id: str           # Google Drive file ID
    access_token: str      # OAuth access token (frontend Picker'dan gelir)
    parent_path: str = ""  # Hedef klasör (opsiyonel)
    overwrite: bool = False
```

- [ ] Endpoint'i implement et:
```python
@router.post("/import-from-drive", response_model=FileRecordResponse)
async def import_from_drive(
    body: DriveImportBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileRecordResponse:
    """
    Import a file from Google Drive into R2 storage.
    The access_token must have drive.readonly scope.
    After import, no Drive dependency remains.
    """
    # 1. Build Drive service
    # 2. Get file metadata (name, mimeType, exportLinks)
    # 3. Conflict check (overwrite flag)
    # 4. Download from Drive → BytesIO (stream, not full load)
    # 5. Upload BytesIO → R2 (r2_upload_fileobj)
    # 6. Create FileRecord
    # 7. Return FileRecordResponse
```

- [ ] Google Workspace export formatlarını handle et (Docs→docx, Sheets→xlsx, Slides→pptx)
- [ ] Büyük dosyalar için streaming download implement et (BytesIO'yu chunk'larla doldur)
- [ ] `access_token` asla log'a yazılmasın

---

### DRIVE-5 — Backend: Environment Variables
**Dosya:** `backend/.env` (ve `backend/app/main.py` veya config)

- [ ] Şu env var'ları ekle:
```
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
```
> `GOOGLE_PICKER_API_KEY` backend'e gitmez — sadece frontend

---

### DRIVE-6 — Backend: Alembic Migration (Gerek Yok)
`FileRecord` modeline yeni alan **eklenmeyecek** (import-only yaklaşımı: R2'ye kopyalanıyor, Drive bağı yok). Migration gerekmez.

- [x] Migration gerekmediğini teyit et ✓

---

### DRIVE-7 — Frontend: Environment Variables
**Dosya:** `frontend/.env.local`

- [ ] Ekle:
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=your-picker-api-key
```

---

### DRIVE-8 — Frontend: Google Identity Services + Drive Picker Yükleme
**Dosya:** `frontend/app/layout.tsx` veya `frontend/components/files/file-client-page.tsx`

- [ ] `<head>`'e Google script'leri ekle (lazy load):
```html
<script src="https://apis.google.com/js/api.js" async defer />
<script src="https://accounts.google.com/gsi/client" async defer />
```
- [ ] TypeScript type definitions için `@types/google.picker` ekle:
```bash
pnpm add -D @types/google.picker
```

---

### DRIVE-9 — Frontend: `useDrivePicker` Hook
**Dosya:** `frontend/hooks/use-drive-picker.ts` (yeni dosya)

- [ ] Hook'u implement et:
```typescript
/**
 * useDrivePicker — Google Drive File Picker integration.
 * Opens the native Drive picker, returns selected file metadata + access token.
 * Uses Google Identity Services (GIS) for OAuth, Picker API for file selection.
 */
export function useDrivePicker() {
  const openPicker = useCallback(async (): Promise<DrivePickerResult | null> => {
    // 1. Load gapi + picker library (lazy)
    // 2. Request OAuth token via google.accounts.oauth2.initTokenClient
    //    scope: "https://www.googleapis.com/auth/drive.readonly"
    // 3. Build PickerBuilder with DocsView (all file types)
    // 4. Show picker
    // 5. On PICKED: return { fileId, fileName, mimeType, accessToken }
    // 6. On CANCEL: return null
  }, [])

  return { openPicker }
}

export interface DrivePickerResult {
  fileId: string
  fileName: string
  mimeType: string
  accessToken: string
}
```

---

### DRIVE-10 — Frontend: `importFromDrive` Server Action
**Dosya:** `frontend/lib/actions/files.ts`

- [ ] Yeni action ekle:
```typescript
export async function importFromDrive(
  fileId: string,
  accessToken: string,
  parentPath: string = "",
  overwrite: boolean = false
): Promise<FileItem> {
  const token = getAccessToken()
  const res = await fetch(`${API_BASE}/api/v1/files/import-from-drive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ file_id: fileId, access_token: accessToken, parent_path: parentPath, overwrite }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? "Drive import failed")
  }
  return res.json()
}
```

---

### DRIVE-11 — Frontend: "Drive'dan İçe Aktar" Butonu
**Dosya:** `frontend/components/files/file-client-page.tsx` (veya toolbar komponenti)

- [ ] Toolbar'a buton ekle (mevcut "Upload" butonunun yanına):
```tsx
<Button variant="outline" size="sm" onClick={handleDriveImport}>
  <DriveIcon className="mr-2 h-4 w-4" />
  Drive'dan İçe Aktar
</Button>
```
- [ ] `handleDriveImport` handler:
  1. `useDrivePicker().openPicker()` çağır
  2. Seçim varsa `importFromDrive(result.fileId, result.accessToken, currentPath)` çağır
  3. Loading state göster (mevcut upload queue'ya eklenebilir)
  4. Başarıda `listFiles()` refresh (mevcut pattern ile aynı)
  5. Hata durumunda `toast.error(...)` (sonner)

- [ ] `sourceFilter` ve `isDrivePath` prop'larını bu aşamada aktif et (backend artık gerçekten Drive kaynağını bilmiyor — prop'lar ileride "Drive mount" için hazır bırakılabilir, şimdilik remove veya comment)

---

### DRIVE-12 — Frontend: Google Drive Dosya İkonu (Opsiyonel)
**Dosya:** `frontend/components/files/file-explorer-row.tsx`

- [ ] Import edilen Drive dosyaları için özel bir badge veya ikon göstermek istersen `FileRecord`'a `source` alanı eklenebilir — ama import-only yaklaşımında gerek yok, normal dosya gibi görünür. **Şimdilik gerek yok.**

---

## 📋 Yapılacaklar — Öncelik Sırası

### Faz 1: Bug Fixes (Backend — ~2 saat)
1. [ ] **FIX-1** `asyncio.get_running_loop()` migration — `r2.py` + `files.py`
2. [ ] **FIX-2** `get_r2_client()` singleton — `r2.py`
3. [ ] **FIX-3** `is_starred` search fix — `files.py`
4. [ ] **FIX-4** Quota fallback `size=0` — `files.py`
5. [ ] **FIX-6** `sourceFilter` TODO yorumu — `file-explorer.tsx`

### Faz 2: Google API Console Kurulumu (~30 dk, manuel)
6. [ ] **DRIVE-1** Google Cloud Console — Drive API + Picker API + OAuth client + API key

### Faz 3: Backend Drive Entegrasyonu (~4 saat)
7. [ ] **DRIVE-2** `requirements.txt` güncelle
8. [ ] **DRIVE-3** `google_drive.py` implement et
9. [ ] **DRIVE-4** `/import-from-drive` endpoint implement et
10. [ ] **DRIVE-5** `.env` güncelle

### Faz 4: Frontend Drive Entegrasyonu (~4 saat)
11. [ ] **DRIVE-7** `frontend/.env.local` güncelle
12. [ ] **DRIVE-8** Google script'leri + `@types/google.picker`
13. [ ] **DRIVE-9** `useDrivePicker` hook implement et
14. [ ] **DRIVE-10** `importFromDrive` action implement et
15. [ ] **DRIVE-11** Toolbar butonu + handler implement et

---

## 🔧 Teknik Notlar

| Konu | Detay |
|---|---|
| **Google Workspace dosyaları** | Docs/Sheets/Slides binary değil — export gerekir. Drive API `exportLinks` field'ı doğru format URL'ini verir |
| **Büyük dosyalar** | Drive → backend streaming, backend → R2 streaming. `r2_upload_fileobj` zaten stream alıyor |
| **Token güvenliği** | Access token HTTPS üzerinden backend'e geliyor. Backend loglarında asla görünmemeli |
| **Shared Drive** | `supportsAllDrives=True` parametresi ile hem kişisel hem Shared Drive desteklenir |
| **Rate limit** | Drive API: 1000 req/100sn/user. Import işlemi genellikle 2-3 istek (metadata + download). Sorun değil |
| **Drive API türleri** | `google-api-python-client` Picker'dan gelen `file_id`'yi kabul eder |
| **Picker API key** | Bu key public — frontend JS bundle'a gömülür. Drive read scope gerektirmez, sadece picker UI için |