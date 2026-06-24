<h1 align="center">
  <br />
  WorkSync
  <br />
</h1>

<p align="center">
  A premium, open-source work management system — designed for absolute clarity and team efficiency.
</p>

<p align="center">
  <a href="#"><img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" /></a>
  &nbsp;
  <a href="#"><img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white" /></a>
  &nbsp;
  <a href="#"><img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" /></a>
  &nbsp;
  <a href="#"><img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css" /></a>
  &nbsp;
  <a href="#"><img alt="License" src="https://img.shields.io/github/license/parsherr/work-management-system?style=flat-square" /></a>
</p>

<hr />

<h4 align="center">
  <a href="#-features"><strong>Features</strong></a> &nbsp;·&nbsp;
  <a href="#-tech-stack"><strong>Tech Stack</strong></a> &nbsp;·&nbsp;
  <a href="#-quick-start"><strong>Quick Start</strong></a> &nbsp;·&nbsp;
  <a href="#-architecture"><strong>Architecture</strong></a> &nbsp;·&nbsp;
  <a href="#-contributing"><strong>Contributing</strong></a>
</h4>

<hr />

> [!TIP]
> WorkSync is a perfect foundation for building your own organization's internal management tool. Fork it, extend it, and make it yours.

WorkSync is an open-source work management platform built with **Next.js 16**, **FastAPI**, and **PostgreSQL**. It provides a unified workspace for teams to manage tasks, files, calendars, and analytics — with JWT-based authentication, role-based access control, and an admin panel for user management.

---

## ✨ Features

- **JWT Authentication** — Secure login with access/refresh token rotation. Admin and member roles.
- **Admin Panel** — Create user accounts, toggle active status. Only accessible to admin users.
- **Dynamic Dashboard** — Real-time analytics and activity tracking with Recharts.
- **Kanban Pipelines** — Drag-and-drop task management with `@dnd-kit`.
- **Task Management** — Filterable, sortable task tables via TanStack Table.
- **File Explorer** — Directory navigation and file drag-and-drop.
- **Calendar** — Monthly grid view for schedules and deadlines.
- **Team Administration** — Manage team members and roles.
- **5 Themes** — Warm, Slate, Dark, Forest, Midnight — toggled from Settings.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript |
| **Backend** | FastAPI, SQLModel, Uvicorn |
| **Database** | PostgreSQL 14+ |
| **Auth** | JWT (python-jose), bcrypt (passlib) |
| **Styling** | Tailwind CSS v4, shadcn/ui, Radix UI |
| **Tables** | TanStack Table v8 |
| **Drag & Drop** | @dnd-kit |
| **Charts** | Recharts |

---

## Quick Start

### Prerequisites

- Node.js 20+ and pnpm
- Python 3.11+
- PostgreSQL 14+

---

### 1. Clone the repository

```bash
git clone https://github.com/parsherr/work-management-system.git
cd work-management-system
```

---

### 2. Database — PostgreSQL

PostgreSQL'in kurulu ve çalışıyor olması gerekiyor.

**Veritabanı ve kullanıcı oluştur:**

```bash
psql -U postgres
```

```sql
CREATE USER workos_user WITH PASSWORD 'yourpassword';
CREATE DATABASE workos OWNER workos_user;
GRANT ALL PRIVILEGES ON DATABASE workos TO workos_user;
\q
```

> Tablo şeması backend ilk çalıştığında otomatik olarak oluşturulur (`SQLModel.create_all`).

---

### 3. Backend — FastAPI

```bash
cd backend
```

**Sanal ortam oluştur ve bağımlılıkları yükle:**

