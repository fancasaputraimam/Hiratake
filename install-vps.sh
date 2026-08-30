#!/usr/bin/env bash
# ============================================================
#  Hiratake — Installer VPS Satu File
#  Cara pakai (Ubuntu/Debian, jalankan sebagai root atau sudo):
#    bash install-vps.sh
#  atau langsung dari GitHub:
#    curl -fsSL https://raw.githubusercontent.com/GANTI_USER/GANTI_REPO/main/install-vps.sh | sudo bash
#
#  Yang dilakukan otomatis:
#   1. Pasang Node.js 20 + git + PM2
#   2. Clone/salin kode aplikasi ke /opt/hiratake
#   3. npm install + build
#   4. Siapkan database SQLite lokal (migrasi + akun default)
#   5. Jalankan sebagai service PM2 (auto-start saat VPS reboot)
#   6. (Opsional) pasang Nginx + HTTPS gratis jika DOMAIN diisi
# ============================================================
set -euo pipefail

# ---------- KONFIGURASI (boleh diubah / lewat environment) ----------
REPO_URL="${REPO_URL:-https://github.com/GANTI_USER/GANTI_REPO.git}"  # repo GitHub aplikasi
APP_DIR="${APP_DIR:-/opt/hiratake}"     # lokasi pemasangan
PORT="${PORT:-3000}"                    # port aplikasi
DOMAIN="${DOMAIN:-}"                    # isi domain (mis. jamur.contoh.com) jika ingin Nginx + HTTPS
EMAIL_SSL="${EMAIL_SSL:-}"              # email untuk sertifikat HTTPS (wajib jika DOMAIN diisi)
PASANG_OPENWA="${PASANG_OPENWA:-0}"     # 1 = pasang juga OpenWA (WhatsApp gateway) via Docker
OPENWA_DIR="${OPENWA_DIR:-/opt/openwa}" # lokasi pemasangan OpenWA
# ---------------------------------------------------------------------

merah()  { echo -e "\033[1;31m$*\033[0m"; }
hijau()  { echo -e "\033[1;32m$*\033[0m"; }
kuning() { echo -e "\033[1;33m$*\033[0m"; }

[ "$(id -u)" -eq 0 ] || { merah "Jalankan sebagai root: sudo bash install-vps.sh"; exit 1; }

hijau "=============================================="
hijau " Hiratake — Instalasi Otomatis dimulai"
hijau "=============================================="

# ---------- 1. Dependensi sistem ----------
kuning "[1/6] Memasang dependensi sistem..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates >/dev/null

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2-3)" -lt 18 ]; then
  kuning "  Memasang Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
fi
hijau "  Node $(node -v), npm $(npm -v)"

command -v pm2 >/dev/null 2>&1 || npm install -g pm2 --silent >/dev/null

# ---------- 2. Ambil kode aplikasi ----------
kuning "[2/6] Mengambil kode aplikasi..."
SUMBER_LOKAL="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo "")"
if [ -n "$SUMBER_LOKAL" ] && [ -f "$SUMBER_LOKAL/package.json" ] && grep -q '"hono"' "$SUMBER_LOKAL/package.json" 2>/dev/null; then
  # Script dijalankan dari dalam folder repo — salin lokal
  kuning "  Menyalin dari folder lokal: $SUMBER_LOKAL"
  mkdir -p "$APP_DIR"
  rsync -a --exclude node_modules --exclude .wrangler --exclude dist "$SUMBER_LOKAL/" "$APP_DIR/" 2>/dev/null || cp -r "$SUMBER_LOKAL/." "$APP_DIR/"
elif [ -d "$APP_DIR/.git" ]; then
  kuning "  Update dari git (sudah pernah terpasang)..."
  git -C "$APP_DIR" pull --ff-only
else
  if echo "$REPO_URL" | grep -q "GANTI_USER"; then
    merah "  REPO_URL belum diisi! Jalankan:"
    merah "  REPO_URL=https://github.com/usermu/repomu.git bash install-vps.sh"
    exit 1
  fi
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# ---------- 3. Install & build ----------
kuning "[3/6] npm install + build (bisa 1-3 menit)..."
npm install --silent >/dev/null
npm run build >/dev/null
hijau "  Build selesai."

# ---------- 4. Database ----------
kuning "[4/6] Menyiapkan database (migrasi + akun default)..."
npx wrangler d1 migrations apply webapp-production --local >/dev/null 2>&1
if [ -f seed.sql ]; then
  npx wrangler d1 execute webapp-production --local --file=./seed.sql >/dev/null 2>&1
fi
hijau "  Database siap (SQLite lokal di .wrangler/state)."

# ---------- 5. Service PM2 ----------
kuning "[5/6] Menjalankan aplikasi via PM2..."
cat > "$APP_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [{
    name: 'hiratake',
    script: 'npx',
    args: 'wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port ${PORT}',
    cwd: '${APP_DIR}',
    watch: false,
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '400M',
    env: { NODE_ENV: 'production', PORT: '${PORT}' }
  }]
}
EOF
pm2 delete hiratake >/dev/null 2>&1 || true
pm2 start "$APP_DIR/ecosystem.config.cjs" >/dev/null
pm2 save >/dev/null
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
sleep 5
if curl -sf "http://127.0.0.1:${PORT}/" >/dev/null; then
  hijau "  Aplikasi jalan di port ${PORT}."
