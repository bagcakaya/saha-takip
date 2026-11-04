using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security;
using System.ServiceProcess;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace CariExcelAktar
{
    internal static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        [STAThread]
        private static void Main(string[] args)
        {
            try { SetProcessDPIAware(); } catch { }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            if (args != null && args.Length >= 2 && string.Equals(args[0], "--selftest", StringComparison.OrdinalIgnoreCase))
            {
                string outDir = args[1];
                Directory.CreateDirectory(outDir);
                using (var form = new MainForm())
                {
                    form.RunSelfTest(outDir);
                }
                return;
            }

            Application.Run(new MainForm());
        }
    }

    internal sealed class SelectedDbEntry
    {
        public string RawServerInput { get; set; }
        public string ResolvedServer { get; set; }
        public string DisplayHost { get; set; }
        public string DatabaseName { get; set; }
        public string SqlUser { get; set; }
        public string SqlPassword { get; set; }

        public string Key
        {
            get
            {
                return (DisplayHost + ">" + DatabaseName).ToUpperInvariant();
            }
        }

        public override string ToString()
        {
            return string.Format(
                "[-] {0}>{1} [ Sunucu : {0}], [Veritabanı : {1} ]",
                DisplayHost,
                DatabaseName
            );
        }
    }

    internal sealed class MainForm : Form
    {
        private ComboBox cmbServer;
        private TextBox txtUser;
        private CheckBox chkShowPass;
        private TextBox txtPassword;
        private Button btnTest;
        private ListBox lstDatabases;
        private ListBox lstSelected;
        private Panel pnlExportBar;
        private Button btnExportExcel;
        private Button btnRemoveSelected;
        private Button btnClearList;
        private Label lblStatus;
        private ToolTip toolTip;

        private string lastResolvedServer = "";
        private string lastRawServer = "";
        private string lastTestedUser = "";
        private string lastTestedPassword = "";

        public MainForm()
        {
            InitializeUi();
            PopulateDetectedSqlServers();
        }

        private void InitializeUi()
        {
            this.SuspendLayout();

            this.Text = "SQL Server Cari Excel (.xlsx) Aktarım Aracı";
            this.ClientSize = new Size(980, 395);
            this.MinimumSize = new Size(860, 370);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.White;
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);

            try
            {
                this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch { }

            toolTip = new ToolTip();

            // Sol Panel Etiketler ve Kontroller (Görseldeki düzene birebir uygun)
            Label lblServer = new Label
            {
                Text = "Sunucu Adı",
                Location = new Point(10, 17),
                Size = new Size(80, 21),
                TextAlign = ContentAlignment.MiddleRight,
                ForeColor = Color.FromArgb(30, 58, 95)
            };

            cmbServer = new ComboBox
            {
                Location = new Point(96, 14),
                Size = new Size(218, 24),
                DropDownStyle = ComboBoxStyle.DropDown,
                Anchor = AnchorStyles.Top | AnchorStyles.Left
            };
            cmbServer.KeyDown += Input_KeyDown;

            Label lblUser = new Label
            {
                Text = "Kullanıcı Adı",
                Location = new Point(10, 50),
                Size = new Size(80, 21),
                TextAlign = ContentAlignment.MiddleRight,
                ForeColor = Color.FromArgb(30, 58, 95)
            };

            txtUser = new TextBox
            {
                Location = new Point(96, 47),
                Size = new Size(218, 23),
                Text = "sa",
                Anchor = AnchorStyles.Top | AnchorStyles.Left
            };
            txtUser.KeyDown += Input_KeyDown;
            toolTip.SetToolTip(txtUser, "SQL kullanıcı adı (Örn: sa). Windows Doğrulaması için boş bırakabilirsiniz.");

            Label lblPass = new Label
            {
                Text = "Parola",
                Location = new Point(10, 83),
                Size = new Size(58, 21),
                TextAlign = ContentAlignment.MiddleRight,
                ForeColor = Color.FromArgb(30, 58, 95)
            };

            chkShowPass = new CheckBox
            {
                Location = new Point(74, 86),
                Size = new Size(16, 16),
                Checked = false,
                Cursor = Cursors.Hand
            };
            chkShowPass.CheckedChanged += (s, e) =>
            {
                txtPassword.UseSystemPasswordChar = !chkShowPass.Checked;
            };
            toolTip.SetToolTip(chkShowPass, "Parolayı Göster / Gizle");

            txtPassword = new TextBox
            {
                Location = new Point(96, 81),
                Size = new Size(156, 23),
                UseSystemPasswordChar = true,
                Anchor = AnchorStyles.Top | AnchorStyles.Left
            };
            txtPassword.KeyDown += Input_KeyDown;

            btnTest = new Button
            {
                Text = "Sına",
                Location = new Point(258, 79),
                Size = new Size(56, 26),
                BackColor = Color.FromArgb(225, 225, 225),
                UseVisualStyleBackColor = true,
                Cursor = Cursors.Hand
            };
            btnTest.Click += BtnTest_Click;

            Label lblDb = new Label
            {
                Text = "Veritabanı",
                Location = new Point(10, 120),
                Size = new Size(80, 21),
                TextAlign = ContentAlignment.MiddleRight,
                ForeColor = Color.FromArgb(30, 58, 95)
            };

            lstDatabases = new ListBox
            {
                Location = new Point(96, 116),
                Size = new Size(218, 238),
                IntegralHeight = false,
                BorderStyle = BorderStyle.FixedSingle,
                BackColor = Color.White,
                Cursor = Cursors.Hand,
                Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left
            };
            lstDatabases.MouseClick += LstDatabases_MouseClick;
            lstDatabases.KeyDown += (s, e) =>
            {
                if (e.KeyCode == Keys.Enter || e.KeyCode == Keys.Space)
                {
                    AddSelectedDatabaseToRight();
                    e.Handled = true;
                }
            };
            toolTip.SetToolTip(lstDatabases, "Sağ tarafa atmak için listedeki veritabanına tıklayın.");

            // Sağ Panel (Seçilen Veritabanları Listesi)
            lstSelected = new ListBox
            {
                Location = new Point(324, 14),
                Size = new Size(642, 288),
                IntegralHeight = false,
                BorderStyle = BorderStyle.FixedSingle,
                BackColor = Color.White,
                Font = new Font("Consolas", 9.5F, FontStyle.Regular, GraphicsUnit.Point),
                HorizontalScrollbar = false,
                Cursor = Cursors.Hand,
                Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right
            };
            lstSelected.MouseClick += LstSelected_MouseClick;
            lstSelected.DoubleClick += (s, e) => RemoveSelectedFromRight();
            toolTip.SetToolTip(lstSelected, "Kaldırmak için satır başındaki [-] işaretine veya satıra çift tıklayın.");

            // Alt Aksiyon Çubuğu (Sağ listeye veri atılınca görünür olur)
            pnlExportBar = new Panel
            {
                Location = new Point(324, 310),
                Size = new Size(642, 44),
                Visible = false,
                Anchor = AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right
            };

            btnRemoveSelected = new Button
            {
                Text = "[-] Seçileni Çıkar",
                Location = new Point(0, 5),
                Size = new Size(132, 34),
                BackColor = Color.White,
                ForeColor = Color.FromArgb(185, 28, 28),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnRemoveSelected.FlatAppearance.BorderColor = Color.FromArgb(252, 165, 165);
            btnRemoveSelected.Click += (s, e) => RemoveSelectedFromRight();

            btnClearList = new Button
            {
                Text = "Listeyi Temizle",
                Location = new Point(140, 5),
                Size = new Size(122, 34),
                BackColor = Color.White,
                ForeColor = Color.FromArgb(71, 85, 105),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnClearList.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);
            btnClearList.Click += (s, e) =>
            {
                lstSelected.Items.Clear();
                UpdateExportBarVisibility();
                SetStatus("Seçilen veritabanı listesi temizlendi.", false);
            };

            btnExportExcel = new Button
            {
                Text = "Excel'e Aktar (.xlsx)",
                Location = new Point(422, 3),
                Size = new Size(220, 38),
                BackColor = Color.FromArgb(22, 163, 74),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 9.75F, FontStyle.Bold, GraphicsUnit.Point),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand,
                Anchor = AnchorStyles.Top | AnchorStyles.Right
            };
            btnExportExcel.FlatAppearance.BorderSize = 0;
            btnExportExcel.Click += BtnExportExcel_Click;

            pnlExportBar.Controls.Add(btnRemoveSelected);
            pnlExportBar.Controls.Add(btnClearList);
            pnlExportBar.Controls.Add(btnExportExcel);

            // Alt Durum Çubuğu
            lblStatus = new Label
            {
                Text = "Sunucu bilgilerini girip 'Sına' butonuna basın. (Şifresiz Windows oturumu için Kullanıcı Adı kutusunu boş bırakabilirsiniz)",
                Location = new Point(14, 364),
                Size = new Size(952, 22),
                ForeColor = Color.FromArgb(100, 116, 139),
                TextAlign = ContentAlignment.MiddleLeft,
                Anchor = AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right
            };

            this.Controls.Add(lblServer);
            this.Controls.Add(cmbServer);
            this.Controls.Add(lblUser);
            this.Controls.Add(txtUser);
            this.Controls.Add(lblPass);
            this.Controls.Add(chkShowPass);
            this.Controls.Add(txtPassword);
            this.Controls.Add(btnTest);
            this.Controls.Add(lblDb);
            this.Controls.Add(lstDatabases);
            this.Controls.Add(lstSelected);
            this.Controls.Add(pnlExportBar);
            this.Controls.Add(lblStatus);

            this.AutoScaleDimensions = new SizeF(96F, 96F);
            this.AutoScaleMode = AutoScaleMode.Dpi;
            this.ResumeLayout(false);
            this.PerformLayout();
        }

        internal void RunSelfTest(string outDir)
        {
            this.Show();
            Application.DoEvents();

            BtnTest_Click(this, EventArgs.Empty);
            Application.DoEvents();

            for (int i = 0; i < lstDatabases.Items.Count; i++)
            {
                string db = lstDatabases.Items[i].ToString();
                if (db.IndexOf("POLATLAR", StringComparison.OrdinalIgnoreCase) >= 0 ||
                    db.IndexOf("OSMANLI", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    lstDatabases.SelectedIndex = i;
                    AddSelectedDatabaseToRight();
                }
            }
            Application.DoEvents();

            using (var bmp = new Bitmap(this.Width, this.Height))
            {
                this.DrawToBitmap(bmp, new Rectangle(0, 0, this.Width, this.Height));
                bmp.Save(Path.Combine(outDir, "ui_preview.png"), ImageFormat.Png);
            }

            if (lstSelected.Items.Count > 0)
            {
                var first = (SelectedDbEntry)lstSelected.Items[0];
                var cariler = FetchCarilerFromDatabase(first);
                string xlsxPath = Path.Combine(outDir, "Cariler_" + SanitizeFileName(first.DatabaseName) + ".xlsx");
                XlsxWriter.WriteCarilerWorkbook(xlsxPath, cariler);
                File.WriteAllText(Path.Combine(outDir, "selftest_summary.txt"),
                    "DB=" + first.DatabaseName + " COUNT=" + cariler.Count + " XLSX=" + xlsxPath,
                    Encoding.UTF8);
            }
            this.Close();
        }

        private void Input_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Enter)
            {
                e.SuppressKeyPress = true;
                BtnTest_Click(sender, EventArgs.Empty);
            }
        }

        private void PopulateDetectedSqlServers()
        {
            string machine = Environment.MachineName;
            var items = new List<string>();

            try
            {
                ServiceController[] services = ServiceController.GetServices();
                foreach (ServiceController sc in services)
                {
                    if (string.Equals(sc.ServiceName, "MSSQLSERVER", StringComparison.OrdinalIgnoreCase))
                    {
                        AddUnique(items, machine + "\\MSSQLSERVER");
                        AddUnique(items, machine);
                    }
                    else if (sc.ServiceName.StartsWith("MSSQL$", StringComparison.OrdinalIgnoreCase))
                    {
                        string inst = sc.ServiceName.Substring(6);
                        AddUnique(items, machine + "\\" + inst);
                        AddUnique(items, ".\\" + inst);
                    }
                }
            }
            catch
            {
                // Servis listesi okunamazsa varsayılan adayları ekle
            }

            AddUnique(items, machine + "\\MSSQLSERVER");
            AddUnique(items, machine);
            AddUnique(items, machine + "\\SQLEXPRESS");
            AddUnique(items, ".\\SQLEXPRESS");
            AddUnique(items, "localhost");
            AddUnique(items, ".");

            cmbServer.Items.Clear();
            foreach (string s in items)
            {
                cmbServer.Items.Add(s);
            }
            if (cmbServer.Items.Count > 0)
            {
                cmbServer.SelectedIndex = 0;
            }
        }

        private static void AddUnique(List<string> list, string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return;
            if (!list.Any(x => string.Equals(x, value, StringComparison.OrdinalIgnoreCase)))
            {
                list.Add(value);
            }
        }

        private static List<string> GetServerCandidates(string rawServer)
        {
            var candidates = new List<string>();
            string trimmed = (rawServer ?? "").Trim();
            if (string.IsNullOrEmpty(trimmed))
            {
                trimmed = "localhost";
            }

            // <SUNUCU>\MSSQLSERVER varsayılan instance olduğu için önce <SUNUCU> olarak da dene
            if (trimmed.EndsWith("\\MSSQLSERVER", StringComparison.OrdinalIgnoreCase))
            {
                string hostPart = trimmed.Substring(0, trimmed.Length - "\\MSSQLSERVER".Length);
                if (!string.IsNullOrWhiteSpace(hostPart))
                {
                    AddUnique(candidates, hostPart);
                }
            }
            AddUnique(candidates, trimmed);

            if (string.Equals(trimmed, Environment.MachineName + "\\MSSQLSERVER", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(trimmed, Environment.MachineName, StringComparison.OrdinalIgnoreCase))
            {
                AddUnique(candidates, "localhost");
                AddUnique(candidates, ".");
            }

            return candidates;
        }

        private static string GetDisplayHost(string rawServer)
        {
            string trimmed = (rawServer ?? "").Trim();
            if (string.IsNullOrEmpty(trimmed) || trimmed == "." || string.Equals(trimmed, "localhost", StringComparison.OrdinalIgnoreCase))
            {
                return Environment.MachineName;
            }
            if (trimmed.EndsWith("\\MSSQLSERVER", StringComparison.OrdinalIgnoreCase))
            {
                return trimmed.Substring(0, trimmed.Length - "\\MSSQLSERVER".Length);
            }
            if (trimmed.StartsWith(".\\", StringComparison.OrdinalIgnoreCase))
            {
                return Environment.MachineName + trimmed.Substring(1);
            }
            return trimmed;
        }

        private static string BuildConnString(string server, string database, string user, string password, int timeoutSec)
        {
            var sb = new SqlConnectionStringBuilder
            {
                DataSource = server,
                InitialCatalog = database,
                ConnectTimeout = timeoutSec,
                TrustServerCertificate = true
            };

            if (string.IsNullOrWhiteSpace(user))
            {
                sb.IntegratedSecurity = true;
            }
            else
            {
                sb.IntegratedSecurity = false;
                sb.UserID = user.Trim();
                sb.Password = password ?? "";
            }

            return sb.ConnectionString;
        }

        private void BtnTest_Click(object sender, EventArgs e)
        {
            string rawSrv = cmbServer.Text.Trim();
            string user = txtUser.Text.Trim();
            string pass = txtPassword.Text;

            if (string.IsNullOrEmpty(rawSrv))
            {
                MessageBox.Show("Lütfen Sunucu Adı girin.", "Uyarı", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                cmbServer.Focus();
                return;
            }

            Cursor prevCursor = this.Cursor;
            this.Cursor = Cursors.WaitCursor;
            btnTest.Enabled = false;
            SetStatus("SQL Server bağlantısı sınanıyor...", false);
            Application.DoEvents();

            try
            {
                List<string> serverCandidates = GetServerCandidates(rawSrv);
                Exception lastEx = null;
                string workingServer = null;
                string effectiveUser = user;
                var databases = new List<string>();

                foreach (string candidate in serverCandidates)
                {
                    try
                    {
                        using (var conn = new SqlConnection(BuildConnString(candidate, "master", effectiveUser, pass, 4)))
                        {
                            conn.Open();
                            using (var cmd = conn.CreateCommand())
                            {
                                cmd.CommandText = "SELECT name FROM sys.databases WHERE database_id > 4 AND state = 0 ORDER BY name";
                                using (var reader = cmd.ExecuteReader())
                                {
                                    while (reader.Read())
                                    {
                                        databases.Add(reader.GetString(0));
                                    }
                                }
                            }
                        }
                        workingServer = candidate;
                        break;
                    }
                    catch (Exception ex)
                    {
                        lastEx = ex;
                    }
                }

                // Eğer kullanıcı 'sa' bıraktı ve parola boşsa ve SQL Auth başarısız olduysa,
                // yerel Windows Doğrulaması ile de otomatik dene (kullanıcıya kolaylık)
                if (workingServer == null && string.Equals(user, "sa", StringComparison.OrdinalIgnoreCase) && string.IsNullOrEmpty(pass))
                {
                    foreach (string candidate in serverCandidates)
                    {
                        try
                        {
                            using (var conn = new SqlConnection(BuildConnString(candidate, "master", "", "", 4)))
                            {
                                conn.Open();
                                using (var cmd = conn.CreateCommand())
                                {
                                    cmd.CommandText = "SELECT name FROM sys.databases WHERE database_id > 4 AND state = 0 ORDER BY name";
                                    using (var reader = cmd.ExecuteReader())
                                    {
                                        while (reader.Read())
                                        {
                                            databases.Add(reader.GetString(0));
                                        }
                                    }
                                }
                            }
                            workingServer = candidate;
                            effectiveUser = "";
                            break;
                        }
                        catch { }
                    }
                }

                if (workingServer == null)
                {
                    lstDatabases.Items.Clear();
                    string errDetail = lastEx != null ? lastEx.Message : "Bilinmeyen bağlantı hatası.";
                    SetStatus("Bağlantı başarısız oldu.", true);
                    MessageBox.Show(
                        "SQL Server sunucusuna bağlanılamadı!\n\n" +
                        "Sunucu: " + rawSrv + "\n" +
                        "Hata: " + errDetail + "\n\n" +
                        "İpucu: Şifresiz Windows oturumu ile bağlanmak istiyorsanız 'Kullanıcı Adı' kutusunu boş bırakıp 'Sına' butonuna basabilirsiniz.",
                        "SQL Bağlantı Hatası",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                    return;
                }

                lastRawServer = rawSrv;
                lastResolvedServer = workingServer;
                lastTestedUser = effectiveUser;
                lastTestedPassword = pass;

                lstDatabases.BeginUpdate();
                lstDatabases.Items.Clear();
                foreach (string db in databases)
                {
                    lstDatabases.Items.Add(db);
                }
                lstDatabases.EndUpdate();

                string authNote = string.IsNullOrEmpty(effectiveUser) ? "Windows Doğrulaması" : ("SQL Kullanıcısı: " + effectiveUser);
                SetStatus(
                    string.Format("Bağlantı başarılı ({0}) — {1} veritabanı bulundu. Sağ listeye atmak için veritabanına tıklayın.", authNote, databases.Count),
                    false
                );
            }
            finally
            {
                btnTest.Enabled = true;
                this.Cursor = prevCursor;
            }
        }

        private void LstDatabases_MouseClick(object sender, MouseEventArgs e)
        {
            int index = lstDatabases.IndexFromPoint(e.Location);
            if (index >= 0 && index < lstDatabases.Items.Count)
            {
                lstDatabases.SelectedIndex = index;
                AddSelectedDatabaseToRight();
            }
        }

        private void AddSelectedDatabaseToRight()
        {
            if (lstDatabases.SelectedItem == null) return;
            string dbName = lstDatabases.SelectedItem.ToString();
            if (string.IsNullOrWhiteSpace(dbName)) return;

            var entry = new SelectedDbEntry
            {
                RawServerInput = lastRawServer,
                ResolvedServer = string.IsNullOrEmpty(lastResolvedServer) ? cmbServer.Text.Trim() : lastResolvedServer,
                DisplayHost = GetDisplayHost(string.IsNullOrEmpty(lastRawServer) ? cmbServer.Text.Trim() : lastRawServer),
                DatabaseName = dbName,
                SqlUser = lastTestedUser,
                SqlPassword = lastTestedPassword
            };

            foreach (object existing in lstSelected.Items)
            {
                var exEntry = existing as SelectedDbEntry;
                if (exEntry != null && exEntry.Key == entry.Key)
                {
                    SetStatus(string.Format("'{0}' zaten sağdaki aktarım listesinde mevcut.", dbName), false);
                    return;
                }
            }

            lstSelected.Items.Add(entry);
            UpdateExportBarVisibility();
            SetStatus(
                string.Format("'{0}' sağ listeye eklendi. Carileri dışa aktarmak için 'Excel'e Aktar (.xlsx)' butonuna basın.", dbName),
                false
            );
        }

        private void LstSelected_MouseClick(object sender, MouseEventArgs e)
        {
            int index = lstSelected.IndexFromPoint(e.Location);
            int prefixWidth = TextRenderer.MeasureText("[-] ", lstSelected.Font).Width + 4;
            if (index >= 0 && index < lstSelected.Items.Count && e.X <= prefixWidth)
            {
                var removed = lstSelected.Items[index] as SelectedDbEntry;
                lstSelected.Items.RemoveAt(index);
                UpdateExportBarVisibility();
                if (removed != null)
                {
                    SetStatus(string.Format("'{0}' sağ listeden çıkarıldı.", removed.DatabaseName), false);
                }
            }
        }

        private void RemoveSelectedFromRight()
        {
            if (lstSelected.SelectedIndex >= 0)
            {
                var removed = lstSelected.SelectedItem as SelectedDbEntry;
                lstSelected.Items.RemoveAt(lstSelected.SelectedIndex);
                UpdateExportBarVisibility();
                if (removed != null)
                {
                    SetStatus(string.Format("'{0}' sağ listeden çıkarıldı.", removed.DatabaseName), false);
                }
            }
        }

        private void UpdateExportBarVisibility()
        {
            bool hasItems = lstSelected.Items.Count > 0;
            pnlExportBar.Visible = hasItems;
            if (hasItems)
            {
                btnExportExcel.Text = lstSelected.Items.Count == 1
                    ? "Excel'e Aktar (.xlsx)"
                    : string.Format("Excel'e Aktar ({0} Veritabanı)", lstSelected.Items.Count);
            }

            int maxWidth = 0;
            foreach (object item in lstSelected.Items)
            {
                int w = TextRenderer.MeasureText(item.ToString(), lstSelected.Font).Width + 16;
                if (w > maxWidth) maxWidth = w;
            }
            lstSelected.HorizontalExtent = maxWidth;
            lstSelected.HorizontalScrollbar = maxWidth > lstSelected.ClientSize.Width;
        }

        private void SetStatus(string text, bool isError)
        {
            lblStatus.ForeColor = isError ? Color.FromArgb(185, 28, 28) : Color.FromArgb(71, 85, 105);
            lblStatus.Text = text;
        }

        private void BtnExportExcel_Click(object sender, EventArgs e)
        {
            if (lstSelected.Items.Count == 0) return;

            var entries = lstSelected.Items.Cast<SelectedDbEntry>().ToList();
            string defaultDir = AppDomain.CurrentDomain.BaseDirectory;

            if (entries.Count == 1)
            {
                SelectedDbEntry item = entries[0];
                string safeDb = SanitizeFileName(item.DatabaseName);
                using (var sfd = new SaveFileDialog())
                {
                    sfd.Title = "Cari Excel Dosyasını Kaydet";
                    sfd.Filter = "Excel Çalışma Kitabı (*.xlsx)|*.xlsx";
                    sfd.InitialDirectory = Directory.Exists(defaultDir) ? defaultDir : Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
                    sfd.FileName = "Cariler_" + safeDb + ".xlsx";

                    if (sfd.ShowDialog(this) != DialogResult.OK) return;

                    ExportEntries(new Dictionary<SelectedDbEntry, string> { { item, sfd.FileName } });
                }
            }
            else
            {
                using (var fbd = new FolderBrowserDialog())
                {
                    fbd.Description = string.Format("Seçilen {0} veritabanının Excel (.xlsx) dosyalarının kaydedileceği klasörü seçin:", entries.Count);
                    fbd.SelectedPath = Directory.Exists(defaultDir) ? defaultDir : Environment.GetFolderPath(Environment.SpecialFolder.Desktop);

                    if (fbd.ShowDialog(this) != DialogResult.OK) return;

                    var targets = new Dictionary<SelectedDbEntry, string>();
                    foreach (SelectedDbEntry entry in entries)
                    {
                        string safeDb = SanitizeFileName(entry.DatabaseName);
                        targets[entry] = Path.Combine(fbd.SelectedPath, "Cariler_" + safeDb + ".xlsx");
                    }
                    ExportEntries(targets);
                }
            }
        }

        private void ExportEntries(Dictionary<SelectedDbEntry, string> targets)
        {
            Cursor prevCursor = this.Cursor;
            this.Cursor = Cursors.WaitCursor;
            btnExportExcel.Enabled = false;
            SetStatus("Veritabanından cariler okunuyor ve Excel hazırlanıyor...", false);
            Application.DoEvents();

            var summaryLines = new List<string>();
            var exportedFiles = new List<string>();
            var errors = new List<string>();

            try
            {
                foreach (var kvp in targets)
                {
                    SelectedDbEntry entry = kvp.Key;
                    string outPath = kvp.Value;

                    try
                    {
                        List<string> cariler = FetchCarilerFromDatabase(entry);
                        if (cariler == null)
                        {
                            continue;
                        }
                        if (cariler.Count == 0)
                        {
                            errors.Add(entry.DatabaseName + ": Tabloda kayıtlı cari bulunamadı.");
                            continue;
                        }

                        XlsxWriter.WriteCarilerWorkbook(outPath, cariler);
                        exportedFiles.Add(outPath);
                        summaryLines.Add(string.Format("• {0}: {1:N0} adet Cari -> {2}", entry.DatabaseName, cariler.Count, Path.GetFileName(outPath)));
                    }
                    catch (Exception ex)
                    {
                        errors.Add(entry.DatabaseName + ": " + ex.Message);
                    }
                }
            }
            finally
            {
                btnExportExcel.Enabled = true;
                this.Cursor = prevCursor;
            }

            if (exportedFiles.Count > 0)
            {
                SetStatus(string.Format("Aktarım tamamlandı! {0} adet Excel dosyası oluşturuldu.", exportedFiles.Count), false);

                string msg = "Excel aktarımı başarıyla tamamlandı!\n\n" + string.Join("\n", summaryLines);
                if (errors.Count > 0)
                {
                    msg += "\n\nUyarılar:\n" + string.Join("\n", errors);
                }
                msg += "\n\nOluşturulan dosyanın klasörünü açmak ister misiniz?";

                if (MessageBox.Show(this, msg, "Excel Aktarımı Başarılı", MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
                {
                    try
                    {
                        System.Diagnostics.Process.Start("explorer.exe", "/select,\"" + exportedFiles[0] + "\"");
                    }
                    catch { }
                }
            }
            else if (errors.Count > 0)
            {
                SetStatus("Aktarım sırasında hata oluştu.", true);
                MessageBox.Show(this, "Aktarım tamamlanamadı:\n\n" + string.Join("\n", errors), "Aktarım Hatası", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private List<string> FetchCarilerFromDatabase(SelectedDbEntry entry)
        {
            using (var conn = new SqlConnection(BuildConnString(entry.ResolvedServer, entry.DatabaseName, entry.SqlUser, entry.SqlPassword, 10)))
            {
                conn.Open();

                string targetSchema = null;
                string targetTable = null;
                string targetColumn = null;

                // 1. Bilinen ERP Cari tablolarını ve Cari Adı sütunlarını otomatik tara
                const string detectSql = @"
SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('CARI', 'CARILER', 'CARI_HESAPLAR', 'TBLCASABIT', 'CARIHESAP', 'CARI_KART', 'FIRMALAR', 'MUSTERILER')
   OR TABLE_NAME LIKE 'LG_%_CLCARD'
ORDER BY TABLE_NAME, ORDINAL_POSITION";

                var candidates = new List<Tuple<string, string, string>>();
                using (var cmd = new SqlCommand(detectSql, conn))
                using (var r = cmd.ExecuteReader())
                {
                    while (r.Read())
                    {
                        candidates.Add(Tuple.Create(r.GetString(0), r.GetString(1), r.GetString(2)));
                    }
                }

                string[] preferredCols = new[]
                {
                    "AD", "UNVAN", "CARI_UNVAN", "CARI_ADI", "CARI_ISIM",
                    "TICARI_UNVANI", "cari_unvan1", "DEFINITION_", "UNVANI",
                    "FIRMA_ADI", "FIRMAADI", "ADI_SOYADI", "ISIM"
                };

                foreach (string pref in preferredCols)
                {
                    var match = candidates.FirstOrDefault(c => string.Equals(c.Item3, pref, StringComparison.OrdinalIgnoreCase));
                    if (match != null)
                    {
                        targetSchema = match.Item1;
                        targetTable = match.Item2;
                        targetColumn = match.Item3;
                        break;
                    }
                }

                // 2. Özel bir veritabanıysa kullanıcıya Tablo & Sütun seçtir
                if (targetTable == null)
                {
                    using (var picker = new TableColumnPickerDialog(conn, entry.DatabaseName))
                    {
                        if (picker.ShowDialog(this) != DialogResult.OK)
                        {
                            return null;
                        }
                        targetSchema = picker.SelectedSchema;
                        targetTable = picker.SelectedTable;
                        targetColumn = picker.SelectedColumn;
                    }
                }

                string qSchema = targetSchema.Replace("]", "]]");
                string qTable = targetTable.Replace("]", "]]");
                string qCol = targetColumn.Replace("]", "]]");

                string query = string.Format(
                    "SELECT DISTINCT LTRIM(RTRIM(CAST([{2}] AS NVARCHAR(500)))) AS CariAdi " +
                    "FROM [{0}].[{1}] " +
                    "WHERE [{2}] IS NOT NULL AND LTRIM(RTRIM(CAST([{2}] AS NVARCHAR(500)))) <> ''",
                    qSchema, qTable, qCol
                );

                var uniqueSet = new HashSet<string>(StringComparer.Create(new CultureInfo("tr-TR"), true));
                var result = new List<string>();

                using (var dataCmd = new SqlCommand(query, conn))
                {
                    dataCmd.CommandTimeout = 60;
                    using (var reader = dataCmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            if (!reader.IsDBNull(0))
                            {
                                string val = reader.GetString(0).Trim();
                                if (val.Length > 0 && uniqueSet.Add(val))
                                {
                                    result.Add(val);
                                }
                            }
                        }
                    }
                }

                result.Sort(StringComparer.Create(new CultureInfo("tr-TR"), true));
                return result;
            }
        }

        private static string SanitizeFileName(string name)
        {
            foreach (char c in Path.GetInvalidFileNameChars())
            {
                name = name.Replace(c, '_');
            }
            return name;
        }
    }

    internal sealed class TableColumnPickerDialog : Form
    {
        public string SelectedSchema { get; private set; }
        public string SelectedTable { get; private set; }
        public string SelectedColumn { get; private set; }

        private readonly SqlConnection conn;
        private ComboBox cmbTables;
        private ComboBox cmbColumns;
        private List<Tuple<string, string>> tables = new List<Tuple<string, string>>();

        public TableColumnPickerDialog(SqlConnection connection, string dbName)
        {
            this.SuspendLayout();
            this.conn = connection;
            this.Text = dbName + " - Cari Tablo ve Sütun Seçimi";
            this.ClientSize = new Size(440, 185);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.StartPosition = FormStartPosition.CenterParent;
            this.Font = new Font("Segoe UI", 9F);

            var lblInfo = new Label
            {
                Text = "'" + dbName + "' veritabanında standart Cari tablosu bulunamadı.\nLütfen Cari tablosunu ve Cari Adı sütununu seçin:",
                Location = new Point(14, 12),
                Size = new Size(412, 38)
            };

            var lblTbl = new Label { Text = "Tablo:", Location = new Point(14, 60), Size = new Size(80, 22) };
            cmbTables = new ComboBox { Location = new Point(100, 57), Size = new Size(324, 24), DropDownStyle = ComboBoxStyle.DropDownList };
            cmbTables.SelectedIndexChanged += CmbTables_SelectedIndexChanged;

            var lblCol = new Label { Text = "Cari Sütunu:", Location = new Point(14, 96), Size = new Size(80, 22) };
            cmbColumns = new ComboBox { Location = new Point(100, 93), Size = new Size(324, 24), DropDownStyle = ComboBoxStyle.DropDownList };

            var btnOk = new Button { Text = "Devam Et", Location = new Point(248, 136), Size = new Size(90, 32), DialogResult = DialogResult.OK };
            var btnCancel = new Button { Text = "İptal", Location = new Point(344, 136), Size = new Size(80, 32), DialogResult = DialogResult.Cancel };

            btnOk.Click += (s, e) =>
            {
                if (cmbTables.SelectedIndex >= 0 && cmbColumns.SelectedItem != null)
                {
                    SelectedSchema = tables[cmbTables.SelectedIndex].Item1;
                    SelectedTable = tables[cmbTables.SelectedIndex].Item2;
                    SelectedColumn = cmbColumns.SelectedItem.ToString();
                }
                else
                {
                    this.DialogResult = DialogResult.None;
                }
            };

            this.Controls.AddRange(new Control[] { lblInfo, lblTbl, cmbTables, lblCol, cmbColumns, btnOk, btnCancel });
            this.AcceptButton = btnOk;
            this.CancelButton = btnCancel;
            this.AutoScaleDimensions = new SizeF(96F, 96F);
            this.AutoScaleMode = AutoScaleMode.Dpi;
            this.ResumeLayout(false);

            LoadTables();
        }

        private void LoadTables()
        {
            using (var cmd = new SqlCommand("SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME", conn))
            using (var r = cmd.ExecuteReader())
            {
                while (r.Read())
                {
                    string s = r.GetString(0);
                    string t = r.GetString(1);
                    tables.Add(Tuple.Create(s, t));
                    cmbTables.Items.Add(s + "." + t);
                }
            }
            if (cmbTables.Items.Count > 0) cmbTables.SelectedIndex = 0;
        }

        private void CmbTables_SelectedIndexChanged(object sender, EventArgs e)
        {
            cmbColumns.Items.Clear();
            if (cmbTables.SelectedIndex < 0) return;

            var item = tables[cmbTables.SelectedIndex];
            using (var cmd = new SqlCommand("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@s AND TABLE_NAME=@t ORDER BY ORDINAL_POSITION", conn))
            {
                cmd.Parameters.AddWithValue("@s", item.Item1);
                cmd.Parameters.AddWithValue("@t", item.Item2);
                using (var r = cmd.ExecuteReader())
                {
                    while (r.Read())
                    {
                        cmbColumns.Items.Add(r.GetString(0));
                    }
                }
            }
            if (cmbColumns.Items.Count > 0) cmbColumns.SelectedIndex = 0;
        }
    }

    internal static class XlsxWriter
    {
        private static readonly Regex InvalidXmlChars = new Regex(@"[\x00-\x08\x0B\x0C\x0E-\x1F]", RegexOptions.Compiled);

        public static void WriteCarilerWorkbook(string outputPath, IList<string> cariList)
        {
            if (File.Exists(outputPath))
            {
                File.Delete(outputPath);
            }

            Encoding utf8NoBom = new UTF8Encoding(false);

            const string contentTypesXml =
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
                "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
                "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
                "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>" +
                "<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>" +
                "<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>" +
                "</Types>";

            const string relsXml =
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>" +
                "</Relationships>";

            const string workbookXml =
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">" +
                "<sheets><sheet name=\"Cariler\" sheetId=\"1\" r:id=\"rId1\"/></sheets>" +
                "</workbook>";

            const string workbookRelsXml =
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>" +
                "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>" +
                "</Relationships>";

            const string stylesXml =
                "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
                "<fonts count=\"2\">" +
                "<font><sz val=\"10\"/><color rgb=\"FF0F172A\"/><name val=\"Segoe UI\"/></font>" +
                "<font><b/><sz val=\"11\"/><color rgb=\"FFFFFFFF\"/><name val=\"Segoe UI\"/></font>" +
                "</fonts>" +
                "<fills count=\"3\">" +
                "<fill><patternFill patternType=\"none\"/></fill>" +
                "<fill><patternFill patternType=\"gray125\"/></fill>" +
                "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF1E3A8A\"/><bgColor indexed=\"64\"/></patternFill></fill>" +
                "</fills>" +
                "<borders count=\"2\">" +
                "<border><left/><right/><top/><bottom/><diagonal/></border>" +
                "<border>" +
                "<left style=\"thin\"><color rgb=\"FFE2E8F0\"/></left>" +
                "<right style=\"thin\"><color rgb=\"FFE2E8F0\"/></right>" +
                "<top style=\"thin\"><color rgb=\"FFE2E8F0\"/></top>" +
                "<bottom style=\"thin\"><color rgb=\"FFE2E8F0\"/></bottom>" +
                "<diagonal/>" +
                "</border>" +
                "</borders>" +
                "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>" +
                "<cellXfs count=\"3\">" +
                "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>" +
                "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyAlignment=\"1\"><alignment horizontal=\"left\" vertical=\"center\"/></xf>" +
                "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment horizontal=\"left\" vertical=\"center\"/></xf>" +
                "</cellXfs>" +
                "<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>" +
                "</styleSheet>";

            int maxLen = 12;
            foreach (string s in cariList)
            {
                if (s != null && s.Length > maxLen) maxLen = s.Length;
            }
            int colWidth = Math.Min(Math.Max(maxLen + 5, 35), 90);

            var sb = new StringBuilder(Math.Max(4096, cariList.Count * 96));
            sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
            sb.Append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">");
            sb.AppendFormat(CultureInfo.InvariantCulture, "<cols><col min=\"1\" max=\"1\" width=\"{0}\" customWidth=\"1\"/></cols>", colWidth);
            sb.Append("<sheetData>");
            sb.Append("<row r=\"1\" ht=\"26\" customHeight=\"1\"><c r=\"A1\" s=\"1\" t=\"inlineStr\"><is><t>Cari Adı</t></is></c></row>");

            int rowNum = 2;
            foreach (string item in cariList)
            {
                string clean = CleanXml(item);
                sb.AppendFormat(
                    CultureInfo.InvariantCulture,
                    "<row r=\"{0}\" ht=\"20\" customHeight=\"1\"><c r=\"A{0}\" s=\"2\" t=\"inlineStr\"><is><t xml:space=\"preserve\">{1}</t></is></c></row>",
                    rowNum,
                    clean
                );
                rowNum++;
            }
            sb.Append("</sheetData></worksheet>");

            using (var fs = new FileStream(outputPath, FileMode.Create, FileAccess.ReadWrite, FileShare.None))
            using (var zip = new ZipArchive(fs, ZipArchiveMode.Create, false))
            {
                WriteEntry(zip, "[Content_Types].xml", contentTypesXml, utf8NoBom);
                WriteEntry(zip, "_rels/.rels", relsXml, utf8NoBom);
                WriteEntry(zip, "xl/workbook.xml", workbookXml, utf8NoBom);
                WriteEntry(zip, "xl/_rels/workbook.xml.rels", workbookRelsXml, utf8NoBom);
                WriteEntry(zip, "xl/styles.xml", stylesXml, utf8NoBom);
                WriteEntry(zip, "xl/worksheets/sheet1.xml", sb.ToString(), utf8NoBom);
            }
        }

        private static string CleanXml(string text)
        {
            if (string.IsNullOrEmpty(text)) return "";
            string stripped = InvalidXmlChars.Replace(text, "");
            return SecurityElement.Escape(stripped) ?? "";
        }

        private static void WriteEntry(ZipArchive zip, string entryPath, string content, Encoding encoding)
        {
            ZipArchiveEntry entry = zip.CreateEntry(entryPath, CompressionLevel.Optimal);
            using (var stream = entry.Open())
            using (var writer = new StreamWriter(stream, encoding))
            {
                writer.Write(content);
            }
        }
    }
}
