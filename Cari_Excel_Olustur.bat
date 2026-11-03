@echo off
setlocal
chcp 65001 >nul
title SQL Server - Bagimsiz Cari Excel (.xlsx) Olusturma Araci
set "SELF_BAT=%~f0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$f=[System.IO.File]::ReadAllText($env:SELF_BAT,[System.Text.Encoding]::UTF8); $m='# === '+'PS_START ==='; $idx=$f.IndexOf($m); Invoke-Expression $f.Substring($idx)"
echo.
pause
exit /b

# === PS_START ===
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Data
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$ScriptDir = Split-Path -Parent $env:SELF_BAT

function Write-Header {
    Clear-Host
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host "     SQL SERVER -> EXCEL (.XLSX) CARİ AKTARIM ARACI (BAĞIMSIZ)   " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host " * Python veya Excel kurulumu gerektirmez." -ForegroundColor DarkGray
    Write-Host " * Bulut sunuculara dokunmaz, yalnızca bu bilgisayarda Excel üretir." -ForegroundColor DarkGray
    Write-Host "-----------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
}

function Clean-XmlText([string]$text) {
    if ([string]::IsNullOrEmpty($text)) { return "" }
    $cleaned = [regex]::Replace($text, '[\x00-\x08\x0B\x0C\x0E-\x1F]', '')
    return [System.Security.SecurityElement]::Escape($cleaned)
}

function Add-ZipEntry($zip, [string]$entryName, [string]$content, $utf8NoBom) {
    $entry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
    $stream = $entry.Open()
    $writer = New-Object System.IO.StreamWriter($stream, $utf8NoBom)
    $writer.Write($content)
    $writer.Flush()
    $writer.Dispose()
}

function Export-CarilerXlsx([string]$outputPath, [string[]]$cariList) {
    if (Test-Path -LiteralPath $outputPath) {
        Remove-Item -LiteralPath $outputPath -Force
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)

    $contentTypesXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>
'@

    $relsXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
'@

    $workbookXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Cariler" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
'@

    $workbookRelsXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
'@

    $stylesXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><color rgb="FF0F172A"/><name val="Segoe UI"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Segoe UI"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A8A"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>
'@

    $maxLen = 12
    foreach ($item in $cariList) {
        if ($null -ne $item -and $item.Length -gt $maxLen) {
            $maxLen = $item.Length
        }
    }
    $colWidth = [Math]::Min([Math]::Max($maxLen + 5, 35), 90)

    $sb = New-Object System.Text.StringBuilder(65536)
    [void]$sb.Append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>')
    [void]$sb.Append('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">')
    [void]$sb.Append("<cols><col min=`"1`" max=`"1`" width=`"$colWidth`" customWidth=`"1`"/></cols>")
    [void]$sb.Append('<sheetData>')

    # Satır 1: Başlık
    [void]$sb.Append('<row r="1" ht="26" customHeight="1"><c r="A1" s="1" t="inlineStr"><is><t>Cari Adı</t></is></c></row>')

    $rowNum = 2
    foreach ($name in $cariList) {
        $escaped = Clean-XmlText $name
        [void]$sb.Append("<row r=`"$rowNum`" ht=`"20`" customHeight=`"1`"><c r=`"A$rowNum`" s=`"2`" t=`"inlineStr`"><is><t xml:space=`"preserve`">$escaped</t></is></c></row>")
        $rowNum++
    }

    [void]$sb.Append('</sheetData></worksheet>')

    $fs = New-Object System.IO.FileStream($outputPath, [System.IO.FileMode]::Create)
    try {
        $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create, $false)
        try {
            Add-ZipEntry $zip '[Content_Types].xml'        $contentTypesXml $utf8NoBom
            Add-ZipEntry $zip '_rels/.rels'                $relsXml         $utf8NoBom
            Add-ZipEntry $zip 'xl/workbook.xml'            $workbookXml     $utf8NoBom
            Add-ZipEntry $zip 'xl/_rels/workbook.xml.rels' $workbookRelsXml $utf8NoBom
            Add-ZipEntry $zip 'xl/styles.xml'              $stylesXml       $utf8NoBom
            Add-ZipEntry $zip 'xl/worksheets/sheet1.xml'   $sb.ToString()   $utf8NoBom
        } finally {
            $zip.Dispose()
        }
    } finally {
        $fs.Dispose()
    }
}

