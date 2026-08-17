# Dokploy Deployment Plan

Bu döküman projeyi Dokploy'a taşımak için gereken tüm adımları, kontrol listelerini ve
dikkat noktalarını kapsar. Sırayla ilerle — bir adımı tamamlamadan bir sonrakine geçme.

---

## Mimari Hedef

```
Internet
   │
   ├─► https://app.DOMAIN.com   →  Frontend  (Next.js  :3051)
   └─► https://api.DOMAIN.com   →  Backend   (FastAPI  :3052)
                                        │
                                        └─► PostgreSQL :5432  (Dokploy managed DB)
                                        └─► Cloudflare R2    (dosya depolama)
```

---

## Faz 0 — Ön Hazırlık (Local)

Bu fazı sunucuya dokunmadan local makinede tamamla.

### 0.1 — Mevcut Veriyi Yedekle

- [ ] Local Docker çalışıyor mu kontrol et: `docker ps | grep postgres`
- [ ] Container adını bul (örn. `work-management-system-db-1`)
- [ ] Dump al:
  ```bash
  docker exec <postgres_container> pg_dump -U postgres workos > workos_backup_$(date +%Y%m%d).sql
  ```
- [ ] Backup dosyasının boyutunu kontrol et, 0 byte değilse geçerli:
  ```bash
  ls -lh workos_backup_*.sql
  ```
- [ ] Backup'ı güvenli bir yere kopyala (cloud storage, başka disk)

> Seed data yeterliyse (gerçek kullanıcı/veri yok) bu fazı atlayabilirsin.

---

### 0.2 — Cloudflare R2 Hazırlığı

Dosya yüklemesi production'da **zorunlu olarak R2 üzerinden** çalışmalı.
Local `frontend/data/` klasörü her deploy'da sıfırlanır — oraya yüklenen dosyalar kaybolur.

