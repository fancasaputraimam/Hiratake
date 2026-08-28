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

    // Tampilkan tab & judul grup sidebar sesuai role
    document.querySelectorAll('[data-roles]').forEach((el) => {
      if (el.dataset.roles.split(',').includes(user.role)) el.classList.remove('hidden');
    });

    ['panen-tanggal', 'jual-tanggal', 'bg-tanggal', 'kj-tanggal', 'kl-tanggal', 'pm-tanggal', 'po-tgl-pesan', 'po-tgl-kirim', 'st-tanggal', 'cicil-tanggal'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.value = hariIni();
    });

    loadNotifikasi();


    await Promise.all([loadRingkasan(), loadProdukDropdown(), loadBatchDropdown(), loadPelangganDropdown()]);
    document.getElementById('loading-screen').remove();
  } catch (e) { /* redirect ke login sudah ditangani */ }
})();

// ---------- Sidebar (HP: drawer, laptop: tetap) ----------
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
function bukaSidebar() { sidebar.classList.add('open'); sidebarOverlay.classList.remove('hidden'); }
function tutupSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.add('hidden'); }
document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
  sidebar.classList.contains('open') ? tutupSidebar() : bukaSidebar();
});
sidebarOverlay?.addEventListener('click', tutupSidebar);

// ---------- Modal umum ----------
function bukaModal(id) { document.getElementById(id)?.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function tutupModal(id) { document.getElementById(id)?.classList.add('hidden'); document.body.style.overflow = ''; }
document.querySelectorAll('[data-modal]').forEach((b) => b.addEventListener('click', () => bukaModal(b.dataset.modal)));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => tutupModal(b.dataset.close)));
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) tutupModal(m.id); }));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal:not(.hidden)').forEach((m) => tutupModal(m.id));
});
// Tombol "baru" produk/pelanggan: reset form sebelum modal terbuka
document.getElementById('btn-produk-baru')?.addEventListener('click', () => resetFormProduk());
document.getElementById('btn-pelanggan-baru')?.addEventListener('click', () => resetFormPelanggan());

// ---------- Navigasi tab ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
    const loaders = { dashboard: loadRingkasan, baglog: loadBaglog, panen: loadPanen, penjualan: loadPenjualan, pesanan: loadPesanan, stok: loadStok, piutang: loadPiutang, pelanggan: loadPelanggan, keuangan: loadKeuangan, laporan: loadLaporan, produk: loadProduk, pengguna: loadUsers, pengaturan: loadPengaturan, aktivitas: loadAudit };
    loaders[btn.dataset.tab]?.();
    tutupSidebar(); // di HP: tutup drawer setelah memilih menu
    window.scrollTo({ top: 0 });
  });
});

// ---------- Logout ----------
document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
});

// ---------- Notifikasi ----------
async function loadNotifikasi() {
  try {
    const n = await api('/api/admin/notifikasi');
    const totalNotif = (n.piutangTelat.jumlah > 0 ? 1 : 0) + (n.piutangDekat > 0 ? 1 : 0) + (n.pesananWebBaru > 0 ? 1 : 0) + (n.batchTua.length > 0 ? 1 : 0);
    const badge = document.getElementById('notif-badge');
    badge.textContent = totalNotif;
    badge.classList.toggle('hidden', totalNotif === 0);

    // Badge sidebar
    const bp = document.getElementById('badge-piutang');
    bp.textContent = n.piutangTelat.jumlah;
    bp.classList.toggle('hidden', n.piutangTelat.jumlah === 0);
    const bo = document.getElementById('badge-pesanan');
    bo.textContent = n.pesananWebBaru;
    bo.classList.toggle('hidden', n.pesananWebBaru === 0);

    // Isi panel notifikasi
    const item = [];
    if (n.piutangTelat.jumlah > 0) item.push({ ikon: 'fa-triangle-exclamation text-red-500', teks: `<strong>${n.piutangTelat.jumlah} piutang TERLAMBAT</strong> senilai ${rupiah(n.piutangTelat.total)}`, tab: 'piutang' });
    if (n.piutangDekat > 0) item.push({ ikon: 'fa-clock text-orange-500', teks: `${n.piutangDekat} piutang jatuh tempo ≤ 3 hari lagi`, tab: 'piutang' });
    if (n.pesananWebBaru > 0) item.push({ ikon: 'fa-globe text-kin', teks: `<strong>${n.pesananWebBaru} pesanan baru dari website</strong> menunggu diproses`, tab: 'pesanan' });
    n.batchTua.forEach((b) => item.push({ ikon: 'fa-hourglass-end text-matcha', teks: `Batch <strong>${b.kode}</strong> sudah ${b.umur_hari} hari — siapkan baglog pengganti`, tab: 'baglog' }));
    document.getElementById('notif-isi').innerHTML = item.length
      ? item.map((i) => `<button class="notif-item w-full text-left px-4 py-3 hover:bg-washi transition flex gap-3 items-start text-sm" data-ke="${i.tab}"><i class="fas ${i.ikon} mt-0.5"></i><span>${i.teks}</span></button>`).join('')
      : '<p class="px-4 py-6 text-center text-sm text-gray-400">Tidak ada notifikasi — semua aman 🍄</p>';
    document.querySelectorAll('.notif-item').forEach((b) => b.addEventListener('click', () => {
      document.getElementById('notif-panel').classList.add('hidden');
      document.querySelector(`.tab-btn[data-tab="${b.dataset.ke}"]`)?.click();
    }));

    // Peringatan di dashboard
    const per = document.getElementById('peringatan-dashboard');
    if (per) per.innerHTML = item.map((i) => `<div class="bg-white border-l-4 ${i.ikon.includes('red') ? 'border-red-500' : i.ikon.includes('orange') ? 'border-orange-400' : 'border-kin'} rounded-xl shadow-sm px-4 py-2.5 text-sm flex gap-2 items-center"><i class="fas ${i.ikon}"></i><span>${i.teks}</span></div>`).join('');
  } catch (e) { /* abaikan */ }
}
document.getElementById('notif-btn')?.addEventListener('click', () => {
  document.getElementById('notif-panel').classList.toggle('hidden');
  loadNotifikasi();
});
document.getElementById('notif-tutup')?.addEventListener('click', () => document.getElementById('notif-panel').classList.add('hidden'));

