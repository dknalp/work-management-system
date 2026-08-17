---
name: decisions
description: Alınan mimari ve teknik kararlar
metadata:
  type: project
---

# Decisions

## 2026-08-17

### Office Preview → Google Docs Viewer iframe
- Sıfır kurulum, sıfır npm paketi, ücretsiz
- `https://docs.google.com/viewer?url=<presigned_url>&embedded=true`
- OnlyOffice alternatif (daha sonra değerlendirilebilir)

### Markdown → react-markdown + remark-gfm
### Syntax highlight → shiki
### CSV → papaparse + @tanstack/react-table (zaten projede var)
### Emoji picker → emoji-mart

### Pinned folders → şimdilik localStorage kalır (P2'de DB'ye taşınacak)

### Bulk ops backend → ayrı endpoint'ler (bulk-move, bulk-copy, bulk-trash)
### FileShare → ayrı tablo (file_records'a kolon değil)
### FileAccessLog → ayrı tablo (mevcut ActivityLog'dan bağımsız)