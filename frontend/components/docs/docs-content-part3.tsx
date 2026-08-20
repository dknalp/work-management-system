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

export function DocsContentPart3() {
  return (
    <>
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
    url = f"ws://localhost:3052/api/v1/ws/chat/{room_id}?token={api_key}"

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
BASE_URL   = os.environ.get("WMS_BASE_URL", "http://localhost:3052")
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
export WMS_BASE_URL="http://localhost:3052"

# Ana botu çalıştır:
python bot.py

# Webhook sunucusunu başlat (ayrı terminal):
python bot.py serve`} />
          </div>
    </>
  )
}
