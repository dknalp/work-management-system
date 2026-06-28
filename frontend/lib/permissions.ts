export type Permission =
  | "tasks:create"
  | "tasks:edit_own"
  | "tasks:edit_any"
  | "tasks:delete_own"
  | "tasks:delete_any"
  | "tasks:assign"
  | "files:upload"
  | "files:delete"
  | "team:view"
  | "team:manage"
  | "admin:view"
  | "admin:manage_permissions"

export type Role = "admin" | "manager" | "member"

export const ALL_PERMISSIONS: Permission[] = [
  "tasks:create",
  "tasks:edit_own",
  "tasks:edit_any",
  "tasks:delete_own",
  "tasks:delete_any",
  "tasks:assign",
  "files:upload",
  "files:delete",
  "team:view",
  "team:manage",
  "admin:view",
  "admin:manage_permissions",
]

export const PERMISSION_LABELS: Record<Permission, string> = {
  "tasks:create": "Görev oluştur",
  "tasks:edit_own": "Kendi görevini düzenle",
  "tasks:edit_any": "Tüm görevleri düzenle",
  "tasks:delete_own": "Kendi görevini sil",
  "tasks:delete_any": "Tüm görevleri sil",
  "tasks:assign": "Görev ata",
  "files:upload": "Dosya yükle",
  "files:delete": "Dosya sil",
  "team:view": "Ekibi görüntüle",
  "team:manage": "Ekibi yönet",
  "admin:view": "Yönetici paneli",
  "admin:manage_permissions": "İzinleri yönet",
}

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL_PERMISSIONS,
  manager: [
    "tasks:create",
    "tasks:edit_own",
    "tasks:edit_any",
    "tasks:delete_own",
    "tasks:delete_any",
    "tasks:assign",
    "files:upload",
    "files:delete",
  ],
  member: [
    "tasks:create",
    "tasks:edit_own",
    "tasks:delete_own",
    "files:upload",
  ],
}