// ============================================================
//  SEO: Structured data (JSON-LD), sitemap.xml, robots.txt
//  Tujuan: hasil pencarian Google lebih kaya (rich result) &
//  halaman cepat terindeks.
// ============================================================

export type DataJsonLd = {
  origin: string
  nama: string
  deskripsi: string
  gambar: string
  telepon: string        // nomor WA format 62xxx
  alamat: string
  jam: string            // teks jam operasional bebas, mis. "06:00 - 17:00 WIB"
  lat?: string
  lng?: string
  produk: { nama: string; deskripsi?: string; harga: number; satuan?: string }[]
  testimoni?: { nama: string; asal?: string; rating: number; isi: string }[]
}

/**
 * Bangun JSON-LD gabungan: LocalBusiness (+ Product & Review).
 * JSON.stringify sudah meng-escape karakter khusus; `</` diamankan
 * agar tidak bisa menutup tag <script> (anti-XSS).
 */
export function jsonLdSitus(d: DataJsonLd): string {
  const tel = String(d.telepon || '').replace(/[^0-9]/g, '')
  const url = d.origin + '/'

  // Konversi teks jam operasional → openingHours (best effort, tetap sertakan teks asli)
  const jamCocok = /(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/.exec(d.jam || '')
  const openingHours = jamCocok
    ? [`Mo-Su ${jamCocok[1].padStart(2, '0')}:${jamCocok[2]}-${jamCocok[3].padStart(2, '0')}:${jamCocok[4]}`]
    : undefined

  const bisnis: any = {
    '@type': ['LocalBusiness', 'Farm'],
    '@id': url + '#bisnis',
    name: d.nama,
    description: d.deskripsi,
    image: d.gambar,
    logo: d.origin + '/media/situs/logo',
    url,
    priceRange: 'Rp',
    currenciesAccepted: 'IDR',
    paymentAccepted: 'Tunai, QRIS, Transfer Bank'
  }
  if (tel) {
    bisnis.telephone = '+' + tel
    bisnis.sameAs = [`https://wa.me/${tel}`]
    bisnis.contactPoint = {
      '@type': 'ContactPoint',
      telephone: '+' + tel,
      contactType: 'sales',
      availableLanguage: ['id', 'Indonesian']
    }
  }
  if (d.alamat && d.alamat !== '-') {
    bisnis.address = { '@type': 'PostalAddress', streetAddress: d.alamat, addressCountry: 'ID' }
  }
  const lat = parseFloat(String(d.lat || ''))
  const lng = parseFloat(String(d.lng || ''))
  if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)) {
    bisnis.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng }
    bisnis.hasMap = `https://www.google.com/maps?q=${lat},${lng}`
  }
  if (openingHours) bisnis.openingHours = openingHours
  else if (d.jam && d.jam !== '-') bisnis.openingHoursSpecification = { '@type': 'OpeningHoursSpecification', description: d.jam }

  // Rating agregat dari testimoni (hanya bila ada minimal 1)
  const rev = (d.testimoni || []).filter((t) => t && t.rating > 0)
  if (rev.length) {
    bisnis.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: (rev.reduce((a, t) => a + Number(t.rating), 0) / rev.length).toFixed(1),
      reviewCount: rev.length,
      bestRating: 5, worstRating: 1
    }
    bisnis.review = rev.slice(0, 5).map((t) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: t.nama },
      reviewRating: { '@type': 'Rating', ratingValue: Number(t.rating), bestRating: 5, worstRating: 1 },
      reviewBody: t.isi
    }))
  }

  const graph: any[] = [
    { '@type': 'WebSite', '@id': url + '#situs', url, name: d.nama, inLanguage: 'id-ID', publisher: { '@id': url + '#bisnis' } },
    bisnis
  ]

  // Setiap produk aktif → entitas Product + Offer (bisa muncul dengan harga di Google)
  for (const p of (d.produk || []).slice(0, 20)) {
    graph.push({
      '@type': 'Product',
      name: p.nama,
      description: p.deskripsi || d.deskripsi,
      image: d.gambar,
      brand: { '@type': 'Brand', name: d.nama },
      category: 'Jamur Tiram Segar',
      offers: {
        '@type': 'Offer',
        price: Number(p.harga) || 0,
        priceCurrency: 'IDR',
        availability: 'https://schema.org/InStock',
        url: d.origin + '/#produk',
        seller: { '@id': url + '#bisnis' },
        ...(p.satuan ? { eligibleQuantity: { '@type': 'QuantitativeValue', unitText: p.satuan } } : {})
      }
    })
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
}

/** robots.txt — izinkan halaman publik, larang area privat, tunjuk sitemap. */
export function robotsTxt(origin: string): string {
  return `# robots.txt — ${origin}
User-agent: *
Allow: /$
Allow: /static/
Allow: /media/
Disallow: /admin
Disallow: /login
Disallow: /api/
Disallow: /nota/
Disallow: /bayar
Disallow: /checkout
Disallow: /lacak

# Perayap agresif (hemat kuota Cloudflare)
User-agent: AhrefsBot
Crawl-delay: 10
User-agent: SemrushBot
Crawl-delay: 10

Sitemap: ${origin}/sitemap.xml
`
}

/**
 * sitemap.xml sederhana untuk halaman publik.
 * /checkout TIDAK disertakan: halaman itu wajib punya ?produk=ID
 * (pengunjung harus memilih produk dulu), jadi URL telanjangnya selalu redirect.
 */
export function sitemapXml(origin: string, lastmod: string): string {
  const halaman: { loc: string; prio: string; freq: string }[] = [
    { loc: '/', prio: '1.0', freq: 'daily' },
    { loc: '/lacak', prio: '0.5', freq: 'monthly' }
  ]
  const urls = halaman.map((h) => `  <url>
    <loc>${origin}${h.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${h.freq}</changefreq>
    <priority>${h.prio}</priority>
  </url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}
