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

export function DocsContentPart2() {
  return (
    <>
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

    </>
  )
}
