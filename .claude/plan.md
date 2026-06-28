# Plan: Auth RBAC & Permissions Sistemi

## Kullanıcı Kısıtlamaları
- `/team` sayfası **sadece admin** görebilir (manager değil)
- İzinler **backend'de persist** edilecek (localStorage değil)
- Custom roller yok: `admin`, `manager`, `member` sabit
- **Custom permissions** var: her rol için hangi izinlerin açık olduğu backend'den yönetilir
- `/loop` ile çalışacak

## Mimari Kararlar

### Rol Hiyerarşisi
```
admin > manager > member
```
Her rol, daha düşük rolün izinlerini varsayılan olarak içermez — izinler tamamen explicit.

### İzin Katmanları
1. **Sayfa seviyesi** — proxy.ts middleware (cookie bazlı, SSR-safe)
2. **Feature seviyesi** — React context (backend'den çekilen permission listesi)

### Backend Tasarımı
- `User` modeline `role: str = "member"` eklenir (`admin | manager | member`)
- `RolePermission` tablosu: `role → permission_key` mapping (admin panelinden CRUD yapılabilir)
- `GET /api/permissions/my` → giriş yapan kullanıcının izin listesini döner
- `GET /admin/permissions` → tüm rol-izin haritasını döner  
- `PUT /admin/permissions` → rol izinlerini günceller (sadece admin)

### Frontend Tasarımı
- `PermissionsContext` — `GET /api/permissions/my` ile çekilir, `usePermissions()` hook
- `PermissionGate` bileşeni — izin yoksa null/fallback render
- `usePermission(key)` hook — boolean döner
- Mock auth'da: `admin@workos.com → admin`, `demo@workos.app → member`

## Sayfa İzin Haritası (final)

| Sayfa | member | manager | admin |
|-------|:------:|:-------:|:-----:|
| /dashboard, /tasks, /files, /calendar, /settings, /profile | ✓ | ✓ | ✓ |
| /team | ✗ | ✗ | ✓ |
| /admin | ✗ | ✗ | ✓ |

## Feature İzin Listesi (default değerler)

| Permission Key | member | manager | admin |
|----------------|:------:|:-------:|:-----:|
| tasks:create | ✓ | ✓ | ✓ |
| tasks:edit_own | ✓ | ✓ | ✓ |
| tasks:edit_any | ✗ | ✓ | ✓ |
| tasks:delete_own | ✓ | ✓ | ✓ |
| tasks:delete_any | ✗ | ✓ | ✓ |
| tasks:assign | ✗ | ✓ | ✓ |
| files:upload | ✓ | ✓ | ✓ |
| files:delete | ✗ | ✓ | ✓ |
| team:view | ✗ | ✗ | ✓ |
| team:manage | ✗ | ✗ | ✓ |
| admin:view | ✗ | ✗ | ✓ |
| admin:manage_permissions | ✗ | ✗ | ✓ |

## Task Sırası

### Wave 1 — Backend: Model + Migration
**T1:** `backend/app/models.py` — User'a `role: str = "member"`, yeni `RolePermission` tablosu  
**T2:** `backend/app/schemas.py` — `UserResponse`'a `role` ekleme, `PermissionEntry` şeması

### Wave 2 — Backend: API Endpoints
**T3:** `backend/app/routers/permissions.py` (yeni) — `GET /permissions/my`, `GET /admin/permissions`, `PUT /admin/permissions`, seed logic  
**T4:** `backend/app/main.py` — permissions router'ı kaydet, startup'ta seed_permissions() çağır  
**T5:** `backend/app/routers/auth.py` — login response'a `role` ekle, `require_admin` dependency'sini `admin` rolü kontrol edecek şekilde güncelle

### Wave 3 — Backend: Admin Kullanıcı Yönetimi
**T6:** `backend/app/routers/admin.py` — `GET /admin/users`, `PATCH /admin/users/{id}/role` endpoint'leri

### Wave 4 — Frontend: Tip ve İzin Sabitleri
**T7:** `frontend/lib/permissions.ts` (yeni) — `Permission` union type, `DEFAULT_ROLE_PERMISSIONS` haritası, `ALL_PERMISSIONS` listesi  
**T8:** `frontend/contexts/auth-context.tsx` — `User` tipine `role` ekle, mock user'lara role ata, `is_admin` cookie yanı sıra `user_role` cookie set et

### Wave 5 — Frontend: Permissions Context + Gate
**T9:** `frontend/contexts/permissions-context.tsx` (yeni) — `PermissionsProvider`, `usePermissions()`, backend'den `GET /permissions/my` çeker (mock modda: role'e göre DEFAULT_ROLE_PERMISSIONS kullanır)  
**T10:** `frontend/components/auth/permission-gate.tsx` (yeni) — `<PermissionGate permission="..." fallback={...}>` bileşeni  
**T11:** `frontend/hooks/use-permission.ts` (yeni) — `usePermission(key: Permission): boolean`

### Wave 6 — Frontend: Proxy + Layout
**T12:** `frontend/proxy.ts` — `/team` ve `/admin` rotaları için `user_role=admin` cookie kontrolü ekle (backward compat: `is_admin=1` de çalışmaya devam etsin)  
**T13:** `frontend/app/layout.tsx` — `PermissionsProvider`'ı `AuthProvider` içine, `TaskProvider`'ın dışına wrap et

### Wave 7 — Frontend: UI Entegrasyonu
**T14:** `frontend/components/layout/app-sidebar.tsx` — Team ve Admin nav linkleri `usePermission` ile koşullu gizle  
**T15:** `frontend/app/admin/roles/page.tsx` (yeni) — Rol-izin yönetim sayfası: her rol için checkbox tablosu, `PUT /admin/permissions` API çağrısı  
**T16:** `frontend/components/layout/site-header.tsx` — Admin linki `usePermission('admin:view')` ile koşullu  
**T17:** `frontend/components/tasks/task-columns.tsx` — Silme/atama aksiyonlarını `usePermission` ile koşullu render

## Human Approval Checkpoints

1. **T1 sonrası** — Backend model değişikliği (`role` + `RolePermission` tablosu). Migration oluşturacak, mevcut kullanıcılar etkilenecek.
2. **T12 sonrası** — Proxy değişikliği. Yanlış bir şey tüm sayfaları erişilemez yapabilir.

## Success Criteria
- [ ] `member` kullanıcı `/team` açmaya çalışırsa `/dashboard`'a redirect
- [ ] `manager` kullanıcı `/team` açmaya çalışırsa `/dashboard`'a redirect  
- [ ] `admin` kullanıcı `/team` ve `/admin` erişebilir
- [ ] `/admin/roles` sayfasından izinler düzenlenebilir ve backend'e kaydedilir
- [ ] Task silme butonu `member` için görünmez
- [ ] `pnpm typecheck` hatasız geçer
- [ ] `pnpm build` hatasız geçer