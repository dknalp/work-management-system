#!/usr/bin/env python3
"""
Görev Temizleyici Bot
---------------------
1. Mevcut tüm görevleri siler
2. "gorevler" klasörü oluşturur
3. İçine "gorevler silindi" yazan metin.txt yükler
"""

import sys
import io
import httpx

# ── Yapılandırma ───────────────────────────────────────────────────────────────
TOKEN   = "wms_live_a9532a7ae512cbe8d3f0abba2dc01928193c16f948c639fbaf131d55cfd907df"
BASE    = "http://localhost:8000"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

client = httpx.Client(base_url=BASE, headers=HEADERS, timeout=10.0)


def adim(n: int, msg: str) -> None:
    print(f"\n[{n}] {msg}")


# ── Adım 1: Tüm görevleri listele ─────────────────────────────────────────────
adim(1, "Görevler listeleniyor…")
resp = client.get("/api/v1/tasks", params={"limit": 500})
resp.raise_for_status()
tasks = resp.json()
print(f"    {len(tasks)} görev bulundu.")

# ── Adım 2: Her görevi sil ────────────────────────────────────────────────────
adim(2, "Görevler siliniyor…")
if not tasks:
    print("    Silinecek görev yok.")
else:
    ids = [t["id"] for t in tasks]
    resp = client.request("DELETE", "/api/v1/tasks", json={"ids": ids})
    resp.raise_for_status()
    print(f"    {len(ids)} görev silindi.")

# ── Adım 3: "gorevler" klasörüne metin.txt yükle ─────────────────────────────
adim(3, '"gorevler" klasörü oluşturuluyor ve metin.txt yükleniyor…')
icerik = "gorevler silindi".encode("utf-8")
resp = client.post(
    "/api/v1/files/upload",
    params={"path": "gorevler"},
    headers={"Authorization": f"Bearer {TOKEN}"},  # Content-Type multipart'ı httpx ayarlar
    files={"file": ("metin.txt", io.BytesIO(icerik), "text/plain")},
)
resp.raise_for_status()
sonuc = resp.json()
print(f"    Dosya yüklendi: {sonuc['path']} ({sonuc['size']} byte)")

print("\n✓ Tamamlandı.")
client.close()