// ============================================================
//  Halaman publik: Checkout, Pembayaran, Lacak Pesanan
//  Semua halaman memakai identitas situs dari pengaturan owner.
// ============================================================

import { asetCss, styleTema } from './tema'

export type IdentitasSitus = {
  nama: string
  namaJp: string
  warna: string
  wa: string
  alamat: string
  jam: string
}

// Escape HTML (anti-XSS) untuk nilai pengaturan yang dirender ke halaman publik
const esc = (x: any) => String(x ?? '').replace(/[&<>"']/g, (m) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] as string))

/** Kerangka HTML bersama (navbar + footer + tema) agar konsisten. */
function kerangka(sRaw: IdentitasSitus, judul: string, isi: string, skrip: string): string {
  // Sanitasi identitas: nama/alamat/jam di-escape; warna & WA divalidasi ketat
  const s: IdentitasSitus = {
    nama: esc(sRaw.nama), namaJp: esc(sRaw.namaJp),
    warna: /^#[0-9A-Fa-f]{6}$/.test(sRaw.warna) ? sRaw.warna : '#C73E3A',
    wa: String(sRaw.wa || '').replace(/[^0-9]/g, ''),
    alamat: esc(sRaw.alamat), jam: esc(sRaw.jam)
  }
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${judul} — ${s.nama}</title>
  <meta name="robots" content="noindex">
  <link rel="icon" type="image/png" href="/static/logo-hiratake.png">
  <meta name="theme-color" content="${s.warna}">
${asetCss}
  ${styleTema(s.warna)}
  <script>
    window.SITUS = ${JSON.stringify({ nama: sRaw.nama, wa: s.wa, alamat: sRaw.alamat, jam: sRaw.jam }).replace(/</g, '\\u003c')};
  </script>
</head>
<body class="bg-washi font-sans text-sumi antialiased min-h-screen flex flex-col">

  <header class="bg-washi/95 backdrop-blur border-b border-sumi/10 sticky top-0 z-40">
    <nav class="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
      <a href="/" class="flex items-center gap-3">
        <img src="/static/logo-hiratake.png" alt="Logo ${s.nama}" class="w-10 h-10 rounded-full object-cover ring-1 ring-sumi/10">
        <div>
          <span class="font-serifjp font-bold text-lg tracking-wide">${s.nama.toUpperCase()}</span>
          <span class="block text-[10px] text-vermillion tracking-[0.35em] -mt-1">${s.namaJp}</span>
        </div>
      </a>
      <div class="flex items-center gap-3 text-sm">
        <a href="/lacak" class="hover:text-vermillion transition hidden sm:inline"><i class="fas fa-magnifying-glass-location mr-1"></i>Lacak</a>
        <a href="/" class="border border-sumi/20 hover:bg-white px-4 py-2 rounded-full transition"><i class="fas fa-arrow-left mr-1"></i>Beranda</a>
      </div>
    </nav>
  </header>

  <main class="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
${isi}
  </main>

  <footer class="bg-sumi text-washi/60 py-6 text-center text-xs">
    <p>&copy; ${new Date().getFullYear()} ${s.nama}. Butuh bantuan?
      <a href="https://wa.me/${s.wa}" target="_blank" rel="noopener" class="text-green-400 hover:underline">
        <i class="fab fa-whatsapp"></i> Hubungi kami
      </a>
    </p>
  </footer>

  <div id="toast" class="hidden fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl text-sm z-50 text-white bg-sumi"></div>
  ${skrip}
</body>
</html>`
}

// ============================================================
//  1. HALAMAN CHECKOUT
// ============================================================
export function checkoutPage(s: IdentitasSitus): string {
  const isi = `
    <div class="mb-6">
      <h1 class="font-serifjp text-2xl md:text-3xl font-bold">Checkout Pesanan</h1>
      <p class="text-sm text-sumi/60 mt-1">Isi data, pilih produk, lalu pilih cara bayar: <strong>tunai</strong> atau <strong>QRIS</strong>.</p>
    </div>

    <!-- Langkah -->
    <ol id="checkout-langkah" class="flex items-center gap-2 text-xs mb-6">
      <li class="ck-step ck-step-aktif" data-step="1"><span>1</span>Produk</li>
      <li class="ck-step" data-step="2"><span>2</span>Data &amp; Alamat</li>
      <li class="ck-step" data-step="3"><span>3</span>Pembayaran</li>
    </ol>

    <div id="checkout-mati" class="hidden bg-kin/10 border border-kin/30 rounded-2xl p-5 text-sm">
      <p><i class="fas fa-circle-info mr-2 text-kin"></i>Pesanan online sedang dinonaktifkan. Silakan pesan langsung via
        <a href="https://wa.me/${s.wa}" target="_blank" rel="noopener" class="text-green-700 font-semibold hover:underline">WhatsApp</a>.</p>
    </div>

    <form id="checkout-form" class="hidden grid md:grid-cols-5 gap-6">

      <!-- Kolom kiri: produk & data -->
      <div class="md:col-span-3 space-y-6">

        <!-- Produk -->
        <section id="checkout-produk-area" class="bg-white rounded-2xl shadow p-5">
          <h2 class="font-serifjp font-semibold mb-3"><i class="fas fa-basket-shopping text-vermillion mr-2"></i>Pilih Produk</h2>
          <div id="checkout-produk" class="space-y-3"></div>
          <p id="checkout-produk-kosong" class="hidden text-xs text-vermillion mt-3">
            <i class="fas fa-triangle-exclamation mr-1"></i>Pilih minimal satu produk untuk melanjutkan.
          </p>
        </section>

        <!-- Data pelanggan -->
        <section class="bg-white rounded-2xl shadow p-5 space-y-4">
          <h2 class="font-serifjp font-semibold"><i class="fas fa-user text-vermillion mr-2"></i>Data Penerima</h2>
          <div>
            <label for="ck-nama" class="block text-sm font-medium mb-1">Nama <span class="text-vermillion">*</span></label>
            <input id="ck-nama" type="text" required maxlength="60" placeholder="Nama lengkap" class="form-input" autocomplete="name">
          </div>
          <div>
            <label for="ck-wa" class="block text-sm font-medium mb-1">Nomor WhatsApp <span class="text-vermillion">*</span></label>
            <input id="ck-wa" type="tel" required placeholder="081234567890" class="form-input" autocomplete="tel">
            <p class="text-xs text-sumi/50 mt-1">Konfirmasi, nota, dan link lacak dikirim ke nomor ini.</p>
          </div>
          <div>
            <label for="ck-alamat" class="block text-sm font-medium mb-1">Alamat Pengiriman</label>
            <textarea id="ck-alamat" rows="3" maxlength="200" placeholder="Jalan, nomor, RT/RW, patokan…" class="form-input" autocomplete="street-address"></textarea>
          </div>
          <div>
            <label for="ck-catatan" class="block text-sm font-medium mb-1">Catatan (opsional)</label>
            <textarea id="ck-catatan" rows="2" maxlength="300" placeholder="Permintaan khusus, jam pengiriman…" class="form-input"></textarea>
          </div>

          <!-- Verifikasi OTP WhatsApp -->
          <div id="ck-otp-area" class="hidden space-y-2 bg-green-50 rounded-xl p-3 border border-green-200">
            <p class="text-xs text-green-800">
              <i class="fab fa-whatsapp mr-1"></i>Nomor WhatsApp Anda perlu diverifikasi. Klik <strong>Kirim Kode</strong>, lalu masukkan 6 angka yang kami kirim.
            </p>
            <div class="flex gap-2">
              <input id="ck-otp" type="text" inputmode="numeric" maxlength="6" placeholder="Kode 6 angka"
                     class="form-input flex-1 tracking-[0.3em] text-center font-semibold">
              <button type="button" id="ck-otp-kirim" class="shrink-0 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 rounded-full transition whitespace-nowrap">Kirim Kode</button>
            </div>
            <p id="ck-otp-info" class="hidden text-xs"></p>
          </div>
        </section>

        <!-- Metode bayar -->
        <section class="bg-white rounded-2xl shadow p-5">
          <h2 class="font-serifjp font-semibold mb-3"><i class="fas fa-credit-card text-vermillion mr-2"></i>Metode Pembayaran</h2>
          <div class="space-y-3">
            <label id="ck-metode-cash-label" class="ck-metode">
              <input type="radio" name="ck-metode" value="cash" class="mt-1 w-4 h-4 accent-[var(--vermillion)]">
              <div class="flex-1">
                <p class="font-medium"><i class="fas fa-money-bill-wave text-matcha mr-2"></i>Tunai / COD</p>
                <p class="text-xs text-sumi/60 mt-0.5" id="ck-cash-info">Bayar tunai saat barang diterima.</p>
              </div>
            </label>
            <label id="ck-metode-qris-label" class="ck-metode">
              <input type="radio" name="ck-metode" value="qris" class="mt-1 w-4 h-4 accent-[var(--vermillion)]">
              <div class="flex-1">
                <p class="font-medium"><i class="fas fa-qrcode text-vermillion mr-2"></i>QRIS</p>
                <p class="text-xs text-sumi/60 mt-0.5" id="ck-qris-info">Scan dengan aplikasi bank atau e-wallet apa pun.</p>
              </div>
            </label>
          </div>
          <p id="ck-metode-kosong" class="hidden text-xs text-vermillion mt-3">
            <i class="fas fa-triangle-exclamation mr-1"></i>Pilih metode pembayaran.
          </p>
        </section>
      </div>

      <!-- Kolom kanan: ringkasan -->
      <aside class="md:col-span-2">
        <div class="bg-white rounded-2xl shadow p-5 md:sticky md:top-24 space-y-4">
          <h2 class="font-serifjp font-semibold"><i class="fas fa-receipt text-vermillion mr-2"></i>Ringkasan</h2>
          <div id="ck-ringkasan" class="text-sm space-y-1.5 min-h-[40px]">
            <p class="text-sumi/50">Belum ada produk dipilih.</p>
          </div>
          <div class="border-t border-sumi/10 pt-3 space-y-1.5 text-sm">
            <div class="flex justify-between"><span class="text-sumi/60">Subtotal</span><span id="ck-subtotal" class="font-medium">Rp 0</span></div>
            <div class="flex justify-between" id="ck-baris-ongkir"><span class="text-sumi/60">Ongkir</span><span id="ck-ongkir">Rp 0</span></div>
            <div class="flex justify-between hidden" id="ck-baris-biaya"><span class="text-sumi/60">Biaya layanan</span><span id="ck-biaya">Rp 0</span></div>
            <div class="flex justify-between text-base font-bold pt-2 border-t border-sumi/10">
              <span>Total</span><span id="ck-total" class="text-vermillion">Rp 0</span>
            </div>
          </div>
          <button type="submit" id="ck-submit" class="w-full bg-vermillion hover:bg-red-700 text-white font-semibold py-3 rounded-full transition shadow disabled:opacity-50">
            <i class="fas fa-lock mr-2"></i>Buat Pesanan
          </button>
          <p id="ck-hasil" class="hidden text-sm text-center rounded-xl p-3"></p>
          <p class="text-[11px] text-sumi/50 leading-relaxed">
            Dengan membuat pesanan, Anda setuju dihubungi via WhatsApp untuk konfirmasi. Harga mengikuti data terbaru di sistem kami.
          </p>
        </div>
      </aside>
    </form>
  `
  return kerangka(s, 'Checkout', isi, '<script src="/static/checkout.js"></script>')
}

// ============================================================
//  2. HALAMAN PEMBAYARAN (QRIS / instruksi tunai)
// ============================================================
export function bayarPage(s: IdentitasSitus): string {
  const isi = `
    <div id="bayar-muat" class="text-center py-16 text-sumi/50">
      <i class="fas fa-spinner fa-spin text-2xl mb-3"></i>
      <p class="text-sm">Memuat data pembayaran…</p>
    </div>

    <div id="bayar-error" class="hidden bg-vermillion/10 border border-vermillion/30 rounded-2xl p-5 text-sm">
      <p id="bayar-error-teks"></p>
      <a href="/checkout" class="inline-block mt-3 text-vermillion font-semibold hover:underline">&larr; Buat pesanan baru</a>
    </div>

    <div id="bayar-isi" class="hidden grid md:grid-cols-5 gap-6">
      <!-- QR / instruksi -->
      <section class="md:col-span-3 bg-white rounded-2xl shadow p-6 text-center">
        <p class="text-xs text-sumi/50 uppercase tracking-wide">Pesanan</p>
        <h1 id="bayar-kode-pesanan" class="font-serifjp text-2xl font-bold mb-1"></h1>
        <p class="text-3xl font-bold text-vermillion mb-1" id="bayar-jumlah">Rp 0</p>
        <p class="text-xs text-sumi/50 mb-4" id="bayar-kode">—</p>

        <div id="bayar-status-pill" class="inline-block text-xs px-4 py-1.5 rounded-full mb-5">Memuat…</div>

        <div id="bayar-qr-area" class="hidden">
          <div id="bayar-qr-wrap" class="inline-block bg-white p-3 rounded-2xl border border-sumi/10">
            <canvas id="bayar-qr-canvas" class="block"></canvas>
            <img id="bayar-qr-img" alt="Kode QRIS pembayaran" class="hidden max-w-[260px] mx-auto">
          </div>
          <p class="text-sm text-sumi/60 mt-3" id="bayar-instruksi"></p>
          <p id="bayar-hitung" class="text-sm font-medium mt-2"></p>
          <div class="flex flex-wrap justify-center gap-2 mt-4">
            <button id="bayar-unduh" class="text-sm border border-sumi/20 hover:bg-washi px-4 py-2 rounded-full transition">
              <i class="fas fa-download mr-1"></i>Simpan QR
            </button>
            <a id="bayar-link-provider" href="#" target="_blank" rel="noopener"
               class="hidden text-sm border border-sumi/20 hover:bg-washi px-4 py-2 rounded-full transition">
              <i class="fas fa-external-link mr-1"></i>Buka Halaman Bayar
            </a>
            <button id="bayar-cek" class="text-sm bg-vermillion hover:bg-red-700 text-white px-4 py-2 rounded-full transition">
              <i class="fas fa-rotate mr-1"></i>Cek Status
            </button>
          </div>
          <div id="bayar-bukti-manual" class="hidden mt-5 bg-green-50 border border-green-200 rounded-xl p-4 text-left text-sm">
            <p class="font-medium text-green-800 mb-1"><i class="fab fa-whatsapp mr-1"></i>Kirim bukti pembayaran</p>
            <p class="text-green-700 text-xs mb-3">QRIS ini diverifikasi manual oleh admin. Setelah membayar, kirim tangkapan layar buktinya via WhatsApp agar pesanan segera diproses.</p>
            <a id="bayar-wa-bukti" href="#" target="_blank" rel="noopener"
               class="inline-block bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-5 py-2 rounded-full transition">
              Kirim Bukti via WhatsApp
            </a>
          </div>
        </div>

        <div id="bayar-cash-area" class="hidden text-left">
          <div class="bg-matcha/10 border border-matcha/30 rounded-xl p-4 text-sm">
            <p class="font-medium mb-1"><i class="fas fa-money-bill-wave text-matcha mr-1"></i>Pembayaran Tunai</p>
            <p id="bayar-cash-instruksi" class="text-sumi/70"></p>
          </div>
        </div>

        <div id="bayar-lunas-area" class="hidden">
          <i class="fas fa-circle-check text-6xl text-green-600 mb-3"></i>
          <p class="font-serifjp text-xl font-semibold mb-1">Pembayaran Diterima</p>
          <p class="text-sm text-sumi/60">Terima kasih! Pesanan Anda segera kami proses. Konfirmasi juga dikirim ke WhatsApp Anda.</p>
        </div>

        <div id="bayar-gagal-area" class="hidden">
          <i class="fas fa-circle-xmark text-6xl text-vermillion mb-3"></i>
          <p class="font-serifjp text-xl font-semibold mb-1" id="bayar-gagal-judul">Pembayaran Kedaluwarsa</p>
          <p class="text-sm text-sumi/60 mb-4">Batas waktu pembayaran sudah lewat. Silakan buat pesanan baru.</p>
          <a href="/checkout" class="inline-block bg-vermillion hover:bg-red-700 text-white px-6 py-2.5 rounded-full transition">Pesan Lagi</a>
        </div>
      </section>

      <!-- Rincian -->
      <aside class="md:col-span-2">
        <div class="bg-white rounded-2xl shadow p-5 space-y-3">
          <h2 class="font-serifjp font-semibold"><i class="fas fa-receipt text-vermillion mr-2"></i>Rincian</h2>
          <div id="bayar-item" class="text-sm space-y-1.5"></div>
          <div class="border-t border-sumi/10 pt-3 space-y-1.5 text-sm" id="bayar-total-area"></div>
          <a id="bayar-lacak" href="#" class="hidden block text-center text-sm border border-sumi/20 hover:bg-washi px-4 py-2 rounded-full transition">
            <i class="fas fa-magnifying-glass-location mr-1"></i>Lacak Pesanan Ini
          </a>
        </div>
      </aside>
    </div>
  `
  return kerangka(s, 'Pembayaran', isi,
    '<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>\n  <script src="/static/bayar.js"></script>')
}

// ============================================================
//  3. HALAMAN LACAK PESANAN
// ============================================================
export function lacakPage(s: IdentitasSitus): string {
  const isi = `
    <div class="mb-6">
      <h1 class="font-serifjp text-2xl md:text-3xl font-bold">Lacak Pesanan</h1>
      <p class="text-sm text-sumi/60 mt-1">Pantau status pesanan Anda. Verifikasi lewat kode WhatsApp agar data tetap aman.</p>
    </div>

    <!-- Form minta OTP -->
    <section id="lacak-form-area" class="bg-white rounded-2xl shadow p-5 max-w-lg space-y-4">
      <div>
        <label for="lacak-wa" class="block text-sm font-medium mb-1">Nomor WhatsApp yang dipakai memesan</label>
        <input id="lacak-wa" type="tel" placeholder="081234567890" class="form-input" autocomplete="tel">
      </div>
      <button id="lacak-kirim" class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-full transition">
        <i class="fab fa-whatsapp mr-2"></i>Kirim Kode Verifikasi
      </button>

      <div id="lacak-otp-area" class="hidden space-y-2 border-t border-sumi/10 pt-4">
        <label for="lacak-kode" class="block text-sm font-medium">Kode 6 angka dari WhatsApp</label>
        <div class="flex gap-2">
          <input id="lacak-kode" type="text" inputmode="numeric" maxlength="6" placeholder="000000"
                 class="form-input flex-1 tracking-[0.3em] text-center font-semibold">
          <button id="lacak-verifikasi" class="shrink-0 bg-vermillion hover:bg-red-700 text-white text-sm font-medium px-5 rounded-full transition">Lihat Pesanan</button>
        </div>
      </div>
      <p id="lacak-info" class="hidden text-xs"></p>
    </section>

    <!-- Hasil -->
    <section id="lacak-hasil" class="hidden mt-6 space-y-4"></section>
  `
  return kerangka(s, 'Lacak Pesanan', isi, '<script src="/static/lacak.js"></script>')
}
