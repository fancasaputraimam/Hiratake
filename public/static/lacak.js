// ============================================================
//  lacak.js — Lacak Pesanan (via token link atau OTP WhatsApp)
// ============================================================

const $ = (id) => document.getElementById(id)

const LBL_STATUS = {
  baru: { t: 'Pesanan Diterima', c: 'bg-blue-100 text-blue-700', i: 'fa-inbox' },
  diproses: { t: 'Sedang Diproses', c: 'bg-amber-100 text-amber-700', i: 'fa-fire-burner' },
  siap: { t: 'Siap Dikirim', c: 'bg-indigo-100 text-indigo-700', i: 'fa-box-open' },
  selesai: { t: 'Selesai', c: 'bg-green-100 text-green-700', i: 'fa-circle-check' },
  batal: { t: 'Dibatalkan', c: 'bg-red-100 text-red-700', i: 'fa-circle-xmark' }
}
const LBL_BAYAR = {
  belum: { t: 'Belum Dibayar', c: 'bg-red-50 text-red-700 border-red-200' },
  menunggu: { t: 'Menunggu Pembayaran', c: 'bg-amber-50 text-amber-700 border-amber-200' },
  lunas: { t: 'Lunas', c: 'bg-green-50 text-green-700 border-green-200' },
  batal: { t: 'Batal', c: 'bg-gray-100 text-gray-600 border-gray-200' }
}
const LBL_METODE = { cash: 'Tunai / COD', qris: 'QRIS', transfer: 'Transfer Bank' }

// ---------- util ----------
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]))
}
function rupiah(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}
function tglID(s) {
  if (!s) return '-'
  const d = new Date(String(s).length <= 10 ? s + 'T00:00:00' : String(s).replace(' ', 'T') + 'Z')
  if (isNaN(d)) return String(s)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}
function toast(msg, ok) {
  const el = $('toast')
  if (!el) return alert(msg)
  el.textContent = msg
  el.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full shadow-lg text-white text-sm ' +
    (ok ? 'bg-green-600' : 'bg-red-600')
  el.classList.remove('hidden')
  clearTimeout(toast._t)
  toast._t = setTimeout(() => el.classList.add('hidden'), 3800)
}
function info(msg, ok) {
  const el = $('lacak-info')
  if (!el) return
  el.textContent = msg
  el.className = 'text-xs ' + (ok ? 'text-green-700' : 'text-red-600')
  el.classList.remove('hidden')
}
async function api(url, opts) {
  const r = await fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}))
  let d = {}
  try { d = await r.json() } catch (e) { /* respons bukan JSON */ }
  if (!r.ok) throw new Error(d.error || 'Terjadi kesalahan (' + r.status + ')')
  return d
}

