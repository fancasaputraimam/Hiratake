// ===== Dashboard Hiratake =====
let ME = null;
let PRODUK_CACHE = [];
// Apakah gateway WhatsApp siap? (menentukan tombol kirim otomatis tampil)
let WA_SIAP = false;

const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
// Tanggal hari ini dalam WIB (zona Jawa Barat) — bukan UTC, agar tidak meleset setelah jam 7 malam
const hariIni = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const tglID = (t) => t ? new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

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
    const loaders = { dashboard: loadRingkasan, baglog: loadBaglog, panen: loadPanen, penjualan: loadPenjualan, pesanan: loadPesanan, stok: loadStok, piutang: loadPiutang, pelanggan: loadPelanggan, keuangan: loadKeuangan, laporan: loadLaporan, produk: loadProduk, pengguna: loadUsers, pengaturan: loadPengaturan, aktivitas: loadAudit, absensi: loadAbsensi, gaji: loadGaji, situs: loadSitus, whatsapp: loadWhatsApp, pembayaran: loadPembayaran, otomatis: loadOtomatis };
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
    const totalNotif = (n.piutangTelat.jumlah > 0 ? 1 : 0) + (n.piutangDekat > 0 ? 1 : 0) + (n.pesananWebBaru > 0 ? 1 : 0) + (n.batchTua.length > 0 ? 1 : 0) + (n.bayarMenunggu > 0 ? 1 : 0);
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
    WA_SIAP = !!n.waAktif;
    // Badge WhatsApp: jumlah pesan gagal kirim 2 hari terakhir
    const bw = document.getElementById('badge-wa');
    if (bw) {
      bw.textContent = n.waGagal || 0;
      bw.classList.toggle('hidden', !n.waGagal);
    }

    // Badge Pembayaran: transaksi yang masih menunggu dibayar
    const bb = document.getElementById('badge-bayar');
    if (bb) {
      bb.textContent = n.bayarMenunggu || 0;
      bb.classList.toggle('hidden', !n.bayarMenunggu);
    }

    // Isi panel notifikasi
    const item = [];
    if (n.piutangTelat.jumlah > 0) item.push({ ikon: 'fa-triangle-exclamation text-red-500', teks: `<strong>${n.piutangTelat.jumlah} piutang TERLAMBAT</strong> senilai ${rupiah(n.piutangTelat.total)}`, tab: 'piutang' });
    if (n.piutangDekat > 0) item.push({ ikon: 'fa-clock text-orange-500', teks: `${n.piutangDekat} piutang jatuh tempo ≤ 3 hari lagi`, tab: 'piutang' });
    if (n.pesananWebBaru > 0) item.push({ ikon: 'fa-globe text-kin', teks: `<strong>${n.pesananWebBaru} pesanan baru dari website</strong> menunggu diproses`, tab: 'pesanan' });
    n.batchTua.forEach((b) => item.push({ ikon: 'fa-hourglass-end text-matcha', teks: `Batch <strong>${b.kode}</strong> sudah ${b.umur_hari} hari — siapkan baglog pengganti`, tab: 'baglog' }));
    if (n.waGagal > 0) item.push({ ikon: 'fa-triangle-exclamation text-red-500', teks: `<strong>${n.waGagal} pesan WhatsApp gagal terkirim</strong> — periksa gateway`, tab: 'whatsapp' });
    if (n.bayarMenunggu > 0) item.push({ ikon: 'fa-hourglass-half text-kin', teks: `<strong>${n.bayarMenunggu} pembayaran menunggu</strong> — verifikasi bila dana sudah masuk`, tab: 'pembayaran' });
    if (n.bayarHariIni > 0) item.push({ ikon: 'fa-money-bill-wave text-green-600', teks: `Pembayaran masuk hari ini: <strong>${rupiah(n.bayarHariIni)}</strong>`, tab: 'pembayaran' });
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
        <td>${p.tanggal}${p.catatan ? `<br><span class="text-xs text-gray-400">${escHtml(p.catatan)}</span>` : ''}</td>
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
        <td>${j.tanggal}</td><td>${escHtml(j.nama_produk)}</td><td>${j.jumlah}</td>
        <td class="font-semibold" style="color:#C73E3A">${rupiah(j.total)}</td>
        <td>${escHtml(j.pelanggan_nama || j.pembeli || '-')}</td>
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
        <td class="font-mono text-xs font-semibold">${ps.kode}${ps.sumber === 'web' ? ' <span class="text-[10px] bg-kin/15 text-kin px-1.5 py-0.5 rounded-full font-sans">WEB</span>' : ''}${ps.catatan ? `<br><span class="text-gray-400 font-sans">${escHtml(ps.catatan)}</span>` : ''}</td>
        <td>${escHtml(ps.pelanggan_nama || '-')}</td>
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
      <tr><td>${escHtml(it.nama_produk)}</td><td>${it.jumlah}</td><td>${rupiah(it.harga)}</td><td class="font-semibold">${rupiah(it.subtotal)}</td></tr>`).join('')}
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
        <td>${escHtml(p.pelanggan_nama || p.pembeli || '-')}</td>
        <td>${p.nama_produk} ×${p.jumlah}<br><span class="text-xs text-gray-400">nota ${p.tanggal}</span></td>
        <td class="font-semibold">${rupiah(p.total)}</td>
        <td class="text-green-700">${p.terbayar ? rupiah(p.terbayar) : '-'}</td>
        <td class="font-semibold" style="color:#C73E3A">${rupiah(sisa)}</td>
        <td>${p.terlambat ? '<span class="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">TERLAMBAT</span>' : '<span class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">berjalan</span>'}</td>
        <td class="whitespace-nowrap">
          ${p.pelanggan_wa ? `<a href="https://wa.me/${p.pelanggan_wa}?text=${encodeURIComponent('Halo, mengingatkan pembayaran ' + p.nama_produk + ' sisa ' + rupiah(sisa) + ' jatuh tempo ' + p.jatuh_tempo + '. Terima kasih 🙏 — Hiratake')}" target="_blank" class="text-green-600 mr-2" title="Buka WhatsApp (kirim manual)"><i class="fab fa-whatsapp"></i></a>` : ''}
          ${p.pelanggan_wa && boleh && WA_SIAP ? `<button onclick="tagihWa(${p.id})" class="text-green-700 hover:text-green-900 mr-2" title="Kirim tagihan otomatis via gateway"><i class="fas fa-paper-plane"></i></button>` : ''}
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
        <td>${escHtml(p.nama)}${p.alamat ? `<br><span class="text-xs text-gray-400">${escHtml(p.alamat)}</span>` : ''}</td>
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

  loadTren();
  loadKalkulator();
}

document.getElementById('laporan-muat')?.addEventListener('click', loadLaporan);

// ---------- Tren antar-bulan ----------
let chartTrenUang, chartTrenPanen;
async function loadTren() {
  const rentang = document.getElementById('tren-rentang')?.value || '12';
  const { data } = await api('/api/admin/tren?bulan=' + rentang);
  const NAMA_BLN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const label = data.map((r) => { const [t, b] = r.bulan.split('-'); return NAMA_BLN[+b - 1] + " '" + t.slice(2); });

  chartTrenUang?.destroy();
  chartTrenUang = new Chart(document.getElementById('chart-tren-uang'), {
    type: 'bar',
    data: {
      labels: label,
      datasets: [
        { label: 'Omzet', data: data.map((r) => r.omzet), backgroundColor: '#7A845066', borderColor: '#7A8450', borderWidth: 1 },
        { label: 'Pengeluaran', data: data.map((r) => r.pengeluaran), backgroundColor: '#C73E3A55', borderColor: '#C73E3A', borderWidth: 1 },
        { type: 'line', label: 'Laba/Rugi', data: data.map((r) => r.laba), borderColor: '#C9A227', backgroundColor: '#C9A227', tension: 0.3, borderWidth: 2.5, pointRadius: 3 }
      ]
    },
    options: {
      plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + rupiah(ctx.raw) } } },
      scales: { y: { ticks: { callback: (v) => (Math.abs(v) >= 1000000 ? (v / 1000000) + ' jt' : (v / 1000) + ' rb') } } }
    }
  });

  chartTrenPanen?.destroy();
  chartTrenPanen = new Chart(document.getElementById('chart-tren-panen'), {
    type: 'line',
    data: {
      labels: label,
      datasets: [
        { label: 'Panen (kg)', data: data.map((r) => r.panenKg), borderColor: '#7A8450', backgroundColor: '#7A845022', fill: true, tension: 0.3, yAxisID: 'y' },
        { label: 'HPP per kg (Rp)', data: data.map((r) => r.hppPerKg), borderColor: '#C73E3A', borderDash: [6, 3], tension: 0.3, yAxisID: 'y1' }
      ]
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y: { position: 'left', title: { display: true, text: 'kg' } },
        y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: (v) => (v >= 1000 ? (v / 1000) + ' rb' : v) }, title: { display: true, text: 'Rp/kg' } }
      }
    }
  });
}
document.getElementById('tren-rentang')?.addEventListener('change', loadTren);

// ---------- Kalkulator Harga Jual ----------
async function loadKalkulator() {
  const margin = parseFloat(document.getElementById('kalk-margin')?.value) || 15;
  const d = await api('/api/admin/kalkulator-harga?margin=' + margin);
  const kosong = document.getElementById('kalk-kosong');
  const tabel = document.getElementById('table-kalkulator');
  const ringkas = document.getElementById('kalk-ringkas');

  if (!d.hppPerKg) {
    kosong.classList.remove('hidden');
    ringkas.innerHTML = '';
    tabel.innerHTML = '';
    return;
  }
  kosong.classList.add('hidden');

  ringkas.innerHTML = `
    <div class="stat-card"><i class="fas fa-coins text-kin"></i><p class="stat-val">${rupiah(d.hppPerKg)}</p><p class="stat-label">HPP per kg (rata ${d.dasarBulan.length} bln: ${d.dasarBulan.slice().reverse().join(', ')})</p></div>
    <div class="stat-card"><i class="fas fa-wheat-awn text-matcha"></i><p class="stat-val">${d.totalKg} kg</p><p class="stat-label">Total panen dasar hitung</p></div>
    <div class="stat-card"><i class="fas fa-percent text-vermillion"></i><p class="stat-val">${d.marginPersen}%</p><p class="stat-label">Margin target</p></div>
    <div class="stat-card"><i class="fas fa-tag" style="color:#7A8450"></i><p class="stat-val">${rupiah(d.hargaJualPerKg)}</p><p class="stat-label">Harga jual ideal per kg</p></div>`;

  const bisaUbah = ['owner', 'admin'].includes(ME.role);
  tabel.innerHTML = `
    <thead><tr><th>Produk</th><th class="text-right">Modal/unit</th><th class="text-right">Harga sekarang</th><th class="text-right">Margin sekarang</th><th class="text-right">Rekomendasi (+${d.marginPersen}%)</th><th class="text-right">Selisih</th>${bisaUbah ? '<th></th>' : ''}</tr></thead>
    <tbody>${d.rekomendasi.map((p) => {
      if (p.modalPerUnit == null) return `<tr class="border-b border-gray-100 text-sumi/40"><td class="py-2">${p.nama}</td><td colspan="${bisaUbah ? 6 : 5}" class="py-2 text-xs italic">bukan jamur segar per-kg — hitung modal manual</td></tr>`;
      const naik = p.selisih > 0;
      const marginCls = p.marginSaatIniPersen < 0 ? 'text-red-600 font-bold' : p.marginSaatIniPersen < d.marginPersen ? 'text-orange-600' : 'text-green-700';
      return `<tr class="border-b border-gray-100">
        <td class="py-2">${p.nama}<span class="text-xs text-sumi/40 block">${p.beratKg} kg/${p.satuan}</span></td>
        <td class="py-2 text-right">${rupiah(p.modalPerUnit)}</td>
        <td class="py-2 text-right">${rupiah(p.hargaSaatIni)}</td>
        <td class="py-2 text-right ${marginCls}">${p.marginSaatIniPersen}%</td>
        <td class="py-2 text-right font-bold" style="color:#7A8450">${rupiah(p.hargaRekomendasi)}</td>
        <td class="py-2 text-right ${naik ? 'text-red-600' : 'text-green-700'}">${naik ? '+' : ''}${rupiah(p.selisih)}</td>
        ${bisaUbah ? `<td class="py-2 text-right">${p.selisih !== 0 ? `<button onclick="terapkanHarga(${p.id}, ${p.hargaRekomendasi}, '${p.nama.replace(/'/g, "\\'")}')" class="text-xs bg-sumi text-washi px-3 py-1 rounded-full hover:bg-black transition">Terapkan</button>` : '<span class="text-xs text-green-700">✓ pas</span>'}</td>` : ''}
      </tr>`;
    }).join('')}</tbody>`;
}
document.getElementById('kalk-hitung')?.addEventListener('click', loadKalkulator);
document.getElementById('kalk-margin')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loadKalkulator(); } });

window.terapkanHarga = async (id, harga, nama) => {
  if (!confirm(`Ubah harga "${nama}" menjadi ${rupiah(harga)}?\nHarga di website depan ikut berubah.`)) return;
  try {
    await api('/api/admin/produk/' + id + '/harga', { method: 'PUT', body: JSON.stringify({ harga }) });
    toast('Harga diperbarui');
    loadKalkulator();
  } catch (ex) { toast(ex.message, false); }
};

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
    <thead><tr><th>Waktu (WIB)</th><th>Pengguna</th><th>Aksi</th><th>Entitas</th><th>Detail</th></tr></thead>
    <tbody>${audit.map((a) => `
      <tr>
        <td class="whitespace-nowrap text-xs">${a.created_at ? new Date(a.created_at.replace(' ', 'T') + 'Z').toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : '-'}</td>
        <td>${escHtml(a.nama || '-')}</td>
        <td><span class="text-xs px-2 py-0.5 rounded-full ${AKSI_BADGE[a.aksi] || 'bg-gray-100'}">${a.aksi}</span></td>
        <td class="text-xs">${a.entitas}${a.entitas_id ? ' #' + escHtml(a.entitas_id) : ''}</td>
        <td class="text-xs text-gray-500">${escHtml(a.detail || '-')}</td>
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
    <thead><tr><th>Username</th><th>Nama</th><th>Peran</th><th>WhatsApp</th><th>Status</th><th></th></tr></thead>
    <tbody>${users.map((u) => `
      <tr class="${u.aktif ? '' : 'opacity-50'}">
        <td class="font-mono">${u.username}</td><td>${u.nama}</td>
        <td><span class="text-xs px-2 py-0.5 rounded-full ${roleBadge[u.role]}">${u.role}</span></td>
        <td class="text-xs whitespace-nowrap">${u.wa
            ? `<span class="font-mono">${u.wa}</span>`
            : '<span class="text-sumi/30">belum diisi</span>'}</td>
        <td>${u.aktif ? '<span class="text-green-600 text-xs font-semibold">Aktif</span>' : '<span class="text-gray-400 text-xs">Nonaktif</span>'}</td>
        <td class="whitespace-nowrap">
          <button onclick="setWaUser(${u.id}, '${u.nama.replace(/'/g, '')}', '${u.wa || ''}')" class="text-green-600 hover:text-green-800 mr-2" title="Atur nomor WhatsApp"><i class="fab fa-whatsapp"></i></button>
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

// ---------- Absensi (selfie + GPS, anti-kecurangan) ----------
let ABSEN_CFG = null;

async function loadAbsensi() {
  // Status saya hari ini + konfigurasi ketat
  const [saya, cfg] = await Promise.all([api('/api/admin/absensi/saya'), api('/api/admin/absensi/config')]);
  ABSEN_CFG = cfg;
  document.getElementById('absen-tanggal').textContent = tglID(saya.tanggal);
  const h = saya.hariIni;
  const stEl = document.getElementById('absen-status-saya');
  const btnMasuk = document.getElementById('btn-absen-masuk');
  const btnPulang = document.getElementById('btn-absen-pulang');
  if (!h || !h.jam_masuk) {
    stEl.innerHTML = '<span class="text-sumi/40">Belum absen masuk</span>';
    btnMasuk.disabled = false; btnMasuk.classList.remove('opacity-40');
    btnPulang.disabled = true; btnPulang.classList.add('opacity-40');
  } else if (!h.jam_pulang) {
    stEl.innerHTML = `<span class="text-matcha">Masuk ${h.jam_masuk}</span>${h.terlambat_menit > 0 ? ` <span class="text-red-600 text-sm">(telat ${h.terlambat_menit} mnt)</span>` : ''} — sedang bekerja`;
    btnMasuk.disabled = true; btnMasuk.classList.add('opacity-40');
    btnPulang.disabled = false; btnPulang.classList.remove('opacity-40');
  } else {
    stEl.innerHTML = `<span class="text-matcha">✓ ${h.jam_masuk} — ${h.jam_pulang}</span>`;
    btnMasuk.disabled = true; btnMasuk.classList.add('opacity-40');
    btnPulang.disabled = true; btnPulang.classList.add('opacity-40');
  }
  document.getElementById('absen-jam-kerja').textContent = `Jam kerja: ${cfg.jamMasuk} – ${cfg.jamPulang} WIB (toleransi ${cfg.toleransiTelat} mnt) · Jam server: ${cfg.serverJam}`;
  const syarat = [];
  if (cfg.wajibSelfie) syarat.push('📸 selfie kamera');
  if (cfg.wajibLokasi) syarat.push(`📍 GPS radius ${cfg.radiusM} m`);
  document.getElementById('absen-syarat').textContent = syarat.length ? 'Wajib: ' + syarat.join(' + ') : '';

  // Rekap + riwayat
  const fb = document.getElementById('absen-filter-bulan');
  if (!fb.value) fb.value = hariIni().slice(0, 7);
  const d = await api('/api/admin/absensi?bulan=' + fb.value);
  const BADGE_ST = { hadir: 'bg-green-100 text-green-700', izin: 'bg-blue-100 text-blue-700', sakit: 'bg-orange-100 text-orange-700', libur: 'bg-gray-100 text-gray-600', alpa: 'bg-red-100 text-red-700' };

  document.getElementById('table-rekap-absen').innerHTML = `
    <thead><tr><th>Nama</th><th class="text-center">Hadir</th><th class="text-center">Izin</th><th class="text-center">Sakit</th><th class="text-center">Alpa</th></tr></thead>
    <tbody>${d.rekap.map((r) => `<tr class="border-b border-gray-100">
      <td class="py-2">${escHtml(r.nama)}<span class="text-xs text-sumi/40 block capitalize">${r.role}</span></td>
      <td class="py-2 text-center font-bold text-matcha">${r.hadir || 0}</td>
      <td class="py-2 text-center">${r.izin || 0}</td>
      <td class="py-2 text-center">${r.sakit || 0}</td>
      <td class="py-2 text-center ${r.alpa > 0 ? 'text-red-600 font-bold' : ''}">${r.alpa || 0}</td>
    </tr>`).join('') || '<tr><td colspan="5" class="py-6 text-center text-sumi/40">Belum ada data</td></tr>'}</tbody>`;

  const fotoBtn = (a, jenis, ada) => ada
    ? `<button onclick="lihatBukti(${a.id},'${jenis}')" class="text-vermillion hover:underline" title="Lihat selfie ${jenis}"><i class="fas fa-image"></i></button>`
    : '';
  document.getElementById('table-absensi').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Nama</th><th>Masuk</th><th>Pulang</th><th>Status</th><th>Bukti</th><th>Catatan</th></tr></thead>
    <tbody>${d.absensi.map((a) => `<tr class="border-b border-gray-100">
      <td class="py-2 whitespace-nowrap">${tglID(a.tanggal)}</td>
      <td class="py-2">${escHtml(a.nama)}</td>
      <td class="py-2 whitespace-nowrap">${a.jam_masuk || '—'}${a.terlambat_menit > 0 ? ` <span class="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">telat ${a.terlambat_menit}m</span>` : ''}</td>
      <td class="py-2 whitespace-nowrap">${a.jam_pulang || '—'}${a.pulang_cepat_menit > 0 ? ` <span class="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">cepat ${a.pulang_cepat_menit}m</span>` : ''}</td>
      <td class="py-2"><span class="text-xs px-2 py-0.5 rounded-full ${BADGE_ST[a.status] || ''}">${a.status}</span></td>
      <td class="py-2 space-x-2">${fotoBtn(a, 'masuk', a.ada_foto_masuk)}${fotoBtn(a, 'pulang', a.ada_foto_pulang)}${a.jarak_masuk_m != null ? `<span class="text-[10px] text-sumi/40" title="Jarak dari kumbung saat absen masuk">${a.jarak_masuk_m}m</span>` : ''}</td>
      <td class="py-2 text-xs text-sumi/50">${escHtml(a.catatan || '')}</td>
    </tr>`).join('') || '<tr><td colspan="7" class="py-6 text-center text-sumi/40">Belum ada absensi bulan ini</td></tr>'}</tbody>`;

  // Isi dropdown koreksi (owner/admin)
  try {
    if (['owner', 'admin'].includes(ME.role)) {
      const { users } = await api('/api/admin/users');
      document.getElementById('koreksi-user').innerHTML = users.filter((u) => u.aktif).map((u) => `<option value="${u.id}">${escHtml(u.nama)} (${u.role})</option>`).join('');
    }
  } catch (e) { /* karyawan tidak punya akses users — abaikan */ }
}

window.lihatBukti = (absensiId, jenis) => {
  document.getElementById('absen-bukti-img').src = `/api/admin/absensi/foto/${absensiId}/${jenis}?t=${Date.now()}`;
  bukaModal('modal-absen-bukti');
};

// --- Alur kamera selfie absen ---
let ABSEN_JENIS = null;      // 'masuk' | 'pulang'
let ABSEN_STREAM = null;
let ABSEN_POSISI = null;     // { lat, lng, akurasi }
let ABSEN_FOTO = null;       // data URL hasil jepret + watermark

function tutupKameraAbsen() {
  if (ABSEN_STREAM) { ABSEN_STREAM.getTracks().forEach((t) => t.stop()); ABSEN_STREAM = null; }
  ABSEN_FOTO = null;
}

async function mulaiAbsen(jenis) {
  ABSEN_JENIS = jenis;
  ABSEN_FOTO = null; ABSEN_POSISI = null;
  document.getElementById('absen-kamera-judul').textContent = jenis === 'masuk' ? 'Absen Masuk' : 'Absen Pulang';
  const video = document.getElementById('absen-video');
  const canvas = document.getElementById('absen-canvas');
  const overlay = document.getElementById('absen-kamera-overlay');
  const infoLok = document.getElementById('absen-info-lokasi');
  const btnJepret = document.getElementById('btn-absen-jepret');
  const btnUlang = document.getElementById('btn-absen-ulang');
  const btnKirim = document.getElementById('btn-absen-kirim');
  video.classList.remove('hidden'); canvas.classList.add('hidden');
  btnJepret.classList.remove('hidden'); btnJepret.disabled = true;
  btnUlang.classList.add('hidden'); btnKirim.classList.add('hidden');
  overlay.classList.remove('hidden'); overlay.textContent = 'Menyalakan kamera…';
  infoLok.textContent = '';
  bukaModal('modal-absen-kamera');

  // Tanpa selfie wajib & kamera gagal → tetap bisa lanjut (fallback diatur server)
  const wajibSelfie = ABSEN_CFG?.wajibSelfie !== false;
  const wajibLokasi = ABSEN_CFG?.wajibLokasi === true;

  // 1. Kamera depan
  try {
    ABSEN_STREAM = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }, audio: false
    });
    video.srcObject = ABSEN_STREAM;
    await video.play().catch(() => {});
    overlay.classList.add('hidden');
    btnJepret.disabled = false;
  } catch (e) {
    if (wajibSelfie) {
      overlay.textContent = 'Kamera tidak bisa diakses. Izinkan kamera di browser lalu buka ulang. (Selfie wajib untuk absen)';
      return;
    }
    overlay.textContent = 'Kamera tidak tersedia — absen tanpa selfie.';
    btnJepret.classList.add('hidden');
    btnKirim.classList.remove('hidden');
  }

  // 2. Lokasi GPS (paralel)
  if (navigator.geolocation) {
    infoLok.innerHTML = '<i class="fas fa-location-crosshairs fa-spin mr-1"></i>Mencari lokasi GPS…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        ABSEN_POSISI = { lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: Math.round(pos.coords.accuracy || 0) };
        let jarakTxt = '';
        if (ABSEN_CFG?.lokasiKumbung) {
          const j = jarakHaversine(ABSEN_POSISI.lat, ABSEN_POSISI.lng, ABSEN_CFG.lokasiKumbung.lat, ABSEN_CFG.lokasiKumbung.lng);
          const ok = j <= ABSEN_CFG.radiusM + Math.min(ABSEN_POSISI.akurasi, 100);
          jarakTxt = ` · Jarak kumbung: <strong class="${ok ? 'text-matcha' : 'text-red-600'}">${j} m</strong>${ok ? ' ✓' : ` (maks ${ABSEN_CFG.radiusM} m ✗)`}`;
        }
        infoLok.innerHTML = `<i class="fas fa-location-dot text-matcha mr-1"></i>GPS aktif (±${ABSEN_POSISI.akurasi} m)${jarakTxt}`;
      },
      () => {
        infoLok.innerHTML = wajibLokasi
          ? '<i class="fas fa-triangle-exclamation text-red-600 mr-1"></i>GPS gagal — lokasi WAJIB. Aktifkan izin lokasi lalu coba lagi.'
          : '<i class="fas fa-location-dot text-sumi/40 mr-1"></i>GPS tidak aktif (opsional).';
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  } else if (wajibLokasi) {
    infoLok.innerHTML = '<i class="fas fa-triangle-exclamation text-red-600 mr-1"></i>Perangkat tidak mendukung GPS — hubungi admin.';
  }
}