function Try-OpenSql([string]$server, [string]$database, [string]$sqlUser, [string]$sqlPass) {
    if ([string]::IsNullOrWhiteSpace($sqlUser)) {
        $connStr = "Server=$server;Database=$database;Integrated Security=True;TrustServerCertificate=True;Connection Timeout=4;"
    } else {
        $connStr = "Server=$server;Database=$database;User ID=$sqlUser;Password=$sqlPass;TrustServerCertificate=True;Connection Timeout=5;"
    }
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    return $conn
}

Write-Header

# 1. Bu bilgisayardaki SQL Server servislerini otomatik tespit et
$candidateServers = New-Object System.Collections.Generic.List[string]
foreach ($s in @('localhost', '.', '.\SQLEXPRESS')) {
    if (-not $candidateServers.Contains($s)) { [void]$candidateServers.Add($s) }
}

try {
    $sqlServices = Get-Service | Where-Object { $_.Name -eq 'MSSQLSERVER' -or $_.Name -like 'MSSQL$*' }
    foreach ($srv in $sqlServices) {
        if ($srv.Name -like 'MSSQL$*') {
            $instName = ".\$($srv.Name.Substring(6))"
            if (-not $candidateServers.Contains($instName)) {
                $candidateServers.Insert(0, $instName)
            }
        } elseif ($srv.Name -eq 'MSSQLSERVER') {
            $candidateServers.Insert(0, 'localhost')
        }
    }
} catch {
    # Servis okuma yetkisi yoksa standart adaylarla devam et
}

Write-Host "[1/4] SQL Server aranıyor..." -ForegroundColor Yellow
$connectedServer = $null
$sqlUser = ""
$sqlPass = ""
$masterConn = $null

foreach ($srv in ($candidateServers | Select-Object -Unique)) {
    try {
        $masterConn = Try-OpenSql $srv 'master' '' ''
        $connectedServer = $srv
        break
    } catch {
        continue
    }
}

if (-not $masterConn) {
    Write-Host "Otomatik Windows oturumu ile yerel SQL Server'a bağlanılamadı." -ForegroundColor DarkYellow
    $manualSrv = Read-Host "SQL Sunucu Adı girin (boş bırakırsanız localhost denenir, örn: .\SQLEXPRESS veya 192.168.1.10)"
    if ([string]::IsNullOrWhiteSpace($manualSrv)) { $manualSrv = "localhost" }

    $authChoice = Read-Host "SQL Kullanıcı Adı (Windows doğrulaması için boş bırakıp Enter'a basın, örn: sa)"
    if (-not [string]::IsNullOrWhiteSpace($authChoice)) {
        $sqlUser = $authChoice.Trim()
        $sqlPass = Read-Host "SQL Şifresi"
    }

    try {
        $masterConn = Try-OpenSql $manualSrv 'master' $sqlUser $sqlPass
        $connectedServer = $manualSrv
    } catch {
        Write-Host ""
        Write-Host "[HATA] SQL Server'a bağlanılamadı ($manualSrv): $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[OK] SQL Server bağlantısı kuruldu: $connectedServer" -ForegroundColor Green
Write-Host ""

# 2. Veritabanlarını listele ve seçtir
$dbList = New-Object System.Collections.Generic.List[string]
try {
    $cmd = $masterConn.CreateCommand()
    $cmd.CommandText = "SELECT name FROM sys.databases WHERE database_id > 4 AND state = 0 ORDER BY name"
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        [void]$dbList.Add($reader.GetString(0))
    }
    $reader.Close()
    $masterConn.Close()
} catch {
    if ($masterConn) { $masterConn.Close() }
    Write-Host "[HATA] Veritabanı listesi alınamadı: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if ($dbList.Count -eq 0) {
    Write-Host "[HATA] Bu SQL Server üzerinde kullanıcı veritabanı bulunamadı!" -ForegroundColor Red
    exit 1
}

$selectedDb = $null
if ($dbList.Count -eq 1) {
    $selectedDb = $dbList[0]
    Write-Host "[2/4] Tek veritabanı bulundu ve otomatik seçildi: $selectedDb" -ForegroundColor Green
} else {
    Write-Host "[2/4] Bulunan Veritabanları:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $dbList.Count; $i++) {
        Write-Host ("  [{0}] {1}" -f ($i + 1), $dbList[$i]) -ForegroundColor White
    }
    Write-Host ""
    while (-not $selectedDb) {
        $sel = Read-Host "Aktarmak istediğiniz veritabanının numarasını yazıp Enter'a basın (1-$($dbList.Count))"
        $num = 0
        if ([int]::TryParse($sel, [ref]$num) -and $num -ge 1 -and $num -le $dbList.Count) {
            $selectedDb = $dbList[$num - 1]
        } else {
            Write-Host "Lütfen listeden geçerli bir numara girin." -ForegroundColor Red
        }
    }
}

