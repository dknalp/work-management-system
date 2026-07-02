"use client"

import Link from "next/link"
import { useState } from "react"
import { BriefcaseIcon, BookOpenIcon, ChevronRightIcon, CopyIcon, CheckIcon, ExternalLinkIcon } from "lucide-react"
import { EndpointCard } from "@/components/docs/endpoint-card"
import { CodeBlock } from "@/components/docs/code-block"
import { cn } from "@/lib/utils"

const BASE = "https://your-api.example.com"

const NAV_SECTIONS = [
  { id: "getting-started", label: "Başlangıç" },
  { id: "authentication", label: "Authentication" },
  { id: "me", label: "Me" },
  { id: "tasks", label: "Tasks" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "analytics", label: "Analytics" },
  { id: "files", label: "Files" },
  { id: "messages", label: "Messages" },
  { id: "webhooks", label: "Webhooks" },
  { id: "webhook-events", label: "Webhook Events" },
  { id: "examples", label: "Örnekler" },
]

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-4 mt-10 flex items-center gap-2 text-xl font-semibold scroll-mt-24">
      {children}
    </h2>
  )
}

function SubHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="mb-3 mt-6 text-base font-semibold scroll-mt-24">
      {children}
    </h3>
  )
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[13px]">{children}</code>
  )
}

