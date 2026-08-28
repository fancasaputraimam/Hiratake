// ===== Dashboard Hiratake =====
let ME = null;
let PRODUK_CACHE = [];

const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
const hariIni = () => new Date().toISOString().slice(0, 10);

function toast(msg, ok = true) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-xl text-sm z-50 text-white ${ok ? 'bg-green-700' : 'bg-red-700'}`;
  setTimeout(() => t.classList.add('hidden'), 3000);
}

async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Sesi berakhir'); }
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

// ---------- Init ----------
(async function init() {
  try {
    const { user } = await api('/api/auth/me');
    ME = user;
    document.getElementById('user-nama').textContent = user.nama;
    document.getElementById('user-role').textContent = user.role;

    // Tampilkan tab sesuai role
    document.querySelectorAll('.tab-btn[data-roles]').forEach((btn) => {
      if (btn.dataset.roles.split(',').includes(user.role)) btn.classList.remove('hidden');
    });

    ['panen-tanggal', 'jual-tanggal', 'bg-tanggal', 'kj-tanggal'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.value = hariIni();
    });

    // Karyawan tidak boleh buat batch baru (hanya lapor kejadian)
    if (ME.role === 'karyawan') document.getElementById('form-baglog')?.classList.add('hidden');

    await Promise.all([loadRingkasan(), loadProdukDropdown(), loadBatchDropdown(), loadPelangganDropdown()]);
    document.getElementById('loading-screen').remove();
  } catch (e) { /* redirect ke login sudah ditangani */ }
})();

// ---------- Navigasi tab ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
    const loaders = { dashboard: loadRingkasan, baglog: loadBaglog, panen: loadPanen, penjualan: loadPenjualan, piutang: loadPiutang, pelanggan: loadPelanggan, produk: loadProduk, pengguna: loadUsers, pengaturan: loadPengaturan };
    loaders[btn.dataset.tab]?.();
  });
});

// ---------- Logout ----------
document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
});

// ---------- Ringkasan ----------
let chartPanen, chartPenjualan;
async function loadRingkasan() {
  const d = await api('/api/admin/ringkasan');
  document.getElementById('stat-cards').innerHTML = `
    <div class="stat-card"><i class="fas fa-wheat-awn text-matcha"></i><p class="stat-val">${d.panenHariIni} kg</p><p class="stat-label">Panen Hari Ini</p></div>
    <div class="stat-card"><i class="fas fa-calendar-days text-matcha"></i><p class="stat-val">${d.panenBulanIni} kg</p><p class="stat-label">Panen Bulan Ini</p></div>
    <div class="stat-card"><i class="fas fa-coins text-kin"></i><p class="stat-val">${rupiah(d.jualHariIni)}</p><p class="stat-label">Penjualan Hari Ini</p></div>
    <div class="stat-card"><i class="fas fa-sack-dollar text-kin"></i><p class="stat-val">${rupiah(d.jualBulanIni)}</p><p class="stat-label">Penjualan Bulan Ini</p></div>
    <div class="stat-card"><i class="fas fa-cubes text-vermillion" style="color:#C73E3A"></i><p class="stat-val">${d.baglogAktif}</p><p class="stat-label">Baglog Aktif</p></div>
    <div class="stat-card"><i class="fas fa-biohazard text-red-500"></i><p class="stat-val">${d.kontaminasiPersen}%</p><p class="stat-label">Tingkat Kontaminasi</p></div>
    <div class="stat-card"><i class="fas fa-scale-balanced" style="color:#7A8450"></i><p class="stat-val">${d.kgPerBaglog} kg</p><p class="stat-label">Produktivitas /Baglog</p></div>
    <div class="stat-card"><i class="fas fa-file-invoice-dollar text-orange-500"></i><p class="stat-val">${rupiah(d.piutangTotal)}</p><p class="stat-label">Piutang (${d.piutangJumlah} nota)</p></div>`;

  const labels7 = [...Array(7)].map((_, i) => {
    const dt = new Date(); dt.setDate(dt.getDate() - (6 - i));
    return dt.toISOString().slice(0, 10);
  });
  const mapData = (rows) => labels7.map((t) => rows.find((r) => r.tanggal === t)?.v || 0);
  const labelTampil = labels7.map((t) => t.slice(5));

  chartPanen?.destroy();
  chartPanen = new Chart(document.getElementById('chart-panen'), {
    type: 'bar',
    data: { labels: labelTampil, datasets: [{ label: 'Panen (kg)', data: mapData(d.grafikPanen), backgroundColor: '#7A8450', borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
  chartPenjualan?.destroy();
  chartPenjualan = new Chart(document.getElementById('chart-penjualan'), {
    type: 'line',
    data: { labels: labelTampil, datasets: [{ label: 'Penjualan (Rp)', data: mapData(d.grafikPenjualan), borderColor: '#C73E3A', backgroundColor: 'rgba(199,62,58,0.1)', fill: true, tension: 0.35 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

// ---------- Baglog ----------
async function loadBatchDropdown() {
  const { batch } = await api('/api/admin/baglog');
  const aktif = batch.filter((b) => b.status !== 'afkir');
  const opsi = aktif.map((b) => `<option value="${b.id}">${b.kode} — ${b.lokasi || b.sumber} (${b.status})</option>`).join('');
  const kjSel = document.getElementById('kj-batch');
  if (kjSel) kjSel.innerHTML = opsi || '<option value="">Belum ada batch</option>';
  const pnSel = document.getElementById('panen-batch');
  if (pnSel) pnSel.innerHTML = '<option value="">— tanpa batch —</option>' + opsi;
}

async function loadBaglog() {
  const { batch } = await api('/api/admin/baglog');
  const statusBadge = { inkubasi: 'bg-blue-100 text-blue-700', produktif: 'bg-green-100 text-green-700', afkir: 'bg-gray-200 text-gray-500' };
  const boleh = ['owner', 'admin'].includes(ME.role);
  document.getElementById('table-baglog').innerHTML = `
    <thead><tr><th>Kode</th><th>Tanggal</th><th>Awal</th><th>Kontam.</th><th>Sisa</th><th>Panen (kg)</th><th>kg/Baglog</th><th>Status</th>${boleh ? '<th></th>' : ''}</tr></thead>
    <tbody>${batch.map((b) => {
      const hilang = (b.kontaminasi || 0) + (b.rusak_afkir || 0);
      const sisa = b.jumlah - hilang;
      const prod = b.jumlah > 0 ? (b.total_panen_kg / b.jumlah).toFixed(2) : '0';
      return `
      <tr class="cursor-pointer ${b.status === 'afkir' ? 'opacity-50' : ''}" onclick="lihatKejadian(${b.id}, '${b.kode}')">
        <td class="font-mono font-semibold">${b.kode}</td>
        <td>${b.tanggal}<br><span class="text-xs text-gray-400">${b.sumber}</span></td>
        <td>${b.jumlah}</td>
        <td class="${b.kontaminasi > 0 ? 'text-red-600 font-semibold' : ''}">${b.kontaminasi || 0}</td>
        <td class="font-semibold">${sisa}</td>
        <td>${b.total_panen_kg || 0}</td>
        <td class="font-semibold" style="color:#7A8450">${prod}</td>
        <td><span class="text-xs px-2 py-0.5 rounded-full ${statusBadge[b.status]}">${b.status}</span></td>
        ${boleh ? `<td onclick="event.stopPropagation()">
          ${b.status === 'inkubasi' ? `<button onclick="ubahStatusBatch(${b.id},'produktif')" class="text-green-600 mr-1" title="Masukkan ke kumbung (produktif)"><i class="fas fa-arrow-right-to-bracket"></i></button>` : ''}
          ${b.status !== 'afkir' ? `<button onclick="ubahStatusBatch(${b.id},'afkir')" class="text-gray-400 hover:text-red-500" title="Afkir seluruh batch"><i class="fas fa-ban"></i></button>` : ''}
        </td>` : ''}
      </tr>`; }).join('') || '<tr><td colspan="9" class="text-center text-gray-400 py-4">Belum ada batch. Buat batch baglog pertama Anda!</td></tr>'}</tbody>`;
}

window.lihatKejadian = async (id, kode) => {
  const { kejadian } = await api(`/api/admin/baglog/${id}/kejadian`);
  document.getElementById('detail-kejadian').classList.remove('hidden');
  document.getElementById('detail-kejadian-judul').textContent = 'Riwayat Kejadian — ' + kode;
  const jenisBadge = { kontaminasi: 'bg-red-100 text-red-700', rusak: 'bg-yellow-100 text-yellow-700', afkir: 'bg-gray-200 text-gray-600' };
  document.getElementById('table-kejadian').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Jenis</th><th>Jumlah</th><th>Catatan</th><th>Pelapor</th></tr></thead>
    <tbody>${kejadian.map((k) => `
      <tr><td>${k.tanggal}</td><td><span class="text-xs px-2 py-0.5 rounded-full ${jenisBadge[k.jenis]}">${k.jenis}</span></td>
      <td class="font-semibold">${k.jumlah}</td><td>${k.catatan || '-'}</td><td>${k.pencatat || '-'}</td></tr>`).join('') || '<tr><td colspan="5" class="text-center text-gray-400 py-3">Tidak ada kejadian — batch sehat 👍</td></tr>'}</tbody>`;
};

