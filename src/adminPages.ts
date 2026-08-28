// ===== Halaman Login & Dashboard Hiratake =====

const head = (title: string) => `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="icon" type="image/png" href="/static/logo-hiratake.png">
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

  <!-- Header -->
  <header class="bg-sumi text-washi sticky top-0 z-40 shadow-lg">
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href="/" class="flex items-center gap-3">
        <img src="/static/logo-hiratake.png" alt="Logo" class="w-10 h-10 rounded-full ring-1 ring-white/20">
        <div>
          <span class="font-serifjp font-bold">HIRATAKE</span>
          <span class="block text-[10px] text-kin tracking-widest -mt-0.5">PANEL PENGELOLAAN・管理</span>
        </div>
      </a>
      <div class="flex items-center gap-4">
        <div class="text-right hidden sm:block">
          <p id="user-nama" class="text-sm font-semibold"></p>
          <p id="user-role" class="text-[11px] text-kin uppercase tracking-wider"></p>
        </div>
        <button id="logout-btn" class="bg-vermillion hover:bg-red-700 px-4 py-2 rounded-full text-sm transition" title="Keluar">
          <i class="fas fa-right-from-bracket sm:mr-1"></i><span class="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </div>
    <!-- Tab navigasi -->
    <nav class="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto" id="tab-nav">
      <button data-tab="dashboard" class="tab-btn active"><i class="fas fa-chart-line mr-1"></i>Ringkasan</button>
      <button data-tab="baglog" class="tab-btn"><i class="fas fa-cubes mr-1"></i>Baglog</button>
      <button data-tab="panen" class="tab-btn"><i class="fas fa-wheat-awn mr-1"></i>Panen</button>
      <button data-tab="penjualan" class="tab-btn"><i class="fas fa-cash-register mr-1"></i>Penjualan</button>
      <button data-tab="piutang" class="tab-btn"><i class="fas fa-file-invoice-dollar mr-1"></i>Piutang</button>
      <button data-tab="pelanggan" class="tab-btn"><i class="fas fa-address-book mr-1"></i>Pelanggan</button>
      <button data-tab="produk" class="tab-btn hidden" data-roles="owner,admin"><i class="fas fa-box mr-1"></i>Produk</button>
      <button data-tab="pengguna" class="tab-btn hidden" data-roles="owner"><i class="fas fa-users mr-1"></i>Pengguna</button>
      <button data-tab="pengaturan" class="tab-btn hidden" data-roles="owner,admin"><i class="fas fa-gear mr-1"></i>Web</button>
    </nav>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-6">
    <!-- Tab: Ringkasan -->
    <section id="tab-dashboard" class="tab-panel">
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
      <div class="grid lg:grid-cols-3 gap-6">
        <div class="space-y-6">
          <form id="form-baglog" class="bg-white rounded-2xl shadow p-5 space-y-3 h-fit only-admin-owner">
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
          <form id="form-kejadian" class="bg-white rounded-2xl shadow p-5 space-y-3 h-fit">
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
        <div class="lg:col-span-2 bg-white rounded-2xl shadow p-5 overflow-x-auto">
          <h2 class="font-serifjp font-semibold mb-3">Daftar Batch <span class="text-xs font-normal text-sumi/40">(klik baris untuk riwayat kejadian)</span></h2>
          <table class="w-full text-sm data-table" id="table-baglog"></table>
          <div id="detail-kejadian" class="hidden mt-4 border-t pt-4">
            <h3 class="font-semibold text-sm mb-2" id="detail-kejadian-judul"></h3>
            <table class="w-full text-sm data-table" id="table-kejadian"></table>
          </div>
        </div>
      </div>
    </section>

    <!-- Tab: Panen -->
    <section id="tab-panen" class="tab-panel hidden">
      <div class="grid lg:grid-cols-3 gap-6">
        <form id="form-panen" class="bg-white rounded-2xl shadow p-5 space-y-3 h-fit">
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
        <div class="lg:col-span-2 bg-white rounded-2xl shadow p-5 overflow-x-auto">
          <h2 class="font-serifjp font-semibold mb-3">Riwayat Panen</h2>
          <table class="w-full text-sm data-table" id="table-panen"></table>
        </div>
      </div>
    </section>

    <!-- Tab: Penjualan -->
    <section id="tab-penjualan" class="tab-panel hidden">
      <div class="grid lg:grid-cols-3 gap-6">
        <form id="form-penjualan" class="bg-white rounded-2xl shadow p-5 space-y-3 h-fit">
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
        <div class="lg:col-span-2 bg-white rounded-2xl shadow p-5 overflow-x-auto">
          <h2 class="font-serifjp font-semibold mb-3">Riwayat Penjualan</h2>
          <table class="w-full text-sm data-table" id="table-penjualan"></table>
        </div>
      </div>
    </section>

    <!-- Tab: Produk (admin & owner) -->
    <section id="tab-produk" class="tab-panel hidden">
      <div class="grid lg:grid-cols-3 gap-6">
        <form id="form-produk" class="bg-white rounded-2xl shadow p-5 space-y-3 h-fit">
          <h2 class="font-serifjp font-semibold" id="produk-form-title"><i class="fas fa-plus-circle text-vermillion mr-2"></i>Tambah Produk</h2>
          <input type="hidden" id="produk-id">
          <div><label class="block text-sm mb-1" for="produk-nama">Nama Produk</label><input id="produk-nama" type="text" required class="form-input"></div>
          <div><label class="block text-sm mb-1" for="produk-jp">Nama Jepang</label><input id="produk-jp" type="text" placeholder="cth: 新鮮ヒラタケ" class="form-input"></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block text-sm mb-1" for="produk-harga">Harga (Rp)</label><input id="produk-harga" type="number" min="0" required class="form-input"></div>
            <div><label class="block text-sm mb-1" for="produk-satuan">Satuan</label><input id="produk-satuan" type="text" required placeholder="pack/kg" class="form-input"></div>
          </div>
          <div><label class="block text-sm mb-1" for="produk-deskripsi">Deskripsi</label><textarea id="produk-deskripsi" rows="2" class="form-input"></textarea></div>
          <div><label class="block text-sm mb-1" for="produk-badge">Badge (opsional)</label><input id="produk-badge" type="text" placeholder="Terlaris / Baru / Hemat" class="form-input"></div>
          <div class="flex gap-2">
            <button class="flex-1 bg-vermillion hover:bg-red-700 text-white py-2.5 rounded-full font-medium transition">Simpan</button>
            <button type="button" id="produk-batal" class="hidden px-4 border rounded-full text-sm">Batal</button>
          </div>
        </form>
        <div class="lg:col-span-2 bg-white rounded-2xl shadow p-5 overflow-x-auto">
          <h2 class="font-serifjp font-semibold mb-3">Daftar Produk</h2>
          <table class="w-full text-sm data-table" id="table-produk"></table>
        </div>
      </div>
    </section>

    <!-- Tab: Piutang -->
    <section id="tab-piutang" class="tab-panel hidden">
      <div class="bg-white rounded-2xl shadow p-5 overflow-x-auto">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-serifjp font-semibold"><i class="fas fa-file-invoice-dollar text-kin mr-2"></i>Piutang Berjalan</h2>
          <p class="text-sm">Total: <strong id="piutang-total" class="text-vermillion">Rp 0</strong></p>
        </div>
        <table class="w-full text-sm data-table" id="table-piutang"></table>
      </div>
    </section>

    <!-- Tab: Pelanggan -->
    <section id="tab-pelanggan" class="tab-panel hidden">
      <div class="grid lg:grid-cols-3 gap-6">
        <form id="form-pelanggan" class="bg-white rounded-2xl shadow p-5 space-y-3 h-fit">
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
        <div class="lg:col-span-2 bg-white rounded-2xl shadow p-5 overflow-x-auto">
          <h2 class="font-serifjp font-semibold mb-3">Daftar Pelanggan</h2>
          <table class="w-full text-sm data-table" id="table-pelanggan"></table>
        </div>
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
          <button class="bg-vermillion hover:bg-red-700 text-white px-8 py-2.5 rounded-full font-medium transition">Simpan & Terapkan ke Website</button>
        </form>
      </div>
    </section>

    <!-- Tab: Pengguna (owner) -->
    <section id="tab-pengguna" class="tab-panel hidden">
      <div class="grid lg:grid-cols-3 gap-6">
        <form id="form-user" class="bg-white rounded-2xl shadow p-5 space-y-3 h-fit">
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
        <div class="lg:col-span-2 bg-white rounded-2xl shadow p-5 overflow-x-auto">
          <h2 class="font-serifjp font-semibold mb-3">Daftar Pengguna</h2>
          <table class="w-full text-sm data-table" id="table-user"></table>
        </div>
      </div>
    </section>
  </main>

  <div id="toast" class="hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-sumi text-washi px-6 py-3 rounded-full shadow-xl text-sm z-50"></div>

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="/static/admin.js"></script>
</body>
</html>`
