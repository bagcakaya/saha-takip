using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Data;
using System.Data.SqlClient;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security;
using System.ServiceProcess;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using System.Windows.Shell;
using System.Windows.Threading;
using Microsoft.Win32;
using WinForms = System.Windows.Forms;

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

            var app = new Application();
            app.ShutdownMode = ShutdownMode.OnMainWindowClose;

            var mainWindow = new StudioMainWindow();
            app.MainWindow = mainWindow;

            if (args != null && args.Length >= 2 && string.Equals(args[0], "--selftest", StringComparison.OrdinalIgnoreCase))
            {
                string outDir = args[1];
                Directory.CreateDirectory(outDir);
                mainWindow.Loaded += delegate
                {
                    mainWindow.Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(delegate
                    {
                        mainWindow.RunSelfTest(outDir);
                    }));
                };
            }

            app.Run(mainWindow);
        }
    }

    public sealed class DiscoveredDatabaseItem : INotifyPropertyChanged
    {
        private bool isQueued;

        public string Name { get; set; }

        public bool IsQueued
        {
            get { return isQueued; }
            set
            {
                if (isQueued != value)
                {
                    isQueued = value;
                    OnPropertyChanged("IsQueued");
                    OnPropertyChanged("BadgeText");
                    OnPropertyChanged("BadgeBackground");
                    OnPropertyChanged("BadgeForeground");
                    OnPropertyChanged("BadgeBorder");
                    OnPropertyChanged("IconBrush");
                }
            }
        }

        public string BadgeText
        {
            get { return isQueued ? "✓ Kuyrukta" : "+ Ekle"; }
        }

        public Brush BadgeBackground
        {
            get { return isQueued ? StudioPalette.EmeraldSoftBg : StudioPalette.SlatePillBg; }
        }

        public Brush BadgeForeground
        {
            get { return isQueued ? StudioPalette.EmeraldBright : StudioPalette.SkyBright; }
        }

        public Brush BadgeBorder
        {
            get { return isQueued ? StudioPalette.EmeraldBorder : StudioPalette.SlatePillBorder; }
        }

        public Brush IconBrush
        {
            get { return isQueued ? StudioPalette.EmeraldBright : StudioPalette.SkyBright; }
        }

        public event PropertyChangedEventHandler PropertyChanged;

        private void OnPropertyChanged(string propName)
        {
            var handler = PropertyChanged;
            if (handler != null) handler(this, new PropertyChangedEventArgs(propName));
        }
    }

    public sealed class SelectedDbEntry : INotifyPropertyChanged
    {
        private string scanBadgeText;
        private Brush scanBadgeBg;
        private Brush scanBadgeFg;
        private Brush scanBadgeBorder;
        private int detectedCount;
        private bool scanCompleted;
        private string customSchema;
        private string customTable;
        private string customColumn;

        public SelectedDbEntry()
        {
            scanBadgeText = "⟳ Cari tablosu taranıyor...";
            scanBadgeBg = StudioPalette.SkySoftBg;
            scanBadgeFg = StudioPalette.SkyBright;
            scanBadgeBorder = StudioPalette.SkyBorder;
            detectedCount = -1;
        }

        public string RawServerInput { get; set; }
        public string ResolvedServer { get; set; }
        public string DisplayHost { get; set; }
        public string DatabaseName { get; set; }
        public string SqlUser { get; set; }
        public string SqlPassword { get; set; }

        public string CustomSchema
        {
            get { return customSchema; }
            set { customSchema = value; }
        }

        public string CustomTable
        {
            get { return customTable; }
            set { customTable = value; }
        }

        public string CustomColumn
        {
            get { return customColumn; }
            set { customColumn = value; }
        }

        public int DetectedCount
        {
            get { return detectedCount; }
            set
            {
                detectedCount = value;
                OnPropertyChanged("DetectedCount");
            }
        }

        public bool ScanCompleted
        {
            get { return scanCompleted; }
            set
            {
                scanCompleted = value;
                OnPropertyChanged("ScanCompleted");
            }
        }

        public string Key
        {
            get { return (DisplayHost + ">" + DatabaseName).ToUpperInvariant(); }
        }

        public string TitleLine
        {
            get { return string.Format("{0}  ›  {1}", DisplayHost, DatabaseName); }
        }

        public string ServerTag
        {
            get { return string.Format("Sunucu: {0}", DisplayHost); }
        }

        public string DatabaseTag
        {
            get { return string.Format("Veritabanı: {0}", DatabaseName); }
        }

        public string OutputFileTag
        {
            get { return string.Format("Cariler_{0}.xlsx", StudioMainWindow.SanitizeFileName(DatabaseName)); }
        }

        public string ScanBadgeText
        {
            get { return scanBadgeText; }
            set
            {
                scanBadgeText = value;
                OnPropertyChanged("ScanBadgeText");
            }
        }

        public Brush ScanBadgeBg
        {
            get { return scanBadgeBg; }
            set
            {
                scanBadgeBg = value;
                OnPropertyChanged("ScanBadgeBg");
            }
        }

        public Brush ScanBadgeFg
        {
            get { return scanBadgeFg; }
            set
            {
                scanBadgeFg = value;
                OnPropertyChanged("ScanBadgeFg");
            }
        }

        public Brush ScanBadgeBorder
        {
            get { return scanBadgeBorder; }
            set
            {
                scanBadgeBorder = value;
                OnPropertyChanged("ScanBadgeBorder");
            }
        }

        public event PropertyChangedEventHandler PropertyChanged;

        private void OnPropertyChanged(string propName)
        {
            var handler = PropertyChanged;
            if (handler != null) handler(this, new PropertyChangedEventArgs(propName));
        }
    }

    internal static class StudioPalette
    {
        public static readonly Brush EmeraldBright = FreezeBrush("#34D399");
        public static readonly Brush EmeraldSoftBg = FreezeBrush("#1810B981");
        public static readonly Brush EmeraldBorder = FreezeBrush("#4510B981");

        public static readonly Brush SkyBright = FreezeBrush("#38BDF8");
        public static readonly Brush SkySoftBg = FreezeBrush("#180EA5E9");
        public static readonly Brush SkyBorder = FreezeBrush("#450EA5E9");

        public static readonly Brush AmberBright = FreezeBrush("#FBBF24");
        public static readonly Brush AmberSoftBg = FreezeBrush("#1CF59E0B");
        public static readonly Brush AmberBorder = FreezeBrush("#50F59E0B");

        public static readonly Brush RoseBright = FreezeBrush("#FB7185");
        public static readonly Brush RoseSoftBg = FreezeBrush("#1EF43F5E");
        public static readonly Brush RoseBorder = FreezeBrush("#55F43F5E");

        public static readonly Brush SlateMuted = FreezeBrush("#94A3B8");
        public static readonly Brush SlatePillBg = FreezeBrush("#1A38BDF8");
        public static readonly Brush SlatePillBorder = FreezeBrush("#3338BDF8");

        public static SolidColorBrush FreezeBrush(string hex)
        {
            var brush = (SolidColorBrush)new BrushConverter().ConvertFromString(hex);
            brush.Freeze();
            return brush;
        }
    }

    internal sealed class StudioMainWindow : Window
    {
        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

        private const string WindowXaml = @"
<Grid xmlns='http://schemas.microsoft.com/winfx/2006/xaml/presentation'
      xmlns:x='http://schemas.microsoft.com/winfx/2006/xaml'
      Background='#070C16'>
    <Grid.Resources>
        <!-- İnce Modern Kaydırma Çubuğu -->
        <Style TargetType='{x:Type ScrollBar}'>
            <Setter Property='Width' Value='7'/>
            <Setter Property='Background' Value='Transparent'/>
            <Setter Property='Template'>
                <Setter.Value>
                    <ControlTemplate TargetType='{x:Type ScrollBar}'>
                        <Grid Background='Transparent' Width='7' Margin='1,2,1,2'>
                            <Track x:Name='PART_Track' IsDirectionReversed='True'>
                                <Track.Thumb>
                                    <Thumb>
                                        <Thumb.Template>
                                            <ControlTemplate TargetType='{x:Type Thumb}'>
                                                <Border Background='#2A3B54' CornerRadius='3.5'/>
                                            </ControlTemplate>
                                        </Thumb.Template>
                                    </Thumb>
                                </Track.Thumb>
                            </Track>
                        </Grid>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>

        <!-- Özel Koyu Düzenlenebilir ComboBox Şablonu -->
        <ControlTemplate x:Key='DarkComboBoxToggleButton' TargetType='{x:Type ToggleButton}'>
            <Border x:Name='Bd' Background='#0A1120' BorderBrush='#22314A' BorderThickness='1' CornerRadius='9'>
                <Grid>
                    <Grid.ColumnDefinitions>
                        <ColumnDefinition Width='*'/>
                        <ColumnDefinition Width='32'/>
                    </Grid.ColumnDefinitions>
                    <Border Grid.Column='1' Background='#101B2E' CornerRadius='0,8,8,0' BorderBrush='#1D2A40' BorderThickness='1,0,0,0'>
                        <Path Data='M 0 0 L 4.5 4.5 L 9 0' Stroke='#7DD3FC' StrokeThickness='1.6'
                              HorizontalAlignment='Center' VerticalAlignment='Center'/>
                    </Border>
                </Grid>
            </Border>
            <ControlTemplate.Triggers>
                <Trigger Property='IsMouseOver' Value='True'>
                    <Setter TargetName='Bd' Property='BorderBrush' Value='#38BDF8'/>
                </Trigger>
                <Trigger Property='IsChecked' Value='True'>
                    <Setter TargetName='Bd' Property='BorderBrush' Value='#0EA5E9'/>
                </Trigger>
            </ControlTemplate.Triggers>
        </ControlTemplate>

        <Style x:Key='DarkStudioComboBox' TargetType='{x:Type ComboBox}'>
            <Setter Property='Foreground' Value='#F8FAFC'/>
            <Setter Property='FontFamily' Value='Segoe UI Semibold'/>
            <Setter Property='FontSize' Value='12.5'/>
            <Setter Property='Height' Value='36'/>
            <Setter Property='SnapsToDevicePixels' Value='True'/>
            <Setter Property='Template'>
                <Setter.Value>
                    <ControlTemplate TargetType='{x:Type ComboBox}'>
                        <Grid>
                            <ToggleButton Name='ToggleButton'
                                          Template='{StaticResource DarkComboBoxToggleButton}'
                                          Focusable='False'
                                          ClickMode='Press'
                                          IsChecked='{Binding Path=IsDropDownOpen, Mode=TwoWay, RelativeSource={RelativeSource TemplatedParent}}'/>
                            <!-- Sol Sunucu İkonu -->
                            <Path Data='M3,5 C3,3.9 3.9,3 5,3 L15,3 C16.1,3 17,3.9 17,5 L17,8 C17,9.1 16.1,10 15,10 L5,10 C3.9,10 3,9.1 3,8 Z M3,13 C3,11.9 3.9,11 5,11 L15,11 C16.1,11 17,11.9 17,13 L17,16 C17,17.1 16.1,18 15,18 L5,18 C3.9,18 3,17.1 3,16 Z'
                                  Stroke='#38BDF8' StrokeThickness='1.3' Width='15' Height='15' Stretch='Uniform'
                                  HorizontalAlignment='Left' VerticalAlignment='Center' Margin='11,0,0,0' IsHitTestVisible='False'/>
                            <TextBox x:Name='PART_EditableTextBox'
                                     HorizontalAlignment='Stretch'
                                     VerticalAlignment='Center'
                                     Margin='32,3,36,3'
                                     Background='Transparent'
                                     Foreground='#F8FAFC'
                                     CaretBrush='#38BDF8'
                                     SelectionBrush='#0284C7'
                                     BorderThickness='0'
                                     Focusable='True'
                                     IsReadOnly='{TemplateBinding IsReadOnly}'/>
                            <Popup Name='Popup'
                                   Placement='Bottom'
                                   IsOpen='{TemplateBinding IsDropDownOpen}'
                                   AllowsTransparency='True'
                                   Focusable='False'
                                   PopupAnimation='Fade'>
                                <Border Name='DropDownBorder'
                                        MinWidth='{TemplateBinding ActualWidth}'
                                        MaxHeight='240'
                                        Margin='0,4,0,0'
                                        Background='#0E1729'
                                        BorderBrush='#2B3F5C'
                                        BorderThickness='1'
                                        CornerRadius='10'>
                                    <Border.Effect>
                                        <DropShadowEffect Color='#000000' BlurRadius='18' ShadowDepth='6' Opacity='0.65'/>
                                    </Border.Effect>
                                    <ScrollViewer Margin='4' SnapsToDevicePixels='True'>
                                        <StackPanel IsItemsHost='True' KeyboardNavigation.DirectionalNavigation='Contained'/>
                                    </ScrollViewer>
                                </Border>
                            </Popup>
                        </Grid>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
            <Setter Property='ItemContainerStyle'>
                <Setter.Value>
                    <Style TargetType='{x:Type ComboBoxItem}'>
                        <Setter Property='Foreground' Value='#E2E8F0'/>
                        <Setter Property='Padding' Value='10,7'/>
                        <Setter Property='Cursor' Value='Hand'/>
                        <Setter Property='Template'>
                            <Setter.Value>
                                <ControlTemplate TargetType='{x:Type ComboBoxItem}'>
                                    <Border x:Name='ItemBd' Background='Transparent' CornerRadius='6' Padding='{TemplateBinding Padding}'>
                                        <ContentPresenter/>
                                    </Border>
                                    <ControlTemplate.Triggers>
                                        <Trigger Property='IsHighlighted' Value='True'>
                                            <Setter TargetName='ItemBd' Property='Background' Value='#1B2B45'/>
                                            <Setter Property='Foreground' Value='#38BDF8'/>
                                        </Trigger>
                                        <Trigger Property='IsSelected' Value='True'>
                                            <Setter TargetName='ItemBd' Property='Background' Value='#162844'/>
                                            <Setter Property='Foreground' Value='#34D399'/>
                                        </Trigger>
                                    </ControlTemplate.Triggers>
                                </ControlTemplate>
                            </Setter.Value>
                        </Setter>
                    </Style>
                </Setter.Value>
            </Setter>
        </Style>

        <!-- Pencere Kontrol Butonu -->
        <Style x:Key='WinCtrlBtn' TargetType='{x:Type Button}'>
            <Setter Property='Width' Value='34'/>
            <Setter Property='Height' Value='28'/>
            <Setter Property='Background' Value='Transparent'/>
            <Setter Property='Foreground' Value='#94A3B8'/>
            <Setter Property='BorderThickness' Value='0'/>
            <Setter Property='Cursor' Value='Hand'/>
            <Setter Property='Template'>
                <Setter.Value>
                    <ControlTemplate TargetType='{x:Type Button}'>
                        <Border x:Name='Bd' Background='{TemplateBinding Background}' CornerRadius='7'>
                            <ContentPresenter HorizontalAlignment='Center' VerticalAlignment='Center'/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property='IsMouseOver' Value='True'>
                                <Setter TargetName='Bd' Property='Background' Value='#1E293B'/>
                                <Setter Property='Foreground' Value='#F8FAFC'/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>

        <Style x:Key='WinCloseBtn' TargetType='{x:Type Button}' BasedOn='{StaticResource WinCtrlBtn}'>
            <Setter Property='Template'>
                <Setter.Value>
                    <ControlTemplate TargetType='{x:Type Button}'>
                        <Border x:Name='Bd' Background='Transparent' CornerRadius='7'>
                            <ContentPresenter HorizontalAlignment='Center' VerticalAlignment='Center'/>
                        </Border>
                        <ControlTemplate.Triggers>
                            <Trigger Property='IsMouseOver' Value='True'>
                                <Setter TargetName='Bd' Property='Background' Value='#E11D48'/>
                                <Setter Property='Foreground' Value='#FFFFFF'/>
                            </Trigger>
                        </ControlTemplate.Triggers>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
    </Grid.Resources>

    <!-- Arka Plan Mimari Ambient Işık Dokusu -->
    <Canvas IsHitTestVisible='False' ClipToBounds='True'>
        <Ellipse Width='540' Height='340' Canvas.Left='-140' Canvas.Top='-120' Opacity='0.22'>
            <Ellipse.Fill>
                <RadialGradientBrush>
                    <GradientStop Color='#0D9488' Offset='0'/>
                    <GradientStop Color='#000D9488' Offset='1'/>
                </RadialGradientBrush>
            </Ellipse.Fill>
        </Ellipse>
        <Ellipse Width='620' Height='420' Canvas.Right='-180' Canvas.Bottom='-160' Opacity='0.18'>
            <Ellipse.Fill>
                <RadialGradientBrush>
                    <GradientStop Color='#2563EB' Offset='0'/>
                    <GradientStop Color='#002563EB' Offset='1'/>
                </RadialGradientBrush>
            </Ellipse.Fill>
        </Ellipse>
    </Canvas>

    <!-- Dış Çerçeve -->
    <Border BorderBrush='#1E2D45' BorderThickness='1'>
        <Grid>
            <Grid.RowDefinitions>
                <RowDefinition Height='66'/>
                <RowDefinition Height='*'/>
                <RowDefinition Height='34'/>
            </Grid.RowDefinitions>

            <!-- ==================== 1. ÜST STÜDYO BAŞLIK ÇUBUĞU ==================== -->
            <Border x:Name='HeaderBar' Grid.Row='0' Background='#0B1220' BorderBrush='#192538' BorderThickness='0,0,0,1'>
                <Grid Margin='18,0,12,0'>
                    <Grid.ColumnDefinitions>
                        <ColumnDefinition Width='Auto'/>
                        <ColumnDefinition Width='*'/>
                        <ColumnDefinition Width='Auto'/>
                        <ColumnDefinition Width='Auto'/>
                    </Grid.ColumnDefinitions>

                    <!-- Sol Marka & Amblem -->
                    <StackPanel Grid.Column='0' Orientation='Horizontal' VerticalAlignment='Center'>
                        <Border Width='40' Height='40' CornerRadius='11' BorderBrush='#5534D399' BorderThickness='1' Margin='0,0,13,0'>
                            <Border.Background>
                                <LinearGradientBrush StartPoint='0,0' EndPoint='1,1'>
                                    <GradientStop Color='#0F766E' Offset='0'/>
                                    <GradientStop Color='#059669' Offset='0.55'/>
                                    <GradientStop Color='#0284C7' Offset='1'/>
                                </LinearGradientBrush>
                            </Border.Background>
                            <Grid>
                                <Path Data='M4,6 C4,4.3 7.1,3 11,3 C14.9,3 18,4.3 18,6 L18,14 C18,15.7 14.9,17 11,17 C7.1,17 4,15.7 4,14 Z M4,6 C4,7.7 7.1,9 11,9 C14.9,9 18,7.7 18,6'
                                      Stroke='#E0F2FE' StrokeThickness='1.55' Width='20' Height='20' Stretch='Uniform'
                                      HorizontalAlignment='Center' VerticalAlignment='Center'/>
                            </Grid>
                        </Border>

                        <StackPanel VerticalAlignment='Center'>
                            <StackPanel Orientation='Horizontal' VerticalAlignment='Center'>
                                <TextBlock Text='CARİ AKTARIM STÜDYOSU' Foreground='#F8FAFC' FontFamily='Segoe UI' FontWeight='Bold' FontSize='14.5'/>
                                <Border Background='#1DF59E0B' BorderBrush='#50F59E0B' BorderThickness='1' CornerRadius='5' Padding='7,1.5' Margin='9,0,0,0' VerticalAlignment='Center'>
                                    <TextBlock Text='SQL ➔ XLSX' Foreground='#FBBF24' FontSize='9.5' FontWeight='Bold'/>
                                </Border>
                            </StackPanel>
                            <TextBlock Text='SQL Server Veritabanlarından Tek Tıkla Saha Takip Cari Listesi Üretici'
                                       Foreground='#64748B' FontSize='11.2' Margin='0,1,0,0'/>
                        </StackPanel>
                    </StackPanel>

                    <!-- Orta-Sağ 3 Aşamalı Canlı Akış Göstergesi -->
                    <Border Grid.Column='2' Background='#0F182A' BorderBrush='#1E2D44' BorderThickness='1' CornerRadius='15' Padding='12,5' Margin='0,0,18,0' VerticalAlignment='Center'>
                        <StackPanel Orientation='Horizontal' VerticalAlignment='Center'>
                            <Ellipse x:Name='Step1Dot' Width='7' Height='7' Fill='#38BDF8' Margin='0,0,6,0' VerticalAlignment='Center'/>
                            <TextBlock x:Name='Step1Text' Text='1. Bağlantı Sına' Foreground='#E2E8F0' FontSize='11' FontWeight='SemiBold'/>

                            <TextBlock Text='›' Foreground='#475569' FontSize='13' Margin='10,0' VerticalAlignment='Center'/>

                            <Ellipse x:Name='Step2Dot' Width='7' Height='7' Fill='#475569' Margin='0,0,6,0' VerticalAlignment='Center'/>
                            <TextBlock x:Name='Step2Text' Text='2. Veritabanı Seç' Foreground='#64748B' FontSize='11' FontWeight='SemiBold'/>

                            <TextBlock Text='›' Foreground='#475569' FontSize='13' Margin='10,0' VerticalAlignment='Center'/>

                            <Ellipse x:Name='Step3Dot' Width='7' Height='7' Fill='#475569' Margin='0,0,6,0' VerticalAlignment='Center'/>
                            <TextBlock x:Name='Step3Text' Text='3. Excel Aktar' Foreground='#64748B' FontSize='11' FontWeight='SemiBold'/>
                        </StackPanel>
                    </Border>

                    <!-- Pencere Kontrolleri -->
                    <StackPanel Grid.Column='3' Orientation='Horizontal' VerticalAlignment='Center'>
                        <Button x:Name='BtnMin' Style='{StaticResource WinCtrlBtn}' ToolTip='Küçült'>
                            <Path Data='M0,0 L10,0' Stroke='{Binding Foreground, RelativeSource={RelativeSource AncestorType=Button}}' StrokeThickness='1.6'/>
                        </Button>
                        <Button x:Name='BtnMax' Style='{StaticResource WinCtrlBtn}' Margin='2,0' ToolTip='Tam Ekran / Önceki Boyut'>
                            <Rectangle Width='9.5' Height='9.5' Stroke='{Binding Foreground, RelativeSource={RelativeSource AncestorType=Button}}' StrokeThickness='1.5' RadiusX='1.5' RadiusY='1.5'/>
                        </Button>
                        <Button x:Name='BtnClose' Style='{StaticResource WinCloseBtn}' ToolTip='Kapat'>
                            <Path Data='M0,0 L9.5,9.5 M9.5,0 L0,9.5' Stroke='{Binding Foreground, RelativeSource={RelativeSource AncestorType=Button}}' StrokeThickness='1.6'/>
                        </Button>
                    </StackPanel>
                </Grid>
            </Border>

            <!-- ==================== 2. ANA İKİ SÜTUNLU ÇALIŞMA ALANI ==================== -->
            <Grid Grid.Row='1' Margin='16,14,16,10'>
                <Grid.ColumnDefinitions>
                    <ColumnDefinition Width='368'/>
                    <ColumnDefinition Width='14'/>
                    <ColumnDefinition Width='*'/>
                </Grid.ColumnDefinitions>

                <!-- ========== SOL SÜTUN: BAĞLANTI + VERİTABANI HAVUZU ========== -->
                <Grid Grid.Column='0'>
                    <Grid.RowDefinitions>
                        <RowDefinition Height='Auto'/>
                        <RowDefinition Height='12'/>
                        <RowDefinition Height='*'/>
                    </Grid.RowDefinitions>

                    <!-- KART 1: SQL SUNUCU BAĞLANTI PARAMETRELERİ -->
                    <Border Grid.Row='0' Background='#0E1626' BorderBrush='#1D2B42' BorderThickness='1' CornerRadius='14' Padding='16,14,16,15'>
                        <StackPanel>
                            <!-- Kart Başlığı + Kimlik Modu Seçici -->
                            <Grid Margin='0,0,0,12'>
                                <StackPanel Orientation='Horizontal' VerticalAlignment='Center'>
                                    <Ellipse x:Name='ConnBadgeDot' Width='7' Height='7' Fill='#38BDF8' Margin='0,0,7,0' VerticalAlignment='Center'/>
                                    <TextBlock Text='SUNUCU BAĞLANTISI' Foreground='#38BDF8' FontSize='10.8' FontWeight='Bold'/>
                                </StackPanel>

                                <!-- Hızlı Kimlik Doğrulama Geçişi -->
                                <Border HorizontalAlignment='Right' Background='#09101D' BorderBrush='#1E2C42' BorderThickness='1' CornerRadius='7' Padding='2'>
                                    <StackPanel Orientation='Horizontal'>
                                        <Border x:Name='TabSqlAuth' Background='#172B49' CornerRadius='5' Padding='8,3' Cursor='Hand'>
                                            <TextBlock x:Name='TxtSqlAuthTab' Text='SQL Hesabı' Foreground='#38BDF8' FontSize='10.2' FontWeight='SemiBold'/>
                                        </Border>
                                        <Border x:Name='TabWinAuth' Background='Transparent' CornerRadius='5' Padding='8,3' Cursor='Hand'>
                                            <TextBlock x:Name='TxtWinAuthTab' Text='Windows' Foreground='#64748B' FontSize='10.2' FontWeight='SemiBold'/>
                                        </Border>
                                    </StackPanel>
                                </Border>
                            </Grid>

                            <!-- Sunucu Adı -->
                            <TextBlock Text='Sunucu Adı (SSMS Instance)' Foreground='#94A3B8' FontSize='11.2' FontWeight='SemiBold' Margin='2,0,0,5'/>
                            <ComboBox x:Name='CmbServer' Style='{StaticResource DarkStudioComboBox}' IsEditable='True'/>

                            <!-- Kullanıcı Adı -->
                            <Grid Margin='0,10,0,0'>
                                <TextBlock Text='Kullanıcı Adı' Foreground='#94A3B8' FontSize='11.2' FontWeight='SemiBold' Margin='2,0,0,5'/>
                                <TextBlock x:Name='LblAuthHint' Text='(Örn: sa)' Foreground='#475569' FontSize='10.2' HorizontalAlignment='Right' Margin='0,1,2,0'/>
                            </Grid>
                            <Border x:Name='BdUserBox' Background='#0A1120' BorderBrush='#22314A' BorderThickness='1' CornerRadius='9' Height='35'>
                                <Grid>
                                    <Path Data='M10,10 C12.2,10 14,8.2 14,6 C14,3.8 12.2,2 10,2 C7.8,2 6,3.8 6,6 C6,8.2 7.8,10 10,10 Z M3,18 C3,14.8 6.1,12.5 10,12.5 C13.9,12.5 17,14.8 17,18'
                                          Stroke='#64748B' StrokeThickness='1.4' Width='14' Height='14' Stretch='Uniform'
                                          HorizontalAlignment='Left' VerticalAlignment='Center' Margin='11,0,0,0'/>
                                    <TextBox x:Name='TxtUser' Text='sa' Background='Transparent' Foreground='#F8FAFC' CaretBrush='#38BDF8'
                                             FontFamily='Segoe UI Semibold' FontSize='12.5' BorderThickness='0'
                                             VerticalContentAlignment='Center' Margin='32,0,10,0'/>
                                </Grid>
                            </Border>

                            <!-- Parola + Sına Butonu -->
                            <TextBlock Text='Parola' Foreground='#94A3B8' FontSize='11.2' FontWeight='SemiBold' Margin='2,10,0,5'/>
                            <Grid>
                                <Grid.ColumnDefinitions>
                                    <ColumnDefinition Width='*'/>
                                    <ColumnDefinition Width='10'/>
                                    <ColumnDefinition Width='108'/>
                                </Grid.ColumnDefinitions>

                                <!-- Parola Kutusu + Göz Butonu -->
                                <Border x:Name='BdPassBox' Grid.Column='0' Background='#0A1120' BorderBrush='#22314A' BorderThickness='1' CornerRadius='9' Height='37'>
                                    <Grid>
                                        <Path Data='M5,9 L15,9 C16.1,9 17,9.9 17,11 L17,17 C17,18.1 16.1,19 15,19 L5,19 C3.9,19 3,18.1 3,17 L3,11 C3,9.9 3.9,9 5,9 Z M6.5,9 L6.5,6.5 C6.5,4.6 8.1,3 10,3 C11.9,3 13.5,4.6 13.5,6.5 L13.5,9'
                                              Stroke='#64748B' StrokeThickness='1.4' Width='14' Height='14' Stretch='Uniform'
                                              HorizontalAlignment='Left' VerticalAlignment='Center' Margin='11,0,0,0'/>

                                        <PasswordBox x:Name='PwdBox' Background='Transparent' Foreground='#F8FAFC' CaretBrush='#38BDF8'
                                                     FontSize='12.5' BorderThickness='0' VerticalContentAlignment='Center' Margin='32,0,34,0'/>

                                        <TextBox x:Name='TxtPassPlain' Visibility='Collapsed' Background='Transparent' Foreground='#F8FAFC' CaretBrush='#38BDF8'
                                                 FontFamily='Segoe UI Semibold' FontSize='12.5' BorderThickness='0' VerticalContentAlignment='Center' Margin='32,0,34,0'/>

                                        <Button x:Name='BtnTogglePass' Width='28' Height='28' HorizontalAlignment='Right' Margin='0,0,4,0'
                                                Background='Transparent' BorderThickness='0' Cursor='Hand' ToolTip='Parolayı Göster / Gizle'>
                                            <Button.Template>
                                                <ControlTemplate TargetType='Button'>
                                                    <Border x:Name='EyeBd' Background='Transparent' CornerRadius='6'>
                                                        <Path x:Name='EyePath' Data='M1.5,10 C3.5,5.5 6.6,3.5 10,3.5 C13.4,3.5 16.5,5.5 18.5,10 C16.5,14.5 13.4,16.5 10,16.5 C6.6,16.5 3.5,14.5 1.5,10 Z M10,13 C11.7,13 13,11.7 13,10 C13,8.3 11.7,7 10,7 C8.3,7 7,8.3 7,10 C7,11.7 8.3,13 10,13 Z'
                                                              Stroke='#94A3B8' StrokeThickness='1.4' Width='15' Height='15' Stretch='Uniform'
                                                              HorizontalAlignment='Center' VerticalAlignment='Center'/>
                                                    </Border>
                                                    <ControlTemplate.Triggers>
                                                        <Trigger Property='IsMouseOver' Value='True'>
                                                            <Setter TargetName='EyeBd' Property='Background' Value='#18263C'/>
                                                            <Setter TargetName='EyePath' Property='Stroke' Value='#38BDF8'/>
                                                        </Trigger>
                                                    </ControlTemplate.Triggers>
                                                </ControlTemplate>
                                            </Button.Template>
                                        </Button>
                                    </Grid>
                                </Border>

                                <!-- SINA BUTONU -->
                                <Button x:Name='BtnTest' Grid.Column='2' Height='37' Cursor='Hand' ToolTip='SQL Server bağlantısını sına ve veritabanlarını listele (Enter)'>
                                    <Button.Template>
                                        <ControlTemplate TargetType='Button'>
                                            <Border x:Name='TestBd' CornerRadius='9' BorderBrush='#557DD3FC' BorderThickness='1'>
                                                <Border.Background>
                                                    <LinearGradientBrush StartPoint='0,0' EndPoint='1,1'>
                                                        <GradientStop Color='#0284C7' Offset='0'/>
                                                        <GradientStop Color='#2563EB' Offset='1'/>
                                                    </LinearGradientBrush>
                                                </Border.Background>
                                                <StackPanel Orientation='Horizontal' HorizontalAlignment='Center' VerticalAlignment='Center'>
                                                    <Path Data='M11,2 L4,11 L10,11 L9,18 L16,9 L10,9 Z' Fill='#FFFFFF' Width='13' Height='13' Stretch='Uniform' Margin='0,0,6,0'/>
                                                    <TextBlock x:Name='TxtBtnTest' Text='Sına' Foreground='#FFFFFF' FontWeight='Bold' FontSize='13'/>
                                                </StackPanel>
                                            </Border>
                                            <ControlTemplate.Triggers>
                                                <Trigger Property='IsMouseOver' Value='True'>
                                                    <Setter TargetName='TestBd' Property='Background'>
                                                        <Setter.Value>
                                                            <LinearGradientBrush StartPoint='0,0' EndPoint='1,1'>
                                                                <GradientStop Color='#0EA5E9' Offset='0'/>
                                                                <GradientStop Color='#3B82F6' Offset='1'/>
                                                            </LinearGradientBrush>
                                                        </Setter.Value>
                                                    </Setter>
                                                </Trigger>
                                                <Trigger Property='IsEnabled' Value='False'>
                                                    <Setter TargetName='TestBd' Property='Opacity' Value='0.55'/>
                                                </Trigger>
                                            </ControlTemplate.Triggers>
                                        </ControlTemplate>
                                    </Button.Template>
                                </Button>
                            </Grid>
                        </StackPanel>
                    </Border>

                    <!-- KART 2: VERİTABANI KEŞİF HAVUZU -->
                    <Border Grid.Row='2' Background='#0E1626' BorderBrush='#1D2B42' BorderThickness='1' CornerRadius='14' Padding='15,13,15,13'>
                        <Grid>
                            <Grid.RowDefinitions>
                                <RowDefinition Height='Auto'/>
                                <RowDefinition Height='Auto'/>
                                <RowDefinition Height='*'/>
                            </Grid.RowDefinitions>

                            <!-- Başlık + Sayı Rozeti + Tümünü Ekle -->
                            <Grid Grid.Row='0' Margin='0,0,0,9'>
                                <StackPanel Orientation='Horizontal' VerticalAlignment='Center'>
                                    <TextBlock Text='VERİTABANLARI' Foreground='#E2E8F0' FontSize='11' FontWeight='Bold'/>
                                    <Border Background='#1838BDF8' BorderBrush='#3538BDF8' BorderThickness='1' CornerRadius='6' Padding='7,1.5' Margin='8,0,0,0'>
                                        <TextBlock x:Name='LblDbCountBadge' Text='0' Foreground='#38BDF8' FontSize='10.2' FontWeight='Bold'/>
                                    </Border>
                                </StackPanel>

                                <Button x:Name='BtnAddAllDbs' Visibility='Collapsed' HorizontalAlignment='Right' Cursor='Hand' Background='Transparent' BorderThickness='0'>
                                    <Button.Template>
                                        <ControlTemplate TargetType='Button'>
                                            <Border x:Name='AllBd' Background='#1410B981' BorderBrush='#3510B981' BorderThickness='1' CornerRadius='6' Padding='8,2.5'>
                                                <TextBlock Text='Tümünü Kuyruğa At ➔' Foreground='#34D399' FontSize='10.3' FontWeight='SemiBold'/>
                                            </Border>
                                            <ControlTemplate.Triggers>
                                                <Trigger Property='IsMouseOver' Value='True'>
                                                    <Setter TargetName='AllBd' Property='Background' Value='#2810B981'/>
                                                </Trigger>
                                            </ControlTemplate.Triggers>
                                        </ControlTemplate>
                                    </Button.Template>
                                </Button>
                            </Grid>

                            <!-- Hızlı Arama Kutusu -->
                            <Border Grid.Row='1' Background='#09101D' BorderBrush='#1E2C42' BorderThickness='1' CornerRadius='8' Height='32' Margin='0,0,0,9'>
                                <Grid>
                                    <Path Data='M9,3 C12.3,3 15,5.7 15,9 C15,10.4 14.5,11.7 13.7,12.7 L17.5,16.5 L16.5,17.5 L12.7,13.7 C11.7,14.5 10.4,15 9,15 C5.7,15 3,12.3 3,9 C3,5.7 5.7,3 9,3 Z'
                                          Stroke='#64748B' StrokeThickness='1.3' Width='13' Height='13' Stretch='Uniform'
                                          HorizontalAlignment='Left' VerticalAlignment='Center' Margin='10,0,0,0'/>
                                    <TextBlock x:Name='LblFilterWatermark' Text='Veritabanı ara...' Foreground='#475569' FontSize='11.5'
                                               VerticalAlignment='Center' Margin='30,0,10,0' IsHitTestVisible='False'/>
                                    <TextBox x:Name='TxtDbFilter' Background='Transparent' Foreground='#E2E8F0' CaretBrush='#38BDF8'
                                             FontSize='11.8' BorderThickness='0' VerticalContentAlignment='Center' Margin='28,0,8,0'/>
                                </Grid>
                            </Border>

                            <!-- Sol Veritabanı Listesi -->
                            <Grid Grid.Row='2'>
                                <Border x:Name='PnlLeftEmptyHint' Background='#0A1120' BorderBrush='#172235' BorderThickness='1' CornerRadius='10' Padding='16'>
                                    <StackPanel VerticalAlignment='Center' HorizontalAlignment='Center'>
                                        <Path Data='M4,6 C4,4.3 7.1,3 11,3 C14.9,3 18,4.3 18,6 L18,15 C18,16.7 14.9,18 11,18 C7.1,18 4,16.7 4,15 Z M4,6 C4,7.7 7.1,9 11,9 C14.9,9 18,7.7 18,6'
                                              Stroke='#334155' StrokeThickness='1.5' Width='28' Height='28' Stretch='Uniform' HorizontalAlignment='Center' Margin='0,0,0,8'/>
                                        <TextBlock x:Name='LblLeftEmptyText'
                                                   Text='Sunucu bilgilerini kontrol edip &quot;Sına&quot; butonuna basın.'
                                                   Foreground='#64748B' FontSize='11.5' TextAlignment='Center' TextWrapping='Wrap'/>
                                    </StackPanel>
                                </Border>

                                <ScrollViewer x:Name='SvDatabases' Visibility='Collapsed' VerticalScrollBarVisibility='Auto' HorizontalScrollBarVisibility='Disabled'>
                                    <ItemsControl x:Name='IcDatabases'>
                                        <ItemsControl.ItemTemplate>
                                            <DataTemplate>
                                                <Button Tag='{Binding}' Margin='0,0,2,5' Cursor='Hand'>
                                                    <Button.Template>
                                                        <ControlTemplate TargetType='Button'>
                                                            <Border x:Name='RowBd' Background='#121D31' BorderBrush='#1D2D46' BorderThickness='1' CornerRadius='8' Padding='10,7.5'>
                                                                <Grid>
                                                                    <Grid.ColumnDefinitions>
                                                                        <ColumnDefinition Width='Auto'/>
                                                                        <ColumnDefinition Width='*'/>
                                                                        <ColumnDefinition Width='Auto'/>
                                                                    </Grid.ColumnDefinitions>
                                                                    <Path Grid.Column='0'
                                                                          Data='M3,5 C3,3.8 5.9,2.8 9.5,2.8 C13.1,2.8 16,3.8 16,5 L16,13 C16,14.2 13.1,15.2 9.5,15.2 C5.9,15.2 3,14.2 3,13 Z M3,5 C3,6.2 5.9,7.2 9.5,7.2 C13.1,7.2 16,6.2 16,5'
                                                                          Stroke='{Binding IconBrush}' StrokeThickness='1.4' Width='14' Height='14' Stretch='Uniform'
                                                                          VerticalAlignment='Center' Margin='0,0,9,0'/>
                                                                    <TextBlock Grid.Column='1' Text='{Binding Name}' Foreground='#F1F5F9' FontFamily='Segoe UI Semibold'
                                                                               FontSize='12.2' VerticalAlignment='Center' TextTrimming='CharacterEllipsis'/>
                                                                    <Border Grid.Column='2' Background='{Binding BadgeBackground}' BorderBrush='{Binding BadgeBorder}'
                                                                            BorderThickness='1' CornerRadius='5' Padding='7,2' Margin='8,0,0,0' VerticalAlignment='Center'>
                                                                        <TextBlock Text='{Binding BadgeText}' Foreground='{Binding BadgeForeground}' FontSize='10' FontWeight='Bold'/>
                                                                    </Border>
                                                                </Grid>
                                                            </Border>
                                                            <ControlTemplate.Triggers>
                                                                <Trigger Property='IsMouseOver' Value='True'>
                                                                    <Setter TargetName='RowBd' Property='Background' Value='#182844'/>
                                                                    <Setter TargetName='RowBd' Property='BorderBrush' Value='#38BDF8'/>
                                                                </Trigger>
                                                            </ControlTemplate.Triggers>
                                                        </ControlTemplate>
                                                    </Button.Template>
                                                </Button>
                                            </DataTemplate>
                                        </ItemsControl.ItemTemplate>
                                    </ItemsControl>
                                </ScrollViewer>
                            </Grid>
                        </Grid>
                    </Border>
                </Grid>

                <!-- ========== SAĞ SÜTUN: AKTARIM KUYRUĞU & CANLI CARİ MERKEZİ ========== -->
                <Border Grid.Column='2' Background='#0E1626' BorderBrush='#1D2B42' BorderThickness='1' CornerRadius='14'>
                    <Grid>
                        <Grid.RowDefinitions>
                            <RowDefinition Height='52'/>
                            <RowDefinition Height='*'/>
                            <RowDefinition Height='Auto'/>
                        </Grid.RowDefinitions>

                        <!-- Sağ Panel Üst Başlık -->
                        <Border Grid.Row='0' BorderBrush='#18253A' BorderThickness='0,0,0,1' Padding='18,0'>
                            <Grid>
                                <StackPanel Orientation='Horizontal' VerticalAlignment='Center'>
                                    <Ellipse Width='8' Height='8' Fill='#10B981' Margin='0,0,8,0' VerticalAlignment='Center'/>
                                    <TextBlock Text='AKTARIM KUYRUĞU &amp; SEÇİLEN VERİTABANLARI' Foreground='#F8FAFC' FontSize='11.5' FontWeight='Bold'/>
                                    <Border Background='#1810B981' BorderBrush='#4010B981' BorderThickness='1' CornerRadius='6' Padding='8,2' Margin='10,0,0,0'>
                                        <TextBlock x:Name='LblQueueBadge' Text='0 SEÇİLİ' Foreground='#34D399' FontSize='10.2' FontWeight='Bold'/>
                                    </Border>
                                </StackPanel>

                                <Button x:Name='BtnClearQueue' Visibility='Collapsed' HorizontalAlignment='Right' VerticalAlignment='Center' Cursor='Hand'>
                                    <Button.Template>
                                        <ControlTemplate TargetType='Button'>
                                            <Border x:Name='ClrBd' Background='#14F43F5E' BorderBrush='#38F43F5E' BorderThickness='1' CornerRadius='7' Padding='10,4'>
                                                <TextBlock Text='Listeyi Temizle' Foreground='#FB7185' FontSize='11' FontWeight='SemiBold'/>
                                            </Border>
                                            <ControlTemplate.Triggers>
                                                <Trigger Property='IsMouseOver' Value='True'>
                                                    <Setter TargetName='ClrBd' Property='Background' Value='#28F43F5E'/>
                                                    <Setter TargetName='ClrBd' Property='BorderBrush' Value='#FB7185'/>
                                                </Trigger>
                                            </ControlTemplate.Triggers>
                                        </ControlTemplate>
                                    </Button.Template>
                                </Button>
                            </Grid>
                        </Border>

                        <!-- Sağ Panel Orta Gövde: Boş Durum veya Seçilen Kartlar -->
                        <Grid Grid.Row='1' Margin='18,14,18,14'>
                            <!-- ÖZGÜN MİMARİ BOŞ DURUM EKRANI -->
                            <Border x:Name='PnlRightEmptyState' Background='#0A111F' BorderBrush='#17243A' BorderThickness='1' CornerRadius='12' Padding='28'>
                                <StackPanel VerticalAlignment='Center' HorizontalAlignment='Center' MaxWidth='470'>
                                    <!-- İllüstrasyon Rozeti -->
                                    <Grid Width='156' Height='68' HorizontalAlignment='Center' Margin='0,0,0,18'>
                                        <Border Width='56' Height='56' HorizontalAlignment='Left' VerticalAlignment='Center' CornerRadius='15'
                                                Background='#101E36' BorderBrush='#25426B' BorderThickness='1'>
                                            <Path Data='M4,6 C4,4.3 7.1,3 11,3 C14.9,3 18,4.3 18,6 L18,15 C18,16.7 14.9,18 11,18 C7.1,18 4,16.7 4,15 Z M4,6 C4,7.7 7.1,9 11,9 C14.9,9 18,7.7 18,6'
                                                  Stroke='#38BDF8' StrokeThickness='1.6' Width='24' Height='24' Stretch='Uniform' HorizontalAlignment='Center' VerticalAlignment='Center'/>
                                        </Border>

                                        <StackPanel Orientation='Horizontal' HorizontalAlignment='Center' VerticalAlignment='Center'>
                                            <Ellipse Width='5' Height='5' Fill='#38BDF8' Margin='3,0'/>
                                            <Path Data='M0,5 L18,5 M13,1 L18,5 L13,9' Stroke='#34D399' StrokeThickness='1.8' Margin='3,0'/>
                                            <Ellipse Width='5' Height='5' Fill='#10B981' Margin='3,0'/>
                                        </StackPanel>

                                        <Border Width='56' Height='56' HorizontalAlignment='Right' VerticalAlignment='Center' CornerRadius='15'
                                                Background='#0D2622' BorderBrush='#1D5B4B' BorderThickness='1'>
                                            <Path Data='M4,3 L13,3 L17,7 L17,18 L4,18 Z M7.5,10 L13.5,15.5 M13.5,10 L7.5,15.5'
                                                  Stroke='#34D399' StrokeThickness='1.6' Width='23' Height='23' Stretch='Uniform' HorizontalAlignment='Center' VerticalAlignment='Center'/>
                                        </Border>
                                    </Grid>

                                    <TextBlock Text='Aktarım Kuyruğu Hazır Bekliyor' Foreground='#F1F5F9' FontSize='16' FontWeight='Bold' HorizontalAlignment='Center'/>
                                    <TextBlock Text='Sol panelden bağlantıyı sınadıktan sonra listedeki veritabanlarına tıklayarak bu alana ekleyin. Eklenen her veritabanının Cari tablosu anında taranır ve Excel aktarım butonu otomatik açılır.'
                                               Foreground='#64748B' FontSize='12.2' TextAlignment='Center' TextWrapping='Wrap' Margin='0,8,0,20' LineHeight='18'/>

                                    <WrapPanel HorizontalAlignment='Center'>
                                        <Border Background='#111C30' BorderBrush='#1E2F4D' BorderThickness='1' CornerRadius='8' Padding='9,5' Margin='4'>
                                            <StackPanel Orientation='Horizontal' VerticalAlignment='Center'>
                                                <Border Width='17' Height='17' CornerRadius='8.5' Background='#1E3A5F' Margin='0,0,7,0'>
                                                    <TextBlock Text='1' Foreground='#38BDF8' FontSize='10' FontWeight='Bold' HorizontalAlignment='Center' VerticalAlignment='Center'/>
                                                </Border>
                                                <TextBlock Text='Bağlantıyı Sına' Foreground='#CBD5E1' FontSize='11' FontWeight='SemiBold' VerticalAlignment='Center'/>
                                            </StackPanel>
                                        </Border>
                                        <Border Background='#111C30' BorderBrush='#1E2F4D' BorderThickness='1' CornerRadius='8' Padding='9,5' Margin='4'>
                                            <StackPanel Orientation='Horizontal' VerticalAlignment='Center'>
                                                <Border Width='17' Height='17' CornerRadius='8.5' Background='#1E3A5F' Margin='0,0,7,0'>
                                                    <TextBlock Text='2' Foreground='#38BDF8' FontSize='10' FontWeight='Bold' HorizontalAlignment='Center' VerticalAlignment='Center'/>
                                                </Border>
                                                <TextBlock Text='Veritabanına Tıkla' Foreground='#CBD5E1' FontSize='11' FontWeight='SemiBold' VerticalAlignment='Center'/>
                                            </StackPanel>
                                        </Border>
                                        <Border Background='#0E2422' BorderBrush='#1F4E43' BorderThickness='1' CornerRadius='8' Padding='9,5' Margin='4'>
                                            <StackPanel Orientation='Horizontal' VerticalAlignment='Center'>
                                                <Border Width='17' Height='17' CornerRadius='8.5' Background='#134E4A' Margin='0,0,7,0'>
                                                    <TextBlock Text='3' Foreground='#34D399' FontSize='10' FontWeight='Bold' HorizontalAlignment='Center' VerticalAlignment='Center'/>
                                                </Border>
                                                <TextBlock Text='Tek Tıkla .xlsx Üret' Foreground='#34D399' FontSize='11' FontWeight='SemiBold' VerticalAlignment='Center'/>
                                            </StackPanel>
                                        </Border>
                                    </WrapPanel>
                                </StackPanel>
                            </Border>

                            <!-- SEÇİLEN VERİTABANI KART LİSTESİ -->
                            <ScrollViewer x:Name='SvSelectedQueue' Visibility='Collapsed' VerticalScrollBarVisibility='Auto' HorizontalScrollBarVisibility='Disabled'>
                                <ItemsControl x:Name='IcSelectedQueue'>
                                    <ItemsControl.ItemTemplate>
                                        <DataTemplate>
                                            <Border Margin='0,0,4,9' CornerRadius='11' BorderBrush='#22344F' BorderThickness='1'>
                                                <Border.Background>
                                                    <LinearGradientBrush StartPoint='0,0' EndPoint='1,0'>
                                                        <GradientStop Color='#132036' Offset='0'/>
                                                        <GradientStop Color='#0F192B' Offset='1'/>
                                                    </LinearGradientBrush>
                                                </Border.Background>
                                                <Grid>
                                                    <Grid.ColumnDefinitions>
                                                        <ColumnDefinition Width='4'/>
                                                        <ColumnDefinition Width='Auto'/>
                                                        <ColumnDefinition Width='*'/>
                                                        <ColumnDefinition Width='Auto'/>
                                                    </Grid.ColumnDefinitions>

                                                    <!-- Sol Zümrüt Vurgu Çizgisi -->
                                                    <Border Grid.Column='0' Background='#10B981' CornerRadius='11,0,0,11'/>

                                                    <!-- [-] Kuyruktan Çıkar Butonu -->
                                                    <Button Grid.Column='1' Tag='{Binding}' Width='32' Height='32' Margin='12,0,12,0'
                                                            VerticalAlignment='Center' Cursor='Hand' ToolTip='[-] Aktarım listesinden çıkar'>
                                                        <Button.Template>
                                                            <ControlTemplate TargetType='Button'>
                                                                <Border x:Name='RmBd' Background='#1AF43F5E' BorderBrush='#45F43F5E' BorderThickness='1' CornerRadius='8'>
                                                                    <Path x:Name='RmIcon' Data='M0,0 L10,0' Stroke='#FB7185' StrokeThickness='2.2'
                                                                          HorizontalAlignment='Center' VerticalAlignment='Center'/>
                                                                </Border>
                                                                <ControlTemplate.Triggers>
                                                                    <Trigger Property='IsMouseOver' Value='True'>
                                                                        <Setter TargetName='RmBd' Property='Background' Value='#E11D48'/>
                                                                        <Setter TargetName='RmBd' Property='BorderBrush' Value='#FB7185'/>
                                                                        <Setter TargetName='RmIcon' Property='Stroke' Value='#FFFFFF'/>
                                                                    </Trigger>
                                                                </ControlTemplate.Triggers>
                                                            </ControlTemplate>
                                                        </Button.Template>
                                                    </Button>

                                                    <!-- Orta Bilgi Bloğu -->
                                                    <StackPanel Grid.Column='2' VerticalAlignment='Center' Margin='0,11,10,11'>
                                                        <WrapPanel VerticalAlignment='Center'>
                                                            <TextBlock Text='{Binding TitleLine}' Foreground='#F8FAFC' FontFamily='Segoe UI' FontWeight='Bold'
                                                                       FontSize='13.2' VerticalAlignment='Center' Margin='0,0,10,0'/>
                                                            <Border Background='{Binding ScanBadgeBg}' BorderBrush='{Binding ScanBadgeBorder}' BorderThickness='1'
                                                                    CornerRadius='6' Padding='8,2' VerticalAlignment='Center'>
                                                                <TextBlock Text='{Binding ScanBadgeText}' Foreground='{Binding ScanBadgeFg}' FontSize='10.3' FontWeight='SemiBold'/>
                                                            </Border>
                                                        </WrapPanel>

                                                        <WrapPanel Margin='0,5,0,0'>
                                                            <Border Background='#0A1220' BorderBrush='#1D2C44' BorderThickness='1' CornerRadius='5' Padding='7,2' Margin='0,2,6,2'>
                                                                <TextBlock Text='{Binding ServerTag}' Foreground='#94A3B8' FontFamily='Consolas' FontSize='10.8'/>
                                                            </Border>
                                                            <Border Background='#0A1220' BorderBrush='#1D2C44' BorderThickness='1' CornerRadius='5' Padding='7,2' Margin='0,2,6,2'>
                                                                <TextBlock Text='{Binding DatabaseTag}' Foreground='#94A3B8' FontFamily='Consolas' FontSize='10.8'/>
                                                            </Border>
                                                            <Border Background='#0C1E24' BorderBrush='#194345' BorderThickness='1' CornerRadius='5' Padding='7,2' Margin='0,2,0,2'>
                                                                <TextBlock Text='{Binding OutputFileTag}' Foreground='#5EEAD4' FontFamily='Consolas' FontSize='10.8'/>
                                                            </Border>
                                                        </WrapPanel>
                                                    </StackPanel>

                                                    <!-- Sağ Önizle Butonu -->
                                                    <Button Grid.Column='3' Tag='{Binding}' Margin='0,0,14,0' VerticalAlignment='Center' Cursor='Hand'
                                                            ToolTip='Bu veritabanındaki carileri önizle veya kaynak tabloyu seç'>
                                                        <Button.Template>
                                                            <ControlTemplate TargetType='Button'>
                                                                <Border x:Name='PvBd' Background='#16243B' BorderBrush='#293E5E' BorderThickness='1' CornerRadius='8' Padding='11,6'>
                                                                    <TextBlock x:Name='PvTxt' Text='Önizle' Foreground='#BAE6FD' FontSize='11.2' FontWeight='SemiBold'/>
                                                                </Border>
                                                                <ControlTemplate.Triggers>
                                                                    <Trigger Property='IsMouseOver' Value='True'>
                                                                        <Setter TargetName='PvBd' Property='Background' Value='#1E3454'/>
                                                                        <Setter TargetName='PvBd' Property='BorderBrush' Value='#38BDF8'/>
                                                                        <Setter TargetName='PvTxt' Property='Foreground' Value='#FFFFFF'/>
                                                                    </Trigger>
                                                                </ControlTemplate.Triggers>
                                                            </ControlTemplate>
                                                        </Button.Template>
                                                    </Button>
                                                </Grid>
                                            </Border>
                                        </DataTemplate>
                                    </ItemsControl.ItemTemplate>
                                </ItemsControl>
                            </ScrollViewer>
                        </Grid>

                        <!-- SAĞ PANEL ALT EXCEL AKTARIM DOCK ÇUBUĞU (Kuyrukta >=1 Veritabanı Varken Görünür) -->
                        <Border x:Name='PnlExportDock' Grid.Row='2' Visibility='Collapsed' BorderBrush='#3810B981' BorderThickness='0,1,0,0' CornerRadius='0,0,13,13' Padding='18,13'>
                            <Border.Background>
                                <LinearGradientBrush StartPoint='0,0' EndPoint='1,0'>
                                    <GradientStop Color='#0B1929' Offset='0'/>
                                    <GradientStop Color='#0B2321' Offset='1'/>
                                </LinearGradientBrush>
                            </Border.Background>
                            <Grid>
                                <Grid.ColumnDefinitions>
                                    <ColumnDefinition Width='*'/>
                                    <ColumnDefinition Width='Auto'/>
                                </Grid.ColumnDefinitions>

                                <StackPanel Grid.Column='0' VerticalAlignment='Center'>
                                    <TextBlock x:Name='LblDockHeadline' Text='1 Veritabanı Aktarıma Hazır' Foreground='#ECFDF5' FontSize='13' FontWeight='Bold'/>
                                    <TextBlock x:Name='LblDockSubline' Text='Saha Takip sistemiyle birebir uyumlu Excel (.xlsx) çıktısı üretilecek.'
                                               Foreground='#6EE7B7' Opacity='0.82' FontSize='11.2' Margin='0,2,0,0'/>
                                </StackPanel>

                                <Button x:Name='BtnExportExcel' Grid.Column='1' Width='242' Height='44' Cursor='Hand'>
                                    <Button.Template>
                                        <ControlTemplate TargetType='Button'>
                                            <Border x:Name='ExBd' CornerRadius='10' BorderBrush='#666EE7B7' BorderThickness='1'>
                                                <Border.Background>
                                                    <LinearGradientBrush StartPoint='0,0' EndPoint='1,1'>
                                                        <GradientStop Color='#059669' Offset='0'/>
                                                        <GradientStop Color='#10B981' Offset='1'/>
                                                    </LinearGradientBrush>
                                                </Border.Background>
                                                <Border.Effect>
                                                    <DropShadowEffect Color='#10B981' BlurRadius='16' ShadowDepth='0' Opacity='0.32'/>
                                                </Border.Effect>
                                                <StackPanel Orientation='Horizontal' HorizontalAlignment='Center' VerticalAlignment='Center'>
                                                    <Path Data='M4,2 L12,2 L16,6 L16,18 L4,18 Z M7,9.5 L13,15 M13,9.5 L7,15'
                                                          Stroke='#FFFFFF' StrokeThickness='1.7' Width='16' Height='16' Stretch='Uniform' Margin='0,0,9,0'/>
                                                    <TextBlock x:Name='TxtExportBtn' Text='{TemplateBinding Content}' Foreground='#FFFFFF' FontSize='13.2' FontWeight='Bold'/>
                                                </StackPanel>
                                            </Border>
                                            <ControlTemplate.Triggers>
                                                <Trigger Property='IsMouseOver' Value='True'>
                                                    <Setter TargetName='ExBd' Property='Background'>
                                                        <Setter.Value>
                                                            <LinearGradientBrush StartPoint='0,0' EndPoint='1,1'>
                                                                <GradientStop Color='#10B981' Offset='0'/>
                                                                <GradientStop Color='#34D399' Offset='1'/>
                                                            </LinearGradientBrush>
                                                        </Setter.Value>
                                                    </Setter>
                                                </Trigger>
                                                <Trigger Property='IsEnabled' Value='False'>
                                                    <Setter TargetName='ExBd' Property='Opacity' Value='0.55'/>
                                                </Trigger>
                                            </ControlTemplate.Triggers>
                                        </ControlTemplate>
                                    </Button.Template>
                                    Excel&apos;e Aktar (.xlsx)
                                </Button>
                            </Grid>
                        </Border>
                    </Grid>
                </Border>
            </Grid>

            <!-- ==================== 3. ALT TELEMETRİ VE DURUM ÇUBUĞU ==================== -->
            <Border Grid.Row='2' Background='#090F1D' BorderBrush='#162235' BorderThickness='0,1,0,0' Padding='18,0'>
                <Grid>
                    <Grid.ColumnDefinitions>
                        <ColumnDefinition Width='*'/>
                        <ColumnDefinition Width='Auto'/>
                    </Grid.ColumnDefinitions>
                    <StackPanel Grid.Column='0' Orientation='Horizontal' VerticalAlignment='Center'>
                        <Ellipse x:Name='StatusDot' Width='7' Height='7' Fill='#38BDF8' Margin='0,0,8,0' VerticalAlignment='Center'/>
                        <TextBlock x:Name='LblStatus'
                                   Text='Hazır — Sunucu bilgilerini kontrol edip &quot;Sına&quot; butonuna basın.'
                                   Foreground='#94A3B8' FontSize='11.3' VerticalAlignment='Center' TextTrimming='CharacterEllipsis'/>
                    </StackPanel>
                    <TextBlock Grid.Column='1' Text='TAŞINABİLİR .EXE • EXCEL KURULUMU GEREKTİRMEZ'
                               Foreground='#475569' FontSize='10' FontWeight='Bold' VerticalAlignment='Center' Margin='14,0,0,0'/>
                </Grid>
            </Border>
        </Grid>
    </Border>
</Grid>";

        private Border headerBar;
        private Button btnMin;
        private Button btnMax;
        private Button btnClose;

        private Ellipse step1Dot;
        private TextBlock step1Text;
        private Ellipse step2Dot;
        private TextBlock step2Text;
        private Ellipse step3Dot;
        private TextBlock step3Text;

        private Ellipse connBadgeDot;
        private Border tabSqlAuth;
        private TextBlock txtSqlAuthTab;
        private Border tabWinAuth;
        private TextBlock txtWinAuthTab;
        private TextBlock lblAuthHint;

        private ComboBox cmbServer;
        private Border bdUserBox;
        private TextBox txtUser;
        private Border bdPassBox;
        private PasswordBox pwdBox;
        private TextBox txtPassPlain;
        private Button btnTogglePass;
        private Button btnTest;

        private TextBlock lblDbCountBadge;
        private Button btnAddAllDbs;
        private TextBlock lblFilterWatermark;
        private TextBox txtDbFilter;
        private Border pnlLeftEmptyHint;
        private TextBlock lblLeftEmptyText;
        private ScrollViewer svDatabases;
        private ItemsControl icDatabases;

        private TextBlock lblQueueBadge;
        private Button btnClearQueue;
        private Border pnlRightEmptyState;
        private ScrollViewer svSelectedQueue;
        private ItemsControl icSelectedQueue;
        private Border pnlExportDock;
        private TextBlock lblDockHeadline;
        private TextBlock lblDockSubline;
        private Button btnExportExcel;

        private Ellipse statusDot;
        private TextBlock lblStatus;

        private bool isPasswordVisible;
        private bool syncingPassword;
        private bool isWindowsAuthMode;

        private readonly List<DiscoveredDatabaseItem> allDiscoveredDbs = new List<DiscoveredDatabaseItem>();
        private readonly ObservableCollection<DiscoveredDatabaseItem> filteredDiscoveredDbs = new ObservableCollection<DiscoveredDatabaseItem>();
        private readonly ObservableCollection<SelectedDbEntry> selectedQueue = new ObservableCollection<SelectedDbEntry>();

        private string lastRawServer = "";
        private string lastResolvedServer = "";
        private string lastTestedUser = "";
        private string lastTestedPassword = "";

        public StudioMainWindow()
        {
            Title = "Cari Aktarım Stüdyosu — SQL Server Excel (.xlsx) Köprüsü";
            Width = 1140;
            Height = 650;
            MinWidth = 920;
            MinHeight = 540;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.CanResize;
            Background = StudioPalette.FreezeBrush("#070C16");

            var chrome = new WindowChrome
            {
                CaptionHeight = 0,
                ResizeBorderThickness = new Thickness(6),
                GlassFrameThickness = new Thickness(1),
                CornerRadius = new CornerRadius(0)
            };
            WindowChrome.SetWindowChrome(this, chrome);

            try
            {
                Uri iconUri = new Uri(Process.GetCurrentProcess().MainModule.FileName, UriKind.Absolute);
                Icon = BitmapFrame.Create(iconUri);
            }
            catch { }

            SourceInitialized += OnWindowSourceInitialized;

            UIElement root = (UIElement)XamlReader.Parse(WindowXaml);
            Content = root;

            BindControls((FrameworkElement)root);
            PopulateDetectedSqlServers();
            UpdateStepIndicators();
        }

        private void OnWindowSourceInitialized(object sender, EventArgs e)
        {
            try
            {
                IntPtr hwnd = new WindowInteropHelper(this).Handle;
                int roundPref = 2; // DWMWCP_ROUND (Windows 11 donanım yuvarlatılmış köşe desteği)
                DwmSetWindowAttribute(hwnd, 33, ref roundPref, sizeof(int));
            }
            catch { }
        }

        private void BindControls(FrameworkElement root)
        {
            headerBar = (Border)root.FindName("HeaderBar");
            btnMin = (Button)root.FindName("BtnMin");
            btnMax = (Button)root.FindName("BtnMax");
            btnClose = (Button)root.FindName("BtnClose");

            step1Dot = (Ellipse)root.FindName("Step1Dot");
            step1Text = (TextBlock)root.FindName("Step1Text");
            step2Dot = (Ellipse)root.FindName("Step2Dot");
            step2Text = (TextBlock)root.FindName("Step2Text");
            step3Dot = (Ellipse)root.FindName("Step3Dot");
            step3Text = (TextBlock)root.FindName("Step3Text");

            connBadgeDot = (Ellipse)root.FindName("ConnBadgeDot");
            tabSqlAuth = (Border)root.FindName("TabSqlAuth");
            txtSqlAuthTab = (TextBlock)root.FindName("TxtSqlAuthTab");
            tabWinAuth = (Border)root.FindName("TabWinAuth");
            txtWinAuthTab = (TextBlock)root.FindName("TxtWinAuthTab");
            lblAuthHint = (TextBlock)root.FindName("LblAuthHint");

            cmbServer = (ComboBox)root.FindName("CmbServer");
            bdUserBox = (Border)root.FindName("BdUserBox");
            txtUser = (TextBox)root.FindName("TxtUser");
            bdPassBox = (Border)root.FindName("BdPassBox");
            pwdBox = (PasswordBox)root.FindName("PwdBox");
            txtPassPlain = (TextBox)root.FindName("TxtPassPlain");
            btnTogglePass = (Button)root.FindName("BtnTogglePass");
            btnTest = (Button)root.FindName("BtnTest");

            lblDbCountBadge = (TextBlock)root.FindName("LblDbCountBadge");
            btnAddAllDbs = (Button)root.FindName("BtnAddAllDbs");
            lblFilterWatermark = (TextBlock)root.FindName("LblFilterWatermark");
            txtDbFilter = (TextBox)root.FindName("TxtDbFilter");
            pnlLeftEmptyHint = (Border)root.FindName("PnlLeftEmptyHint");
            lblLeftEmptyText = (TextBlock)root.FindName("LblLeftEmptyText");
            svDatabases = (ScrollViewer)root.FindName("SvDatabases");
            icDatabases = (ItemsControl)root.FindName("IcDatabases");

            lblQueueBadge = (TextBlock)root.FindName("LblQueueBadge");
            btnClearQueue = (Button)root.FindName("BtnClearQueue");
            pnlRightEmptyState = (Border)root.FindName("PnlRightEmptyState");
            svSelectedQueue = (ScrollViewer)root.FindName("SvSelectedQueue");
            icSelectedQueue = (ItemsControl)root.FindName("IcSelectedQueue");
            pnlExportDock = (Border)root.FindName("PnlExportDock");
            lblDockHeadline = (TextBlock)root.FindName("LblDockHeadline");
            lblDockSubline = (TextBlock)root.FindName("LblDockSubline");
            btnExportExcel = (Button)root.FindName("BtnExportExcel");

            statusDot = (Ellipse)root.FindName("StatusDot");
            lblStatus = (TextBlock)root.FindName("LblStatus");

            icDatabases.ItemsSource = filteredDiscoveredDbs;
            icSelectedQueue.ItemsSource = selectedQueue;

            // Başlık sürükleme ve çift tık büyütme
            headerBar.MouseLeftButtonDown += delegate(object s, MouseButtonEventArgs e)
            {
                if (e.ClickCount == 2)
                {
                    ToggleMaximize();
                }
                else if (e.ButtonState == MouseButtonState.Pressed)
                {
                    try { DragMove(); } catch { }
                }
            };

            btnMin.Click += delegate { WindowState = WindowState.Minimized; };
            btnMax.Click += delegate { ToggleMaximize(); };
            btnClose.Click += delegate { Close(); };

            // Kimlik doğrulama sekmeleri
            tabSqlAuth.MouseLeftButtonDown += delegate { SetAuthMode(false); };
            tabWinAuth.MouseLeftButtonDown += delegate { SetAuthMode(true); };

            // Parola senkronizasyonu & göster/gizle
            pwdBox.PasswordChanged += delegate
            {
                if (syncingPassword) return;
                syncingPassword = true;
                txtPassPlain.Text = pwdBox.Password;
                syncingPassword = false;
            };
            txtPassPlain.TextChanged += delegate
            {
                if (syncingPassword) return;
                syncingPassword = true;
                pwdBox.Password = txtPassPlain.Text;
                syncingPassword = false;
            };
            btnTogglePass.Click += delegate
            {
                isPasswordVisible = !isPasswordVisible;
                if (isPasswordVisible)
                {
                    txtPassPlain.Text = pwdBox.Password;
                    pwdBox.Visibility = Visibility.Collapsed;
                    txtPassPlain.Visibility = Visibility.Visible;
                    txtPassPlain.Focus();
                    txtPassPlain.CaretIndex = txtPassPlain.Text.Length;
                }
                else
                {
                    pwdBox.Password = txtPassPlain.Text;
                    txtPassPlain.Visibility = Visibility.Collapsed;
                    pwdBox.Visibility = Visibility.Visible;
                    pwdBox.Focus();
                }
            };

            // Enter tuşu ile hızlı Sına
            KeyEventHandler enterToTest = delegate(object s, KeyEventArgs e)
            {
                if (e.Key == Key.Enter)
                {
                    e.Handled = true;
                    ExecuteServerTest();
                }
            };
            cmbServer.KeyDown += enterToTest;
            txtUser.KeyDown += enterToTest;
            pwdBox.KeyDown += enterToTest;
            txtPassPlain.KeyDown += enterToTest;

            btnTest.Click += delegate { ExecuteServerTest(); };

            // Veritabanı filtreleme
            txtDbFilter.TextChanged += delegate
            {
                lblFilterWatermark.Visibility = string.IsNullOrEmpty(txtDbFilter.Text)
                    ? Visibility.Visible
                    : Visibility.Collapsed;
                ApplyDatabaseFilter();
            };

            // Sol listedeki veritabanı satırına tıklama (Bubbling Button.Click yakalama)
            icDatabases.AddHandler(ButtonBase.ClickEvent, new RoutedEventHandler(delegate(object s, RoutedEventArgs e)
            {
                Button clicked = e.OriginalSource as Button;
                if (clicked != null && clicked.Tag is DiscoveredDatabaseItem)
                {
                    AddDatabaseToQueue((DiscoveredDatabaseItem)clicked.Tag);
                }
            }));

            btnAddAllDbs.Click += delegate
            {
                int added = 0;
                foreach (DiscoveredDatabaseItem item in filteredDiscoveredDbs)
                {
                    if (AddDatabaseToQueue(item, true))
                    {
                        added++;
                    }
                }
                if (added > 0)
                {
                    RefreshQueueUiState();
                    SetStatus(string.Format("{0} veritabanı toplu olarak aktarım kuyruğuna eklendi.", added), StatusKind.Success);
                }
            };

            // Sağ kuyruktaki kart butonları ([-] Çıkar veya Önizle)
            icSelectedQueue.AddHandler(ButtonBase.ClickEvent, new RoutedEventHandler(delegate(object s, RoutedEventArgs e)
            {
                Button clicked = e.OriginalSource as Button;
                if (clicked != null && clicked.Tag is SelectedDbEntry)
                {
                    SelectedDbEntry entry = (SelectedDbEntry)clicked.Tag;
                    string tip = clicked.ToolTip as string ?? "";
                    if (tip.StartsWith("[-]"))
                    {
                        RemoveFromQueue(entry);
                    }
                    else
                    {
                        OpenPreviewModal(entry);
                    }
                }
            }));

            btnClearQueue.Click += delegate
            {
                selectedQueue.Clear();
                SyncLeftQueuedFlags();
                RefreshQueueUiState();
                SetStatus("Aktarım kuyruğu temizlendi.", StatusKind.Info);
            };

            btnExportExcel.Click += delegate { ExecuteExportFlow(); };
        }

        private void ToggleMaximize()
        {
            WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
        }

        private void SetAuthMode(bool windowsAuth)
        {
            isWindowsAuthMode = windowsAuth;
            if (windowsAuth)
            {
                tabWinAuth.Background = StudioPalette.FreezeBrush("#172B49");
                txtWinAuthTab.Foreground = StudioPalette.SkyBright;
                tabSqlAuth.Background = Brushes.Transparent;
                txtSqlAuthTab.Foreground = StudioPalette.FreezeBrush("#64748B");

                txtUser.IsEnabled = false;
                pwdBox.IsEnabled = false;
                txtPassPlain.IsEnabled = false;
                bdUserBox.Opacity = 0.45;
                bdPassBox.Opacity = 0.45;
                lblAuthHint.Text = "(Windows Oturumu Aktif)";
            }
            else
            {
                tabSqlAuth.Background = StudioPalette.FreezeBrush("#172B49");
                txtSqlAuthTab.Foreground = StudioPalette.SkyBright;
                tabWinAuth.Background = Brushes.Transparent;
                txtWinAuthTab.Foreground = StudioPalette.FreezeBrush("#64748B");

                txtUser.IsEnabled = true;
                pwdBox.IsEnabled = true;
                txtPassPlain.IsEnabled = true;
                bdUserBox.Opacity = 1.0;
                bdPassBox.Opacity = 1.0;
                if (string.IsNullOrWhiteSpace(txtUser.Text)) txtUser.Text = "sa";
                lblAuthHint.Text = "(Örn: sa)";
            }
        }

        private string GetCurrentPassword()
        {
            return isPasswordVisible ? txtPassPlain.Text : pwdBox.Password;
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
            catch { }

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
            if (string.IsNullOrEmpty(trimmed)) trimmed = "localhost";

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

        internal static string GetDisplayHost(string rawServer)
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

        internal static string BuildConnString(string server, string database, string user, string password, int timeoutSec)
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

        private async void ExecuteServerTest()
        {
            await ExecuteServerTestAsync(true);
        }

        private async Task<bool> ExecuteServerTestAsync(bool showModalOnError)
        {
            string rawSrv = (cmbServer.Text ?? "").Trim();
            string user = isWindowsAuthMode ? "" : (txtUser.Text ?? "").Trim();
            string pass = isWindowsAuthMode ? "" : GetCurrentPassword();

            if (string.IsNullOrEmpty(rawSrv))
            {
                SetStatus("Lütfen Sunucu Adı girin.", StatusKind.Error);
                cmbServer.Focus();
                return false;
            }

            btnTest.IsEnabled = false;
            Mouse.OverrideCursor = Cursors.Wait;
            connBadgeDot.Fill = StudioPalette.AmberBright;
            SetStatus(string.Format("'{0}' sunucusuna bağlanılıyor ve veritabanları taranıyor...", rawSrv), StatusKind.Busy);

            try
            {
                List<string> candidates = GetServerCandidates(rawSrv);

                var probeResult = await Task.Run(delegate
                {
                    Exception lastEx = null;
                    string workingSrv = null;
                    string effectiveUser = user;
                    var dbs = new List<string>();

                    foreach (string cand in candidates)
                    {
                        try
                        {
                            using (var conn = new SqlConnection(BuildConnString(cand, "master", effectiveUser, pass, 4)))
                            {
                                conn.Open();
                                using (var cmd = conn.CreateCommand())
                                {
                                    cmd.CommandText = "SELECT name FROM sys.databases WHERE database_id > 4 AND state = 0 ORDER BY name";
                                    using (var reader = cmd.ExecuteReader())
                                    {
                                        while (reader.Read())
                                        {
                                            dbs.Add(reader.GetString(0));
                                        }
                                    }
                                }
                            }
                            workingSrv = cand;
                            break;
                        }
                        catch (Exception ex)
                        {
                            lastEx = ex;
                        }
                    }

                    // Kullanıcı 'sa' bırakıp şifre girmediyse Windows Doğrulaması ile de otomatik dene
                    if (workingSrv == null && string.Equals(user, "sa", StringComparison.OrdinalIgnoreCase) && string.IsNullOrEmpty(pass))
                    {
                        foreach (string cand in candidates)
                        {
                            try
                            {
                                using (var conn = new SqlConnection(BuildConnString(cand, "master", "", "", 4)))
                                {
                                    conn.Open();
                                    using (var cmd = conn.CreateCommand())
                                    {
                                        cmd.CommandText = "SELECT name FROM sys.databases WHERE database_id > 4 AND state = 0 ORDER BY name";
                                        using (var reader = cmd.ExecuteReader())
                                        {
                                            while (reader.Read())
                                            {
                                                dbs.Add(reader.GetString(0));
                                            }
                                        }
                                    }
                                }
                                workingSrv = cand;
                                effectiveUser = "";
                                break;
                            }
                            catch { }
                        }
                    }

                    return Tuple.Create(workingSrv, effectiveUser, dbs, lastEx);
                });

                string resolved = probeResult.Item1;
                string effUser = probeResult.Item2;
                List<string> databases = probeResult.Item3;
                Exception error = probeResult.Item4;

                if (resolved == null)
                {
                    allDiscoveredDbs.Clear();
                    ApplyDatabaseFilter();
                    connBadgeDot.Fill = StudioPalette.RoseBright;
                    string detail = error != null ? error.Message : "Sunucuya ulaşılamadı.";
                    SetStatus("SQL bağlantısı başarısız: " + detail, StatusKind.Error);

                    if (showModalOnError)
                    {
                        StudioModal.ShowMessage(
                            this,
                            "SQL Server Bağlantı Hatası",
                            string.Format("'{0}' sunucusuna bağlanılamadı.\n\nHata Detayı:\n{1}\n\nİpucu: Şifresiz Windows oturumu kullanıyorsanız üstteki 'Windows' sekmesini seçip tekrar 'Sına' butonuna basabilirsiniz.", rawSrv, detail),
                            true
                        );
                    }
                    return false;
                }

                lastRawServer = rawSrv;
                lastResolvedServer = resolved;
                lastTestedUser = effUser;
                lastTestedPassword = pass;

                allDiscoveredDbs.Clear();
                foreach (string dbName in databases)
                {
                    allDiscoveredDbs.Add(new DiscoveredDatabaseItem { Name = dbName });
                }
                SyncLeftQueuedFlags();
                ApplyDatabaseFilter();

                connBadgeDot.Fill = StudioPalette.EmeraldBright;
                UpdateStepIndicators();

                string authDesc = string.IsNullOrEmpty(effUser) ? "Windows Doğrulaması" : ("SQL: " + effUser);
                SetStatus(
                    string.Format("Bağlantı başarılı ({0}) — {1} veritabanı listelendi. Aktarmak istediğiniz veritabanına tıklayın.", authDesc, databases.Count),
                    StatusKind.Success
                );
                return true;
            }
            finally
            {
                btnTest.IsEnabled = true;
                Mouse.OverrideCursor = null;
            }
        }

        private void ApplyDatabaseFilter()
        {
            string q = (txtDbFilter.Text ?? "").Trim();
            filteredDiscoveredDbs.Clear();

            foreach (DiscoveredDatabaseItem item in allDiscoveredDbs)
            {
                if (string.IsNullOrEmpty(q) || item.Name.IndexOf(q, StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    filteredDiscoveredDbs.Add(item);
                }
            }

            lblDbCountBadge.Text = allDiscoveredDbs.Count > 0
                ? string.Format("{0} ADET", allDiscoveredDbs.Count)
                : "0";

            btnAddAllDbs.Visibility = filteredDiscoveredDbs.Count > 1 ? Visibility.Visible : Visibility.Collapsed;

            if (allDiscoveredDbs.Count == 0)
            {
                svDatabases.Visibility = Visibility.Collapsed;
                pnlLeftEmptyHint.Visibility = Visibility.Visible;
                lblLeftEmptyText.Text = "Sunucu bilgilerini kontrol edip \"Sına\" butonuna basın.";
            }
            else if (filteredDiscoveredDbs.Count == 0)
            {
                svDatabases.Visibility = Visibility.Collapsed;
                pnlLeftEmptyHint.Visibility = Visibility.Visible;
                lblLeftEmptyText.Text = string.Format("'{0}' aramasına uygun veritabanı bulunamadı.", q);
            }
            else
            {
                pnlLeftEmptyHint.Visibility = Visibility.Collapsed;
                svDatabases.Visibility = Visibility.Visible;
            }
        }

        private bool AddDatabaseToQueue(DiscoveredDatabaseItem dbItem, bool silent = false)
        {
            if (dbItem == null || string.IsNullOrWhiteSpace(dbItem.Name)) return false;

            string rawSrv = string.IsNullOrEmpty(lastRawServer) ? (cmbServer.Text ?? "").Trim() : lastRawServer;
            string dispHost = GetDisplayHost(rawSrv);
            string candidateKey = (dispHost + ">" + dbItem.Name).ToUpperInvariant();

            SelectedDbEntry existing = selectedQueue.FirstOrDefault(x => x.Key == candidateKey);
            if (existing != null)
            {
                if (!silent)
                {
                    SetStatus(string.Format("'{0}' zaten sağdaki aktarım kuyruğunda yer alıyor.", dbItem.Name), StatusKind.Info);
                }
                return false;
            }

            var entry = new SelectedDbEntry
            {
                RawServerInput = rawSrv,
                ResolvedServer = string.IsNullOrEmpty(lastResolvedServer) ? rawSrv : lastResolvedServer,
                DisplayHost = dispHost,
                DatabaseName = dbItem.Name,
                SqlUser = lastTestedUser,
                SqlPassword = lastTestedPassword
            };

            selectedQueue.Add(entry);
            dbItem.IsQueued = true;

            if (!silent)
            {
                RefreshQueueUiState();
                SetStatus(
                    string.Format("'{0}' aktarım kuyruğuna eklendi — Cariler otomatik taranıyor...", dbItem.Name),
                    StatusKind.Success
                );
            }

            // Arka planda canlı Cari sayısı taraması başlat
            InspectEntryCarilerAsync(entry);
            return true;
        }

        private async void InspectEntryCarilerAsync(SelectedDbEntry entry)
        {
            try
            {
                var info = await Task.Run(delegate
                {
                    using (var conn = new SqlConnection(BuildConnString(entry.ResolvedServer, entry.DatabaseName, entry.SqlUser, entry.SqlPassword, 6)))
                    {
                        conn.Open();
                        Tuple<string, string, string> detected = DetectCariTableAndColumn(conn, entry.CustomSchema, entry.CustomTable, entry.CustomColumn);
                        if (detected == null)
                        {
                            return Tuple.Create(false, "", "", -1);
                        }

                        string qSchema = detected.Item1.Replace("]", "]]");
                        string qTable = detected.Item2.Replace("]", "]]");
                        string qCol = detected.Item3.Replace("]", "]]");

                        string countSql = string.Format(
                            "SELECT COUNT(DISTINCT LTRIM(RTRIM(CAST([{2}] AS NVARCHAR(500))))) " +
                            "FROM [{0}].[{1}] " +
                            "WHERE [{2}] IS NOT NULL AND LTRIM(RTRIM(CAST([{2}] AS NVARCHAR(500)))) <> ''",
                            qSchema, qTable, qCol
                        );

                        int cnt = 0;
                        using (var cmd = new SqlCommand(countSql, conn))
                        {
                            cmd.CommandTimeout = 15;
                            object val = cmd.ExecuteScalar();
                            if (val != null && val != DBNull.Value)
                            {
                                cnt = Convert.ToInt32(val);
                            }
                        }

                        return Tuple.Create(true, detected.Item1 + "." + detected.Item2, detected.Item3, cnt);
                    }
                });

                entry.ScanCompleted = true;
                if (info.Item1)
                {
                    entry.DetectedCount = info.Item4;
                    if (info.Item4 > 0)
                    {
                        entry.ScanBadgeText = string.Format("✓ {0:N0} Cari Hazır ({1}.{2})", info.Item4, info.Item2, info.Item3);
                        entry.ScanBadgeBg = StudioPalette.EmeraldSoftBg;
                        entry.ScanBadgeFg = StudioPalette.EmeraldBright;
                        entry.ScanBadgeBorder = StudioPalette.EmeraldBorder;
                    }
                    else
                    {
                        entry.ScanBadgeText = string.Format("0 Kayıt ({0})", info.Item2);
                        entry.ScanBadgeBg = StudioPalette.AmberSoftBg;
                        entry.ScanBadgeFg = StudioPalette.AmberBright;
                        entry.ScanBadgeBorder = StudioPalette.AmberBorder;
                    }
                }
                else
                {
                    entry.DetectedCount = 0;
                    entry.ScanBadgeText = "⚡ Özel Tablo (Önizle / Aktar'da Seçilir)";
                    entry.ScanBadgeBg = StudioPalette.AmberSoftBg;
                    entry.ScanBadgeFg = StudioPalette.AmberBright;
                    entry.ScanBadgeBorder = StudioPalette.AmberBorder;
                }

                RefreshDockSummaryText();
            }
            catch
            {
                entry.ScanCompleted = true;
                entry.DetectedCount = 0;
                entry.ScanBadgeText = "Bağlantı Kontrolü Gerekli";
                entry.ScanBadgeBg = StudioPalette.RoseSoftBg;
                entry.ScanBadgeFg = StudioPalette.RoseBright;
                entry.ScanBadgeBorder = StudioPalette.RoseBorder;
                RefreshDockSummaryText();
            }
        }

        private void RemoveFromQueue(SelectedDbEntry entry)
        {
            if (entry == null) return;
            selectedQueue.Remove(entry);
            SyncLeftQueuedFlags();
            RefreshQueueUiState();
            SetStatus(string.Format("'{0}' aktarım kuyruğundan çıkarıldı.", entry.DatabaseName), StatusKind.Info);
        }

        private void SyncLeftQueuedFlags()
        {
            string rawSrv = string.IsNullOrEmpty(lastRawServer) ? (cmbServer.Text ?? "").Trim() : lastRawServer;
            string dispHost = GetDisplayHost(rawSrv);

            foreach (DiscoveredDatabaseItem item in allDiscoveredDbs)
            {
                string key = (dispHost + ">" + item.Name).ToUpperInvariant();
                item.IsQueued = selectedQueue.Any(q => q.Key == key);
            }
        }

        private void RefreshQueueUiState()
        {
            int count = selectedQueue.Count;
            lblQueueBadge.Text = count == 0
                ? "0 SEÇİLİ"
                : string.Format("{0} VERİTABANI SEÇİLDİ", count);

            bool hasItems = count > 0;
            pnlRightEmptyState.Visibility = hasItems ? Visibility.Collapsed : Visibility.Visible;
            svSelectedQueue.Visibility = hasItems ? Visibility.Visible : Visibility.Collapsed;
            pnlExportDock.Visibility = hasItems ? Visibility.Visible : Visibility.Collapsed;
            btnClearQueue.Visibility = hasItems ? Visibility.Visible : Visibility.Collapsed;

            btnExportExcel.Content = count <= 1
                ? "Excel'e Aktar (.xlsx)"
                : string.Format("Excel'e Aktar ({0} Veritabanı)", count);

            RefreshDockSummaryText();
            UpdateStepIndicators();
        }

        private void RefreshDockSummaryText()
        {
            int count = selectedQueue.Count;
            if (count == 0) return;

            int totalKnown = 0;
            int readyCount = 0;
            foreach (SelectedDbEntry e in selectedQueue)
            {
                if (e.DetectedCount > 0)
                {
                    totalKnown += e.DetectedCount;
                    readyCount++;
                }
            }

            lblDockHeadline.Text = count == 1
                ? string.Format("{0} — Excel Aktarımına Hazır", selectedQueue[0].DatabaseName)
                : string.Format("{0} Veritabanı Toplu Excel Aktarımına Hazır", count);

            if (totalKnown > 0)
            {
                lblDockSubline.Text = string.Format("Toplam {0:N0} benzersiz cari tespit edildi • Saha Takip uyumlu .xlsx çıktısı", totalKnown);
                if (selectedQueue.All(q => q.ScanCompleted))
                {
                    SetStatus(
                        string.Format("Hazır — Seçilen {0} veritabanında toplam {1:N0} benzersiz cari tespit edildi. \"Excel'e Aktar\" ile dışa aktarabilirsiniz.", count, totalKnown),
                        StatusKind.Success
                    );
                }
            }
            else
            {
                lblDockSubline.Text = "Saha Takip sistemiyle birebir uyumlu Excel (.xlsx) çıktısı üretilecek.";
            }
        }

        private void UpdateStepIndicators()
        {
            bool connected = allDiscoveredDbs.Count > 0;
            bool queued = selectedQueue.Count > 0;

            step1Dot.Fill = connected ? StudioPalette.EmeraldBright : StudioPalette.SkyBright;
            step1Text.Foreground = StudioPalette.FreezeBrush("#F1F5F9");

            step2Dot.Fill = connected ? (queued ? StudioPalette.EmeraldBright : StudioPalette.SkyBright) : StudioPalette.FreezeBrush("#475569");
            step2Text.Foreground = connected ? StudioPalette.FreezeBrush("#F1F5F9") : StudioPalette.FreezeBrush("#64748B");

            step3Dot.Fill = queued ? StudioPalette.EmeraldBright : StudioPalette.FreezeBrush("#475569");
            step3Text.Foreground = queued ? StudioPalette.EmeraldBright : StudioPalette.FreezeBrush("#64748B");
        }

        private enum StatusKind
        {
            Info,
            Busy,
            Success,
            Error
        }

        private void SetStatus(string message, StatusKind kind)
        {
            lblStatus.Text = message;
            switch (kind)
            {
                case StatusKind.Success:
                    statusDot.Fill = StudioPalette.EmeraldBright;
                    lblStatus.Foreground = StudioPalette.FreezeBrush("#D1FAE5");
                    break;
                case StatusKind.Busy:
                    statusDot.Fill = StudioPalette.AmberBright;
                    lblStatus.Foreground = StudioPalette.FreezeBrush("#FDE68A");
                    break;
                case StatusKind.Error:
                    statusDot.Fill = StudioPalette.RoseBright;
                    lblStatus.Foreground = StudioPalette.RoseBright;
                    break;
                default:
                    statusDot.Fill = StudioPalette.SkyBright;
                    lblStatus.Foreground = StudioPalette.SlateMuted;
                    break;
            }
        }

        internal static Tuple<string, string, string> DetectCariTableAndColumn(
            SqlConnection conn,
            string customSchema,
            string customTable,
            string customCol)
        {
            if (!string.IsNullOrEmpty(customSchema) && !string.IsNullOrEmpty(customTable) && !string.IsNullOrEmpty(customCol))
            {
                return Tuple.Create(customSchema, customTable, customCol);
            }

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
                    return match;
                }
            }

            return null;
        }

        private List<string> FetchCarilerInteractive(SelectedDbEntry entry)
        {
            using (var conn = new SqlConnection(BuildConnString(entry.ResolvedServer, entry.DatabaseName, entry.SqlUser, entry.SqlPassword, 10)))
            {
                conn.Open();

                Tuple<string, string, string> target = DetectCariTableAndColumn(conn, entry.CustomSchema, entry.CustomTable, entry.CustomColumn);
                if (target == null)
                {
                    var picker = new StudioTablePickerModal(this, conn, entry.DatabaseName);
                    if (picker.ShowDialog() != true)
                    {
                        return null;
                    }
                    entry.CustomSchema = picker.SelectedSchema;
                    entry.CustomTable = picker.SelectedTable;
                    entry.CustomColumn = picker.SelectedColumn;
                    target = Tuple.Create(entry.CustomSchema, entry.CustomTable, entry.CustomColumn);
                }

                List<string> list = QueryDistinctCariler(conn, target.Item1, target.Item2, target.Item3);
                entry.DetectedCount = list.Count;
                entry.ScanBadgeText = string.Format("✓ {0:N0} Cari Hazır ({1}.{2}.{3})", list.Count, target.Item1, target.Item2, target.Item3);
                entry.ScanBadgeBg = StudioPalette.EmeraldSoftBg;
                entry.ScanBadgeFg = StudioPalette.EmeraldBright;
                entry.ScanBadgeBorder = StudioPalette.EmeraldBorder;
                RefreshDockSummaryText();

                return list;
            }
        }

        internal static List<string> QueryDistinctCariler(SqlConnection conn, string schema, string table, string col)
        {
            string qSchema = schema.Replace("]", "]]");
            string qTable = table.Replace("]", "]]");
            string qCol = col.Replace("]", "]]");

            string query = string.Format(
                "SELECT DISTINCT LTRIM(RTRIM(CAST([{2}] AS NVARCHAR(500)))) AS CariAdi " +
                "FROM [{0}].[{1}] " +
                "WHERE [{2}] IS NOT NULL AND LTRIM(RTRIM(CAST([{2}] AS NVARCHAR(500)))) <> ''",
                qSchema, qTable, qCol
            );

            var uniqueSet = new HashSet<string>(StringComparer.Create(new CultureInfo("tr-TR"), true));
            var result = new List<string>();

            using (var cmd = new SqlCommand(query, conn))
            {
                cmd.CommandTimeout = 60;
                using (var reader = cmd.ExecuteReader())
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

        private void OpenPreviewModal(SelectedDbEntry entry)
        {
            try
            {
                Mouse.OverrideCursor = Cursors.Wait;
                using (var conn = new SqlConnection(BuildConnString(entry.ResolvedServer, entry.DatabaseName, entry.SqlUser, entry.SqlPassword, 8)))
                {
                    conn.Open();
                    Tuple<string, string, string> target = DetectCariTableAndColumn(conn, entry.CustomSchema, entry.CustomTable, entry.CustomColumn);
                    if (target == null)
                    {
                        Mouse.OverrideCursor = null;
                        var picker = new StudioTablePickerModal(this, conn, entry.DatabaseName);
                        if (picker.ShowDialog() != true) return;

                        entry.CustomSchema = picker.SelectedSchema;
                        entry.CustomTable = picker.SelectedTable;
                        entry.CustomColumn = picker.SelectedColumn;
                        target = Tuple.Create(entry.CustomSchema, entry.CustomTable, entry.CustomColumn);
                        Mouse.OverrideCursor = Cursors.Wait;
                    }

                    List<string> cariler = QueryDistinctCariler(conn, target.Item1, target.Item2, target.Item3);
                    entry.DetectedCount = cariler.Count;
                    entry.ScanBadgeText = string.Format("✓ {0:N0} Cari Hazır ({1}.{2}.{3})", cariler.Count, target.Item1, target.Item2, target.Item3);
                    entry.ScanBadgeBg = StudioPalette.EmeraldSoftBg;
                    entry.ScanBadgeFg = StudioPalette.EmeraldBright;
                    entry.ScanBadgeBorder = StudioPalette.EmeraldBorder;
                    RefreshDockSummaryText();

                    Mouse.OverrideCursor = null;
                    var preview = new StudioPreviewModal(this, entry, target.Item1 + "." + target.Item2 + " (" + target.Item3 + ")", cariler, conn);
                    preview.ShowDialog();
                    if (preview.TableChanged)
                    {
                        InspectEntryCarilerAsync(entry);
                    }
                }
            }
            catch (Exception ex)
            {
                Mouse.OverrideCursor = null;
                StudioModal.ShowMessage(this, "Önizleme Hatası", entry.DatabaseName + " okunamadı:\n" + ex.Message, true);
            }
        }

        private void ExecuteExportFlow()
        {
            if (selectedQueue.Count == 0) return;

            List<SelectedDbEntry> entries = selectedQueue.ToList();
            string defaultDir = AppDomain.CurrentDomain.BaseDirectory;
            if (!Directory.Exists(defaultDir))
            {
                defaultDir = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
            }

            var targets = new Dictionary<SelectedDbEntry, string>();

            if (entries.Count == 1)
            {
                SelectedDbEntry single = entries[0];
                var sfd = new SaveFileDialog
                {
                    Title = "Cari Excel (.xlsx) Dosyasını Kaydet",
                    Filter = "Excel Çalışma Kitabı (*.xlsx)|*.xlsx",
                    InitialDirectory = defaultDir,
                    FileName = "Cariler_" + SanitizeFileName(single.DatabaseName) + ".xlsx"
                };
                if (sfd.ShowDialog(this) != true) return;
                targets[single] = sfd.FileName;
            }
            else
            {
                using (var fbd = new WinForms.FolderBrowserDialog())
                {
                    fbd.Description = string.Format("Seçilen {0} veritabanının Excel (.xlsx) dosyalarının kaydedileceği klasörü seçin:", entries.Count);
                    fbd.SelectedPath = defaultDir;
                    if (fbd.ShowDialog() != WinForms.DialogResult.OK) return;

                    foreach (SelectedDbEntry item in entries)
                    {
                        targets[item] = System.IO.Path.Combine(fbd.SelectedPath, "Cariler_" + SanitizeFileName(item.DatabaseName) + ".xlsx");
                    }
                }
            }

            btnExportExcel.IsEnabled = false;
            Mouse.OverrideCursor = Cursors.Wait;
            SetStatus("Veritabanlarından cariler çekiliyor ve Excel (.xlsx) çalışma kitapları üretiliyor...", StatusKind.Busy);

            var exportedFiles = new List<string>();
            var summaryLines = new List<string>();
            var errorLines = new List<string>();

            try
            {
                foreach (var kvp in targets)
                {
                    SelectedDbEntry entry = kvp.Key;
                    string outPath = kvp.Value;

                    try
                    {
                        List<string> cariler = FetchCarilerInteractive(entry);
                        if (cariler == null) continue;
                        if (cariler.Count == 0)
                        {
                            errorLines.Add(entry.DatabaseName + ": Tabloda kayıtlı cari bulunamadı.");
                            continue;
                        }

                        XlsxWriter.WriteCarilerWorkbook(outPath, cariler);
                        exportedFiles.Add(outPath);
                        summaryLines.Add(string.Format("✓  {0}  ➔  {1:N0} Cari  ({2})", entry.DatabaseName, cariler.Count, System.IO.Path.GetFileName(outPath)));
                    }
                    catch (Exception ex)
                    {
                        errorLines.Add(entry.DatabaseName + ": " + ex.Message);
                    }
                }
            }
            finally
            {
                btnExportExcel.IsEnabled = true;
                Mouse.OverrideCursor = null;
            }

            if (exportedFiles.Count > 0)
            {
                SetStatus(string.Format("Aktarım tamamlandı! {0} adet Excel (.xlsx) dosyası başarıyla oluşturuldu.", exportedFiles.Count), StatusKind.Success);
                string details = string.Join("\n", summaryLines);
                if (errorLines.Count > 0)
                {
                    details += "\n\nUyarılar:\n" + string.Join("\n", errorLines);
                }

                bool openFolder = StudioModal.ShowConfirm(
                    this,
                    "Excel Aktarımı Tamamlandı",
                    details,
                    "Klasörde Göster",
                    "Kapat"
                );

                if (openFolder)
                {
                    try
                    {
                        Process.Start("explorer.exe", "/select,\"" + exportedFiles[0] + "\"");
                    }
                    catch { }
                }
            }
            else if (errorLines.Count > 0)
            {
                SetStatus("Aktarım sırasında hata oluştu.", StatusKind.Error);
                StudioModal.ShowMessage(this, "Aktarım Tamamlanamadı", string.Join("\n", errorLines), true);
            }
        }

        internal static string SanitizeFileName(string name)
        {
            foreach (char c in System.IO.Path.GetInvalidFileNameChars())
            {
                name = name.Replace(c, '_');
            }
            return name;
        }

        internal async void RunSelfTest(string outDir)
        {
            try
            {
                await ExecuteServerTestAsync(false);
                await Task.Delay(250);
                CaptureWindowPng(System.IO.Path.Combine(outDir, "ui_step1_connected.png"));

                int added = 0;
                foreach (DiscoveredDatabaseItem item in allDiscoveredDbs)
                {
                    if (item.Name.IndexOf("POLATLAR", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        item.Name.IndexOf("OSMANLI", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        AddDatabaseToQueue(item);
                        added++;
                    }
                }
                if (added == 0)
                {
                    foreach (DiscoveredDatabaseItem item in allDiscoveredDbs.Take(2))
                    {
                        AddDatabaseToQueue(item);
                    }
                }

                // Canlı cari sayısı rozetlerinin tamamlanmasını bekle
                for (int i = 0; i < 25; i++)
                {
                    if (selectedQueue.All(q => q.ScanCompleted)) break;
                    await Task.Delay(120);
                }
                await Task.Delay(200);

                CaptureWindowPng(System.IO.Path.Combine(outDir, "ui_step2_queued.png"));

                SelectedDbEntry validEntry = selectedQueue.FirstOrDefault(q => q.DetectedCount > 0) ?? selectedQueue.FirstOrDefault();
                if (validEntry != null)
                {
                    using (var conn = new SqlConnection(BuildConnString(validEntry.ResolvedServer, validEntry.DatabaseName, validEntry.SqlUser, validEntry.SqlPassword, 8)))
                    {
                        conn.Open();
                        var det = DetectCariTableAndColumn(conn, null, null, null);
                        if (det != null)
                        {
                            List<string> cariler = QueryDistinctCariler(conn, det.Item1, det.Item2, det.Item3);
                            string xlsxPath = System.IO.Path.Combine(outDir, "Cariler_" + SanitizeFileName(validEntry.DatabaseName) + ".xlsx");
                            XlsxWriter.WriteCarilerWorkbook(xlsxPath, cariler);
                            File.WriteAllText(
                                System.IO.Path.Combine(outDir, "selftest_summary.txt"),
                                string.Format("DB={0} COUNT={1} XLSX={2}", validEntry.DatabaseName, cariler.Count, xlsxPath),
                                Encoding.UTF8
                            );
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                File.WriteAllText(System.IO.Path.Combine(outDir, "selftest_error.txt"), ex.ToString(), Encoding.UTF8);
            }
            finally
            {
                Close();
            }
        }

        private void CaptureWindowPng(string filePath)
        {
            UpdateLayout();
            FrameworkElement visual = Content as FrameworkElement;
            if (visual == null) return;

            int w = Math.Max(1, (int)Math.Round(ActualWidth));
            int h = Math.Max(1, (int)Math.Round(ActualHeight));

            var rtb = new RenderTargetBitmap(w, h, 96, 96, PixelFormats.Pbgra32);
            rtb.Render(visual);

            var encoder = new PngBitmapEncoder();
            encoder.Frames.Add(BitmapFrame.Create(rtb));
            using (var fs = new FileStream(filePath, FileMode.Create, FileAccess.Write))
            {
                encoder.Save(fs);
            }
        }
    }

    // ==================== ÖZEL KOYU STÜDYO MODALLARI ====================
    internal static class StudioModal
    {
        public static void ShowMessage(Window owner, string title, string message, bool isError)
        {
            ShowInternal(owner, title, message, isError ? "#FB7185" : "#34D399", "Tamam", null);
        }

        public static bool ShowConfirm(Window owner, string title, string message, string primaryText, string cancelText)
        {
            return ShowInternal(owner, title, message, "#34D399", primaryText, cancelText);
        }

        private static bool ShowInternal(Window owner, string title, string message, string accentHex, string okText, string cancelText)
        {
            var win = new Window
            {
                Owner = owner,
                Title = title,
                Width = 480,
                SizeToContent = SizeToContent.Height,
                WindowStartupLocation = WindowStartupLocation.CenterOwner,
                WindowStyle = WindowStyle.None,
                ResizeMode = ResizeMode.NoResize,
                Background = StudioPalette.FreezeBrush("#0B1324")
            };
            WindowChrome.SetWindowChrome(win, new WindowChrome { CaptionHeight = 0, ResizeBorderThickness = new Thickness(0), GlassFrameThickness = new Thickness(1) });

            var outer = new Border
            {
                Background = StudioPalette.FreezeBrush("#0E172A"),
                BorderBrush = StudioPalette.FreezeBrush("#263A59"),
                BorderThickness = new Thickness(1),
                Padding = new Thickness(22, 18, 22, 18)
            };

            var stack = new StackPanel();
            var titleBlock = new TextBlock
            {
                Text = title,
                Foreground = StudioPalette.FreezeBrush(accentHex),
                FontSize = 15,
                FontWeight = FontWeights.Bold,
                Margin = new Thickness(0, 0, 0, 10)
            };
            stack.Children.Add(titleBlock);

            var bodyBlock = new TextBlock
            {
                Text = message,
                Foreground = StudioPalette.FreezeBrush("#E2E8F0"),
                FontSize = 12.5,
                TextWrapping = TextWrapping.Wrap,
                LineHeight = 19,
                Margin = new Thickness(0, 0, 0, 20)
            };
            stack.Children.Add(bodyBlock);

            var btnRow = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right
            };

            bool result = false;

            if (!string.IsNullOrEmpty(cancelText))
            {
                Button cancelBtn = CreateModalButton(cancelText, "#18263C", "#2A3E5E", "#CBD5E1");
                cancelBtn.Margin = new Thickness(0, 0, 10, 0);
                cancelBtn.Click += delegate { result = false; win.Close(); };
                btnRow.Children.Add(cancelBtn);
            }

            Button okBtn = CreateModalButton(okText, "#059669", "#34D399", "#FFFFFF");
            okBtn.Click += delegate { result = true; win.Close(); };
            btnRow.Children.Add(okBtn);

            stack.Children.Add(btnRow);
            outer.Child = stack;
            win.Content = outer;

            outer.MouseLeftButtonDown += delegate(object s, MouseButtonEventArgs e)
            {
                if (e.ButtonState == MouseButtonState.Pressed)
                {
                    try { win.DragMove(); } catch { }
                }
            };

            win.ShowDialog();
            return result;
        }

        internal static Button CreateModalButton(string text, string bgHex, string borderHex, string fgHex)
        {
            var btn = new Button
            {
                Content = text,
                Cursor = Cursors.Hand,
                Padding = new Thickness(18, 8, 18, 8),
                FontWeight = FontWeights.SemiBold,
                FontSize = 12.2,
                Foreground = StudioPalette.FreezeBrush(fgHex),
                Background = StudioPalette.FreezeBrush(bgHex),
                BorderBrush = StudioPalette.FreezeBrush(borderHex),
                BorderThickness = new Thickness(1)
            };

            var tpl = new ControlTemplate(typeof(Button));
            var bd = new FrameworkElementFactory(typeof(Border));
            bd.SetValue(Border.BackgroundProperty, new TemplateBindingExtension(Control.BackgroundProperty));
            bd.SetValue(Border.BorderBrushProperty, new TemplateBindingExtension(Control.BorderBrushProperty));
            bd.SetValue(Border.BorderThicknessProperty, new TemplateBindingExtension(Control.BorderThicknessProperty));
            bd.SetValue(Border.CornerRadiusProperty, new CornerRadius(8));
            bd.SetValue(Border.PaddingProperty, new TemplateBindingExtension(Control.PaddingProperty));

            var cp = new FrameworkElementFactory(typeof(ContentPresenter));
            cp.SetValue(FrameworkElement.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            cp.SetValue(FrameworkElement.VerticalAlignmentProperty, VerticalAlignment.Center);
            bd.AppendChild(cp);
            tpl.VisualTree = bd;
            btn.Template = tpl;
            return btn;
        }
    }

    // ==================== ÖZEL TABLO & SÜTUN SEÇİCİ MODAL ====================
    internal sealed class StudioTablePickerModal : Window
    {
        public string SelectedSchema { get; private set; }
        public string SelectedTable { get; private set; }
        public string SelectedColumn { get; private set; }

        private readonly SqlConnection conn;
        private readonly List<Tuple<string, string>> tables = new List<Tuple<string, string>>();
        private readonly ListBox lstTables;
        private readonly ListBox lstColumns;

        public StudioTablePickerModal(Window owner, SqlConnection connection, string dbName)
        {
            Owner = owner;
            conn = connection;
            Title = dbName + " — Tablo ve Cari Sütunu Seçimi";
            Width = 560;
            Height = 430;
            WindowStartupLocation = WindowStartupLocation.CenterOwner;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.NoResize;
            Background = StudioPalette.FreezeBrush("#0B1324");
            WindowChrome.SetWindowChrome(this, new WindowChrome { CaptionHeight = 0, ResizeBorderThickness = new Thickness(0), GlassFrameThickness = new Thickness(1) });

            var outer = new Border
            {
                Background = StudioPalette.FreezeBrush("#0E172A"),
                BorderBrush = StudioPalette.FreezeBrush("#263A59"),
                BorderThickness = new Thickness(1),
                Padding = new Thickness(20)
            };

            var root = new Grid();
            root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

            var header = new StackPanel { Margin = new Thickness(0, 0, 0, 12) };
            header.Children.Add(new TextBlock
            {
                Text = dbName + " — Kaynak Cari Tablosu Seçimi",
                Foreground = StudioPalette.SkyBright,
                FontSize = 14.5,
                FontWeight = FontWeights.Bold
            });
            header.Children.Add(new TextBlock
            {
                Text = "Bu veritabanından aktarılacak Cari / Müşteri tablosunu ve ünvan sütununu seçin:",
                Foreground = StudioPalette.SlateMuted,
                FontSize = 11.8,
                Margin = new Thickness(0, 3, 0, 0)
            });
            Grid.SetRow(header, 0);
            root.Children.Add(header);

            var body = new Grid { Margin = new Thickness(0, 0, 0, 14) };
            body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1.25, GridUnitType.Star) });
            body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(12) });
            body.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            lstTables = CreateDarkListBox();
            lstColumns = CreateDarkListBox();

            lstTables.SelectionChanged += delegate { LoadColumnsForSelectedTable(); };

            Grid.SetColumn(lstTables, 0);
            Grid.SetColumn(lstColumns, 2);
            body.Children.Add(lstTables);
            body.Children.Add(lstColumns);
            Grid.SetRow(body, 1);
            root.Children.Add(body);

            var footer = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
            Button cancelBtn = StudioModal.CreateModalButton("İptal", "#18263C", "#2A3E5E", "#CBD5E1");
            cancelBtn.Margin = new Thickness(0, 0, 10, 0);
            cancelBtn.Click += delegate { DialogResult = false; Close(); };

            Button okBtn = StudioModal.CreateModalButton("Seçimi Uygula", "#059669", "#34D399", "#FFFFFF");
            okBtn.Click += delegate
            {
                if (lstTables.SelectedIndex >= 0 && lstColumns.SelectedItem != null)
                {
                    SelectedSchema = tables[lstTables.SelectedIndex].Item1;
                    SelectedTable = tables[lstTables.SelectedIndex].Item2;
                    SelectedColumn = lstColumns.SelectedItem.ToString();
                    DialogResult = true;
                    Close();
                }
            };

            footer.Children.Add(cancelBtn);
            footer.Children.Add(okBtn);
            Grid.SetRow(footer, 2);
            root.Children.Add(footer);

            outer.Child = root;
            Content = outer;

            header.MouseLeftButtonDown += delegate(object s, MouseButtonEventArgs e)
            {
                if (e.ButtonState == MouseButtonState.Pressed) { try { DragMove(); } catch { } }
            };

            LoadTables();
        }

        private static ListBox CreateDarkListBox()
        {
            return new ListBox
            {
                Background = StudioPalette.FreezeBrush("#09101D"),
                Foreground = StudioPalette.FreezeBrush("#E2E8F0"),
                BorderBrush = StudioPalette.FreezeBrush("#1F2F49"),
                BorderThickness = new Thickness(1),
                FontSize = 12,
                Padding = new Thickness(4)
            };
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
                    lstTables.Items.Add(s + "." + t);
                }
            }
            if (lstTables.Items.Count > 0) lstTables.SelectedIndex = 0;
        }

        private void LoadColumnsForSelectedTable()
        {
            lstColumns.Items.Clear();
            if (lstTables.SelectedIndex < 0) return;

            var item = tables[lstTables.SelectedIndex];
            using (var cmd = new SqlCommand("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@s AND TABLE_NAME=@t ORDER BY ORDINAL_POSITION", conn))
            {
                cmd.Parameters.AddWithValue("@s", item.Item1);
                cmd.Parameters.AddWithValue("@t", item.Item2);
                using (var r = cmd.ExecuteReader())
                {
                    while (r.Read())
                    {
                        lstColumns.Items.Add(r.GetString(0));
                    }
                }
            }
            if (lstColumns.Items.Count > 0) lstColumns.SelectedIndex = 0;
        }
    }

    // ==================== CANLI CARİ ÖNİZLEME MODALI ====================
    internal sealed class StudioPreviewModal : Window
    {
        public bool TableChanged { get; private set; }

        public StudioPreviewModal(Window owner, SelectedDbEntry entry, string sourceDesc, List<string> allCariler, SqlConnection openConn)
        {
            Owner = owner;
            Title = entry.DatabaseName + " — Canlı Cari Önizleme";
            Width = 600;
            Height = 480;
            WindowStartupLocation = WindowStartupLocation.CenterOwner;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.NoResize;
            Background = StudioPalette.FreezeBrush("#0B1324");
            WindowChrome.SetWindowChrome(this, new WindowChrome { CaptionHeight = 0, ResizeBorderThickness = new Thickness(0), GlassFrameThickness = new Thickness(1) });

            var outer = new Border
            {
                Background = StudioPalette.FreezeBrush("#0E172A"),
                BorderBrush = StudioPalette.FreezeBrush("#263A59"),
                BorderThickness = new Thickness(1),
                Padding = new Thickness(20)
            };

            var root = new Grid();
            root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

            var header = new StackPanel { Margin = new Thickness(0, 0, 0, 12) };
            header.Children.Add(new TextBlock
            {
                Text = string.Format("{0}  •  {1:N0} Benzersiz Cari Kaydı", entry.DatabaseName, allCariler.Count),
                Foreground = StudioPalette.EmeraldBright,
                FontSize = 15,
                FontWeight = FontWeights.Bold
            });
            header.Children.Add(new TextBlock
            {
                Text = "Kaynak Tablo: " + sourceDesc,
                Foreground = StudioPalette.SlateMuted,
                FontSize = 11.5,
                Margin = new Thickness(0, 2, 0, 0)
            });
            Grid.SetRow(header, 0);
            root.Children.Add(header);

            var searchBox = new TextBox
            {
                Background = StudioPalette.FreezeBrush("#09101D"),
                Foreground = StudioPalette.FreezeBrush("#F8FAFC"),
                CaretBrush = StudioPalette.SkyBright,
                BorderBrush = StudioPalette.FreezeBrush("#1F2F49"),
                BorderThickness = new Thickness(1),
                Padding = new Thickness(10, 6, 10, 6),
                FontSize = 12,
                Margin = new Thickness(0, 0, 0, 10)
            };
            Grid.SetRow(searchBox, 1);
            root.Children.Add(searchBox);

            var listBox = new ListBox
            {
                Background = StudioPalette.FreezeBrush("#09101D"),
                Foreground = StudioPalette.FreezeBrush("#E2E8F0"),
                BorderBrush = StudioPalette.FreezeBrush("#1F2F49"),
                BorderThickness = new Thickness(1),
                FontSize = 12.2,
                Padding = new Thickness(6),
                Margin = new Thickness(0, 0, 0, 14)
            };
            Grid.SetRow(listBox, 2);
            root.Children.Add(listBox);

            Action<string> populate = delegate(string filter)
            {
                listBox.Items.Clear();
                IEnumerable<string> seq = allCariler;
                if (!string.IsNullOrWhiteSpace(filter))
                {
                    seq = seq.Where(x => x.IndexOf(filter.Trim(), StringComparison.OrdinalIgnoreCase) >= 0);
                }
                int idx = 1;
                foreach (string c in seq.Take(250))
                {
                    listBox.Items.Add(string.Format("{0,3}.  {1}", idx++, c));
                }
            };
            populate("");
            searchBox.TextChanged += delegate { populate(searchBox.Text); };

            var footer = new Grid();
            Button changeTableBtn = StudioModal.CreateModalButton("Farklı Tablo / Sütun Seç...", "#16243B", "#293E5E", "#BAE6FD");
            changeTableBtn.HorizontalAlignment = HorizontalAlignment.Left;
            changeTableBtn.Click += delegate
            {
                var picker = new StudioTablePickerModal(this, openConn, entry.DatabaseName);
                if (picker.ShowDialog() == true)
                {
                    entry.CustomSchema = picker.SelectedSchema;
                    entry.CustomTable = picker.SelectedTable;
                    entry.CustomColumn = picker.SelectedColumn;
                    TableChanged = true;
                    Close();
                }
            };

            Button closeBtn = StudioModal.CreateModalButton("Kapat", "#059669", "#34D399", "#FFFFFF");
            closeBtn.HorizontalAlignment = HorizontalAlignment.Right;
            closeBtn.Click += delegate { Close(); };

            footer.Children.Add(changeTableBtn);
            footer.Children.Add(closeBtn);
            Grid.SetRow(footer, 3);
            root.Children.Add(footer);

            outer.Child = root;
            Content = outer;

            header.MouseLeftButtonDown += delegate(object s, MouseButtonEventArgs e)
            {
                if (e.ButtonState == MouseButtonState.Pressed) { try { DragMove(); } catch { } }
            };
        }
    }

    // ==================== DOĞRUDAN OPENXML (.XLSX) ÜRETİCİ MOTOR ====================
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
                "<styleSheet xmlns=\"http://schemas.openxmlformats.org/package/2006/main\">" +
                "<fonts count=\"2\">" +
                "<font><sz val=\"10.5\"/><color rgb=\"FF0F172A\"/><name val=\"Segoe UI\"/></font>" +
                "<font><b/><sz val=\"11\"/><color rgb=\"FFFFFFFF\"/><name val=\"Segoe UI\"/></font>" +
                "</fonts>" +
                "<fills count=\"4\">" +
                "<fill><patternFill patternType=\"none\"/></fill>" +
                "<fill><patternFill patternType=\"gray125\"/></fill>" +
                "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF0F766E\"/><bgColor indexed=\"64\"/></patternFill></fill>" +
                "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFF8FAFC\"/><bgColor indexed=\"64\"/></patternFill></fill>" +
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
                "<cellXfs count=\"4\">" +
                "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>" +
                "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyAlignment=\"1\"><alignment horizontal=\"left\" vertical=\"center\"/></xf>" +
                "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment horizontal=\"left\" vertical=\"center\"/></xf>" +
                "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"3\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment horizontal=\"left\" vertical=\"center\"/></xf>" +
                "</cellXfs>" +
                "<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>" +
                "</styleSheet>";

            int maxLen = 14;
            foreach (string s in cariList)
            {
                if (s != null && s.Length > maxLen) maxLen = s.Length;
            }
            int colWidth = Math.Min(Math.Max(maxLen + 6, 38), 92);

            var sb = new StringBuilder(Math.Max(4096, cariList.Count * 100));
            sb.Append("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>");
            sb.Append("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">");
            sb.Append("<sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/></sheetView></sheetViews>");
            sb.AppendFormat(CultureInfo.InvariantCulture, "<cols><col min=\"1\" max=\"1\" width=\"{0}\" customWidth=\"1\"/></cols>", colWidth);
            sb.Append("<sheetData>");
            sb.Append("<row r=\"1\" ht=\"28\" customHeight=\"1\"><c r=\"A1\" s=\"1\" t=\"inlineStr\"><is><t>Cari Adı</t></is></c></row>");

            int rowNum = 2;
            foreach (string item in cariList)
            {
                string clean = CleanXml(item);
                int styleIdx = (rowNum % 2 == 1) ? 3 : 2;
                sb.AppendFormat(
                    CultureInfo.InvariantCulture,
                    "<row r=\"{0}\" ht=\"21\" customHeight=\"1\"><c r=\"A{0}\" s=\"{1}\" t=\"inlineStr\"><is><t xml:space=\"preserve\">{2}</t></is></c></row>",
                    rowNum,
                    styleIdx,
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