window.ubahStatusBatch = async (id, status) => {
  const label = status === 'afkir' ? 'Afkir seluruh batch ini? Batch tidak akan dihitung lagi sebagai aktif.' : 'Tandai batch masuk kumbung (produktif)?';
  if (!confirm(label)) return;
  try { await api(`/api/admin/baglog/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }); toast('Status batch diperbarui'); loadBaglog(); loadBatchDropdown(); }
  catch (ex) { toast(ex.message, false); }
};

document.getElementById('form-baglog')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await api('/api/admin/baglog', { method: 'POST', body: JSON.stringify({
      tanggal: document.getElementById('bg-tanggal').value,
      jumlah: parseInt(document.getElementById('bg-jumlah').value),
      sumber: document.getElementById('bg-sumber').value.trim(),
      biaya_per_baglog: parseInt(document.getElementById('bg-biaya').value) || 0,
      lokasi: document.getElementById('bg-lokasi').value.trim(),
      tanggal_masuk_kumbung: document.getElementById('bg-masuk').value || null,
      catatan: document.getElementById('bg-catatan').value.trim()
    })});
    toast(`Batch ${r.kode} dibuat ✅`);
    document.getElementById('form-baglog').reset();
    document.getElementById('bg-tanggal').value = hariIni();
    document.getElementById('bg-sumber').value = 'produksi sendiri';
    loadBaglog(); loadBatchDropdown();
  } catch (ex) { toast(ex.message, false); }
});

document.getElementById('form-kejadian')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const batchId = document.getElementById('kj-batch').value;
  if (!batchId) return toast('Pilih batch dulu', false);
  try {
    const r = await api(`/api/admin/baglog/${batchId}/kejadian`, { method: 'POST', body: JSON.stringify({
      tanggal: document.getElementById('kj-tanggal').value,
      jenis: document.getElementById('kj-jenis').value,
      jumlah: parseInt(document.getElementById('kj-jumlah').value),
      catatan: document.getElementById('kj-catatan').value.trim()
    })});
    toast(`Kejadian dicatat. Sisa baglog batch: ${r.sisa}`);
    document.getElementById('kj-jumlah').value = ''; document.getElementById('kj-catatan').value = '';
    loadBaglog();
  } catch (ex) { toast(ex.message, false); }
});

// ---------- Panen ----------
function previewTotalPanen() {
  const t = (parseFloat(document.getElementById('panen-ga').value) || 0)
    + (parseFloat(document.getElementById('panen-gb').value) || 0)
    + (parseFloat(document.getElementById('panen-gc').value) || 0);
  document.getElementById('panen-total-preview').textContent = (Math.round(t * 100) / 100) + ' kg';
}
['panen-ga', 'panen-gb', 'panen-gc'].forEach((id) => document.getElementById(id)?.addEventListener('input', previewTotalPanen));

async function loadPanen() {
  const { panen } = await api('/api/admin/panen');
  const boleh = ['owner', 'admin'].includes(ME.role);
  document.getElementById('table-panen').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Batch</th><th>A</th><th>B</th><th>C</th><th>Total</th><th>Susut</th><th>Pencatat</th>${boleh ? '<th></th>' : ''}</tr></thead>
    <tbody>${panen.map((p) => `
      <tr>
        <td>${p.tanggal}${p.catatan ? `<br><span class="text-xs text-gray-400">${p.catatan}</span>` : ''}</td>
        <td class="font-mono text-xs">${p.batch_kode || '-'}</td>
        <td>${p.grade_a || 0}</td><td>${p.grade_b || 0}</td><td>${p.grade_c || 0}</td>
        <td class="font-semibold">${p.jumlah_kg} kg</td>
        <td class="${p.susut_kg > 0 ? 'text-red-500' : ''}">${p.susut_kg || 0}</td>
        <td>${p.pencatat || '-'}</td>
        ${boleh ? `<td><button onclick="hapusPanen(${p.id})" class="text-red-500 hover:text-red-700" title="Hapus"><i class="fas fa-trash"></i></button></td>` : ''}
      </tr>`).join('') || '<tr><td colspan="9" class="text-center text-gray-400 py-4">Belum ada data</td></tr>'}</tbody>`;
}

document.getElementById('form-panen').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/panen', { method: 'POST', body: JSON.stringify({
      tanggal: document.getElementById('panen-tanggal').value,
      batch_id: parseInt(document.getElementById('panen-batch').value) || null,
      grade_a: parseFloat(document.getElementById('panen-ga').value) || 0,
      grade_b: parseFloat(document.getElementById('panen-gb').value) || 0,
      grade_c: parseFloat(document.getElementById('panen-gc').value) || 0,
      susut_kg: parseFloat(document.getElementById('panen-susut').value) || 0,
      catatan: document.getElementById('panen-catatan').value.trim()
    })});
    toast('Panen berhasil dicatat 🍄');
    ['panen-ga', 'panen-gb', 'panen-gc', 'panen-susut', 'panen-catatan'].forEach((id) => document.getElementById(id).value = '');
    previewTotalPanen();
    loadPanen();
  } catch (ex) { toast(ex.message, false); }
});