function jarakHaversine(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Jepret: gambar video ke canvas + BAKAR watermark (nama, waktu server WIB, koordinat, jarak)
document.getElementById('btn-absen-jepret')?.addEventListener('click', async () => {
  const video = document.getElementById('absen-video');
  const canvas = document.getElementById('absen-canvas');
  if (!video.videoWidth) { toast('Kamera belum siap.', false); return; }

  // Ambil waktu server TERBARU saat jepret (bukan waktu buka modal)
  let waktu = ABSEN_CFG ? `${ABSEN_CFG.serverTanggal} ${ABSEN_CFG.serverJam}` : '';
  try { const c2 = await api('/api/admin/absensi/config'); ABSEN_CFG = c2; waktu = `${c2.serverTanggal} ${c2.serverJam}`; } catch (e) {}

  const W = 720, H = Math.round((video.videoHeight / video.videoWidth) * 720) || 960;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  // Mirror agar sesuai preview
  ctx.translate(W, 0); ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, W, H);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // --- Watermark terbakar (tidak bisa dihapus dari file) ---
  const baris = [
    `${ABSEN_CFG?.namaSitus || 'HIRATAKE'} — ABSEN ${ABSEN_JENIS.toUpperCase()}`,
    `${ME?.nama || ''} (${ME?.role || ''})`,
    `${waktu} WIB (jam server)`,
  ];
  if (ABSEN_POSISI) {
    baris.push(`GPS: ${ABSEN_POSISI.lat.toFixed(6)}, ${ABSEN_POSISI.lng.toFixed(6)} (±${ABSEN_POSISI.akurasi}m)`);
    if (ABSEN_CFG?.lokasiKumbung) {
      baris.push(`Jarak kumbung: ${jarakHaversine(ABSEN_POSISI.lat, ABSEN_POSISI.lng, ABSEN_CFG.lokasiKumbung.lat, ABSEN_CFG.lokasiKumbung.lng)} m`);
    }
  } else {
    baris.push('GPS: tidak tersedia');
  }
  const padY = 10, lineH = 22, boxH = baris.length * lineH + padY * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, H - boxH, W, boxH);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  baris.forEach((t, i) => {
    if (i === 0) { ctx.fillStyle = '#FFD166'; } else { ctx.fillStyle = '#fff'; ctx.font = '14px system-ui, sans-serif'; }
    ctx.fillText(t, 12, H - boxH + padY + (i + 1) * lineH - 6);
  });
  // Garis merah tipis khas — penanda keaslian aplikasi
  ctx.fillStyle = '#C73E3A'; ctx.fillRect(0, H - boxH - 3, W, 3);

  ABSEN_FOTO = canvas.toDataURL('image/jpeg', 0.72);
  // Kompres ulang bila > 400 KB
  if (ABSEN_FOTO.length > 550000) ABSEN_FOTO = canvas.toDataURL('image/jpeg', 0.55);

  document.getElementById('absen-video').classList.add('hidden');
  canvas.classList.remove('hidden');
  document.getElementById('btn-absen-jepret').classList.add('hidden');
  document.getElementById('btn-absen-ulang').classList.remove('hidden');
  document.getElementById('btn-absen-kirim').classList.remove('hidden');
});

document.getElementById('btn-absen-ulang')?.addEventListener('click', () => {
  ABSEN_FOTO = null;
  document.getElementById('absen-video').classList.remove('hidden');
  document.getElementById('absen-canvas').classList.add('hidden');
  document.getElementById('btn-absen-jepret').classList.remove('hidden');
  document.getElementById('btn-absen-ulang').classList.add('hidden');
  document.getElementById('btn-absen-kirim').classList.add('hidden');
});

document.getElementById('btn-absen-kirim')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-absen-kirim');
  btn.disabled = true;
  try {
    const body = {
      foto: ABSEN_FOTO || undefined,
      lat: ABSEN_POSISI?.lat, lng: ABSEN_POSISI?.lng, akurasi: ABSEN_POSISI?.akurasi
    };
    const r = await api(`/api/admin/absensi/${ABSEN_JENIS}`, { method: 'POST', body: JSON.stringify(body) });
    if (ABSEN_JENIS === 'masuk') {
      toast(`Absen masuk ${r.jam} ✓${r.telat > 0 ? ` (telat ${r.telat} menit)` : ' Tepat waktu!'}`);
    } else {
      toast(`Absen pulang ${r.jam} ✓ Selamat istirahat!`);
    }
    tutupKameraAbsen(); tutupModal('modal-absen-kamera'); loadAbsensi();
  } catch (ex) { toast(ex.message, false); }
  finally { btn.disabled = false; }
});

// Matikan kamera saat modal ditutup dengan cara apapun
document.querySelectorAll('[data-close="modal-absen-kamera"]').forEach((b) => b.addEventListener('click', tutupKameraAbsen));
document.getElementById('modal-absen-kamera')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) tutupKameraAbsen(); });

document.getElementById('btn-absen-masuk')?.addEventListener('click', () => mulaiAbsen('masuk'));
document.getElementById('btn-absen-pulang')?.addEventListener('click', () => mulaiAbsen('pulang'));
document.getElementById('absen-filter-bulan')?.addEventListener('change', loadAbsensi);

document.getElementById('form-koreksi-absen')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/absensi/koreksi', { method: 'PUT', body: JSON.stringify({
      user_id: parseInt(document.getElementById('koreksi-user').value),
      tanggal: document.getElementById('koreksi-tanggal').value,
      status: document.getElementById('koreksi-status').value,
      jam_masuk: document.getElementById('koreksi-masuk').value || null,
      jam_pulang: document.getElementById('koreksi-pulang').value || null,
      catatan: document.getElementById('koreksi-catatan').value
    })});
    toast('Absensi dikoreksi ✓'); tutupModal('modal-koreksi-absen');
    document.getElementById('form-koreksi-absen').reset(); loadAbsensi();
  } catch (ex) { toast(ex.message, false); }
});

// ---------- Gaji (owner) ----------
let GAJI_CACHE = [];
async function loadGaji() {
  const inp = document.getElementById('gaji-periode');
  if (!inp.value) inp.value = hariIni().slice(0, 7);
  const d = await api('/api/admin/gaji?periode=' + inp.value);
  GAJI_CACHE = d.gaji;
  document.getElementById('table-gaji').innerHTML = `
    <thead><tr><th>Nama</th><th class="text-right">Upah/hari</th><th class="text-center">Hadir</th><th class="text-right">Gaji Pokok</th><th class="text-right">Dibayar</th><th>Status</th><th class="text-right">Aksi</th></tr></thead>
    <tbody>${d.gaji.map((g) => {
      const pokok = (g.hadir || 0) * (g.upah_harian || 0);
      const sudah = !!g.gaji_id;
      return `<tr class="border-b border-gray-100 ${sudah ? 'bg-green-50/50' : ''}">
        <td class="py-2">${g.nama}<span class="text-xs text-sumi/40 block capitalize">${g.role}</span></td>
        <td class="py-2 text-right">${g.upah_harian ? rupiah(g.upah_harian) : '<span class="text-red-500 text-xs">belum diatur</span>'}</td>
        <td class="py-2 text-center font-bold">${g.hadir || 0}</td>
        <td class="py-2 text-right">${rupiah(pokok)}</td>
        <td class="py-2 text-right">${sudah ? `<strong>${rupiah(g.total)}</strong><span class="text-xs text-sumi/40 block">${tglID(g.tanggal_bayar)}${g.bonus ? ` · bonus ${rupiah(g.bonus)}` : ''}${g.potongan ? ` · pot ${rupiah(g.potongan)}` : ''}</span>` : '—'}</td>
        <td class="py-2">${sudah ? '<span class="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Dibayar</span>' : '<span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Belum</span>'}</td>
        <td class="py-2 text-right whitespace-nowrap">
          <button onclick="bukaUpah(${g.user_id})" class="text-xs border border-kin text-kin hover:bg-kin hover:text-white px-2.5 py-1 rounded-full transition mr-1">Upah</button>
          ${sudah
            ? `<button onclick="batalGaji(${g.gaji_id}, '${g.nama.replace(/'/g, "\\'")}')" class="text-xs border border-red-300 text-red-500 hover:bg-red-500 hover:text-white px-2.5 py-1 rounded-full transition">Batalkan</button>`
            : `<button onclick="bukaBayarGaji(${g.user_id})" class="text-xs bg-vermillion text-white hover:bg-red-700 px-2.5 py-1 rounded-full transition">Bayar</button>`}
        </td>
      </tr>`;
    }).join('')}</tbody>`;
}
document.getElementById('gaji-muat')?.addEventListener('click', loadGaji);
document.getElementById('gaji-periode')?.addEventListener('change', loadGaji);

window.bukaUpah = (userId) => {
  const g = GAJI_CACHE.find((x) => x.user_id === userId); if (!g) return;
  document.getElementById('upah-user-id').value = userId;
  document.getElementById('upah-nama').textContent = g.nama;
  document.getElementById('upah-nilai').value = g.upah_harian || '';
  bukaModal('modal-upah');
};
document.getElementById('form-upah')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/users/' + document.getElementById('upah-user-id').value + '/upah', {
      method: 'PUT', body: JSON.stringify({ upah_harian: parseInt(document.getElementById('upah-nilai').value) })
    });
    toast('Upah harian disimpan ✓'); tutupModal('modal-upah'); loadGaji();
  } catch (ex) { toast(ex.message, false); }
});

window.bukaBayarGaji = (userId) => {
  const g = GAJI_CACHE.find((x) => x.user_id === userId); if (!g) return;
  if (!g.upah_harian) { toast('Atur upah harian dulu lewat tombol Upah', false); return; }
  const periode = document.getElementById('gaji-periode').value;
  document.getElementById('bayar-user-id').value = userId;
  document.getElementById('bayar-periode').value = periode;
  document.getElementById('bayar-nama').textContent = g.nama;
  document.getElementById('bayar-periode-label').textContent = periode;
  document.getElementById('bayar-hadir').textContent = g.hadir || 0;
  document.getElementById('bayar-upah').textContent = rupiah(g.upah_harian);
  document.getElementById('bayar-pokok').textContent = rupiah((g.hadir || 0) * g.upah_harian);
  document.getElementById('bayar-bonus').value = 0;
  document.getElementById('bayar-potongan').value = 0;
  document.getElementById('bayar-catatan').value = '';
  hitungTotalGaji();
  bukaModal('modal-bayar-gaji');
};
function hitungTotalGaji() {
  const g = GAJI_CACHE.find((x) => x.user_id === parseInt(document.getElementById('bayar-user-id').value)); if (!g) return;
  const total = (g.hadir || 0) * g.upah_harian + (parseInt(document.getElementById('bayar-bonus').value) || 0) - (parseInt(document.getElementById('bayar-potongan').value) || 0);
  document.getElementById('bayar-total').textContent = rupiah(total);
}
document.getElementById('bayar-bonus')?.addEventListener('input', hitungTotalGaji);
document.getElementById('bayar-potongan')?.addEventListener('input', hitungTotalGaji);

document.getElementById('form-bayar-gaji')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await api('/api/admin/gaji/bayar', { method: 'POST', body: JSON.stringify({
      user_id: parseInt(document.getElementById('bayar-user-id').value),
      periode: document.getElementById('bayar-periode').value,
      bonus: parseInt(document.getElementById('bayar-bonus').value) || 0,
      potongan: parseInt(document.getElementById('bayar-potongan').value) || 0,
      catatan: document.getElementById('bayar-catatan').value
    })});
    toast(`Gaji dibayar ${rupiah(r.total)} ✓ (tercatat di Keuangan)`); tutupModal('modal-bayar-gaji'); loadGaji();
  } catch (ex) { toast(ex.message, false); }
});

window.batalGaji = async (gajiId, nama) => {
  if (!confirm(`Batalkan pembayaran gaji ${nama}? Catatan pengeluaran di Keuangan juga ikut dihapus.`)) return;
  try { await api('/api/admin/gaji/' + gajiId, { method: 'DELETE' }); toast('Pembayaran gaji dibatalkan'); loadGaji(); }
  catch (ex) { toast(ex.message, false); }
};