// ---------- render kartu pesanan ----------
function kartuPesanan(p) {
  const st = LBL_STATUS[p.status] || { t: p.status || '-', c: 'bg-gray-100 text-gray-700', i: 'fa-circle-info' }
  const sb = LBL_BAYAR[p.statusBayar] || LBL_BAYAR.belum
  const metode = LBL_METODE[p.metodeBayar] || (p.metodeBayar ? p.metodeBayar : '-')

  const item = (p.item || []).map((it) => `
    <li class="flex justify-between gap-3 text-sm py-1.5 border-b border-dashed border-sumi/10 last:border-0">
      <span class="min-w-0">
        <span class="font-medium">${esc(it.nama_produk)}</span>
        <span class="text-sumi/50"> ×${Number(it.jumlah || 0)}</span>
      </span>
      <span class="shrink-0 tabular-nums">${rupiah(it.subtotal)}</span>
    </li>`).join('')

  const subtotal = (p.item || []).reduce((a, it) => a + Number(it.subtotal || 0), 0)

  // Timeline sederhana
  const urut = ['baru', 'diproses', 'siap', 'selesai']
  const idx = urut.indexOf(p.status)
  const timeline = p.status === 'batal' ? '' : `
    <div class="flex items-center gap-1 mt-4">
      ${urut.map((k, i) => {
        const aktif = idx >= i
        return `<div class="flex-1 flex flex-col items-center gap-1">
          <div class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] ${aktif ? 'bg-vermillion text-white' : 'bg-sumi/10 text-sumi/40'}">
            <i class="fas ${LBL_STATUS[k].i}"></i>
          </div>
          <span class="text-[10px] text-center leading-tight ${aktif ? 'text-sumi font-medium' : 'text-sumi/40'}">${LBL_STATUS[k].t}</span>
        </div>${i < urut.length - 1 ? `<div class="h-0.5 flex-1 -mt-5 ${idx > i ? 'bg-vermillion' : 'bg-sumi/10'}"></div>` : ''}`
      }).join('')}
    </div>`

  return `
  <article class="bg-white rounded-2xl shadow p-5 fade-up">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <p class="text-[11px] uppercase tracking-wider text-sumi/40">Kode Pesanan</p>
        <h2 class="font-serifjp text-xl font-bold">${esc(p.kode)}</h2>
        <p class="text-xs text-sumi/60 mt-0.5">${esc(p.nama || '-')} · ${esc(p.waSensor || '')}</p>
      </div>
      <div class="flex flex-col items-end gap-1.5">
        <span class="text-xs font-medium px-3 py-1 rounded-full ${st.c}"><i class="fas ${st.i} mr-1"></i>${st.t}</span>
        <span class="text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${sb.c}">${sb.t}</span>
      </div>
    </div>

    ${timeline}

    <ul class="mt-4 border-t border-sumi/10 pt-3">${item || '<li class="text-sm text-sumi/50 py-2">Tidak ada rincian item.</li>'}</ul>

    <dl class="mt-3 space-y-1 text-sm">
      <div class="flex justify-between"><dt class="text-sumi/60">Subtotal</dt><dd class="tabular-nums">${rupiah(subtotal)}</dd></div>
      ${Number(p.ongkir) > 0 ? `<div class="flex justify-between"><dt class="text-sumi/60">Ongkos kirim</dt><dd class="tabular-nums">${rupiah(p.ongkir)}</dd></div>` : ''}
      ${Number(p.biayaAdmin) > 0 ? `<div class="flex justify-between"><dt class="text-sumi/60">Biaya layanan</dt><dd class="tabular-nums">${rupiah(p.biayaAdmin)}</dd></div>` : ''}
      <div class="flex justify-between font-semibold text-base border-t border-sumi/10 pt-1.5">
        <dt>Total</dt><dd class="text-vermillion tabular-nums">${rupiah(p.totalBayar || subtotal)}</dd>
      </div>
    </dl>

    <div class="mt-4 grid sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-sumi/70 border-t border-sumi/10 pt-3">
      <p><i class="fas fa-calendar-day w-4 text-sumi/40"></i> Tanggal pesan: <strong>${tglID(p.tanggalPesan)}</strong></p>
      <p><i class="fas fa-truck w-4 text-sumi/40"></i> Rencana kirim: <strong>${tglID(p.tanggalKirim)}</strong></p>
      <p><i class="fas fa-wallet w-4 text-sumi/40"></i> Metode bayar: <strong>${esc(metode)}</strong></p>
      ${p.kodeBayar ? `<p><i class="fas fa-receipt w-4 text-sumi/40"></i> Kode bayar: <strong>${esc(p.kodeBayar)}</strong></p>` : ''}
      ${p.alamatKirim ? `<p class="sm:col-span-2"><i class="fas fa-location-dot w-4 text-sumi/40"></i> ${esc(p.alamatKirim)}</p>` : ''}
      ${p.diterimaAt ? `<p class="sm:col-span-2 text-green-700"><i class="fas fa-circle-check w-4"></i> Diterima pada ${tglID(p.diterimaAt)}</p>` : ''}
    </div>

    ${(p.bayarUrl || p.lacakUrl) ? `
    <div class="mt-4 flex flex-wrap gap-2">
      ${p.bayarUrl ? `<a href="${esc(p.bayarUrl)}" class="bg-vermillion hover:bg-red-700 text-white text-sm font-medium px-5 py-2 rounded-full transition"><i class="fas fa-qrcode mr-2"></i>Bayar Sekarang</a>` : ''}
      ${p.lacakUrl ? `<a href="${esc(p.lacakUrl)}" class="border border-sumi/20 hover:bg-washi text-sm px-5 py-2 rounded-full transition"><i class="fas fa-link mr-2"></i>Link Lacak Permanen</a>` : ''}
      ${window.SITUS && window.SITUS.wa ? `<a href="https://wa.me/${esc(window.SITUS.wa)}?text=${encodeURIComponent('Halo, saya mau tanya pesanan ' + p.kode)}" target="_blank" rel="noopener" class="border border-green-600 text-green-700 hover:bg-green-50 text-sm px-5 py-2 rounded-full transition"><i class="fab fa-whatsapp mr-2"></i>Tanya Admin</a>` : ''}
    </div>` : ''}
  </article>`
}

function tampilkan(daftar, judul) {
  const box = $('lacak-hasil')
  if (!daftar.length) {
    box.innerHTML = `<div class="bg-white rounded-2xl shadow p-6 text-center text-sm text-sumi/60">
      <i class="fas fa-box-open text-3xl text-sumi/20 block mb-2"></i>Belum ada pesanan untuk nomor ini.</div>`
  } else {
    box.innerHTML = (judul ? `<p class="text-sm text-sumi/60">${esc(judul)}</p>` : '') +
      daftar.map(kartuPesanan).join('')
  }
  box.classList.remove('hidden')
}

