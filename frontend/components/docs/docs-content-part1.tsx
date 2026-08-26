"use client"

import { EndpointCard } from "@/components/docs/endpoint-card"
import { CodeBlock } from "@/components/docs/code-block"

const BASE = "https://your-api.example.com"

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

export function DocsContentPart1() {
  return (
    <>
          {/* Getting Started */}
          <SectionHeading id="getting-started">Başlangıç</SectionHeading>
          <p className="text-sm text-muted-foreground mb-4">
            WorkSync API'yi kullanmak için önce admin panelinden bir bot hesabı oluşturmanız gerekir.
            Bot hesapları sadece admin kullanıcılar tarafından açılabilir.
          </p>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Admin paneline gidin ve <strong className="text-foreground">Botlar</strong> sekmesini açın: <InlineCode>/admin?tab=bots</InlineCode></li>
            <li><strong className="text-foreground">Yeni Bot</strong> butonuna tıklayın</li>
            <li>Bot adı ve açıklaması girin, oluşturun</li>
            <li>Gösterilen API key'i kopyalayın — <strong className="text-red-400">bir daha gösterilmeyecektir</strong></li>
            <li>Key'i <InlineCode>{"Authorization: Bearer <key>"}</InlineCode> header'ı ile kullanın</li>
          </ol>

          {/* Authentication */}
          <SectionHeading id="authentication">Authentication</SectionHeading>
          <p className="text-sm text-muted-foreground mb-4">
            Tüm API endpoint'leri <InlineCode>Authorization</InlineCode> header'ı gerektirir.
            Hem bot API key'leri hem de kullanıcı JWT token'ları kabul edilir.
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
            <strong>Güvenlik Notu:</strong> API key'lerinizi asla kaynak kodunuza ya da public repo'larınıza eklemeyin.
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
            Görev oluşturma, listeleme, güncelleme ve silme işlemleri. Webhook'lar task.created,
            task.updated, task.deleted event'lerini tetikler.
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

    </>
  )
}