// ---------- Pengaturan Situs (owner) ----------
async function loadSitus() {
  const { pengaturan: p } = await api('/api/admin/pengaturan');
  document.getElementById('situs-nama').value = p.situs_nama || 'Hiratake';
  document.getElementById('situs-nama-jp').value = p.situs_nama_jp || '平茸';
  document.getElementById('situs-tagline').value = p.situs_tagline || '';
  document.getElementById('situs-deskripsi').value = p.situs_deskripsi || '';
  const warna = /^#[0-9A-Fa-f]{6}$/.test(p.situs_warna || '') ? p.situs_warna : '#C73E3A';
  document.getElementById('situs-warna').value = warna;
  document.getElementById('situs-warna-kode').textContent = warna;
  document.getElementById('situs-pesanan-online').checked = p.situs_pesanan_online !== '0';
  document.getElementById('situs-jam-masuk').value = p.jam_kerja_masuk || '07:00';
  document.getElementById('situs-jam-pulang').value = p.jam_kerja_pulang || '16:00';
  // Absensi ketat
  document.getElementById('absen-cfg-selfie').checked = p.absen_wajib_selfie !== '0';
  document.getElementById('absen-cfg-lokasi').checked = p.absen_wajib_lokasi !== '0';
  document.getElementById('absen-cfg-auto-alpa').checked = p.absen_auto_alpa !== '0';
  document.getElementById('absen-cfg-lat').value = p.absen_lat || '';
  document.getElementById('absen-cfg-lng').value = p.absen_lng || '';
  document.getElementById('absen-cfg-radius').value = p.absen_radius_m || '150';
  document.getElementById('absen-cfg-toleransi').value = p.absen_toleransi_telat || '10';
  // Peta lokasi kumbung di landing page (Fase 10)
  document.getElementById('peta-lat').value = p.peta_lat || '';
  document.getElementById('peta-lng').value = p.peta_lng || '';
  document.getElementById('peta-zoom').value = p.peta_zoom || '16';
  loadSitusMedia();
  loadBackupRingkasan();
  loadTestimoni();
}

// ---------- Peta: bantuan isi koordinat ----------
document.getElementById('btn-peta-gps')?.addEventListener('click', () => {
  if (!navigator.geolocation) return toast('Perangkat tidak mendukung GPS', false);
  toast('Mengambil lokasi…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      document.getElementById('peta-lat').value = pos.coords.latitude.toFixed(6);
      document.getElementById('peta-lng').value = pos.coords.longitude.toFixed(6);
      toast('Koordinat terisi — jangan lupa Simpan 📍');
    },
    () => toast('Gagal mengambil lokasi. Izinkan akses lokasi di browser.', false),
    { enableHighAccuracy: true, timeout: 10000 }
  );
});
document.getElementById('btn-peta-samakan')?.addEventListener('click', () => {
  const lat = document.getElementById('absen-cfg-lat').value.trim();
  const lng = document.getElementById('absen-cfg-lng').value.trim();
  if (!lat || !lng) return toast('Titik absen belum diisi', false);
  document.getElementById('peta-lat').value = lat;
  document.getElementById('peta-lng').value = lng;
  toast('Disamakan dengan titik absen — jangan lupa Simpan 📍');
});

// ---------- Backup Database Lengkap (owner) ----------
async function loadBackupRingkasan() {
  const box = document.getElementById('backup-ringkasan');
  const warn = document.getElementById('backup-peringatan');
  if (!box) return;
  try {
    const d = await api('/api/admin/backup/ringkasan');
    const terbesar = d.tabel.filter((t) => t.baris > 0).sort((a, b) => b.baris - a.baris).slice(0, 6);
    box.innerHTML = `
      <div class="flex flex-wrap gap-x-6 gap-y-1 mb-2">
        <span><i class="fas fa-table text-matcha mr-1"></i><strong>${d.totalTabel}</strong> tabel</span>
        <span><i class="fas fa-list-ol text-matcha mr-1"></i><strong>${d.totalBaris.toLocaleString('id-ID')}</strong> baris data</span>
        <span><i class="fas fa-clock-rotate-left text-matcha mr-1"></i>Backup terakhir:
          <strong>${d.backupTerakhir ? d.backupTerakhir + (d.hariSejakBackup !== null ? ` (${d.hariSejakBackup} hari lalu)` : '') : 'belum pernah'}</strong></span>
      </div>
      <div class="text-xs text-sumi/50">Terbanyak: ${terbesar.map((t) => `${t.tabel} (${t.baris})`).join(' · ') || 'belum ada data'}</div>`;

    if (d.perluBackup) {
      warn.className = 'bg-vermillion/10 border border-vermillion/30 text-vermillion rounded-lg px-4 py-3 text-sm';
      warn.innerHTML = `<i class="fas fa-triangle-exclamation mr-1"></i><strong>Waktunya backup!</strong> ${
        d.backupTerakhir ? `Backup terakhir ${d.hariSejakBackup} hari lalu.` : 'Anda belum pernah mengunduh backup.'
      } Unduh sekarang dan simpan di tempat aman.`;
      warn.classList.remove('hidden');
    } else {
      warn.className = 'bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm';
      warn.innerHTML = `<i class="fas fa-circle-check mr-1"></i>Backup terakhir ${d.hariSejakBackup} hari lalu — masih aman.`;
      warn.classList.remove('hidden');
    }
  } catch (e) {
    box.innerHTML = `<span class="text-red-600">Gagal memuat ringkasan: ${e.message}</span>`;
  }
}

/** Unduh backup lewat navigasi langsung (header Content-Disposition memicu unduhan). */
function unduhBackup(format, media) {
  const url = `/api/admin/backup/unduh?format=${format}${media ? '&media=1' : ''}`;
  toast('Menyiapkan file backup… (mungkin beberapa detik)');
  window.location.href = url;
  // Segarkan ringkasan agar "backup terakhir" ikut terbarui
  setTimeout(loadBackupRingkasan, 4000);
}
document.getElementById('btn-backup-sql')?.addEventListener('click', () => unduhBackup('sql', false));
document.getElementById('btn-backup-json')?.addEventListener('click', () => unduhBackup('json', false));
document.getElementById('btn-backup-media')?.addEventListener('click', () => {
  if (!confirm('Sertakan semua foto (logo, galeri, selfie absensi)?\n\nFile akan JAUH lebih besar dan butuh waktu lebih lama. Lanjutkan?')) return;
  unduhBackup('sql', true);
});

// ---------- Testimoni Pelanggan ----------
const bintangTeks = (n) => '★'.repeat(Math.max(1, Math.min(5, n))) + '☆'.repeat(5 - Math.max(1, Math.min(5, n)));

async function loadTestimoni() {
  const box = document.getElementById('testi-list');
  if (!box) return;
  try {
    const { testimoni } = await api('/api/admin/testimoni');
    if (!testimoni.length) {
      box.innerHTML = '<p class="text-sm text-sumi/40 text-center py-6"><i class="fas fa-comment-slash mr-1"></i>Belum ada testimoni. Klik "Tambah Testimoni" untuk menampilkan bukti sosial di halaman depan.</p>';
      return;
    }
    box.innerHTML = testimoni.map((t) => `
      <div class="border border-sumi/10 rounded-xl p-4 ${t.tampil ? '' : 'opacity-50'}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-semibold text-sm">${escHtml(t.nama)}
              ${t.asal ? `<span class="text-xs text-sumi/50 font-normal">— ${escHtml(t.asal)}</span>` : ''}
              ${t.tampil ? '' : '<span class="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full ml-1">disembunyikan</span>'}
            </p>
            <p class="text-kin text-xs mt-0.5">${bintangTeks(t.rating)}</p>
            <p class="text-sm text-sumi/70 mt-1.5">${escHtml(t.isi)}</p>
          </div>
          <div class="flex gap-1 shrink-0">
            <button type="button" data-testi-tampil="${t.id}" class="text-xs border border-sumi/20 hover:bg-washi w-8 h-8 rounded-full transition" title="${t.tampil ? 'Sembunyikan' : 'Tampilkan'}">
              <i class="fas fa-${t.tampil ? 'eye' : 'eye-slash'}"></i></button>
            <button type="button" data-testi-ubah="${t.id}" class="text-xs border border-sumi/20 hover:bg-washi w-8 h-8 rounded-full transition" title="Ubah"><i class="fas fa-pen"></i></button>
            <button type="button" data-testi-hapus="${t.id}" class="text-xs border border-red-200 text-red-600 hover:bg-red-50 w-8 h-8 rounded-full transition" title="Hapus"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>`).join('');

    box.querySelectorAll('[data-testi-tampil]').forEach((b) => b.addEventListener('click', async () => {
      try {
        const r = await api(`/api/admin/testimoni/${b.dataset.testiTampil}/tampil`, { method: 'PATCH' });
        toast(r.tampil ? 'Testimoni ditampilkan di halaman depan ✅' : 'Testimoni disembunyikan');
        loadTestimoni();
      } catch (e) { toast(e.message, false); }
    }));
    box.querySelectorAll('[data-testi-ubah]').forEach((b) => b.addEventListener('click', () => {
      const t = testimoni.find((x) => x.id == b.dataset.testiUbah);
      if (!t) return;
      document.getElementById('modal-testi-judul').innerHTML = '<i class="fas fa-pen text-kin mr-2"></i>Ubah Testimoni';
      document.getElementById('testi-id').value = t.id;
      document.getElementById('testi-nama').value = t.nama;
      document.getElementById('testi-asal').value = t.asal || '';
      document.getElementById('testi-rating').value = t.rating;
      document.getElementById('testi-urutan').value = t.urutan;
      document.getElementById('testi-isi').value = t.isi;
      document.getElementById('testi-tampil').checked = !!t.tampil;
      bukaModal('modal-testi');
    }));
    box.querySelectorAll('[data-testi-hapus]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Hapus testimoni ini?')) return;
      try {
        await api(`/api/admin/testimoni/${b.dataset.testiHapus}`, { method: 'DELETE' });
        toast('Testimoni dihapus');
        loadTestimoni();
      } catch (e) { toast(e.message, false); }
    }));
  } catch (e) {
    box.innerHTML = `<p class="text-sm text-red-600">Gagal memuat testimoni: ${e.message}</p>`;
  }
}

document.getElementById('btn-testi-tambah')?.addEventListener('click', () => {
  document.getElementById('modal-testi-judul').innerHTML = '<i class="fas fa-comment-dots text-kin mr-2"></i>Tambah Testimoni';
  document.getElementById('form-testi').reset();
  document.getElementById('testi-id').value = '';
  document.getElementById('testi-tampil').checked = true;
  document.getElementById('testi-urutan').value = 0;
  bukaModal('modal-testi');
});

document.getElementById('form-testi')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('testi-id').value;
  const body = JSON.stringify({
    nama: document.getElementById('testi-nama').value.trim(),
    asal: document.getElementById('testi-asal').value.trim(),
    rating: parseInt(document.getElementById('testi-rating').value),
    isi: document.getElementById('testi-isi').value.trim(),
    urutan: parseInt(document.getElementById('testi-urutan').value) || 0,
    tampil: document.getElementById('testi-tampil').checked
  });
  try {
    if (id) await api(`/api/admin/testimoni/${id}`, { method: 'PUT', body });
    else await api('/api/admin/testimoni', { method: 'POST', body });
    tutupModal('modal-testi');
    toast(id ? 'Testimoni diperbarui ✅' : 'Testimoni ditambahkan ✅');
    loadTestimoni();
  } catch (err) { toast(err.message, false); }
});
document.getElementById('situs-warna')?.addEventListener('input', (e) => {
  document.getElementById('situs-warna-kode').textContent = e.target.value;
});
document.getElementById('btn-absen-cfg-gps')?.addEventListener('click', () => {
  if (!navigator.geolocation) { toast('Perangkat tidak mendukung GPS.', false); return; }
  toast('Mencari lokasi…');
  navigator.geolocation.getCurrentPosition((pos) => {
    document.getElementById('absen-cfg-lat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('absen-cfg-lng').value = pos.coords.longitude.toFixed(6);
    toast(`Lokasi terisi (akurasi ±${Math.round(pos.coords.accuracy)} m) ✓`);
  }, () => toast('Gagal mengambil lokasi. Izinkan akses lokasi.', false), { enableHighAccuracy: true, timeout: 12000 });
});
document.getElementById('form-situs')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/pengaturan-situs', { method: 'PUT', body: JSON.stringify({
      situs_nama: document.getElementById('situs-nama').value.trim(),
      situs_nama_jp: document.getElementById('situs-nama-jp').value.trim(),
      situs_tagline: document.getElementById('situs-tagline').value.trim(),
      situs_deskripsi: document.getElementById('situs-deskripsi').value.trim(),
      situs_warna: document.getElementById('situs-warna').value,
      situs_pesanan_online: document.getElementById('situs-pesanan-online').checked ? '1' : '0',
      jam_kerja_masuk: document.getElementById('situs-jam-masuk').value,
      jam_kerja_pulang: document.getElementById('situs-jam-pulang').value,
      absen_wajib_selfie: document.getElementById('absen-cfg-selfie').checked ? '1' : '0',
      absen_wajib_lokasi: document.getElementById('absen-cfg-lokasi').checked ? '1' : '0',
      absen_auto_alpa: document.getElementById('absen-cfg-auto-alpa').checked ? '1' : '0',
      absen_lat: document.getElementById('absen-cfg-lat').value.trim(),
      absen_lng: document.getElementById('absen-cfg-lng').value.trim(),
      absen_radius_m: document.getElementById('absen-cfg-radius').value || '150',
      absen_toleransi_telat: document.getElementById('absen-cfg-toleransi').value || '10',
      peta_lat: document.getElementById('peta-lat').value.trim(),
      peta_lng: document.getElementById('peta-lng').value.trim(),
      peta_zoom: document.getElementById('peta-zoom').value || '16'
    })});
    toast('Pengaturan situs diterapkan ke seluruh website 🌐');
  } catch (ex) { toast(ex.message, false); }
});

// ---------- Kelola Foto Landing Page (owner) ----------
const MEDIA_LABEL = {
  logo: 'Logo', tentang: 'Foto "Tentang"', galeri1: 'Galeri 1', galeri2: 'Galeri 2',
  galeri3: 'Galeri 3', galeri4: 'Galeri 4', galeri5: 'Galeri 5', galeri6: 'Galeri 6'
};
let MEDIA_KEY_AKTIF = null;

async function loadSitusMedia() {
  const grid = document.getElementById('situs-media-grid');
  if (!grid) return;
  try {
    const { media } = await api('/api/admin/situs/media');
    grid.innerHTML = media.map((m) => `
      <figure class="border border-sumi/10 rounded-xl overflow-hidden bg-washi">
        <img src="/media/situs/${m.key}?t=${Date.now()}" alt="${MEDIA_LABEL[m.key] || m.key}" class="w-full h-24 object-cover" loading="lazy">
        <figcaption class="p-2 text-center">
          <p class="text-xs font-medium">${MEDIA_LABEL[m.key] || m.key}${m.kustom ? ' <span class="text-[9px] bg-matcha/15 text-matcha px-1 rounded-full">kustom</span>' : ''}</p>
          <div class="flex justify-center gap-1 mt-1">
            <button onclick="gantiMedia('${m.key}')" class="text-[11px] bg-vermillion text-white px-2 py-0.5 rounded-full hover:bg-red-700 transition">Ganti</button>
            ${m.kustom ? `<button onclick="resetMedia('${m.key}')" class="text-[11px] border border-sumi/30 px-2 py-0.5 rounded-full hover:bg-washi transition">Bawaan</button>` : ''}
          </div>
        </figcaption>
      </figure>`).join('');
  } catch (e) { grid.innerHTML = '<p class="text-xs text-sumi/40 col-span-4">Gagal memuat daftar foto.</p>'; }
}

window.gantiMedia = (key) => {
  MEDIA_KEY_AKTIF = key;
  document.getElementById('situs-media-file').click();
};
window.resetMedia = async (key) => {
  if (!confirm(`Kembalikan ${MEDIA_LABEL[key] || key} ke foto bawaan?`)) return;
  try { await api(`/api/admin/situs/media/${key}`, { method: 'DELETE' }); toast('Foto dikembalikan ke bawaan ✓'); loadSitusMedia(); }
  catch (ex) { toast(ex.message, false); }
};

document.getElementById('situs-media-file')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !MEDIA_KEY_AKTIF) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast('Format harus JPEG/PNG/WebP.', false); return; }
  toast('Memproses foto…');
  try {
    const dataUrl = await kompresGambar(file, MEDIA_KEY_AKTIF === 'logo' ? 512 : 1280);
    await api(`/api/admin/situs/media/${MEDIA_KEY_AKTIF}`, { method: 'PUT', body: JSON.stringify({ foto: dataUrl }) });
    toast('Foto website diperbarui ✓ Cek halaman depan.');
    loadSitusMedia();
  } catch (ex) { toast(ex.message, false); }
});

/** Kompres gambar di browser: resize sisi terpanjang & JPEG progresif kualitas turun sampai <800KB. */
function kompresGambar(file, maxSisi) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      let { width: w, height: h } = img;
      if (Math.max(w, h) > maxSisi) {
        const skala = maxSisi / Math.max(w, h);
        w = Math.round(w * skala); h = Math.round(h * skala);
      }
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      let q = 0.82, out = cv.toDataURL('image/jpeg', q);
      while (out.length > 1_050_000 && q > 0.4) { q -= 0.12; out = cv.toDataURL('image/jpeg', q); }
      if (out.length > 1_050_000) return reject(new Error('Foto terlalu besar walau sudah dikompresi. Pilih foto lain.'));
      resolve(out);
    };
    img.onerror = () => reject(new Error('File bukan gambar yang valid.'));
    img.src = URL.createObjectURL(file);
  });
}

// ============================================================
//  Integrasi WhatsApp (OpenWA)
//  Gateway berjalan di VPS milik pemilik usaha; halaman ini hanya
//  memanggil API server Hiratake — API key TIDAK pernah ada di browser.
// ============================================================
let WA_TEMPLATE = [];

const waEsc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

const waJamMenit = (t) => {
  if (!t) return '—';
  // Waktu disimpan UTC oleh SQLite; tampilkan dalam WIB
  const d = new Date(String(t).replace(' ', 'T') + 'Z');
  if (isNaN(d)) return t;
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
  });
};

const waLabelJenis = {
  otp: 'OTP', pesanan_baru: 'Pesanan baru', pesanan_status: 'Status pesanan', nota: 'Nota',
  piutang: 'Piutang', cicilan: 'Cicilan', gaji: 'Gaji', absensi: 'Absensi',
  manual: 'Manual', broadcast: 'Broadcast', autoreply: 'Balasan otomatis', uji: 'Uji'
};

// ---------- Pemuat utama tab ----------
async function loadWhatsApp() {
  await Promise.all([loadWaStatus(), loadWaConfig(), loadWaLog()]);
}

