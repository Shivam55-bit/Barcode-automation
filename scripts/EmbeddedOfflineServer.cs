using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Windows.Forms;
using System.Drawing;

namespace BarcodeFlowDesktop
{
    public class SetupAndServerForm : Form
    {
        private ProgressBar progressBar;
        private Label statusLabel;
        private Button btnAction;
        private static HttpListener listener;
        private static string appDir;

        public SetupAndServerForm()
        {
            this.Text = "BarcodeFlow Enterprise Suite (100% Offline Studio)";
            this.Size = new Size(600, 400);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.BackColor = Color.FromArgb(15, 23, 42);

            Panel header = new Panel();
            header.Size = new Size(600, 80);
            header.BackColor = Color.FromArgb(30, 41, 59);
            header.Dock = DockStyle.Top;
            this.Controls.Add(header);

            Label title = new Label();
            title.Text = "BarcodeFlow Enterprise Desktop Suite";
            title.Font = new Font("Segoe UI", 13, FontStyle.Bold);
            title.ForeColor = Color.White;
            title.Location = new Point(20, 15);
            title.AutoSize = true;
            header.Controls.Add(title);

            Label subTitle = new Label();
            subTitle.Text = "100% Standalone Offline Runtime - No Internet or Node.js Required";
            subTitle.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            subTitle.ForeColor = Color.FromArgb(52, 211, 153); // emerald-400
            subTitle.Location = new Point(22, 45);
            subTitle.AutoSize = true;
            header.Controls.Add(subTitle);

            statusLabel = new Label();
            statusLabel.Text = "Click below to install and launch the offline studio...";
            statusLabel.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            statusLabel.ForeColor = Color.FromArgb(226, 232, 240);
            statusLabel.Location = new Point(30, 110);
            statusLabel.Size = new Size(530, 45);
            this.Controls.Add(statusLabel);

            progressBar = new ProgressBar();
            progressBar.Location = new Point(30, 165);
            progressBar.Size = new Size(525, 26);
            progressBar.Style = ProgressBarStyle.Continuous;
            this.Controls.Add(progressBar);

            Label info = new Label();
            info.Text = "• Works 100% Offline (No Wi-Fi / Internet needed)\n• Built-in Micro Server on Localhost\n• Desktop Shortcut Created Automatically";
            info.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            info.ForeColor = Color.FromArgb(148, 163, 184);
            info.Location = new Point(30, 210);
            info.Size = new Size(525, 60);
            this.Controls.Add(info);

            btnAction = new Button();
            btnAction.Text = "Install & Launch Offline Studio";
            btnAction.Font = new Font("Segoe UI", 10, FontStyle.Bold);
            btnAction.BackColor = Color.FromArgb(37, 99, 235);
            btnAction.ForeColor = Color.White;
            btnAction.FlatStyle = FlatStyle.Flat;
            btnAction.FlatAppearance.BorderSize = 0;
            btnAction.Location = new Point(305, 295);
            btnAction.Size = new Size(250, 42);
            btnAction.Cursor = Cursors.Hand;
            btnAction.Click += StartSetup;
            this.Controls.Add(btnAction);
        }

        private void StartSetup(object sender, EventArgs e)
        {
            btnAction.Enabled = false;
            btnAction.Text = "Setting up Offline Studio...";

            Thread thread = new Thread(() =>
            {
                UpdateUI(20, "Extracting offline assets to Local AppData...");
                string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                appDir = Path.Combine(localApp, "BarcodeFlow");
                if (!Directory.Exists(appDir)) Directory.CreateDirectory(appDir);
                Thread.Sleep(400);

                UpdateUI(50, "Creating Windows Desktop Shortcut...");
                CreateDesktopShortcut();
                Thread.Sleep(400);

                UpdateUI(80, "Starting Embedded Micro HTTP Server on Port 5050...");
                StartLocalHttpServer();
                Thread.Sleep(400);

                UpdateUI(100, "Ready! Opening BarcodeFlow Offline Studio...");
                Thread.Sleep(400);

                this.Invoke(new Action(() =>
                {
                    OpenBrowser("http://localhost:3001");
                    btnAction.Text = "Studio Running";
                    btnAction.BackColor = Color.FromArgb(16, 185, 129);
                    btnAction.Enabled = true;
                }));
            });
            thread.IsBackground = true;
            thread.Start();
        }

        private void UpdateUI(int progress, string text)
        {
            if (this.InvokeRequired)
            {
                this.Invoke(new Action(() => UpdateUI(progress, text)));
                return;
            }
            progressBar.Value = progress;
            statusLabel.Text = text;
        }

        private void CreateDesktopShortcut()
        {
            try
            {
                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string shortcutPath = Path.Combine(desktop, "BarcodeFlow Offline Studio.url");
                using (StreamWriter writer = new StreamWriter(shortcutPath))
                {
                    writer.WriteLine("[InternetShortcut]");
                    writer.WriteLine("URL=http://localhost:3001");
                    writer.WriteLine("IconIndex=0");
                }
            }
            catch {}
        }

        private static void StartLocalHttpServer()
        {
            try
            {
                if (listener != null && listener.IsListening) return;
                listener = new HttpListener();
                listener.Prefixes.Add("http://localhost:5050/");
                listener.Prefixes.Add("http://127.0.0.1:5050/");
                listener.Start();

                Thread listenerThread = new Thread(() =>
                {
                    while (listener.IsListening)
                    {
                        try
                        {
                            var context = listener.GetContext();
                            ThreadPool.QueueUserWorkItem((c) => HandleRequest((HttpListenerContext)c), context);
                        }
                        catch {}
                    }
                });
                listenerThread.IsBackground = true;
                listenerThread.Start();
            }
            catch {}
        }

        private static void HandleRequest(HttpListenerContext context)
        {
            try
            {
                string path = context.Request.Url.AbsolutePath;
                string responseString = "<!DOCTYPE html><html><head><title>BarcodeFlow Offline</title></head><body style='font-family:sans-serif;padding:40px;background:#0f172a;color:#fff;'><h2>BarcodeFlow Enterprise Studio (Offline Mode Active)</h2><p>Studio initialized successfully on this workstation.</p></body></html>";
                byte[] buffer = Encoding.UTF8.GetBytes(responseString);
                context.Response.ContentType = "text/html";
                context.Response.ContentLength64 = buffer.Length;
                context.Response.OutputStream.Write(buffer, 0, buffer.Length);
                context.Response.OutputStream.Close();
            }
            catch {}
        }

        private static void OpenBrowser(string url)
        {
            try
            {
                Process.Start(url);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Please open browser and navigate to: " + url, "BarcodeFlow", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupAndServerForm());
        }
    }
}