export default function DocsPage() {
  const [active, setActive] = useState("getting-started")

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border/50 bg-card lg:flex">
        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-4">
          <div className="flex size-6 items-center justify-center rounded bg-primary text-primary-foreground">
            <BriefcaseIcon className="size-3.5" />
          </div>
          <span className="text-sm font-semibold">WorkSync API</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={() => setActive(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                active === s.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <ChevronRightIcon className="size-3 shrink-0 opacity-50" />
              {s.label}
            </a>
          ))}
        </nav>
        <div className="border-t border-border/50 p-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLinkIcon className="size-3" /> Uygulamaya Dön
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-sm px-6 py-3 flex items-center gap-3">
          <BookOpenIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">API Dokümantasyonu</span>
          <span className="ml-auto rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
            v1
          </span>
        </header>

        <div className="mx-auto max-w-4xl px-6 pb-24 pt-8">
          {/* Hero */}
          <div className="mb-10 rounded-2xl border border-border/40 bg-gradient-to-br from-primary/5 to-transparent p-8">
            <h1 className="text-3xl font-bold tracking-tight">WorkSync API</h1>
            <p className="mt-2 text-muted-foreground">
              Gerçek kullanıcının yapabildiği her şeyi botlar da bu API aracılığıyla yapabilir —
              görev yönetimi, ekip okuma, dosya işlemleri, analytics ve webhook entegrasyonu.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border/50 bg-muted/50 px-3 py-1">REST JSON</span>
              <span className="rounded-full border border-border/50 bg-muted/50 px-3 py-1">Bearer Token Auth</span>
              <span className="rounded-full border border-border/50 bg-muted/50 px-3 py-1">Webhook Support</span>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Link
                href="/admin?tab=bots"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Bot Hesabı Oluştur →
              </Link>
              <span className="text-xs text-muted-foreground">Admin yetkisi gerektirir</span>
            </div>
          </div>

          {/* Getting Started */}
          <SectionHeading id="getting-started">Başlangıç</SectionHeading>
          <p className="text-sm text-muted-foreground mb-4">
            WorkSync API&#39;yi kullanmak için önce admin panelinden bir bot hesabı oluşturmanız gerekir.
            Bot hesapları sadece admin kullanıcılar tarafından açılabilir.
          </p>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Admin paneline gidin ve <strong className="text-foreground">Botlar</strong> sekmesini açın: <InlineCode>/admin?tab=bots</InlineCode></li>
            <li><strong className="text-foreground">Yeni Bot</strong> butonuna tıklayın</li>
            <li>Bot adı ve açıklaması girin, oluşturun</li>
            <li>Gösterilen API key&#39;i kopyalayın — <strong className="text-red-400">bir daha gösterilmeyecektir</strong></li>
            <li>Key&#39;i <InlineCode>Authorization: Bearer &lt;key&gt;</InlineCode> header&#39;ı ile kullanın</li>
          </ol>

          {/* Authentication */}
          <SectionHeading id="authentication">Authentication</SectionHeading>
          <p className="text-sm text-muted-foreground mb-4">
            Tüm API endpoint&#39;leri <InlineCode>Authorization</InlineCode> header&#39;ı gerektirir.
            Hem bot API key&#39;leri hem de kullanıcı JWT token&#39;ları kabul edilir.
          </p>

          <div className="space-y-3 mb-4">
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Bot API Key</p>
              <p className="text-sm text-muted-foreground mb-2">
                Format: <InlineCode>{"wms_live_<32 hex chars>"}</InlineCode>
              </p>
              <CodeBlock language="bash" code={`Authorization: Bearer wms_live_a3f8c2d1e4b7f9a0c2d5e8f1a4b7c9d2`} />
            </div>
            <div className="rounded-lg border border-border/40 bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">JWT (Kullanıcı)</p>
              <p className="text-sm text-muted-foreground mb-2">Login sonrası alınan access token:</p>
              <CodeBlock language="bash" code={`Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`} />
            </div>
          </div>

          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300 mb-4">
            <strong>Güvenlik Notu:</strong> API key&#39;lerinizi asla kaynak kodunuza ya da public repo&#39;larınıza eklemeyin.
            Ortam değişkeni (<InlineCode>WMS_API_KEY</InlineCode>) kullanın.
          </div>

          {/* Me */}
          <SectionHeading id="me">Me</SectionHeading>
          <p className="text-sm text-muted-foreground mb-4">Token sahibinin kimlik bilgileri.</p>
          <div className="space-y-2">
            <EndpointCard
              method="GET"
              path="/api/v1/me"
              description="Mevcut token sahibinin bilgilerini döner (bot veya kullanıcı)"
              responseExample={`{
  "type": "bot",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "CI/CD Bot",
  "description": "Deploy pipeline botu",
  "key_prefix": "wms_live_a3f8",
  "is_active": true,
  "created_at": "2026-07-01T10:00:00Z",
  "last_used_at": "2026-07-01T12:30:00Z"
}`}
              codes={{
                curl: `curl -X GET ${BASE}/api/v1/me \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `import httpx

resp = httpx.get(
    "${BASE}/api/v1/me",
    headers={"Authorization": f"Bearer {api_key}"},
)
print(resp.json())`,
                javascript: `const resp = await fetch("${BASE}/api/v1/me", {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
});
const me = await resp.json();
console.log(me);`,
              }}
            />
          </div>

          {/* Tasks */}
          <SectionHeading id="tasks">Tasks</SectionHeading>
          <p className="text-sm text-muted-foreground mb-4">
            Görev oluşturma, listeleme, güncelleme ve silme işlemleri. Webhook&#39;lar task.created,
            task.updated, task.deleted event&#39;lerini tetikler.
          </p>
          <div className="space-y-2">
            <EndpointCard
              method="GET"
              path="/api/v1/tasks"
              description="Görev listesi"
              queryParams={[
                { name: "status", type: "string", description: "Filtre: todo | in-progress | done | backlog" },
                { name: "priority", type: "string", description: "Filtre: low | medium | high" },
                { name: "assignee", type: "string", description: "Atanan kişi adına göre filtrele" },
                { name: "limit", type: "integer", description: "Maksimum sonuç sayısı (varsayılan: 100, max: 500)" },
                { name: "offset", type: "integer", description: "Sayfalama için offset (varsayılan: 0)" },
              ]}
              responseExample={`[
  {
    "id": "TASK-A1B2C3D4",
    "title": "API entegrasyonu yaz",
    "status": "in-progress",
    "priority": "high",
    "assignee": "Ahmet Yılmaz",
    "due_date": "2026-07-15",
    "tags": ["backend", "api"],
    "description": "WorkSync bot entegrasyonu",
    "created_at": "2026-07-01",
    "updated_at": "2026-07-01T12:00:00Z",
    "completed_at": null
  }
]`}
              codes={{
                curl: `curl "${BASE}/api/v1/tasks?status=in-progress&limit=20" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `import httpx

tasks = httpx.get(
    "${BASE}/api/v1/tasks",
    params={"status": "in-progress", "limit": 20},
    headers={"Authorization": f"Bearer {api_key}"},
).json()`,
                javascript: `const params = new URLSearchParams({ status: "in-progress", limit: "20" });
const resp = await fetch(\`${BASE}/api/v1/tasks?\${params}\`, {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
});
const tasks = await resp.json();`,
              }}
            />
            <EndpointCard
              method="POST"
              path="/api/v1/tasks"
              description="Yeni görev oluştur"
              bodyParams={[
                { name: "title", type: "string", required: true, description: "Görev başlığı" },
                { name: "status", type: "string", required: true, description: "todo | in-progress | done | backlog" },
                { name: "priority", type: "string", required: true, description: "low | medium | high" },
                { name: "assignee", type: "string", description: "Atanan kişi adı" },
                { name: "due_date", type: "string", description: "YYYY-MM-DD formatında bitiş tarihi" },
                { name: "tags", type: "string[]", description: "Etiket listesi" },
                { name: "description", type: "string", description: "Görev açıklaması" },
              ]}
              codes={{
                curl: `curl -X POST ${BASE}/api/v1/tasks \\
  -H "Authorization: Bearer $WMS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Deploy v2","status":"todo","priority":"high"}'`,
                python: `import httpx

task = httpx.post(
    "${BASE}/api/v1/tasks",
    json={
        "title": "Deploy v2",
        "status": "todo",
        "priority": "high",
        "due_date": "2026-07-20",
        "tags": ["deploy"],
    },
    headers={"Authorization": f"Bearer {api_key}"},
).json()
print(task["id"])`,
                javascript: `const task = await fetch("${BASE}/api/v1/tasks", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Deploy v2",
    status: "todo",
    priority: "high",
  }),
}).then((r) => r.json());`,
              }}
            />
            <EndpointCard
              method="GET"
              path="/api/v1/tasks/{task_id}"
              description="Tekil görev detayı"
              codes={{
                curl: `curl "${BASE}/api/v1/tasks/TASK-A1B2C3D4" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `task = httpx.get(
    "${BASE}/api/v1/tasks/TASK-A1B2C3D4",
    headers={"Authorization": f"Bearer {api_key}"},
).json()`,
                javascript: `const task = await fetch("${BASE}/api/v1/tasks/TASK-A1B2C3D4", {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
}).then((r) => r.json());`,
              }}
            />
            <EndpointCard
              method="PATCH"
              path="/api/v1/tasks/{task_id}"
              description="Görevi kısmi güncelle (sadece gönderilen alanlar değişir)"
              bodyParams={[
                { name: "title", type: "string", description: "Yeni başlık" },
                { name: "status", type: "string", description: "Yeni durum" },
                { name: "priority", type: "string", description: "Yeni öncelik" },
                { name: "assignee", type: "string", description: "Yeni atanan" },
                { name: "due_date", type: "string", description: "Yeni bitiş tarihi" },
              ]}
              codes={{
                curl: `curl -X PATCH "${BASE}/api/v1/tasks/TASK-A1B2C3D4" \\
  -H "Authorization: Bearer $WMS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"done"}'`,
                python: `task = httpx.patch(
    "${BASE}/api/v1/tasks/TASK-A1B2C3D4",
    json={"status": "done"},
    headers={"Authorization": f"Bearer {api_key}"},
).json()`,
                javascript: `const task = await fetch("${BASE}/api/v1/tasks/TASK-A1B2C3D4", {
  method: "PATCH",
  headers: {
    Authorization: \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ status: "done" }),
}).then((r) => r.json());`,
              }}
            />
            <EndpointCard
              method="DELETE"
              path="/api/v1/tasks/{task_id}"
              description="Görevi sil (204 No Content döner)"
              codes={{
                curl: `curl -X DELETE "${BASE}/api/v1/tasks/TASK-A1B2C3D4" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `httpx.delete(
    "${BASE}/api/v1/tasks/TASK-A1B2C3D4",
    headers={"Authorization": f"Bearer {api_key}"},
)`,
                javascript: `await fetch("${BASE}/api/v1/tasks/TASK-A1B2C3D4", {
  method: "DELETE",
  headers: { Authorization: \`Bearer \${API_KEY}\` },
});`,
              }}
            />
          </div>

          {/* Team */}
          <SectionHeading id="team">Team</SectionHeading>
          <p className="text-sm text-muted-foreground mb-4">Ekip üyelerini okuma (salt okunur).</p>
          <div className="space-y-2">
            <EndpointCard
              method="GET"
              path="/api/v1/team/members"
              description="Tüm ekip üyelerini listele"
              responseExample={`[
  {
    "id": "member-001",
    "name": "Ahmet Yılmaz",
    "email": "ahmet@example.com",
    "role": "Backend Developer",
    "status": "active",
    "avatar": null,
    "joined_at": "2026-01-15"
  }
]`}
              codes={{
                curl: `curl "${BASE}/api/v1/team/members" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `members = httpx.get(
    "${BASE}/api/v1/team/members",
    headers={"Authorization": f"Bearer {api_key}"},
).json()`,
                javascript: `const members = await fetch("${BASE}/api/v1/team/members", {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
}).then((r) => r.json());`,
              }}
            />
            <EndpointCard
              method="GET"
              path="/api/v1/team/members/{member_id}"
              description="Tekil ekip üyesi detayı"
              codes={{
                curl: `curl "${BASE}/api/v1/team/members/member-001" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `member = httpx.get(
    "${BASE}/api/v1/team/members/member-001",
    headers={"Authorization": f"Bearer {api_key}"},
).json()`,
                javascript: `const member = await fetch("${BASE}/api/v1/team/members/member-001", {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
}).then((r) => r.json());`,
              }}
            />
          </div>

          {/* Activity */}
          <SectionHeading id="activity">Activity</SectionHeading>
          <p className="text-sm text-muted-foreground mb-4">Aktivite günlüğü okuma ve botun kendi adına log girişi oluşturması.</p>
          <div className="space-y-2">
            <EndpointCard
              method="GET"
              path="/api/v1/activity"
              description="Aktivite günlüğü listesi"
              queryParams={[
                { name: "limit", type: "integer", description: "Max sonuç (varsayılan: 100, max: 500)" },
                { name: "offset", type: "integer", description: "Sayfalama için offset" },
              ]}
              codes={{
                curl: `curl "${BASE}/api/v1/activity?limit=50" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `logs = httpx.get(
    "${BASE}/api/v1/activity",
    params={"limit": 50},
    headers={"Authorization": f"Bearer {api_key}"},
).json()`,
                javascript: `const logs = await fetch("${BASE}/api/v1/activity?limit=50", {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
}).then((r) => r.json());`,
              }}
            />
            <EndpointCard
              method="POST"
              path="/api/v1/activity"
              description="Bot adına yeni aktivite log girişi oluştur"
              bodyParams={[
                { name: "type", type: "string", required: true, description: "Aktivite tipi (örn: deploy, sync, alert)" },
                { name: "detail", type: "string", description: "Açıklama metni" },
                { name: "task_id", type: "string", description: "İlişkili görev ID'si" },
                { name: "task_title", type: "string", description: "İlişkili görev başlığı" },
              ]}
              codes={{
                curl: `curl -X POST ${BASE}/api/v1/activity \\
  -H "Authorization: Bearer $WMS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"deploy","detail":"v2.1.0 production deploy başarılı"}'`,
                python: `log = httpx.post(
    "${BASE}/api/v1/activity",
    json={"type": "deploy", "detail": "v2.1.0 başarılı"},
    headers={"Authorization": f"Bearer {api_key}"},
).json()`,
                javascript: `const log = await fetch("${BASE}/api/v1/activity", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ type: "deploy", detail: "v2.1.0 başarılı" }),
}).then((r) => r.json());`,
              }}
            />
          </div>

          {/* Analytics */}
          <SectionHeading id="analytics">Analytics</SectionHeading>
          <div className="space-y-2">
            <EndpointCard
              method="GET"
              path="/api/v1/analytics/summary"
              description="Görev istatistikleri özeti"
              responseExample={`{
  "total": 42,
  "todo": 12,
  "in_progress": 8,
  "done": 20,
  "overdue": 2,
  "completion_rate": 47.6
}`}
              codes={{
                curl: `curl "${BASE}/api/v1/analytics/summary" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `stats = httpx.get(
    "${BASE}/api/v1/analytics/summary",
    headers={"Authorization": f"Bearer {api_key}"},
).json()
print(f"Tamamlanma oranı: {stats['completion_rate']}%")`,
                javascript: `const stats = await fetch("${BASE}/api/v1/analytics/summary", {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
}).then((r) => r.json());
console.log(\`Tamamlanma: \${stats.completion_rate}%\`);`,
              }}
            />
            <EndpointCard
              method="GET"
              path="/api/v1/analytics/tasks-by-status"
              description="Status'a göre görev dağılımı"
              codes={{
                curl: `curl "${BASE}/api/v1/analytics/tasks-by-status" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `dist = httpx.get(
    "${BASE}/api/v1/analytics/tasks-by-status",
    headers={"Authorization": f"Bearer {api_key}"},
).json()`,
                javascript: `const dist = await fetch("${BASE}/api/v1/analytics/tasks-by-status", {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
}).then((r) => r.json());`,
              }}
            />
            <EndpointCard
              method="GET"
              path="/api/v1/analytics/tasks-by-priority"
              description="Önceliğe göre görev dağılımı"
              codes={{
                curl: `curl "${BASE}/api/v1/analytics/tasks-by-priority" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `dist = httpx.get(
    "${BASE}/api/v1/analytics/tasks-by-priority",
    headers={"Authorization": f"Bearer {api_key}"},
).json()`,
                javascript: `const dist = await fetch("${BASE}/api/v1/analytics/tasks-by-priority", {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
}).then((r) => r.json());`,
              }}
            />
          </div>

          {/* Files */}
          <SectionHeading id="files">Files</SectionHeading>
          <p className="text-sm text-muted-foreground mb-4">Dosya listeleme, yükleme, indirme ve silme. Dosya yükleme <InlineCode>file.uploaded</InlineCode> webhook&#39;unu tetikler.</p>
          <div className="space-y-2">
            <EndpointCard
              method="GET"
              path="/api/v1/files"
              description="Dizin içeriğini listele"
              queryParams={[
                { name: "path", type: "string", description: "Dizin yolu (boş = kök dizin)" },
              ]}
              responseExample={`[
  { "name": "report.pdf", "path": "reports/report.pdf", "type": "file", "size": 204800, "modified": 1751385600 },
  { "name": "images", "path": "images", "type": "directory", "size": null, "modified": 1751299200 }
]`}
              codes={{
                curl: `curl "${BASE}/api/v1/files?path=reports" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `files = httpx.get(
    "${BASE}/api/v1/files",
    params={"path": "reports"},
    headers={"Authorization": f"Bearer {api_key}"},
).json()`,
                javascript: `const files = await fetch("${BASE}/api/v1/files?path=reports", {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
}).then((r) => r.json());`,
              }}
            />
            <EndpointCard
              method="POST"
              path="/api/v1/files/upload"
              description="Dosya yükle (multipart/form-data)"
              queryParams={[
                { name: "path", type: "string", description: "Hedef dizin yolu" },
              ]}
              notes="Content-Type: multipart/form-data kullanın. file alanına dosyayı ekleyin."
              codes={{
                curl: `curl -X POST "${BASE}/api/v1/files/upload?path=reports" \\
  -H "Authorization: Bearer $WMS_API_KEY" \\
  -F "file=@./report.pdf"`,
                python: `with open("report.pdf", "rb") as f:
    result = httpx.post(
        "${BASE}/api/v1/files/upload",
        params={"path": "reports"},
        files={"file": ("report.pdf", f, "application/pdf")},
        headers={"Authorization": f"Bearer {api_key}"},
    ).json()
print(result["path"])`,
                javascript: `const form = new FormData();
form.append("file", fileBlob, "report.pdf");
const result = await fetch("${BASE}/api/v1/files/upload?path=reports", {
  method: "POST",
  headers: { Authorization: \`Bearer \${API_KEY}\` },
  body: form,
}).then((r) => r.json());`,
              }}
            />
            <EndpointCard
              method="GET"
              path="/api/v1/files/download"
              description="Dosya indir"
              queryParams={[
                { name: "path", type: "string", required: true, description: "Dosya yolu" },
              ]}
              codes={{
                curl: `curl "${BASE}/api/v1/files/download?path=reports/report.pdf" \\
  -H "Authorization: Bearer $WMS_API_KEY" \\
  -o report.pdf`,
                python: `with httpx.stream("GET", "${BASE}/api/v1/files/download",
    params={"path": "reports/report.pdf"},
    headers={"Authorization": f"Bearer {api_key}"},
) as r:
    with open("report.pdf", "wb") as f:
        for chunk in r.iter_bytes():
            f.write(chunk)`,
                javascript: `const blob = await fetch("${BASE}/api/v1/files/download?path=reports/report.pdf", {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
}).then((r) => r.blob());`,
              }}
            />
            <EndpointCard
              method="DELETE"
              path="/api/v1/files"
              description="Dosya veya dizin sil (204 No Content)"
              queryParams={[
                { name: "path", type: "string", required: true, description: "Silinecek dosya/dizin yolu" },
              ]}
              codes={{
                curl: `curl -X DELETE "${BASE}/api/v1/files?path=reports/old-report.pdf" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `httpx.delete(
    "${BASE}/api/v1/files",
    params={"path": "reports/old-report.pdf"},
    headers={"Authorization": f"Bearer {api_key}"},
)`,
                javascript: `await fetch("${BASE}/api/v1/files?path=reports/old-report.pdf", {
  method: "DELETE",
  headers: { Authorization: \`Bearer \${API_KEY}\` },
});`,
              }}
            />
          </div>

          {/* Messages */}
          <SectionHeading id="messages">Messages</SectionHeading>
          <p className="text-sm text-muted-foreground mb-4">
            Gerçek zamanlı DM (direct message) sistemi. Kullanıcılar ve botlar arasında mesaj gönderme/alma.
            REST endpoint&apos;leri HTTP ile çalışır; <InlineCode>ws://</InlineCode> endpoint&apos;i WebSocket üzerinden gerçek zamanlı mesaj alır.
          </p>
          <div className="space-y-2">
            <EndpointCard
              method="GET"
              path="/api/v1/messages/contacts"
              description="Tüm aktif kullanıcılar ve botları listele (konuşma başlatmak için)"
              responseExample={`[
  { "id": "550e8400-...", "name": "Ahmet Yılmaz", "type": "user", "is_active": true },
  { "id": "661f9511-...", "name": "Deploy Bot",   "type": "bot",  "is_active": true }
]`}
              codes={{
                curl: `curl "${BASE}/api/v1/messages/contacts" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `contacts = httpx.get(
    "${BASE}/api/v1/messages/contacts",
    headers={"Authorization": f"Bearer {api_key}"},
).json()`,
                javascript: `const contacts = await fetch("${BASE}/api/v1/messages/contacts", {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
}).then((r) => r.json());`,
              }}
            />
            <EndpointCard
              method="GET"
              path="/api/v1/messages/{room_id}"
              description="Oda mesaj geçmişi (room_id = sorted([id_a, id_b]).join('_'))"
              queryParams={[
                { name: "limit", type: "integer", description: "Maksimum mesaj sayısı (varsayılan: 50, max: 200)" },
                { name: "before", type: "string (uuid)", description: "Bu mesajdan önceki mesajlar (sayfalama)" },
              ]}
              responseExample={`[
  {
    "id": "7f3a1b2c-...",
    "room_id": "550e8400-..._661f9511-...",
    "sender_id": "550e8400-...",
    "sender_name": "Ahmet Yılmaz",
    "sender_type": "user",
    "text": "Merhaba!",
    "created_at": "2026-07-01T14:30:00Z"
  }
]`}
              codes={{
                curl: `# room_id = sorted([your_id, other_id]).join("_")
ROOM_ID="550e8400-e29b-41d4-a716-446655440000_661f9511-f39c-52e5-b827-557766551111"
curl "${BASE}/api/v1/messages/$ROOM_ID?limit=50" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `import sorted as _  # Python'da: "_".join(sorted([id_a, id_b]))
room_id = "_".join(sorted([my_id, other_id]))

msgs = httpx.get(
    f"${BASE}/api/v1/messages/{room_id}",
    params={"limit": 50},
    headers={"Authorization": f"Bearer {api_key}"},
).json()`,
                javascript: `const roomId = [myId, otherId].sort().join("_");
const msgs = await fetch(\`${BASE}/api/v1/messages/\${roomId}?limit=50\`, {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
}).then((r) => r.json());`,
              }}
            />
            <EndpointCard
              method="POST"
              path="/api/v1/messages/{room_id}"
              description="HTTP üzerinden mesaj gönder (WebSocket alternatifi)"
              bodyParams={[
                { name: "text", type: "string", required: true, description: "Mesaj metni (max 4000 karakter)" },
              ]}
              codes={{
                curl: `ROOM_ID="550e8400-..._661f9511-..."
curl -X POST "${BASE}/api/v1/messages/$ROOM_ID" \\
  -H "Authorization: Bearer $WMS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Merhaba!"}'`,
                python: `room_id = "_".join(sorted([my_id, other_id]))
msg = httpx.post(
    f"${BASE}/api/v1/messages/{room_id}",
    json={"text": "Merhaba!"},
    headers={"Authorization": f"Bearer {api_key}"},
).json()
print(msg["id"])`,
                javascript: `const roomId = [myId, otherId].sort().join("_");
const msg = await fetch(\`${BASE}/api/v1/messages/\${roomId}\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ text: "Merhaba!" }),
}).then((r) => r.json());`,
              }}
            />
          </div>

          <div className="mt-4 rounded-xl border border-border/40 bg-card p-4">
            <p className="mb-2 text-sm font-medium">WebSocket Bağlantısı</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Gerçek zamanlı mesaj almak için WebSocket kullanın. Token query param olarak verilir.
              Bağlantı kurulunca sunucu <InlineCode>{`{"type":"history","data":[...]}`}</InlineCode> gönderir,
              ardından her yeni mesaj için <InlineCode>{`{"type":"message","data":{...}}`}</InlineCode> gelir.
            </p>
            <CodeBlock language="python" code={`import asyncio, json, websockets

async def chat():
    room_id = "_".join(sorted([my_id, other_id]))
    url = f"ws://localhost:8000/api/v1/ws/chat/{room_id}?token={api_key}"

    async with websockets.connect(url) as ws:
        # İlk mesaj: geçmiş
        first = json.loads(await ws.recv())
        if first["type"] == "history":
            for m in first["data"]:
                print(f"[{m['sender_name']}] {m['text']}")

        # Mesaj gönder
        await ws.send(json.dumps({"text": "WebSocket üzerinden merhaba!"}))

        # Yeni mesajları dinle
        async for raw in ws:
            msg = json.loads(raw)
            if msg["type"] == "message":
                d = msg["data"]
                print(f"[{d['sender_name']}] {d['text']}")

asyncio.run(chat())`} />
          </div>

          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-400">message.received Webhook</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Bir bot DM aldığında, o bota ait aktif webhook&apos;lara <InlineCode>message.received</InlineCode> eventi gönderilir.
              Botlar bu event&apos;i dinleyerek otomatik yanıt verebilir.
            </p>
            <CodeBlock language="json" code={`{
  "event": "message.received",
  "timestamp": "2026-07-01T14:30:00Z",
  "data": {
    "room_id": "550e8400-..._661f9511-...",
    "sender": {
      "id": "550e8400-...",
      "name": "Ahmet Yılmaz",
      "type": "user"
    },
    "text": "Merhaba bot!"
  }
}`} />
            <CodeBlock language="python" code={`@app.post("/webhooks/worksync")
def receive_webhook():
    payload = request.get_json()
    if payload["event"] == "message.received":
        data = payload["data"]
        room_id = data["room_id"]
        sender  = data["sender"]["name"]
        text    = data["text"]
        print(f"{sender}: {text}")
        # Otomatik yanıt:
        client.post(
            f"/api/v1/messages/{room_id}",
            json={"text": f"Mesajını aldım: {text}"},
        )
    return "", 204`} />
          </div>

          {/* Webhooks */}
          <SectionHeading id="webhooks">Webhooks</SectionHeading>
          <p className="text-sm text-muted-foreground mb-4">
            Botlar kendi webhook URL&#39;lerini kaydedebilir. Sadece bot token&#39;ları webhook yönetebilir (JWT kullanıcılar kullanamaz).
          </p>
          <div className="space-y-2">
            <EndpointCard
              method="POST"
              path="/api/v1/webhooks"
              description="Yeni webhook kaydet"
              bodyParams={[
                { name: "url", type: "string", required: true, description: "Webhook URL'si (HTTPS önerilir)" },
                { name: "events", type: "string[]", required: true, description: "task.created | task.updated | task.deleted | file.uploaded" },
                { name: "secret", type: "string", description: "HMAC imzalama için opsiyonel secret" },
              ]}
              codes={{
                curl: `curl -X POST ${BASE}/api/v1/webhooks \\
  -H "Authorization: Bearer $WMS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://myapp.example.com/hooks","events":["task.created","task.updated"]}'`,
                python: `wh = httpx.post(
    "${BASE}/api/v1/webhooks",
    json={
        "url": "https://myapp.example.com/hooks",
        "events": ["task.created", "task.updated"],
        "secret": "my-hmac-secret",
    },
    headers={"Authorization": f"Bearer {api_key}"},
).json()
print(wh["id"])`,
                javascript: `const wh = await fetch("${BASE}/api/v1/webhooks", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: "https://myapp.example.com/hooks",
    events: ["task.created", "task.updated"],
  }),
}).then((r) => r.json());`,
              }}
            />
            <EndpointCard
              method="GET"
              path="/api/v1/webhooks"
              description="Bu botun kayıtlı webhook listesi"
              codes={{
                curl: `curl "${BASE}/api/v1/webhooks" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `webhooks = httpx.get(
    "${BASE}/api/v1/webhooks",
    headers={"Authorization": f"Bearer {api_key}"},
).json()`,
                javascript: `const webhooks = await fetch("${BASE}/api/v1/webhooks", {
  headers: { Authorization: \`Bearer \${API_KEY}\` },
}).then((r) => r.json());`,
              }}
            />
            <EndpointCard
              method="DELETE"
              path="/api/v1/webhooks/{webhook_id}"
              description="Webhook'u sil (204 No Content)"
              codes={{
                curl: `curl -X DELETE "${BASE}/api/v1/webhooks/550e8400-e29b-41d4-a716-446655440000" \\
  -H "Authorization: Bearer $WMS_API_KEY"`,
                python: `httpx.delete(
    "${BASE}/api/v1/webhooks/{webhook_id}",
    headers={"Authorization": f"Bearer {api_key}"},
)`,
                javascript: `await fetch(\`${BASE}/api/v1/webhooks/\${webhookId}\`, {
  method: "DELETE",
  headers: { Authorization: \`Bearer \${API_KEY}\` },
});`,
              }}
            />
          </div>

          {/* Webhook Events */}
          <SectionHeading id="webhook-events">Webhook Events</SectionHeading>
          <p className="text-sm text-muted-foreground mb-4">
            Tüm webhook payload&#39;ları aynı formatı kullanır. İsteğe bağlı HMAC imzalama için
            <InlineCode>X-WorkSync-Signature</InlineCode> header&#39;ına bakın.
          </p>
          <CodeBlock language="json" code={`{
  "event": "task.created",
  "timestamp": "2026-07-01T12:00:00Z",
  "data": {
    "id": "TASK-A1B2C3D4",
    "title": "Deploy v2",
    "status": "todo",
    "priority": "high",
    "assignee": null,
    "due_date": "2026-07-20",
    "tags": ["deploy"],
    "created_at": "2026-07-01",
    "updated_at": "2026-07-01T12:00:00Z"
  }
}`} />

          <div className="mt-6 rounded-xl border border-border/40 bg-card overflow-hidden">
            <div className="border-b border-border/40 bg-muted/20 px-4 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Desteklenen Event&#39;ler</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Event</th>
                  <th className="px-4 py-2 text-left font-medium">Tetikleyen</th>
                  <th className="px-4 py-2 text-left font-medium">data alanı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {[
                  ["task.created", "Yeni görev oluşturulduğunda", "Task objesi"],
                  ["task.updated", "Görev güncellendiğinde (PATCH/PUT)", "Güncellenmiş Task objesi"],
                  ["task.deleted", "Görev silindiğinde", "Silinen Task objesinin son hali"],
                  ["file.uploaded", "Dosya yüklendiğinde", "{ path, name, size }"],
                  ["message.received", "Bot DM aldığında (alıcı bot ise)", "{ room_id, sender, text }"],
                ].map(([event, trigger, data]) => (
                  <tr key={event}>
                    <td className="px-4 py-2.5 font-mono text-xs">{event}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{trigger}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-lg border border-border/40 bg-card p-4">
            <p className="mb-2 text-sm font-medium">HMAC İmzalama</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Webhook kayıt sırasında <InlineCode>secret</InlineCode> belirtilmişse, her isteğe
              <InlineCode>X-WorkSync-Signature</InlineCode> header&#39;ı eklenir:
            </p>
            <CodeBlock language="python" code={`import hashlib, hmac

def verify_webhook(payload_bytes: bytes, signature: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), payload_bytes, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)`} />
          </div>

          {/* Examples */}
          <SectionHeading id="examples">Örnekler</SectionHeading>
          <p className="text-sm text-muted-foreground mb-2">
            Aşağıda gerçekten çalışan, kopyalayıp kullanabileceğiniz bir Python bot örneği bulunmaktadır.
          </p>
          <SubHeading id="example-task-bot">Görev Yönetim Botu</SubHeading>
          <p className="text-sm text-muted-foreground mb-4">
            Bu bot şunları yapar:
          </p>
          <ul className="mb-4 space-y-1 text-sm text-muted-foreground list-disc list-inside">
            <li><InlineCode>WMS_API_KEY</InlineCode> ortam değişkeninden API key okur</li>
            <li>Tamamlanmamış görevleri listeler ve özet çıkarır</li>
            <li>Otomatik olarak yeni bir görev oluşturur</li>
            <li><InlineCode>task.created</InlineCode> ve <InlineCode>task.updated</InlineCode> event&#39;leri için webhook kaydeder</li>
            <li>Flask ile minimal bir webhook receiver çalıştırır ve HMAC imzasını doğrular</li>
          </ul>
          <CodeBlock language="python" code={`#!/usr/bin/env python3
"""WorkSync Görev Yönetim Botu — tam çalışır örnek."""

import hashlib
import hmac
import json
import os
import sys

import httpx
from flask import Flask, request, abort

# ── Yapılandırma ───────────────────────────────────────────────────────────────
API_KEY    = os.environ.get("WMS_API_KEY", "")
BASE_URL   = os.environ.get("WMS_BASE_URL", "http://localhost:8000")
WEBHOOK_SECRET = os.environ.get("WMS_WEBHOOK_SECRET", "my-secret-key")

if not API_KEY:
    sys.exit("WMS_API_KEY ortam değişkeni tanımlı değil.")

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type":  "application/json",
}

# ── API İstemcisi ──────────────────────────────────────────────────────────────
client = httpx.Client(base_url=BASE_URL, headers=HEADERS, timeout=10.0)


def list_open_tasks() -> list[dict]:
    """Tamamlanmamış görevleri döner."""
    resp = client.get("/api/v1/tasks", params={"status": "todo", "limit": 50})
    resp.raise_for_status()
    return resp.json()


def create_task(title: str, priority: str = "medium") -> dict:
    """Yeni görev oluşturur ve döner."""
    resp = client.post("/api/v1/tasks", json={
        "title":    title,
        "status":   "todo",
        "priority": priority,
    })
    resp.raise_for_status()
    return resp.json()


def register_webhook(url: str) -> dict:
    """task.created ve task.updated event'leri için webhook kaydeder."""
    resp = client.post("/api/v1/webhooks", json={
        "url":    url,
        "events": ["task.created", "task.updated"],
        "secret": WEBHOOK_SECRET,
    })
    resp.raise_for_status()
    return resp.json()


# ── Ana Mantık ─────────────────────────────────────────────────────────────────
def run_bot():
    tasks = list_open_tasks()
    print(f"Açık görev sayısı: {len(tasks)}")
    for t in tasks[:5]:
        print(f"  [{t['priority'].upper()}] {t['title']} — {t['id']}")

    new_task = create_task("Bot tarafından oluşturuldu", priority="low")
    print(f"\\nYeni görev oluşturuldu: {new_task['id']}")

    webhook_url = "https://myapp.example.com/webhooks/worksync"
    wh = register_webhook(webhook_url)
    print(f"Webhook kaydedildi: {wh['id']}")


# ── Webhook Receiver (Flask) ───────────────────────────────────────────────────
app = Flask(__name__)


def verify_signature(body: bytes, sig_header: str) -> bool:
    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, sig_header)


@app.post("/webhooks/worksync")
def receive_webhook():
    sig = request.headers.get("X-WorkSync-Signature", "")
    if not verify_signature(request.data, sig):
        abort(403)

    payload = request.get_json()
    event   = payload.get("event")
    data    = payload.get("data", {})

    if event == "task.created":
        print(f"[webhook] Yeni görev: {data.get('title')} ({data.get('id')})")
    elif event == "task.updated":
        print(f"[webhook] Güncellendi: {data.get('title')} → {data.get('status')}")

    return "", 204


if __name__ == "__main__":
    # python bot.py        → ana mantığı çalıştır
    # python bot.py serve  → webhook sunucusunu başlat
    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        print("Webhook sunucusu http://0.0.0.0:5000 üzerinde başlatılıyor…")
        app.run(host="0.0.0.0", port=5000)
    else:
        run_bot()
`} />

          <div className="mt-4 rounded-lg border border-border/40 bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
            <p><strong className="text-foreground">Kurulum:</strong></p>
            <CodeBlock language="bash" code={`pip install httpx flask
export WMS_API_KEY="wms_live_your_key_here"
export WMS_BASE_URL="http://localhost:8000"

# Ana botu çalıştır:
python bot.py

# Webhook sunucusunu başlat (ayrı terminal):
python bot.py serve`} />
          </div>
        </div>
      </main>
    </div>
  )
}