// ---------- Status gateway ----------
async function loadWaStatus() {
  const teks = document.getElementById('wa-status-teks');
  const pesan = document.getElementById('wa-status-pesan');
  const btnMulai = document.getElementById('btn-wa-mulai');
  const btnQr = document.getElementById('btn-wa-qr');
  if (!teks) return;
  teks.innerHTML = '<i class="fas fa-spinner fa-spin text-sumi/40"></i>';
  try {
    const s = await api('/api/admin/wa/status');
    const peta = {
      ready: ['wa-pill-ok', 'Tersambung'], qr_ready: ['wa-pill-warn', 'Menunggu QR'],
      authenticating: ['wa-pill-warn', 'Menyambungkan'], initializing: ['wa-pill-warn', 'Menyiapkan'],
      created: ['wa-pill-warn', 'Sesi dibuat'], disconnected: ['wa-pill-off', 'Terputus'],
      action_required: ['wa-pill-off', 'Perlu tindakan'], failed: ['wa-pill-off', 'Gagal'],
      belum_diatur: ['wa-pill-off', 'Belum diatur'], tanpa_apikey: ['wa-pill-off', 'API key kosong'],
      error: ['wa-pill-off', 'Tidak terhubung']
    };
    const [kelas, label] = peta[s.status] || ['wa-pill-off', s.status];
    teks.innerHTML = `<span class="wa-pill ${kelas}"><i class="fas fa-circle text-[6px]"></i>${waEsc(label)}</span>`
      + (s.aktif === false ? ' <span class="wa-pill wa-pill-warn ml-1">Integrasi dimatikan</span>' : '');
    pesan.textContent = s.pesan || '';
    btnMulai.classList.toggle('hidden', s.status === 'ready' || s.status === 'belum_diatur' || s.status === 'tanpa_apikey');
    btnQr.classList.toggle('hidden', s.status !== 'qr_ready');
  } catch (ex) {
    teks.innerHTML = '<span class="wa-pill wa-pill-off">Gagal memeriksa</span>';
    pesan.textContent = ex.message;
  }
}

document.getElementById('btn-wa-refresh')?.addEventListener('click', () => loadWhatsApp());

document.getElementById('btn-wa-mulai')?.addEventListener('click', async () => {
  try {
    await api('/api/admin/wa/mulai-sesi', { method: 'POST' });
    toast('Sesi WhatsApp dimulai. Tunggu beberapa detik lalu segarkan.');
    setTimeout(loadWaStatus, 4000);
  } catch (ex) { toast(ex.message, false); }
});

document.getElementById('btn-wa-qr')?.addEventListener('click', async () => {
  const area = document.getElementById('wa-qr-area');
  const img = document.getElementById('wa-qr-img');
  try {
    const d = await api('/api/admin/wa/qr');
    if (!d.qr) return toast('QR belum tersedia. Coba mulai sesi lalu segarkan.', false);
    // OpenWA bisa mengirim data-URL gambar atau string QR mentah
    img.src = String(d.qr).startsWith('data:')
      ? d.qr
      : 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=' + encodeURIComponent(d.qr);
    area.classList.remove('hidden');
  } catch (ex) { toast(ex.message, false); }
});

// ---------- Sub-navigasi ----------
document.querySelectorAll('.wa-sub-btn').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.wa-sub-btn').forEach((x) => x.classList.remove('active'));
  b.classList.add('active');
  document.querySelectorAll('.wa-sub-panel').forEach((p) => p.classList.add('hidden'));
  document.getElementById('wa-sub-' + b.dataset.waSub).classList.remove('hidden');
  const pemuat = { log: loadWaLog, masuk: loadWaMasuk, template: loadWaTemplate, konfigurasi: loadWaConfig, broadcast: hitungBroadcast };
  pemuat[b.dataset.waSub]?.();
}));

// ---------- Log pesan ----------
async function loadWaLog() {
  const t = document.getElementById('table-wa-log');
  if (!t) return;
  const q = new URLSearchParams({
    jenis: document.getElementById('wa-filter-jenis')?.value || '',
    status: document.getElementById('wa-filter-status')?.value || '',
    cari: document.getElementById('wa-cari')?.value.trim() || ''
  });
  try {
    const d = await api('/api/admin/wa/log?' + q);
    document.getElementById('wa-stat-total').textContent = d.statistik?.total ?? 0;
    document.getElementById('wa-stat-terkirim').textContent = d.statistik?.terkirim ?? 0;
    document.getElementById('wa-stat-gagal').textContent = d.statistik?.gagal ?? 0;
    document.getElementById('wa-stat-hari').textContent = d.statistik?.hari_ini ?? 0;

    t.innerHTML = `
      <thead><tr><th>Waktu</th><th>Tujuan</th><th>Jenis</th><th>Isi</th><th>Status</th><th></th></tr></thead>
      <tbody>${d.log.length ? d.log.map((w) => `
        <tr>
          <td class="whitespace-nowrap text-xs">${waJamMenit(w.created_at)}</td>
          <td class="font-mono text-xs">${waEsc(w.tujuan)}</td>
          <td class="text-xs">${waEsc(waLabelJenis[w.jenis] || w.jenis)}${w.entitas_id ? `<br><span class="text-sumi/40">${waEsc(w.entitas_id)}</span>` : ''}</td>
          <td class="text-xs max-w-[260px]"><span class="line-clamp-2 block">${waEsc(String(w.isi).slice(0, 160))}</span></td>
          <td>${w.status === 'terkirim'
              ? '<span class="wa-pill wa-pill-ok">Terkirim</span>'
              : `<span class="wa-pill wa-pill-off" title="${waEsc(w.error)}">Gagal</span>`}
            ${w.error ? `<br><span class="text-[10px] text-vermillion">${waEsc(String(w.error).slice(0, 70))}</span>` : ''}</td>
          <td class="whitespace-nowrap">
            ${w.status === 'gagal' && w.jenis !== 'otp'
              ? `<button onclick="kirimUlangWa(${w.id})" class="text-blue-500 hover:text-blue-700" title="Kirim ulang"><i class="fas fa-rotate-right"></i></button>` : ''}
          </td>
        </tr>`).join('')
        : '<tr><td colspan="6" class="text-center text-sumi/40 py-6">Belum ada pesan terkirim.</td></tr>'}</tbody>`;
  } catch (ex) { toast(ex.message, false); }
}

window.kirimUlangWa = async (id) => {
  try {
    await api(`/api/admin/wa/log/${id}/kirim-ulang`, { method: 'POST' });
    toast('Pesan berhasil dikirim ulang ✅');
    loadWaLog();
  } catch (ex) { toast(ex.message, false); }
};

let waCariTimer;
document.getElementById('wa-cari')?.addEventListener('input', () => {
  clearTimeout(waCariTimer); waCariTimer = setTimeout(loadWaLog, 400);
});
document.getElementById('wa-filter-jenis')?.addEventListener('change', loadWaLog);
document.getElementById('wa-filter-status')?.addEventListener('change', loadWaLog);

// ---------- Pesan masuk ----------
async function loadWaMasuk() {
  const t = document.getElementById('table-wa-masuk');
  if (!t) return;
  try {
    const { masuk } = await api('/api/admin/wa/masuk');
    t.innerHTML = `
      <thead><tr><th>Waktu</th><th>Pengirim</th><th>Pesan</th><th>Balasan Otomatis</th></tr></thead>
      <tbody>${masuk.length ? masuk.map((m) => `
        <tr>
          <td class="whitespace-nowrap text-xs">${waJamMenit(m.created_at)}</td>
          <td class="text-xs"><span class="font-mono">${waEsc(m.pengirim)}</span>${m.nama_pengirim ? `<br><span class="text-sumi/50">${waEsc(m.nama_pengirim)}</span>` : ''}</td>
          <td class="text-xs max-w-[220px]">${waEsc(String(m.isi).slice(0, 140))}</td>
          <td class="text-xs max-w-[240px] text-sumi/60">${m.dibalas ? waEsc(String(m.balasan).slice(0, 140)) : '<span class="text-sumi/30">— tidak dibalas</span>'}</td>
        </tr>`).join('')
        : '<tr><td colspan="4" class="text-center text-sumi/40 py-6">Belum ada pesan masuk. Pastikan webhook OpenWA sudah didaftarkan.</td></tr>'}</tbody>`;
  } catch (ex) { toast(ex.message, false); }
}

// ---------- Template ----------
async function loadWaTemplate() {
  const box = document.getElementById('wa-template-list');
  if (!box) return;
  try {
    const { template } = await api('/api/admin/wa/template');
    WA_TEMPLATE = template;
    box.innerHTML = template.map((t) => `
      <div class="wa-tpl-kartu">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium text-sm">${waEsc(t.nama)}
              ${t.aktif ? '' : '<span class="wa-pill wa-pill-off ml-1">nonaktif</span>'}</p>
            <p class="text-[10px] text-sumi/40 font-mono mb-1">${waEsc(t.kode)}</p>
            <p class="wa-tpl-isi">${waEsc(t.isi)}</p>
          </div>
          <button onclick="editTemplateWa('${waEsc(t.kode)}')" class="text-vermillion hover:text-red-700 shrink-0" title="Ubah"><i class="fas fa-pen"></i></button>
        </div>
      </div>`).join('');
  } catch (ex) { toast(ex.message, false); }
}

window.editTemplateWa = (kode) => {
  const t = WA_TEMPLATE.find((x) => x.kode === kode);
  if (!t) return;
  document.getElementById('wa-tpl-kode').value = t.kode;
  document.getElementById('wa-tpl-judul').textContent = 'Ubah: ' + t.nama;
  document.getElementById('wa-tpl-isi').value = t.isi;
  document.getElementById('wa-tpl-aktif').checked = !!t.aktif;
  document.getElementById('wa-tpl-pratinjau').textContent = '';
  bukaModal('modal-wa-template');
};

document.getElementById('btn-wa-tpl-pratinjau')?.addEventListener('click', async () => {
  try {
    const d = await api(`/api/admin/wa/template/${document.getElementById('wa-tpl-kode').value}/pratinjau`, {
      method: 'POST', body: JSON.stringify({ isi: document.getElementById('wa-tpl-isi').value })
    });
    document.getElementById('wa-tpl-pratinjau').textContent = d.hasil;
  } catch (ex) { toast(ex.message, false); }
});

document.getElementById('form-wa-template')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api(`/api/admin/wa/template/${document.getElementById('wa-tpl-kode').value}`, {
      method: 'PUT', body: JSON.stringify({
        isi: document.getElementById('wa-tpl-isi').value,
        aktif: document.getElementById('wa-tpl-aktif').checked
      })
    });
    toast('Template disimpan ✅');
    tutupModal('modal-wa-template');
    loadWaTemplate();
  } catch (ex) { toast(ex.message, false); }
});

// ---------- Kirim manual ----------
document.getElementById('form-wa-kirim')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"], button:not([type])');
  if (btn) { btn.disabled = true; btn.textContent = 'Mengirim…'; }
  try {
    await api('/api/admin/wa/kirim', { method: 'POST', body: JSON.stringify({
      wa: document.getElementById('wa-kirim-nomor').value,
      pesan: document.getElementById('wa-kirim-pesan').value
    })});
    toast('Pesan terkirim 📤');
    tutupModal('modal-wa-kirim');
    e.target.reset(); loadWaLog();
  } catch (ex) { toast(ex.message, false); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Kirim'; } }
});

// ---------- Uji koneksi ----------
document.getElementById('form-wa-uji')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button:not([type="button"])');
  if (btn) { btn.disabled = true; btn.textContent = 'Mengirim…'; }
  try {
    await api('/api/admin/wa/uji', { method: 'POST', body: JSON.stringify({ wa: document.getElementById('wa-uji-nomor').value }) });
    toast('Pesan uji terkirim! Periksa WhatsApp Anda ✅');
    tutupModal('modal-wa-uji');
    loadWaLog();
  } catch (ex) { toast(ex.message, false); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Kirim Pesan Uji'; } }
});

// ---------- Broadcast ----------
async function hitungBroadcast() {
  const target = document.getElementById('wa-bc-target')?.value || 'semua';
  const tipe = document.getElementById('wa-bc-tipe')?.value || '';
  document.getElementById('wa-bc-tipe-area')?.classList.toggle('hidden', target !== 'tipe');
  try {
    const d = await api(`/api/admin/wa/broadcast/hitung?target=${target}&tipe=${tipe}`);
    const el = document.getElementById('wa-bc-hitung');
    el.innerHTML = d.total > d.batas
      ? `<i class="fas fa-users mr-1"></i>${d.total} pelanggan cocok — <strong>hanya ${d.batas} pertama</strong> yang dikirim (batas keamanan).`
      : `<i class="fas fa-users mr-1"></i>${d.total} pelanggan akan menerima pesan ini.`;
  } catch (ex) { /* abaikan */ }
}
document.getElementById('wa-bc-target')?.addEventListener('change', hitungBroadcast);
document.getElementById('wa-bc-tipe')?.addEventListener('change', hitungBroadcast);

document.getElementById('btn-wa-broadcast')?.addEventListener('click', async () => {
  const pesan = document.getElementById('wa-bc-pesan').value.trim();
  if (!pesan) return toast('Isi pesan broadcast dulu.', false);
  if (!confirm('Kirim broadcast ke kelompok pelanggan ini?\n\nPeringatan: pengiriman massal berisiko membuat nomor WhatsApp diblokir. Lanjutkan?')) return;
  const btn = document.getElementById('btn-wa-broadcast');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Mengirim… (jangan tutup halaman)';
  try {
    const d = await api('/api/admin/wa/broadcast', { method: 'POST', body: JSON.stringify({
      target: document.getElementById('wa-bc-target').value,
      tipe: document.getElementById('wa-bc-tipe').value,
      pesan
    })});
    toast(`Broadcast selesai: ${d.terkirim} terkirim, ${d.gagal} gagal`, d.gagal === 0);
    loadWaLog();
  } catch (ex) { toast(ex.message, false); }
  finally { btn.disabled = false; btn.innerHTML = '<i class="fab fa-whatsapp mr-1"></i>Kirim Broadcast'; }
});

// ---------- Konfigurasi ----------
async function loadWaConfig() {
  const form = document.getElementById('form-wa-config');
  if (!form) return;
  try {
    const d = await api('/api/admin/wa/pengaturan');
    const p = d.pengaturan || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    const cek = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v === '1'; };

    set('wa-cfg-url', p.openwa_url);
    set('wa-cfg-session', p.openwa_session);
    set('wa-cfg-jam', p.openwa_jam_pengingat || '8');
    cek('wa-cfg-aktif', p.openwa_aktif);
    cek('wa-cfg-otp-login', p.openwa_otp_login);
    cek('wa-cfg-otp-pesanan', p.openwa_otp_pesanan);
    cek('wa-cfg-autoreply', p.openwa_autoreply);
    cek('wa-cfg-notif-pesanan', p.openwa_notif_pesanan);
    cek('wa-cfg-notif-status', p.openwa_notif_status);
    cek('wa-cfg-notif-nota', p.openwa_notif_nota);
    cek('wa-cfg-notif-piutang', p.openwa_notif_piutang);
    cek('wa-cfg-notif-gaji', p.openwa_notif_gaji);
    cek('wa-cfg-notif-internal', p.openwa_notif_internal);
    cek('wa-cfg-notif-ringkasan', p.openwa_notif_ringkasan);

    // Status kredensial + dari mana asalnya. Bila dipasang di server (env),
    // kolom input dikunci karena nilai server selalu menang.
    const statusKredensial = (idTeks, idInput, label, terpasang, sumber, petunjuk) => {
      const teks = document.getElementById(idTeks);
      const input = document.getElementById(idInput);
      if (!teks) return;
      if (sumber === 'server') {
        teks.innerHTML = label + ': <span class="wa-pill wa-pill-ok">terpasang di server</span> ' +
          '<span class="text-sumi/50">' + (petunjuk || '') + ' — diatur lewat environment, kolom ini dinonaktifkan</span>';
        if (input) { input.disabled = true; input.placeholder = 'dikelola di server (environment variable)'; }
      } else if (sumber === 'web') {
        teks.innerHTML = label + ': <span class="wa-pill wa-pill-ok">tersimpan</span> ' +
          '<span class="text-sumi/50">' + (petunjuk || '') + ' — kosongkan lalu simpan untuk mengganti</span>';
        if (input) { input.disabled = false; input.placeholder = 'sudah tersimpan — isi untuk mengganti'; }
      } else {
        teks.innerHTML = label + ': <span class="wa-pill wa-pill-off">belum ada</span>';
        if (input) { input.disabled = false; input.placeholder = 'tempel ' + label.toLowerCase() + ' di sini'; }
      }
    };
    statusKredensial('wa-cfg-apikey', 'wa-in-apikey', 'API key',
      d.apiKeyTerpasang, d.apiKeySumber, d.apiKeyPetunjuk);
    statusKredensial('wa-cfg-secret', 'wa-in-secret', 'Webhook secret',
      d.webhookSecretTerpasang, d.webhookSecretSumber, d.webhookSecretPetunjuk);

    // URL / nama sesi / saklar aktif: bila diisi lewat .env server, kunci kolomnya
    // (nilai server selalu menang) dan beri penanda "diatur di server" pada label.
    const kunciDariServer = (idInput, sumber) => {
      const input = document.getElementById(idInput);
      if (!input) return;
      const dariServer = sumber === 'server';
      input.disabled = dariServer;
      if (dariServer && input.type !== 'checkbox') input.placeholder = 'dikelola di server (.env)';
      // Penanda "· diatur di server (.env)" — pada <label for=…> untuk kolom teks,
      // atau di dalam <span> label pembungkus untuk checkbox.
      const wadah = document.querySelector('label[for="' + idInput + '"]')
        || input.closest('label')?.querySelector('span')
        || input.parentElement;
      if (!wadah) return;
      let tag = wadah.querySelector('.wa-env-tag');
      if (dariServer && !tag) {
        tag = document.createElement('span');
        tag.className = 'wa-env-tag text-[11px] font-normal text-green-600 ml-2';
        tag.textContent = '· diatur di server (.env)';
        wadah.appendChild(tag);
      } else if (!dariServer && tag) {
        tag.remove();
      }
    };
    kunciDariServer('wa-cfg-url', d.urlSumber);
    kunciDariServer('wa-cfg-session', d.sessionSumber);
    kunciDariServer('wa-cfg-aktif', d.aktifSumber);

    // Kredensial dari server (env) tak bisa dihapus lewat web
    const bisaUbah = d.apiKeySumber !== 'server' || d.webhookSecretSumber !== 'server';
    const btnHapus = document.getElementById('wa-hapus-kredensial');
    if (btnHapus) btnHapus.disabled = !bisaUbah;

    // Perintah siap-tempel: cadangan bila "Daftarkan Webhook Otomatis" gagal
    const cmd = document.getElementById('wa-cfg-webhook-cmd');
    if (cmd) {
      const sesi = p.openwa_session || 'SESSION_ID';
      const url = (p.openwa_url || 'http://127.0.0.1:2785');
      cmd.textContent =
`curl -X POST ${url}/api/sessions/${sesi}/webhooks \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: API_KEY_ANDA" \\
  -d '{"url":"${d.webhookUrl}",
       "events":["message.received","session.status"],
       "secret":"NILAI_OPENWA_WEBHOOK_SECRET"}'`;
    }

    loadWaLangkah(d);
  } catch (ex) { toast(ex.message, false); }
}

