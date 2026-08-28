// ===== Halaman Login & Dashboard Hiratake =====

const head = (title: string) => `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="icon" type="image/png" href="/static/logo-hiratake.png">
  <link rel="manifest" href="/static/manifest.json">
  <meta name="theme-color" content="#2B2B2B">
  <link rel="apple-touch-icon" href="/static/logo-hiratake.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="/static/style.css" rel="stylesheet">
  <script>
    tailwind.config = { theme: { extend: {
      colors: { vermillion: '#C73E3A', sumi: '#2B2B2B', washi: '#F7F3EA', matcha: '#7A8450', kin: '#C9A227' },
      fontFamily: { serifjp: ['"Noto Serif JP"', 'serif'], sans: ['Poppins', 'sans-serif'] }
    } } }
  </script>`

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
      <p class="sidebar-group hidden" data-roles="owner,admin">Keuangan</p>
      <button data-tab="keuangan" class="tab-btn hidden" data-roles="owner,admin"><i class="fas fa-wallet"></i>Keuangan</button>
      <button data-tab="laporan" class="tab-btn hidden" data-roles="owner,admin"><i class="fas fa-file-lines"></i>Laporan</button>
      <p class="sidebar-group hidden" data-roles="owner,admin">Pengelolaan</p>
      <button data-tab="produk" class="tab-btn hidden" data-roles="owner,admin"><i class="fas fa-box"></i>Produk</button>
      <button data-tab="pengguna" class="tab-btn hidden" data-roles="owner"><i class="fas fa-users"></i>Pengguna</button>
      <button data-tab="aktivitas" class="tab-btn hidden" data-roles="owner"><i class="fas fa-clock-rotate-left"></i>Aktivitas</button>
      <button data-tab="pengaturan" class="tab-btn hidden" data-roles="owner,admin"><i class="fas fa-gear"></i>Website</button>
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

    <!-- Tab: Aktivitas / Audit Log (owner) -->
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
