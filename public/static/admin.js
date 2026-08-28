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

    document.getElementById('panen-tanggal').value = hariIni();
    document.getElementById('jual-tanggal').value = hariIni();

    await Promise.all([loadRingkasan(), loadProdukDropdown()]);
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
    const loaders = { dashboard: loadRingkasan, panen: loadPanen, penjualan: loadPenjualan, produk: loadProduk, pengguna: loadUsers };
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
    <div class="stat-card"><i class="fas fa-sack-dollar text-kin"></i><p class="stat-val">${rupiah(d.jualBulanIni)}</p><p class="stat-label">Penjualan Bulan Ini</p></div>`;

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

// ---------- Panen ----------
async function loadPanen() {
  const { panen } = await api('/api/admin/panen');
  const boleh = ['owner', 'admin'].includes(ME.role);
  document.getElementById('table-panen').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Jumlah (kg)</th><th>Catatan</th><th>Pencatat</th>${boleh ? '<th></th>' : ''}</tr></thead>
    <tbody>${panen.map((p) => `
      <tr>
        <td>${p.tanggal}</td><td class="font-semibold">${p.jumlah_kg}</td>
        <td>${p.catatan || '-'}</td><td>${p.pencatat || '-'}</td>
        ${boleh ? `<td><button onclick="hapusPanen(${p.id})" class="text-red-500 hover:text-red-700" title="Hapus"><i class="fas fa-trash"></i></button></td>` : ''}
      </tr>`).join('') || '<tr><td colspan="5" class="text-center text-gray-400 py-4">Belum ada data</td></tr>'}</tbody>`;
}

document.getElementById('form-panen').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/panen', { method: 'POST', body: JSON.stringify({
      tanggal: document.getElementById('panen-tanggal').value,
      jumlah_kg: parseFloat(document.getElementById('panen-kg').value),
      catatan: document.getElementById('panen-catatan').value.trim()
    })});
    toast('Panen berhasil dicatat 🍄');
    document.getElementById('panen-kg').value = ''; document.getElementById('panen-catatan').value = '';
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

async function loadPenjualan() {
  const { penjualan } = await api('/api/admin/penjualan');
  const boleh = ['owner', 'admin'].includes(ME.role);
  document.getElementById('table-penjualan').innerHTML = `
    <thead><tr><th>Tanggal</th><th>Produk</th><th>Jml</th><th>Total</th><th>Pembeli</th><th>Pencatat</th>${boleh ? '<th></th>' : ''}</tr></thead>
    <tbody>${penjualan.map((j) => `
      <tr>
        <td>${j.tanggal}</td><td>${j.nama_produk}</td><td>${j.jumlah}</td>
        <td class="font-semibold" style="color:#C73E3A">${rupiah(j.total)}</td>
        <td>${j.pembeli || '-'}</td><td>${j.pencatat || '-'}</td>
        ${boleh ? `<td><button onclick="hapusJual(${j.id})" class="text-red-500 hover:text-red-700" title="Hapus"><i class="fas fa-trash"></i></button></td>` : ''}
      </tr>`).join('') || '<tr><td colspan="7" class="text-center text-gray-400 py-4">Belum ada data</td></tr>'}</tbody>`;
}

document.getElementById('form-penjualan').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/penjualan', { method: 'POST', body: JSON.stringify({
      tanggal: document.getElementById('jual-tanggal').value,
      produk_id: parseInt(document.getElementById('jual-produk').value),
      jumlah: parseInt(document.getElementById('jual-jumlah').value),
      pembeli: document.getElementById('jual-pembeli').value.trim()
    })});
    toast('Penjualan berhasil dicatat 💰');
    document.getElementById('jual-jumlah').value = 1; document.getElementById('jual-pembeli').value = '';
    updateTotalJual(); loadPenjualan();
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
