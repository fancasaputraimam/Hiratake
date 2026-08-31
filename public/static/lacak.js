// ============================================================
//  lacak.js — Lacak Pesanan (via token link atau OTP WhatsApp)
// ============================================================

const $ = (id) => document.getElementById(id)

const LBL_STATUS = {
  baru: { t: 'Pesanan Diterima', ket: 'Pesanan Anda sudah kami terima.', c: 'bg-blue-100 text-blue-700', i: 'fa-inbox', pita: 'from-blue-500 to-blue-400' },
  diproses: { t: 'Sedang Diproses', ket: 'Jamur sedang kami siapkan & sortir.', c: 'bg-amber-100 text-amber-700', i: 'fa-fire-burner', pita: 'from-amber-500 to-amber-400' },
  siap: { t: 'Siap Dikirim', ket: 'Pesanan siap dikirim atau diambil.', c: 'bg-indigo-100 text-indigo-700', i: 'fa-box-open', pita: 'from-indigo-500 to-indigo-400' },
  selesai: { t: 'Selesai', ket: 'Terima kasih sudah berbelanja!', c: 'bg-green-100 text-green-700', i: 'fa-circle-check', pita: 'from-green-600 to-green-500' },
  batal: { t: 'Dibatalkan', ket: 'Pesanan ini dibatalkan.', c: 'bg-red-100 text-red-700', i: 'fa-circle-xmark', pita: 'from-red-500 to-red-400' }
}
const LBL_BAYAR = {
  belum: { t: 'Belum Dibayar', c: 'bg-red-50 text-red-700 border-red-200', i: 'fa-hourglass-half' },
  menunggu: { t: 'Menunggu Pembayaran', c: 'bg-amber-50 text-amber-700 border-amber-200', i: 'fa-clock' },
  lunas: { t: 'Lunas', c: 'bg-green-50 text-green-700 border-green-200', i: 'fa-circle-check' },
  gagal: { t: 'Pembayaran Gagal', c: 'bg-red-50 text-red-700 border-red-200', i: 'fa-triangle-exclamation' },
  kedaluwarsa: { t: 'Kedaluwarsa', c: 'bg-gray-100 text-gray-600 border-gray-200', i: 'fa-ban' },
  batal: { t: 'Batal', c: 'bg-gray-100 text-gray-600 border-gray-200', i: 'fa-ban' }
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
  const st = LBL_STATUS[p.status] || { t: p.status || '-', ket: '', c: 'bg-gray-100 text-gray-700', i: 'fa-circle-info', pita: 'from-gray-400 to-gray-300' }
  const sb = LBL_BAYAR[p.statusBayar] || LBL_BAYAR.belum
  const metode = LBL_METODE[p.metodeBayar] || (p.metodeBayar ? p.metodeBayar : '-')
  const batal = p.status === 'batal'

  const item = (p.item || []).map((it) => `
    <li class="flex items-start justify-between gap-3 py-2.5">
      <div class="flex items-start gap-2.5 min-w-0">
        <span class="mt-0.5 shrink-0 w-6 h-6 rounded-lg bg-vermillion/10 text-vermillion grid place-items-center text-[10px] font-bold">
          ${Number(it.jumlah || 0)}×
        </span>
        <div class="min-w-0">
          <p class="text-sm font-medium leading-snug">${esc(it.nama_produk)}</p>
          <p class="text-[11px] text-sumi/45">${rupiah(it.harga)} / satuan</p>
        </div>
      </div>
      <span class="shrink-0 text-sm tabular-nums font-medium">${rupiah(it.subtotal)}</span>
    </li>`).join('')

  const subtotal = (p.item || []).reduce((a, it) => a + Number(it.subtotal || 0), 0)

  // ---- Timeline vertikal: jelas dibaca di HP maupun desktop ----
  const urut = ['baru', 'diproses', 'siap', 'selesai']
  const idx = urut.indexOf(p.status)
  const timeline = batal
    ? `<div class="flex items-start gap-3 rounded-xl bg-red-50 border border-red-100 p-3.5">
         <i class="fas fa-circle-xmark text-red-500 mt-0.5"></i>
         <div>
           <p class="text-sm font-semibold text-red-700">Pesanan Dibatalkan</p>
           <p class="text-xs text-red-600/80 mt-0.5">Hubungi kami bila ini keliru.</p>
         </div>
       </div>`
    : `<ol class="relative">
        ${urut.map((k, i) => {
          const done = idx > i
          const now = idx === i
          const aktif = done || now
          const s = LBL_STATUS[k]
          return `
          <li class="relative flex gap-3 ${i < urut.length - 1 ? 'pb-5' : ''}">
            ${i < urut.length - 1
              ? `<span class="absolute left-[15px] top-8 bottom-0 w-0.5 ${done ? 'bg-vermillion' : 'bg-sumi/10'}"></span>`
              : ''}
            <span class="relative z-10 shrink-0 w-8 h-8 rounded-full grid place-items-center text-xs transition
              ${now ? 'bg-vermillion text-white ring-4 ring-vermillion/15'
                    : done ? 'bg-vermillion text-white'
                           : 'bg-white text-sumi/30 ring-1 ring-sumi/15'}">
              <i class="fas ${done ? 'fa-check' : s.i}"></i>
            </span>
            <div class="pt-1 min-w-0">
              <p class="text-sm leading-tight ${aktif ? 'font-semibold text-sumi' : 'text-sumi/40'}">${s.t}</p>
              ${now ? `<p class="text-xs text-sumi/55 mt-0.5">${s.ket}</p>` : ''}
            </div>
          </li>`
        }).join('')}
      </ol>`

  const aksi = []
  if (p.bayarUrl) aksi.push(`<a href="${esc(p.bayarUrl)}" class="flex-1 min-w-[10rem] text-center bg-vermillion hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition shadow-sm"><i class="fas fa-qrcode mr-2"></i>Bayar Sekarang</a>`)
  if (window.SITUS && window.SITUS.wa) aksi.push(`<a href="https://wa.me/${esc(window.SITUS.wa)}?text=${encodeURIComponent('Halo, saya mau tanya pesanan ' + p.kode)}" target="_blank" rel="noopener" class="flex-1 min-w-[10rem] text-center border border-green-600 text-green-700 hover:bg-green-50 text-sm font-medium px-5 py-2.5 rounded-full transition"><i class="fab fa-whatsapp mr-2"></i>Tanya Admin</a>`)
  if (p.lacakUrl) aksi.push(`<button type="button" data-salin="${esc(location.origin + p.lacakUrl)}" class="flex-1 min-w-[10rem] border border-sumi/20 hover:bg-washi text-sm px-5 py-2.5 rounded-full transition"><i class="fas fa-link mr-2"></i>Salin Link Lacak</button>`)

  return `
  <article class="bg-white rounded-2xl shadow-sm ring-1 ring-sumi/5 overflow-hidden">
    <!-- Pita status -->
    <div class="h-1.5 bg-gradient-to-r ${st.pita}"></div>

    <!-- Kepala -->
    <div class="p-5 pb-4 flex items-start justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <p class="text-[10px] uppercase tracking-[0.18em] text-sumi/40 mb-0.5">Kode Pesanan</p>
        <h2 class="font-serifjp text-2xl font-bold leading-none">${esc(p.kode)}</h2>
        <p class="text-xs text-sumi/55 mt-1.5">
          <i class="fas fa-user w-3.5 text-sumi/30"></i> ${esc(p.nama || '-')}
          <span class="text-sumi/25 mx-1">·</span>${esc(p.waSensor || '')}
        </p>
      </div>
      <div class="flex flex-col items-end gap-1.5 shrink-0">
        <span class="text-xs font-semibold px-3 py-1.5 rounded-full ${st.c}"><i class="fas ${st.i} mr-1.5"></i>${st.t}</span>
        <span class="text-[11px] font-medium px-2.5 py-1 rounded-full border ${sb.c}"><i class="fas ${sb.i} mr-1"></i>${sb.t}</span>
      </div>
    </div>

    <!-- Timeline -->
    <div class="px-5 pb-5">
      <div class="rounded-xl bg-washi/60 p-4">${timeline}</div>
    </div>

    <!-- Rincian item -->
    <div class="px-5">
      <p class="text-[10px] uppercase tracking-[0.18em] text-sumi/40 mb-1">Rincian Pesanan</p>
      <ul class="divide-y divide-dashed divide-sumi/10">
        ${item || '<li class="text-sm text-sumi/50 py-3">Tidak ada rincian item.</li>'}
      </ul>
    </div>

    <!-- Ringkasan biaya -->
    <div class="mx-5 mt-4 rounded-xl bg-washi/60 p-4">
      <dl class="space-y-1.5 text-sm">
        <div class="flex justify-between"><dt class="text-sumi/60">Subtotal</dt><dd class="tabular-nums">${rupiah(subtotal)}</dd></div>
        ${Number(p.ongkir) > 0 ? `<div class="flex justify-between"><dt class="text-sumi/60">Ongkos kirim</dt><dd class="tabular-nums">${rupiah(p.ongkir)}</dd></div>` : ''}
        ${Number(p.biayaAdmin) > 0 ? `<div class="flex justify-between"><dt class="text-sumi/60">Biaya layanan</dt><dd class="tabular-nums">${rupiah(p.biayaAdmin)}</dd></div>` : ''}
        <div class="flex justify-between items-baseline border-t border-sumi/10 pt-2 mt-1">
          <dt class="font-semibold">Total Bayar</dt>
          <dd class="font-serifjp text-xl font-bold text-vermillion tabular-nums">${rupiah(p.totalBayar || subtotal)}</dd>
        </div>
      </dl>
    </div>

    <!-- Info pengiriman -->
    <div class="px-5 py-4 mt-1 grid sm:grid-cols-2 gap-x-5 gap-y-2.5 text-xs text-sumi/70">
      <p class="flex gap-2"><i class="fas fa-calendar-day w-4 text-sumi/30 mt-0.5"></i><span>Tanggal pesan<br><strong class="text-sumi">${tglID(p.tanggalPesan)}</strong></span></p>
      <p class="flex gap-2"><i class="fas fa-truck w-4 text-sumi/30 mt-0.5"></i><span>Rencana kirim<br><strong class="text-sumi">${tglID(p.tanggalKirim)}</strong></span></p>
      <p class="flex gap-2"><i class="fas fa-wallet w-4 text-sumi/30 mt-0.5"></i><span>Metode bayar<br><strong class="text-sumi">${esc(metode)}</strong></span></p>
      ${p.kodeBayar ? `<p class="flex gap-2"><i class="fas fa-receipt w-4 text-sumi/30 mt-0.5"></i><span>Kode bayar<br><strong class="text-sumi font-mono text-[11px]">${esc(p.kodeBayar)}</strong></span></p>` : ''}
      ${p.alamatKirim ? `<p class="flex gap-2 sm:col-span-2"><i class="fas fa-location-dot w-4 text-sumi/30 mt-0.5"></i><span>Alamat kirim<br><strong class="text-sumi">${esc(p.alamatKirim)}</strong></span></p>` : ''}
      ${p.diterimaAt ? `<p class="flex gap-2 sm:col-span-2 text-green-700"><i class="fas fa-circle-check w-4 mt-0.5"></i><span>Dikonfirmasi diterima pada <strong>${tglID(p.diterimaAt)}</strong></span></p>` : ''}
    </div>

    ${aksi.length ? `<div class="px-5 pb-5 pt-1 flex flex-wrap gap-2">${aksi.join('')}</div>` : ''}
  </article>`
}