Write-Host "[OK] Seçilen Veritabanı: $selectedDb" -ForegroundColor Green
Write-Host ""

# 3. Seçilen veritabanında Cari tablosunu ve sütununu bul
$dbConn = Try-OpenSql $connectedServer $selectedDb $sqlUser $sqlPass
$targetSchema = $null
$targetTable  = $null
$targetColumn = $null

try {
    # Yaygın ERP Cari tablo ve unvan/ad sütunu eşleşmelerini kontrol et
    $colCmd = $dbConn.CreateCommand()
    $colCmd.CommandText = @"
SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('CARI', 'CARILER', 'CARI_HESAPLAR', 'TBLCASABIT', 'CARIHESAP', 'CARI_KART', 'FIRMALAR', 'MUSTERILER')
   OR TABLE_NAME LIKE 'LG_%_CLCARD'
ORDER BY TABLE_NAME, ORDINAL_POSITION
"@
    $colReader = $colCmd.ExecuteReader()
    $candidates = @()
    while ($colReader.Read()) {
        $candidates += [PSCustomObject]@{
            Schema = $colReader.GetString(0)
            Table  = $colReader.GetString(1)
            Column = $colReader.GetString(2)
        }
    }
    $colReader.Close()

    # Öncelik sırasına göre en doğru Cari Adı / Ünvan sütununu bul
    $preferredCols = @(
        'AD', 'UNVAN', 'CARI_UNVAN', 'CARI_ADI', 'CARI_ISIM',
        'TICARI_UNVANI', 'cari_unvan1', 'DEFINITION_', 'UNVANI',
        'FIRMA_ADI', 'FIRMAADI', 'ADI_SOYADI', 'ISIM'
    )

    foreach ($pCol in $preferredCols) {
        $match = $candidates | Where-Object { $_.Column -ieq $pCol } | Select-Object -First 1
        if ($match) {
            $targetSchema = $match.Schema
            $targetTable  = $match.Table
            $targetColumn = $match.Column
            break
        }
    }

    # Otomatik bulunamadıysa kullanıcıya tablo ve sütun seçtir
    if (-not $targetTable) {
        Write-Host "[!] Standart Cari tablosu otomatik tanınamadı. Mevcut tablolar listeleniyor..." -ForegroundColor DarkYellow
        $tblCmd = $dbConn.CreateCommand()
        $tblCmd.CommandText = "SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
        $tblReader = $tblCmd.ExecuteReader()
        $allTables = @()
        while ($tblReader.Read()) {
            $allTables += [PSCustomObject]@{
                Schema = $tblReader.GetString(0)
                Table  = $tblReader.GetString(1)
            }
        }
        $tblReader.Close()

        if ($allTables.Count -eq 0) {
            Write-Host "[HATA] Veritabanında okunabilir tablo bulunamadı!" -ForegroundColor Red
            $dbConn.Close()
            exit 1
        }

        for ($i = 0; $i -lt $allTables.Count; $i++) {
            Write-Host ("  [{0}] {1}.{2}" -f ($i + 1), $allTables[$i].Schema, $allTables[$i].Table)
        }
        $tNum = 0
        while ($tNum -lt 1 -or $tNum -gt $allTables.Count) {
            [void][int]::TryParse((Read-Host "Cari tablosunun numarasını girin"), [ref]$tNum)
        }
        $targetSchema = $allTables[$tNum - 1].Schema
        $targetTable  = $allTables[$tNum - 1].Table

        $cCmd = $dbConn.CreateCommand()
        $cCmd.CommandText = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @s AND TABLE_NAME = @t ORDER BY ORDINAL_POSITION"
        [void]$cCmd.Parameters.AddWithValue("@s", $targetSchema)
        [void]$cCmd.Parameters.AddWithValue("@t", $targetTable)
        $cReader = $cCmd.ExecuteReader()
        $tCols = @()
        while ($cReader.Read()) { $tCols += $cReader.GetString(0) }
        $cReader.Close()

        Write-Host ""
        Write-Host "$targetSchema.$targetTable Tablosundaki Sütunlar:" -ForegroundColor Yellow
        for ($i = 0; $i -lt $tCols.Count; $i++) {
            Write-Host ("  [{0}] {1}" -f ($i + 1), $tCols[$i])
        }
        $cNum = 0
        while ($cNum -lt 1 -or $cNum -gt $tCols.Count) {
            [void][int]::TryParse((Read-Host "Cari Adı / Ünvan sütununun numarasını girin"), [ref]$cNum)
        }
        $targetColumn = $tCols[$cNum - 1]
    }

    Write-Host "[3/4] Tablo ve Sütun: [$targetSchema].[$targetTable] -> [$targetColumn] okunuyor..." -ForegroundColor Yellow

    $qSchema = $targetSchema.Replace(']', ']]')
    $qTable  = $targetTable.Replace(']', ']]')
    $qCol    = $targetColumn.Replace(']', ']]')

    $dataCmd = $dbConn.CreateCommand()
    $dataCmd.CommandTimeout = 60
    $dataCmd.CommandText = @"
SELECT DISTINCT LTRIM(RTRIM(CAST([$qCol] AS NVARCHAR(500)))) AS CariAdi
FROM [$qSchema].[$qTable]
WHERE [$qCol] IS NOT NULL
  AND LTRIM(RTRIM(CAST([$qCol] AS NVARCHAR(500)))) <> ''
ORDER BY CariAdi
"@

    $dataReader = $dataCmd.ExecuteReader()
    $cariNames = New-Object System.Collections.Generic.List[string]
    while ($dataReader.Read()) {
        $val = $dataReader.GetString(0).Trim()
        if ($val.Length -gt 0) {
            [void]$cariNames.Add($val)
        }
    }
    $dataReader.Close()
    $dbConn.Close()
} catch {
    if ($dbConn) { $dbConn.Close() }
    Write-Host "[HATA] Cari verileri çekilirken hata oluştu: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if ($cariNames.Count -eq 0) {
    Write-Host "[UYARI] Tabloda kayıtlı cari ismi bulunamadı!" -ForegroundColor Yellow
    exit 0
}

Write-Host "[OK] Toplam $($cariNames.Count) adet tekil Cari ismi çekildi." -ForegroundColor Green
Write-Host ""

# 4. Excel (.xlsx) dosyasını oluştur
$safeDbName = ($selectedDb -replace '[\\/:*?"<>|]', '_')
$outFile = Join-Path $ScriptDir "Cariler_$safeDbName.xlsx"

Write-Host "[4/4] Excel dosyası oluşturuluyor..." -ForegroundColor Yellow
Export-CarilerXlsx -outputPath $outFile -cariList $cariNames.ToArray()

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host " [BAŞARILI] $($cariNames.Count) adet Cari Excel dosyasına aktarıldı!" -ForegroundColor Green
Write-Host " Dosya Konumu: $outFile" -ForegroundColor White
Write-Host "=================================================================" -ForegroundColor Green
Write-Host " İpucu: Bu Excel dosyasını Saha Takip uygulamasında" -ForegroundColor Cyan
Write-Host " 'Şablon/Ayarlar -> Cari Hesap Veritabanı -> Excel'den Yükle (.xlsx)'" -ForegroundColor Cyan
Write-Host " butonundan doğrudan ilgili kuruma yükleyebilirsiniz." -ForegroundColor Cyan