window.hapusPanen = async (id) => {
  if (!confirm('Hapus catatan panen ini?')) return;
  try { await api('/api/admin/panen/' + id, { method: 'DELETE' }); toast('Data dihapus'); loadPanen(); }
  catch (ex) { toast(ex.message, false); }
};

// ---------- Penjualan ----------
async function loadProdukDropdown() {
  const { produk } = await api('/api/produk');
  PRODUK_CACHE = produk;
  document.getElementById('jual-produk').innerHTML = produk.map((p) =>
    `<option value="${p.id}" data-harga="${p.harga}">${p.nama} — ${rupiah(p.harga)}</option>`).join('');
  updateTotalJual();
}

function updateTotalJual() {
  const sel = document.getElementById('jual-produk');
  const harga = parseInt(sel.selectedOptions[0]?.dataset.harga || 0);
  const qty = parseInt(document.getElementById('jual-jumlah').value || 0);
  document.getElementById('jual-total').textContent = rupiah(harga * qty);
}
document.getElementById('jual-produk').addEventListener('change', updateTotalJual);
document.getElementById('jual-jumlah').addEventListener('input', updateTotalJual);

async function loadPelangganDropdown() {
  const { pelanggan } = await api('/api/admin/pelanggan');
  const sel = document.getElementById('jual-pelanggan');
  if (sel) sel.innerHTML = '<option value="">— umum / tanpa nama —</option>' +
    pelanggan.filter((p) => p.aktif).map((p) => `<option value="${p.id}">${p.nama} (${p.tipe})</option>`).join('');
}

