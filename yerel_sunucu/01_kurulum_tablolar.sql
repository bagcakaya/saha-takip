-- ==================================================================================
-- SAHA TAKİP SİSTEMİ - MICROSOFT SQL SERVER (SSMS) VERİTABANI VE TABLO KURULUMU
-- Windows Server 2022 + SSMS üzerinde tek seferde çalıştırmak için hazırlanmıştır.
-- ==================================================================================

-- 1. Veritabanı Oluşturma (Varsa atlar)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'SahaTakipDB')
BEGIN
    CREATE DATABASE [SahaTakipDB] COLLATE Turkish_CI_AS;
    PRINT '>> SahaTakipDB veritabanı başarıyla oluşturuldu.';
END
ELSE
BEGIN
    PRINT '>> SahaTakipDB veritabanı zaten mevcut.';
END
GO

USE [SahaTakipDB];
GO

-- 2. STANDARD_TASKS TABLOSU (Mesai, İzin, Şablonlar, Ayarlar, Kullanıcılar ve Modül Slotları)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'standard_tasks')
BEGIN
    CREATE TABLE dbo.standard_tasks (
        id INT PRIMARY KEY,
        tasks NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    PRINT '>> [standard_tasks] tablosu oluşturuldu.';
END
GO

-- 3. LOCATIONS TABLOSU (Montaj ve Keşif Görevleri)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'locations')
BEGIN
    CREATE TABLE dbo.locations (
        id NVARCHAR(100) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        address NVARCHAR(500) NULL,
        notes NVARCHAR(MAX) NULL,
        photos NVARCHAR(MAX) NULL,           -- JSON dizi formatında tutulur
        latitude FLOAT NULL,
        longitude FLOAT NULL,
        created_at BIGINT NULL,
        created_by NVARCHAR(100) NULL,
        created_by_name NVARCHAR(255) NULL,
        tasks NVARCHAR(MAX) NULL,            -- JSON dizi formatında kontrol listesi
        status NVARCHAR(50) DEFAULT 'pending',
        completed_at BIGINT NULL,
        completed_by NVARCHAR(100) NULL,
        completed_by_name NVARCHAR(255) NULL,
        completion_note NVARCHAR(MAX) NULL,
        completion_photos NVARCHAR(MAX) NULL,-- JSON dizi formatında
        approved_at BIGINT NULL,
        approved_by NVARCHAR(100) NULL,
        approved_by_name NVARCHAR(255) NULL,
        rejected_at BIGINT NULL,
        rejected_by NVARCHAR(100) NULL,
        rejected_by_name NVARCHAR(255) NULL,
        rejection_reason NVARCHAR(MAX) NULL,
        updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_locations_status ON dbo.locations(status);
    CREATE INDEX IX_locations_created_at ON dbo.locations(created_at DESC);
    PRINT '>> [locations] tablosu oluşturuldu.';
END
GO

-- 4. NOTES TABLOSU (İş Emirleri, Notlar ve Görev Hatırlatmaları)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notes')
BEGIN
    CREATE TABLE dbo.notes (
        id NVARCHAR(100) PRIMARY KEY,
        content NVARCHAR(MAX) NOT NULL,
        created_at BIGINT NOT NULL,
        created_by NVARCHAR(100) NULL,
        created_by_name NVARCHAR(255) NULL,
        target_mode NVARCHAR(50) DEFAULT 'self',
        target_user_ids NVARCHAR(MAX) NULL,   -- JSON dizi formatında kullanıcı kimlikleri
        target_user_names NVARCHAR(MAX) NULL, -- JSON dizi formatında kullanıcı isimleri
        target_user_id NVARCHAR(100) NULL,
        target_user_name NVARCHAR(255) NULL,
        reminder_active BIT DEFAULT 0,
        reminder_date NVARCHAR(50) NULL,
        notified BIT DEFAULT 0,
        status NVARCHAR(50) DEFAULT 'pending',
        completed_at BIGINT NULL,
        completed_by NVARCHAR(100) NULL,
        completed_by_name NVARCHAR(255) NULL,
        completion_note NVARCHAR(MAX) NULL,
        approved_at BIGINT NULL,
        approved_by NVARCHAR(100) NULL,
        approved_by_name NVARCHAR(255) NULL,
        rejected_at BIGINT NULL,
        rejected_by NVARCHAR(100) NULL,
        rejected_by_name NVARCHAR(255) NULL,
        rejection_reason NVARCHAR(MAX) NULL,
        updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_notes_status ON dbo.notes(status);
    CREATE INDEX IX_notes_created_at ON dbo.notes(created_at DESC);
    CREATE INDEX IX_notes_target_user ON dbo.notes(target_user_id);
    PRINT '>> [notes] tablosu oluşturuldu.';
END
GO

-- 5. SERVICES TABLOSU (Teknik Servis Müdahaleleri)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'services')
BEGIN
    CREATE TABLE dbo.services (
        id NVARCHAR(100) PRIMARY KEY,
        company_name NVARCHAR(255) NOT NULL,
        location NVARCHAR(255) NULL,
        latitude FLOAT NULL,
        longitude FLOAT NULL,
        work_done NVARCHAR(MAX) NOT NULL,
        [date] NVARCHAR(50) NULL,
        created_at BIGINT NOT NULL,
        created_by NVARCHAR(100) NULL,
        created_by_name NVARCHAR(255) NULL,
        updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_services_created_at ON dbo.services(created_at DESC);
    CREATE INDEX IX_services_company ON dbo.services(company_name);
    PRINT '>> [services] tablosu oluşturuldu.';
END
GO

-- 6. RETURN_WARRANTY TABLOSU (İade ve Garanti Takip Kayıtları)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'return_warranty')
BEGIN
    CREATE TABLE dbo.return_warranty (
        id NVARCHAR(100) PRIMARY KEY,
        [type] NVARCHAR(50) NOT NULL DEFAULT 'warranty',
        company_name NVARCHAR(255) NOT NULL,
        sent_date NVARCHAR(50) NOT NULL,
        serial_number NVARCHAR(100) NULL,
        tracking_code NVARCHAR(100) NULL,
        serial_number_photo NVARCHAR(MAX) NULL,
        tracking_code_photo NVARCHAR(MAX) NULL,
        notes NVARCHAR(MAX) NULL,
        status NVARCHAR(50) DEFAULT 'pending',
        reminder_date NVARCHAR(50) NULL,
        reminder_active BIT DEFAULT 0,
        notified BIT DEFAULT 0,
        created_at BIGINT NOT NULL,
        created_by NVARCHAR(100) NULL,
        created_by_name NVARCHAR(255) NULL,
        cari_name NVARCHAR(255) NULL,
        updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_return_warranty_status ON dbo.return_warranty(status);
    CREATE INDEX IX_return_warranty_created_at ON dbo.return_warranty(created_at DESC);
    PRINT '>> [return_warranty] tablosu oluşturuldu.';
END
GO

PRINT '==================================================================================';
PRINT '>> TEBRİKLER: SahaTakipDB veritabanı ve tüm tablolar eksiksiz oluşturuldu!';
PRINT '==================================================================================';
