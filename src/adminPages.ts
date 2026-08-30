// ===== Halaman Login & Dashboard Hiratake =====

import { asetCss, styleTema } from './tema'

const head = (title: string) => `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/png" href="/static/logo-hiratake.png">
  <link rel="manifest" href="/static/manifest.json">
  <meta name="theme-color" content="#2B2B2B">
  <link rel="apple-touch-icon" href="/static/logo-hiratake.png">
${asetCss}
  ${styleTema('#C73E3A')}`

export const loginPage = () => `<!DOCTYPE html>
<html lang="id">
<head>${head('Login — Hiratake 平茸')}</head>
<body class="bg-washi font-sans text-sumi min-h-screen flex items-center justify-center seigaiha-bg p-4">
  <main class="w-full max-w-md">
    <section class="bg-white rounded-3xl shadow-2xl p-8 border border-sumi/5">
      <header class="text-center mb-8">
        <img src="/static/logo-hiratake.png" alt="Logo Hiratake" class="w-24 h-24 mx-auto rounded-full shadow-lg mb-4">
        <h1 class="font-serifjp text-2xl font-bold">Masuk Hiratake</h1>
        <p class="text-vermillion font-serifjp tracking-[0.3em] text-xs mt-1">ログイン・平茸</p>
        <p class="text-sm text-sumi/50 mt-2">Portal pengelolaan usaha jamur tiram</p>
      </header>
      <form id="login-form" class="space-y-4">
        <div>
          <label for="login-username" class="block text-sm font-medium mb-1">Nama Pengguna</label>
          <div class="relative">
            <i class="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-sumi/30"></i>
            <input id="login-username" type="text" required autocomplete="username" placeholder="username" class="form-input pl-11">
          </div>
        </div>
        <div>
          <label for="login-password" class="block text-sm font-medium mb-1">Kata Sandi</label>
          <div class="relative">
            <i class="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-sumi/30"></i>
            <input id="login-password" type="password" required autocomplete="current-password" placeholder="••••••••" class="form-input pl-11">
          </div>
        </div>
        <p id="login-error" class="hidden text-sm text-vermillion bg-vermillion/10 rounded-lg px-4 py-2"></p>
        <button type="submit" id="login-btn" class="w-full bg-vermillion hover:bg-red-700 text-white font-semibold py-3 rounded-full transition shadow-lg">
          <i class="fas fa-torii-gate mr-2"></i>Masuk
        </button>
      </form>

      <!-- Masuk pakai kode WhatsApp (tampil hanya bila owner mengaktifkan OTP) -->
      <section id="otp-area" class="hidden mt-5 pt-5 border-t border-sumi/10">
        <button type="button" id="btn-mode-otp" class="w-full border-2 border-green-600 text-green-700 hover:bg-green-50 font-semibold py-2.5 rounded-full transition text-sm">
          <i class="fab fa-whatsapp mr-2"></i>Masuk dengan kode WhatsApp
        </button>

        <form id="otp-form" class="hidden space-y-3 mt-1">
          <p class="text-xs text-sumi/60 bg-green-50 rounded-lg px-3 py-2">
            Kode 6 angka akan dikirim ke nomor WhatsApp yang terdaftar pada akun Anda.
          </p>
          <div>
            <label for="otp-username" class="block text-sm font-medium mb-1">Nama Pengguna</label>
            <div class="relative">
              <i class="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-sumi/30"></i>
              <input id="otp-username" type="text" autocomplete="username" placeholder="username" class="form-input pl-11">
            </div>
          </div>
          <button type="button" id="btn-kirim-otp" class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-full transition text-sm">
            <i class="fas fa-paper-plane mr-2"></i>Kirim Kode
          </button>

          <div id="otp-kode-area" class="hidden space-y-3">
            <p id="otp-info" class="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2"></p>
            <div>
              <label for="otp-kode" class="block text-sm font-medium mb-1">Kode Verifikasi</label>
              <div class="relative">
                <i class="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-sumi/30"></i>
                <input id="otp-kode" type="text" inputmode="numeric" maxlength="6" placeholder="000000"
                       class="form-input pl-11 tracking-[0.5em] text-center font-bold text-lg">
              </div>
            </div>
            <button type="submit" id="btn-verifikasi-otp" class="w-full bg-vermillion hover:bg-red-700 text-white font-semibold py-3 rounded-full transition shadow-lg">
              <i class="fas fa-unlock mr-2"></i>Verifikasi & Masuk
            </button>
          </div>
          <p id="otp-error" class="hidden text-sm text-vermillion bg-vermillion/10 rounded-lg px-4 py-2"></p>
          <button type="button" id="btn-mode-sandi" class="w-full text-xs text-sumi/50 hover:text-vermillion transition py-1">
            <i class="fas fa-arrow-left mr-1"></i>Kembali ke login kata sandi
          </button>
        </form>
      </section>

      <footer class="mt-6 text-center">
        <a href="/" class="text-sm text-sumi/50 hover:text-vermillion transition"><i class="fas fa-arrow-left mr-1"></i>Kembali ke Beranda</a>
      </footer>
    </section>
    <p class="text-center text-xs text-sumi/40 mt-4">© 2026 Hiratake 平茸</p>
  </main>
  <script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('login-btn');
      const err = document.getElementById('login-error');
      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Memproses...';
      err.classList.add('hidden');
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: document.getElementById('login-username').value.trim(),
            password: document.getElementById('login-password').value
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login gagal');
        window.location.href = '/admin';
      } catch (ex) {
        err.textContent = ex.message; err.classList.remove('hidden');
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-torii-gate mr-2"></i>Masuk';
      }
    });

    // ---------- Login via kode WhatsApp (OTP OpenWA) ----------
    const $ = (id) => document.getElementById(id);
    const formSandi = $('login-form');
    const formOtp = $('otp-form');
    const otpErr = $('otp-error');

    // Tombol hanya muncul bila integrasi aktif & OTP login dinyalakan owner
    fetch('/api/auth/otp/tersedia').then((r) => r.json()).then((d) => {
      if (d.tersedia) $('otp-area').classList.remove('hidden');
    }).catch(() => {});

    $('btn-mode-otp').addEventListener('click', () => {
      formSandi.classList.add('hidden');
      $('btn-mode-otp').classList.add('hidden');
      formOtp.classList.remove('hidden');
      $('otp-username').value = $('login-username').value.trim();
      $('otp-username').focus();
    });

    $('btn-mode-sandi').addEventListener('click', () => {
      formOtp.classList.add('hidden');
      $('btn-mode-otp').classList.remove('hidden');
      formSandi.classList.remove('hidden');
      otpErr.classList.add('hidden');
    });

    $('btn-kirim-otp').addEventListener('click', async () => {
      const b = $('btn-kirim-otp');
      const username = $('otp-username').value.trim();
      otpErr.classList.add('hidden');
      if (!username) { otpErr.textContent = 'Nama pengguna wajib diisi.'; otpErr.classList.remove('hidden'); return; }
      b.disabled = true; b.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mengirim...';
      try {
        const res = await fetch('/api/auth/otp/minta', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Gagal mengirim kode');
        $('otp-kode-area').classList.remove('hidden');
        $('otp-info').textContent = d.waSensor
          ? 'Kode dikirim ke WhatsApp ' + d.waSensor + '. Berlaku ' + (d.menit || 5) + ' menit.'
          : d.pesan || 'Kode sudah dikirim bila akun terdaftar.';
        $('otp-kode').focus();
        // Beri jeda sebelum boleh minta kode lagi (hindari spam)
        let sisa = 60;
        b.innerHTML = 'Kirim ulang (' + sisa + 's)';
        const t = setInterval(() => {
          sisa--;
          if (sisa <= 0) { clearInterval(t); b.disabled = false; b.innerHTML = '<i class="fas fa-redo mr-2"></i>Kirim ulang kode'; }
          else b.innerHTML = 'Kirim ulang (' + sisa + 's)';
        }, 1000);
      } catch (ex) {
        otpErr.textContent = ex.message; otpErr.classList.remove('hidden');
        b.disabled = false; b.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Kirim Kode';
      }
    });

    formOtp.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = $('btn-verifikasi-otp');
      otpErr.classList.add('hidden');
      b.disabled = true; b.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Memeriksa...';
      try {
        const res = await fetch('/api/auth/otp/verifikasi', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: $('otp-username').value.trim(), kode: $('otp-kode').value.trim() })
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Kode tidak valid');
        window.location.href = '/admin';
      } catch (ex) {
        otpErr.textContent = ex.message; otpErr.classList.remove('hidden');
        b.disabled = false; b.innerHTML = '<i class="fas fa-unlock mr-2"></i>Verifikasi & Masuk';
      }
    });
  </script>
</body>
</html>`

