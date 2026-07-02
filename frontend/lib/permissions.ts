export const ALL_PERMISSIONS = [
  "tasks:view",
  "tasks:create",
  "tasks:edit_own",
  "tasks:edit_any",
  "tasks:delete_own",
  "tasks:delete_any",
  "tasks:assign",
  "analytics:view",
  "board:view",
  "board:edit",
  "calendar:view",
  "calendar:edit",
  "files:view",
  "files:upload",
  "files:delete",
  "files:rename",
  "files:create_folder",
  "team:view",
  "team:manage",
  "admin:view",
  "admin:manage_permissions",
] as const

export type Permission = (typeof ALL_PERMISSIONS)[number]

export const SYSTEM_ROLES = ["admin", "manager", "member"] as const
export type SystemRole = (typeof SYSTEM_ROLES)[number]

export const PERMISSION_LABELS: Record<Permission, string> = {
  "tasks:view": "Görevleri Görüntüle",
  "tasks:create": "Görev Oluştur",
  "tasks:edit_own": "Kendi Görevini Düzenle",
  "tasks:edit_any": "Tüm Görevleri Düzenle",
  "tasks:delete_own": "Kendi Görevini Sil",
  "tasks:delete_any": "Tüm Görevleri Sil",
  "tasks:assign": "Görev Ata",
  "analytics:view": "Analitiği Görüntüle",
  "board:view": "Panoyu Görüntüle",
  "board:edit": "Panoyu Düzenle",
  "calendar:view": "Takvimi Görüntüle",
  "calendar:edit": "Takvimi Düzenle",
  "files:view": "Dosyaları Görüntüle",
  "files:upload": "Dosya Yükle",
  "files:delete": "Dosya Sil",
  "files:rename": "Dosya Yeniden Adlandır",
  "files:create_folder": "Klasör Oluştur",
  "team:view": "Ekibi Görüntüle",
  "team:manage": "Ekibi Yönet",
  "admin:view": "Admin Panelini Görüntüle",
  "admin:manage_permissions": "İzinleri Yönet",
}

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: "Görevler",
    permissions: [
      "tasks:view",
      "tasks:create",
      "tasks:edit_own",
      "tasks:edit_any",
      "tasks:delete_own",
      "tasks:delete_any",
      "tasks:assign",
    ],
  },
  {
    label: "Pano & Takvim",
    permissions: [
      "analytics:view",
      "board:view",
      "board:edit",
      "calendar:view",
      "calendar:edit",
    ],
  },
  {
    label: "Dosyalar",
    permissions: [
      "files:view",
      "files:upload",
      "files:delete",
      "files:rename",
      "files:create_folder",
    ],
  },
  {
    label: "Ekip & Yönetim",
    permissions: [
      "team:view",
      "team:manage",
      "admin:view",
      "admin:manage_permissions",
    ],
  },
]

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [...ALL_PERMISSIONS],
  manager: [
    "tasks:view",
    "tasks:create",
    "tasks:edit_own",
    "tasks:edit_any",
    "tasks:delete_own",
    "tasks:delete_any",
    "tasks:assign",
    "analytics:view",
    "board:view",
    "board:edit",
    "calendar:view",
    "calendar:edit",
    "files:view",
    "files:upload",
    "files:delete",
    "files:rename",
    "files:create_folder",
    "team:view",
  ],
  member: [
    "tasks:view",
    "tasks:create",
    "tasks:edit_own",
    "tasks:delete_own",
    "analytics:view",
    "board:view",
    "calendar:view",
    "calendar:edit",
    "files:view",
    "files:upload",
  ],
}