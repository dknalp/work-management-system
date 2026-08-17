# Cloudflare R2 Kurulum Rehberi

Bu rehber, work-management-system projesine Cloudflare R2 nesne depolama entegrasyonunu nasıl yapacağınızı adım adım anlatır.

---

## 1. Cloudflare Hesabı ve R2 Bucket Oluşturma

### 1.1 R2'yi Etkinleştir

1. [dash.cloudflare.com](https://dash.cloudflare.com) adresine git
2. Sol menüden **R2 Object Storage** → **Get started** tıkla
3. Ödeme yöntemi ekle (ücretsiz plan: 10 GB depolama, 1 M sınıf A işlem/ay)

### 1.2 Bucket Oluştur

1. **R2 Object Storage** → **Create bucket** tıkla
2. Bucket adı gir (örn. `workos-files`) — küçük harf, tire ile ayrılmış
3. **Location** → Nearest location (otomatik) veya tercihen `WEUR` (Batı Avrupa)
4. **Create bucket** tıkla

> Bucket adını not al, `.env` dosyasına gireceksin: `R2_BUCKET_NAME=workos-files`

---

## 2. API Token Oluşturma

### 2.1 R2 API Token Üret

1. **R2 Object Storage** ana sayfasına git
2. Sağ üstte **Manage R2 API Tokens** tıkla
3. **Create API Token** tıkla
4. Ayarlar:
   - **Token name:** `workos-backend` (veya istediğin isim)
   - **Permissions:** `Object Read & Write`
   - **Specify bucket:** seçili bucket'ını seç (ya da `All buckets`)
   - **TTL:** No expiry (ya da belirli bir süre)
5. **Create API Token** tıkla

### 2.2 Credentials'ı Not Al

Token oluşturulduktan sonra ekranda bir kez gösterilir:

```
Access Key ID:     <R2_ACCESS_KEY_ID>
Secret Access Key: <R2_SECRET_ACCESS_KEY>
```

> **Önemli:** Secret Key sadece bu ekranda görünür, kaydet.

Ayrıca hesap ID'ni bul:
- Cloudflare dashboard sağ sidebar → **Account ID** (32 karakter hex)
- Ya da URL'de `dash.cloudflare.com/<ACCOUNT_ID>/...`

---

## 3. Environment Variables

### 3.1 Backend `.env` Dosyası

`backend/` klasöründe `.env` dosyası oluştur (veya güncelle):

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/workos

# JWT
SECRET_KEY=en_az_32_karakter_uzun_gizli_anahtar_buraya
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
FRONTEND_URL=http://localhost:3051

# Cloudflare R2
R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_BUCKET_NAME=workos-files
R2_PUBLIC_URL=
```

> `R2_PUBLIC_URL` şimdilik boş bırak (ileride custom domain eklenebilir).

### 3.2 Docker ile Çalıştırıyorsan

Proje kökünde `.env` dosyası oluştur (docker-compose bu dosyayı otomatik okur):

```env
SECRET_KEY=en_az_32_karakter_uzun_gizli_anahtar_buraya
R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_BUCKET_NAME=workos-files
R2_PUBLIC_URL=
```

---

## 4. Python Bağımlılıklarını Kur

```bash
cd backend
source .venv/bin/activate   # ya da: python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

`boto3>=1.34.0` artık `requirements.txt`'te mevcut, otomatik kurulur.

---

## 5. Veritabanı Migration

`FileRecord` tablosunu veritabanına ekle:

```bash
cd backend
source .venv/bin/activate

# Migration dosyasını oluştur
alembic revision --autogenerate -m "add file_records table"

# Migration'ı uygula
alembic upgrade head
```

Başarılı çıktı:
```
INFO  [alembic.runtime.migration] Running upgrade ... -> ..., add file_records table
```

> Alternatif: `SQLModel.metadata.create_all(engine)` startup'ta zaten çalışıyor,
> tabloyu otomatik oluşturur. Ancak Alembic'i kullanmak production'da tercih edilir.

---

## 6. Bağlantıyı Test Et

Backend'i başlatmadan önce bağlantıyı test edebilirsin:

```python
# test_r2.py — backend/ klasöründe çalıştır
import os
from dotenv import load_dotenv
load_dotenv()

import boto3
from botocore.config import Config

client = boto3.client(
    "s3",
    endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    config=Config(signature_version="s3v4"),
    region_name="auto",
)

# Bucket'a test dosyası yükle
client.put_object(
    Bucket=os.environ["R2_BUCKET_NAME"],
    Key="test/hello.txt",
    Body=b"R2 baglantisi calisiyor!",
    ContentType="text/plain",
)

# Presigned URL üret
url = client.generate_presigned_url(
    "get_object",
    Params={"Bucket": os.environ["R2_BUCKET_NAME"], "Key": "test/hello.txt"},
    ExpiresIn=60,
)

print("Baglanti basarili!")
print("Presigned URL:", url)

# Temizle
client.delete_object(Bucket=os.environ["R2_BUCKET_NAME"], Key="test/hello.txt")
print("Test dosyasi silindi.")
```

```bash
cd backend
source .venv/bin/activate
python test_r2.py
```

---

## 7. Backend'i Başlat

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 3052
```

Başarılı log:
```
INFO:     Started server process
INFO:     Application startup complete.
```

---

## 8. Uçtan Uca Test

Backend çalışırken (`localhost:3052`) aşağıdaki endpoint'leri test edebilirsin:

### Quota Kontrolü
```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  http://localhost:3052/api/v1/files/quota
```

Beklenen yanıt:
```json
{"used_bytes": 0, "file_count": 0}
```

### Dosya Yükleme
```bash
curl -X POST \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "file=@/path/to/test.png" \
  -F "path=" \
  http://localhost:3052/api/v1/files/upload
```

### Dosya Listeleme
```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" \
  "http://localhost:3052/api/v1/files/list?path="
```

---

## 9. (İsteğe Bağlı) Public Domain Bağlama

Bucket'a public URL eklemek için:

1. **R2 bucket** → **Settings** → **Public access** → **Allow access**
2. Custom domain eklemek için: **Custom Domains** → **Connect Domain**
   - Örn: `files.yourdomain.com` (domain Cloudflare'de olmalı)
3. `.env`'de güncelle:
   ```env
   R2_PUBLIC_URL=https://files.yourdomain.com
   ```

> Public URL eklendiğinde preview/download için presigned URL yerine
> doğrudan public link kullanılabilir. Şu anki implementasyon presigned URL
> kullandığından bu adım isteğe bağlıdır.

---

## 10. CORS Ayarı (Gerekirse)

Eğer tarayıcıdan doğrudan R2'ye istek yapılacaksa (şu an yapılmıyor, backend proxy kullanılıyor), bucket CORS ayarı gerekir. Şu anki mimaride browser → backend → R2 akışı olduğu için bu adım gerekmez.

Gelecekte ihtiyaç olursa Cloudflare R2 dashboard → bucket → **Settings** → **CORS Policy**:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3051", "https://yourdomain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## Özet Checklist

- [ ] Cloudflare hesabı oluşturuldu
- [ ] R2 bucket oluşturuldu (`R2_BUCKET_NAME` not edildi)
- [ ] API Token oluşturuldu (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` not edildi)
- [ ] `R2_ACCOUNT_ID` not edildi (Cloudflare dashboard → Account ID)
- [ ] `backend/.env` dosyası dolduruldu
- [ ] `pip install -r requirements.txt` çalıştırıldı
- [ ] `alembic upgrade head` ile `file_records` tablosu oluşturuldu
- [ ] `test_r2.py` ile bağlantı doğrulandı
- [ ] Backend başlatıldı, `/api/v1/files/quota` endpoint'i yanıt verdi
- [ ] Frontend'de `/files` sayfası açıldı, dosya yüklendi