document.getElementById('jual-bayar')?.addEventListener('change', (e) => {
  document.getElementById('jual-tempo-wrap').classList.toggle('hidden', e.target.value !== 'tempo');
});

async function loadPenjualan() {
  const { penjualan } = await api('/api/admin/penjualan');
  const boleh = ['owner', 'admin'].includes(ME.role);
  document.getElementById('table-penjualan').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Produk</th><th>Jml</th><th>Total</th><th>Pembeli</th><th>Bayar</th><th>Pencatat</th>${boleh ? '<th></th>' : ''}</tr></thead>
    <tbody>${penjualan.map((j) => `
      <tr>
        <td>${j.tanggal}</td><td>${j.nama_produk}</td><td>${j.jumlah}</td>
        <td class="font-semibold" style="color:#C73E3A">${rupiah(j.total)}</td>
        <td>${j.pelanggan_nama || j.pembeli || '-'}</td>
        <td>${j.status_bayar === 'tempo'
          ? `<span class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">tempo · ${j.jatuh_tempo || ''}</span>`
          : '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">lunas</span>'}</td>
        <td>${j.pencatat || '-'}</td>
        ${boleh ? `<td class="whitespace-nowrap">
          ${j.status_bayar === 'tempo' ? `<button onclick="tandaiLunas(${j.id})" class="text-green-600 mr-2" title="Tandai lunas"><i class="fas fa-circle-check"></i></button>` : ''}
          <button onclick="hapusJual(${j.id})" class="text-red-500 hover:text-red-700" title="Hapus"><i class="fas fa-trash"></i></button></td>` : ''}
      </tr>`).join('') || '<tr><td colspan="8" class="text-center text-gray-400 py-4">Belum ada data</td></tr>'}</tbody>`;
}

document.getElementById('form-penjualan').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/penjualan', { method: 'POST', body: JSON.stringify({
      tanggal: document.getElementById('jual-tanggal').value,
      produk_id: parseInt(document.getElementById('jual-produk').value),
      jumlah: parseInt(document.getElementById('jual-jumlah').value),
      pelanggan_id: parseInt(document.getElementById('jual-pelanggan').value) || null,
      pembeli: document.getElementById('jual-pembeli').value.trim(),
      status_bayar: document.getElementById('jual-bayar').value,
      jatuh_tempo: document.getElementById('jual-tempo').value || null
    })});
    toast('Penjualan berhasil dicatat 💰');
    document.getElementById('jual-jumlah').value = 1; document.getElementById('jual-pembeli').value = '';
    document.getElementById('jual-bayar').value = 'lunas';
    document.getElementById('jual-tempo-wrap').classList.add('hidden');
    updateTotalJual(); loadPenjualan();
  } catch (ex) { toast(ex.message, false); }
});

