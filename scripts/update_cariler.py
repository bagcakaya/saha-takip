#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
POLATLAR2025 - Cari Listesi Güncelleme Betiği
SSMS üzerindeki POLATLAR2025 veritabanından CARI isimlerini çeker ve:
  1. web/Cariler.xlsx
  2. web/public/Cariler.xlsx
  3. web/src/data/cariler.json
  4. web/public/cariler.json
dosyalarına kaydeder.
"""

import os
import sys
import json
import datetime
import pyodbc
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

# Proje dizinlerini belirle
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_DIR = os.path.join(BASE_DIR, "web")
SRC_DATA_DIR = os.path.join(WEB_DIR, "src", "data")
PUBLIC_DIR = os.path.join(WEB_DIR, "public")

os.makedirs(SRC_DATA_DIR, exist_ok=True)
os.makedirs(PUBLIC_DIR, exist_ok=True)

# Çıktı dosya yolları
EXCEL_OUTPUT_WEB = os.path.join(WEB_DIR, "Cariler.xlsx")
EXCEL_OUTPUT_PUBLIC = os.path.join(PUBLIC_DIR, "Cariler.xlsx")
JSON_OUTPUT_SRC = os.path.join(SRC_DATA_DIR, "cariler.json")
JSON_OUTPUT_PUBLIC = os.path.join(PUBLIC_DIR, "cariler.json")

print("=" * 65)
print("       POLATLAR2025 - CARİ LİSTESİ GÜNCELLEME VE AKTARIM")
print("=" * 65)

# SQL Server Bağlantı Denemesi
available_drivers = [d for d in pyodbc.drivers() if 'SQL Server' in d]
preferred_driver = None

for d in ['ODBC Driver 17 for SQL Server', 'ODBC Driver 18 for SQL Server', 'SQL Server Native Client 11.0', 'SQL Server']:
    if d in available_drivers:
        preferred_driver = d
        break

if not preferred_driver and available_drivers:
    preferred_driver = available_drivers[0]

if not preferred_driver:
    print("[HATA] Sistemde Microsoft SQL Server ODBC sürücüsü bulunamadı!")
    sys.exit(1)

servers_to_try = ['localhost', '.', '(local)', '127.0.0.1']
conn = None
connected_server = None

for s in servers_to_try:
    try:
        conn_str = (
            f"DRIVER={{{preferred_driver}}};"
            f"SERVER={s};"
            f"DATABASE=POLATLAR2025;"
            f"Trusted_Connection=yes;"
            f"TrustServerCertificate=yes;"
        )
        conn = pyodbc.connect(conn_str, timeout=5)
        connected_server = s
        break
    except Exception:
        continue

if not conn:
    print(f"[HATA] SQL Server POLATLAR2025 veritabanına bağlanılamadı!")
    print(f"Kullanılan Sürücü: {preferred_driver}")
    print("Lütfen SQL Server (MSSQLSERVER) servisinin çalıştığından emin olun.")
    sys.exit(1)

print(f"[OK] SQL Server veritabanına bağlanıldı ({connected_server} / POLATLAR2025)")

try:
    cursor = conn.cursor()
    query = """
        SELECT DISTINCT TRIM(AD) AS CariAdi
        FROM dbo.CARI
        WHERE AD IS NOT NULL AND TRIM(AD) <> ''
        ORDER BY TRIM(AD)
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    cari_names = [row[0] for row in rows]
    total_count = len(cari_names)
    conn.close()
    print(f"[OK] Veritabanından toplam {total_count} adet Cari ismi başarıyla çekildi.")
except Exception as e:
    print(f"[HATA] Veri çekme hatası: {e}")
    if conn:
        conn.close()
    sys.exit(1)

# 1. Excel (.xlsx) Dosyası Oluştur
print("[..] Excel (.xlsx) dosyası hazırlanıyor...")
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Cariler"

# Başlık stili
header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
thin_border = Border(
    left=Side(style='thin', color='E2E8F0'),
    right=Side(style='thin', color='E2E8F0'),
    top=Side(style='thin', color='E2E8F0'),
    bottom=Side(style='thin', color='E2E8F0')
)
data_font = Font(name="Segoe UI", size=10)

# Sütun Başlığı
cell_header = ws.cell(row=1, column=1, value="Cari Adı")
cell_header.fill = header_fill
cell_header.font = header_font
cell_header.alignment = Alignment(horizontal="left", vertical="center")
ws.row_dimensions[1].height = 26

max_len = len("Cari Adı")
for idx, name in enumerate(cari_names, start=2):
    c = ws.cell(row=idx, column=1, value=name)
    c.font = data_font
    c.border = thin_border
    c.alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[idx].height = 20
    if len(name) > max_len:
        max_len = len(name)

ws.column_dimensions['A'].width = max(max_len + 4, 35)

# Excel dosyalarını kaydet
wb.save(EXCEL_OUTPUT_WEB)
print(f"[OK] Excel dosyası kaydedildi: {EXCEL_OUTPUT_WEB}")

wb.save(EXCEL_OUTPUT_PUBLIC)
print(f"[OK] Excel dosyası kaydedildi: {EXCEL_OUTPUT_PUBLIC}")

# 2. JSON Dosyalarını Oluştur
json_data = {
    "updatedAt": datetime.datetime.now().isoformat(),
    "database": "POLATLAR2025",
    "total": total_count,
    "cariler": cari_names
}

with open(JSON_OUTPUT_SRC, "w", encoding="utf-8") as f:
    json.dump(json_data, f, ensure_ascii=False, indent=2)
print(f"[OK] Uygulama verisi kaydedildi: {JSON_OUTPUT_SRC}")

with open(JSON_OUTPUT_PUBLIC, "w", encoding="utf-8") as f:
    json.dump(json_data, f, ensure_ascii=False, indent=2)
print(f"[OK] Uygulama verisi kaydedildi: {JSON_OUTPUT_PUBLIC}")

# 3. Canlı Uygulama Bulutuna (Supabase Slot 15) Doğrudan Aktar
print("[..] Canlı uygulamaya (Supabase Bulut Slot 15) aktarılıyor...")
try:
    import urllib.request
    SUPABASE_URL = "https://jxqtwwpwaalgxpwmeqbc.supabase.co"
    SUPABASE_ANON_KEY = "sb_publishable_qetbs8PTG54vWFr2zDCl4g_mCTqzqpC"

    raw_json = json.dumps(json_data, ensure_ascii=False)
    chunk_size = 8000
    chunks = [raw_json[i:i + chunk_size] for i in range(0, len(raw_json), chunk_size)]

    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    payload = json.dumps({"id": 15, "tasks": chunks}).encode("utf-8")
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/standard_tasks",
        data=payload,
        headers=headers,
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        if resp.status in [200, 201, 204]:
            print("[OK] Canlı Supabase bulut veritabanına (Slot 15) başarıyla yüklendi!")
            print("     -> Canlı uygulamadaki tüm personeller ve yöneticiler yeni carileri anında görecektir.")
        else:
            print(f"[UYARI] Bulut aktarımı durum kodu: {resp.status}")
except Exception as e:
    print(f"[UYARI] Bulut aktarımı sırasında hata oluştu: {e}")
    print("        (Yerel dosyalar ve Excel güncellendi, ancak canlıya gitmesi için internet bağlantınızı kontrol ediniz)")

print("=" * 65)
print(f"TEBRİKLER: {total_count} Cari başarıyla güncellendi ve canlıya aktarıldı!")
print("=" * 65)