// ---------- Ganti kata sandi sendiri ----------
document.getElementById('form-sandi')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const baru = document.getElementById('sandi-baru').value;
  if (baru !== document.getElementById('sandi-ulang').value) return toast('Ulangan sandi baru tidak sama.', false);
  try {
    await api('/api/auth/password', { method: 'PUT', body: JSON.stringify({
      sandi_lama: document.getElementById('sandi-lama').value,
      sandi_baru: baru
    })});
    toast('Kata sandi berhasil diganti 🔐');
    tutupModal('modal-sandi');
    document.getElementById('form-sandi').reset();
  } catch (ex) { toast(ex.message, false); }
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

  // Target panen bulanan
  const tw = document.getElementById('target-wrap');
  if (d.targetKg > 0) {
    tw.classList.remove('hidden');
    const persen = Math.min(100, Math.round((d.panenBulanIni / d.targetKg) * 100));
    document.getElementById('target-tercapai').textContent = d.panenBulanIni;
    document.getElementById('target-angka').textContent = d.targetKg;
    document.getElementById('target-persen').textContent = persen;
    document.getElementById('target-bar').style.width = persen + '%';
    document.getElementById('target-bar').style.background = persen >= 100 ? '#7A8450' : persen >= 60 ? '#C9A227' : '#C73E3A';
  } else tw.classList.add('hidden');

  loadNotifikasi();

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
    tutupModal('modal-baglog');
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
    tutupModal('modal-kejadian');
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
  const bulan = document.getElementById('panen-filter-bulan')?.value || '';
  const cari = (document.getElementById('panen-cari')?.value || '').toLowerCase();
  let { panen } = await api('/api/admin/panen' + (bulan ? '?bulan=' + bulan : ''));
  if (cari) panen = panen.filter((p) => `${p.tanggal} ${p.batch_kode || ''} ${p.catatan || ''} ${p.pencatat || ''}`.toLowerCase().includes(cari));
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
    tutupModal('modal-panen');
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

// Filter, cari & ekspor panen
document.getElementById('panen-filter-bulan')?.addEventListener('change', loadPanen);
document.getElementById('panen-cari')?.addEventListener('input', () => { clearTimeout(window._tp); window._tp = setTimeout(loadPanen, 300); });
document.getElementById('ekspor-panen')?.addEventListener('click', () => {
  const bulan = document.getElementById('panen-filter-bulan')?.value || '';
  window.open('/api/admin/ekspor/panen' + (bulan ? '?bulan=' + bulan : ''), '_blank');
});

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
  const aktif = pelanggan.filter((p) => p.aktif);
  const sel = document.getElementById('jual-pelanggan');
  if (sel) sel.innerHTML = '<option value="">— umum / tanpa nama —</option>' +
    aktif.map((p) => `<option value="${p.id}">${p.nama} (${p.tipe})</option>`).join('');
  const poSel = document.getElementById('po-pelanggan');
  if (poSel) poSel.innerHTML = '<option value="">— pilih pelanggan —</option>' +
    aktif.map((p) => `<option value="${p.id}">${p.nama} (${p.tipe})</option>`).join('');
}

document.getElementById('jual-bayar')?.addEventListener('change', (e) => {
  document.getElementById('jual-tempo-wrap').classList.toggle('hidden', e.target.value !== 'tempo');
});

// Filter, cari & ekspor penjualan
document.getElementById('jual-filter-bulan')?.addEventListener('change', () => loadPenjualan());
document.getElementById('jual-cari')?.addEventListener('input', () => { clearTimeout(window._tj); window._tj = setTimeout(loadPenjualan, 300); });
document.getElementById('ekspor-penjualan')?.addEventListener('click', () => {
  const bulan = document.getElementById('jual-filter-bulan')?.value || '';
  window.open('/api/admin/ekspor/penjualan' + (bulan ? '?bulan=' + bulan : ''), '_blank');
});