// ---------- Panduan "Langkah Menghubungkan" ----------
async function loadWaLangkah(dCfg) {
  const ol = document.getElementById('wa-langkah-list');
  const ringkas = document.getElementById('wa-langkah-ringkas');
  if (!ol) return;
  if (ringkas) ringkas.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Memeriksa…';

  let d = dCfg, st = {}, wh = {};
  try {
    const [c1, c2, c3] = await Promise.all([
      dCfg ? Promise.resolve(dCfg) : api('/api/admin/wa/pengaturan'),
      api('/api/admin/wa/status').catch(() => ({})),
      api('/api/admin/wa/webhook/cek').catch(() => ({}))
    ]);
    d = c1 || {}; st = c2 || {}; wh = c3 || {};
  } catch (ex) {
    ol.innerHTML = `<li class="text-sm text-vermillion">${waEsc(ex.message)}</li>`;
    if (ringkas) ringkas.textContent = '';
    return;
  }

  const p = d.pengaturan || {};
  const punyaUrl = !!p.openwa_url;
  const punyaSesi = !!p.openwa_session;
  const punyaKey = !!d.apiKeyTerpasang;
  const punyaSecret = !!d.webhookSecretTerpasang;
  const dasarSiap = punyaUrl && punyaSesi && punyaKey;
  const sesiReady = st.status === 'ready';
  const perluQr = st.status === 'qr_ready';
  const aktif = p.openwa_aktif === '1';

  const tombol = (aksi, teks, gaya) =>
    `<button type="button" onclick="waLangkahAksi('${aksi}')" class="shrink-0 text-xs ${gaya || 'border border-sumi/20 hover:bg-washi'} px-3 py-1.5 rounded-full transition">${teks}</button>`;

  const item = (ok, judul, ket, aksiHtml) => `
    <li class="flex items-start gap-2.5">
      <i class="fas ${ok ? 'fa-circle-check text-green-600' : 'fa-circle-dot text-sumi/25'} mt-0.5 w-4 text-center"></i>
      <div class="min-w-0 flex-1">
        <p class="text-sm ${ok ? 'text-sumi/70' : 'font-medium'}">${judul}</p>
        ${ket ? `<p class="text-xs text-sumi/50 mt-0.5">${ket}</p>` : ''}
      </div>
      ${!ok && aksiHtml ? aksiHtml : ''}
    </li>`;

  const langkah = [];
  langkah.push(item(punyaUrl, 'URL gateway OpenWA', punyaUrl ? waEsc(p.openwa_url) : 'Isi kolom "URL Gateway OpenWA" lalu Simpan.'));
  langkah.push(item(punyaSesi, 'Nama sesi', punyaSesi ? waEsc(p.openwa_session) : 'Isi kolom "Nama / ID Sesi" (sama dengan di OpenWA) lalu Simpan.'));
  langkah.push(item(punyaKey, 'API key OpenWA tersimpan', punyaKey ? 'Terpasang.' : 'Tempel di kolom "API Key OpenWA" lalu Simpan.'));
  langkah.push(item(punyaSecret, 'Webhook secret tersimpan', punyaSecret ? 'Terpasang.' : 'Isi kolom "Webhook Secret" (teks acak) lalu Simpan.'));
  langkah.push(item(
    sesiReady, 'Sesi WhatsApp tersambung',
    !dasarSiap ? 'Selesaikan langkah 1–3 dulu.'
      : sesiReady ? 'Nomor sudah login.'
      : perluQr ? 'Sesi menunggu QR discan.'
      : st.pesan || `Status sesi: ${waEsc(st.status || 'tidak diketahui')}.`,
    !dasarSiap ? '' : perluQr ? tombol('qr', 'Tampilkan QR') : tombol('mulai', 'Mulai Sesi')
  ));
  langkah.push(item(
    wh.terdaftar === true, 'Webhook terdaftar di OpenWA',
    !dasarSiap || !punyaSecret ? 'Butuh URL, sesi, API key & webhook secret dulu.'
      : wh.terdaftar === true ? 'Balasan otomatis & OTP masuk siap.'
      : wh.terdaftar === null ? 'Tidak bisa dicek otomatis — klik untuk mendaftarkan.'
      : 'Belum terdaftar.',
    (!dasarSiap || !punyaSecret) ? '' : tombol('webhook', 'Daftarkan Webhook', 'border border-green-600 text-green-700 hover:bg-green-50')
  ));
  langkah.push(item(aktif, 'Integrasi diaktifkan', aktif ? 'Saklar utama menyala.' : 'Centang "Aktifkan integrasi WhatsApp" lalu Simpan.'));

  ol.innerHTML = langkah.join('');

  if (ringkas) {
    if (d.siap && sesiReady) {
      ringkas.innerHTML = '<span class="wa-pill wa-pill-ok"><i class="fas fa-circle text-[6px]"></i>Siap — WhatsApp tersambung & aktif</span>';
    } else if (d.siap) {
      ringkas.innerHTML = '<span class="wa-pill wa-pill-warn"><i class="fas fa-circle text-[6px]"></i>Konfigurasi lengkap — sesi WhatsApp belum tersambung</span>';
    } else {
      ringkas.innerHTML = '<span class="wa-pill wa-pill-off"><i class="fas fa-circle text-[6px]"></i>Belum siap — selesaikan langkah di bawah</span>';
    }
  }
}

// Aksi tombol di panel Langkah
window.waLangkahAksi = async (jenis) => {
  try {
    if (jenis === 'uji') {
      const r = await api('/api/admin/wa/uji-koneksi', { method: 'POST' });
      toast(r.ready ? 'Gateway tersambung & sesi siap ✅' : `Gateway tersambung. Status sesi: ${r.status}`, r.ready);
    } else if (jenis === 'mulai') {
      await api('/api/admin/wa/mulai-sesi', { method: 'POST' });
      toast('Sesi WhatsApp dimulai. Tunggu beberapa detik…', true);
    } else if (jenis === 'qr') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.getElementById('btn-wa-qr')?.click();
      return;
    } else if (jenis === 'webhook') {
      await api('/api/admin/wa/webhook/daftar', { method: 'POST' });
      toast('Webhook didaftarkan ke OpenWA ✅', true);
    }
  } catch (ex) { toast(ex.message, false); }
  setTimeout(() => { loadWaLangkah(); loadWaStatus(); }, jenis === 'mulai' ? 3500 : 500);
};

document.getElementById('btn-wa-langkah-cek')?.addEventListener('click', () => loadWaLangkah());

document.getElementById('btn-wa-uji-koneksi')?.addEventListener('click', async (ev) => {
  const b = ev.currentTarget;
  const info = document.getElementById('wa-uji-koneksi-info');
  b.disabled = true;
  if (info) { info.textContent = 'Menghubungi gateway…'; info.className = 'text-xs text-sumi/50'; }
  try {
    const r = await api('/api/admin/wa/uji-koneksi', { method: 'POST' });
    if (info) {
      info.textContent = r.ready ? 'Tersambung — sesi siap ✅' : `Tersambung — status sesi: ${r.status}`;
      info.className = 'text-xs ' + (r.ready ? 'text-matcha' : 'text-vermillion');
    }
  } catch (ex) {
    if (info) { info.textContent = ex.message; info.className = 'text-xs text-vermillion'; }
  } finally {
    b.disabled = false;
    loadWaLangkah();
  }
});

// ---------- Kredensial OpenWA: simpan / hapus / lihat ----------
(() => {
  const info = (teks, ok) => {
    const el = document.getElementById('wa-kredensial-info');
    if (!el) return;
    el.textContent = teks;
    el.className = 'text-xs ' + (ok ? 'text-matcha' : 'text-vermillion');
  };

  // Tombol mata: tampilkan/sembunyikan isi kolom
  [['wa-lihat-apikey', 'wa-in-apikey'], ['wa-lihat-secret', 'wa-in-secret']].forEach(([idBtn, idIn]) => {
    const btn = document.getElementById(idBtn);
    const input = document.getElementById(idIn);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const lihat = input.type === 'password';
      input.type = lihat ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(lihat));
      btn.innerHTML = '<i class="fas ' + (lihat ? 'fa-eye-slash' : 'fa-eye') + ' text-sm"></i>';
    });
  });

  // Daftarkan webhook Hiratake ke OpenWA otomatis (server yang pegang secret)
  document.getElementById('btn-wa-webhook-daftar')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    info('Mendaftarkan webhook ke OpenWA…', true);
    try {
      const d = await api('/api/admin/wa/webhook/daftar', { method: 'POST' });
      info('Webhook terdaftar: ' + (d.webhookUrl || 'OK'), true);
      toast('Webhook didaftarkan ke OpenWA ✅', true);
      if (typeof loadWaLangkah === 'function') loadWaLangkah();
    } catch (ex) {
      info(ex.message, false);
      toast(ex.message, false);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('wa-hapus-kredensial')?.addEventListener('click', async (ev) => {
    if (!confirm('Hapus API key & webhook secret OpenWA?\n\nIntegrasi WhatsApp akan berhenti mengirim pesan sampai kredensial diisi lagi.')) return;
    const btn = ev.currentTarget;
    btn.disabled = true;
    info('Menghapus…', true);
    try {
      const r = await fetch('/api/admin/wa/kredensial', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: '', webhook_secret: '' })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menghapus kredensial.');
      info('Kredensial dihapus.', true);
      toast('Kredensial dihapus.', true);
      if (typeof loadWaConfig === 'function') loadWaConfig();
    } catch (ex) {
      info(ex.message, false);
      toast(ex.message, false);
    } finally {
      btn.disabled = false;
    }
  });
})();

document.getElementById('form-wa-config')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nilai = (id) => document.getElementById(id).value.trim();
  const saklar = (id) => document.getElementById(id).checked ? '1' : '0';
  const btn = document.getElementById('wa-simpan-semua');
  if (btn) btn.disabled = true;
  try {
    // 1) Kredensial dulu (owner saja) — hanya bila kolomnya diisi & tidak dikunci server
    const apikey = document.getElementById('wa-in-apikey');
    const secret = document.getElementById('wa-in-secret');
    const kred = {};
    if (apikey && !apikey.disabled && apikey.value.trim()) kred.api_key = apikey.value.trim();
    if (secret && !secret.disabled && secret.value.trim()) kred.webhook_secret = secret.value.trim();
    if (Object.keys(kred).length) {
      if (ME && ME.role === 'owner') {
        await api('/api/admin/wa/kredensial', { method: 'PUT', body: JSON.stringify(kred) });
        if (apikey) apikey.value = '';
        if (secret) secret.value = '';
      } else {
        toast('Kredensial hanya bisa diubah oleh owner — bagian lain tetap disimpan.', false);
      }
    }

    // 2) Sisa konfigurasi (kunci yang dikunci .env diabaikan server)
    await api('/api/admin/wa/pengaturan', { method: 'PUT', body: JSON.stringify({
      openwa_url: nilai('wa-cfg-url'),
      openwa_session: nilai('wa-cfg-session'),
      openwa_jam_pengingat: nilai('wa-cfg-jam'),
      openwa_aktif: saklar('wa-cfg-aktif'),
      openwa_otp_login: saklar('wa-cfg-otp-login'),
      openwa_otp_pesanan: saklar('wa-cfg-otp-pesanan'),
      openwa_autoreply: saklar('wa-cfg-autoreply'),
      openwa_notif_pesanan: saklar('wa-cfg-notif-pesanan'),
      openwa_notif_status: saklar('wa-cfg-notif-status'),
      openwa_notif_nota: saklar('wa-cfg-notif-nota'),
      openwa_notif_piutang: saklar('wa-cfg-notif-piutang'),
      openwa_notif_gaji: saklar('wa-cfg-notif-gaji'),
      openwa_notif_internal: saklar('wa-cfg-notif-internal'),
      openwa_notif_ringkasan: saklar('wa-cfg-notif-ringkasan')
    })});
    toast('Konfigurasi WhatsApp disimpan ✅');
    loadWaStatus(); loadWaConfig();
  } catch (ex) { toast(ex.message, false); }
  finally { if (btn) btn.disabled = false; }
});

document.getElementById('btn-wa-pengingat')?.addEventListener('click', async () => {
  const b = document.getElementById('btn-wa-pengingat');
  b.disabled = true; b.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Menjalankan…';
  try {
    const d = await api('/api/admin/wa/pengingat', { method: 'POST' });
    toast(d.dijalankan ? `Pengingat dikirim ke ${d.terkirim} pelanggan` : (d.alasan || 'Tidak ada yang perlu diingatkan'), d.dijalankan);
    loadWaLog();
  } catch (ex) { toast(ex.message, false); }
  finally { b.disabled = false; b.innerHTML = '<i class="fas fa-bell mr-1"></i>Jalankan Pengingat Sekarang'; }
});

// ---------- Tagih piutang via WhatsApp (dipakai tab Piutang) ----------
window.tagihWa = async (id) => {
  if (!confirm('Kirim pesan tagihan ke pelanggan lewat WhatsApp?')) return;
  try {
    await api(`/api/admin/wa/tagih/${id}`, { method: 'POST' });
    toast('Tagihan terkirim via WhatsApp 📤');
  } catch (ex) { toast(ex.message, false); }
};

// ---------- Simpan nomor WA pengguna ----------
window.setWaUser = async (id, nama, sekarang) => {
  const wa = prompt(`Nomor WhatsApp untuk ${nama}\n(kosongkan untuk menghapus):`, sekarang || '');
  if (wa === null) return;
  try {
    await api(`/api/admin/users/${id}/wa`, { method: 'PUT', body: JSON.stringify({ wa }) });
    toast(wa.trim() ? 'Nomor WhatsApp disimpan 📱' : 'Nomor WhatsApp dihapus');
    loadUsers();
  } catch (ex) { toast(ex.message, false); }
};

// ============================================================
//  FASE 8 — PEMBAYARAN & CHECKOUT (owner/admin)
// ============================================================

let BAYAR_CFG = null; // cache pengaturan terakhir untuk simulasi biaya

const BAYAR_LBL_STATUS = {
  menunggu: ['Menunggu', 'wa-pill-warn'],
  dibayar: ['Lunas', 'wa-pill-ok'],
  kedaluwarsa: ['Kedaluwarsa', 'wa-pill-off'],
  gagal: ['Gagal', 'wa-pill-off'],
  batal: ['Batal', 'wa-pill-off']
};
const BAYAR_LBL_METODE = { cash: 'Tunai / COD', qris: 'QRIS', transfer: 'Transfer' };

function loadPembayaran() {
  loadBayarConfig();
  loadBayarTransaksi();
}

// ---------- Sub-navigasi ----------
document.querySelectorAll('.bayar-sub-btn').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.bayar-sub-btn').forEach((x) => x.classList.remove('active'));
  b.classList.add('active');
  document.querySelectorAll('.bayar-sub-panel').forEach((p) => p.classList.add('hidden'));
  document.getElementById('bayar-sub-' + b.dataset.bayarSub).classList.remove('hidden');
}));

document.getElementById('btn-bayar-refresh')?.addEventListener('click', () => loadPembayaran());

// ---------- Konfigurasi gateway ----------
async function loadBayarConfig() {
  const form = document.getElementById('form-bayar-gateway');
  if (!form) return;
  try {
    const d = await api('/api/admin/bayar/pengaturan');
    BAYAR_CFG = d;
    const p = d.pengaturan || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    const cek = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v === '1'; };

    // Daftar provider (dinamis dari server → universal)
    const sel = document.getElementById('bayar-cfg-provider');
    if (sel && !sel.options.length) {
      sel.innerHTML = (d.provider || []).map((pr) =>
        `<option value="${pr.id}">${escHtml(pr.nama)}</option>`).join('');
    }

    cek('bayar-cfg-aktif', p.bayar_aktif);
    cek('bayar-cfg-cash', p.bayar_cash);
    cek('bayar-cfg-qris', p.bayar_qris);
    set('bayar-cfg-provider', p.bayar_provider || 'manual');
    set('bayar-cfg-mode', p.bayar_mode || 'sandbox');
    set('bayar-cfg-merchant', p.bayar_merchant_kode);
    set('bayar-cfg-channel', p.bayar_channel);
    set('bayar-cfg-qris-gambar', p.bayar_qris_gambar);
    set('bayar-cfg-qris-nama', p.bayar_qris_nama);
    set('bayar-cfg-instruksi-cash', p.bayar_instruksi_cash);

    set('bayar-cfg-biaya-mode', p.bayar_biaya_mode || 'serap');
    set('bayar-cfg-biaya-persen', p.bayar_biaya_persen || '0');
    set('bayar-cfg-biaya-tetap', p.bayar_biaya_tetap || '0');
    set('bayar-cfg-kedaluwarsa', p.bayar_kedaluwarsa_menit || '60');
    set('bayar-cfg-min-qris', p.bayar_min_qris || '0');
    set('bayar-cfg-maks-qris', p.bayar_maks_qris || '10000000');
    set('bayar-cfg-ongkir', p.bayar_ongkir || '0');
    set('bayar-cfg-ongkir-gratis', p.bayar_ongkir_gratis_min || '0');

    cek('bayar-cfg-lacak-aktif', p.lacak_aktif);
    cek('bayar-cfg-lacak-otp', p.lacak_otp);
    cek('bayar-cfg-terima-otp', p.terima_otp);
    cek('bayar-cfg-notif-menunggu', p.bayar_notif_menunggu);
    cek('bayar-cfg-notif-lunas', p.bayar_notif_lunas);
    cek('bayar-cfg-notif-internal', p.bayar_notif_internal);

    // Status kredensial (hanya boolean, kunci asli tidak pernah dikirim)
    const pill = (ok) => ok
      ? '<span class="wa-pill wa-pill-ok">terpasang</span>'
      : '<span class="wa-pill wa-pill-off">belum ada</span>';
    document.getElementById('bayar-cfg-serverkey').innerHTML = 'Server key: ' + pill(d.serverKeyTerpasang);
    document.getElementById('bayar-cfg-clientkey').innerHTML = 'Client key: ' + pill(d.clientKeyTerpasang);
    document.getElementById('bayar-cfg-callbacksecret').innerHTML = 'Callback secret: ' + pill(d.callbackSecretTerpasang);
    set('bayar-cfg-callback-url', d.callbackUrl || '');

    // Status + kunci kolom bila kredensial dipasang lewat environment server
    const stBayar = (idTeks, idInput, label, sumber, petunjuk) => {
      const teks = document.getElementById(idTeks);
      const input = document.getElementById(idInput);
      if (!teks) return;
      if (sumber === 'server') {
        teks.innerHTML = label + ': <span class="wa-pill wa-pill-ok">terpasang di server</span> ' +
          '<span class="text-sumi/50">' + (petunjuk || '') + ' — diatur lewat environment, kolom ini dinonaktifkan</span>';
        if (input) { input.disabled = true; input.placeholder = 'dikelola di server (environment variable)'; }
      } else if (sumber === 'web') {
        teks.innerHTML = label + ': <span class="wa-pill wa-pill-ok">tersimpan</span> ' +
          '<span class="text-sumi/50">' + (petunjuk || '') + ' — isi untuk mengganti</span>';
        if (input) { input.disabled = false; input.placeholder = 'sudah tersimpan — isi untuk mengganti'; }
      } else {
        teks.innerHTML = label + ': <span class="wa-pill wa-pill-off">belum ada</span>';
        if (input) { input.disabled = false; input.placeholder = 'tempel ' + label.toLowerCase() + ' di sini'; }
      }
    };
    stBayar('bayar-st-server', 'bayar-in-server', 'Server key', d.serverKeySumber, d.serverKeyPetunjuk);
    stBayar('bayar-st-client', 'bayar-in-client', 'Client key', d.clientKeySumber, d.clientKeyPetunjuk);
    stBayar('bayar-st-callback', 'bayar-in-callback', 'Callback secret', d.callbackSecretSumber, '');

    // Kartu status ringkas
    const prov = (d.provider || []).find((x) => x.id === (p.bayar_provider || 'manual'));
    const aktif = p.bayar_aktif === '1';
    document.getElementById('bayar-status-teks').textContent =
      aktif ? (prov ? prov.nama : 'Aktif') : 'Checkout Online Nonaktif';
    document.getElementById('bayar-status-pesan').textContent =
      aktif ? (d.qrisSiap ? 'QRIS siap dipakai pelanggan.' : (d.qrisAlasan || 'QRIS belum siap.')) 
            : 'Aktifkan di tab "Gateway & Metode" agar halaman /checkout bisa dipakai.';
    document.getElementById('bayar-status-pill').innerHTML =
      `<span class="wa-pill ${aktif ? 'wa-pill-ok' : 'wa-pill-off'}">checkout ${aktif ? 'aktif' : 'mati'}</span>` +
      `<span class="wa-pill ${p.bayar_cash === '1' ? 'wa-pill-ok' : 'wa-pill-off'}">tunai</span>` +
      `<span class="wa-pill ${d.qrisSiap ? 'wa-pill-ok' : 'wa-pill-off'}">qris</span>` +
      `<span class="wa-pill ${(p.bayar_mode || 'sandbox') === 'produksi' ? 'wa-pill-ok' : 'wa-pill-warn'}">${p.bayar_mode || 'sandbox'}</span>`;

    // Tombol uji hanya untuk owner
    const btnUji = document.getElementById('btn-bayar-uji');
    if (btnUji && ME && ME.role === 'owner') btnUji.classList.remove('hidden');

    aturAreaProvider();
    hitungSimulasiBiaya();
  } catch (ex) { toast(ex.message, false); }
}