else
  merah "  Aplikasi belum merespons — cek: pm2 logs hiratake --nostream"
fi

# ---------- 6. Nginx + HTTPS (opsional) ----------
if [ -n "$DOMAIN" ]; then
  kuning "[6/6] Memasang Nginx + HTTPS untuk ${DOMAIN}..."
  apt-get install -y -qq nginx certbot python3-certbot-nginx >/dev/null
  cat > "/etc/nginx/sites-available/hiratake" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/hiratake /etc/nginx/sites-enabled/hiratake
  rm -f /etc/nginx/sites-enabled/default
  nginx -t >/dev/null && systemctl reload nginx
  if [ -n "$EMAIL_SSL" ]; then
    certbot --nginx -d "$DOMAIN" -m "$EMAIL_SSL" --agree-tos --non-interactive --redirect || \
      kuning "  Certbot gagal (cek DNS domain sudah mengarah ke IP VPS ini). Situs tetap jalan via HTTP."
  else
    kuning "  EMAIL_SSL kosong — HTTPS dilewati. Situs jalan via HTTP."
  fi
else
  kuning "[6/6] DOMAIN kosong — Nginx/HTTPS dilewati (akses via IP:${PORT})."
fi

# ============================================================
#  TAMBAHAN: Pemasangan OpenWA (WhatsApp API Gateway)
#  Jalankan dengan: PASANG_OPENWA=1 bash install-vps.sh
#  Repo: https://github.com/rmyndharis/OpenWA
# ============================================================
if [ "${PASANG_OPENWA:-0}" = "1" ]; then
  kuning "[+] Memasang OpenWA (WhatsApp API Gateway)..."

  # Docker diperlukan karena OpenWA menjalankan Chromium headless
  if ! command -v docker >/dev/null 2>&1; then
    kuning "    Memasang Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
  fi

  OPENWA_DIR="${OPENWA_DIR:-/opt/openwa}"
  if [ -d "$OPENWA_DIR/.git" ]; then
    git -C "$OPENWA_DIR" pull --ff-only || true
  else
    git clone --depth 1 https://github.com/rmyndharis/OpenWA.git "$OPENWA_DIR"
  fi

  cd "$OPENWA_DIR"
  docker compose -f docker-compose.dev.yml up -d

  hijau ""
  hijau "  ✅ OpenWA berjalan di http://127.0.0.1:2785"
  echo  "     Dashboard OpenWA : http://$(hostname -I | awk '{print $1}'):2785"
  echo  ""
  kuning "  LANGKAH SELANJUTNYA (wajib, lakukan manual):"
  echo  "   1. Buka dashboard OpenWA → buat API Key → SALIN (hanya tampil sekali)"
  echo  "   2. Buat sesi baru (mis. 'hiratake') → Start → scan QR dengan WhatsApp"
  echo  "      ⚠ PAKAI NOMOR KHUSUS, jangan nomor pribadi/utama (risiko diblokir WA)"
  echo  "   3. Simpan kredensial ke aplikasi Hiratake:"
  echo  "        cd ${APP_DIR}"
  echo  "        nano .dev.vars   # isi OPENWA_API_KEY dan OPENWA_WEBHOOK_SECRET"
  echo  "        pm2 restart hiratake"
  echo  "   4. Di dashboard Hiratake → tab WhatsApp → Konfigurasi:"
  echo  "        URL Gateway : http://127.0.0.1:2785"
  echo  "        Nama Sesi   : hiratake"
  echo  "        Centang 'Aktifkan integrasi WhatsApp' → Simpan → Uji Kirim"
  echo  "   5. Daftarkan webhook (perintah siap-tempel ada di tab WhatsApp → Konfigurasi)"
  hijau ""
fi

IP_VPS=$(curl -sf -4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
hijau ""
hijau "=============================================="
hijau " ✅ INSTALASI SELESAI!"
hijau "=============================================="
echo   "  Alamat     : http://${DOMAIN:-$IP_VPS:$PORT}"
[ -n "$DOMAIN" ] && [ -n "$EMAIL_SSL" ] && echo "               https://${DOMAIN}"
echo   "  Login      : /login"
echo   "  Akun       : owner/owner123 · admin/admin123 · karyawan/karyawan123"
merah  "  ⚠ SEGERA ganti semua kata sandi lewat ikon 🔑 setelah login!"
echo   ""
echo   "  Perintah berguna:"
echo   "    pm2 status              — status aplikasi"
echo   "    pm2 logs hiratake       — lihat log"
echo   "    pm2 restart hiratake    — restart"
echo   "    bash install-vps.sh     — update ke versi terbaru (jalankan ulang)"
echo   ""
echo   "  Backup database (SQLite):"
echo   "    tar -czf backup-\$(date +%F).tar.gz -C ${APP_DIR} .wrangler/state"
hijau "=============================================="
