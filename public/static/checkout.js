// ===== Halaman Checkout — keranjang multi-item, cash / QRIS =====
const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const el = (id) => document.getElementById(id);

let INFO = null;
const KERANJANG = new Map(); // produk_id -> jumlah

function toast(msg, ok = true) {
  const t = el('toast');
  t.textContent = msg;
  t.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl text-sm z-50 text-white ${ok ? 'bg-green-700' : 'bg-red-700'}`;
  setTimeout(() => t.classList.add('hidden'), 3500);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Muat info checkout ----------
async function muat() {
  try {
    const res = await fetch('/api/checkout/info');
    INFO = await res.json();
    if (!res.ok) throw new Error(INFO.error || 'Gagal memuat data checkout.');

    if (!INFO.pesananAktif) {
      el('checkout-mati').classList.remove('hidden');
      el('checkout-langkah').classList.add('hidden');
      return;
    }
    el('checkout-form').classList.remove('hidden');
    renderProduk();
    siapkanMetode();
    if (INFO.otpWajib) el('ck-otp-area').classList.remove('hidden');
    prapilihDariUrl(); // dukung /checkout?produk=ID dari kartu produk landing
    hitung();
  } catch (e) {
    el('checkout-mati').classList.remove('hidden');
    el('checkout-mati').innerHTML = `<p class="text-vermillion"><i class="fas fa-triangle-exclamation mr-2"></i>${esc(e.message)}</p>`;
  }
}

function renderProduk() {
  const wrap = el('checkout-produk');
  if (!INFO.produk.length) {
    wrap.innerHTML = '<p class="text-sm text-sumi/50">Belum ada produk tersedia.</p>';
    return;
  }
  wrap.innerHTML = INFO.produk.map((p) => `
    <div class="ck-produk" data-id="${p.id}">
      <div class="ck-produk-ikon"><i class="fas ${esc(p.ikon || 'fa-seedling')}"></i></div>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-sm truncate">${esc(p.nama)}
          ${p.badge ? `<span class="ml-1 text-[10px] bg-kin/20 text-kin px-2 py-0.5 rounded-full">${esc(p.badge)}</span>` : ''}
        </p>
        <p class="text-xs text-sumi/60">${rupiah(p.harga)} / ${esc(p.satuan)}</p>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button type="button" class="ck-qty-btn" data-aksi="kurang" data-id="${p.id}" aria-label="Kurangi ${esc(p.nama)}">
          <i class="fas fa-minus"></i>
        </button>
        <input type="number" min="0" max="500" value="0" class="ck-qty" data-id="${p.id}"
               aria-label="Jumlah ${esc(p.nama)}">
        <button type="button" class="ck-qty-btn" data-aksi="tambah" data-id="${p.id}" aria-label="Tambah ${esc(p.nama)}">
          <i class="fas fa-plus"></i>
        </button>
      </div>
    </div>
  `).join('');

  wrap.querySelectorAll('.ck-qty-btn').forEach((b) => b.addEventListener('click', () => {
    const inp = wrap.querySelector(`.ck-qty[data-id="${b.dataset.id}"]`);
    let v = parseInt(inp.value) || 0;
    v = b.dataset.aksi === 'tambah' ? Math.min(500, v + 1) : Math.max(0, v - 1);
    inp.value = v;
    setQty(b.dataset.id, v);
  }));
  wrap.querySelectorAll('.ck-qty').forEach((inp) => inp.addEventListener('input', () => {
    let v = parseInt(inp.value) || 0;
    v = Math.max(0, Math.min(500, v));
    inp.value = v || 0;
    setQty(inp.dataset.id, v);
  }));
}

// Bila datang dari kartu produk landing (?produk=ID), langsung pilih produk itu (qty 1)
function prapilihDariUrl() {
  const pid = parseInt(new URLSearchParams(location.search).get('produk'));
  if (!pid || !INFO.produk.some((p) => p.id === pid)) return;
  const inp = document.querySelector(`.ck-qty[data-id="${pid}"]`);
  if (!inp) return;
  inp.value = 1;
  setQty(pid, 1);
  const kartu = document.querySelector(`.ck-produk[data-id="${pid}"]`);
  if (kartu) {
    kartu.scrollIntoView({ behavior: 'smooth', block: 'center' });
    kartu.classList.add('ring-2', 'ring-[var(--vermillion)]');
    setTimeout(() => kartu.classList.remove('ring-2', 'ring-[var(--vermillion)]'), 2500);
  }
  // Fokuskan pengisian data setelah produk terpilih
  setTimeout(() => el('ck-nama')?.focus({ preventScroll: true }), 600);
}

function setQty(id, v) {
  const pid = parseInt(id);
  if (v > 0) KERANJANG.set(pid, v); else KERANJANG.delete(pid);
  document.querySelector(`.ck-produk[data-id="${pid}"]`)?.classList.toggle('ck-produk-aktif', v > 0);
  hitung();
}

function siapkanMetode() {
  const m = INFO.metode;
  const cashInp = document.querySelector('input[name="ck-metode"][value="cash"]');
  const qrisInp = document.querySelector('input[name="ck-metode"][value="qris"]');

  if (!m.cash) {
    cashInp.disabled = true;
    el('ck-metode-cash-label').classList.add('ck-metode-mati');
    el('ck-cash-info').textContent = 'Sedang tidak tersedia.';
  } else {
    el('ck-cash-info').textContent = INFO.instruksiCash || 'Bayar tunai saat barang diterima.';
  }

  if (!m.qris) {
    qrisInp.disabled = true;
    el('ck-metode-qris-label').classList.add('ck-metode-mati');
    el('ck-qris-info').textContent = m.qrisAlasan || 'Sedang tidak tersedia.';
  } else {
    let t = 'Scan dengan aplikasi bank atau e-wallet apa pun.';
    if (INFO.biayaMode === 'bebankan' && (INFO.biayaPersen > 0 || INFO.biayaTetap > 0)) {
      t += ` Ada biaya layanan ${INFO.biayaPersen}%${INFO.biayaTetap ? ' + ' + rupiah(INFO.biayaTetap) : ''}.`;
    }
    if (INFO.minQris > 0) t += ` Minimal ${rupiah(INFO.minQris)}.`;
    el('ck-qris-info').textContent = t;
  }

  // Pilih otomatis bila hanya satu metode tersedia
  if (m.cash && !m.qris) cashInp.checked = true;
  else if (!m.cash && m.qris) qrisInp.checked = true;

  document.querySelectorAll('input[name="ck-metode"]').forEach((r) =>
    r.addEventListener('change', () => { hitung(); langkah(3); }));
}

// ---------- Hitung total ----------
function hitung() {
  const metode = document.querySelector('input[name="ck-metode"]:checked')?.value || '';
  let subtotal = 0;
  const baris = [];
  for (const [pid, jml] of KERANJANG) {
    const p = INFO.produk.find((x) => x.id === pid);
    if (!p) continue;
    const sub = p.harga * jml;
    subtotal += sub;
    baris.push({ nama: p.nama, jml, satuan: p.satuan, harga: p.harga, sub });
  }

  const ongkir = subtotal > 0 && INFO.ongkir > 0 &&
    !(INFO.ongkirGratisMin > 0 && subtotal >= INFO.ongkirGratisMin) ? INFO.ongkir : 0;
  const biaya = metode === 'qris' && INFO.biayaMode === 'bebankan'
    ? Math.round((subtotal + ongkir) * (INFO.biayaPersen / 100) + INFO.biayaTetap) : 0;
  const total = subtotal + ongkir + biaya;

  const ring = el('ck-ringkasan');
  ring.innerHTML = baris.length
    ? baris.map((b) => `
        <div class="flex justify-between gap-2">
          <span class="min-w-0"><span class="font-medium">${esc(b.nama)}</span>
            <span class="text-sumi/50 text-xs block">${b.jml} ${esc(b.satuan)} × ${rupiah(b.harga)}</span></span>
          <span class="whitespace-nowrap">${rupiah(b.sub)}</span>
        </div>`).join('')
    : '<p class="text-sumi/50">Belum ada produk dipilih.</p>';

  el('ck-subtotal').textContent = rupiah(subtotal);
  el('ck-ongkir').textContent = ongkir > 0 ? rupiah(ongkir)
    : (INFO.ongkir > 0 && subtotal > 0 ? 'Gratis' : rupiah(0));
  el('ck-baris-biaya').classList.toggle('hidden', biaya === 0);
  el('ck-biaya').textContent = rupiah(biaya);
  el('ck-total').textContent = rupiah(total);
  el('ck-submit').disabled = subtotal === 0;

  if (baris.length) langkah(2);
  else langkah(1);
  return { subtotal, ongkir, biaya, total, metode };
}

function langkah(n) {
  document.querySelectorAll('.ck-step').forEach((li) => {
    li.classList.toggle('ck-step-aktif', parseInt(li.dataset.step) <= n);
  });
}

// ---------- OTP WhatsApp ----------
el('ck-otp-kirim')?.addEventListener('click', async () => {
  const btn = el('ck-otp-kirim');
  const info = el('ck-otp-info');
  const wa = el('ck-wa').value.trim();
  const tulis = (t, ok) => {
    info.textContent = t;
    info.className = `text-xs ${ok ? 'text-green-700' : 'text-red-700'}`;
    info.classList.remove('hidden');
  };
  if (!wa) { tulis('Isi nomor WhatsApp Anda dulu.', false); el('ck-wa').focus(); return; }

  btn.disabled = true; btn.textContent = 'Mengirim…';
  try {
    const res = await fetch('/api/pesan-online/otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wa })
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Gagal mengirim kode.');
    tulis(`Kode dikirim ke WhatsApp ${d.waSensor || wa}. Berlaku ${d.menit || 5} menit.`, true);
    el('ck-otp').focus();
    let sisa = 60;
    btn.textContent = `Ulangi (${sisa}s)`;
    const t = setInterval(() => {
      sisa--;
      if (sisa <= 0) { clearInterval(t); btn.disabled = false; btn.textContent = 'Kirim Ulang'; }
      else btn.textContent = `Ulangi (${sisa}s)`;
    }, 1000);
  } catch (e) {
    tulis(e.message, false);
    btn.disabled = false; btn.textContent = 'Kirim Kode';
  }
});

// ---------- Submit checkout ----------
el('checkout-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const h = hitung();
  const hasil = el('ck-hasil');
  const tampil = (teks, ok) => {
    hasil.className = `text-sm text-center rounded-xl p-3 ${ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`;
    hasil.innerHTML = teks;
    hasil.classList.remove('hidden');
  };

  if (!KERANJANG.size) {
    el('checkout-produk-kosong').classList.remove('hidden');
    el('checkout-produk-area').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  el('checkout-produk-kosong').classList.add('hidden');

  if (!h.metode) {
    el('ck-metode-kosong').classList.remove('hidden');
    return;
  }
  el('ck-metode-kosong').classList.add('hidden');

  const otp = el('ck-otp')?.value.trim() || '';
  if (INFO.otpWajib && otp.length !== 6) {
    tampil('⚠️ Masukkan kode verifikasi 6 angka yang dikirim ke WhatsApp Anda.', false);
    el('ck-otp')?.focus();
    return;
  }

  const btn = el('ck-submit');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Memproses…';
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: el('ck-nama').value.trim(),
        wa: el('ck-wa').value.trim(),
        alamat: el('ck-alamat').value.trim(),
        catatan: el('ck-catatan').value.trim(),
        metode: h.metode,
        otp,
        item: Array.from(KERANJANG, ([produk_id, jumlah]) => ({ produk_id, jumlah }))
      })
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Gagal membuat pesanan.');

    if (d.metode === 'qris' && d.bayarUrl) {
      tampil(`✅ Pesanan <strong>${esc(d.kode)}</strong> dibuat. Mengarahkan ke halaman pembayaran…`, true);
      setTimeout(() => { window.location.href = d.bayarUrl; }, 900);
      return;
    }

    // Tunai: tampilkan konfirmasi + tautan lacak
    tampil(
      `✅ Pesanan <strong>${esc(d.kode)}</strong> tercatat!<br>Total ${rupiah(d.totalBayar)} — bayar tunai saat barang diterima.` +
      `<br><a href="${esc(d.lacakUrl)}" class="underline font-semibold">Lacak pesanan ini</a>`, true);
    KERANJANG.clear();
    renderProduk(); hitung();
    el('ck-catatan').value = '';
    if (el('ck-otp')) el('ck-otp').value = '';
    el('ck-otp-info')?.classList.add('hidden');

    // Buka WhatsApp untuk konfirmasi cepat
    const pesan = `Halo ${window.SITUS.nama}! 🍄\nSaya baru checkout di website:\n\n• Kode: ${d.kode}\n• Total: ${rupiah(d.totalBayar)}\n• Bayar: Tunai/COD\n\nMohon konfirmasinya. Terima kasih!`;
    setTimeout(() => window.open(`https://wa.me/${window.SITUS.wa}?text=${encodeURIComponent(pesan)}`, '_blank'), 800);
  } catch (e) {
    tampil('⚠️ ' + esc(e.message), false);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-lock mr-2"></i>Buat Pesanan';
  }
});

muat();
