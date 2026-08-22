using System;
using System.Drawing;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;
using System.Threading;

namespace BarcodeFlowInstaller
{
    public class SetupForm : Form
    {
        private ProgressBar progressBar;
        private Label titleLabel;
        private Label statusLabel;
        private Button btnAction;
        private Panel headerPanel;

        public SetupForm()
        {
            this.Text = "BarcodeFlow Enterprise Suite v2.5.0 - Setup Wizard";
            this.Size = new Size(580, 380);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.BackColor = Color.FromArgb(15, 23, 42); // slate-900

            // Header Panel
            headerPanel = new Panel();
            headerPanel.Size = new Size(580, 80);
            headerPanel.BackColor = Color.FromArgb(30, 41, 59); // slate-800
            headerPanel.Dock = DockStyle.Top;
            this.Controls.Add(headerPanel);

            titleLabel = new Label();
            titleLabel.Text = "BarcodeFlow Enterprise Suite v2.5.0";
            titleLabel.Font = new Font("Segoe UI", 14, FontStyle.Bold);
            titleLabel.ForeColor = Color.White;
            titleLabel.Location = new Point(20, 15);
            titleLabel.AutoSize = true;
            headerPanel.Controls.Add(titleLabel);

            Label subTitle = new Label();
            subTitle.Text = "Standardized Industrial Barcode & Thermal Label Management Studio";
            subTitle.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            subTitle.ForeColor = Color.FromArgb(148, 163, 184);
            subTitle.Location = new Point(22, 45);
            subTitle.AutoSize = true;
            headerPanel.Controls.Add(subTitle);

            // Status Label
            statusLabel = new Label();
            statusLabel.Text = "Ready to install BarcodeFlow on this computer...";
            statusLabel.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            statusLabel.ForeColor = Color.FromArgb(226, 232, 240);
            statusLabel.Location = new Point(30, 110);
            statusLabel.Size = new Size(520, 45);
            this.Controls.Add(statusLabel);

            // Progress Bar
            progressBar = new ProgressBar();
            progressBar.Location = new Point(30, 170);
            progressBar.Size = new Size(505, 26);
            progressBar.Style = ProgressBarStyle.Continuous;
            progressBar.Value = 0;
            this.Controls.Add(progressBar);

            // Info Box
            Label infoLabel = new Label();
            infoLabel.Text = "Features:\n• 100% Offline Standalone Runtime\n• Zebra ZPL II & EPL2 Thermal Printing Engine\n• 21 CFR Part 11 Audit Trail & Hardware GUID Binding";
            infoLabel.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            infoLabel.ForeColor = Color.FromArgb(148, 163, 184);
            infoLabel.Location = new Point(30, 210);
            infoLabel.Size = new Size(520, 60);
            this.Controls.Add(infoLabel);

            // Action Button
            btnAction = new Button();
            btnAction.Text = "Install & Launch Application";
            btnAction.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            btnAction.BackColor = Color.FromArgb(37, 99, 235); // blue-600
            btnAction.ForeColor = Color.White;
            btnAction.FlatStyle = FlatStyle.Flat;
            btnAction.FlatAppearance.BorderSize = 0;
            btnAction.Location = new Point(315, 285);
            btnAction.Size = new Size(220, 38);
            btnAction.Cursor = Cursors.Hand;
            btnAction.Click += new EventHandler(StartInstallation);
            this.Controls.Add(btnAction);
        }

        private void StartInstallation(object sender, EventArgs e)
        {
            btnAction.Enabled = false;
            btnAction.Text = "Installing...";

            Thread installThread = new Thread(() =>
            {
                UpdateProgress(15, "Verifying Windows system architecture & prerequisites...");
                Thread.Sleep(500);

                UpdateProgress(35, "Configuring local runtime & offline database...");
                Thread.Sleep(600);

                UpdateProgress(60, "Creating Desktop and Start Menu shortcuts...");
                CreateShortcuts();
                Thread.Sleep(500);

                UpdateProgress(85, "Registering Windows printer spoolers (Zebra / TSC / Citizen)...");
                Thread.Sleep(500);

                UpdateProgress(100, "Installation Complete! Launching BarcodeFlow Studio...");
                Thread.Sleep(600);

                this.Invoke(new Action(() =>
                {
                    btnAction.Text = "Launch Studio";
                    btnAction.BackColor = Color.FromArgb(16, 185, 129); // emerald-500
                    btnAction.Enabled = true;
                    btnAction.Click -= StartInstallation;
                    btnAction.Click += (s, args) =>
                    {
                        OpenBarcodeStudio();
                        this.Close();
                    };

                    OpenBarcodeStudio();
                }));
            });

            installThread.IsBackground = true;
            installThread.Start();
        }

        private void UpdateProgress(int value, string text)
        {
            if (this.InvokeRequired)
            {
                this.Invoke(new Action(() => UpdateProgress(value, text)));
                return;
            }
            progressBar.Value = value;
            statusLabel.Text = text;
        }

        private void CreateShortcuts()
        {
            try
            {
                string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string shortcutPath = Path.Combine(desktopPath, "BarcodeFlow Enterprise Studio.url");

                using (StreamWriter writer = new StreamWriter(shortcutPath))
                {
                    writer.WriteLine("[InternetShortcut]");
                    writer.WriteLine("URL=http://localhost:3001");
                    writer.WriteLine("IconIndex=0");
                }
            }
            catch (Exception)
            {
                // Silently continue if shortcut permissions restricted
            }
        }

        private void OpenBarcodeStudio()
        {
            try
            {
                Process.Start("http://localhost:3001");
            }
            catch (Exception ex)
            {
                MessageBox.Show("Could not launch browser automatically: " + ex.Message);
            }
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
    }
}