window.tandaiLunas = async (id) => {
  if (!confirm('Tandai piutang ini sudah dibayar lunas?')) return;
  try { await api(`/api/admin/penjualan/${id}/lunas`, { method: 'PUT' }); toast('Piutang lunas ✅'); loadPenjualan(); }
  catch (ex) { toast(ex.message, false); }
};

// ---------- Piutang ----------
async function loadPiutang() {
  const { piutang } = await api('/api/admin/piutang');
  const total = piutang.reduce((s, p) => s + p.total, 0);
  document.getElementById('piutang-total').textContent = rupiah(total);
  const boleh = ['owner', 'admin'].includes(ME.role);
  document.getElementById('table-piutang').innerHTML = `
    <thead><tr><th>Jatuh Tempo</th><th>Pelanggan</th><th>Produk</th><th>Nominal</th><th>Status</th><th></th></tr></thead>
    <tbody>${piutang.map((p) => `
      <tr class="${p.terlambat ? 'bg-red-50' : ''}">
        <td class="${p.terlambat ? 'text-red-600 font-semibold' : ''}">${p.jatuh_tempo}${p.terlambat ? ' ⚠️' : ''}</td>
        <td>${p.pelanggan_nama || p.pembeli || '-'}</td>
        <td>${p.nama_produk} ×${p.jumlah}<br><span class="text-xs text-gray-400">nota ${p.tanggal}</span></td>
        <td class="font-semibold" style="color:#C73E3A">${rupiah(p.total)}</td>
        <td>${p.terlambat ? '<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">TERLAMBAT</span>' : '<span class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">berjalan</span>'}</td>
        <td class="whitespace-nowrap">
          ${p.pelanggan_wa ? `<a href="https://wa.me/${p.pelanggan_wa}?text=${encodeURIComponent('Halo, mengingatkan pembayaran ' + p.nama_produk + ' senilai ' + rupiah(p.total) + ' jatuh tempo ' + p.jatuh_tempo + '. Terima kasih 🙏 — Hiratake')}" target="_blank" class="text-green-600 mr-2" title="Tagih via WA"><i class="fab fa-whatsapp"></i></a>` : ''}
          ${boleh ? `<button onclick="tandaiLunasPiutang(${p.id})" class="text-green-600" title="Tandai lunas"><i class="fas fa-circle-check"></i></button>` : ''}
        </td>
      </tr>`).join('') || '<tr><td colspan="6" class="text-center text-gray-400 py-4">Tidak ada piutang — semua lunas! 🎉</td></tr>'}</tbody>`;
}