- [ ] [Cloudflare Dashboard](https://dash.cloudflare.com) → R2 → Create Bucket
  - Bucket adı belirle (örn. `worksync-files`)
  - Bölge: Automatic (veya yakın bölge)
- [ ] R2 → Manage R2 API Tokens → Create Token
  - İzinler: `Object Read & Write` — sadece bu bucket için
  - Not al:
    ```
    CLOUDFLARE_ACCOUNT_ID = (Dashboard URL'den: dash.cloudflare.com/<ACCOUNT_ID>/)
    R2_ACCESS_KEY_ID      = (token oluşturulunca gösterilir)
    R2_SECRET_ACCESS_KEY  = (token oluşturulunca gösterilir — bir daha gösterilmez!)
    R2_BUCKET_NAME        = worksync-files
    ```
- [ ] R2 bucket için Public URL aç (bucket → Settings → Public Access) ya da
  custom domain bağla. `R2_PUBLIC_URL` buradan gelecek:
  ```
  R2_PUBLIC_URL = https://pub-xxxxxx.r2.dev   (ya da custom domain)
  ```

---

### 0.3 — Secret Key Üret

JWT imzalamak için güçlü bir key gerekli.

- [ ] Terminalde üret:
  ```bash
  python3 -c "import secrets; print(secrets.token_hex(32))"
  ```
- [ ] Çıktıyı kopyala, sonraki fazda `SECRET_KEY` olarak kullanacaksın.
  **Bunu hiçbir zaman Git'e commit etme.**

---

### 0.4 — Domain Kararları

- [ ] Frontend için kullanacağın domain/subdomain: `app.DOMAIN.com`
- [ ] Backend API için kullanacağın domain/subdomain: `api.DOMAIN.com`
- [ ] Bu iki değeri bir yere not al, aşağıda sık kullanacaksın.

> Dokploy kendi SSL sertifikalarını (Let's Encrypt) otomatik yönetir,
> sen sadece DNS kaydını Dokploy sunucusuna yönlendirmen yeterli.

---

## Faz 1 — Dokploy'da Veritabanı Oluştur

- [ ] Dokploy paneline giriş yap
- [ ] Sol menü → **Databases** → **Create Database** → PostgreSQL seç
- [ ] Ayarlar:
  ```
  Name     : workos-db
  Version  : 16
  User     : postgres
  Password : [güçlü bir şifre — not al]
  Database : workos
  ```
- [ ] Oluştur → servis "Running" olana kadar bekle
- [ ] Dokploy'un verdiği **Internal Connection String**'i kopyala:
  ```
  postgresql://postgres:<şifre>@<internal-host>:5432/workos
  ```
  Bu değer sadece aynı Dokploy sunucusundaki servislerden erişilebilir.
- [ ] **Eğer backup restore edeceksen:**
  - Dokploy → Database → Terminal (veya Connection tab'ından dışarı aç)
  - Backup'ı sunucuya yükle, restore et:
    ```bash
    psql <connection-string> < workos_backup_YYYYMMDD.sql
    ```
  - Restore sonrası temel tabloların var olduğunu doğrula:
    ```bash
    psql <connection-string> -c "\dt"
    ```

---

## Faz 2 — Backend Servisini Deploy Et

### 2.1 — Servisi Oluştur

- [ ] Dokploy → **Applications** → **Create Application**
- [ ] Source: GitHub repo bağla (henüz bağlamadıysan OAuth ile bağla)
- [ ] Repository seç → Branch: `main`
- [ ] **Build Configuration:**
  ```
  Build Type    : Dockerfile
  Dockerfile    : backend/Dockerfile
  Build Context : backend
  ```
- [ ] Port: `3052`

### 2.2 — Environment Variables

Dokploy → Application → Environment sekmesine gir, şunları ekle:

```env
DATABASE_URL=postgresql://postgres:<şifre>@<internal-host>:5432/workos
SECRET_KEY=<0.3'te ürettiğin 64 char hex>
FRONTEND_URL=https://app.DOMAIN.com
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Cloudflare R2 (0.2'den)
CLOUDFLARE_ACCOUNT_ID=<account_id>
R2_ACCESS_KEY_ID=<access_key>
R2_SECRET_ACCESS_KEY=<secret_key>
R2_BUCKET_NAME=worksync-files
R2_PUBLIC_URL=https://pub-xxxxxx.r2.dev
```

- [ ] Tüm değerlerin girildiğini kontrol et, boş alan kalmasın

### 2.3 — Domain

- [ ] Dokploy → Application → Domains → Add Domain
  ```
  Domain : api.DOMAIN.com
  Port   : 3052
  HTTPS  : enabled (Let's Encrypt)
  ```
- [ ] DNS paneline git (Cloudflare, Namecheap, vb.) → A kaydı ekle:
  ```
  api.DOMAIN.com → <Dokploy sunucu IP>
  ```

### 2.4 — Deploy ve Doğrulama

- [ ] **Deploy** butonuna bas
- [ ] Logs sekmesini izle — şu satırları görmelisin:
  ```
  INFO  [alembic] Running upgrade -> b8a3446c5141
  INFO  Application startup complete.
  ```
- [ ] Health check:
  ```bash
  curl https://api.DOMAIN.com/docs
  ```
  FastAPI Swagger arayüzü açılıyorsa backend çalışıyor.
- [ ] Register endpoint'ini test et:
  ```bash
  curl -X POST https://api.DOMAIN.com/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","name":"Test","password":"Test1234!"}'
  ```

---

## Faz 3 — Frontend Servisini Deploy Et

### 3.1 — Servisi Oluştur

- [ ] Dokploy → **Applications** → **Create Application**
- [ ] Aynı repo → Branch: `main`
- [ ] **Build Configuration:**
  ```
  Build Type    : Dockerfile
  Dockerfile    : frontend/Dockerfile
  Build Context : frontend
  ```
- [ ] Port: `3051`

### 3.2 — Build Arguments (KRİTİK)

`NEXT_PUBLIC_API_URL` build-time'da bundle'a işlenir. Runtime'da değiştirilemez.
Dokploy → Build Arguments (Environment değil, **Build Args** sekmesi):

```
NEXT_PUBLIC_API_URL=https://api.DOMAIN.com
```

- [ ] Bu değerin `https://` ile başladığını, trailing slash olmadığını doğrula
- [ ] Bu değerin Faz 2'de deploy ettiğin backend domain'iyle **birebir** eşleştiğini doğrula

### 3.3 — Environment Variables

```env
NEXT_PUBLIC_MOCK_AUTH=false
```

- [ ] `NEXT_PUBLIC_MOCK_AUTH` kesinlikle `false` olsun — `true` kalırsa gerçek API
  kullanılmaz, tüm auth localStorage mock'u üzerinden döner.

### 3.4 — Domain

- [ ] Dokploy → Domains → Add Domain:
  ```
  Domain : app.DOMAIN.com
  Port   : 3051
  HTTPS  : enabled
  ```
- [ ] DNS → A kaydı:
  ```
  app.DOMAIN.com → <Dokploy sunucu IP>
  ```

### 3.5 — Deploy ve Doğrulama

- [ ] **Deploy** butonuna bas — build ~3-5 dakika sürer (Next.js standalone build)
- [ ] Logs'ta `pnpm build` başarıyla tamamlandıktan sonra `node server.js` görmeli
- [ ] `https://app.DOMAIN.com` adresini tarayıcıda aç
- [ ] Login sayfası yükleniyor mu kontrol et
- [ ] Faz 2'de oluşturduğun test kullanıcısıyla giriş yap

---

## Faz 4 — Uçtan Uca Doğrulama

Tüm servisler ayakta, şimdi kritik akışları test et:

### 4.1 — Auth Akışı

- [ ] Register: yeni kullanıcı oluştur
- [ ] Login: token alındı mı (Network sekmesinde `wos_access_token` localStorage'a yazıldı mı)
- [ ] Token refresh: 15 dakika bekle ya da `wos_access_token`'ı silerek refresh test et
- [ ] Logout: token temizleniyor mu

### 4.2 — CORS Kontrolü

- [ ] Browser DevTools → Network → herhangi bir API isteği seç
- [ ] Response headers'da `Access-Control-Allow-Origin: https://app.DOMAIN.com` var mı
- [ ] Console'da CORS hatası yok mu

### 4.3 — Dosya Yükleme (R2)

- [ ] Files sayfasına git → bir dosya yükle
- [ ] Yükleme başarılı olduktan sonra dosyayı listede gör
- [ ] Dosyayı önizle/indir — URL `R2_PUBLIC_URL` domain'ini içeriyor olmalı, `localhost` değil
- [ ] Backend loglarında R2'ye yazma logu var mı kontrol et

### 4.4 — Veritabanı Kalıcılığı

- [ ] Bir task oluştur, bir team member ekle
- [ ] Dokploy → Backend → **Restart** yap
- [ ] Restart sonrası aynı veriler hâlâ duruyor mu kontrol et
- [ ] (Bu test Postgres volume'unun doğru mount edildiğini kanıtlar)

### 4.5 — Migration Güvenliği

- [ ] Backend loglarında Alembic çıktısını bul:
  - `INFO  [alembic] Running upgrade -> b8a3446c5141` → ilk deploy, migration çalıştı
  - `INFO  [alembic] No new upgrade operations to perform` → sonraki deploy'larda bu olmalı
- [ ] Hiçbir zaman `Already up to date` yerine hata görmemelisin

---

## Faz 5 — Prod Güvenlik Kontrolleri

- [ ] `SECRET_KEY` production değeri `change_this_in_production` değil
- [ ] `NEXT_PUBLIC_MOCK_AUTH` kesinlikle `false`
- [ ] Backend `FRONTEND_URL` tam domain (trailing slash yok, protokol dahil)
- [ ] R2 bucket'ı Public Access: sadece `R2_PUBLIC_URL` üzerinden okuma var,
  bucket direkt listelenemez
- [ ] Dokploy'da DB'nin external port'u kapalı ya da IP kısıtlı
  (sadece internal erişim olmalı, internete açık olmamalı)
- [ ] Bir admin kullanıcısı oluştur, default seed kullanıcıları varsa sil ya da şifre değiştir

---

## Faz 6 — Sonraki Deploy'lar için Rutin

Her kod güncellemesinde:

```
1. git push → main branch
2. Dokploy → Backend → Deploy    (Alembic otomatik çalışır, data korunur)
3. Dokploy → Frontend → Deploy   (Build args değişmediyse yeniden girmene gerek yok)
```

**Frontend build arg değişirse** (örn. API URL güncellendiyse):
- Build Arguments'ı güncelle → Deploy → tam rebuild gerekir (~3-5 dk)

**Yeni Alembic migration eklenirse:**
- `backend/alembic/versions/` altına yeni dosya commit et
- Backend deploy'da `entrypoint.sh` otomatik `alembic upgrade head` çalıştırır
- Data kaybolmaz

---

## Referans: Tüm Environment Variables

### Backend

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | ✅ | Dokploy internal Postgres connection string |
| `SECRET_KEY` | ✅ | JWT imzalama, min 32 char, rastgele |
| `FRONTEND_URL` | ✅ | CORS için frontend domain (`https://app.DOMAIN.com`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | — | Default: 15 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | — | Default: 7 |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ (prod) | R2 için |
| `R2_ACCESS_KEY_ID` | ✅ (prod) | R2 için |
| `R2_SECRET_ACCESS_KEY` | ✅ (prod) | R2 için |
| `R2_BUCKET_NAME` | ✅ (prod) | R2 için |
| `R2_PUBLIC_URL` | ✅ (prod) | R2 dosyalarının public base URL'i |

### Frontend

| Değişken | Tür | Açıklama |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | **Build Arg** | Backend URL (`https://api.DOMAIN.com`) — runtime'da değiştirilemez |
| `NEXT_PUBLIC_MOCK_AUTH` | Env | Production'da kesinlikle `false` |

---

## Olası Sorunlar ve Çözümler

| Belirti | Muhtemel Sebep | Çözüm |
|---|---|---|
| Frontend API'ye ulaşamıyor | `NEXT_PUBLIC_API_URL` yanlış/eksik | Build arg'ı düzelt, **yeniden build** gerekir |
| CORS hatası | `FRONTEND_URL` yanlış | Backend env'i düzelt, restart yeterli |
| Alembic hatası başlangıçta | `DATABASE_URL` yanlış/ulaşılamaz | Internal host doğru mu kontrol et |
| Dosyalar kayboldu | R2 yerine local disk kullanılmış | R2 env'lerini ekle, backend restart |
| Login çalışıyor ama sayfa boş | `NEXT_PUBLIC_MOCK_AUTH=true` kalmış | Env'i `false` yap, restart |
| Her restart'ta veriler siliyor | DB volume mount yanlış | Dokploy managed DB kullan, kendi postgres'ini tanımlama |
| Build 3 dakikada timeout | Dokploy build timeout düşük | Dokploy settings → build timeout artır |