/** Pasang aksi "Salin Link Lacak" pada kartu yang baru dirender. */
function pasangSalin(root) {
  root.querySelectorAll('[data-salin]').forEach((b) => {
    b.addEventListener('click', async () => {
      const url = b.getAttribute('data-salin')
      try {
        await navigator.clipboard.writeText(url)
        toast('Link lacak disalin. Simpan untuk membuka pesanan ini kapan saja.', true)
      } catch (e) {
        window.prompt('Salin link lacak berikut:', url)
      }
    })
  })
}

function tampilkan(daftar, judul) {
  const box = $('lacak-hasil')
  if (!daftar.length) {
    box.innerHTML = `<div class="bg-white rounded-2xl shadow-sm ring-1 ring-sumi/5 p-8 text-center">
      <i class="fas fa-box-open text-4xl text-sumi/15 block mb-3"></i>
      <p class="text-sm text-sumi/60">Belum ada pesanan untuk nomor ini.</p>
      <a href="/#produk" class="inline-block mt-4 text-sm text-vermillion hover:underline font-medium">Mulai pesan jamur segar →</a>
    </div>`
  } else {
    box.innerHTML = (judul ? `<p class="text-sm text-sumi/60 mb-1">${esc(judul)}</p>` : '') +
      daftar.map(kartuPesanan).join('')
  }
  box.classList.remove('hidden')
  pasangSalin(box)
}