/** Format timestamp D1 (UTC tanpa penanda zona) → tanggal + jam WIB. */
function waktuID(t) {
  if (!t) return '\u2014';
  const str = String(t);
  const d = new Date(str.length <= 10 ? str + 'T00:00:00' : str.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return str;
  return d.toLocaleString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
  });
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

/** Tampilkan hanya field yang relevan dengan provider terpilih. */
function aturAreaProvider() {
  const sel = document.getElementById('bayar-cfg-provider');
  if (!sel) return;
  const id = sel.value;
  const manual = id === 'manual';
  document.getElementById('bayar-cfg-manual-area').classList.toggle('hidden', !manual);
  document.getElementById('bayar-cfg-gateway-area').classList.toggle('hidden', manual);
  document.getElementById('bayar-cfg-mode').disabled = manual;

  const info = (BAYAR_CFG?.provider || []).find((x) => x.id === id);
  document.getElementById('bayar-cfg-provider-catatan').textContent = info ? info.catatan : '';

  // Pratinjau QRIS statis
  const url = document.getElementById('bayar-cfg-qris-gambar').value.trim();
  const wrap = document.getElementById('bayar-cfg-qris-pratinjau-wrap');
  if (manual && /^https?:\/\//i.test(url)) {
    document.getElementById('bayar-cfg-qris-pratinjau').src = url;
    wrap.classList.remove('hidden');
  } else { wrap.classList.add('hidden'); }
}
document.getElementById('bayar-cfg-provider')?.addEventListener('change', aturAreaProvider);
document.getElementById('bayar-cfg-qris-gambar')?.addEventListener('change', aturAreaProvider);

/** Simulasi biaya untuk subtotal contoh Rp 100.000. */
function hitungSimulasiBiaya() {
  const el = document.getElementById('bayar-simulasi');
  if (!el) return;
  const num = (id) => parseFloat(document.getElementById(id).value || '0') || 0;
  const sub = 100000;
  const persen = num('bayar-cfg-biaya-persen');
  const tetap = num('bayar-cfg-biaya-tetap');
  const bebankan = document.getElementById('bayar-cfg-biaya-mode').value === 'bebankan';
  const biaya = bebankan ? Math.round(sub * persen / 100) + tetap : 0;
  const ongkirDasar = num('bayar-cfg-ongkir');
  const gratisMin = num('bayar-cfg-ongkir-gratis');
  const ongkir = (gratisMin > 0 && sub >= gratisMin) ? 0 : ongkirDasar;
  el.textContent = `Subtotal ${rupiah(sub)} + ongkir ${rupiah(ongkir)}` +
    (gratisMin > 0 && sub >= gratisMin ? ' (gratis ongkir)' : '') +
    ` + biaya layanan ${rupiah(biaya)}` + (bebankan ? '' : ' (ditanggung usaha)') +
    ` = total bayar pelanggan ${rupiah(sub + ongkir + biaya)}`;
}
['bayar-cfg-biaya-persen', 'bayar-cfg-biaya-tetap', 'bayar-cfg-biaya-mode',
 'bayar-cfg-ongkir', 'bayar-cfg-ongkir-gratis'].forEach((id) => {
  document.getElementById(id)?.addEventListener('input', hitungSimulasiBiaya);
  document.getElementById(id)?.addEventListener('change', hitungSimulasiBiaya);
});

// ---------- Simpan: 3 form terpisah agar owner tidak takut salah pencet ----------
async function simpanBayar(payload, pesan) {
  try {
    await api('/api/admin/bayar/pengaturan', { method: 'PUT', body: JSON.stringify(payload) });
    toast(pesan + ' ✅');
    loadBayarConfig();
  } catch (ex) { toast(ex.message, false); }
}
const nilaiBayar = (id) => (document.getElementById(id).value || '').trim();
const saklarBayar = (id) => document.getElementById(id).checked ? '1' : '0';

document.getElementById('form-bayar-gateway')?.addEventListener('submit', (e) => {
  e.preventDefault();
  simpanBayar({
    bayar_aktif: saklarBayar('bayar-cfg-aktif'),
    bayar_cash: saklarBayar('bayar-cfg-cash'),
    bayar_qris: saklarBayar('bayar-cfg-qris'),
    bayar_provider: nilaiBayar('bayar-cfg-provider'),
    bayar_mode: nilaiBayar('bayar-cfg-mode'),
    bayar_merchant_kode: nilaiBayar('bayar-cfg-merchant'),
    bayar_channel: nilaiBayar('bayar-cfg-channel'),
    bayar_qris_gambar: nilaiBayar('bayar-cfg-qris-gambar'),
    bayar_qris_nama: nilaiBayar('bayar-cfg-qris-nama'),
    bayar_instruksi_cash: nilaiBayar('bayar-cfg-instruksi-cash')
  }, 'Pengaturan gateway disimpan');
});

document.getElementById('form-bayar-biaya')?.addEventListener('submit', (e) => {
  e.preventDefault();
  simpanBayar({
    bayar_biaya_mode: nilaiBayar('bayar-cfg-biaya-mode'),
    bayar_biaya_persen: nilaiBayar('bayar-cfg-biaya-persen') || '0',
    bayar_biaya_tetap: nilaiBayar('bayar-cfg-biaya-tetap') || '0',
    bayar_kedaluwarsa_menit: nilaiBayar('bayar-cfg-kedaluwarsa') || '60',
    bayar_min_qris: nilaiBayar('bayar-cfg-min-qris') || '0',
    bayar_maks_qris: nilaiBayar('bayar-cfg-maks-qris') || '10000000',
    bayar_ongkir: nilaiBayar('bayar-cfg-ongkir') || '0',
    bayar_ongkir_gratis_min: nilaiBayar('bayar-cfg-ongkir-gratis') || '0'
  }, 'Biaya & ongkir disimpan');
});

document.getElementById('form-bayar-fitur')?.addEventListener('submit', (e) => {
  e.preventDefault();
  simpanBayar({
    lacak_aktif: saklarBayar('bayar-cfg-lacak-aktif'),
    lacak_otp: saklarBayar('bayar-cfg-lacak-otp'),
    terima_otp: saklarBayar('bayar-cfg-terima-otp'),
    bayar_notif_menunggu: saklarBayar('bayar-cfg-notif-menunggu'),
    bayar_notif_lunas: saklarBayar('bayar-cfg-notif-lunas'),
    bayar_notif_internal: saklarBayar('bayar-cfg-notif-internal')
  }, 'Pengaturan fitur disimpan');
});

// ---------- Salin URL callback ----------
document.getElementById('btn-bayar-copy-callback')?.addEventListener('click', async () => {
  const url = document.getElementById('bayar-cfg-callback-url').value;
  try {
    await navigator.clipboard.writeText(url);
    toast('URL callback disalin 📋');
  } catch (ex) {
    document.getElementById('bayar-cfg-callback-url').select();
    toast('Tekan Ctrl+C untuk menyalin', false);
  }
});

// ---------- Uji gateway ----------
document.getElementById('btn-bayar-uji')?.addEventListener('click', async () => {
  const b = document.getElementById('btn-bayar-uji');
  b.disabled = true; b.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Menguji…';
  try {
    const d = await api('/api/admin/bayar/uji', { method: 'POST' });
    toast(d.pesan || 'Gateway merespons dengan baik', true);
  } catch (ex) { toast(ex.message, false); }
  finally { b.disabled = false; b.innerHTML = '<i class="fas fa-vial mr-1"></i>Uji Gateway'; }
});

// ---------- Daftar transaksi ----------
async function loadBayarTransaksi() {
  const tbl = document.getElementById('table-bayar');
  if (!tbl) return;
  const q = new URLSearchParams({
    status: document.getElementById('bayar-filter-status').value,
    metode: document.getElementById('bayar-filter-metode').value,
    cari: document.getElementById('bayar-cari').value.trim()
  });
  try {
    const d = await api('/api/admin/bayar/transaksi?' + q);
    const s = d.statistik || {};
    document.getElementById('bayar-stat-total').textContent = s.total || 0;
    document.getElementById('bayar-stat-menunggu').textContent = s.menunggu || 0;
    document.getElementById('bayar-stat-nilai').textContent = rupiah(s.nilai_lunas || 0);
    document.getElementById('bayar-stat-hari').textContent = rupiah(s.nilai_hari || 0);

    const badge = document.getElementById('badge-bayar');
    if (badge) {
      badge.textContent = s.menunggu || 0;
      badge.classList.toggle('hidden', !(s.menunggu > 0));
    }

    const baris = (d.transaksi || []).map((t) => {
      const st = BAYAR_LBL_STATUS[t.status] || [t.status, 'wa-pill-warn'];
      const bolehAksi = t.status === 'menunggu';
      const bolehTerima = t.status === 'dibayar' && !t.diterima_at;
      return `<tr>
        <td>
          <span class="font-mono text-xs">${escHtml(t.kode)}</span>
          <span class="block text-xs text-sumi/50">${escHtml(t.pesanan_kode || '-')}</span>
        </td>
        <td>
          ${escHtml(t.pelanggan || '-')}
          <span class="block text-xs text-sumi/50">${escHtml(t.wa || '-')}</span>
        </td>
        <td>
          ${escHtml(BAYAR_LBL_METODE[t.metode] || t.metode)}
          <span class="block text-xs text-sumi/50">${escHtml(t.provider || '-')}</span>
        </td>
        <td class="text-right tabular-nums">
          ${rupiah(t.jumlah)}
          ${Number(t.biaya_admin) > 0 ? `<span class="block text-xs text-sumi/50">biaya ${rupiah(t.biaya_admin)}</span>` : ''}
        </td>
        <td>
          <span class="wa-pill ${st[1]}">${st[0]}</span>
          ${t.diterima_at ? '<span class="block text-xs text-green-700 mt-1"><i class="fas fa-check"></i> diterima</span>' : ''}
        </td>
        <td class="text-xs text-sumi/60">
          ${waktuID(t.created_at)}
          ${t.dibayar_at ? `<span class="block text-green-700">lunas ${waktuID(t.dibayar_at)}</span>` : ''}
          ${t.status === 'menunggu' && t.expires_at ? `<span class="block text-kin">s/d ${waktuID(t.expires_at)}</span>` : ''}
          ${t.verifikator ? `<span class="block">oleh ${escHtml(t.verifikator)}</span>` : ''}
        </td>
        <td class="whitespace-nowrap">
          ${bolehAksi ? `<button onclick="lunasBayar(${t.id},'${escHtml(t.kode)}')" class="text-green-700 hover:underline text-xs mr-2" title="Tandai lunas"><i class="fas fa-circle-check"></i> Lunas</button>` : ''}
          ${bolehAksi ? `<button onclick="batalBayar(${t.id},'${escHtml(t.kode)}')" class="text-vermillion hover:underline text-xs mr-2" title="Batalkan"><i class="fas fa-ban"></i> Batal</button>` : ''}
          ${bolehTerima ? `<button onclick="bukaModalTerima(${t.pesanan_id},'${escHtml(t.pesanan_kode)}')" class="text-sumi/70 hover:underline text-xs" title="Konfirmasi diterima via OTP"><i class="fas fa-hand-holding-heart"></i> Terima</button>` : ''}
        </td>
      </tr>`;
    }).join('');

    tbl.innerHTML = `
      <thead><tr>
        <th>Kode</th><th>Pelanggan</th><th>Metode</th><th class="text-right">Jumlah</th>
        <th>Status</th><th>Waktu</th><th>Aksi</th>
      </tr></thead>
      <tbody>${baris || '<tr><td colspan="7" class="text-center text-sumi/50 py-6">Belum ada transaksi pembayaran.</td></tr>'}</tbody>`;
  } catch (ex) { toast(ex.message, false); }
}

['bayar-filter-status', 'bayar-filter-metode'].forEach((id) =>
  document.getElementById(id)?.addEventListener('change', loadBayarTransaksi));
let TIMER_BAYAR_CARI = null;
document.getElementById('bayar-cari')?.addEventListener('input', () => {
  clearTimeout(TIMER_BAYAR_CARI);
  TIMER_BAYAR_CARI = setTimeout(loadBayarTransaksi, 350);
});

// ---------- Aksi transaksi ----------
window.lunasBayar = async (id, kode) => {
  if (!confirm(`Tandai ${kode} sebagai LUNAS?\n\nLakukan hanya jika dana sudah benar-benar Anda terima. Tindakan ini tercatat di log aktivitas.`)) return;
  try {
    await api(`/api/admin/bayar/${id}/lunas`, { method: 'POST' });
    toast('Pembayaran ditandai lunas 💰');
    loadBayarTransaksi();
    loadNotifikasi();
  } catch (ex) { toast(ex.message, false); }
};

window.batalBayar = async (id, kode) => {
  if (!confirm(`Batalkan transaksi ${kode}?\n\nPelanggan harus checkout ulang bila ingin membayar.`)) return;
  try {
    await api(`/api/admin/bayar/${id}/batal`, { method: 'POST' });
    toast('Transaksi dibatalkan');
    loadBayarTransaksi();
  } catch (ex) { toast(ex.message, false); }
};

// ---------- Konfirmasi terima barang via OTP ----------
window.bukaModalTerima = (pesananId, kode) => {
  document.getElementById('bayar-terima-id').value = pesananId;
  document.getElementById('bayar-terima-kode').textContent = kode || '—';
  document.getElementById('bayar-terima-otp').value = '';
  bukaModal('modal-bayar-terima');
};

document.getElementById('btn-bayar-terima-kirim')?.addEventListener('click', async () => {
  const id = document.getElementById('bayar-terima-id').value;
  const b = document.getElementById('btn-bayar-terima-kirim');
  b.disabled = true; b.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Mengirim…';
  try {
    const d = await api(`/api/admin/pesanan/${id}/terima/kirim-kode`, { method: 'POST' });
    toast(`Kode dikirim ke ${d.waSensor || 'WhatsApp pelanggan'} (berlaku ${d.menit || 5} menit)`);
    document.getElementById('bayar-terima-otp').focus();
  } catch (ex) { toast(ex.message, false); }
  finally { b.disabled = false; b.innerHTML = '<i class="fab fa-whatsapp mr-1"></i>Kirim Kode ke Pelanggan'; }
});

document.getElementById('form-bayar-terima')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('bayar-terima-id').value;
  const kode = document.getElementById('bayar-terima-otp').value.replace(/\D/g, '');
  if (kode.length !== 6) return toast('Kode harus 6 angka', false);
  try {
    await api(`/api/admin/pesanan/${id}/terima`, { method: 'POST', body: JSON.stringify({ kode }) });
    toast('Pesanan dikonfirmasi diterima pelanggan ✅');
    tutupModal('modal-bayar-terima');
    loadBayarTransaksi();
    if (document.getElementById('table-pesanan')) loadPesanan();
  } catch (ex) { toast(ex.message, false); }
});

document.getElementById('bayar-terima-otp')?.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
});

// ============================================================
//  FASE 11 — Panel Otomatisasi & Pemeriksa Sistem (hasil audit)
// ============================================================

let OTOMATIS_ADA_PERBAIKAN = false;

async function loadOtomatis() {
  await Promise.all([loadOtomatisStatus(), jalankanPeriksa(), loadLibur(), loadBuku(),
    loadOpname(), loadAset(), loadEksporRiwayat()]);
}