```bash
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**Ortam değişkenlerini ayarla:**

```bash
cp .env.example .env
```

`.env` dosyasını düzenle:

```env
DATABASE_URL=postgresql://workos_user:yourpassword@localhost:5432/workos
SECRET_KEY=en_az_32_karakter_uzun_gizli_anahtar_buraya
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
FRONTEND_URL=http://localhost:3000
```

**Backend'i başlat:**

```bash
uvicorn app.main:app --reload --port 8000
```

Çalışıp çalışmadığını kontrol et: [http://localhost:8000/health](http://localhost:8000/health)

**İlk admin hesabını oluştur:**

Backend ilk çalıştığında tablolar oluşturulur. Ardından admin kullanıcısını seed et:

```bash
python3 -c "
from app.database import get_session, create_db_and_tables
from app.models import User
from app.security import hash_password
from sqlmodel import Session, create_engine
import os
from dotenv import load_dotenv
load_dotenv()
engine = create_engine(os.environ['DATABASE_URL'])
create_db_and_tables()
with Session(engine) as s:
    u = User(name='Admin', email='admin@workos.com', hashed_password=hash_password('admin123'), is_admin=True)
    s.add(u); s.commit()
print('Admin created: admin@workos.com / admin123')
"
```

> **Güvenlik:** Production ortamında şifreyi mutlaka değiştir.

---

### 4. Frontend — Next.js

Proje kök dizinine dön:

```bash
cd ..
```

**Bağımlılıkları yükle:**

```bash
pnpm install
```

**Ortam değişkenini ayarla:**

`.env.local` dosyası oluştur (zaten varsa düzenle):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Geliştirme sunucusunu başlat:**

```bash
pnpm dev
```

Uygulama: [http://localhost:3000](http://localhost:3000)

---

### 5. Giriş Yap

| Alan | Değer |
|------|-------|
| Email | `admin@workos.com` |
| Şifre | `admin123` |

Admin hesabıyla giriş yapınca sidebar'da **Admin Panel** butonu görünür.

---

## Architecture

```
work-management-system/
├── app/                   # Next.js App Router
│   ├── (auth)/            # Auth sayfaları (login, forgot-password)
│   ├── admin/             # Admin panel (sadece is_admin kullanıcılara açık)
│   ├── dashboard/         # Dashboard ve Kanban
│   ├── tasks/             # Task yönetimi
│   ├── files/             # Dosya gezgini
│   ├── calendar/          # Takvim
│   ├── team/              # Takım yönetimi
│   ├── settings/          # Ayarlar (tema seçimi)
│   └── profile/           # Profil düzenleme
├── backend/               # FastAPI uygulaması
│   ├── app/
│   │   ├── routers/       # auth, users, admin endpoint'leri
│   │   ├── models.py      # SQLModel tablo tanımları
│   │   ├── schemas.py     # Pydantic istek/yanıt şemaları
│   │   ├── security.py    # JWT, bcrypt
│   │   ├── deps.py        # get_current_user bağımlılığı
│   │   └── main.py        # FastAPI app, CORS, router kayıtları
│   ├── requirements.txt
│   └── .env.example
├── components/            # React bileşenleri
├── contexts/              # AuthContext
├── lib/                   # api.ts, auth.ts yardımcıları
└── middleware.ts          # Route koruması (oturum kontrolü)
```

**Auth akışı:** Login → access token (15 dk) + refresh token (7 gün) localStorage'a kaydedilir, `has_session` cookie set edilir. Next.js middleware her istekte bu cookie'yi okur; oturum yoksa `/login`'e yönlendirir.

---

## Roadmap

- [ ] Real-time collaboration with WebSockets
- [ ] Multi-tenant workspace support
- [ ] Advanced file preview (PDF, Office)
- [ ] GitHub / Slack notifications
- [ ] Custom task fields
- [ ] Gantt chart view

---

## Contributing

1. Fork this repository
2. Create a branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push to your fork: `git push origin feat/my-feature`
5. Open a pull request

---

## License

WorkSync is open-source software licensed under the [MIT License](./LICENSE).

---

<p align="center">
  Next.js 16 + FastAPI + PostgreSQL &nbsp;·&nbsp; Designed for Clarity
</p>