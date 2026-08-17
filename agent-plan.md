# Agent Sistemi — Mimari Plan (v2)

---

## Planın Eleştirel Değerlendirmesi

### Neyi İyi Anlattı?

Teknik mimari makul: Bot = kimlik, Agent = davranış ayrımı temiz. DB modelleri yeterli. 3 tetikleyici (schedule, chat, task) doğru tespit edilmiş. Implementasyon sırası mantıklı.

### Neyi Eksik / Yanlış Anlattı?

Aşağıdaki sorunlar bu planı bir kullanıcı gözüyle **yetersiz** yapıyor:

---

#### 1. Agent Nasıl "Çalışır"? — Siyah Kutu Problemi

Plan mevcut haliyle şunu söylüyor: "dış LLM API'sine POST yap, cevabı al, yaz."

Ama kullanıcı şunu sormak zorunda kalır:
- Agent ne yaptı? Neden? Hangi kararı aldı?
- Hata oldu — nerede, neden, ne yapmalıyım?
- Agent bir task'ı "Done" yaptı — neden? Doğru muydu?

**Eksik olan:** Her AgentRun için kullanıcının görebileceği adım adım **trace** — hangi input geldi, LLM ne düşündü, hangi tool çağrıldı, ne sonuç aldı, ne action yapıldı. Sadece input/output yetmez. Bu olmadan agent sistemi kör bir kutu olur ve güven sağlanamaz.

---

#### 2. Agent Oluşturma Akışı Çok Teknik

Plan agent oluşturmayı şöyle anlatıyor: "system prompt yaz, tools seç, permissions ayarla, schedule kur."

Gerçek kullanıcı şunu yaşar:
- System prompt nedir? Ne yazacağım? Örnek yok.
- Hangi tools'u ne için seçmeliyim? "File Write" açtım — ne olur, tehlikeli mi?
- Cron ifadesi nedir? `0 9 * * *` yazmayı nasıl bileceğim?

**Eksik olan:** 
- Hazır **template/preset** agentlar (örn. "Haftalık Rapor Asistanı", "Task Triager", "Toplantı Özetleyici") — kullanıcı sıfırdan başlamamalı
- System prompt için **guided wizard** veya en azından örnek prompt önerileri
- Schedule için cron yerine **insan dili** seçici ("Her Pazartesi 09:00", "Her gün", "Saatte bir")
- Tool açıklamaları daha net: "Bu tool açıksa agent ne yapabilir?"

---

#### 3. Agent'a Güven ve Onay Mekanizması Yok

Plan agentın "task'ı Done yapsın, chat göndersin, dosya oluşturabilsin" diyor.

Ama şu soru yanıtsız: **Kim onaylar?**

- Agent yanlış bir task'ı Done yaparsa?
- Agent takım üyelerine mesaj gönderirse (onlar bilmeden)?
- Agent yanlış kişiye DM atarsa?

**Eksik olan:**
- **Onay modları:** "Auto" (her şeyi yap), "Supervised" (aksiyon yapmadan önce kullanıcıdan onay al), "Read-only" (sadece raporlasın, değişiklik yapmasın)
- İlk kuruluşta agent "supervised" modda başlamalı, kullanıcı güven kazandıkça "auto"ya geçirmeli
- Onay bekleyen aksiyonlar için **inbox / approval queue** UI

---

#### 4. Chat Tetikleyici Yüzeysel Tasarlandı

Plan "chat widget'ta agent seç, mesaj at" diyor. Yeterince düşünülmemiş:

- Agent sadece son N mesajı mı görür? Kaç mesaj? Konfigüre edilebilir mi?
- Kullanıcı agent'a bir dosya attach edebilir mi?
- Agent conversation içinde tool kullandığında kullanıcı bunu görür mü? (örn. "Tasks listeni çekiyorum..." gibi)
- Agent aynı anda birden fazla kullanıcıyla konuşabilir mi? Thread izolasyonu var mı?
- Agent conversation'ı "hafızaya" alır mı? (Persistent memory vs. per-session memory)

**Eksik olan:** Conversation design detayları — tool use görünürlüğü, memory model, multi-user thread izolasyonu.

---

#### 5. Task Tetikleyici Çok Basit Modellendi

Plan "task atanınca agent çalışır" diyor. Ama:

- Agent task'ı ne zaman tamamlamış sayılır? Hemen mi? Birkaç adım atması gerekiyorsa?
- Agent bir task için birden fazla run yapabilir mi? (Uzun süreli görev)
- Agent sub-task oluşturabilir mi? Bunu düşünmüş müyüz?
- Task "In Review" durumuna alınabilir mi — agent tamamladı, insan onaylasın?
- Bir task'a birden fazla agent atanabilir mi?

**Eksik olan:** Agent task lifecycle tasarımı — agent çalışırken task statüsü ne olur, çıktı nereye yazılır, insan ne görür.

---

#### 6. Hata ve Başarısızlık Yönetimi Hiç Ele Alınmamış

- LLM servisi down olursa? Agent run retry mi eder?
- Agent tool call yapıyor, API hata dönüyor — ne olur?
- Schedule çalışacaktı ama sistem downdu — kaçırılan run'lar ne olur?
- Agent sonsuz döngüye girerse? (kendi oluşturduğu task'lara tekrar atanırsa?)
- Cost/rate limit: Agent dakikada 100 kez çalışmaya başlarsa?

**Eksik olan:** Retry policy, dead-letter queue, circuit breaker, rate limiting per agent, max run duration.

---

#### 7. Onboarding ve Keşfedilebilirlik Zayıf

Kullanıcı Team sayfasına girip "New Agent" görüyor. Ama:

- Agent ile bot arasındaki farkı bilmiyor.
- Ne işe yarayacağını anlamadan konfigürasyon ekranına düşüyor.
- System prompt boş — ne yazacağını bilmiyor.
- Save'e basıyor, "active" yapıyor — ama agent'ın gerçekten çalışıp çalışmadığını nereden biliyor?

**Eksik olan:**
- Boş state UI — "Henüz agent yok, şablon seç veya sıfırdan oluştur"
- Agent oluştururken **step-by-step wizard**: Amaç → Tetikleyici → Şablon → Test → Yayınla
- **Test modu** — Agent'ı kaydetmeden önce bir kez deneme çalıştırma imkanı
- **Agent durumu dashboard** — kaç kez çalıştı, başarı oranı, son hata

---

#### 8. Permissions Granülaritesi Pratik Değil

Mevcut `AgentPermissions` şu alanları içeriyor:
`canReadFiles`, `canWriteFiles`, `canSendEmails`, `canAccessCalendar`, `canManageTeam`, `canViewAnalytics`, `canExecuteCode`, `canMakeAPIRequests`, `allowedDomains`

Sorunlar:
- "canManageTeam" — çok geniş. Agent takımdan kimi silebilir mi? Bu kabul edilemez.
- "canWriteFiles" — hangi klasöre? Tüm workspace'e mi?
- "allowedDomains" — sadece API requests için mi? Chat DM gönderebileceği kullanıcılar için de lazım.

**Eksik olan:** Scope bazlı izinler — "Bu task listesini okuyabilir ama sadece kendi oluşturduklarını güncelleyebilir" gibi.

---

#### 9. Agent'lar Arası Orkestrasyon Düşünülmedi

Plan her agent'ı izole bir birim olarak ele alıyor. Ama gerçek iş akışlarında bu yetmez:

- "Haftalık rapor" agenti → veri toplamak için "Analytics" agentini çağırabilir mi?
- Bir ana agent ("Proje Koordinatörü") alt agentlere görev dağıtabilir mi?
- İki agent aynı task'a aynı anda atanırsa ne olur? Çakışma?

Bunu şimdi düşünmemek kritik: ileride "multi-agent workflow" ihtiyacı doğduğunda mevcut veri modeli buna hazır değilse her şeyi yeniden yazmak gerekir.

**Çözüm — Minimal ama genişletilebilir model:**

`AgentRun` tablosuna iki alan eklenir:
```
parent_run_id   UUID?   → bu run başka bir agent'ın run'ı tarafından tetiklendiyse
caller_agent_id UUID?   → tetikleyen agent
```

`Agent` tablosuna:
```
can_call_agents  bool   → bu agent başka agentları tetikleyebilir mi? (varsayılan: false)
allowed_agents   JSON   → çağırabileceği agent id listesi (boşsa hiçbirini çağıramaz)
max_depth        int    → orkestrasyon zinciri maksimum kaç kat derine gidebilir (varsayılan: 1)
```

Bu üç alan şimdi eklenir, kullanılmasa bile; ileride multi-agent workflow eklendiğinde model değişmez.

**Güvenlik:** `max_depth = 1` varsayılan olmalı. Aksi halde A → B → C → A döngüsü oluşur ve sistem kilitlenir. Döngü tespiti için `parent_run_id` zinciri kontrol edilir.

---

#### 10. Veri Gizliliği ve Erişim Sınırı Tanımlanmadı

Plan agent'ın hangi veriye erişeceğini hiç sormamış. Ama bu multi-user bir workspace:

- Agent tüm kullanıcıların tasklerini okuyabilir mi, sadece sahibinin mi?
- Agent başka kullanıcıların DM geçmişini görebilir mi?
- Agent `canViewAnalytics` açıksa şirketin tüm gelir verilerini mi görür?
- Admin olmayan bir kullanıcının agenti admin-only verilere erişirse?

Bu soruların yanıtsız kalması ciddi bir güvenlik açığıdır.

**Çözüm — Data Scope modeli:**

Her agent için `data_scope` field'ı eklenir:

```
owner_only    → sadece agentin sahibinin verisini okuyabilir/yazabilir
team          → tüm takım üyelerinin verisini görebilir (write kısıtlı)
workspace     → workspace genelinde erişim (sadece admin agentlara verilmeli)
```

Ayrıca kaynak bazlı kurallar:

| Kaynak | owner_only | team | workspace |
|---|---|---|---|
| Tasks okuma | Sadece kendi taskları | Tüm takım taskları | Tüm workspace taskları |
| Tasks yazma | Sadece kendi oluşturduğu | Atandığı taskları | Tüm tasklar |
| Chat okuma | Kendi konuşmaları | — | — |
| Chat yazma | Sadece sahibiyle | Herkese DM | Herkese DM |
| Files okuma | Owner'ın klasörü | Paylaşılan klasörler | Tüm dosyalar |
| Analytics | — | — | Sadece workspace scope |

**Owner bilgisi:** Agent her API çağrısında kimin agenti olduğu bilgisini taşır. Backend bu bilgiyle query'leri filtreler — mevcut `owner_id` zaten `Agent` modelinde var, bunu kullanmak yeterli.

---

## Revize Plan — Neyi Değiştirmeliyiz

### Eklenecek Kavramlar

#### A. Agent Execution Mode (Çalışma Modu)
Her agent için 3 mod:
- `supervised` — Her aksiyon yapılmadan önce kullanıcı onayı beklenir (varsayılan yeni agentlar için)
- `auto` — Tüm aksiyonları kendi yapar
- `readonly` — Hiçbir şey değiştirmez, sadece raporlar / yanıtlar

#### B. AgentTrace (Detaylı İzleme)
`AgentRun`'a ek olarak her run için adım adım log:
```
AgentTrace:
  run_id       → AgentRun FK
  step_index   → sıra numarası
  step_type    → "llm_call" | "tool_call" | "action" | "approval_wait"
  input        → bu adıma giren veri
  output       → bu adımdan çıkan veri
  tool_name    → (tool_call ise) hangi tool
  duration_ms  → bu adım kaç ms sürdü
  timestamp    → ne zaman
```

#### C. Agent Templates (Şablonlar)
Hazır başlangıç noktaları:
- **Haftalık Durum Raporu** — Her Pazartesi açık taskları özetler, kanala yazar
- **Task Triager** — Yeni taskları öncelik sırasına koyar, uygun kişiye atar
- **Toplantı Notu Yazıcı** — Toplantı sonrası task oluşturur
- **Deadline Takipçisi** — Yaklaşan deadline'ları ilgili kişilere bildirir
- **Sıfırdan Oluştur** — Boş başlangıç

#### D. Approval Queue
Agent `supervised` moddayken:
- Yapılmak istenen aksiyon bir kuyruğa girer
- Kullanıcı `/agents/approvals` sayfasında bekleyen aksiyonları görür
- Onayla / Reddet / Düzenle seçenekleri
- Onaylanan aksiyonlar çalışır, reddedilenler log'a yazılır

#### E. Agent Health Dashboard
Her agent kartında:
- Son 24 saat / 7 gün çalışma grafiği
- Başarı oranı (%)
- Son hata mesajı
- Ortalama run süresi
- Toplam token kullanımı

---

## Güncellenmiş Implementasyon Sırası

**Faz 1 — Temel Altyapı**
1. Backend: Agent, AgentSchedule, AgentRun, AgentTrace modelleri (`data_scope`, orkestrasyon alanları dahil — şimdi eklenir, sonra aktive edilir)
2. Backend: Agent CRUD API
3. Frontend: Agent Builder gerçek API'ye bağlanır (mock kaldır)
4. Frontend: Team sayfasında agent listesi gerçek API
5. Frontend: Chat widget'a agent eklenir

**Faz 2 — Tetikleyiciler**
6. Backend + Frontend: Task assignee → agent tetiklenir, task lifecycle
7. Backend + Frontend: Chat DM → agent tetiklenir, cevap yazar
8. Backend: Schedule runner (cron/interval)

**Faz 3 — Güven & Kontrol**
9. Execution mode: supervised / auto / readonly
10. Data scope enforcement — backend tüm agent sorgularını `data_scope`'a göre filtreler
11. Approval queue UI
12. Run History + AgentTrace görünümü (Agent Builder 6. tab)

**Faz 4 — UX Kalitesi**
13. Agent templates (hazır şablonlar)
14. Agent Health Dashboard
15. Cron yerine insan dili schedule seçici
16. Test mode (kaydetmeden çalıştır)

**Faz 5 — Orkestrasyon (İsteğe Bağlı, Sonraki Aşama)**
17. `can_call_agents` aktive et — agent diğer agentları tetikleyebilsin
18. Orkestrasyon UI — agent'ın çağırabileceği agentlar listesi, max_depth ayarı
19. Zincir görünümü — Run History'de parent/child run ilişkisi

---

## Kritik Dosyalar (Güncellendi)

### Backend
| Dosya | Değişiklik |
|---|---|
| `backend/app/models.py` | Agent, AgentSchedule, AgentRun, AgentTrace modelleri; `data_scope`, `can_call_agents`, `allowed_agents`, `max_depth`; AgentRun'a `parent_run_id`, `caller_agent_id` |
| `backend/app/schemas.py` | Agent şemaları + execution mode + data scope |
| `backend/app/routers/agents.py` | **yeni** — CRUD + run + approval endpoints + orkestrasyon |
| `backend/app/services/agent_runner.py` | **yeni** — execution engine + trace logging + data scope filter + döngü koruması |
| `backend/app/services/scheduler.py` | **yeni** — background schedule runner |
| `backend/app/routers/v1/tasks.py` | task atama tetikleyici |
| `backend/app/routers/v1/chat.py` | chat tetikleyici |
| `backend/app/main.py` | router kayıt + scheduler lifespan |

### Frontend
| Dosya | Değişiklik |
|---|---|
| `frontend/types/agent.ts` | AgentRun, AgentTrace, execution mode, data scope, orkestrasyon alanları |
| `frontend/lib/actions/agents.ts` | **yeni** — API fonksiyonları |
| `frontend/app/agent-builder/[id]/page.tsx` | mock kaldır, gerçek API, Run History tab |
| `frontend/app/team/page.tsx` | agent listesi gerçek API, health stats |
| `frontend/components/chat-widget.tsx` | agent alıcı desteği, tool use göstergesi |
| `frontend/components/tasks/quick-add-task.tsx` | agent assignee seçimi |
| `frontend/components/tasks/edit-task-dialog.tsx` | agent assignee seçimi |
| `frontend/app/agents/approvals/page.tsx` | **yeni** — approval queue |

---

## Doğrulama Kriterleri (Güncellendi)

- Agent template seçerek oluştur → varsayılan system prompt gelsin
- Agent "supervised" modda task'a atansın → approval queue'ya düşsün → onayla → task güncellensin
- Agent "auto" modda chat mesajı alsın → cevap yazsın
- Run History tab'ında AgentTrace adım adım görünsün
- Schedule aktif agent → belirlenen saatte çalışsın → Health Dashboard'da görünsün
- Agent hata aldığında → error log'a düşsün, kullanıcıya bildirim gitsin
- `owner_only` scope'lu agent → başka kullanıcının task'ını okumaya çalıştığında 403 dönsün
- `team` scope'lu agent → tüm takım tasklerini okuyabilsin, ama sadece atandıklarını güncelleyebilsin
- `can_call_agents: false` agenti başka agent'ı çağırmaya çalışırsa → reddedilsin, log'a yazılsın
- `max_depth: 1` konfigürasyonuyla A → B → C zinciri → C'de bloklansin