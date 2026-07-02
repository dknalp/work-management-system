# WorkSync Gerçek Zamanlı Chat Sistemi — Uygulama Planı

## Hedef

Mevcut sahte (hardcoded) chat widget'ını gerçek, PostgreSQL destekli, WebSocket tabanlı bir mesajlaşma sistemine dönüştür.

## Mimari

```
Browser (chat-widget.tsx)
   ├── REST: GET /api/v1/messages/contacts     → kullanıcı+bot listesi
   ├── REST: GET /api/v1/messages/{room_id}    → mesaj geçmişi
   └── WebSocket: /api/v1/ws/chat/{room_id}    → gerçek zamanlı al/gönder

Backend (FastAPI + PostgreSQL)
   ├── ChatMessage model → chat_messages tablosu
   ├── v1/chat.py router → tüm endpoint'ler
   └── message.received webhook → bot DM eventi
```

**Room ID:** `"_".join(sorted([id_a, id_b]))` — UUID'ler _ içermez, güvenli ayraç.

## Değişiklikler

### 1. backend/app/models.py — ChatMessage modeli eklendi
### 2. backend/app/schemas.py — ChatContact + ChatMessageResponse + message.received event
### 3. backend/app/routers/v1/chat.py — yeni router (REST + WebSocket)
### 4. backend/app/main.py — chat router kayıtlandı
### 5. frontend/components/chat-widget.tsx — gerçek API + WebSocket bağlantısı
### 6. frontend/app/docs/page.tsx — messaging endpoint'leri belgelendi