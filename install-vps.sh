#!/usr/bin/env bash
# ============================================================
#  HIRATAKE — Pemasangan Otomatis di VPS (1 file, 1 perintah)
#  Sistem: Ubuntu/Debian (20.04+ disarankan)
#
#  Cara pakai (jalankan sebagai root atau user dengan sudo):
#    curl -fsSL https://raw.githubusercontent.com/fancasaputraimam/Hiratake/main/install-vps.sh | bash
#  atau:
#    wget -qO- https://raw.githubusercontent.com/fancasaputraimam/Hiratake/main/install-vps.sh | bash
#
#  Opsi lewat variabel lingkungan (opsional):
#    PORT=3000            port aplikasi (default 3000)
#    PAKAI_NGINX=1        pasang Nginx reverse proxy ke port 80 (default 1)
#    DOMAIN=jamur.com     isi kalau punya domain (untuk config nginx)
#    APP_DIR=/opt/hiratake  lokasi pemasangan (default /opt/hiratake)
# ============================================================
set -euo pipefail

REPO_URL="https://github.com/fancasaputraimam/Hiratake.git"
APP_DIR="${APP_DIR:-/opt/hiratake}"
PORT="${PORT:-3000}"
PAKAI_NGINX="${PAKAI_NGINX:-1}"
DOMAIN="${DOMAIN:-_}"
DB_NAME="webapp-production"

merah()  { echo -e "\033[1;31m$*\033[0m"; }
hijau()  { echo -e "\033[1;32m$*\033[0m"; }
kuning() { echo -e "\033[1;33m$*\033[0m"; }

# sudo otomatis bila bukan root
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then SUDO="sudo"; else merah "Jalankan sebagai root atau pasang sudo."; exit 1; fi
fi

hijau "=============================================="
hijau "  HIRATAKE — Pemasangan Otomatis VPS"
hijau "  Direktori : $APP_DIR"
hijau "  Port      : $PORT"
hijau "=============================================="

# ---------- 1. Paket dasar ----------
kuning "[1/7] Memasang paket dasar (git, curl, build tools)..."
export DEBIAN_FRONTEND=noninteractive
$SUDO apt-get update -qq
$SUDO apt-get install -y -qq git curl ca-certificates gnupg build-essential >/dev/null

# ---------- 2. Node.js 20 ----------
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  kuning "[2/7] Memasang Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash - >/dev/null 2>&1
  $SUDO apt-get install -y -qq nodejs >/dev/null
else
  kuning "[2/7] Node.js $(node -v) sudah ada — lewati."
fi

# ---------- 3. Ambil kode ----------
kuning "[3/7] Mengambil kode dari GitHub..."
if [ -d "$APP_DIR/.git" ]; then
  $SUDO git -C "$APP_DIR" pull --ff-only
else
  $SUDO mkdir -p "$APP_DIR"
  $SUDO git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi
$SUDO chown -R "$(id -un)":"$(id -gn)" "$APP_DIR" 2>/dev/null || true
cd "$APP_DIR"

# ---------- 4. Dependensi + build ----------
kuning "[4/7] Memasang dependensi & build (bisa 2-5 menit)..."
npm install --no-audit --no-fund
npm run build

# ---------- 5. Database lokal (D1 --local = SQLite) ----------
kuning "[5/7] Menyiapkan database (migrasi + akun default)..."
npx wrangler d1 migrations apply "$DB_NAME" --local >/dev/null
# Seed hanya kalau tabel users masih kosong (aman diulang: INSERT OR IGNORE)
npx wrangler d1 execute "$DB_NAME" --local --file=./seed.sql >/dev/null || true

# ---------- 6. PM2 (jalan terus + auto-start saat reboot) ----------
kuning "[6/7] Menjalankan aplikasi dengan PM2..."
$SUDO npm install -g pm2 >/dev/null 2>&1 || npm install -g pm2 >/dev/null
# ecosystem khusus VPS (port bisa diubah)
cat > ecosystem.vps.cjs <<EOF
module.exports = {
  apps: [{
    name: 'hiratake',
    script: 'npx',
    args: 'wrangler pages dev dist --d1=${DB_NAME} --local --ip 0.0.0.0 --port ${PORT}',
    cwd: '${APP_DIR}',
    watch: false,
    instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'production' }
  }]
}
EOF
pm2 delete hiratake >/dev/null 2>&1 || true
pm2 start ecosystem.vps.cjs
pm2 save >/dev/null
# auto-start saat VPS reboot
pm2 startup systemd -u "$(id -un)" --hp "$HOME" 2>/dev/null | grep '^sudo' | bash || true

# ---------- 7. Nginx (opsional, port 80) ----------
if [ "$PAKAI_NGINX" = "1" ]; then
  kuning "[7/7] Memasang Nginx reverse proxy (port 80 -> $PORT)..."
  $SUDO apt-get install -y -qq nginx >/dev/null
  $SUDO tee /etc/nginx/sites-available/hiratake >/dev/null <<EOF
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
  $SUDO ln -sf /etc/nginx/sites-available/hiratake /etc/nginx/sites-enabled/hiratake
  $SUDO rm -f /etc/nginx/sites-enabled/default
  $SUDO nginx -t && $SUDO systemctl restart nginx
else
  kuning "[7/7] Nginx dilewati (PAKAI_NGINX=0)."
fi

# ---------- Selesai ----------
IP_VPS=$(curl -fsS -4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
sleep 3
if curl -fsS "http://127.0.0.1:${PORT}" >/dev/null 2>&1; then STATUS="✅ AKTIF"; else STATUS="⚠️ cek: pm2 logs hiratake"; fi

hijau ""
hijau "=============================================="
hijau "  PEMASANGAN SELESAI — $STATUS"
hijau "=============================================="
echo   "  Alamat    : http://${IP_VPS}$( [ "$PAKAI_NGINX" = "1" ] && echo '' || echo ":${PORT}" )"
[ "$DOMAIN" != "_" ] && echo "  Domain    : http://${DOMAIN}"
echo   "  Login     : http://${IP_VPS}$( [ "$PAKAI_NGINX" = "1" ] && echo '' || echo ":${PORT}" )/login"
echo   ""
echo   "  Akun awal (SEGERA GANTI SANDI lewat ikon kunci!):"
echo   "    owner / owner123   admin / admin123   karyawan / karyawan123"
echo   ""
echo   "  Perintah berguna:"
echo   "    pm2 status            — cek aplikasi"
echo   "    pm2 logs hiratake     — lihat log"
echo   "    pm2 restart hiratake  — restart"
echo   "    Update versi baru: cd $APP_DIR && git pull && npm install && npm run build && pm2 restart hiratake"
echo   ""
echo   "  Data tersimpan di: $APP_DIR/.wrangler/state/v3/d1 (SQLite)"
echo   "  Backup: tar -czf hiratake-backup-\$(date +%F).tar.gz $APP_DIR/.wrangler"
hijau "=============================================="