window.tandaiLunasPiutang = async (id) => {
  if (!confirm('Tandai piutang ini sudah dibayar lunas?')) return;
  try { await api(`/api/admin/penjualan/${id}/lunas`, { method: 'PUT' }); toast('Piutang lunas ✅'); loadPiutang(); }
  catch (ex) { toast(ex.message, false); }
};

// ---------- Pelanggan ----------
async function loadPelanggan() {
  const { pelanggan } = await api('/api/admin/pelanggan');
  const tipeBadge = { eceran: 'bg-gray-100 text-gray-600', warung: 'bg-blue-100 text-blue-700', resto: 'bg-purple-100 text-purple-700', reseller: 'bg-green-100 text-green-700' };
  const boleh = ['owner', 'admin'].includes(ME.role);
  document.getElementById('table-pelanggan').innerHTML = `
    <thead><tr><th>Nama</th><th>Tipe</th><th>WA</th><th>Total Belanja</th><th>Piutang</th>${boleh ? '<th></th>' : ''}</tr></thead>
    <tbody>${pelanggan.map((p) => `
      <tr class="${p.aktif ? '' : 'opacity-50'}">
        <td>${p.nama}${p.alamat ? `<br><span class="text-xs text-gray-400">${p.alamat}</span>` : ''}</td>
        <td><span class="text-xs px-2 py-0.5 rounded-full ${tipeBadge[p.tipe]}">${p.tipe}</span></td>
        <td>${p.wa ? `<a href="https://wa.me/${p.wa}" target="_blank" class="text-green-600"><i class="fab fa-whatsapp mr-1"></i>${p.wa}</a>` : '-'}</td>
        <td class="font-semibold">${rupiah(p.total_belanja)}</td>
        <td class="${p.piutang > 0 ? 'text-orange-600 font-semibold' : 'text-gray-400'}">${p.piutang > 0 ? rupiah(p.piutang) : '-'}</td>
        ${boleh ? `<td><button onclick='editPelanggan(${JSON.stringify(p).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700" title="Ubah"><i class="fas fa-pen"></i></button></td>` : ''}
      </tr>`).join('') || '<tr><td colspan="6" class="text-center text-gray-400 py-4">Belum ada pelanggan terdaftar</td></tr>'}</tbody>`;
}

window.editPelanggan = (p) => {
  document.getElementById('pl-id').value = p.id;
  document.getElementById('pl-nama').value = p.nama;
  document.getElementById('pl-tipe').value = p.tipe;
  document.getElementById('pl-wa').value = p.wa || '';
  document.getElementById('pl-alamat').value = p.alamat || '';
  document.getElementById('pl-catatan').value = p.catatan || '';
  document.getElementById('pelanggan-form-title').innerHTML = '<i class="fas fa-pen text-blue-500 mr-2"></i>Ubah Pelanggan';
  document.getElementById('pl-batal').classList.remove('hidden');
};

document.getElementById('pl-batal')?.addEventListener('click', () => {
  document.getElementById('form-pelanggan').reset();
  document.getElementById('pl-id').value = '';
  document.getElementById('pelanggan-form-title').innerHTML = '<i class="fas fa-user-plus text-vermillion mr-2"></i>Tambah Pelanggan';
  document.getElementById('pl-batal').classList.add('hidden');
});

document.getElementById('form-pelanggan')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('pl-id').value;
  const body = {
    nama: document.getElementById('pl-nama').value.trim(),
    tipe: document.getElementById('pl-tipe').value,
    wa: document.getElementById('pl-wa').value.trim().replace(/[^0-9]/g, ''),
    alamat: document.getElementById('pl-alamat').value.trim(),
    catatan: document.getElementById('pl-catatan').value.trim(),
    aktif: 1
  };
  try {
    if (id) await api('/api/admin/pelanggan/' + id, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/api/admin/pelanggan', { method: 'POST', body: JSON.stringify(body) });
    toast(id ? 'Pelanggan diperbarui ✅' : 'Pelanggan ditambahkan 👤');
    document.getElementById('pl-batal').click();
    loadPelanggan(); loadPelangganDropdown();
  } catch (ex) { toast(ex.message, false); }
});