/** Kerangka abu-abu saat memuat, agar tidak terlihat kosong/patah. */
function kerangkaMuat(n) {
  return Array.from({ length: n || 1 }, () => `
    <div class="bg-white rounded-2xl shadow-sm ring-1 ring-sumi/5 overflow-hidden animate-pulse">
      <div class="h-1.5 bg-sumi/10"></div>
      <div class="p-5 space-y-3">
        <div class="h-3 w-24 bg-sumi/10 rounded"></div>
        <div class="h-6 w-44 bg-sumi/10 rounded"></div>
        <div class="h-24 bg-sumi/5 rounded-xl"></div>
        <div class="h-3 w-full bg-sumi/10 rounded"></div>
        <div class="h-3 w-2/3 bg-sumi/10 rounded"></div>
      </div>
    </div>`).join('')
}

// ---------- alur 1: token dari link ----------
async function muatToken(token) {
  $('lacak-form-area').classList.add('hidden')
  const box = $('lacak-hasil')
  box.classList.remove('hidden')
  box.innerHTML = kerangkaMuat(1)
  try {
    const d = await api('/api/lacak/token/' + encodeURIComponent(token))
    tampilkan([d.pesanan])
  } catch (e) {
    box.innerHTML = `<div class="bg-white rounded-2xl shadow-sm ring-1 ring-sumi/5 p-8 text-center">
      <i class="fas fa-triangle-exclamation text-3xl text-red-500 block mb-3"></i>
      <p class="text-sm text-sumi/70">${esc(e.message)}</p>
      <button id="lacak-pakai-otp" class="mt-4 border border-sumi/20 hover:bg-washi text-sm px-5 py-2.5 rounded-full transition">
        <i class="fab fa-whatsapp mr-2"></i>Lacak pakai nomor WhatsApp</button></div>`
    const b = $('lacak-pakai-otp')
    if (b) b.onclick = () => {
      box.classList.add('hidden')
      $('lacak-form-area').classList.remove('hidden')
      history.replaceState(null, '', '/lacak')
    }
  }
}