// ---------- Status & denyut ----------
async function loadOtomatisStatus() {
  try {
    const d = await api('/api/admin/otomatis');

    // Denyut = bukti sistem hidup
    const umur = d.denyut.umurMenit;
    const teksUmur = umur === null ? 'belum pernah'
      : umur < 60 ? `${umur} menit lalu`
      : umur < 1440 ? `${Math.round(umur / 60)} jam lalu`
      : `${Math.round(umur / 1440)} hari lalu`;
    const sehat = d.denyut.sehat;
    document.getElementById('otomatis-denyut').innerHTML = `
      <div class="flex items-center gap-3 rounded-xl p-3 ${sehat ? 'bg-green-50' : 'bg-amber-50'}">
        <i class="fas ${sehat ? 'fa-circle-check text-green-600' : 'fa-triangle-exclamation text-amber-600'} text-xl"></i>
        <div class="flex-1">
          <p class="font-semibold text-sm">${sehat ? 'Otomatisasi berjalan normal' : 'Otomatisasi belum berjalan hari ini'}</p>
          <p class="text-xs text-sumi/50">Terakhir aktif: ${teksUmur}${d.denyut.sumber ? ` · dipicu oleh ${escHtml(d.denyut.sumber)}` : ''}</p>
        </div>
        ${ME?.role === 'owner' ? '<button id="btn-oto-jalankan" type="button" class="text-xs bg-white border border-sumi/20 rounded-full px-3 py-1.5 hover:border-vermillion"><i class="fas fa-play mr-1"></i>Jalankan Sekarang</button>' : ''}
      </div>`;

    document.getElementById('btn-oto-jalankan')?.addEventListener('click', async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      b.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Menjalankan…';
      try {
        await api('/api/admin/otomatis/jalankan', { method: 'POST', body: JSON.stringify({ tugas: 'semua' }) });
        toast('Semua tugas otomatis dijalankan.');
        await loadOtomatis();
      } catch (err) { toast(err.message, false); b.disabled = false; }
    });

    // Daftar tugas
    document.getElementById('otomatis-tugas').innerHTML = d.tugas.map((t) => {
      const mati = !t.aktif;
      const waKurang = t.butuhWA && t.aktif && !d.waSiap;
      return `
      <div class="flex items-start gap-3 rounded-xl border ${mati ? 'border-sumi/10 bg-sumi/5' : 'border-green-200 bg-white'} p-3">
        <i class="fas ${mati ? 'fa-toggle-off text-sumi/30' : 'fa-toggle-on text-green-600'} text-lg mt-0.5"></i>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-sm">${escHtml(t.nama)}
            ${t.butuhWA ? '<span class="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full ml-1"><i class="fab fa-whatsapp"></i> WA</span>' : ''}
            ${mati ? '<span class="text-[10px] bg-sumi/10 text-sumi/50 px-1.5 py-0.5 rounded-full ml-1">nonaktif</span>' : ''}
          </p>
          <p class="text-xs text-sumi/50 mt-0.5">${escHtml(t.jelas)}</p>
          ${waKurang ? '<p class="text-xs text-amber-700 mt-1"><i class="fas fa-triangle-exclamation mr-1"></i>WhatsApp belum tersambung — tugas ini tidak akan mengirim pesan.</p>' : ''}
          ${t.terakhir ? `<p class="text-[11px] text-sumi/35 mt-1">Terakhir: ${escHtml(t.terakhir)}</p>` : ''}
        </div>
      </div>`;
    }).join('');

    // Isi form aturan
    const p = d.pengaturan;
    document.getElementById('oto-jam').value = p.jamPengingat;
    document.getElementById('oto-sapu').value = p.sapuHari;
    document.getElementById('oto-ingat').value = p.ingatJam;
    const elTgl = document.getElementById('oto-tutup-tgl');
    if (elTgl) elTgl.value = p.tutupTanggal ?? 5;
    const elTol = document.getElementById('oto-opname-tol');
    if (elTol) elTol.value = p.opnameToleransi ?? 5000;
    const cek = (id, kode) => {
      const t = d.tugas.find((x) => x.kode === kode);
      const el = document.getElementById(id);
      if (el && t) el.checked = !!t.aktif;
    };
    cek('oto-alpa', 'alpa');
    cek('oto-jual', 'jual');
    cek('oto-ongkir', 'ongkir');
    cek('oto-sapu-aktif', 'sapu');
    cek('oto-ingat-aktif', 'ingat');
    cek('oto-ringkasan', 'ringkasan');
    cek('oto-piutang', 'piutang');
    cek('oto-baglog', 'baglog');
    cek('oto-tutupbuku', 'tutupbuku');
    cek('oto-rekap', 'rekap');
    cek('oto-penyusutan', 'penyusutan');
    cek('oto-opname', 'opname');
    const elRekon = document.getElementById('oto-rekonkas');
    if (elRekon) elRekon.checked = d.pengaturan.rekonKas !== false;
  } catch (e) { toast(e.message, false); }
}

// ---------- Simpan aturan ----------
document.getElementById('form-otomatis')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const b = e.target.querySelector('button[type="submit"]');
  b.disabled = true;
  try {
    await api('/api/admin/otomatis', {
      method: 'PUT',
      body: JSON.stringify({
        openwa_jam_pengingat: document.getElementById('oto-jam').value,
        otomatis_sapu_hari: document.getElementById('oto-sapu').value,
        otomatis_ingat_jam: document.getElementById('oto-ingat').value,
        absen_auto_alpa: document.getElementById('oto-alpa').checked ? '1' : '0',
        otomatis_jual_lunas: document.getElementById('oto-jual').checked ? '1' : '0',
        otomatis_catat_ongkir: document.getElementById('oto-ongkir').checked ? '1' : '0',
        otomatis_sapu_pesanan: document.getElementById('oto-sapu-aktif').checked ? '1' : '0',
        otomatis_ingat_pesanan: document.getElementById('oto-ingat-aktif').checked ? '1' : '0',
        openwa_notif_ringkasan: document.getElementById('oto-ringkasan').checked ? '1' : '0',
        openwa_notif_piutang: document.getElementById('oto-piutang').checked ? '1' : '0',
        otomatis_tutup_tanggal: document.getElementById('oto-tutup-tgl')?.value || '5',
        otomatis_baglog_biaya: document.getElementById('oto-baglog')?.checked ? '1' : '0',
        otomatis_tutup_buku: document.getElementById('oto-tutupbuku')?.checked ? '1' : '0',
        otomatis_rekap_bulanan: document.getElementById('oto-rekap')?.checked ? '1' : '0',
        otomatis_rekon_kas: document.getElementById('oto-rekonkas')?.checked ? '1' : '0',
        otomatis_penyusutan: document.getElementById('oto-penyusutan')?.checked ? '1' : '0',
        otomatis_opname_ingat: document.getElementById('oto-opname')?.checked ? '1' : '0',
        kas_opname_toleransi: document.getElementById('oto-opname-tol')?.value || '5000'
      })
    });
    toast('Aturan otomatisasi disimpan.');
    await loadOtomatisStatus();
  } catch (err) { toast(err.message, false); }
  b.disabled = false;
});

