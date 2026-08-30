// ============================================================
//  Blok tambahan landing page: Testimoni pelanggan & Peta lokasi kumbung
//  Keduanya dikelola dari dashboard (tab Situs / tab Testimoni).
// ============================================================

const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (m) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] as string))

export type Testimoni = {
  nama: string
  asal?: string
  rating: number
  isi: string
}

/** Bintang rating (1–5) memakai ikon Font Awesome. */
function bintang(n: number): string {
  const r = Math.max(1, Math.min(5, Math.round(Number(n) || 5)))
  return Array.from({ length: 5 }, (_, i) =>
    `<i class="fas fa-star ${i < r ? 'text-kin' : 'text-sumi/15'}"></i>`).join('')
}

/**
 * Seksi testimoni — bukti sosial. Tidak dirender bila belum ada
 * testimoni yang ditandai tampil (agar halaman tidak terlihat kosong).
 */
export function blokTestimoni(list: Testimoni[]): string {
  const data = (list || []).filter((t) => t && t.isi)
  if (!data.length) return ''

  const kartu = data.map((t) => `
        <blockquote class="testi-card fade-up">
          <i class="fas fa-quote-left testi-quote" aria-hidden="true"></i>
          <div class="testi-stars" aria-label="Rating ${Math.round(t.rating)} dari 5">${bintang(t.rating)}</div>
          <p class="testi-isi">${esc(t.isi)}</p>
          <footer class="testi-foot">
            <span class="testi-avatar" aria-hidden="true">${esc(String(t.nama || '?').trim().charAt(0).toUpperCase())}</span>
            <div>
              <cite class="testi-nama">${esc(t.nama)}</cite>
              ${t.asal ? `<span class="testi-asal">${esc(t.asal)}</span>` : ''}
            </div>
          </footer>
        </blockquote>`).join('')

  return `
  <!-- Testimoni Pelanggan -->
  <section id="testimoni" class="py-20 bg-white">
    <div class="max-w-6xl mx-auto px-4">
      <div class="text-center mb-12 fade-up">
        <p class="text-vermillion font-serifjp tracking-[0.3em] text-sm mb-2">お客様の声</p>
        <h2 class="font-serifjp text-3xl md:text-4xl font-bold">Kata Pelanggan Kami</h2>
        <div class="w-16 h-1 bg-vermillion mx-auto mt-4 rounded"></div>
        <p class="text-sumi/60 mt-4 max-w-xl mx-auto">Kepercayaan pelanggan adalah panen terbaik kami.</p>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">${kartu}
      </div>
    </div>
  </section>`
}

/**
 * Blok peta lokasi kumbung (embed Google Maps, tanpa API key).
 * Tampil hanya bila owner sudah mengisi koordinat di tab Situs.
 * iframe di-lazy-load agar tidak memperlambat halaman.
 */
export function blokPeta(cfg: Record<string, string>, situsNama: string): string {
  const lat = parseFloat(String(cfg.peta_lat || ''))
  const lng = parseFloat(String(cfg.peta_lng || ''))
  const valid = Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)
  if (!valid) return ''

  const zoom = Math.max(3, Math.min(20, parseInt(String(cfg.peta_zoom || '16')) || 16))
  // Embed tanpa API key: mode "q=lat,lng" + parameter output=embed
  const embed = `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&hl=id&output=embed`
  const linkArah = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  const linkLihat = `https://www.google.com/maps?q=${lat},${lng}&z=${zoom}`
  const alamat = esc(cfg.alamat || '-')

  return `
      <!-- Peta lokasi kumbung -->
      <div class="mt-12 fade-up">
        <div class="text-center mb-6">
          <p class="text-vermillion font-serifjp tracking-[0.3em] text-sm mb-2">地図</p>
          <h3 class="font-serifjp text-2xl font-bold">Lokasi Kumbung Kami</h3>
        </div>
        <div class="bg-white border border-sumi/10 rounded-3xl overflow-hidden shadow-lg">
          <iframe
            src="${embed}"
            title="Peta lokasi kumbung ${esc(situsNama)}"
            class="w-full h-72 sm:h-96 border-0 block"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            allowfullscreen></iframe>
          <div class="p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <p class="text-sm text-sumi/70 flex items-start gap-2">
              <i class="fas fa-location-dot text-vermillion mt-0.5"></i>
              <span>${alamat}</span>
            </p>
            <div class="flex flex-wrap gap-2 shrink-0">
              <a href="${linkArah}" target="_blank" rel="noopener"
                 class="bg-vermillion text-white text-sm px-5 py-2.5 rounded-full font-semibold hover:bg-red-700 transition">
                <i class="fas fa-diamond-turn-right mr-1"></i>Petunjuk Arah
              </a>
              <a href="${linkLihat}" target="_blank" rel="noopener"
                 class="border border-sumi/20 text-sm px-5 py-2.5 rounded-full hover:bg-washi transition">
                <i class="fas fa-map mr-1"></i>Buka Maps
              </a>
            </div>
          </div>
        </div>
      </div>`
}