// ---------- Pengaturan Web ----------
async function loadPengaturan() {
  const { pengaturan } = await api('/api/admin/pengaturan');
  document.getElementById('cfg-wa').value = pengaturan.wa_nomor || '';
  document.getElementById('cfg-alamat').value = pengaturan.alamat || '';
  document.getElementById('cfg-jam').value = pengaturan.jam_operasional || '';
}

document.getElementById('form-pengaturan')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/pengaturan', { method: 'PUT', body: JSON.stringify({
      wa_nomor: document.getElementById('cfg-wa').value.trim().replace(/[^0-9]/g, ''),
      alamat: document.getElementById('cfg-alamat').value.trim(),
      jam_operasional: document.getElementById('cfg-jam').value.trim()
    })});
    toast('Pengaturan tersimpan & langsung aktif di website ✅');
  } catch (ex) { toast(ex.message, false); }
});

window.hapusJual = async (id) => {
  if (!confirm('Hapus catatan penjualan ini?')) return;
  try { await api('/api/admin/penjualan/' + id, { method: 'DELETE' }); toast('Data dihapus'); loadPenjualan(); }
  catch (ex) { toast(ex.message, false); }
};

// ---------- Produk (owner & admin) ----------
async function loadProduk() {
  const { produk } = await api('/api/admin/produk');
  document.getElementById('table-produk').innerHTML = `
    <thead><tr><th>Nama</th><th>Harga</th><th>Satuan</th><th>Badge</th><th>Status</th><th></th></tr></thead>
    <tbody>${produk.map((p) => `
      <tr class="${p.aktif ? '' : 'opacity-50'}">
        <td>${p.nama}<br><span class="text-xs text-gray-400">${p.jp || ''}</span></td>
        <td class="font-semibold">${rupiah(p.harga)}</td><td>${p.satuan}</td>
        <td>${p.badge ? `<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">${p.badge}</span>` : '-'}</td>
        <td>${p.aktif ? '<span class="text-green-600 text-xs font-semibold">Aktif</span>' : '<span class="text-gray-400 text-xs">Nonaktif</span>'}</td>
        <td class="whitespace-nowrap">
          <button onclick='editProduk(${JSON.stringify(p).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700 mr-2" title="Ubah"><i class="fas fa-pen"></i></button>
          ${p.aktif
            ? `<button onclick="nonaktifProduk(${p.id})" class="text-red-500 hover:text-red-700" title="Nonaktifkan"><i class="fas fa-eye-slash"></i></button>`
            : `<button onclick="aktifkanProduk(${JSON.stringify(p).replace(/'/g, '&#39;').replace(/"/g, '&quot;')})" class="text-green-600" title="Aktifkan"><i class="fas fa-eye"></i></button>`}
        </td>
      </tr>`).join('')}</tbody>`;
}

window.editProduk = (p) => {
  document.getElementById('produk-id').value = p.id;
  document.getElementById('produk-nama').value = p.nama;
  document.getElementById('produk-jp').value = p.jp || '';
  document.getElementById('produk-harga').value = p.harga;
  document.getElementById('produk-satuan').value = p.satuan;
  document.getElementById('produk-deskripsi').value = p.deskripsi || '';
  document.getElementById('produk-badge').value = p.badge || '';
  document.getElementById('produk-form-title').innerHTML = '<i class="fas fa-pen text-blue-500 mr-2"></i>Ubah Produk';
  document.getElementById('produk-batal').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.getElementById('produk-batal').addEventListener('click', resetFormProduk);
function resetFormProduk() {
  document.getElementById('form-produk').reset();
  document.getElementById('produk-id').value = '';
  document.getElementById('produk-form-title').innerHTML = '<i class="fas fa-plus-circle text-vermillion mr-2"></i>Tambah Produk';
  document.getElementById('produk-batal').classList.add('hidden');
}

document.getElementById('form-produk').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('produk-id').value;
  const body = {
    nama: document.getElementById('produk-nama').value.trim(),
    jp: document.getElementById('produk-jp').value.trim(),
    harga: parseInt(document.getElementById('produk-harga').value),
    satuan: document.getElementById('produk-satuan').value.trim(),
    deskripsi: document.getElementById('produk-deskripsi').value.trim(),
    badge: document.getElementById('produk-badge').value.trim() || null,
    aktif: 1
  };
  try {
    if (id) await api('/api/admin/produk/' + id, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/api/admin/produk', { method: 'POST', body: JSON.stringify(body) });
    toast(id ? 'Produk diperbarui ✅' : 'Produk ditambahkan ✅');
    resetFormProduk(); loadProduk(); loadProdukDropdown();
  } catch (ex) { toast(ex.message, false); }
});