// ---------- Pemeriksa integritas ----------
async function jalankanPeriksa() {
  const box = document.getElementById('periksa-hasil');
  if (!box) return;
  box.innerHTML = '<p class="text-sm text-sumi/40"><i class="fas fa-spinner fa-spin mr-1"></i>Memeriksa…</p>';
  try {
    const d = await api('/api/admin/otomatis/periksa');
    OTOMATIS_ADA_PERBAIKAN = d.temuan.some((t) => t.autoPerbaiki);
    document.getElementById('btn-perbaiki')?.classList.toggle('hidden', !OTOMATIS_ADA_PERBAIKAN);

    // Badge sidebar: jumlah temuan kritis+peringatan
    const perlu = d.ringkas.kritis + d.ringkas.peringatan;
    const badge = document.getElementById('badge-otomatis');
    if (badge) { badge.textContent = perlu; badge.classList.toggle('hidden', perlu === 0); }

    // Kelas ditulis utuh (bukan disusun dinamis) agar pasti ikut ter-build Tailwind
    const skorGaya = d.nilai >= 90
      ? { bg: 'bg-green-50', tx: 'text-green-700' }
      : d.nilai >= 70
        ? { bg: 'bg-amber-50', tx: 'text-amber-700' }
        : { bg: 'bg-red-50', tx: 'text-red-700' };
    const kepala = `
      <div class="flex items-center gap-4 rounded-xl ${skorGaya.bg} p-4">
        <div class="text-center shrink-0">
          <p class="text-3xl font-bold ${skorGaya.tx}">${d.nilai}</p>
          <p class="text-[10px] ${skorGaya.tx} opacity-70 uppercase tracking-wide">Skor</p>
        </div>
        <div class="flex-1">
          <p class="font-semibold text-sm">${d.sehat ? 'Semua data konsisten' : `${d.temuan.length} hal perlu diperhatikan`}</p>
          <p class="text-xs text-sumi/50 mt-0.5">${d.diperiksa} pemeriksaan dijalankan · ${d.ringkas.kritis} kritis, ${d.ringkas.peringatan} peringatan, ${d.ringkas.info} info</p>
        </div>
      </div>`;

    if (d.sehat) {
      box.innerHTML = kepala + '<p class="text-sm text-sumi/50 text-center py-3"><i class="fas fa-circle-check text-green-600 mr-1"></i>Tidak ada uang, stok, atau pesanan yang tercatat aneh.</p>';
      return;
    }

    const gaya = {
      kritis: { bg: 'bg-red-50', ic: 'fa-circle-exclamation text-red-600', tag: 'bg-red-600' },
      peringatan: { bg: 'bg-amber-50', ic: 'fa-triangle-exclamation text-amber-600', tag: 'bg-amber-600' },
      info: { bg: 'bg-blue-50', ic: 'fa-circle-info text-blue-600', tag: 'bg-blue-600' }
    };
    box.innerHTML = kepala + d.temuan.map((t) => {
      const g = gaya[t.tingkat];
      return `
      <div class="flex items-start gap-3 rounded-xl ${g.bg} p-3">
        <i class="fas ${g.ic} mt-0.5"></i>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium">
            <span class="text-[10px] text-white ${g.tag} px-1.5 py-0.5 rounded-full mr-1 uppercase">${t.tingkat}</span>
            ${escHtml(t.pesan)} <span class="text-sumi/50">(${t.jumlah})</span>
          </p>
          <p class="text-xs text-sumi/55 mt-1"><i class="fas fa-lightbulb text-kin mr-1"></i>${escHtml(t.saran)}</p>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    box.innerHTML = `<p class="text-sm text-red-700">${escHtml(e.message)}</p>`;
  }
}

document.getElementById('btn-periksa')?.addEventListener('click', jalankanPeriksa);

document.getElementById('btn-perbaiki')?.addEventListener('click', async (e) => {
  const b = e.currentTarget;
  if (!confirm('Sistem akan mencatat penjualan yang tertinggal dan menutup tagihan kedaluwarsa. Lanjutkan?')) return;
  b.disabled = true;
  b.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Memperbaiki…';
  try {
    const r = await api('/api/admin/otomatis/perbaiki', { method: 'POST' });
    toast(`Selesai: ${r.penjualanDicatat} penjualan dicatat, ${r.tagihanDitutup} tagihan ditutup.`);
    await jalankanPeriksa();
  } catch (err) { toast(err.message, false); }
  b.disabled = false;
  b.innerHTML = '<i class="fas fa-wand-magic-sparkles mr-1"></i>Perbaiki Otomatis';
});

// ---------- Hari libur ----------
async function loadLibur() {
  const box = document.getElementById('libur-list');
  if (!box) return;
  try {
    const { libur } = await api('/api/admin/libur');
    if (!libur.length) {
      box.innerHTML = '<p class="text-sm text-sumi/40 text-center py-3">Belum ada hari libur terdaftar.</p>';
      return;
    }
    box.innerHTML = libur.map((l) => `
      <div class="flex items-center justify-between gap-3 bg-washi rounded-lg px-3 py-2">
        <div class="min-w-0">
          <p class="text-sm font-medium">${tglID(l.tanggal)}</p>
          <p class="text-xs text-sumi/50">${escHtml(l.keterangan || 'Libur')}</p>
        </div>
        <button type="button" class="text-red-600 hover:text-red-800 text-sm shrink-0" data-hapus-libur="${escHtml(l.tanggal)}" aria-label="Hapus">
          <i class="fas fa-trash"></i>
        </button>
      </div>`).join('');

    box.querySelectorAll('[data-hapus-libur]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const t = btn.dataset.hapusLibur;
        if (!confirm(`Hapus hari libur ${tglID(t)}?`)) return;
        try {
          await api('/api/admin/libur/' + encodeURIComponent(t), { method: 'DELETE' });
          toast('Hari libur dihapus.');
          await loadLibur();
        } catch (e) { toast(e.message, false); }
      });
    });
  } catch (e) { box.innerHTML = `<p class="text-sm text-red-700">${escHtml(e.message)}</p>`; }
}

document.getElementById('btn-libur-tambah')?.addEventListener('click', async () => {
  const tgl = document.getElementById('libur-tanggal').value;
  const ket = document.getElementById('libur-ket').value.trim();
  if (!tgl) return toast('Pilih tanggal dulu.', false);
  try {
    const r = await api('/api/admin/libur', { method: 'POST', body: JSON.stringify({ tanggal: tgl, keterangan: ket }) });
    toast(r.alpaDibatalkan > 0
      ? `Hari libur ditambah. ${r.alpaDibatalkan} penandaan alpa dibatalkan.`
      : 'Hari libur ditambah.');
    document.getElementById('libur-ket').value = '';
    await loadLibur();
  } catch (e) { toast(e.message, false); }
});

// ============================================================
//  FASE 12 — Tutup Buku & Rekonsiliasi Kas
// ============================================================

const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'];

/** '2026-08' -> 'Agustus 2026' */
function labelPeriode(p) {
  if (!p || p.length < 7) return p || '-';
  const b = parseInt(p.slice(5, 7), 10);
  return `${namaBulan[b - 1] || p.slice(5, 7)} ${p.slice(0, 4)}`;
}

async function loadBuku() {
  const box = document.getElementById('buku-list');
  const kotakBerjalan = document.getElementById('buku-berjalan');
  if (!box) return;
  try {
    const d = await api('/api/admin/buku');
    const isOwner = ME?.role === 'owner';

    // --- Ringkasan bulan berjalan + bulan lalu yang belum ditutup ---
    const b = d.berjalan || {};
    let html = `
      <div class="rounded-xl border border-sumi/10 bg-washi p-4">
        <p class="text-xs uppercase tracking-wide text-sumi/50 mb-2">Bulan berjalan · ${labelPeriode(b.periode)}
          <span class="ml-1 text-[10px] bg-sumi/10 px-1.5 py-0.5 rounded-full">masih terbuka</span></p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><p class="text-xs text-sumi/45">Omzet</p><p class="font-semibold">${rupiah(b.omzet)}</p></div>
          <div><p class="text-xs text-sumi/45">Pemasukan lain</p><p class="font-semibold">${rupiah(b.pemasukanLain)}</p></div>
          <div><p class="text-xs text-sumi/45">Pengeluaran</p><p class="font-semibold">${rupiah(b.pengeluaran)}</p></div>
          <div><p class="text-xs text-sumi/45">Laba/rugi</p>
            <p class="font-semibold ${(b.laba || 0) < 0 ? 'text-red-700' : 'text-green-700'}">${rupiah(b.laba)}</p></div>
        </div>
      </div>`;

    if (d.perluTutup && d.lalu) {
      const l = d.lalu;
      html += `
      <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 mt-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="font-semibold text-sm text-amber-900">
              <i class="fas fa-triangle-exclamation mr-1"></i>${labelPeriode(l.periode)} belum ditutup</p>
            <p class="text-xs text-amber-800/80 mt-1">
              Omzet ${rupiah(l.omzet)} · Pengeluaran ${rupiah(l.pengeluaran)} ·
              Laba <strong>${rupiah(l.laba)}</strong>. Selama belum ditutup, angka ini masih bisa berubah.</p>
          </div>
          ${isOwner ? `<button type="button" class="btn-tambah-matcha shrink-0" data-tutup="${l.periode}">
            <i class="fas fa-lock mr-1"></i>Tutup Buku</button>` : ''}
        </div>
      </div>`;
    }
    kotakBerjalan.innerHTML = html;

    // --- Daftar periode yang sudah ditutup ---
    const list = d.ditutup || [];
    box.innerHTML = list.length === 0
      ? '<p class="text-sm text-sumi/40">Belum ada bulan yang ditutup.</p>'
      : `<p class="text-xs uppercase tracking-wide text-sumi/50 mb-1">Sudah dikunci</p>` + list.map((t) => `
        <div class="flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50/60 p-3">
          <i class="fas fa-lock text-green-700"></i>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-sm">${labelPeriode(t.periode)}
              ${t.otomatis ? '<span class="text-[10px] bg-matcha/15 text-matcha px-1.5 py-0.5 rounded-full ml-1">otomatis</span>'
                           : '<span class="text-[10px] bg-sumi/10 text-sumi/60 px-1.5 py-0.5 rounded-full ml-1">manual</span>'}</p>
            <p class="text-xs text-sumi/55 mt-0.5">
              Omzet ${rupiah(t.omzet)} · Pengeluaran ${rupiah(t.pengeluaran)} ·
              Laba <strong class="${(t.laba || 0) < 0 ? 'text-red-700' : 'text-green-700'}">${rupiah(t.laba)}</strong>
              · Kas masuk ${rupiah(t.kas_masuk)} · Piutang ${rupiah(t.piutang_akhir)}</p>
            <p class="text-[11px] text-sumi/35 mt-0.5">Ditutup ${escHtml(String(t.ditutup_at || '').slice(0, 16))}${t.oleh ? ` oleh ${escHtml(t.oleh)}` : ''}</p>
          </div>
          ${isOwner ? `<button type="button" class="text-xs border border-red-200 text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-full transition shrink-0" data-buka="${t.periode}">
            <i class="fas fa-lock-open mr-1"></i>Buka Kembali</button>` : ''}
        </div>`).join('');

    // --- Aksi: tutup ---
    document.querySelectorAll('[data-tutup]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const periode = e.currentTarget.dataset.tutup;
        if (!confirm(`Tutup buku ${labelPeriode(periode)}?\n\nSetelah ditutup, tidak ada data baru yang bisa masuk ke bulan itu. Pastikan semua nota, pengeluaran, dan panen sudah dicatat.`)) return;
        e.currentTarget.disabled = true;
        try {
          await api('/api/admin/buku/tutup', { method: 'POST', body: JSON.stringify({ periode }) });
          toast(`Buku ${labelPeriode(periode)} berhasil ditutup.`);
          await loadBuku();
        } catch (err) { toast(err.message, false); e.currentTarget.disabled = false; }
      });
    });

    // --- Aksi: buka kembali ---
    document.querySelectorAll('[data-buka]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const periode = e.currentTarget.dataset.buka;
        if (!confirm(`Buka kembali buku ${labelPeriode(periode)}?\n\nLaporan bulan itu bisa berubah lagi. Lakukan hanya untuk memperbaiki kesalahan pencatatan.`)) return;
        e.currentTarget.disabled = true;
        try {
          await api(`/api/admin/buku/${periode}`, { method: 'DELETE' });
          toast(`Buku ${labelPeriode(periode)} dibuka kembali.`);
          await loadBuku();
        } catch (err) { toast(err.message, false); e.currentTarget.disabled = false; }
      });
    });
  } catch (e) {
    box.innerHTML = `<p class="text-sm text-red-700">${escHtml(e.message)}</p>`;
  }
}

document.getElementById('btn-buku-segar')?.addEventListener('click', () => loadBuku());

// ---------- Rekonsiliasi kas ----------
document.getElementById('btn-rekon')?.addEventListener('click', async () => {
  const box = document.getElementById('rekon-hasil');
  const periode = document.getElementById('rekon-periode').value;
  if (!periode) return toast('Pilih bulan dulu.', false);
  box.innerHTML = '<p class="text-sm text-sumi/40"><i class="fas fa-spinner fa-spin mr-1"></i>Memeriksa kas…</p>';
  try {
    const d = await api(`/api/admin/buku/rekonsiliasi?periode=${encodeURIComponent(periode)}`);
    const cocok = d.cocok;
    let html = `
      <div class="rounded-xl p-4 ${cocok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}">
        <p class="font-semibold text-sm ${cocok ? 'text-green-800' : 'text-red-800'}">
          <i class="fas ${cocok ? 'fa-circle-check' : 'fa-circle-exclamation'} mr-1"></i>
          ${cocok ? 'Kas cocok dengan pembukuan' : `Ada selisih ${rupiah(Math.abs(d.selisih))}`}</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mt-3">
          <div><p class="text-xs text-sumi/45">Uang diterima</p><p class="font-semibold">${rupiah(d.gatewayDiterima)}</p></div>
          <div><p class="text-xs text-sumi/45">Tercatat di buku</p><p class="font-semibold">${rupiah(d.terbukukan)}</p></div>
          <div><p class="text-xs text-sumi/45">Selisih</p>
            <p class="font-semibold ${cocok ? '' : 'text-red-700'}">${rupiah(d.selisih)}</p></div>
        </div>
        ${cocok ? '' : '<p class="text-xs text-red-800/80 mt-3">Uang yang masuk tidak sama dengan yang tercatat. Periksa pesanan di bawah, lalu jalankan <strong>Perbaiki Otomatis</strong> di kartu Kesehatan Sistem.</p>'}
      </div>`;

    if ((d.rincian || []).length) {
      html += `<div class="mt-3 space-y-2">
        <p class="text-xs uppercase tracking-wide text-sumi/50">Pesanan yang tidak cocok</p>
        ${d.rincian.map((r) => `
          <div class="flex flex-wrap items-center gap-2 text-xs rounded-lg border border-sumi/10 p-2.5">
            <span class="font-mono font-semibold">${escHtml(r.pesanan || '-')}</span>
            <span class="text-sumi/50">diterima ${rupiah(r.diterima)}</span>
            <span class="text-sumi/50">·</span>
            <span class="text-sumi/50">dibukukan ${rupiah(r.terbukukan)}</span>
            <span class="ml-auto font-semibold text-red-700">${rupiah(r.selisih)}</span>
          </div>`).join('')}
      </div>`;
    }
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = `<p class="text-sm text-red-700">${escHtml(e.message)}</p>`;
  }
});

// ============================================================
//  FASE 13 — Kas Opname, Aset Tetap & Ekspor Buku Besar
// ============================================================

/** Tanggal hari ini menurut WIB, format YYYY-MM-DD */
function hariIniWIBstr() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
/** Bulan ini menurut WIB, format YYYY-MM */
function bulanIniWIBstr() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7);
}

// ---------- Kas Opname ----------
async function loadOpname() {
  const ring = document.getElementById('opname-ringkas');
  const riw = document.getElementById('opname-riwayat');
  if (!ring) return;
  try {
    const d = await api('/api/admin/kas/opname');
    const s = d.saldo || {};

    // Prefill form: tanggal hari ini, uang fisik dari opname hari ini bila ada
    const elTgl = document.getElementById('opname-tanggal');
    if (elTgl && !elTgl.value) elTgl.value = d.tanggal || hariIniWIBstr();
    const elFisik = document.getElementById('opname-fisik');
    if (elFisik && d.hariIni) elFisik.value = d.hariIni.saldo_fisik;
    const elCat = document.getElementById('opname-catatan');
    if (elCat && d.hariIni) elCat.value = d.hariIni.catatan || '';

    ring.innerHTML = `
      <div class="rounded-xl border border-sumi/10 bg-washi p-4">
        <p class="text-xs uppercase tracking-wide text-sumi/50 mb-2">
          Saldo kas menurut sistem · per ${escHtml(d.tanggal || '-')}</p>
        <p class="text-2xl font-semibold ${s.saldoSistem < 0 ? 'text-red-700' : ''}">${rupiah(s.saldoSistem)}</p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mt-3 pt-3 border-t border-sumi/10">
          <div><p class="text-xs text-sumi/45">Saldo awal</p><p class="font-semibold">${rupiah(s.saldoAwal)}</p></div>
          <div><p class="text-xs text-sumi/45">Uang masuk</p><p class="font-semibold text-green-700">${rupiah(s.masuk)}</p></div>
          <div><p class="text-xs text-sumi/45">Uang keluar</p><p class="font-semibold text-red-700">${rupiah(s.keluar)}</p></div>
          <div><p class="text-xs text-sumi/45">Toleransi</p><p class="font-semibold">${rupiah(d.toleransi)}</p></div>
        </div>
        <p class="text-xs text-sumi/40 mt-2">Dihitung sejak opname terakhir: ${escHtml(s.sejak || '-')}</p>
      </div>`;

    // Status opname hari ini
    if (d.hariIni) {
      const sel = Number(d.hariIni.selisih);
      const wajar = Math.abs(sel) <= Number(d.toleransi || 0);
      ring.innerHTML += `
        <div class="mt-3 rounded-xl p-4 ${wajar ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}">
          <p class="font-semibold text-sm ${wajar ? 'text-green-800' : 'text-red-800'}">
            <i class="fas ${wajar ? 'fa-circle-check' : 'fa-circle-exclamation'} mr-1"></i>
            ${wajar ? 'Kas hari ini sudah dihitung dan cocok'
                    : `Selisih ${rupiah(Math.abs(sel))} — ${sel < 0 ? 'uang KURANG' : 'uang LEBIH'} dari catatan`}</p>
          ${wajar ? '' : '<p class="text-xs text-red-800/80 mt-2">Periksa nota yang belum dicatat, kembalian, atau pengeluaran yang lupa dimasukkan.</p>'}
        </div>`;
    } else {
      ring.innerHTML += `
        <div class="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p class="font-semibold text-sm text-amber-800"><i class="fas fa-triangle-exclamation mr-1"></i>
            Kas hari ini belum dihitung</p>
          <p class="text-xs text-amber-800/80 mt-1">Hitung uang fisik di kasir, lalu isi form di bawah.</p>
        </div>`;
    }

    // Riwayat
    if (!riw) return;
    if (!(d.riwayat || []).length) {
      riw.innerHTML = '<p class="text-sm text-sumi/40">Belum ada riwayat opname.</p>';
      return;
    }
    riw.innerHTML = `
      <p class="text-xs uppercase tracking-wide text-sumi/50">Riwayat opname</p>
      ${d.riwayat.map((r) => {
        const sel = Number(r.selisih);
        const ok = Math.abs(sel) <= Number(d.toleransi || 0);
        return `<div class="flex flex-wrap items-center gap-2 text-xs rounded-lg border border-sumi/10 p-2.5">
          <span class="font-semibold">${escHtml(r.tanggal)}</span>
          <span class="text-sumi/50">sistem ${rupiah(r.saldo_sistem)}</span>
          <span class="text-sumi/30">·</span>
          <span class="text-sumi/50">fisik ${rupiah(r.saldo_fisik)}</span>
          ${r.catatan ? `<span class="text-sumi/40 italic">"${escHtml(r.catatan)}"</span>` : ''}
          <span class="ml-auto font-semibold ${ok ? 'text-green-700' : 'text-red-700'}">${rupiah(sel)}</span>
        </div>`;
      }).join('')}`;
  } catch (e) {
    ring.innerHTML = `<p class="text-sm text-red-700">${escHtml(e.message)}</p>`;
  }
}

document.getElementById('btn-opname-segar')?.addEventListener('click', () => loadOpname());

document.getElementById('form-opname')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const b = e.target.querySelector('button[type="submit"]');
  b.disabled = true;
  try {
    const d = await api('/api/admin/kas/opname', {
      method: 'POST',
      body: JSON.stringify({
        tanggal: document.getElementById('opname-tanggal').value,
        saldo_fisik: parseInt(document.getElementById('opname-fisik').value || '0', 10),
        catatan: document.getElementById('opname-catatan').value
      })
    });
    const sel = Number(d.selisih);
    if (d.wajar) toast(`Opname tersimpan. Selisih ${rupiah(sel)} — masih wajar.`);
    else toast(`Opname tersimpan. SELISIH ${rupiah(Math.abs(sel))} (${sel < 0 ? 'kurang' : 'lebih'}) — segera diperiksa!`, false);
    await Promise.all([loadOpname(), jalankanPeriksa()]);
  } catch (err) { toast(err.message, false); }
  b.disabled = false;
});

// ---------- Aset Tetap & Penyusutan ----------
const labelKategoriAset = {
  bangunan: 'Bangunan / Kumbung', peralatan: 'Peralatan', mesin: 'Mesin',
  kendaraan: 'Kendaraan', lainnya: 'Lainnya'
};
const labelStatusAset = {
  aktif: 'Aktif disusutkan', lunas_susut: 'Selesai disusutkan',
  dijual: 'Sudah dijual', rusak: 'Rusak / tidak dipakai'
};

async function loadAset() {
  const box = document.getElementById('aset-list');
  const tot = document.getElementById('aset-total');
  if (!box) return;
  try {
    const d = await api('/api/admin/aset');
    const isOwner = ME?.role === 'owner';
    const t = d.total || {};

    if (tot) tot.innerHTML = `
      <div class="rounded-xl border border-sumi/10 bg-washi p-4">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><p class="text-xs text-sumi/45">Total harga beli</p><p class="font-semibold">${rupiah(t.hargaBeli)}</p></div>
          <div><p class="text-xs text-sumi/45">Sudah disusutkan</p><p class="font-semibold text-red-700">${rupiah(t.akumulasi)}</p></div>
          <div><p class="text-xs text-sumi/45">Nilai buku sekarang</p><p class="font-semibold text-matcha">${rupiah(t.nilaiBuku)}</p></div>
          <div><p class="text-xs text-sumi/45">Penyusutan / bulan</p><p class="font-semibold">${rupiah(t.susutBulanan)}</p></div>
        </div>
      </div>`;

    if (!(d.aset || []).length) {
      box.innerHTML = '<p class="text-sm text-sumi/40">Belum ada aset tetap. Tambahkan lewat form di bawah.</p>';
      return;
    }

    box.innerHTML = d.aset.map((a) => {
      const persen = a.harga_beli > 0 ? Math.min(100, Math.round((a.akumulasi / a.harga_beli) * 100)) : 0;
      const aktif = a.status === 'aktif';
      return `
      <div class="rounded-xl border border-sumi/10 p-3.5">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-semibold text-sm">${escHtml(a.nama)}
              <span class="ml-1 text-[10px] bg-sumi/10 px-1.5 py-0.5 rounded-full align-middle">${escHtml(labelKategoriAset[a.kategori] || a.kategori)}</span>
              <span class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full align-middle ${aktif ? 'bg-green-100 text-green-800' : 'bg-sumi/10 text-sumi/60'}">${escHtml(labelStatusAset[a.status] || a.status)}</span>
            </p>
            <p class="text-xs text-sumi/45 mt-0.5">Dibeli ${escHtml(a.tanggal_beli)} · ${rupiah(a.harga_beli)} · umur ${a.umur_bulan} bln${a.nilai_residu > 0 ? ` · sisa akhir ${rupiah(a.nilai_residu)}` : ''}</p>
            ${a.catatan ? `<p class="text-xs text-sumi/40 italic mt-0.5">"${escHtml(a.catatan)}"</p>` : ''}
          </div>
          ${isOwner ? `<div class="flex gap-1.5 shrink-0">
            <button type="button" class="btn-aset-status text-xs border border-sumi/20 rounded-full px-2.5 py-1 hover:border-vermillion" data-id="${a.id}" data-status="${escHtml(a.status)}"><i class="fas fa-pen-to-square"></i></button>
            <button type="button" class="btn-aset-hapus text-xs border border-sumi/20 rounded-full px-2.5 py-1 hover:border-red-500 hover:text-red-600" data-id="${a.id}" data-nama="${escHtml(a.nama)}"><i class="fas fa-trash"></i></button>
          </div>` : ''}
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-3 pt-3 border-t border-sumi/10">
          <div><p class="text-sumi/45">Susut/bulan</p><p class="font-semibold">${rupiah(a.susutPerBulan)}</p></div>
          <div><p class="text-sumi/45">Akumulasi</p><p class="font-semibold text-red-700">${rupiah(a.akumulasi)}</p></div>
          <div><p class="text-sumi/45">Nilai buku</p><p class="font-semibold text-matcha">${rupiah(a.nilaiBuku)}</p></div>
          <div><p class="text-sumi/45">Sisa umur</p><p class="font-semibold">${a.sisaBulan} bln</p></div>
        </div>
        <div class="mt-2">
          <div class="h-1.5 bg-sumi/10 rounded-full overflow-hidden">
            <div class="h-full bg-vermillion rounded-full" style="width:${persen}%"></div>
          </div>
          <p class="text-[10px] text-sumi/40 mt-1">${persen}% nilai sudah disusutkan (${a.bulan_disusut} bulan tercatat)</p>
        </div>
      </div>`;
    }).join('');

    // Tombol ubah status
    box.querySelectorAll('.btn-aset-status').forEach((b) => {
      b.addEventListener('click', async () => {
        const pilih = prompt('Status baru — tulis salah satu:\naktif / lunas_susut / dijual / rusak', b.dataset.status);
        if (!pilih) return;
        try {
          await api(`/api/admin/aset/${b.dataset.id}/status`, {
            method: 'PUT', body: JSON.stringify({ status: pilih.trim() })
          });
          toast('Status aset diperbarui.');
          await loadAset();
        } catch (e) { toast(e.message, false); }
      });
    });

    // Tombol hapus
    box.querySelectorAll('.btn-aset-hapus').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm(`Hapus aset "${b.dataset.nama}"?\n\nAset yang sudah pernah disusutkan TIDAK bisa dihapus (jejak akuntansi dijaga).`)) return;
        try {
          await api(`/api/admin/aset/${b.dataset.id}`, { method: 'DELETE' });
          toast('Aset dihapus.');
          await loadAset();
        } catch (e) { toast(e.message, false); }
      });
    });
  } catch (e) {
    box.innerHTML = `<p class="text-sm text-red-700">${escHtml(e.message)}</p>`;
  }
}

document.getElementById('btn-aset-segar')?.addEventListener('click', () => loadAset());

document.getElementById('form-aset')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const b = e.target.querySelector('button[type="submit"]');
  b.disabled = true;
  try {
    const d = await api('/api/admin/aset', {
      method: 'POST',
      body: JSON.stringify({
        nama: document.getElementById('aset-nama').value,
        kategori: document.getElementById('aset-kategori').value,
        tanggal_beli: document.getElementById('aset-tanggal').value,
        harga_beli: parseInt(document.getElementById('aset-harga').value || '0', 10),
        nilai_residu: parseInt(document.getElementById('aset-residu').value || '0', 10),
        umur_bulan: parseInt(document.getElementById('aset-umur').value || '60', 10),
        catatan: document.getElementById('aset-catatan').value
      })
    });
    toast(`Aset ditambahkan. Penyusutan ${rupiah(d.susutPerBulan)}/bulan.`);
    e.target.reset();
    document.getElementById('aset-residu').value = '0';
    document.getElementById('aset-umur').value = '60';
    await loadAset();
  } catch (err) { toast(err.message, false); }
  b.disabled = false;
});

// ---------- Ekspor Buku Besar (CSV) ----------
async function loadEksporRiwayat() {
  const box = document.getElementById('ekspor-riwayat');
  if (!box) return;
  const elP = document.getElementById('ekspor-periode');
  if (elP && !elP.value) elP.value = bulanIniWIBstr();
  try {
    const d = await api('/api/admin/buku/ekspor/riwayat');
    if (!(d.riwayat || []).length) {
      box.innerHTML = '<p class="text-sm text-sumi/40">Belum pernah ekspor.</p>';
      return;
    }
    box.innerHTML = `
      <p class="text-xs uppercase tracking-wide text-sumi/50 mb-2">Riwayat ekspor</p>
      <div class="space-y-1.5">
        ${d.riwayat.map((r) => `
          <div class="flex flex-wrap items-center gap-2 text-xs rounded-lg border border-sumi/10 p-2.5">
            <span class="font-semibold">${escHtml(labelPeriode(r.periode))}</span>
            <span class="text-sumi/50">${r.baris} baris</span>
            <span class="text-sumi/30">·</span>
            <span class="text-sumi/40">${escHtml(String(r.created_at || '').slice(0, 16))}</span>
            <span class="ml-auto uppercase text-sumi/40">${escHtml(r.format || 'csv')}</span>
          </div>`).join('')}
      </div>`;
  } catch (e) {
    box.innerHTML = `<p class="text-sm text-red-700">${escHtml(e.message)}</p>`;
  }
}

document.getElementById('btn-ekspor')?.addEventListener('click', async () => {
  const periode = document.getElementById('ekspor-periode').value;
  if (!periode) return toast('Pilih bulan dulu.', false);
  const b = document.getElementById('btn-ekspor');
  b.disabled = true;
  try {
    // Diunduh lewat fetch agar error server bisa ditampilkan sebagai toast,
    // bukan halaman JSON mentah di tab baru.
    const r = await fetch(`/api/admin/buku/ekspor?periode=${encodeURIComponent(periode)}`, { credentials: 'same-origin' });
    if (!r.ok) {
      let msg = 'Ekspor gagal.';
      try { msg = (await r.json()).error || msg; } catch {}
      throw new Error(msg);
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buku-besar-${periode}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('File CSV terunduh.');
    await loadEksporRiwayat();
  } catch (e) { toast(e.message, false); }
  b.disabled = false;
});

// ---------- Kredensial Payment Gateway: simpan / hapus / lihat ----------
(() => {
  const info = (teks, ok) => {
    const el = document.getElementById('bayar-kredensial-info');
    if (!el) return;
    el.textContent = teks;
    el.className = 'text-xs ' + (ok ? 'text-matcha' : 'text-vermillion');
  };

  [['bayar-lihat-server', 'bayar-in-server'],
   ['bayar-lihat-client', 'bayar-in-client'],
   ['bayar-lihat-callback', 'bayar-in-callback']].forEach(([idBtn, idIn]) => {
    const btn = document.getElementById(idBtn);
    const input = document.getElementById(idIn);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const lihat = input.type === 'password';
      input.type = lihat ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(lihat));
      btn.innerHTML = '<i class="fas ' + (lihat ? 'fa-eye-slash' : 'fa-eye') + ' text-sm"></i>';
    });
  });

  const medan = [
    ['bayar-in-server', 'server_key'],
    ['bayar-in-client', 'client_key'],
    ['bayar-in-callback', 'callback_secret']
  ];

  document.getElementById('bayar-simpan-kredensial')?.addEventListener('click', async (ev) => {
    const body = {};
    for (const [id, kunci] of medan) {
      const el = document.getElementById(id);
      if (el && !el.disabled && el.value.trim()) body[kunci] = el.value.trim();
    }
    if (!Object.keys(body).length) { info('Isi dulu kolom yang ingin disimpan.', false); return; }

    const btn = ev.currentTarget;
    btn.disabled = true;
    info('Menyimpan…', true);
    try {
      const r = await fetch('/api/admin/bayar/kredensial', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menyimpan kredensial.');
      for (const [id] of medan) { const el = document.getElementById(id); if (el) el.value = ''; }
      info(d.pesan || 'Kredensial disimpan.', true);
      toast('Kredensial gateway disimpan — tidak perlu restart server.', true);
      if (typeof loadBayarConfig === 'function') loadBayarConfig();
    } catch (ex) {
      info(ex.message, false);
      toast(ex.message, false);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('bayar-hapus-kredensial')?.addEventListener('click', async (ev) => {
    if (!confirm('Hapus semua kredensial payment gateway?\n\nPembayaran otomatis akan berhenti sampai kredensial diisi lagi.')) return;
    const btn = ev.currentTarget;
    btn.disabled = true;
    info('Menghapus…', true);
    try {
      const r = await fetch('/api/admin/bayar/kredensial', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_key: '', client_key: '', callback_secret: '' })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Gagal menghapus kredensial.');
      info('Kredensial dihapus.', true);
      toast('Kredensial gateway dihapus.', true);
      if (typeof loadBayarConfig === 'function') loadBayarConfig();
    } catch (ex) {
      info(ex.message, false);
      toast(ex.message, false);
    } finally {
      btn.disabled = false;
    }
  });
})();