export const adminPage = () => `<!DOCTYPE html>
<html lang="id">
<head>${head('Dashboard — Hiratake 平茸')}</head>
<body class="bg-washi font-sans text-sumi min-h-screen">
  <div id="loading-screen" class="fixed inset-0 bg-washi flex items-center justify-center z-50">
    <div class="text-center">
      <img src="/static/logo-hiratake.png" alt="Logo" class="w-20 h-20 mx-auto rounded-full animate-pulse mb-3">
      <p class="text-sm text-sumi/50">Memuat dashboard...</p>
    </div>
  </div>

  <!-- Header atas -->
  <header class="bg-sumi text-washi fixed top-0 left-0 right-0 z-40 shadow-lg h-16">
    <div class="h-full px-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button id="sidebar-toggle" class="lg:hidden text-xl w-10 h-10 rounded-lg hover:bg-white/10 transition" aria-label="Buka menu">
          <i class="fas fa-bars"></i>
        </button>
        <a href="/" class="flex items-center gap-3">
          <img src="/static/logo-hiratake.png" alt="Logo" class="w-10 h-10 rounded-full ring-1 ring-white/20">
          <div class="hidden sm:block">
            <span class="font-serifjp font-bold">HIRATAKE</span>
            <span class="block text-[10px] text-kin tracking-widest -mt-0.5">PANEL PENGELOLAAN・管理</span>
          </div>
        </a>
      </div>
      <div class="flex items-center gap-2 sm:gap-3">
        <button id="notif-btn" class="relative w-10 h-10 rounded-lg hover:bg-white/10 transition" title="Notifikasi" aria-label="Notifikasi">
          <i class="fas fa-bell"></i>
          <span id="notif-badge" class="hidden absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-vermillion text-[10px] font-bold flex items-center justify-center">0</span>
        </button>
        <div class="text-right">
          <p id="user-nama" class="text-sm font-semibold"></p>
          <p id="user-role" class="text-[11px] text-kin uppercase tracking-wider"></p>
        </div>
        <button data-modal="modal-sandi" class="w-10 h-10 rounded-lg hover:bg-white/10 transition" title="Ganti kata sandi" aria-label="Ganti kata sandi"><i class="fas fa-key"></i></button>
        <button id="logout-btn" class="bg-vermillion hover:bg-red-700 px-4 py-2 rounded-full text-sm transition" title="Keluar">
          <i class="fas fa-right-from-bracket sm:mr-1"></i><span class="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Overlay gelap saat sidebar terbuka di HP -->
  <div id="sidebar-overlay" class="fixed inset-0 bg-black/50 z-40 hidden lg:hidden"></div>

  <!-- Panel notifikasi -->
  <div id="notif-panel" class="hidden fixed top-16 right-3 sm:right-6 w-[calc(100vw-1.5rem)] max-w-sm bg-white text-sumi rounded-2xl shadow-2xl z-50 overflow-hidden">
    <div class="px-4 py-3 bg-sumi text-washi flex items-center justify-between">
      <p class="font-serifjp font-semibold text-sm"><i class="fas fa-bell mr-2 text-kin"></i>Notifikasi</p>
      <button id="notif-tutup" class="text-washi/60 hover:text-washi" aria-label="Tutup"><i class="fas fa-times"></i></button>
    </div>
    <div id="notif-isi" class="max-h-80 overflow-y-auto divide-y divide-gray-100"></div>
  </div>

  <!-- Modal ganti kata sandi sendiri -->
  <div id="modal-sandi" class="modal hidden">
    <div class="modal-box">
      <button type="button" class="modal-close" data-close="modal-sandi" aria-label="Tutup"><i class="fas fa-times"></i></button>
      <form id="form-sandi" class="space-y-3">
        <h2 class="font-serifjp font-semibold"><i class="fas fa-key text-vermillion mr-2"></i>Ganti Kata Sandi</h2>
        <p class="text-xs text-sumi/50 bg-washi rounded-lg p-2.5">Setelah berhasil, semua perangkat lain otomatis keluar (logout) demi keamanan.</p>
        <div><label class="block text-sm mb-1" for="sandi-lama">Kata Sandi Lama</label><input id="sandi-lama" type="password" required class="form-input" autocomplete="current-password"></div>
        <div><label class="block text-sm mb-1" for="sandi-baru">Kata Sandi Baru</label><input id="sandi-baru" type="password" required minlength="6" class="form-input" autocomplete="new-password"></div>
        <div><label class="block text-sm mb-1" for="sandi-ulang">Ulangi Sandi Baru</label><input id="sandi-ulang" type="password" required minlength="6" class="form-input" autocomplete="new-password"></div>
        <button class="w-full bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-medium transition">Simpan Sandi Baru</button>
      </form>
    </div>
  </div>

  <!-- Modal cicilan piutang -->
  <div id="modal-cicil" class="modal hidden">
    <div class="modal-box">
      <button type="button" class="modal-close" data-close="modal-cicil" aria-label="Tutup"><i class="fas fa-times"></i></button>
      <form id="form-cicil" class="space-y-3">
        <h2 class="font-serifjp font-semibold"><i class="fas fa-hand-holding-dollar text-kin mr-2"></i>Pembayaran Piutang</h2>
        <input type="hidden" id="cicil-penjualan-id">
        <div class="bg-washi rounded-lg p-3 text-sm space-y-0.5">
          <p id="cicil-info-pembeli" class="font-semibold"></p>
          <p>Total: <span id="cicil-info-total" class="font-semibold"></span> · Sisa: <span id="cicil-info-sisa" class="font-semibold text-vermillion"></span></p>
        </div>
        <div id="cicil-riwayat" class="text-xs text-sumi/60 space-y-1"></div>
        <div><label class="block text-sm mb-1" for="cicil-tanggal">Tanggal Bayar</label><input id="cicil-tanggal" type="date" required class="form-input"></div>
        <div><label class="block text-sm mb-1" for="cicil-jumlah">Jumlah (Rp)</label><input id="cicil-jumlah" type="number" min="1" required class="form-input" placeholder="boleh sebagian (cicilan)"></div>
        <div><label class="block text-sm mb-1" for="cicil-catatan">Catatan</label><input id="cicil-catatan" type="text" class="form-input" placeholder="opsional"></div>
        <button class="w-full bg-kin hover:bg-yellow-700 text-white py-2.5 rounded-full font-medium transition">Catat Pembayaran</button>
      </form>
    </div>
  </div>

  <!-- Sidebar navigasi -->
  <aside id="sidebar" class="sidebar bg-sumi text-washi" aria-label="Navigasi utama">
    <nav id="tab-nav" class="flex flex-col gap-1 p-3">
      <p class="sidebar-group">Operasional</p>
      <button data-tab="dashboard" class="tab-btn active"><i class="fas fa-chart-line"></i>Ringkasan</button>
      <button data-tab="baglog" class="tab-btn"><i class="fas fa-cubes"></i>Baglog</button>
      <button data-tab="panen" class="tab-btn"><i class="fas fa-wheat-awn"></i>Panen</button>
      <button data-tab="penjualan" class="tab-btn"><i class="fas fa-cash-register"></i>Penjualan</button>
      <button data-tab="pesanan" class="tab-btn"><i class="fas fa-clipboard-list"></i>Pesanan<span id="badge-pesanan" class="nav-badge nav-badge-kin hidden">0</span></button>
      <button data-tab="stok" class="tab-btn"><i class="fas fa-boxes-stacked"></i>Stok</button>
      <p class="sidebar-group">Pelanggan & Tagihan</p>
      <button data-tab="piutang" class="tab-btn"><i class="fas fa-file-invoice-dollar"></i>Piutang<span id="badge-piutang" class="nav-badge hidden">0</span></button>
      <button data-tab="pelanggan" class="tab-btn"><i class="fas fa-address-book"></i>Pelanggan</button>
      <p class="sidebar-group">Tim</p>
      <button data-tab="absensi" class="tab-btn"><i class="fas fa-user-clock"></i>Absensi</button>
      <button data-tab="gaji" class="tab-btn hidden" data-roles="owner"><i class="fas fa-money-check-dollar"></i>Gaji</button>
      <p class="sidebar-group hidden" data-roles="owner,admin">Keuangan</p>
      <button data-tab="keuangan" class="tab-btn hidden" data-roles="owner,admin"><i class="fas fa-wallet"></i>Keuangan</button>
      <button data-tab="laporan" class="tab-btn hidden" data-roles="owner,admin"><i class="fas fa-file-lines"></i>Laporan</button>
      <p class="sidebar-group hidden" data-roles="owner,admin">Pengelolaan</p>
      <button data-tab="produk" class="tab-btn hidden" data-roles="owner,admin"><i class="fas fa-box"></i>Produk</button>
      <button data-tab="pengguna" class="tab-btn hidden" data-roles="owner"><i class="fas fa-users"></i>Pengguna</button>
      <button data-tab="aktivitas" class="tab-btn hidden" data-roles="owner"><i class="fas fa-clock-rotate-left"></i>Aktivitas</button>
      <button data-tab="whatsapp" class="tab-btn hidden" data-roles="owner,admin"><i class="fab fa-whatsapp"></i>WhatsApp<span id="badge-wa" class="nav-badge hidden">0</span></button>
      <button data-tab="pembayaran" class="tab-btn hidden" data-roles="owner,admin"><i class="fas fa-credit-card"></i>Pembayaran<span id="badge-bayar" class="nav-badge nav-badge-kin hidden">0</span></button>
      <button data-tab="pengaturan" class="tab-btn hidden" data-roles="owner,admin"><i class="fas fa-gear"></i>Website</button>
      <button data-tab="situs" class="tab-btn hidden" data-roles="owner"><i class="fas fa-globe"></i>Pengaturan Situs</button>
      <button data-tab="otomatis" class="tab-btn hidden" data-roles="owner,admin"><i class="fas fa-robot"></i>Otomatisasi<span id="badge-otomatis" class="nav-badge hidden">0</span></button>
    </nav>
  </aside>

  <main id="main-content" class="main-content px-4 py-6">
    <!-- Tab: Ringkasan -->
    <section id="tab-dashboard" class="tab-panel">
      <div id="peringatan-dashboard" class="space-y-2 mb-4"></div>
      <div id="target-wrap" class="hidden bg-white rounded-2xl shadow p-5 mb-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 class="font-serifjp font-semibold text-sm"><i class="fas fa-bullseye text-vermillion mr-2"></i>Target Panen Bulan Ini</h2>
          <p class="text-sm"><span id="target-tercapai" class="font-bold text-matcha">0</span> / <span id="target-angka">0</span> kg (<span id="target-persen">0</span>%)</p>
        </div>
        <div class="h-3 bg-washi rounded-full overflow-hidden"><div id="target-bar" class="h-full bg-matcha rounded-full transition-all" style="width:0%"></div></div>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" id="stat-cards"></div>
      <div class="grid lg:grid-cols-2 gap-6">
        <section class="bg-white rounded-2xl shadow p-5">
          <h2 class="font-serifjp font-semibold mb-3"><i class="fas fa-wheat-awn text-matcha mr-2"></i>Panen 7 Hari Terakhir</h2>
          <canvas id="chart-panen" height="200"></canvas>
        </section>
        <section class="bg-white rounded-2xl shadow p-5">
          <h2 class="font-serifjp font-semibold mb-3"><i class="fas fa-coins text-kin mr-2"></i>Penjualan 7 Hari Terakhir</h2>
          <canvas id="chart-penjualan" height="200"></canvas>
        </section>
      </div>
    </section>

    <!-- Tab: Baglog -->
    <section id="tab-baglog" class="tab-panel hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-cubes text-vermillion mr-2"></i>Baglog</h2>
        <div class="flex gap-2">
          <button data-modal="modal-baglog" class="btn-tambah hidden" data-roles="owner,admin"><i class="fas fa-plus mr-1"></i>Batch Baru</button>
          <button data-modal="modal-kejadian" class="btn-tambah-kin"><i class="fas fa-triangle-exclamation mr-1"></i>Lapor Kejadian</button>
        </div>
      </div>
      <div id="modal-baglog" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-baglog" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-baglog" class="space-y-3">
            <h2 class="font-serifjp font-semibold"><i class="fas fa-plus-circle text-vermillion mr-2"></i>Batch Baglog Baru</h2>
            <p class="text-xs text-sumi/50">Kode batch dibuat otomatis (BG-TAHUN-BULAN-URUT)</p>
            <div><label class="block text-sm mb-1" for="bg-tanggal">Tanggal Produksi/Beli</label><input id="bg-tanggal" type="date" required class="form-input"></div>
            <div><label class="block text-sm mb-1" for="bg-jumlah">Jumlah Baglog</label><input id="bg-jumlah" type="number" min="1" required placeholder="cth: 500" class="form-input"></div>
            <div><label class="block text-sm mb-1" for="bg-sumber">Sumber</label><input id="bg-sumber" type="text" placeholder="produksi sendiri / nama supplier" value="produksi sendiri" class="form-input"></div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-sm mb-1" for="bg-biaya">Biaya/Baglog (Rp)</label><input id="bg-biaya" type="number" min="0" value="0" class="form-input"></div>
              <div><label class="block text-sm mb-1" for="bg-lokasi">Lokasi/Rak</label><input id="bg-lokasi" type="text" placeholder="Kumbung 1" class="form-input"></div>
            </div>
            <div><label class="block text-sm mb-1" for="bg-masuk">Tgl Masuk Kumbung <span class="text-sumi/40">(kosongkan jika masih inkubasi)</span></label><input id="bg-masuk" type="date" class="form-input"></div>
            <div><label class="block text-sm mb-1" for="bg-catatan">Catatan</label><input id="bg-catatan" type="text" placeholder="opsional" class="form-input"></div>
            <button class="w-full bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-medium transition">Simpan Batch</button>
          </form>
        </div>
      </div>
      <div id="modal-kejadian" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-kejadian" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-kejadian" class="space-y-3">
            <h2 class="font-serifjp font-semibold"><i class="fas fa-triangle-exclamation text-kin mr-2"></i>Lapor Kejadian</h2>
            <p class="text-xs text-sumi/50">Kontaminasi / rusak / afkir sebagian — semua peran bisa lapor</p>
            <div><label class="block text-sm mb-1" for="kj-batch">Batch</label><select id="kj-batch" class="form-input"></select></div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-sm mb-1" for="kj-tanggal">Tanggal</label><input id="kj-tanggal" type="date" required class="form-input"></div>
              <div><label class="block text-sm mb-1" for="kj-jumlah">Jumlah</label><input id="kj-jumlah" type="number" min="1" required class="form-input"></div>
            </div>
            <div><label class="block text-sm mb-1" for="kj-jenis">Jenis</label>
              <select id="kj-jenis" class="form-input">
                <option value="kontaminasi">Kontaminasi (jamur liar/bakteri)</option>
                <option value="rusak">Rusak (sobek/jatuh)</option>
                <option value="afkir">Afkir sebagian</option>
              </select>
            </div>
            <div><label class="block text-sm mb-1" for="kj-catatan">Catatan</label><input id="kj-catatan" type="text" placeholder="opsional" class="form-input"></div>
            <button class="w-full bg-kin hover:bg-yellow-700 text-white py-2.5 rounded-full font-medium transition">Lapor</button>
          </form>
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
          <h2 class="font-serifjp font-semibold mb-3">Daftar Batch <span class="text-xs font-normal text-sumi/40">(klik baris untuk riwayat kejadian)</span></h2>
          <table class="w-full text-sm data-table" id="table-baglog"></table>
          <div id="detail-kejadian" class="hidden mt-4 border-t pt-4">
            <h3 class="font-semibold text-sm mb-2" id="detail-kejadian-judul"></h3>
            <table class="w-full text-sm data-table" id="table-kejadian"></table>
          </div>
      </div>
    </section>

    <!-- Tab: Panen -->
    <section id="tab-panen" class="tab-panel hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-wheat-awn text-matcha mr-2"></i>Panen</h2>
        <button data-modal="modal-panen" class="btn-tambah-matcha"><i class="fas fa-plus mr-1"></i>Catat Panen</button>
      </div>
      <div id="modal-panen" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-panen" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-panen" class="space-y-3">
          <h2 class="font-serifjp font-semibold"><i class="fas fa-plus-circle text-matcha mr-2"></i>Catat Panen</h2>
          <div><label class="block text-sm mb-1" for="panen-tanggal">Tanggal</label><input id="panen-tanggal" type="date" required class="form-input"></div>
          <div><label class="block text-sm mb-1" for="panen-batch">Batch Baglog <span class="text-sumi/40">(disarankan diisi!)</span></label><select id="panen-batch" class="form-input"><option value="">— tanpa batch —</option></select></div>
          <div class="grid grid-cols-3 gap-2">
            <div><label class="block text-sm mb-1" for="panen-ga">Grade A (kg)</label><input id="panen-ga" type="number" step="0.1" min="0" placeholder="0" class="form-input"></div>
            <div><label class="block text-sm mb-1" for="panen-gb">Grade B (kg)</label><input id="panen-gb" type="number" step="0.1" min="0" placeholder="0" class="form-input"></div>
            <div><label class="block text-sm mb-1" for="panen-gc">Grade C (kg)</label><input id="panen-gc" type="number" step="0.1" min="0" placeholder="0" class="form-input"></div>
          </div>
          <p class="text-xs text-sumi/50">A: mulus besar · B: sedang · C: kecil/sobek</p>
          <div><label class="block text-sm mb-1" for="panen-susut">Susut/BS (kg)</label><input id="panen-susut" type="number" step="0.1" min="0" placeholder="0" class="form-input"></div>
          <p class="text-sm">Total panen: <strong id="panen-total-preview" class="text-matcha">0 kg</strong></p>
          <div><label class="block text-sm mb-1" for="panen-catatan">Catatan</label><input id="panen-catatan" type="text" placeholder="opsional" class="form-input"></div>
          <button class="w-full bg-matcha hover:bg-green-800 text-white py-2.5 rounded-full font-medium transition">Simpan</button>
        </form>
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 class="font-serifjp font-semibold">Riwayat Panen</h2>
          <div class="flex flex-wrap items-center gap-2">
            <input type="month" id="panen-filter-bulan" class="form-input !w-auto !py-1.5 text-sm" title="Filter bulan">
            <input type="search" id="panen-cari" class="form-input !w-36 !py-1.5 text-sm" placeholder="Cari...">
            <button id="ekspor-panen" class="hidden text-sm border border-matcha text-matcha hover:bg-matcha hover:text-white px-3 py-1.5 rounded-full transition" data-roles="owner,admin"><i class="fas fa-file-csv mr-1"></i>CSV</button>
          </div>
        </div>
        <table class="w-full text-sm data-table" id="table-panen"></table>
      </div>
    </section>

    <!-- Tab: Penjualan -->
    <section id="tab-penjualan" class="tab-panel hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-cash-register text-kin mr-2"></i>Penjualan</h2>
        <button data-modal="modal-penjualan" class="btn-tambah-kin"><i class="fas fa-plus mr-1"></i>Catat Penjualan</button>
      </div>
      <div id="modal-penjualan" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-penjualan" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-penjualan" class="space-y-3">
          <h2 class="font-serifjp font-semibold"><i class="fas fa-plus-circle text-kin mr-2"></i>Catat Penjualan</h2>
          <div><label class="block text-sm mb-1" for="jual-tanggal">Tanggal</label><input id="jual-tanggal" type="date" required class="form-input"></div>
          <div><label class="block text-sm mb-1" for="jual-produk">Produk</label><select id="jual-produk" class="form-input"></select></div>
          <div><label class="block text-sm mb-1" for="jual-jumlah">Jumlah</label><input id="jual-jumlah" type="number" min="1" value="1" required class="form-input"></div>
          <div><label class="block text-sm mb-1" for="jual-pelanggan">Pelanggan Terdaftar</label><select id="jual-pelanggan" class="form-input"><option value="">— umum / tanpa nama —</option></select></div>
          <div><label class="block text-sm mb-1" for="jual-pembeli">Atau Nama Pembeli Bebas</label><input id="jual-pembeli" type="text" placeholder="jika bukan pelanggan terdaftar" class="form-input"></div>
          <div><label class="block text-sm mb-1" for="jual-bayar">Pembayaran</label>
            <select id="jual-bayar" class="form-input">
              <option value="lunas">Lunas (cash)</option>
              <option value="tempo">Tempo (piutang)</option>
            </select>
          </div>
          <div id="jual-tempo-wrap" class="hidden"><label class="block text-sm mb-1" for="jual-tempo">Jatuh Tempo</label><input id="jual-tempo" type="date" class="form-input"></div>
          <p class="text-sm text-sumi/60">Total: <strong id="jual-total" class="text-vermillion">Rp 0</strong></p>
          <button class="w-full bg-kin hover:bg-yellow-700 text-white py-2.5 rounded-full font-medium transition">Simpan</button>
        </form>
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 class="font-serifjp font-semibold">Riwayat Penjualan</h2>
          <div class="flex flex-wrap items-center gap-2">
            <input type="month" id="jual-filter-bulan" class="form-input !w-auto !py-1.5 text-sm" title="Filter bulan">
            <input type="search" id="jual-cari" class="form-input !w-36 !py-1.5 text-sm" placeholder="Cari pembeli...">
            <button id="ekspor-penjualan" class="hidden text-sm border border-kin text-kin hover:bg-kin hover:text-white px-3 py-1.5 rounded-full transition" data-roles="owner,admin"><i class="fas fa-file-csv mr-1"></i>CSV</button>
          </div>
        </div>
        <table class="w-full text-sm data-table" id="table-penjualan"></table>
      </div>
    </section>

    <!-- Tab: Pesanan / PO -->
    <section id="tab-pesanan" class="tab-panel hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-clipboard-list text-vermillion mr-2"></i>Pesanan</h2>
        <button data-modal="modal-pesanan" class="btn-tambah"><i class="fas fa-plus mr-1"></i>Pesanan Baru</button>
      </div>
      <div id="modal-pesanan" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-pesanan" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-pesanan" class="space-y-3">
          <h2 class="font-serifjp font-semibold"><i class="fas fa-plus-circle text-vermillion mr-2"></i>Pesanan Baru (PO)</h2>
          <p class="text-xs text-sumi/50">Kode PO otomatis. Pesanan selesai otomatis jadi penjualan (anti-miss).</p>
          <div><label class="block text-sm mb-1" for="po-pelanggan">Pelanggan</label><select id="po-pelanggan" required class="form-input"></select></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block text-sm mb-1" for="po-tgl-pesan">Tgl Pesan</label><input id="po-tgl-pesan" type="date" required class="form-input"></div>
            <div><label class="block text-sm mb-1" for="po-tgl-kirim">Tgl Kirim</label><input id="po-tgl-kirim" type="date" required class="form-input"></div>
          </div>
          <div>
            <label class="block text-sm mb-1">Item Pesanan</label>
            <div id="po-items" class="space-y-2"></div>
            <button type="button" id="po-tambah-item" class="mt-2 text-sm text-vermillion hover:underline"><i class="fas fa-plus mr-1"></i>Tambah item</button>
          </div>
          <p class="text-sm">Perkiraan total: <strong id="po-total" class="text-vermillion">Rp 0</strong></p>
          <div><label class="block text-sm mb-1" for="po-catatan">Catatan</label><input id="po-catatan" type="text" placeholder="cth: antar sebelum jam 7 pagi" class="form-input"></div>
          <button class="w-full bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-medium transition">Simpan Pesanan</button>
        </form>
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 class="font-serifjp font-semibold">Daftar Pesanan <span class="text-xs font-normal text-sumi/40">(klik baris untuk item)</span></h2>
            <select id="po-filter" class="form-input" style="max-width:160px">
              <option value="">Semua status</option>
              <option value="baru">Baru</option>
              <option value="diproses">Diproses</option>
              <option value="siap">Siap</option>
              <option value="selesai">Selesai</option>
              <option value="batal">Batal</option>
            </select>
          </div>
          <table class="w-full text-sm data-table" id="table-pesanan"></table>
          <div id="po-detail" class="hidden mt-4 border-t pt-4">
            <h3 class="font-semibold text-sm mb-2" id="po-detail-judul"></h3>
            <table class="w-full text-sm data-table" id="table-pesanan-item"></table>
          </div>
      </div>
    </section>

    <!-- Tab: Stok & Rekonsiliasi -->
    <section id="tab-stok" class="tab-panel hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-boxes-stacked text-matcha mr-2"></i>Stok & Rekonsiliasi</h2>
        <button data-modal="modal-penyesuaian" class="btn-tambah-kin"><i class="fas fa-plus mr-1"></i>Penyesuaian Stok</button>
      </div>
      <div id="modal-penyesuaian" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-penyesuaian" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-penyesuaian" class="space-y-3">
            <h2 class="font-serifjp font-semibold"><i class="fas fa-sliders text-kin mr-2"></i>Penyesuaian Stok</h2>
            <p class="text-xs text-sumi/50">Jamur keluar bukan karena penjualan: rusak, bonus, sampel, konsumsi sendiri, atau koreksi hitung.</p>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-sm mb-1" for="st-tanggal">Tanggal</label><input id="st-tanggal" type="date" required class="form-input"></div>
              <div><label class="block text-sm mb-1" for="st-jumlah">Jumlah (kg)</label><input id="st-jumlah" type="number" step="0.1" min="0.1" required class="form-input"></div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-sm mb-1" for="st-jenis">Jenis</label>
                <select id="st-jenis" class="form-input">
                  <option value="rusak">Rusak/busuk</option>
                  <option value="bonus">Bonus pelanggan</option>
                  <option value="sampel">Sampel/promosi</option>
                  <option value="konsumsi">Konsumsi sendiri</option>
                  <option value="koreksi">Koreksi hitung</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>
              <div><label class="block text-sm mb-1" for="st-arah">Arah</label>
                <select id="st-arah" class="form-input">
                  <option value="keluar">Keluar (stok berkurang)</option>
                  <option value="masuk">Masuk (stok bertambah)</option>
                </select>
              </div>
            </div>
            <div><label class="block text-sm mb-1" for="st-ket">Keterangan</label><input id="st-ket" type="text" placeholder="cth: bonus warung Bu Sri" class="form-input"></div>
            <button class="w-full bg-kin hover:bg-yellow-700 text-white py-2.5 rounded-full font-medium transition">Simpan Penyesuaian</button>
          </form>
        </div>
      </div>
      <div class="space-y-6">
          <div class="bg-white rounded-2xl shadow p-5">
            <div class="flex flex-wrap items-center gap-3 mb-4">
              <h2 class="font-serifjp font-semibold"><i class="fas fa-scale-balanced text-matcha mr-2"></i>Rekonsiliasi Harian</h2>
              <input id="stok-bulan" type="month" class="form-input" style="max-width:180px">
              <button id="stok-muat" class="bg-sumi text-washi px-4 py-2 rounded-full text-sm hover:bg-black transition"><i class="fas fa-rotate mr-1"></i>Muat</button>
            </div>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4" id="stok-cards"></div>
            <div id="stok-peringatan" class="hidden mb-3 text-sm bg-vermillion/10 text-vermillion rounded-lg px-4 py-3"></div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm data-table" id="table-stok"></table>
            </div>
            <p class="text-xs text-sumi/40 mt-3"><i class="fas fa-circle-info mr-1"></i>Saldo minus (merah) = terjual/keluar lebih banyak dari yang dipanen → ada pencatatan yang terlewat. Produk olahan (berat 0 kg) tidak mengurangi stok segar.</p>
          </div>
          <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
            <h2 class="font-serifjp font-semibold mb-3">Penyesuaian Terbaru</h2>
            <table class="w-full text-sm data-table" id="table-penyesuaian"></table>
          </div>
      </div>
    </section>

    <!-- Tab: Produk (admin & owner) -->
    <section id="tab-produk" class="tab-panel hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-box text-vermillion mr-2"></i>Produk</h2>
        <button data-modal="modal-produk" class="btn-tambah" id="btn-produk-baru"><i class="fas fa-plus mr-1"></i>Tambah Produk</button>
      </div>
      <div id="modal-produk" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-produk" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-produk" class="space-y-3">
          <h2 class="font-serifjp font-semibold" id="produk-form-title"><i class="fas fa-plus-circle text-vermillion mr-2"></i>Tambah Produk</h2>
          <input type="hidden" id="produk-id">
          <div><label class="block text-sm mb-1" for="produk-nama">Nama Produk</label><input id="produk-nama" type="text" required class="form-input"></div>
          <div><label class="block text-sm mb-1" for="produk-jp">Nama Jepang</label><input id="produk-jp" type="text" placeholder="cth: 新鮮ヒラタケ" class="form-input"></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block text-sm mb-1" for="produk-harga">Harga (Rp)</label><input id="produk-harga" type="number" min="0" required class="form-input"></div>
            <div><label class="block text-sm mb-1" for="produk-satuan">Satuan</label><input id="produk-satuan" type="text" required placeholder="pack/kg" class="form-input"></div>
          </div>
          <div><label class="block text-sm mb-1" for="produk-berat">Berat Jamur Segar per Unit (kg)</label><input id="produk-berat" type="number" step="0.01" min="0" value="0" class="form-input"><p class="text-xs text-sumi/40 mt-1">Untuk rekonsiliasi stok. Isi 0 untuk produk olahan/baglog (tidak mengurangi stok segar).</p></div>
          <div><label class="block text-sm mb-1" for="produk-deskripsi">Deskripsi</label><textarea id="produk-deskripsi" rows="2" class="form-input"></textarea></div>
          <div><label class="block text-sm mb-1" for="produk-badge">Badge (opsional)</label><input id="produk-badge" type="text" placeholder="Terlaris / Baru / Hemat" class="form-input"></div>
          <div class="flex gap-2">
            <button class="flex-1 bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-medium transition">Simpan</button>
            <button type="button" id="produk-batal" class="hidden px-4 border rounded-full text-sm">Batal</button>
          </div>
        </form>
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
        <h2 class="font-serifjp font-semibold mb-3">Daftar Produk</h2>
        <table class="w-full text-sm data-table" id="table-produk"></table>
      </div>
    </section>

    <!-- Tab: Piutang -->
    <section id="tab-piutang" class="tab-panel hidden">
      <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 class="font-serifjp font-semibold"><i class="fas fa-file-invoice-dollar text-kin mr-2"></i>Piutang Berjalan</h2>
          <p class="text-sm">Sisa tertagih: <strong id="piutang-total" class="text-vermillion">Rp 0</strong></p>
        </div>
        <p class="text-xs text-sumi/50 mb-3"><i class="fas fa-circle-info mr-1"></i>Klik <i class="fas fa-hand-holding-dollar text-kin"></i> untuk catat pembayaran (boleh dicicil sebagian) — piutang otomatis lunas saat sisa Rp 0.</p>
        <table class="w-full text-sm data-table" id="table-piutang"></table>
      </div>
    </section>

    <!-- Tab: Pelanggan -->
    <section id="tab-pelanggan" class="tab-panel hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-address-book text-vermillion mr-2"></i>Pelanggan</h2>
        <button data-modal="modal-pelanggan" class="btn-tambah" id="btn-pelanggan-baru"><i class="fas fa-plus mr-1"></i>Tambah Pelanggan</button>
      </div>
      <div id="modal-pelanggan" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-pelanggan" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-pelanggan" class="space-y-3">
          <h2 class="font-serifjp font-semibold" id="pelanggan-form-title"><i class="fas fa-user-plus text-vermillion mr-2"></i>Tambah Pelanggan</h2>
          <input type="hidden" id="pl-id">
          <div><label class="block text-sm mb-1" for="pl-nama">Nama</label><input id="pl-nama" type="text" required class="form-input"></div>
          <div><label class="block text-sm mb-1" for="pl-tipe">Tipe</label>
            <select id="pl-tipe" class="form-input">
              <option value="eceran">Eceran</option>
              <option value="warung">Warung</option>
              <option value="resto">Resto</option>
              <option value="reseller">Reseller</option>
            </select>
          </div>
          <div><label class="block text-sm mb-1" for="pl-wa">No. WhatsApp</label><input id="pl-wa" type="text" placeholder="628xxxx" class="form-input"></div>
          <div><label class="block text-sm mb-1" for="pl-alamat">Alamat</label><input id="pl-alamat" type="text" class="form-input"></div>
          <div><label class="block text-sm mb-1" for="pl-catatan">Catatan</label><input id="pl-catatan" type="text" placeholder="cth: ambil tiap Senin" class="form-input"></div>
          <div class="flex gap-2">
            <button class="flex-1 bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-medium transition">Simpan</button>
            <button type="button" id="pl-batal" class="hidden px-4 border rounded-full text-sm">Batal</button>
          </div>
        </form>
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
        <h2 class="font-serifjp font-semibold mb-3">Daftar Pelanggan</h2>
        <table class="w-full text-sm data-table" id="table-pelanggan"></table>
      </div>
    </section>

    <!-- Tab: Keuangan (owner & admin) -->
    <section id="tab-keuangan" class="tab-panel hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-wallet text-vermillion mr-2"></i>Keuangan</h2>
        <div class="flex gap-2">
          <button data-modal="modal-pengeluaran" class="btn-tambah"><i class="fas fa-arrow-trend-down mr-1"></i>Pengeluaran</button>
          <button data-modal="modal-pemasukan" class="btn-tambah-matcha"><i class="fas fa-arrow-trend-up mr-1"></i>Pemasukan Lain</button>
        </div>
      </div>
      <div id="modal-pengeluaran" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-pengeluaran" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-pengeluaran" class="space-y-3">
            <h2 class="font-serifjp font-semibold"><i class="fas fa-arrow-trend-down text-vermillion mr-2"></i>Catat Pengeluaran</h2>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-sm mb-1" for="kl-tanggal">Tanggal</label><input id="kl-tanggal" type="date" required class="form-input"></div>
              <div><label class="block text-sm mb-1" for="kl-jumlah">Jumlah (Rp)</label><input id="kl-jumlah" type="number" min="1" required class="form-input"></div>
            </div>
            <div><label class="block text-sm mb-1" for="kl-kategori">Kategori</label>
              <select id="kl-kategori" class="form-input">
                <option value="bahan_baku">Bahan Baku (serbuk, dedak, kapur)</option>
                <option value="bibit">Bibit</option>
                <option value="gas_sterilisasi">Gas / Sterilisasi</option>
                <option value="listrik_air">Listrik & Air</option>
                <option value="gaji">Gaji Karyawan</option>
                <option value="transport">Transport / BBM</option>
                <option value="kemasan">Kemasan (plastik, stiker)</option>
                <option value="perawatan">Perawatan Alat/Kumbung</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </div>
            <div><label class="block text-sm mb-1" for="kl-ket">Keterangan</label><input id="kl-ket" type="text" placeholder="cth: 2 tabung gas" class="form-input"></div>
            <button class="w-full bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-medium transition">Simpan Pengeluaran</button>
          </form>
        </div>
      </div>
      <div id="modal-pemasukan" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-pemasukan" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-pemasukan" class="space-y-3">
            <h2 class="font-serifjp font-semibold"><i class="fas fa-arrow-trend-up text-matcha mr-2"></i>Pemasukan Lain</h2>
            <p class="text-xs text-sumi/50">Di luar penjualan produk — cth: jual baglog afkir untuk pupuk</p>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-sm mb-1" for="pm-tanggal">Tanggal</label><input id="pm-tanggal" type="date" required class="form-input"></div>
              <div><label class="block text-sm mb-1" for="pm-jumlah">Jumlah (Rp)</label><input id="pm-jumlah" type="number" min="1" required class="form-input"></div>
            </div>
            <div><label class="block text-sm mb-1" for="pm-ket">Keterangan</label><input id="pm-ket" type="text" placeholder="cth: jual 100 baglog afkir" class="form-input"></div>
            <button class="w-full bg-matcha hover:bg-green-800 text-white py-2.5 rounded-full font-medium transition">Simpan Pemasukan</button>
          </form>
        </div>
      </div>
      <div class="grid lg:grid-cols-2 gap-6">
          <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
            <h2 class="font-serifjp font-semibold mb-3">Pengeluaran Terbaru</h2>
            <table class="w-full text-sm data-table" id="table-pengeluaran"></table>
          </div>
          <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
            <h2 class="font-serifjp font-semibold mb-3">Pemasukan Lain Terbaru</h2>
            <table class="w-full text-sm data-table" id="table-pemasukan"></table>
          </div>
      </div>
    </section>

    <!-- Tab: Laporan (owner & admin) -->
    <section id="tab-laporan" class="tab-panel hidden">
      <div class="flex flex-wrap items-center gap-3 mb-5">
        <label for="laporan-bulan" class="text-sm font-medium">Bulan:</label>
        <input id="laporan-bulan" type="month" class="form-input" style="max-width:200px">
        <button id="laporan-muat" class="bg-sumi text-washi px-5 py-2 rounded-full text-sm hover:bg-black transition"><i class="fas fa-rotate mr-1"></i>Muat</button>
        <button id="ekspor-keuangan" class="border border-sumi/30 text-sumi hover:bg-sumi hover:text-washi px-5 py-2 rounded-full text-sm transition"><i class="fas fa-file-csv mr-1"></i>Unduh CSV</button>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" id="laporan-cards"></div>
      <div class="grid lg:grid-cols-2 gap-6">
        <section class="bg-white rounded-2xl shadow p-5">
          <h2 class="font-serifjp font-semibold mb-3"><i class="fas fa-chart-pie text-vermillion mr-2"></i>Pengeluaran per Kategori</h2>
          <canvas id="chart-kategori" height="220"></canvas>
        </section>
        <section class="bg-white rounded-2xl shadow p-5">
          <h2 class="font-serifjp font-semibold mb-3"><i class="fas fa-scale-balanced text-kin mr-2"></i>Ringkasan Laba/Rugi</h2>
          <table class="w-full text-sm" id="laporan-rinci"></table>
        </section>
      </div>
      <div class="mt-6 bg-white rounded-2xl shadow p-5">
        <h2 class="font-serifjp font-semibold mb-3"><i class="fas fa-lightbulb text-kin mr-2"></i>Analisis Otomatis</h2>
        <ul id="laporan-insight" class="space-y-2 text-sm"></ul>
      </div>

      <!-- Tren antar-bulan -->
      <div class="mt-6 grid lg:grid-cols-2 gap-6">
        <section class="bg-white rounded-2xl shadow p-5">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 class="font-serifjp font-semibold"><i class="fas fa-chart-line text-matcha mr-2"></i>Tren Omzet & Laba per Bulan</h2>
            <select id="tren-rentang" class="form-input text-xs" style="max-width:130px">
              <option value="6">6 bulan</option>
              <option value="12" selected>12 bulan</option>
              <option value="24">24 bulan</option>
            </select>
          </div>
          <canvas id="chart-tren-uang" height="230"></canvas>
        </section>
        <section class="bg-white rounded-2xl shadow p-5">
          <h2 class="font-serifjp font-semibold mb-3"><i class="fas fa-wheat-awn text-kin mr-2"></i>Tren Panen (kg) & HPP/kg</h2>
          <canvas id="chart-tren-panen" height="230"></canvas>
        </section>
      </div>

      <!-- Kalkulator Harga Jual -->
      <section id="kalkulator-harga" class="mt-6 bg-white rounded-2xl shadow p-5">
        <h2 class="font-serifjp font-semibold mb-1"><i class="fas fa-calculator text-vermillion mr-2"></i>Kalkulator Harga Jual (HPP + Margin)</h2>
        <p class="text-xs text-sumi/50 mb-4">HPP per kg dihitung dari (pengeluaran + investasi baglog) ÷ kg panen, rata-rata 3 bulan terakhir yang ada panen. Harga rekomendasi = modal per unit + margin, dibulatkan ke atas per Rp500.</p>
        <div class="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label class="block text-sm mb-1 font-medium" for="kalk-margin">Margin keuntungan (%)</label>
            <input id="kalk-margin" type="number" min="0" max="500" step="1" value="15" class="form-input" style="max-width:140px">
          </div>
          <button id="kalk-hitung" class="bg-vermillion hover:bg-red-700 text-white px-6 py-2.5 rounded-full text-sm font-medium transition"><i class="fas fa-equals mr-1"></i>Hitung</button>
        </div>
        <div id="kalk-ringkas" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4"></div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm data-table" id="table-kalkulator"></table>
        </div>
        <p id="kalk-kosong" class="hidden text-sm text-sumi/50 bg-washi rounded-lg p-3 mt-2"><i class="fas fa-circle-info mr-1 text-vermillion"></i>Belum ada data panen & pengeluaran — HPP belum bisa dihitung. Catat dulu panen dan pengeluaran, lalu kembali ke sini.</p>
      </section>
    </section>

    <!-- Tab: Pengaturan Web (owner & admin) -->
    <section id="tab-pengaturan" class="tab-panel hidden">
      <div class="max-w-2xl">
        <form id="form-pengaturan" class="bg-white rounded-2xl shadow p-6 space-y-4">
          <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-gear text-vermillion mr-2"></i>Pengaturan Website</h2>
          <p class="text-sm text-sumi/50 bg-washi rounded-lg p-3"><i class="fas fa-circle-info mr-1 text-vermillion"></i>Perubahan di sini <strong>langsung otomatis</strong> tampil di website depan: nomor WA (semua tombol pesan), alamat, dan jam operasional. Statistik hero (baglog aktif, kg/hari, pelanggan) juga otomatis dari data asli.</p>
          <div><label class="block text-sm mb-1 font-medium" for="cfg-wa">Nomor WhatsApp Usaha</label><input id="cfg-wa" type="text" placeholder="6281234567890" class="form-input"><p class="text-xs text-sumi/40 mt-1">Format: kode negara tanpa + dan tanpa spasi, contoh 6281234567890</p></div>
          <div><label class="block text-sm mb-1 font-medium" for="cfg-alamat">Alamat Kumbung</label><input id="cfg-alamat" type="text" class="form-input"></div>
          <div><label class="block text-sm mb-1 font-medium" for="cfg-jam">Jam Operasional</label><input id="cfg-jam" type="text" class="form-input"></div>
          <div><label class="block text-sm mb-1 font-medium" for="cfg-target">Target Panen Bulanan (kg)</label><input id="cfg-target" type="number" min="0" step="1" class="form-input" placeholder="0 = tanpa target"><p class="text-xs text-sumi/40 mt-1">Jika diisi, dashboard Ringkasan menampilkan progres panen bulan ini terhadap target.</p></div>
          <button class="bg-vermillion hover:bg-red-700 text-white px-8 py-2.5 rounded-full font-medium transition">Simpan & Terapkan ke Website</button>
        </form>
      </div>
    </section>

    <!-- Tab: Absensi (semua peran) — selfie + GPS anti-kecurangan -->
    <section id="tab-absensi" class="tab-panel hidden">
      <div class="grid lg:grid-cols-3 gap-6 mb-6">
        <div class="bg-white rounded-2xl shadow p-6 text-center">
          <p class="text-sm text-sumi/50 mb-1">Hari ini, <span id="absen-tanggal"></span></p>
          <p id="absen-status-saya" class="font-serifjp text-lg font-semibold mb-4">—</p>
          <div class="flex justify-center gap-3">
            <button id="btn-absen-masuk" class="bg-matcha hover:bg-green-700 text-white px-6 py-3 rounded-full font-semibold transition shadow"><i class="fas fa-camera mr-2"></i>Absen Masuk</button>
            <button id="btn-absen-pulang" class="bg-sumi hover:bg-black text-washi px-6 py-3 rounded-full font-semibold transition shadow"><i class="fas fa-camera mr-2"></i>Absen Pulang</button>
          </div>
          <p id="absen-jam-kerja" class="text-xs text-sumi/40 mt-3"></p>
          <p id="absen-syarat" class="text-[11px] text-sumi/40 mt-1"></p>
        </div>
        <div class="lg:col-span-2 bg-white rounded-2xl shadow p-5 overflow-x-auto">
          <h2 class="font-serifjp font-semibold mb-3"><i class="fas fa-users text-vermillion mr-2"></i>Rekap Kehadiran Bulan Ini</h2>
          <table class="w-full text-sm data-table" id="table-rekap-absen"></table>
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 class="font-serifjp font-semibold"><i class="fas fa-calendar-days text-kin mr-2"></i>Riwayat Absensi</h2>
          <div class="flex items-center gap-2">
            <input id="absen-filter-bulan" type="month" class="form-input text-sm" style="max-width:170px">
            <button data-modal="modal-koreksi-absen" class="hidden text-sm border border-sumi/30 hover:bg-sumi hover:text-washi px-3 py-1.5 rounded-full transition" data-roles="owner,admin"><i class="fas fa-pen mr-1"></i>Koreksi</button>
          </div>
        </div>
        <table class="w-full text-sm data-table" id="table-absensi"></table>
      </div>

      <!-- Modal kamera selfie absen -->
      <div id="modal-absen-kamera" class="modal hidden">
        <div class="modal-box" style="max-width:430px">
          <button type="button" class="modal-close" data-close="modal-absen-kamera" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <h2 class="font-serifjp font-semibold mb-1"><i class="fas fa-camera text-vermillion mr-2"></i><span id="absen-kamera-judul">Absen</span></h2>
          <p class="text-xs text-sumi/50 mb-3">Selfie diambil langsung dari kamera (bukan galeri) dengan watermark waktu server &amp; lokasi — bukti kehadiran yang sah.</p>
          <div class="relative rounded-xl overflow-hidden bg-black" style="aspect-ratio:3/4">
            <video id="absen-video" autoplay playsinline muted class="w-full h-full object-cover" style="transform:scaleX(-1)"></video>
            <canvas id="absen-canvas" class="hidden absolute inset-0 w-full h-full object-cover"></canvas>
            <div id="absen-kamera-overlay" class="absolute inset-0 flex items-center justify-center text-white text-sm text-center px-4 bg-black/70">Menyalakan kamera…</div>
          </div>
          <div id="absen-info-lokasi" class="text-xs text-sumi/50 mt-2 min-h-[1.2rem]"></div>
          <div class="flex gap-2 mt-3">
            <button id="btn-absen-jepret" class="flex-1 bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-semibold transition disabled:opacity-40" disabled><i class="fas fa-camera mr-1"></i>Jepret</button>
            <button id="btn-absen-ulang" class="hidden flex-1 border border-sumi/30 hover:bg-washi py-2.5 rounded-full transition"><i class="fas fa-rotate-left mr-1"></i>Ulangi</button>
            <button id="btn-absen-kirim" class="hidden flex-1 bg-matcha hover:bg-green-700 text-white py-2.5 rounded-full font-semibold transition"><i class="fas fa-paper-plane mr-1"></i>Kirim Absen</button>
          </div>
        </div>
      </div>

      <!-- Modal lihat foto bukti -->
      <div id="modal-absen-bukti" class="modal hidden">
        <div class="modal-box" style="max-width:430px">
          <button type="button" class="modal-close" data-close="modal-absen-bukti" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <h2 class="font-serifjp font-semibold mb-3"><i class="fas fa-image text-kin mr-2"></i>Bukti Selfie Absen</h2>
          <img id="absen-bukti-img" src="" alt="Bukti selfie absen" class="w-full rounded-xl">
        </div>
      </div>
      <div id="modal-koreksi-absen" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-koreksi-absen" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-koreksi-absen" class="space-y-3">
            <h2 class="font-serifjp font-semibold"><i class="fas fa-pen text-vermillion mr-2"></i>Koreksi Absensi</h2>
            <p class="text-xs text-sumi/50 bg-washi rounded-lg p-2">Untuk mencatat izin/sakit/libur atau memperbaiki jam yang lupa diabsen.</p>
            <div><label class="block text-sm mb-1" for="koreksi-user">Karyawan</label><select id="koreksi-user" required class="form-input"></select></div>
            <div><label class="block text-sm mb-1" for="koreksi-tanggal">Tanggal</label><input id="koreksi-tanggal" type="date" required class="form-input"></div>
            <div>
              <label class="block text-sm mb-1" for="koreksi-status">Status</label>
              <select id="koreksi-status" class="form-input">
                <option value="hadir">Hadir</option><option value="izin">Izin</option><option value="sakit">Sakit</option><option value="libur">Libur</option><option value="alpa">Alpa</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-sm mb-1" for="koreksi-masuk">Jam Masuk</label><input id="koreksi-masuk" type="time" class="form-input"></div>
              <div><label class="block text-sm mb-1" for="koreksi-pulang">Jam Pulang</label><input id="koreksi-pulang" type="time" class="form-input"></div>
            </div>
            <div><label class="block text-sm mb-1" for="koreksi-catatan">Catatan</label><input id="koreksi-catatan" type="text" class="form-input" placeholder="opsional"></div>
            <button class="w-full bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-medium transition">Simpan Koreksi</button>
          </form>
        </div>
      </div>
    </section>

    <!-- Tab: Gaji (owner) -->
    <section id="tab-gaji" class="tab-panel hidden">
      <div class="flex flex-wrap items-center gap-3 mb-5">
        <label for="gaji-periode" class="text-sm font-medium">Periode:</label>
        <input id="gaji-periode" type="month" class="form-input" style="max-width:200px">
        <button id="gaji-muat" class="bg-sumi text-washi px-5 py-2 rounded-full text-sm hover:bg-black transition"><i class="fas fa-rotate mr-1"></i>Muat</button>
      </div>
      <p class="text-sm text-sumi/50 bg-white rounded-xl p-3 mb-4 shadow-sm"><i class="fas fa-circle-info mr-1 text-vermillion"></i>Gaji = <strong>hari hadir × upah harian</strong> + bonus − potongan. Atur upah harian lewat tombol <strong>Upah</strong>. Saat dibayar, otomatis tercatat di Keuangan (kategori gaji).</p>
      <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
        <table class="w-full text-sm data-table" id="table-gaji"></table>
      </div>
      <div id="modal-bayar-gaji" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-bayar-gaji" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-bayar-gaji" class="space-y-3">
            <h2 class="font-serifjp font-semibold"><i class="fas fa-money-check-dollar text-vermillion mr-2"></i>Bayar Gaji</h2>
            <input type="hidden" id="bayar-user-id"><input type="hidden" id="bayar-periode">
            <div class="bg-washi rounded-xl p-4 text-sm space-y-1">
              <p><span class="text-sumi/50">Karyawan:</span> <strong id="bayar-nama"></strong></p>
              <p><span class="text-sumi/50">Periode:</span> <strong id="bayar-periode-label"></strong></p>
              <p><span class="text-sumi/50">Hadir:</span> <strong id="bayar-hadir"></strong> hari × <strong id="bayar-upah"></strong></p>
              <p class="border-t border-sumi/10 pt-1"><span class="text-sumi/50">Gaji pokok:</span> <strong id="bayar-pokok" class="text-vermillion"></strong></p>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-sm mb-1" for="bayar-bonus">Bonus (Rp)</label><input id="bayar-bonus" type="number" min="0" value="0" class="form-input"></div>
              <div><label class="block text-sm mb-1" for="bayar-potongan">Potongan (Rp)</label><input id="bayar-potongan" type="number" min="0" value="0" class="form-input"></div>
            </div>
            <div><label class="block text-sm mb-1" for="bayar-catatan">Catatan</label><input id="bayar-catatan" type="text" class="form-input" placeholder="opsional, mis. kasbon dipotong"></div>
            <p class="text-right font-serifjp font-bold text-lg">Total: <span id="bayar-total" class="text-vermillion">Rp 0</span></p>
            <button class="w-full bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-medium transition">Bayar & Catat ke Keuangan</button>
          </form>
        </div>
      </div>
      <div id="modal-upah" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-upah" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-upah" class="space-y-3">
            <h2 class="font-serifjp font-semibold"><i class="fas fa-coins text-kin mr-2"></i>Atur Upah Harian</h2>
            <input type="hidden" id="upah-user-id">
            <p class="text-sm bg-washi rounded-lg p-3">Karyawan: <strong id="upah-nama"></strong></p>
            <div><label class="block text-sm mb-1" for="upah-nilai">Upah per hari hadir (Rp)</label><input id="upah-nilai" type="number" min="0" step="1000" required class="form-input"></div>
            <button class="w-full bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-medium transition">Simpan</button>
          </form>
        </div>
      </div>
    </section>

    <!-- Tab: Pengaturan Situs (owner) -->
    <section id="tab-situs" class="tab-panel hidden">
      <div class="max-w-2xl">
        <form id="form-situs" class="bg-white rounded-2xl shadow p-6 space-y-4">
          <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-globe text-vermillion mr-2"></i>Pengaturan Situs <span class="text-xs bg-vermillion/10 text-vermillion px-2 py-0.5 rounded-full ml-1">Khusus Owner</span></h2>
          <p class="text-sm text-sumi/50 bg-washi rounded-lg p-3"><i class="fas fa-circle-info mr-1 text-vermillion"></i>Kendali identitas <strong>seluruh website</strong>: nama usaha, tagline, deskripsi, warna tema, tombol pesanan online, dan jam kerja absensi. Perubahan langsung aktif di website depan.</p>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block text-sm mb-1 font-medium" for="situs-nama">Nama Usaha</label><input id="situs-nama" type="text" required class="form-input"></div>
            <div><label class="block text-sm mb-1 font-medium" for="situs-nama-jp">Nama Jepang / Sub-judul</label><input id="situs-nama-jp" type="text" class="form-input" placeholder="平茸"></div>
          </div>
          <div><label class="block text-sm mb-1 font-medium" for="situs-tagline">Tagline</label><input id="situs-tagline" type="text" class="form-input" placeholder="Jamur Tiram Segar Berkualitas"></div>
          <div><label class="block text-sm mb-1 font-medium" for="situs-deskripsi">Deskripsi Singkat (hero & meta)</label><textarea id="situs-deskripsi" rows="3" class="form-input"></textarea></div>
          <div class="grid grid-cols-2 gap-3 items-end">
            <div><label class="block text-sm mb-1 font-medium" for="situs-warna">Warna Tema</label><div class="flex items-center gap-2"><input id="situs-warna" type="color" value="#C73E3A" class="h-10 w-14 rounded cursor-pointer border border-sumi/20"><span id="situs-warna-kode" class="text-sm text-sumi/60">#C73E3A</span></div></div>
            <label class="flex items-center gap-2 text-sm font-medium cursor-pointer pb-2"><input id="situs-pesanan-online" type="checkbox" class="w-4 h-4 accent-[#C73E3A]">Form pesanan online aktif</label>
          </div>
          <div class="border-t border-sumi/10 pt-4">
            <p class="text-sm font-medium mb-2"><i class="fas fa-user-clock mr-1 text-matcha"></i>Jam Kerja (untuk absensi)</p>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-sm mb-1" for="situs-jam-masuk">Jam Masuk</label><input id="situs-jam-masuk" type="time" class="form-input"></div>
              <div><label class="block text-sm mb-1" for="situs-jam-pulang">Jam Pulang</label><input id="situs-jam-pulang" type="time" class="form-input"></div>
            </div>
          </div>
          <div class="border-t border-sumi/10 pt-4 space-y-3">
            <p class="text-sm font-medium"><i class="fas fa-shield-halved mr-1 text-vermillion"></i>Absensi Ketat (anti-kecurangan)</p>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex items-center gap-2 text-sm cursor-pointer"><input id="absen-cfg-selfie" type="checkbox" class="w-4 h-4 accent-[#C73E3A]">Wajib selfie kamera</label>
              <label class="flex items-center gap-2 text-sm cursor-pointer"><input id="absen-cfg-lokasi" type="checkbox" class="w-4 h-4 accent-[#C73E3A]">Wajib lokasi GPS</label>
              <label class="flex items-center gap-2 text-sm cursor-pointer col-span-2"><input id="absen-cfg-auto-alpa" type="checkbox" class="w-4 h-4 accent-[#C73E3A]">Otomatis tandai <strong>alpa</strong> bila tidak absen (kecuali Minggu)</label>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-sm mb-1" for="absen-cfg-lat">Latitude Kumbung</label><input id="absen-cfg-lat" type="text" inputmode="decimal" class="form-input" placeholder="-6.914744"></div>
              <div><label class="block text-sm mb-1" for="absen-cfg-lng">Longitude Kumbung</label><input id="absen-cfg-lng" type="text" inputmode="decimal" class="form-input" placeholder="107.609810"></div>
            </div>
            <button type="button" id="btn-absen-cfg-gps" class="text-xs border border-sumi/30 hover:bg-washi px-3 py-1.5 rounded-full transition"><i class="fas fa-location-crosshairs mr-1"></i>Pakai lokasi saya sekarang (isi otomatis)</button>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-sm mb-1" for="absen-cfg-radius">Radius absen (meter)</label><input id="absen-cfg-radius" type="number" min="20" max="5000" class="form-input" placeholder="150"></div>
              <div><label class="block text-sm mb-1" for="absen-cfg-toleransi">Toleransi telat (menit)</label><input id="absen-cfg-toleransi" type="number" min="0" max="120" class="form-input" placeholder="10"></div>
            </div>
            <p class="text-xs text-sumi/40">Karyawan hanya bisa absen bila berada dalam radius dari titik kumbung. Jam absen memakai <strong>jam server WIB</strong> (zona Jawa Barat) — jam HP tidak berpengaruh.</p>
          </div>

          <!-- Peta lokasi kumbung di landing page (Fase 10) -->
          <div class="border-t border-sumi/10 pt-4 space-y-3">
            <p class="text-sm font-medium"><i class="fas fa-map-location-dot mr-1 text-matcha"></i>Peta Lokasi di Website Depan</p>
            <p class="text-xs text-sumi/50 bg-washi rounded-lg p-3">Isi koordinat agar <strong>peta Google Maps</strong> muncul di seksi Kontak halaman depan, lengkap dengan tombol "Petunjuk Arah". Biarkan kosong bila tidak ingin menampilkan peta.</p>
            <div class="grid grid-cols-2 gap-3">
              <div><label class="block text-sm mb-1" for="peta-lat">Latitude</label><input id="peta-lat" type="text" inputmode="decimal" class="form-input" placeholder="-6.914744"></div>
              <div><label class="block text-sm mb-1" for="peta-lng">Longitude</label><input id="peta-lng" type="text" inputmode="decimal" class="form-input" placeholder="107.609810"></div>
            </div>
            <div class="flex flex-wrap items-end gap-3">
              <div><label class="block text-sm mb-1" for="peta-zoom">Zoom (3–20)</label><input id="peta-zoom" type="number" min="3" max="20" class="form-input" placeholder="16"></div>
              <button type="button" id="btn-peta-gps" class="text-xs border border-sumi/30 hover:bg-washi px-3 py-1.5 rounded-full transition"><i class="fas fa-location-crosshairs mr-1"></i>Pakai lokasi saya</button>
              <button type="button" id="btn-peta-samakan" class="text-xs border border-sumi/30 hover:bg-washi px-3 py-1.5 rounded-full transition"><i class="fas fa-copy mr-1"></i>Samakan dengan titik absen</button>
            </div>
          </div>

          <button class="bg-vermillion hover:bg-red-700 text-white px-8 py-2.5 rounded-full font-medium transition">Simpan & Terapkan ke Seluruh Website</button>
        </form>

        <!-- Backup Database Lengkap (owner) -->
        <div class="bg-white rounded-2xl shadow p-6 mt-6 space-y-4">
          <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-database text-matcha mr-2"></i>Backup Database Lengkap</h2>
          <div id="backup-peringatan" class="hidden"></div>
          <p class="text-sm text-sumi/50 bg-washi rounded-lg p-3"><i class="fas fa-triangle-exclamation mr-1 text-vermillion"></i>Semua data usaha (penjualan, keuangan, gaji, absensi) hanya tersimpan di <strong>satu database</strong>. Unduh backup <strong>minimal seminggu sekali</strong> dan simpan di Google Drive / hard disk. Kalau data terhapus, file ini penyelamat Anda.</p>
          <div id="backup-ringkasan" class="text-sm text-sumi/60">Memuat ringkasan…</div>
          <div class="flex flex-wrap gap-2">
            <button type="button" id="btn-backup-sql" class="bg-vermillion hover:bg-red-700 text-white px-6 py-2.5 rounded-full font-medium transition">
              <i class="fas fa-download mr-1"></i>Ekspor Backup Lengkap (.sql)
            </button>
            <button type="button" id="btn-backup-json" class="border border-sumi/20 hover:bg-washi px-6 py-2.5 rounded-full transition text-sm">
              <i class="fas fa-file-code mr-1"></i>Format JSON
            </button>
            <button type="button" id="btn-backup-media" class="border border-sumi/20 hover:bg-washi px-6 py-2.5 rounded-full transition text-sm">
              <i class="fas fa-images mr-1"></i>Sertakan Foto (file besar)
            </button>
          </div>
          <details class="text-xs text-sumi/50">
            <summary class="cursor-pointer hover:text-vermillion font-medium">Cara memulihkan data dari file backup</summary>
            <div class="mt-2 bg-washi rounded-lg p-3 space-y-1">
              <p>File <strong>.sql</strong> bisa dipulihkan penuh di komputer (perlu Node.js):</p>
              <p class="font-mono bg-white rounded px-2 py-1 break-all">npx wrangler d1 migrations apply webapp-production</p>
              <p class="font-mono bg-white rounded px-2 py-1 break-all">npx wrangler d1 execute webapp-production --file=backup-hiratake-XXXX.sql</p>
              <p class="text-vermillion"><i class="fas fa-lock mr-1"></i>File backup berisi data usaha & sandi terenkripsi — jangan dibagikan ke orang lain.</p>
            </div>
          </details>
        </div>

        <!-- Testimoni Pelanggan (owner/admin) -->
        <div class="bg-white rounded-2xl shadow p-6 mt-6 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-comment-dots text-kin mr-2"></i>Testimoni Pelanggan</h2>
            <button type="button" id="btn-testi-tambah" class="btn-tambah"><i class="fas fa-plus mr-1"></i>Tambah Testimoni</button>
          </div>
          <p class="text-sm text-sumi/50 bg-washi rounded-lg p-3"><i class="fas fa-circle-info mr-1 text-vermillion"></i>Bukti sosial di halaman depan. Testimoni yang ditandai <strong>tampil</strong> muncul di seksi "Kata Pelanggan Kami" dan ikut memperkaya hasil pencarian Google (bintang rating).</p>
          <div id="testi-list" class="space-y-2"></div>
        </div>

        <!-- Modal tambah/ubah testimoni -->
        <div id="modal-testi" class="modal hidden">
          <div class="modal-box">
            <button type="button" class="modal-close" data-close="modal-testi" aria-label="Tutup"><i class="fas fa-times"></i></button>
            <form id="form-testi" class="space-y-3">
              <h2 id="modal-testi-judul" class="font-serifjp font-semibold"><i class="fas fa-comment-dots text-kin mr-2"></i>Tambah Testimoni</h2>
              <input type="hidden" id="testi-id">
              <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-sm mb-1 font-medium" for="testi-nama">Nama Pelanggan</label><input id="testi-nama" type="text" required maxlength="60" class="form-input" placeholder="Bu Sri"></div>
                <div><label class="block text-sm mb-1 font-medium" for="testi-asal">Asal / Usaha</label><input id="testi-asal" type="text" maxlength="80" class="form-input" placeholder="Warung Bu Sri, Sleman"></div>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div><label class="block text-sm mb-1 font-medium" for="testi-rating">Rating</label>
                  <select id="testi-rating" class="form-input">
                    <option value="5">★★★★★ (5)</option>
                    <option value="4">★★★★ (4)</option>
                    <option value="3">★★★ (3)</option>
                    <option value="2">★★ (2)</option>
                    <option value="1">★ (1)</option>
                  </select>
                </div>
                <div><label class="block text-sm mb-1 font-medium" for="testi-urutan">Urutan tampil</label><input id="testi-urutan" type="number" value="0" class="form-input"></div>
              </div>
              <div><label class="block text-sm mb-1 font-medium" for="testi-isi">Isi Testimoni</label><textarea id="testi-isi" rows="4" required maxlength="400" class="form-input" placeholder="Jamurnya selalu segar dan pengiriman tepat waktu. Pelanggan warung saya suka."></textarea><p class="text-xs text-sumi/40 mt-1">Maksimal 400 karakter agar rapi di halaman.</p></div>
              <label class="flex items-center gap-2 text-sm cursor-pointer"><input id="testi-tampil" type="checkbox" checked class="w-4 h-4 accent-[#C73E3A]">Tampilkan di halaman depan</label>
              <div class="flex gap-2 pt-2">
                <button type="submit" class="bg-vermillion hover:bg-red-700 text-white px-7 py-2.5 rounded-full font-medium transition">Simpan</button>
                <button type="button" class="border border-sumi/20 px-7 py-2.5 rounded-full transition hover:bg-washi" data-close="modal-testi">Batal</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Kelola Foto Landing Page (owner) -->
        <div class="bg-white rounded-2xl shadow p-6 mt-6 space-y-4">
          <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-images text-kin mr-2"></i>Foto Website</h2>
          <p class="text-sm text-sumi/50 bg-washi rounded-lg p-3"><i class="fas fa-circle-info mr-1 text-vermillion"></i>Ganti logo, foto "Tentang", dan 6 foto galeri di halaman depan. Foto dikompresi otomatis di browser (maks ±800 KB). Klik <strong>Bawaan</strong> untuk kembali ke foto awal.</p>
          <div id="situs-media-grid" class="grid grid-cols-2 sm:grid-cols-4 gap-4"></div>
          <input type="file" id="situs-media-file" accept="image/jpeg,image/png,image/webp" class="hidden">
        </div>
      </div>
    </section>

    <!-- Tab: Otomatisasi & Pemeriksa Sistem (Fase 11 — hasil audit) -->
    <section id="tab-otomatis" class="tab-panel hidden">
      <div class="max-w-4xl space-y-5">

        <!-- Kesehatan sistem: hasil pemeriksaan mandiri -->
        <div class="bg-white rounded-2xl shadow p-6">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-heart-pulse text-vermillion mr-2"></i>Kesehatan Sistem</h2>
              <p class="text-sm text-sumi/50 mt-1">Sistem memeriksa datanya sendiri: uang, stok, pesanan, dan notifikasi.</p>
            </div>
            <div class="flex items-center gap-2">
              <button id="btn-periksa" type="button" class="btn-tambah"><i class="fas fa-stethoscope mr-1"></i>Periksa Sekarang</button>
              <button id="btn-perbaiki" type="button" class="btn-tambah-matcha hidden"><i class="fas fa-wand-magic-sparkles mr-1"></i>Perbaiki Otomatis</button>
            </div>
          </div>
          <div id="periksa-hasil" class="space-y-3">
            <p class="text-sm text-sumi/40"><i class="fas fa-spinner fa-spin mr-1"></i>Memuat pemeriksaan…</p>
          </div>
        </div>

        <!-- Denyut: bukti otomatisasi hidup -->
        <div class="bg-white rounded-2xl shadow p-6">
          <h2 class="font-serifjp font-semibold text-lg mb-1"><i class="fas fa-robot text-vermillion mr-2"></i>Tugas Otomatis</h2>
          <p class="text-sm text-sumi/50 bg-washi rounded-lg p-3 mb-4">
            <i class="fas fa-circle-info mr-1 text-vermillion"></i>
            Semua tugas di bawah berjalan <strong>sendiri</strong> tanpa perlu dibuka.
            Pemicunya adalah kunjungan ke website, jadi selama ada pengunjung, otomatisasi tetap jalan.
          </p>
          <div id="otomatis-denyut" class="mb-4"></div>
          <div id="otomatis-tugas" class="space-y-2"></div>
        </div>

        <!-- Pengaturan otomatisasi -->
        <form id="form-otomatis" class="bg-white rounded-2xl shadow p-6 space-y-4">
          <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-sliders text-vermillion mr-2"></i>Aturan Otomatisasi</h2>
          <div class="grid sm:grid-cols-3 gap-3">
            <div>
              <label class="block text-sm mb-1 font-medium" for="oto-jam">Jam kirim laporan pagi</label>
              <input id="oto-jam" type="number" min="0" max="23" class="form-input">
              <p class="text-xs text-sumi/40 mt-1">Ringkasan & tagihan dikirim setelah jam ini (WIB).</p>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="oto-sapu">Batalkan pesanan setelah (hari)</label>
              <input id="oto-sapu" type="number" min="1" max="30" class="form-input">
              <p class="text-xs text-sumi/40 mt-1">Pesanan web yang tidak dibayar akan dibatalkan.</p>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="oto-ingat">Ingatkan pesanan diam (jam)</label>
              <input id="oto-ingat" type="number" min="1" max="72" class="form-input">
              <p class="text-xs text-sumi/40 mt-1">Sudah dibayar tapi belum diproses.</p>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="oto-tutup-tgl">Tutup buku tanggal</label>
              <input id="oto-tutup-tgl" type="number" min="1" max="28" class="form-input">
              <p class="text-xs text-sumi/40 mt-1">Buku bulan lalu dikunci pada tanggal ini.</p>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="oto-opname-tol">Toleransi selisih kas (Rp)</label>
              <input id="oto-opname-tol" type="number" min="0" step="1000" class="form-input">
              <p class="text-xs text-sumi/40 mt-1">Selisih di atas ini dianggap masalah serius.</p>
            </div>
          </div>
          <div class="space-y-2 pt-2 border-t border-sumi/10">
            <label class="flex items-center gap-2 text-sm"><input id="oto-alpa" type="checkbox" class="w-4 h-4"> Tandai alpa otomatis bila karyawan tidak absen</label>
            <label class="flex items-center gap-2 text-sm"><input id="oto-jual" type="checkbox" class="w-4 h-4"> Catat penjualan otomatis begitu pesanan dibayar</label>
            <label class="flex items-center gap-2 text-sm"><input id="oto-ongkir" type="checkbox" class="w-4 h-4"> Catat ongkir &amp; biaya admin ke buku kas</label>
            <label class="flex items-center gap-2 text-sm"><input id="oto-sapu-aktif" type="checkbox" class="w-4 h-4"> Batalkan pesanan mandek otomatis</label>
            <label class="flex items-center gap-2 text-sm"><input id="oto-ingat-aktif" type="checkbox" class="w-4 h-4"> Ingatkan owner via WhatsApp untuk pesanan belum digarap</label>
            <label class="flex items-center gap-2 text-sm"><input id="oto-ringkasan" type="checkbox" class="w-4 h-4"> Kirim ringkasan pagi via WhatsApp</label>
            <label class="flex items-center gap-2 text-sm"><input id="oto-piutang" type="checkbox" class="w-4 h-4"> Tagih piutang jatuh tempo via WhatsApp</label>
          </div>
          <div class="space-y-2 pt-2 border-t border-sumi/10">
            <p class="text-xs font-semibold text-sumi/60 uppercase tracking-wide">Pembukuan Otomatis</p>
            <label class="flex items-center gap-2 text-sm"><input id="oto-baglog" type="checkbox" class="w-4 h-4"> Bukukan biaya baglog jadi pengeluaran otomatis</label>
            <label class="flex items-center gap-2 text-sm"><input id="oto-tutupbuku" type="checkbox" class="w-4 h-4"> Tutup buku bulan lalu otomatis</label>
            <label class="flex items-center gap-2 text-sm"><input id="oto-rekap" type="checkbox" class="w-4 h-4"> Kirim rekap laba/rugi bulanan via WhatsApp</label>
            <label class="flex items-center gap-2 text-sm"><input id="oto-rekonkas" type="checkbox" class="w-4 h-4"> Periksa kecocokan kas gateway vs pembukuan</label>
            <label class="flex items-center gap-2 text-sm"><input id="oto-penyusutan" type="checkbox" class="w-4 h-4"> Bukukan penyusutan aset tetap tiap bulan</label>
            <label class="flex items-center gap-2 text-sm"><input id="oto-opname" type="checkbox" class="w-4 h-4"> Ingatkan hitung uang kas (opname) via WhatsApp</label>
          </div>
          <button type="submit" class="btn-tambah w-full"><i class="fas fa-save mr-1"></i>Simpan Aturan</button>
        </form>

        <!-- Fase 12: Tutup Buku bulanan -->
        <div class="bg-white rounded-2xl shadow p-6">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-book-bookmark text-matcha mr-2"></i>Tutup Buku</h2>
              <p class="text-sm text-sumi/50 mt-1">Kunci laporan bulan yang sudah selesai agar angkanya tidak bisa berubah lagi.</p>
            </div>
            <button id="btn-buku-segar" type="button" class="text-sm border border-sumi/20 hover:bg-washi px-4 py-2 rounded-full transition"><i class="fas fa-rotate mr-1"></i>Segarkan</button>
          </div>
          <p class="text-sm text-sumi/50 bg-washi rounded-lg p-3 mb-4">
            <i class="fas fa-circle-info mr-1 text-vermillion"></i>
            Setelah ditutup, <strong>tidak ada</strong> pemasukan, pengeluaran, panen, atau penjualan baru yang bisa
            dimasukkan ke bulan itu. Ini mencegah laporan lama berubah diam-diam karena input yang terlambat.
          </p>
          <div id="buku-berjalan" class="mb-4"></div>
          <div id="buku-list" class="space-y-2">
            <p class="text-sm text-sumi/40"><i class="fas fa-spinner fa-spin mr-1"></i>Memuat pembukuan…</p>
          </div>
        </div>

        <!-- Fase 12: Rekonsiliasi Kas -->
        <div class="bg-white rounded-2xl shadow p-6">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-scale-balanced text-kin mr-2"></i>Rekonsiliasi Kas</h2>
              <p class="text-sm text-sumi/50 mt-1">Bandingkan uang yang benar-benar diterima dengan yang tercatat di buku.</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <input id="rekon-periode" type="month" class="form-input w-auto">
              <button id="btn-rekon" type="button" class="btn-tambah-kin"><i class="fas fa-magnifying-glass-dollar mr-1"></i>Periksa</button>
            </div>
          </div>
          <div id="rekon-hasil" class="text-sm text-sumi/40">Pilih bulan lalu tekan <strong>Periksa</strong>.</div>
        </div>

        <!-- Fase 13: Kas Opname -->
        <div class="bg-white rounded-2xl shadow p-6">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-cash-register text-vermillion mr-2"></i>Kas Opname</h2>
              <p class="text-sm text-sumi/50 mt-1">Hitung uang fisik di kasir, lalu bandingkan dengan catatan sistem.</p>
            </div>
            <button id="btn-opname-segar" type="button" class="text-sm border border-sumi/20 hover:bg-washi px-4 py-2 rounded-full transition"><i class="fas fa-rotate mr-1"></i>Segarkan</button>
          </div>
          <p class="text-sm text-sumi/50 bg-washi rounded-lg p-3 mb-4">
            <i class="fas fa-circle-info mr-1 text-vermillion"></i>
            Ini cara paling ampuh menangkap uang hilang. Hitung uang di kasir, masukkan angkanya,
            sistem langsung memberi tahu selisihnya. Angka yang Anda simpan jadi <strong>titik awal</strong>
            perhitungan hari berikutnya, jadi selisih tidak dihitung dua kali.
          </p>
          <div id="opname-ringkas" class="mb-4">
            <p class="text-sm text-sumi/40"><i class="fas fa-spinner fa-spin mr-1"></i>Menghitung saldo kas…</p>
          </div>
          <form id="form-opname" class="grid md:grid-cols-3 gap-3 items-end border-t border-sumi/10 pt-4">
            <div>
              <label class="block text-sm mb-1 font-medium" for="opname-tanggal">Tanggal</label>
              <input id="opname-tanggal" type="date" class="form-input" required>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="opname-fisik">Uang fisik dihitung (Rp)</label>
              <input id="opname-fisik" type="number" min="0" step="500" class="form-input" placeholder="0" required>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="opname-catatan">Catatan</label>
              <input id="opname-catatan" type="text" class="form-input" placeholder="opsional" maxlength="200">
            </div>
            <div class="md:col-span-3">
              <button type="submit" class="btn-tambah w-full"><i class="fas fa-check mr-1"></i>Simpan Opname</button>
            </div>
          </form>
          <div id="opname-riwayat" class="mt-4 space-y-2"></div>
        </div>

        <!-- Fase 13: Aset Tetap & Penyusutan -->
        <div class="bg-white rounded-2xl shadow p-6">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-warehouse text-matcha mr-2"></i>Aset Tetap &amp; Penyusutan</h2>
              <p class="text-sm text-sumi/50 mt-1">Barang tahan lama: kumbung, rak, mesin, kendaraan.</p>
            </div>
            <button id="btn-aset-segar" type="button" class="text-sm border border-sumi/20 hover:bg-washi px-4 py-2 rounded-full transition"><i class="fas fa-rotate mr-1"></i>Segarkan</button>
          </div>
          <p class="text-sm text-sumi/50 bg-washi rounded-lg p-3 mb-4">
            <i class="fas fa-circle-info mr-1 text-vermillion"></i>
            Nilai barang turun tiap bulan (penyusutan) supaya laba tidak terlihat lebih besar dari kenyataan.
            Penyusutan <strong>tidak mengurangi uang kas</strong> karena uangnya tidak keluar dari kasir —
            jadi kas opname tetap akurat.
          </p>
          <div id="aset-total" class="mb-4"></div>
          <div id="aset-list" class="space-y-2 mb-4">
            <p class="text-sm text-sumi/40"><i class="fas fa-spinner fa-spin mr-1"></i>Memuat aset…</p>
          </div>
          <form id="form-aset" class="grid md:grid-cols-3 gap-3 items-end border-t border-sumi/10 pt-4">
            <div class="md:col-span-2">
              <label class="block text-sm mb-1 font-medium" for="aset-nama">Nama aset</label>
              <input id="aset-nama" type="text" class="form-input" placeholder="Rak kumbung besi" maxlength="120" required>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="aset-kategori">Kategori</label>
              <select id="aset-kategori" class="form-input">
                <option value="peralatan">Peralatan</option>
                <option value="bangunan">Bangunan / Kumbung</option>
                <option value="mesin">Mesin</option>
                <option value="kendaraan">Kendaraan</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="aset-tanggal">Tanggal beli</label>
              <input id="aset-tanggal" type="date" class="form-input" required>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="aset-harga">Harga beli (Rp)</label>
              <input id="aset-harga" type="number" min="1" step="1000" class="form-input" required>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="aset-residu">Nilai sisa akhir (Rp)</label>
              <input id="aset-residu" type="number" min="0" step="1000" class="form-input" value="0">
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="aset-umur">Umur pakai (bulan)</label>
              <input id="aset-umur" type="number" min="1" max="600" class="form-input" value="60" required>
              <p class="text-xs text-sumi/40 mt-1">60 bulan = 5 tahun.</p>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="aset-catatan">Catatan</label>
              <input id="aset-catatan" type="text" class="form-input" placeholder="opsional" maxlength="200">
            </div>
            <div class="flex items-end">
              <button type="submit" class="btn-tambah w-full"><i class="fas fa-plus mr-1"></i>Tambah Aset</button>
            </div>
          </form>
        </div>

        <!-- Fase 13: Ekspor Buku Besar -->
        <div class="bg-white rounded-2xl shadow p-6">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-file-csv text-kin mr-2"></i>Ekspor Buku Besar</h2>
              <p class="text-sm text-sumi/50 mt-1">Unduh semua transaksi satu bulan jadi file Excel/CSV.</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <input id="ekspor-periode" type="month" class="form-input w-auto">
              <button id="btn-ekspor" type="button" class="btn-tambah-kin"><i class="fas fa-download mr-1"></i>Unduh CSV</button>
            </div>
          </div>
          <p class="text-sm text-sumi/50 bg-washi rounded-lg p-3 mb-4">
            <i class="fas fa-circle-info mr-1 text-vermillion"></i>
            Berisi penjualan, pemasukan lain, pengeluaran, dan pembayaran piutang — urut tanggal dengan
            <strong>saldo jalan</strong>. Simpan salinannya di luar server sebagai cadangan.
          </p>
          <div id="ekspor-riwayat" class="text-sm text-sumi/40"></div>
        </div>

        <!-- Hari libur -->
        <div class="bg-white rounded-2xl shadow p-6">
          <h2 class="font-serifjp font-semibold text-lg mb-1"><i class="fas fa-calendar-xmark text-kin mr-2"></i>Hari Libur</h2>
          <p class="text-sm text-sumi/50 bg-washi rounded-lg p-3 mb-4">
            <i class="fas fa-circle-info mr-1 text-vermillion"></i>
            Daftarkan libur nasional atau libur usaha agar karyawan <strong>tidak salah ditandai alpa</strong>.
            Hari Minggu sudah otomatis dilewati. Bila sudah tertandai alpa, penandaan itu akan dibatalkan.
          </p>
          <div class="flex flex-wrap gap-2 mb-4">
            <input id="libur-tanggal" type="date" class="form-input flex-1 min-w-[150px]">
            <input id="libur-ket" type="text" placeholder="Keterangan (mis. Idul Fitri)" class="form-input flex-1 min-w-[180px]" maxlength="100">
            <button id="btn-libur-tambah" type="button" class="btn-tambah-kin"><i class="fas fa-plus mr-1"></i>Tambah</button>
          </div>
          <div id="libur-list" class="space-y-2"></div>
        </div>

      </div>
    </section>

    <!-- Tab: Aktivitas / Audit Log (owner) -->
    <!-- Tab: WhatsApp (integrasi OpenWA) -->
    <section id="tab-whatsapp" class="tab-panel hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 class="font-serifjp font-semibold text-lg"><i class="fab fa-whatsapp text-green-600 mr-2"></i>WhatsApp (OpenWA)</h2>
        <div class="flex gap-2">
          <button id="btn-wa-refresh" class="text-sm border border-sumi/20 hover:bg-washi px-4 py-2 rounded-full transition"><i class="fas fa-rotate mr-1"></i>Segarkan</button>
          <button data-modal="modal-wa-kirim" class="btn-tambah"><i class="fas fa-paper-plane mr-1"></i>Kirim Pesan</button>
        </div>
      </div>

      <!-- Status koneksi -->
      <div id="wa-status-kartu" class="bg-white rounded-2xl shadow p-5 mb-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-sumi/50 uppercase tracking-wide mb-1">Status Gateway</p>
            <p id="wa-status-teks" class="font-semibold text-lg">Memuat…</p>
            <p id="wa-status-pesan" class="text-sm text-sumi/60 mt-1"></p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button id="btn-wa-mulai" class="hidden text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full transition"><i class="fas fa-play mr-1"></i>Mulai Sesi</button>
            <button id="btn-wa-qr" class="hidden text-sm border border-green-600 text-green-700 hover:bg-green-50 px-4 py-2 rounded-full transition"><i class="fas fa-qrcode mr-1"></i>Tampilkan QR</button>
            <button data-modal="modal-wa-uji" class="text-sm border border-sumi/20 hover:bg-washi px-4 py-2 rounded-full transition"><i class="fas fa-vial mr-1"></i>Uji Kirim</button>
          </div>
        </div>
        <div id="wa-qr-area" class="hidden mt-4 pt-4 border-t border-sumi/10 text-center">
          <p class="text-sm text-sumi/60 mb-2">Scan QR ini dengan WhatsApp → Perangkat Tertaut</p>
          <img id="wa-qr-img" alt="QR WhatsApp" class="mx-auto max-w-[260px] rounded-xl border border-sumi/10">
        </div>
      </div>

      <!-- Statistik pesan -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div class="bg-white rounded-2xl shadow p-4"><p class="text-xs text-sumi/50">Total Pesan</p><p id="wa-stat-total" class="text-2xl font-bold">0</p></div>
        <div class="bg-white rounded-2xl shadow p-4"><p class="text-xs text-sumi/50">Terkirim</p><p id="wa-stat-terkirim" class="text-2xl font-bold text-green-700">0</p></div>
        <div class="bg-white rounded-2xl shadow p-4"><p class="text-xs text-sumi/50">Gagal</p><p id="wa-stat-gagal" class="text-2xl font-bold text-vermillion">0</p></div>
        <div class="bg-white rounded-2xl shadow p-4"><p class="text-xs text-sumi/50">Hari Ini</p><p id="wa-stat-hari" class="text-2xl font-bold">0</p></div>
      </div>

      <!-- Sub-navigasi -->
      <nav class="flex flex-wrap gap-2 mb-4" id="wa-subnav">
        <button data-wa-sub="log" class="wa-sub-btn active">Log Pesan</button>
        <button data-wa-sub="masuk" class="wa-sub-btn">Pesan Masuk</button>
        <button data-wa-sub="template" class="wa-sub-btn">Template</button>
        <button data-wa-sub="broadcast" class="wa-sub-btn">Broadcast</button>
        <button data-wa-sub="konfigurasi" class="wa-sub-btn">Konfigurasi</button>
      </nav>

      <!-- Sub: Log pesan -->
      <div id="wa-sub-log" class="wa-sub-panel">
        <div class="bg-white rounded-2xl shadow p-5">
          <div class="flex flex-wrap gap-2 mb-3">
            <select id="wa-filter-jenis" class="form-input w-auto text-sm">
              <option value="">Semua jenis</option>
              <option value="otp">OTP</option>
              <option value="pesanan_baru">Pesanan baru</option>
              <option value="pesanan_status">Status pesanan</option>
              <option value="nota">Nota</option>
              <option value="piutang">Piutang</option>
              <option value="cicilan">Cicilan</option>
              <option value="gaji">Gaji</option>
              <option value="manual">Manual</option>
              <option value="broadcast">Broadcast</option>
              <option value="autoreply">Balasan otomatis</option>
              <option value="uji">Uji</option>
            </select>
            <select id="wa-filter-status" class="form-input w-auto text-sm">
              <option value="">Semua status</option>
              <option value="terkirim">Terkirim</option>
              <option value="gagal">Gagal</option>
            </select>
            <input id="wa-cari" type="search" placeholder="Cari nomor / isi / kode…" class="form-input w-auto text-sm flex-1 min-w-[180px]">
          </div>
          <div class="overflow-x-auto"><table class="w-full text-sm data-table" id="table-wa-log"></table></div>
        </div>
      </div>

      <!-- Sub: Pesan masuk -->
      <div id="wa-sub-masuk" class="wa-sub-panel hidden">
        <div class="bg-white rounded-2xl shadow p-5">
          <p class="text-xs text-sumi/50 mb-3"><i class="fas fa-circle-info mr-1 text-vermillion"></i>Pesan yang masuk ke nomor gateway beserta balasan otomatisnya. Perintah yang dikenali: <strong>CEK &lt;kode&gt;</strong>, <strong>HARGA</strong>, <strong>JAM</strong>.</p>
          <div class="overflow-x-auto"><table class="w-full text-sm data-table" id="table-wa-masuk"></table></div>
        </div>
      </div>

      <!-- Sub: Template -->
      <div id="wa-sub-template" class="wa-sub-panel hidden">
        <div class="bg-white rounded-2xl shadow p-5">
          <p class="text-xs text-sumi/50 mb-3"><i class="fas fa-circle-info mr-1 text-vermillion"></i>Ubah isi pesan otomatis. Gunakan penanda seperti <code>{nama}</code>, <code>{kode}</code>, <code>{total}</code>, <code>{rincian}</code> — akan diganti data asli saat dikirim. Format WhatsApp: <code>*tebal*</code>, <code>_miring_</code>.</p>
          <div id="wa-template-list" class="space-y-3"></div>
        </div>
      </div>

      <!-- Sub: Broadcast -->
      <div id="wa-sub-broadcast" class="wa-sub-panel hidden">
        <div class="bg-white rounded-2xl shadow p-5 max-w-2xl">
          <h3 class="font-serifjp font-semibold mb-1">Broadcast ke Pelanggan</h3>
          <p class="text-xs text-vermillion bg-vermillion/10 rounded-lg p-3 mb-4">
            <i class="fas fa-triangle-exclamation mr-1"></i><strong>Hati-hati:</strong> mengirim pesan massal ke nomor yang tidak mengharapkan pesan Anda dapat menyebabkan nomor WhatsApp <strong>diblokir permanen</strong>. Dibatasi 50 nomor per pengiriman dengan jeda otomatis. Kirim hanya ke pelanggan yang sudah pernah bertransaksi.
          </p>
          <div class="space-y-3">
            <div>
              <label class="block text-sm mb-1 font-medium" for="wa-bc-target">Kelompok Penerima</label>
              <select id="wa-bc-target" class="form-input">
                <option value="semua">Semua pelanggan aktif</option>
                <option value="aktif30">Pelanggan belanja 30 hari terakhir</option>
                <option value="piutang">Pelanggan punya piutang</option>
                <option value="tipe">Berdasarkan tipe pelanggan</option>
              </select>
            </div>
            <div id="wa-bc-tipe-area" class="hidden">
              <label class="block text-sm mb-1 font-medium" for="wa-bc-tipe">Tipe Pelanggan</label>
              <select id="wa-bc-tipe" class="form-input">
                <option value="eceran">Eceran</option>
                <option value="warung">Warung</option>
                <option value="resto">Resto</option>
                <option value="reseller">Reseller</option>
              </select>
            </div>
            <p id="wa-bc-hitung" class="text-sm text-sumi/60"></p>
            <div>
              <label class="block text-sm mb-1 font-medium" for="wa-bc-pesan">Isi Pesan</label>
              <textarea id="wa-bc-pesan" rows="6" maxlength="3000" class="form-input" placeholder="Halo {nama}, panen jamur segar hari ini sudah siap! Pesan sekarang ya. — {situs}"></textarea>
              <p class="text-xs text-sumi/50 mt-1">Penanda tersedia: <code>{nama}</code>, <code>{situs}</code></p>
            </div>
            <button id="btn-wa-broadcast" class="bg-green-600 hover:bg-green-700 text-white px-8 py-2.5 rounded-full font-medium transition"><i class="fab fa-whatsapp mr-1"></i>Kirim Broadcast</button>
          </div>
        </div>
      </div>

      <!-- Sub: Konfigurasi -->
      <div id="wa-sub-konfigurasi" class="wa-sub-panel hidden">
        <form id="form-wa-config" class="bg-white rounded-2xl shadow p-5 max-w-2xl space-y-4">
          <h3 class="font-serifjp font-semibold">Konfigurasi Gateway</h3>
          <p class="text-xs text-sumi/50 bg-washi rounded-lg p-3">
            <i class="fas fa-circle-info mr-1 text-vermillion"></i>
            OpenWA adalah gateway WhatsApp yang dipasang di <strong>VPS Anda sendiri</strong> (tidak bisa jalan di Cloudflare).
            Isi URL gateway & nama sesi di sini. <strong>API key dan secret webhook</strong> disimpan sebagai <em>secret server</em>, tidak lewat halaman ini.
          </p>

          <div>
            <label class="block text-sm mb-1 font-medium" for="wa-cfg-url">URL Gateway OpenWA</label>
            <input id="wa-cfg-url" type="url" class="form-input" placeholder="https://wa.domainanda.com">
            <p class="text-xs text-sumi/50 mt-1">Harus bisa diakses dari internet (Cloudflare memanggilnya). Jangan pakai <code>localhost</code> untuk produksi.</p>
          </div>
          <div>
            <label class="block text-sm mb-1 font-medium" for="wa-cfg-session">Nama / ID Sesi</label>
            <input id="wa-cfg-session" type="text" class="form-input" placeholder="hiratake">
          </div>

          <div class="border-t border-sumi/10 pt-4">
            <p class="text-sm font-medium mb-2">Status Kredensial Server</p>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <p id="wa-cfg-apikey" class="bg-washi rounded-lg px-3 py-2">API key: —</p>
              <p id="wa-cfg-secret" class="bg-washi rounded-lg px-3 py-2">Webhook secret: —</p>
            </div>
            <details class="mt-3 text-xs text-sumi/60">
              <summary class="cursor-pointer font-medium text-vermillion">Cara memasang kredensial (klik)</summary>
              <div class="mt-2 space-y-2 bg-washi rounded-lg p-3">
                <p><strong>1. Produksi (Cloudflare):</strong></p>
                <pre class="bg-sumi text-washi p-2 rounded overflow-x-auto text-[11px]">npx wrangler pages secret put OPENWA_API_KEY
npx wrangler pages secret put OPENWA_WEBHOOK_SECRET</pre>
                <p><strong>2. Lokal:</strong> isi berkas <code>.dev.vars</code> di folder proyek.</p>
                <p><strong>3. Daftarkan webhook di OpenWA</strong> agar balasan otomatis & OTP jalan:</p>
                <pre class="bg-sumi text-washi p-2 rounded overflow-x-auto text-[11px]" id="wa-cfg-webhook-cmd"></pre>
              </div>
            </details>
          </div>

          <div class="border-t border-sumi/10 pt-4">
            <p class="text-sm font-medium mb-3">Saklar Fitur</p>
            <div class="space-y-2 text-sm">
              <label class="flex items-start gap-2 cursor-pointer"><input id="wa-cfg-aktif" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span><strong>Aktifkan integrasi WhatsApp</strong><br><span class="text-xs text-sumi/50">Saklar utama — bila mati, tidak ada pesan yang dikirim.</span></span></label>
              <label class="flex items-start gap-2 cursor-pointer"><input id="wa-cfg-otp-login" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Login pengelola pakai kode WhatsApp<br><span class="text-xs text-sumi/50">Pengguna wajib punya nomor WA terdaftar (atur di tab Pengguna).</span></span></label>
              <label class="flex items-start gap-2 cursor-pointer"><input id="wa-cfg-otp-pesanan" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Pesanan online wajib verifikasi nomor<br><span class="text-xs text-sumi/50">Mencegah pesanan palsu dengan nomor ngawur.</span></span></label>
              <label class="flex items-start gap-2 cursor-pointer"><input id="wa-cfg-autoreply" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Balasan otomatis (CEK / HARGA / JAM)</span></label>
              <label class="flex items-start gap-2 cursor-pointer"><input id="wa-cfg-notif-pesanan" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Konfirmasi ke pelanggan saat pesanan masuk</span></label>
              <label class="flex items-start gap-2 cursor-pointer"><input id="wa-cfg-notif-status" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Kabari pelanggan saat status pesanan berubah</span></label>
              <label class="flex items-start gap-2 cursor-pointer"><input id="wa-cfg-notif-nota" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Kirim nota saat pesanan selesai</span></label>
              <label class="flex items-start gap-2 cursor-pointer"><input id="wa-cfg-notif-piutang" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Pengingat piutang otomatis + konfirmasi cicilan</span></label>
              <label class="flex items-start gap-2 cursor-pointer"><input id="wa-cfg-notif-gaji" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Kirim slip gaji ke karyawan</span></label>
              <label class="flex items-start gap-2 cursor-pointer"><input id="wa-cfg-notif-internal" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Kabari owner/admin saat ada pesanan web baru</span></label>
              <label class="flex items-start gap-2 cursor-pointer"><input id="wa-cfg-notif-ringkasan" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Ringkasan harian pagi ke owner (panen, omzet, absensi, piutang)</span></label>
            </div>
          </div>

          <div class="border-t border-sumi/10 pt-4 grid grid-cols-2 gap-3 items-end">
            <div>
              <label class="block text-sm mb-1 font-medium" for="wa-cfg-jam">Jam Pengingat Harian (WIB)</label>
              <input id="wa-cfg-jam" type="number" min="0" max="23" class="form-input">
              <p class="text-xs text-sumi/50 mt-1">Pengingat piutang dikirim sekali sehari setelah jam ini.</p>
            </div>
            <button type="button" id="btn-wa-pengingat" class="text-sm border border-sumi/20 hover:bg-washi px-4 py-2.5 rounded-full transition"><i class="fas fa-bell mr-1"></i>Jalankan Pengingat Sekarang</button>
          </div>

          <button class="bg-vermillion hover:bg-red-700 text-white px-8 py-2.5 rounded-full font-medium transition">Simpan Konfigurasi</button>
        </form>
      </div>

      <!-- Modal: kirim pesan manual -->
      <div id="modal-wa-kirim" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-wa-kirim" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-wa-kirim" class="space-y-3">
            <h2 class="font-serifjp font-semibold"><i class="fab fa-whatsapp text-green-600 mr-2"></i>Kirim Pesan WhatsApp</h2>
            <div><label class="block text-sm mb-1" for="wa-kirim-nomor">Nomor Tujuan</label><input id="wa-kirim-nomor" type="tel" required class="form-input" placeholder="081234567890"></div>
            <div><label class="block text-sm mb-1" for="wa-kirim-pesan">Isi Pesan</label><textarea id="wa-kirim-pesan" rows="5" required maxlength="4000" class="form-input"></textarea></div>
            <button class="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-full font-medium transition">Kirim</button>
          </form>
        </div>
      </div>

      <!-- Modal: uji kirim -->
      <div id="modal-wa-uji" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-wa-uji" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-wa-uji" class="space-y-3">
            <h2 class="font-serifjp font-semibold"><i class="fas fa-vial text-vermillion mr-2"></i>Uji Koneksi WhatsApp</h2>
            <p class="text-sm text-sumi/60">Kirim pesan percobaan ke nomor Anda untuk memastikan gateway berfungsi.</p>
            <div><label class="block text-sm mb-1" for="wa-uji-nomor">Nomor WhatsApp Anda</label><input id="wa-uji-nomor" type="tel" required class="form-input" placeholder="081234567890"></div>
            <button class="w-full bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-medium transition">Kirim Pesan Uji</button>
          </form>
        </div>
      </div>

      <!-- Modal: edit template -->
      <div id="modal-wa-template" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-wa-template" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-wa-template" class="space-y-3">
            <h2 class="font-serifjp font-semibold" id="wa-tpl-judul">Ubah Template</h2>
            <input type="hidden" id="wa-tpl-kode">
            <div><label class="block text-sm mb-1" for="wa-tpl-isi">Isi Pesan</label><textarea id="wa-tpl-isi" rows="10" required maxlength="3000" class="form-input font-mono text-xs"></textarea></div>
            <label class="flex items-center gap-2 text-sm cursor-pointer"><input id="wa-tpl-aktif" type="checkbox" class="w-4 h-4 accent-[#C73E3A]">Template aktif</label>
            <div class="bg-washi rounded-lg p-3">
              <p class="text-xs font-medium mb-1">Pratinjau (data contoh)</p>
              <pre id="wa-tpl-pratinjau" class="text-xs whitespace-pre-wrap text-sumi/70"></pre>
            </div>
            <div class="flex gap-2">
              <button type="button" id="btn-wa-tpl-pratinjau" class="flex-1 border border-sumi/20 hover:bg-washi py-2.5 rounded-full text-sm transition">Pratinjau</button>
              <button class="flex-1 bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-medium transition">Simpan</button>
            </div>
          </form>
        </div>
      </div>
    </section>

    <!-- Tab: Pembayaran -->
    <section id="tab-pembayaran" class="tab-panel hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-credit-card text-vermillion mr-2"></i>Pembayaran &amp; Checkout</h2>
        <div class="flex gap-2">
          <button id="btn-bayar-refresh" class="text-sm border border-sumi/20 hover:bg-washi px-4 py-2 rounded-full transition"><i class="fas fa-rotate mr-1"></i>Segarkan</button>
          <a href="/#produk" target="_blank" rel="noopener" class="text-sm border border-sumi/20 hover:bg-washi px-4 py-2 rounded-full transition"><i class="fas fa-arrow-up-right-from-square mr-1"></i>Buka Daftar Produk</a>
        </div>
      </div>

      <!-- Status gateway -->
      <div class="bg-white rounded-2xl shadow p-5 mb-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-sumi/50 uppercase tracking-wide mb-1">Payment Gateway</p>
            <p id="bayar-status-teks" class="font-semibold text-lg">Memuat…</p>
            <p id="bayar-status-pesan" class="text-sm text-sumi/60 mt-1"></p>
            <div id="bayar-status-pill" class="flex flex-wrap gap-2 mt-2"></div>
          </div>
          <button id="btn-bayar-uji" class="hidden text-sm border border-sumi/20 hover:bg-washi px-4 py-2 rounded-full transition" data-roles="owner"><i class="fas fa-vial mr-1"></i>Uji Gateway</button>
        </div>
      </div>

      <!-- Statistik -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div class="bg-white rounded-2xl shadow p-4"><p class="text-xs text-sumi/50">Total Transaksi</p><p id="bayar-stat-total" class="text-2xl font-bold">0</p></div>
        <div class="bg-white rounded-2xl shadow p-4"><p class="text-xs text-sumi/50">Menunggu Bayar</p><p id="bayar-stat-menunggu" class="text-2xl font-bold text-kin">0</p></div>
        <div class="bg-white rounded-2xl shadow p-4"><p class="text-xs text-sumi/50">Nilai Lunas</p><p id="bayar-stat-nilai" class="text-2xl font-bold text-green-700">Rp 0</p></div>
        <div class="bg-white rounded-2xl shadow p-4"><p class="text-xs text-sumi/50">Masuk Hari Ini</p><p id="bayar-stat-hari" class="text-2xl font-bold">Rp 0</p></div>
      </div>

      <!-- Sub-navigasi -->
      <nav class="flex flex-wrap gap-2 mb-4" id="bayar-subnav">
        <button data-bayar-sub="transaksi" class="bayar-sub-btn active">Transaksi</button>
        <button data-bayar-sub="gateway" class="bayar-sub-btn">Gateway &amp; Metode</button>
        <button data-bayar-sub="biaya" class="bayar-sub-btn">Biaya &amp; Ongkir</button>
        <button data-bayar-sub="fitur" class="bayar-sub-btn">Fitur OTP &amp; Notifikasi</button>
        <button data-bayar-sub="panduan" class="bayar-sub-btn">Panduan</button>
      </nav>

      <!-- Sub: Transaksi -->
      <div id="bayar-sub-transaksi" class="bayar-sub-panel">
        <div class="bg-white rounded-2xl shadow p-5">
          <div class="flex flex-wrap gap-2 mb-3">
            <select id="bayar-filter-status" class="form-input w-auto text-sm">
              <option value="">Semua status</option>
              <option value="menunggu">Menunggu</option>
              <option value="dibayar">Lunas</option>
              <option value="kedaluwarsa">Kedaluwarsa</option>
              <option value="batal">Batal</option>
              <option value="gagal">Gagal</option>
            </select>
            <select id="bayar-filter-metode" class="form-input w-auto text-sm">
              <option value="">Semua metode</option>
              <option value="cash">Tunai / COD</option>
              <option value="qris">QRIS</option>
              <option value="transfer">Transfer</option>
            </select>
            <input id="bayar-cari" type="search" placeholder="Cari kode / nama / nomor…" class="form-input w-auto text-sm flex-1 min-w-[180px]">
          </div>
          <p class="text-xs text-sumi/50 mb-3"><i class="fas fa-circle-info mr-1 text-vermillion"></i>Untuk QRIS statis &amp; tunai, tandai <strong>Lunas</strong> setelah dana benar-benar Anda terima. Gateway otomatis (Midtrans/Xendit/Duitku/Tripay) menandai lunas sendiri lewat callback.</p>
          <div class="overflow-x-auto"><table class="w-full text-sm data-table" id="table-bayar"></table></div>
        </div>
      </div>

      <!-- Sub: Gateway & Metode -->
      <div id="bayar-sub-gateway" class="bayar-sub-panel hidden">
        <form id="form-bayar-gateway" class="bg-white rounded-2xl shadow p-5 max-w-2xl space-y-4">
          <h3 class="font-serifjp font-semibold">Metode Pembayaran &amp; Provider</h3>
          <p class="text-xs text-sumi/50 bg-washi rounded-lg p-3">
            <i class="fas fa-circle-info mr-1 text-vermillion"></i>
            Sistem ini <strong>universal</strong>: pilih salah satu provider di bawah, sisanya otomatis menyesuaikan.
            <strong>Kredensial (server key)</strong> disimpan sebagai <em>secret server</em>, tidak pernah lewat halaman ini.
          </p>

          <div class="space-y-2 text-sm border border-sumi/10 rounded-xl p-4">
            <label class="flex items-start gap-2 cursor-pointer"><input id="bayar-cfg-aktif" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span><strong>Aktifkan checkout online</strong><br><span class="text-xs text-sumi/50">Saklar utama halaman <code>/checkout</code>. Bila mati, pelanggan hanya bisa pesan lewat WhatsApp.</span></span></label>
            <label class="flex items-start gap-2 cursor-pointer"><input id="bayar-cfg-cash" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Terima <strong>Tunai / COD</strong><br><span class="text-xs text-sumi/50">Pelanggan bayar saat barang diantar/diambil. Tidak butuh gateway.</span></span></label>
            <label class="flex items-start gap-2 cursor-pointer"><input id="bayar-cfg-qris" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Terima <strong>QRIS</strong><br><span class="text-xs text-sumi/50">Butuh gambar QRIS statis, atau kredensial gateway bila memakai provider otomatis.</span></span></label>
          </div>

          <div class="border-t border-sumi/10 pt-4 grid md:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm mb-1 font-medium" for="bayar-cfg-provider">Provider Pembayaran</label>
              <select id="bayar-cfg-provider" class="form-input"></select>
              <p id="bayar-cfg-provider-catatan" class="text-xs text-sumi/50 mt-1"></p>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="bayar-cfg-mode">Mode</label>
              <select id="bayar-cfg-mode" class="form-input">
                <option value="sandbox">Sandbox (uji coba)</option>
                <option value="produksi">Produksi (uang nyata)</option>
              </select>
              <p class="text-xs text-sumi/50 mt-1">Gunakan sandbox dulu sebelum ke produksi.</p>
            </div>
          </div>

          <div id="bayar-cfg-gateway-area" class="hidden grid md:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm mb-1 font-medium" for="bayar-cfg-merchant">Kode Merchant</label>
              <input id="bayar-cfg-merchant" type="text" class="form-input" placeholder="Duitku/Tripay: kode merchant">
              <p class="text-xs text-sumi/50 mt-1">Hanya perlu untuk Duitku &amp; Tripay.</p>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="bayar-cfg-channel">Kode Channel</label>
              <input id="bayar-cfg-channel" type="text" class="form-input" placeholder="Contoh: SP (Duitku QRIS) / qris (Tripay)">
              <p class="text-xs text-sumi/50 mt-1">Kosongkan untuk memakai bawaan provider.</p>
            </div>
          </div>

          <div id="bayar-cfg-manual-area" class="hidden grid md:grid-cols-2 gap-3">
            <div class="md:col-span-2">
              <label class="block text-sm mb-1 font-medium" for="bayar-cfg-qris-gambar">URL Gambar QRIS Anda</label>
              <input id="bayar-cfg-qris-gambar" type="url" class="form-input" placeholder="https://…/qris-usaha-saya.png">
              <p class="text-xs text-sumi/50 mt-1">Unggah gambar QRIS statis dari bank/e-wallet Anda ke hosting gambar apa pun, lalu tempel URL-nya di sini.</p>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="bayar-cfg-qris-nama">Nama Merchant di QRIS</label>
              <input id="bayar-cfg-qris-nama" type="text" class="form-input" placeholder="Hiratake Farm">
            </div>
            <div id="bayar-cfg-qris-pratinjau-wrap" class="hidden">
              <p class="text-sm mb-1 font-medium">Pratinjau</p>
              <img id="bayar-cfg-qris-pratinjau" alt="Pratinjau QRIS" class="max-h-32 rounded-lg border border-sumi/10 bg-white p-1">
            </div>
          </div>

          <div class="border-t border-sumi/10 pt-4">
            <p class="text-sm font-medium mb-2">Status Kredensial Server</p>
            <div class="grid sm:grid-cols-3 gap-2 text-sm">
              <p id="bayar-cfg-serverkey" class="bg-washi rounded-lg px-3 py-2">Server key: —</p>
              <p id="bayar-cfg-clientkey" class="bg-washi rounded-lg px-3 py-2">Client key: —</p>
              <p id="bayar-cfg-callbacksecret" class="bg-washi rounded-lg px-3 py-2">Callback secret: —</p>
            </div>
            <div class="mt-3">
              <p class="text-sm font-medium mb-1">URL Callback / Webhook</p>
              <div class="flex gap-2">
                <input id="bayar-cfg-callback-url" type="text" readonly class="form-input font-mono text-xs bg-washi">
                <button type="button" id="btn-bayar-copy-callback" class="shrink-0 border border-sumi/20 hover:bg-washi px-4 rounded-full text-sm transition"><i class="fas fa-copy"></i></button>
              </div>
              <p class="text-xs text-sumi/50 mt-1">Tempel URL ini di dashboard provider Anda (Payment Notification / Callback URL).</p>
            </div>
          </div>

          <div class="border-t border-sumi/10 pt-4">
            <label class="block text-sm mb-1 font-medium" for="bayar-cfg-instruksi-cash">Instruksi untuk Pembayaran Tunai</label>
            <textarea id="bayar-cfg-instruksi-cash" rows="3" maxlength="500" class="form-input" placeholder="Siapkan uang tunai saat kurir tiba. Kurir akan meminta kode konfirmasi dari WhatsApp Anda."></textarea>
          </div>

          <button class="bg-vermillion hover:bg-red-700 text-white px-8 py-2.5 rounded-full font-medium transition">Simpan Pengaturan Gateway</button>
        </form>
      </div>

      <!-- Sub: Biaya & Ongkir -->
      <div id="bayar-sub-biaya" class="bayar-sub-panel hidden">
        <form id="form-bayar-biaya" class="bg-white rounded-2xl shadow p-5 max-w-2xl space-y-4">
          <h3 class="font-serifjp font-semibold">Biaya Layanan, Ongkir &amp; Batas Nilai</h3>

          <div class="grid md:grid-cols-3 gap-3">
            <div>
              <label class="block text-sm mb-1 font-medium" for="bayar-cfg-biaya-mode">Biaya Gateway Ditanggung</label>
              <select id="bayar-cfg-biaya-mode" class="form-input">
                <option value="serap">Usaha saya (serap)</option>
                <option value="bebankan">Pelanggan (bebankan)</option>
              </select>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="bayar-cfg-biaya-persen">Biaya Persen (%)</label>
              <input id="bayar-cfg-biaya-persen" type="number" step="0.01" min="0" max="10" class="form-input">
              <p class="text-xs text-sumi/50 mt-1">QRIS umumnya 0,7%.</p>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="bayar-cfg-biaya-tetap">Biaya Tetap (Rp)</label>
              <input id="bayar-cfg-biaya-tetap" type="number" min="0" class="form-input">
            </div>
          </div>

          <div class="grid md:grid-cols-3 gap-3 border-t border-sumi/10 pt-4">
            <div>
              <label class="block text-sm mb-1 font-medium" for="bayar-cfg-kedaluwarsa">Batas Waktu Bayar (menit)</label>
              <input id="bayar-cfg-kedaluwarsa" type="number" min="5" max="1440" class="form-input">
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="bayar-cfg-min-qris">Minimum QRIS (Rp)</label>
              <input id="bayar-cfg-min-qris" type="number" min="0" class="form-input">
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="bayar-cfg-maks-qris">Maksimum QRIS (Rp)</label>
              <input id="bayar-cfg-maks-qris" type="number" min="0" class="form-input">
              <p class="text-xs text-sumi/50 mt-1">Batas QRIS nasional Rp 10 juta.</p>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-3 border-t border-sumi/10 pt-4">
            <div>
              <label class="block text-sm mb-1 font-medium" for="bayar-cfg-ongkir">Ongkos Kirim (Rp)</label>
              <input id="bayar-cfg-ongkir" type="number" min="0" class="form-input">
              <p class="text-xs text-sumi/50 mt-1">Isi 0 bila gratis / ambil sendiri.</p>
            </div>
            <div>
              <label class="block text-sm mb-1 font-medium" for="bayar-cfg-ongkir-gratis">Gratis Ongkir Mulai (Rp)</label>
              <input id="bayar-cfg-ongkir-gratis" type="number" min="0" class="form-input">
              <p class="text-xs text-sumi/50 mt-1">Isi 0 untuk mematikan promo gratis ongkir.</p>
            </div>
          </div>

          <div class="bg-washi rounded-lg p-3 text-xs text-sumi/70">
            <p class="font-medium mb-1"><i class="fas fa-calculator mr-1 text-vermillion"></i>Simulasi</p>
            <p id="bayar-simulasi">Subtotal Rp 100.000 → …</p>
          </div>

          <button class="bg-vermillion hover:bg-red-700 text-white px-8 py-2.5 rounded-full font-medium transition">Simpan Biaya &amp; Ongkir</button>
        </form>
      </div>

      <!-- Sub: Fitur OTP & Notifikasi -->
      <div id="bayar-sub-fitur" class="bayar-sub-panel hidden">
        <form id="form-bayar-fitur" class="bg-white rounded-2xl shadow p-5 max-w-2xl space-y-4">
          <h3 class="font-serifjp font-semibold">Fitur Pendukung Berbasis OTP WhatsApp</h3>
          <p class="text-xs text-sumi/50 bg-washi rounded-lg p-3">
            <i class="fas fa-circle-info mr-1 text-vermillion"></i>
            Fitur di bawah memanfaatkan gateway WhatsApp yang sudah terpasang. Bila WhatsApp mati, fitur ini otomatis dilewati tanpa menggagalkan transaksi.
          </p>

          <div class="space-y-2 text-sm">
            <p class="text-xs font-semibold uppercase tracking-wide text-sumi/40 pt-1">Lacak Pesanan Mandiri</p>
            <label class="flex items-start gap-2 cursor-pointer"><input id="bayar-cfg-lacak-aktif" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span><strong>Aktifkan halaman <code>/lacak</code></strong><br><span class="text-xs text-sumi/50">Pelanggan pantau status pesanan sendiri — mengurangi chat "pesanan saya sudah jalan belum?".</span></span></label>
            <label class="flex items-start gap-2 cursor-pointer"><input id="bayar-cfg-lacak-otp" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Izinkan lacak dengan kode OTP WhatsApp<br><span class="text-xs text-sumi/50">Pelanggan yang kehilangan link lacak bisa masuk pakai nomor WA + kode. Dibatasi 10 permintaan/hari per nomor.</span></span></label>

            <p class="text-xs font-semibold uppercase tracking-wide text-sumi/40 pt-3">Bukti Serah Terima (Anti Sengketa)</p>
            <label class="flex items-start gap-2 cursor-pointer"><input id="bayar-cfg-terima-otp" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span><strong>Konfirmasi barang diterima pakai OTP</strong><br><span class="text-xs text-sumi/50">Kurir minta kode dikirim ke WA pelanggan, pelanggan sebutkan kodenya, kurir masukkan di tab Pesanan. Jadi bukti digital bahwa barang benar diterima.</span></span></label>

            <p class="text-xs font-semibold uppercase tracking-wide text-sumi/40 pt-3">Notifikasi Pembayaran</p>
            <label class="flex items-start gap-2 cursor-pointer"><input id="bayar-cfg-notif-menunggu" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Kirim link pembayaran + batas waktu ke pelanggan<br><span class="text-xs text-sumi/50">Menaikkan tingkat pembayaran karena pelanggan tidak kehilangan link QRIS.</span></span></label>
            <label class="flex items-start gap-2 cursor-pointer"><input id="bayar-cfg-notif-lunas" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Kirim bukti lunas + link lacak ke pelanggan</span></label>
            <label class="flex items-start gap-2 cursor-pointer"><input id="bayar-cfg-notif-internal" type="checkbox" class="w-4 h-4 mt-0.5 accent-[#C73E3A]"><span>Kabari owner/admin setiap ada pembayaran masuk<br><span class="text-xs text-sumi/50">Anda tahu uang masuk tanpa harus buka dashboard.</span></span></label>
          </div>

          <p class="text-xs text-sumi/50 border-t border-sumi/10 pt-3">
            <i class="fas fa-pen-to-square mr-1 text-vermillion"></i>Isi pesan bisa diubah di tab <strong>WhatsApp → Template</strong>
            (<code>bayar_menunggu</code>, <code>bayar_lunas</code>, <code>bayar_kedaluwarsa</code>, <code>lacak_otp</code>, <code>terima_otp</code>, <code>terima_selesai</code>).
          </p>

          <button class="bg-vermillion hover:bg-red-700 text-white px-8 py-2.5 rounded-full font-medium transition">Simpan Fitur</button>
        </form>
      </div>

      <!-- Sub: Panduan -->
      <div id="bayar-sub-panduan" class="bayar-sub-panel hidden">
        <div class="bg-white rounded-2xl shadow p-5 max-w-3xl space-y-5 text-sm">
          <h3 class="font-serifjp font-semibold text-base">Panduan Pemasangan Payment Gateway</h3>

          <div>
            <p class="font-medium mb-1"><i class="fas fa-1 text-vermillion mr-2"></i>Cara termurah: QRIS Statis (tanpa gateway)</p>
            <p class="text-sumi/70 text-xs leading-relaxed">Pilih provider <strong>QRIS Statis</strong>, tempel URL gambar QRIS dari bank/e-wallet Anda. Pelanggan scan lalu kirim bukti lewat WhatsApp, Anda tandai <strong>Lunas</strong> di tab Transaksi. Gratis, tapi verifikasi manual.</p>
          </div>

          <div>
            <p class="font-medium mb-1"><i class="fas fa-2 text-vermillion mr-2"></i>Otomatis: pakai gateway</p>
            <p class="text-sumi/70 text-xs leading-relaxed mb-2">Daftar ke salah satu provider, ambil kredensialnya, lalu pasang sebagai secret server:</p>
            <pre class="bg-sumi text-washi p-3 rounded-lg overflow-x-auto text-[11px]">npx wrangler pages secret put BAYAR_SERVER_KEY
npx wrangler pages secret put BAYAR_CLIENT_KEY
npx wrangler pages secret put BAYAR_CALLBACK_SECRET</pre>
            <p class="text-xs text-sumi/50 mt-1">Untuk pengembangan lokal, isi berkas <code>.dev.vars</code>. Kredensial <strong>tidak pernah</strong> disimpan di database maupun dikirim ke browser.</p>
          </div>

          <div>
            <p class="font-medium mb-2"><i class="fas fa-3 text-vermillion mr-2"></i>Kredensial per provider</p>
            <div class="overflow-x-auto">
              <table class="w-full text-xs data-table">
                <thead><tr><th>Provider</th><th>BAYAR_SERVER_KEY</th><th>Lain-lain</th></tr></thead>
                <tbody>
                  <tr><td>Midtrans</td><td>Server Key</td><td>Client Key (opsional). Callback: <em>Payment Notification URL</em>.</td></tr>
                  <tr><td>Xendit</td><td>Secret API Key</td><td>CALLBACK_SECRET = <em>Callback Verification Token</em>.</td></tr>
                  <tr><td>Duitku</td><td>API Key</td><td>Kode Merchant diisi di form Gateway.</td></tr>
                  <tr><td>Tripay</td><td>Private Key</td><td>CLIENT_KEY = API Key, CALLBACK_SECRET = Private Key. Kode Merchant diisi di form.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p class="font-medium mb-1"><i class="fas fa-4 text-vermillion mr-2"></i>Daftarkan URL callback</p>
            <p class="text-sumi/70 text-xs leading-relaxed">Tempel URL callback (lihat tab <strong>Gateway &amp; Metode</strong>) ke dashboard provider. Tanpa ini, pembayaran yang berhasil tidak akan otomatis ditandai lunas.</p>
          </div>

          <div class="bg-vermillion/10 rounded-lg p-3">
            <p class="text-xs text-vermillion leading-relaxed">
              <i class="fas fa-shield-halved mr-1"></i><strong>Keamanan:</strong> setiap callback diverifikasi tanda tangannya, nominal dicocokkan dengan tagihan,
              dan callback ganda ditolak otomatis. Callback dengan tanda tangan salah dicatat tapi tidak diproses.
            </p>
          </div>
        </div>
      </div>

      <!-- Modal: konfirmasi terima barang via OTP -->
      <div id="modal-bayar-terima" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-bayar-terima" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-bayar-terima" class="space-y-3">
            <h2 class="font-serifjp font-semibold"><i class="fas fa-hand-holding-heart text-vermillion mr-2"></i>Konfirmasi Barang Diterima</h2>
            <p class="text-sm text-sumi/60">Kirim kode ke WhatsApp pelanggan, minta pelanggan menyebutkan kodenya, lalu masukkan di sini sebagai bukti serah terima.</p>
            <input type="hidden" id="bayar-terima-id">
            <p class="bg-washi rounded-lg px-3 py-2 text-sm">Pesanan: <strong id="bayar-terima-kode">—</strong></p>
            <button type="button" id="btn-bayar-terima-kirim" class="w-full border border-green-600 text-green-700 hover:bg-green-50 py-2.5 rounded-full text-sm font-medium transition"><i class="fab fa-whatsapp mr-1"></i>Kirim Kode ke Pelanggan</button>
            <div>
              <label class="block text-sm mb-1" for="bayar-terima-otp">Kode dari Pelanggan</label>
              <input id="bayar-terima-otp" type="text" inputmode="numeric" maxlength="6" required class="form-input tracking-[0.3em] text-center font-semibold" placeholder="000000">
            </div>
            <button class="w-full bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-medium transition">Tandai Diterima</button>
          </form>
        </div>
      </div>
    </section>

    <section id="tab-aktivitas" class="tab-panel hidden">
      <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
        <h2 class="font-serifjp font-semibold mb-1"><i class="fas fa-clock-rotate-left text-vermillion mr-2"></i>Log Aktivitas</h2>
        <p class="text-xs text-sumi/50 mb-3">200 aktivitas terakhir: siapa melakukan apa & kapan. Untuk penelusuran jika ada data janggal.</p>
        <table class="w-full text-sm data-table" id="table-audit"></table>
      </div>
    </section>

    <!-- Tab: Pengguna (owner) -->
    <section id="tab-pengguna" class="tab-panel hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 class="font-serifjp font-semibold text-lg"><i class="fas fa-users text-vermillion mr-2"></i>Pengguna</h2>
        <button data-modal="modal-user" class="btn-tambah"><i class="fas fa-plus mr-1"></i>Tambah Pengguna</button>
      </div>
      <div id="modal-user" class="modal hidden">
        <div class="modal-box">
          <button type="button" class="modal-close" data-close="modal-user" aria-label="Tutup"><i class="fas fa-times"></i></button>
          <form id="form-user" class="space-y-3">
          <h2 class="font-serifjp font-semibold"><i class="fas fa-user-plus text-vermillion mr-2"></i>Tambah Pengguna</h2>
          <div><label class="block text-sm mb-1" for="user-username">Username</label><input id="user-username" type="text" required class="form-input"></div>
          <div><label class="block text-sm mb-1" for="user-nama-input">Nama Lengkap</label><input id="user-nama-input" type="text" required class="form-input"></div>
          <div><label class="block text-sm mb-1" for="user-password">Kata Sandi</label><input id="user-password" type="password" required minlength="6" class="form-input"></div>
          <div>
            <label class="block text-sm mb-1" for="user-role-input">Peran</label>
            <select id="user-role-input" class="form-input">
              <option value="karyawan">Karyawan</option>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <button class="w-full bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-medium transition">Tambah</button>
        </form>
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
        <h2 class="font-serifjp font-semibold mb-3">Daftar Pengguna</h2>
        <table class="w-full text-sm data-table" id="table-user"></table>
      </div>
    </section>
  </main>

  <div id="toast" class="hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-sumi text-washi px-6 py-3 rounded-full shadow-xl text-sm z-50"></div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="/static/admin.js"></script>
</body>
</html>`