// ---------- pesanan tersimpan di perangkat ini (tanpa WhatsApp) ----------
function bacaPesananLokal() {
  try {
    const list = JSON.parse(localStorage.getItem('hiratake_pesanan') || '[]')
    return Array.isArray(list) ? list.filter((x) => x && x.token) : []
  } catch (e) { return [] }
}
function hapusPesananLokal(kode) {
  try {
    const list = bacaPesananLokal().filter((x) => x.kode !== kode)
    localStorage.setItem('hiratake_pesanan', JSON.stringify(list))
  } catch (e) { /* abaikan */ }
}

async function muatTersimpan() {
  const box = $('lacak-tersimpan')
  if (!box) return
  const simpan = bacaPesananLokal()
  if (!simpan.length) { box.classList.add('hidden'); return }

  const judul = `<div class="flex items-center justify-between gap-2 mb-2.5">
      <p class="text-sm font-medium text-sumi/70"><i class="fas fa-mobile-screen mr-1.5 text-sumi/40"></i>Pesanan Anda dari perangkat ini</p>
      <span class="text-[10px] text-sumi/40 bg-sumi/5 px-2 py-1 rounded-full whitespace-nowrap">tersimpan di browser</span>
    </div>`

  box.classList.remove('hidden')
  box.innerHTML = judul + kerangkaMuat(Math.min(simpan.length, 3))

  const hasil = await Promise.all(simpan.map((s) =>
    api('/api/lacak/token/' + encodeURIComponent(s.token))
      // Endpoint token tidak mengembalikan lacakUrl; kita sudah punya tokennya
      // di perangkat ini, jadi tombol "Salin Link Lacak" tetap bisa tampil.
      .then((d) => ({ ...d.pesanan, lacakUrl: '/lacak?token=' + s.token }))
      .catch(() => null)
  ))
  const ok = hasil.filter(Boolean)
  // Buang token yang sudah tidak valid dari daftar lokal
  hasil.forEach((r, i) => { if (!r) hapusPesananLokal(simpan[i].kode) })

  if (!ok.length) { box.classList.add('hidden'); return }
  box.innerHTML = judul +
    ok.map((p) => {
      const kartu = kartuPesanan(p)
      return kartu.replace(/<\/article>$/,
        `<div class="px-5 pb-4 -mt-1">
           <button data-hapus="${esc(p.kode)}" class="text-[11px] text-sumi/35 hover:text-vermillion transition">
             <i class="fas fa-xmark mr-1"></i>Hapus dari daftar perangkat ini</button>
         </div></article>`)
    }).join('')

  pasangSalin(box)
  box.querySelectorAll('[data-hapus]').forEach((b) => b.addEventListener('click', () => {
    hapusPesananLokal(b.getAttribute('data-hapus'))
    muatTersimpan()
  }))
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
  muatTersimpan()
  $('lacak-kirim').addEventListener('click', kirimOTP)
  $('lacak-verifikasi').addEventListener('click', verifikasiKode)
  $('lacak-wa').addEventListener('keydown', (e) => { if (e.key === 'Enter') kirimOTP() })
  $('lacak-kode').addEventListener('keydown', (e) => { if (e.key === 'Enter') verifikasiKode() })
  $('lacak-kode').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6)
  })
})