async function loadPenjualan() {
  const bulan = document.getElementById('jual-filter-bulan')?.value || '';
  const cari = (document.getElementById('jual-cari')?.value || '').toLowerCase();
  let { penjualan } = await api('/api/admin/penjualan' + (bulan ? '?bulan=' + bulan : ''));
  if (cari) penjualan = penjualan.filter((j) => `${j.tanggal} ${j.nama_produk} ${j.pelanggan_nama || ''} ${j.pembeli || ''} ${j.pencatat || ''}`.toLowerCase().includes(cari));
  const boleh = ['owner', 'admin'].includes(ME.role);
  document.getElementById('table-penjualan').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Produk</th><th>Jml</th><th>Total</th><th>Pembeli</th><th>Bayar</th><th>Pencatat</th><th></th></tr></thead>
    <tbody>${penjualan.map((j) => `
      <tr>
        <td>${j.tanggal}</td><td>${j.nama_produk}</td><td>${j.jumlah}</td>
        <td class="font-semibold" style="color:#C73E3A">${rupiah(j.total)}</td>
        <td>${j.pelanggan_nama || j.pembeli || '-'}</td>
        <td>${j.status_bayar === 'tempo'
          ? `<span class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">tempo · ${j.jatuh_tempo || ''}</span>`
          : '<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">lunas</span>'}</td>
        <td>${j.pencatat || '-'}</td>
        <td class="whitespace-nowrap">
          <a href="/nota/penjualan/${j.id}" target="_blank" class="text-sumi/40 hover:text-sumi mr-2" title="Cetak nota"><i class="fas fa-receipt"></i></a>
          ${boleh && j.status_bayar === 'tempo' ? `<button onclick="tandaiLunas(${j.id})" class="text-green-600 mr-2" title="Tandai lunas"><i class="fas fa-circle-check"></i></button>` : ''}
          ${boleh ? `<button onclick="hapusJual(${j.id})" class="text-red-500 hover:text-red-700" title="Hapus"><i class="fas fa-trash"></i></button>` : ''}</td>
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
    tutupModal('modal-penjualan');
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

// ---------- Pesanan / PO ----------
function opsiProdukPO() {
  return PRODUK_CACHE.filter((p) => p.aktif !== 0).map((p) => `<option value="${p.id}" data-harga="${p.harga}">${p.nama} — ${rupiah(p.harga)}</option>`).join('');
}

function tambahBarisItemPO() {
  const wrap = document.getElementById('po-items');
  const div = document.createElement('div');
  div.className = 'flex gap-2 items-center po-item-row';
  div.innerHTML = `
    <select class="form-input po-item-produk flex-1">${opsiProdukPO()}</select>
    <input type="number" min="1" value="1" class="form-input po-item-jumlah" style="max-width:80px">
    <button type="button" class="text-red-400 hover:text-red-600 po-item-hapus px-1" title="Hapus item"><i class="fas fa-times"></i></button>`;
  div.querySelector('.po-item-hapus').addEventListener('click', () => { div.remove(); hitungTotalPO(); });
  div.querySelector('.po-item-produk').addEventListener('change', hitungTotalPO);
  div.querySelector('.po-item-jumlah').addEventListener('input', hitungTotalPO);
  wrap.appendChild(div);
  hitungTotalPO();
}

function hitungTotalPO() {
  let total = 0;
  document.querySelectorAll('.po-item-row').forEach((row) => {
    const harga = parseInt(row.querySelector('.po-item-produk').selectedOptions[0]?.dataset.harga || 0);
    const qty = parseInt(row.querySelector('.po-item-jumlah').value || 0);
    total += harga * qty;
  });
  const el = document.getElementById('po-total');
  if (el) el.textContent = rupiah(total);
}

document.getElementById('po-tambah-item')?.addEventListener('click', tambahBarisItemPO);

const PO_STATUS_BADGE = {
  baru: 'bg-blue-100 text-blue-700', diproses: 'bg-yellow-100 text-yellow-700',
  siap: 'bg-purple-100 text-purple-700', selesai: 'bg-green-100 text-green-700', batal: 'bg-gray-200 text-gray-500'
};

async function loadPesanan() {
  if (!document.querySelector('.po-item-row')) tambahBarisItemPO();
  const filter = document.getElementById('po-filter')?.value || '';
  const { pesanan } = await api('/api/admin/pesanan' + (filter ? '?status=' + filter : ''));
  document.getElementById('table-pesanan').innerHTML = `
    <thead><tr><th>Kode</th><th>Pelanggan</th><th>Kirim</th><th>Total</th><th>Status</th><th></th></tr></thead>
    <tbody>${pesanan.map((ps) => {
      const telat = ps.status !== 'selesai' && ps.status !== 'batal' && ps.tanggal_kirim < hariIni();
      return `
      <tr class="cursor-pointer ${ps.status === 'batal' ? 'opacity-50' : ''} ${telat ? 'bg-red-50' : ''}" onclick="lihatItemPO(${ps.id}, '${ps.kode}')">
        <td class="font-mono text-xs font-semibold">${ps.kode}${ps.sumber === 'web' ? ' <span class="text-[10px] bg-kin/15 text-kin px-1.5 py-0.5 rounded-full font-sans">WEB</span>' : ''}${ps.catatan ? `<br><span class="text-gray-400 font-sans">${ps.catatan}</span>` : ''}</td>
        <td>${ps.pelanggan_nama || '-'}</td>
        <td class="${telat ? 'text-red-600 font-semibold' : ''}">${ps.tanggal_kirim}${telat ? ' ⚠️' : ''}<br><span class="text-xs text-gray-400">pesan ${ps.tanggal_pesan}</span></td>
        <td class="font-semibold" style="color:#C73E3A">${rupiah(ps.total)}<br><span class="text-xs text-gray-400 font-normal">${ps.jumlah_item} item</span></td>
        <td><span class="text-xs px-2 py-0.5 rounded-full ${PO_STATUS_BADGE[ps.status]}">${ps.status}</span></td>
        <td class="whitespace-nowrap" onclick="event.stopPropagation()">
          ${ps.status === 'baru' ? `<button onclick="ubahStatusPO(${ps.id},'diproses')" class="text-yellow-600 mr-1" title="Mulai proses"><i class="fas fa-play"></i></button>` : ''}
          ${ps.status === 'diproses' ? `<button onclick="ubahStatusPO(${ps.id},'siap')" class="text-purple-600 mr-1" title="Tandai siap kirim"><i class="fas fa-box-open"></i></button>` : ''}
          ${['baru','diproses','siap'].includes(ps.status) ? `
            <button onclick="selesaikanPO(${ps.id}, '${ps.kode}')" class="text-green-600 mr-1" title="Selesai + catat penjualan otomatis"><i class="fas fa-circle-check"></i></button>
            <button onclick="ubahStatusPO(${ps.id},'batal')" class="text-gray-400 hover:text-red-500" title="Batalkan"><i class="fas fa-ban"></i></button>` : ''}
          ${ps.pelanggan_wa ? `<a href="https://wa.me/${ps.pelanggan_wa}?text=${encodeURIComponent('Halo ' + (ps.pelanggan_nama || '') + ', pesanan Anda ' + ps.kode + ' senilai ' + rupiah(ps.total) + ' (' + ps.jumlah_item + ' item) saat ini berstatus: ' + ps.status.toUpperCase() + '. Rencana kirim: ' + ps.tanggal_kirim + '. Terima kasih 🍄 — Hiratake')}" target="_blank" class="text-green-600 ml-1" title="Kabari via WA"><i class="fab fa-whatsapp"></i></a>` : ''}
          <a href="/nota/pesanan/${ps.id}" target="_blank" class="text-sumi/40 hover:text-sumi ml-1" title="Cetak nota"><i class="fas fa-receipt"></i></a>
        </td>
      </tr>`; }).join('') || '<tr><td colspan="6" class="text-center text-gray-400 py-4">Belum ada pesanan</td></tr>'}</tbody>`;
}

document.getElementById('po-filter')?.addEventListener('change', loadPesanan);

window.lihatItemPO = async (id, kode) => {
  const { item } = await api(`/api/admin/pesanan/${id}/item`);
  document.getElementById('po-detail').classList.remove('hidden');
  document.getElementById('po-detail-judul').textContent = 'Item Pesanan — ' + kode;
  const total = item.reduce((s, it) => s + it.subtotal, 0);
  document.getElementById('table-pesanan-item').innerHTML = `
    <thead><tr><th>Produk</th><th>Jumlah</th><th>Harga</th><th>Subtotal</th></tr></thead>
    <tbody>${item.map((it) => `
      <tr><td>${it.nama_produk}</td><td>${it.jumlah}</td><td>${rupiah(it.harga)}</td><td class="font-semibold">${rupiah(it.subtotal)}</td></tr>`).join('')}
      <tr class="font-bold"><td colspan="3">TOTAL</td><td style="color:#C73E3A">${rupiah(total)}</td></tr></tbody>`;
};

window.ubahStatusPO = async (id, status) => {
  if (status === 'batal' && !confirm('Batalkan pesanan ini?')) return;
  try { await api(`/api/admin/pesanan/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }); toast('Status pesanan: ' + status); loadPesanan(); }
  catch (ex) { toast(ex.message, false); }
};

window.selesaikanPO = async (id, kode) => {
  const tempo = confirm(`Selesaikan ${kode} dan catat sebagai penjualan?\n\nOK = LUNAS (dibayar cash)\nCancel = pilih TEMPO (piutang)`);
  let body = { status_bayar: 'lunas' };
  if (!tempo) {
    const jt = prompt('Pembayaran TEMPO — masukkan tanggal jatuh tempo (YYYY-MM-DD):');
    if (!jt) return;
    body = { status_bayar: 'tempo', jatuh_tempo: jt };
  }
  try {
    const r = await api(`/api/admin/pesanan/${id}/selesai`, { method: 'POST', body: JSON.stringify(body) });
    toast(`Pesanan selesai — ${r.jumlahPenjualan} penjualan otomatis tercatat ✅`);
    loadPesanan();
  } catch (ex) { toast(ex.message, false); }
};

document.getElementById('form-pesanan')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const item = [...document.querySelectorAll('.po-item-row')].map((row) => ({
    produk_id: parseInt(row.querySelector('.po-item-produk').value),
    jumlah: parseInt(row.querySelector('.po-item-jumlah').value)
  })).filter((it) => it.produk_id && it.jumlah > 0);
  try {
    const r = await api('/api/admin/pesanan', { method: 'POST', body: JSON.stringify({
      pelanggan_id: parseInt(document.getElementById('po-pelanggan').value) || null,
      tanggal_pesan: document.getElementById('po-tgl-pesan').value,
      tanggal_kirim: document.getElementById('po-tgl-kirim').value,
      catatan: document.getElementById('po-catatan').value.trim(),
      item
    })});
    toast(`Pesanan ${r.kode} dibuat 📋`);
    tutupModal('modal-pesanan');
    document.getElementById('po-catatan').value = '';
    document.getElementById('po-items').innerHTML = '';
    tambahBarisItemPO();
    loadPesanan();
  } catch (ex) { toast(ex.message, false); }
});

// ---------- Stok & Rekonsiliasi ----------
const LABEL_PENYESUAIAN = { rusak: 'Rusak/busuk', bonus: 'Bonus', sampel: 'Sampel', konsumsi: 'Konsumsi', koreksi: 'Koreksi', lainnya: 'Lainnya' };

async function loadStok() {
  const inputBulan = document.getElementById('stok-bulan');
  if (!inputBulan.value) inputBulan.value = hariIni().slice(0, 7);
  const [d, { penyesuaian }] = await Promise.all([
    api('/api/admin/stok?bulan=' + inputBulan.value),
    api('/api/admin/stok/penyesuaian')
  ]);

  const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('id-ID');
  document.getElementById('stok-cards').innerHTML = `
    <div class="stat-card"><i class="fas fa-wheat-awn text-matcha"></i><p class="stat-val">${fmt(d.totalPanenKg)} kg</p><p class="stat-label">Panen Bulan Ini</p></div>
    <div class="stat-card"><i class="fas fa-cash-register text-kin"></i><p class="stat-val">${fmt(d.totalTerjualKg)} kg</p><p class="stat-label">Terjual (kg segar)</p></div>
    <div class="stat-card"><i class="fas fa-sliders" style="color:#C9A227"></i><p class="stat-val">${fmt(d.totalPenyesuaianKeluar)} kg</p><p class="stat-label">Penyesuaian Keluar</p></div>
    <div class="stat-card ${d.saldoAkhirBulan < 0 ? 'bg-red-50' : ''}"><i class="fas fa-boxes-stacked ${d.saldoAkhirBulan < 0 ? 'text-red-500' : 'text-matcha'}"></i><p class="stat-val ${d.saldoAkhirBulan < 0 ? 'text-red-600' : ''}">${fmt(d.saldoAkhirBulan)} kg</p><p class="stat-label">Saldo Stok Akhir</p></div>`;

  const peringatan = document.getElementById('stok-peringatan');
  if (d.adaMinus) {
    peringatan.classList.remove('hidden');
    peringatan.innerHTML = '<i class="fas fa-triangle-exclamation mr-2"></i><strong>Ada hari dengan saldo minus!</strong> Terjual/keluar lebih banyak dari yang dipanen → kemungkinan ada panen yang lupa dicatat, atau berat produk belum diisi. Cek baris merah di bawah.';
  } else {
    peringatan.classList.add('hidden');
  }

  document.getElementById('table-stok').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Panen</th><th>Terjual</th><th>Peny. Keluar</th><th>Peny. Masuk</th><th>Netto</th><th>Saldo</th></tr></thead>
    <tbody>
      <tr class="text-gray-500"><td colspan="6">Saldo awal bulan</td><td class="font-semibold ${d.saldoAwalBulan < 0 ? 'text-red-600' : ''}">${fmt(d.saldoAwalBulan)} kg</td></tr>
      ${d.hari.map((h) => `
      <tr class="${h.minus ? 'bg-red-50' : ''}">
        <td>${h.tanggal}</td>
        <td class="text-matcha" style="color:#7A8450">${h.panenKg ? '+' + fmt(h.panenKg) : '-'}</td>
        <td>${h.terjualKg ? '−' + fmt(h.terjualKg) : '-'}</td>
        <td class="${h.penyesuaianKeluar ? 'text-orange-600' : ''}">${h.penyesuaianKeluar ? '−' + fmt(h.penyesuaianKeluar) : '-'}</td>
        <td>${h.penyesuaianMasuk ? '+' + fmt(h.penyesuaianMasuk) : '-'}</td>
        <td class="font-semibold ${h.netto < 0 ? 'text-red-600' : ''}">${h.netto > 0 ? '+' : ''}${fmt(h.netto)}</td>
        <td class="font-bold ${h.saldoAkhir < 0 ? 'text-red-600' : ''}">${fmt(h.saldoAkhir)} kg${h.minus ? ' ⚠️' : ''}</td>
      </tr>`).join('') || '<tr><td colspan="7" class="text-center text-gray-400 py-4">Belum ada pergerakan stok bulan ini</td></tr>'}
    </tbody>`;

  const boleh = ['owner', 'admin'].includes(ME.role);
  document.getElementById('table-penyesuaian').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Jenis</th><th>Kg</th><th>Ket.</th>${boleh ? '<th></th>' : ''}</tr></thead>
    <tbody>${penyesuaian.map((s) => `
      <tr>
        <td>${s.tanggal}</td>
        <td><span class="text-xs px-2 py-0.5 rounded-full ${s.arah === 'keluar' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}">${LABEL_PENYESUAIAN[s.jenis]} ${s.arah === 'keluar' ? '↓' : '↑'}</span></td>
        <td class="font-semibold">${s.jumlah_kg}</td>
        <td>${s.keterangan || '-'}<br><span class="text-xs text-gray-400">${s.pencatat || ''}</span></td>
        ${boleh ? `<td><button onclick="hapusPenyesuaian(${s.id})" class="text-red-400 hover:text-red-600" title="Hapus"><i class="fas fa-trash"></i></button></td>` : ''}
      </tr>`).join('') || '<tr><td colspan="5" class="text-center text-gray-400 py-4">Belum ada penyesuaian</td></tr>'}</tbody>`;
}

document.getElementById('stok-muat')?.addEventListener('click', loadStok);

document.getElementById('form-penyesuaian')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/stok/penyesuaian', { method: 'POST', body: JSON.stringify({
      tanggal: document.getElementById('st-tanggal').value,
      jenis: document.getElementById('st-jenis').value,
      arah: document.getElementById('st-arah').value,
      jumlah_kg: parseFloat(document.getElementById('st-jumlah').value),
      keterangan: document.getElementById('st-ket').value.trim()
    })});
    toast('Penyesuaian stok dicatat ✅');
    tutupModal('modal-penyesuaian');
    document.getElementById('st-jumlah').value = ''; document.getElementById('st-ket').value = '';
    loadStok();
  } catch (ex) { toast(ex.message, false); }
});

window.hapusPenyesuaian = async (id) => {
  if (!confirm('Hapus penyesuaian stok ini?')) return;
  try { await api('/api/admin/stok/penyesuaian/' + id, { method: 'DELETE' }); toast('Dihapus'); loadStok(); }
  catch (ex) { toast(ex.message, false); }
};

// ---------- Piutang ----------
let PIUTANG_CACHE = [];
async function loadPiutang() {
  const { piutang } = await api('/api/admin/piutang');
  PIUTANG_CACHE = piutang;
  const totalSisa = piutang.reduce((s, p) => s + (p.total - (p.terbayar || 0)), 0);
  document.getElementById('piutang-total').textContent = rupiah(totalSisa);
  const boleh = ['owner', 'admin'].includes(ME.role);
  document.getElementById('table-piutang').innerHTML = `
    <thead><tr><th>Jatuh Tempo</th><th>Pelanggan</th><th>Produk</th><th>Nominal</th><th>Terbayar</th><th>Sisa</th><th>Status</th><th></th></tr></thead>
    <tbody>${piutang.map((p) => {
      const sisa = p.total - (p.terbayar || 0);
      return `
      <tr class="${p.terlambat ? 'bg-red-50' : ''}">
        <td class="${p.terlambat ? 'text-red-600 font-semibold' : ''}">${p.jatuh_tempo}${p.terlambat ? ' ⚠️' : ''}</td>
        <td>${p.pelanggan_nama || p.pembeli || '-'}</td>
        <td>${p.nama_produk} ×${p.jumlah}<br><span class="text-xs text-gray-400">nota ${p.tanggal}</span></td>
        <td class="font-semibold">${rupiah(p.total)}</td>
        <td class="text-green-700">${p.terbayar ? rupiah(p.terbayar) : '-'}</td>
        <td class="font-semibold" style="color:#C73E3A">${rupiah(sisa)}</td>
        <td>${p.terlambat ? '<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">TERLAMBAT</span>' : '<span class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">berjalan</span>'}</td>
        <td class="whitespace-nowrap">
          ${p.pelanggan_wa ? `<a href="https://wa.me/${p.pelanggan_wa}?text=${encodeURIComponent('Halo, mengingatkan pembayaran ' + p.nama_produk + ' sisa ' + rupiah(sisa) + ' jatuh tempo ' + p.jatuh_tempo + '. Terima kasih 🙏 — Hiratake')}" target="_blank" class="text-green-600 mr-2" title="Tagih via WA"><i class="fab fa-whatsapp"></i></a>` : ''}
          ${boleh ? `<button onclick="bukaCicil(${p.id})" class="text-kin hover:text-yellow-700 mr-2" title="Catat pembayaran / cicilan"><i class="fas fa-hand-holding-dollar"></i></button>` : ''}
          ${boleh ? `<button onclick="tandaiLunasPiutang(${p.id})" class="text-green-600" title="Tandai lunas penuh"><i class="fas fa-circle-check"></i></button>` : ''}
        </td>
      </tr>`; }).join('') || '<tr><td colspan="8" class="text-center text-gray-400 py-4">Tidak ada piutang — semua lunas! 🎉</td></tr>'}</tbody>`;
}

// Modal cicilan piutang
window.bukaCicil = async (id) => {
  const p = PIUTANG_CACHE.find((x) => x.id === id);
  if (!p) return;
  const sisa = p.total - (p.terbayar || 0);
  document.getElementById('cicil-penjualan-id').value = id;
  document.getElementById('cicil-info-pembeli').textContent = (p.pelanggan_nama || p.pembeli || '-') + ' — ' + p.nama_produk + ' ×' + p.jumlah;
  document.getElementById('cicil-info-total').textContent = rupiah(p.total);
  document.getElementById('cicil-info-sisa').textContent = rupiah(sisa);
  document.getElementById('cicil-jumlah').value = '';
  document.getElementById('cicil-jumlah').max = sisa;
  document.getElementById('cicil-tanggal').value = hariIni();
  // Riwayat pembayaran
  try {
    const { pembayaran } = await api(`/api/admin/penjualan/${id}/pembayaran`);
    document.getElementById('cicil-riwayat').innerHTML = pembayaran.length
      ? '<p class="font-semibold">Riwayat:</p>' + pembayaran.map((b) => `<p>• ${b.tanggal} — ${rupiah(b.jumlah)} ${b.catatan ? '(' + b.catatan + ')' : ''} <span class="text-gray-400">oleh ${b.pencatat || '-'}</span></p>`).join('')
      : '';
  } catch { document.getElementById('cicil-riwayat').innerHTML = ''; }
  bukaModal('modal-cicil');
};

document.getElementById('form-cicil')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('cicil-penjualan-id').value;
  try {
    const r = await api(`/api/admin/penjualan/${id}/pembayaran`, { method: 'POST', body: JSON.stringify({
      tanggal: document.getElementById('cicil-tanggal').value,
      jumlah: parseInt(document.getElementById('cicil-jumlah').value),
      catatan: document.getElementById('cicil-catatan').value.trim()
    })});
    toast(r.lunas ? 'Pembayaran dicatat — piutang LUNAS 🎉' : `Cicilan dicatat. Sisa: ${rupiah(r.sisa)}`);
    tutupModal('modal-cicil');
    document.getElementById('cicil-catatan').value = '';
    loadPiutang(); loadNotifikasi();
  } catch (ex) { toast(ex.message, false); }
});

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
  bukaModal('modal-pelanggan');
  document.getElementById('pl-id').value = p.id;
  document.getElementById('pl-nama').value = p.nama;
  document.getElementById('pl-tipe').value = p.tipe;
  document.getElementById('pl-wa').value = p.wa || '';
  document.getElementById('pl-alamat').value = p.alamat || '';
  document.getElementById('pl-catatan').value = p.catatan || '';
  document.getElementById('pelanggan-form-title').innerHTML = '<i class="fas fa-pen text-blue-500 mr-2"></i>Ubah Pelanggan';
  document.getElementById('pl-batal').classList.remove('hidden');
};

function resetFormPelanggan() {
  document.getElementById('form-pelanggan').reset();
  document.getElementById('pl-id').value = '';
  document.getElementById('pelanggan-form-title').innerHTML = '<i class="fas fa-user-plus text-vermillion mr-2"></i>Tambah Pelanggan';
  document.getElementById('pl-batal').classList.add('hidden');
}
document.getElementById('pl-batal')?.addEventListener('click', () => {
  resetFormPelanggan();
  tutupModal('modal-pelanggan');
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
    tutupModal('modal-pelanggan');
    resetFormPelanggan();
    loadPelanggan(); loadPelangganDropdown();
  } catch (ex) { toast(ex.message, false); }
});

// ---------- Keuangan ----------
const LABEL_KATEGORI = {
  bahan_baku: 'Bahan Baku', bibit: 'Bibit', gas_sterilisasi: 'Gas/Sterilisasi', listrik_air: 'Listrik & Air',
  gaji: 'Gaji', transport: 'Transport/BBM', kemasan: 'Kemasan', perawatan: 'Perawatan', lainnya: 'Lainnya'
};

async function loadKeuangan() {
  const [{ pengeluaran }, { pemasukan }] = await Promise.all([
    api('/api/admin/pengeluaran'), api('/api/admin/pemasukan-lain')
  ]);
  document.getElementById('table-pengeluaran').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Kategori</th><th>Jumlah</th><th>Keterangan</th><th>Pencatat</th><th></th></tr></thead>
    <tbody>${pengeluaran.map((p) => `
      <tr>
        <td>${p.tanggal}</td>
        <td><span class="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">${LABEL_KATEGORI[p.kategori] || p.kategori}</span></td>
        <td class="font-semibold" style="color:#C73E3A">${rupiah(p.jumlah)}</td>
        <td>${p.keterangan || '-'}</td><td>${p.pencatat || '-'}</td>
        <td><button onclick="hapusPengeluaran(${p.id})" class="text-red-400 hover:text-red-600" title="Hapus"><i class="fas fa-trash"></i></button></td>
      </tr>`).join('') || '<tr><td colspan="6" class="text-center text-gray-400 py-4">Belum ada pengeluaran tercatat</td></tr>'}</tbody>`;
  document.getElementById('table-pemasukan').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Jumlah</th><th>Keterangan</th><th>Pencatat</th><th></th></tr></thead>
    <tbody>${pemasukan.map((p) => `
      <tr>
        <td>${p.tanggal}</td>
        <td class="font-semibold" style="color:#7A8450">${rupiah(p.jumlah)}</td>
        <td>${p.keterangan || '-'}</td><td>${p.pencatat || '-'}</td>
        <td><button onclick="hapusPemasukan(${p.id})" class="text-red-400 hover:text-red-600" title="Hapus"><i class="fas fa-trash"></i></button></td>
      </tr>`).join('') || '<tr><td colspan="5" class="text-center text-gray-400 py-4">Belum ada pemasukan lain</td></tr>'}</tbody>`;
}

document.getElementById('form-pengeluaran')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/pengeluaran', { method: 'POST', body: JSON.stringify({
      tanggal: document.getElementById('kl-tanggal').value,
      kategori: document.getElementById('kl-kategori').value,
      jumlah: parseInt(document.getElementById('kl-jumlah').value),
      keterangan: document.getElementById('kl-ket').value.trim()
    })});
    toast('Pengeluaran dicatat 💸');
    tutupModal('modal-pengeluaran');
    document.getElementById('kl-jumlah').value = ''; document.getElementById('kl-ket').value = '';
    loadKeuangan();
  } catch (ex) { toast(ex.message, false); }
});

document.getElementById('form-pemasukan')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/pemasukan-lain', { method: 'POST', body: JSON.stringify({
      tanggal: document.getElementById('pm-tanggal').value,
      jumlah: parseInt(document.getElementById('pm-jumlah').value),
      keterangan: document.getElementById('pm-ket').value.trim()
    })});
    toast('Pemasukan dicatat 💰');
    tutupModal('modal-pemasukan');
    document.getElementById('pm-jumlah').value = ''; document.getElementById('pm-ket').value = '';
    loadKeuangan();
  } catch (ex) { toast(ex.message, false); }
});

window.hapusPengeluaran = async (id) => {
  if (!confirm('Hapus catatan pengeluaran ini?')) return;
  try { await api('/api/admin/pengeluaran/' + id, { method: 'DELETE' }); toast('Dihapus'); loadKeuangan(); }
  catch (ex) { toast(ex.message, false); }
};
window.hapusPemasukan = async (id) => {
  if (!confirm('Hapus catatan pemasukan ini?')) return;
  try { await api('/api/admin/pemasukan-lain/' + id, { method: 'DELETE' }); toast('Dihapus'); loadKeuangan(); }
  catch (ex) { toast(ex.message, false); }
};

// ---------- Laporan ----------
let chartKategori;
async function loadLaporan() {
  const inputBulan = document.getElementById('laporan-bulan');
  if (!inputBulan.value) inputBulan.value = hariIni().slice(0, 7);
  const d = await api('/api/admin/laporan?bulan=' + inputBulan.value);

  const untung = d.labaRugi >= 0;
  document.getElementById('laporan-cards').innerHTML = `
    <div class="stat-card"><i class="fas fa-arrow-trend-up text-matcha"></i><p class="stat-val">${rupiah(d.totalPemasukan)}</p><p class="stat-label">Total Pemasukan (omzet + lain)</p></div>
    <div class="stat-card"><i class="fas fa-arrow-trend-down" style="color:#C73E3A"></i><p class="stat-val">${rupiah(d.totalPengeluaran)}</p><p class="stat-label">Total Pengeluaran</p></div>
    <div class="stat-card ${untung ? '' : 'bg-red-50'}"><i class="fas fa-scale-balanced ${untung ? 'text-matcha' : 'text-red-500'}"></i><p class="stat-val ${untung ? '' : 'text-red-600'}" style="${untung ? 'color:#7A8450' : ''}">${untung ? '+' : ''}${rupiah(d.labaRugi)}</p><p class="stat-label">${untung ? 'LABA' : 'RUGI'} Bulan Ini</p></div>
    <div class="stat-card"><i class="fas fa-tag text-kin"></i><p class="stat-val">${rupiah(d.hppPerKg)}/kg</p><p class="stat-label">HPP per Kg Panen</p></div>`;

  // Grafik pengeluaran per kategori
  chartKategori?.destroy();
  const kat = d.pengeluaranPerKategori;
  chartKategori = new Chart(document.getElementById('chart-kategori'), {
    type: 'doughnut',
    data: {
      labels: kat.map((k) => LABEL_KATEGORI[k.kategori] || k.kategori),
      datasets: [{ data: kat.map((k) => k.v), backgroundColor: ['#C73E3A','#C9A227','#7A8450','#2B2B2B','#8A6BBE','#D97706','#0891B2','#DB2777','#9CA3AF'] }]
    },
    options: { plugins: { legend: { position: 'right' } } }
  });

  // Tabel rinci
  const baris = (label, nilai, cls = '') => `<tr class="border-b border-gray-100"><td class="py-2">${label}</td><td class="py-2 text-right font-semibold ${cls}">${nilai}</td></tr>`;
  document.getElementById('laporan-rinci').innerHTML =
    baris('Omzet penjualan (' + d.jumlahNota + ' nota)', rupiah(d.omzet)) +
    baris('Pemasukan lain', rupiah(d.pemasukanLain)) +
    baris('Total pengeluaran', '− ' + rupiah(d.totalPengeluaran), 'text-red-600') +
    baris(d.labaRugi >= 0 ? 'LABA' : 'RUGI', rupiah(Math.abs(d.labaRugi)), d.labaRugi >= 0 ? 'text-green-700' : 'text-red-600') +
    baris('Kas benar-benar masuk (lunas)', rupiah(d.kasMasuk)) +
    baris('Omzet masih piutang', rupiah(d.piutangBulanIni), d.piutangBulanIni > 0 ? 'text-orange-600' : '') +
    baris('Panen bulan ini', d.panenKg + ' kg') +
    baris('Susut', d.susutKg + ' kg (' + d.susutPersen + '%)', d.susutPersen > 5 ? 'text-red-600' : '') +
    baris('Investasi baglog baru (' + d.baglogBaruJumlah + ' pcs)', rupiah(d.investasiBaglog)) +
    baris('Rata-rata harga jual per kg', rupiah(d.rataHargaJualPerKg)) +
    baris('HPP per kg', rupiah(d.hppPerKg), d.hppPerKg > d.rataHargaJualPerKg && d.rataHargaJualPerKg > 0 ? 'text-red-600' : '');

  // Insight otomatis
  const insights = [];
  if (d.rataHargaJualPerKg > 0 && d.hppPerKg > 0) {
    const margin = d.rataHargaJualPerKg - d.hppPerKg;
    insights.push(margin >= 0
      ? `✅ Margin kotor Anda <strong>${rupiah(margin)}/kg</strong> (jual ${rupiah(d.rataHargaJualPerKg)} vs HPP ${rupiah(d.hppPerKg)}).`
      : `⚠️ <strong>Harga jual di bawah HPP!</strong> Rugi ${rupiah(-margin)}/kg. Naikkan harga atau tekan biaya.`);
  }
  if (d.susutPersen > 5) insights.push(`⚠️ Susut ${d.susutPersen}% tergolong tinggi (wajar < 5%). Percepat distribusi atau olah jadi produk crispy.`);
  else if (d.panenKg > 0) insights.push(`✅ Susut ${d.susutPersen}% — masih wajar.`);
  if (d.piutangBulanIni > 0 && d.omzet > 0 && d.piutangBulanIni / d.omzet > 0.3) insights.push(`⚠️ ${Math.round(d.piutangBulanIni / d.omzet * 100)}% omzet masih piutang. Rajin tagih lewat tab Piutang!`);
  if (d.kontaminasiBulanIni > 0) insights.push(`🦠 Kontaminasi bulan ini: <strong>${d.kontaminasiBulanIni} baglog</strong>. Cek sterilisasi & kebersihan kumbung.`);
  if (kat.length === 0 && d.omzet > 0) insights.push(`💡 Belum ada pengeluaran tercatat bulan ini — catat semua biaya agar laba/rugi & HPP akurat.`);
  if (!insights.length) insights.push('Belum cukup data untuk analisis. Mulai catat panen, penjualan, dan pengeluaran.');
  document.getElementById('laporan-insight').innerHTML = insights.map((i) => `<li class="bg-washi rounded-lg px-4 py-2.5">${i}</li>`).join('');
}

document.getElementById('laporan-muat')?.addEventListener('click', loadLaporan);

// ---------- Pengaturan Web ----------
async function loadPengaturan() {
  const { pengaturan } = await api('/api/admin/pengaturan');
  document.getElementById('cfg-wa').value = pengaturan.wa_nomor || '';
  document.getElementById('cfg-alamat').value = pengaturan.alamat || '';
  document.getElementById('cfg-jam').value = pengaturan.jam_operasional || '';
  document.getElementById('cfg-target').value = pengaturan.target_kg_bulanan || '';
}

document.getElementById('form-pengaturan')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/pengaturan', { method: 'PUT', body: JSON.stringify({
      wa_nomor: document.getElementById('cfg-wa').value.trim().replace(/[^0-9]/g, ''),
      alamat: document.getElementById('cfg-alamat').value.trim(),
      jam_operasional: document.getElementById('cfg-jam').value.trim(),
      target_kg_bulanan: document.getElementById('cfg-target').value || '0'
    })});
    toast('Pengaturan tersimpan & langsung aktif di website ✅');
  } catch (ex) { toast(ex.message, false); }
});

// ---------- Log Aktivitas (owner) ----------
const AKSI_BADGE = { tambah: 'bg-green-100 text-green-700', ubah: 'bg-blue-100 text-blue-700', hapus: 'bg-red-100 text-red-700', login: 'bg-gray-100 text-gray-600', bayar: 'bg-yellow-100 text-yellow-700' };
async function loadAudit() {
  const { audit } = await api('/api/admin/audit');
  document.getElementById('table-audit').innerHTML = `
    <thead><tr><th>Waktu (UTC)</th><th>Pengguna</th><th>Aksi</th><th>Entitas</th><th>Detail</th></tr></thead>
    <tbody>${audit.map((a) => `
      <tr>
        <td class="whitespace-nowrap text-xs">${(a.created_at || '').replace('T', ' ').slice(0, 16)}</td>
        <td>${a.nama || '-'}</td>
        <td><span class="text-xs px-2 py-0.5 rounded-full ${AKSI_BADGE[a.aksi] || 'bg-gray-100'}">${a.aksi}</span></td>
        <td class="text-xs">${a.entitas}${a.entitas_id ? ' #' + a.entitas_id : ''}</td>
        <td class="text-xs text-gray-500">${a.detail || '-'}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="text-center text-gray-400 py-4">Belum ada aktivitas</td></tr>'}</tbody>`;
}

// Ekspor laporan keuangan CSV
document.getElementById('ekspor-keuangan')?.addEventListener('click', () => {
  const bulan = document.getElementById('laporan-bulan')?.value || '';
  window.open('/api/admin/ekspor/keuangan' + (bulan ? '?bulan=' + bulan : ''), '_blank');
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
    <thead><tr><th>Nama</th><th>Harga</th><th>Satuan</th><th>Berat/Unit</th><th>Badge</th><th>Status</th><th></th></tr></thead>
    <tbody>${produk.map((p) => `
      <tr class="${p.aktif ? '' : 'opacity-50'}">
        <td>${p.nama}<br><span class="text-xs text-gray-400">${p.jp || ''}</span></td>
        <td class="font-semibold">${rupiah(p.harga)}</td><td>${p.satuan}</td>
        <td>${p.berat_kg > 0 ? p.berat_kg + ' kg' : '<span class="text-gray-400 text-xs">olahan/0</span>'}</td>
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
  bukaModal('modal-produk');
  document.getElementById('produk-id').value = p.id;
  document.getElementById('produk-nama').value = p.nama;
  document.getElementById('produk-jp').value = p.jp || '';
  document.getElementById('produk-harga').value = p.harga;
  document.getElementById('produk-satuan').value = p.satuan;
  document.getElementById('produk-berat').value = p.berat_kg || 0;
  document.getElementById('produk-deskripsi').value = p.deskripsi || '';
  document.getElementById('produk-badge').value = p.badge || '';
  document.getElementById('produk-form-title').innerHTML = '<i class="fas fa-pen text-blue-500 mr-2"></i>Ubah Produk';
  document.getElementById('produk-batal').classList.remove('hidden');
};

document.getElementById('produk-batal').addEventListener('click', () => {
  resetFormProduk();
  tutupModal('modal-produk');
});
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
    berat_kg: parseFloat(document.getElementById('produk-berat').value) || 0,
    deskripsi: document.getElementById('produk-deskripsi').value.trim(),
    badge: document.getElementById('produk-badge').value.trim() || null,
    aktif: 1
  };
  try {
    if (id) await api('/api/admin/produk/' + id, { method: 'PUT', body: JSON.stringify(body) });
    else await api('/api/admin/produk', { method: 'POST', body: JSON.stringify(body) });
    toast(id ? 'Produk diperbarui ✅' : 'Produk ditambahkan ✅');
    tutupModal('modal-produk');
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
    tutupModal('modal-user');
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