window.nonaktifProduk = async (id) => {
  if (!confirm('Nonaktifkan produk ini? Produk akan disembunyikan dari halaman depan.')) return;
  try { await api('/api/admin/produk/' + id, { method: 'DELETE' }); toast('Produk dinonaktifkan'); loadProduk(); loadProdukDropdown(); }
  catch (ex) { toast(ex.message, false); }
};

window.aktifkanProduk = async (p) => {
  try {
    await api('/api/admin/produk/' + p.id, { method: 'PUT', body: JSON.stringify({ ...p, aktif: 1 }) });
    toast('Produk diaktifkan'); loadProduk(); loadProdukDropdown();
  } catch (ex) { toast(ex.message, false); }
};

// ---------- Pengguna (owner) ----------
async function loadUsers() {
  const { users } = await api('/api/admin/users');
  const roleBadge = { owner: 'bg-red-100 text-red-700', admin: 'bg-yellow-100 text-yellow-700', karyawan: 'bg-green-100 text-green-700' };
  document.getElementById('table-user').innerHTML = `
    <thead><tr><th>Username</th><th>Nama</th><th>Peran</th><th>Status</th><th></th></tr></thead>
    <tbody>${users.map((u) => `
      <tr class="${u.aktif ? '' : 'opacity-50'}">
        <td class="font-mono">${u.username}</td><td>${u.nama}</td>
        <td><span class="text-xs px-2 py-0.5 rounded-full ${roleBadge[u.role]}">${u.role}</span></td>
        <td>${u.aktif ? '<span class="text-green-600 text-xs font-semibold">Aktif</span>' : '<span class="text-gray-400 text-xs">Nonaktif</span>'}</td>
        <td class="whitespace-nowrap">
          <button onclick="resetSandi(${u.id}, '${u.nama.replace(/'/g, '')}')" class="text-blue-500 hover:text-blue-700 mr-2" title="Reset kata sandi"><i class="fas fa-key"></i></button>
          ${u.id !== ME.id ? `<button onclick="toggleUser(${u.id}, ${u.aktif ? 0 : 1})" class="${u.aktif ? 'text-red-500' : 'text-green-600'}" title="${u.aktif ? 'Nonaktifkan' : 'Aktifkan'}"><i class="fas fa-power-off"></i></button>` : ''}
        </td>
      </tr>`).join('')}</tbody>`;
}

document.getElementById('form-user').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/users', { method: 'POST', body: JSON.stringify({
      username: document.getElementById('user-username').value.trim(),
      nama: document.getElementById('user-nama-input').value.trim(),
      password: document.getElementById('user-password').value,
      role: document.getElementById('user-role-input').value
    })});
    toast('Pengguna berhasil ditambahkan 👤');
    document.getElementById('form-user').reset(); loadUsers();
  } catch (ex) { toast(ex.message, false); }
});

window.toggleUser = async (id, aktif) => {
  try { await api(`/api/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ aktif }) }); toast(aktif ? 'Pengguna diaktifkan' : 'Pengguna dinonaktifkan'); loadUsers(); }
  catch (ex) { toast(ex.message, false); }
};

window.resetSandi = async (id, nama) => {
  const pw = prompt(`Kata sandi baru untuk ${nama} (min. 6 karakter):`);
  if (!pw) return;
  try { await api(`/api/admin/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password: pw }) }); toast('Kata sandi diperbarui 🔑'); }
  catch (ex) { toast(ex.message, false); }
};