// ---------- alur 1: token dari link ----------
async function muatToken(token) {
  $('lacak-form-area').classList.add('hidden')
  const box = $('lacak-hasil')
  box.classList.remove('hidden')
  box.innerHTML = `<div class="bg-white rounded-2xl shadow p-8 text-center text-sumi/50">
    <i class="fas fa-spinner fa-spin text-2xl"></i><p class="text-sm mt-2">Memuat pesanan…</p></div>`
  try {
    const d = await api('/api/lacak/token/' + encodeURIComponent(token))
    tampilkan([d.pesanan])
  } catch (e) {
    box.innerHTML = `<div class="bg-white rounded-2xl shadow p-6 text-center">
      <i class="fas fa-triangle-exclamation text-3xl text-red-500 block mb-2"></i>
      <p class="text-sm text-sumi/70">${esc(e.message)}</p>
      <button id="lacak-pakai-otp" class="mt-4 border border-sumi/20 hover:bg-washi text-sm px-5 py-2 rounded-full transition">
        <i class="fab fa-whatsapp mr-2"></i>Lacak pakai nomor WhatsApp</button></div>`
    const b = $('lacak-pakai-otp')
    if (b) b.onclick = () => {
      box.classList.add('hidden')
      $('lacak-form-area').classList.remove('hidden')
      history.replaceState(null, '', '/lacak')
    }
  }
}

// ---------- alur 2: OTP WhatsApp ----------
let COOLDOWN = 0
let TIMER_CD = null

function mulaiCooldown(detik) {
  COOLDOWN = detik
  const btn = $('lacak-kirim')
  clearInterval(TIMER_CD)
  const tick = () => {
    if (COOLDOWN <= 0) {
      clearInterval(TIMER_CD)
      btn.disabled = false
      btn.innerHTML = '<i class="fab fa-whatsapp mr-2"></i>Kirim Ulang Kode'
      btn.classList.remove('opacity-60', 'cursor-not-allowed')
      return
    }
    btn.disabled = true
    btn.classList.add('opacity-60', 'cursor-not-allowed')
    btn.innerHTML = '<i class="fas fa-clock mr-2"></i>Kirim ulang dalam ' + COOLDOWN + 's'
    COOLDOWN--
  }
  tick()
  TIMER_CD = setInterval(tick, 1000)
}

async function kirimOTP() {
  const wa = ($('lacak-wa').value || '').trim()
  if (wa.replace(/\D/g, '').length < 9) return info('Nomor WhatsApp tidak valid.', false)
  const btn = $('lacak-kirim')
  btn.disabled = true
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Mengirim…'
  try {
    const d = await api('/api/lacak/otp', { method: 'POST', body: JSON.stringify({ wa }) })
    $('lacak-otp-area').classList.remove('hidden')
    $('lacak-kode').focus()
    info('Jika nomor ' + (d.waSensor || wa) + ' terdaftar, kode berlaku ' + (d.menit || 5) + ' menit telah dikirim via WhatsApp.', true)
    mulaiCooldown(60)
  } catch (e) {
    btn.disabled = false
    btn.innerHTML = '<i class="fab fa-whatsapp mr-2"></i>Kirim Kode Verifikasi'
    info(e.message, false)
  }
}

async function verifikasiKode() {
  const wa = ($('lacak-wa').value || '').trim()
  const kode = ($('lacak-kode').value || '').replace(/\D/g, '')
  if (kode.length !== 6) return info('Masukkan 6 angka kode verifikasi.', false)
  const btn = $('lacak-verifikasi')
  const asli = btn.innerHTML
  btn.disabled = true
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'
  try {
    const d = await api('/api/lacak/verifikasi', { method: 'POST', body: JSON.stringify({ wa, kode }) })
    clearInterval(TIMER_CD)
    $('lacak-form-area').classList.add('hidden')
    const n = (d.pesanan || []).length
    tampilkan(d.pesanan || [], n ? n + ' pesanan ditemukan untuk nomor ini.' : '')
    toast('Verifikasi berhasil.', true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    info(e.message, false)
    $('lacak-kode').select()
  } finally {
    btn.disabled = false
    btn.innerHTML = asli
  }
}

// ---------- init ----------
document.addEventListener('DOMContentLoaded', () => {
  const token = new URLSearchParams(location.search).get('token')
  if (token) {
    muatToken(token)
    return
  }
  $('lacak-kirim').addEventListener('click', kirimOTP)
  $('lacak-verifikasi').addEventListener('click', verifikasiKode)
  $('lacak-wa').addEventListener('keydown', (e) => { if (e.key === 'Enter') kirimOTP() })
  $('lacak-kode').addEventListener('keydown', (e) => { if (e.key === 'Enter') verifikasiKode() })
  $('lacak-kode').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6)
  })
})
