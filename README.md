# Hiratake (平茸) — Website Usaha Jamur Tiram

## Ringkasan Proyek
- **Nama**: Hiratake — dari bahasa Jepang 平茸 (hiratake) yang berarti "jamur tiram"
- **Tujuan**: Website profil & pemesanan untuk usaha budidaya jamur tiram, berbahasa Indonesia dengan aksen desain Jepang
- **Fitur Utama**: Katalog produk, pemesanan via WhatsApp, galeri kumbung, informasi proses budidaya

## URL
- **Sandbox (Development)**: https://3000-imf9wlpmbjc80capbwebr-5185f4aa.sandbox.novita.ai
- **Produksi**: Belum di-deploy (siap deploy ke Cloudflare Pages)

## Fitur yang Sudah Selesai
- ✅ Logo Hiratake bergaya Jepang (jamur tiram + cincin enso vermillion + katakana ヒラタケ)
- ✅ Desain tema Jepang: font Noto Serif JP, warna vermillion/washi/sumi, pola seigaiha, angka kanji (一二三四)
- ✅ Hero section dengan animasi counter statistik & logo mengambang
- ✅ Bagian Tentang (filosofi nama Hiratake & Kodawari)
- ✅ Katalog 6 produk dinamis dari API (`/api/produk`) dengan harga Rupiah
- ✅ Keunggulan usaha (4 kartu fitur)
- ✅ Proses budidaya 4 langkah bernomor kanji
- ✅ Galeri foto budidaya jamur tiram (foto berlisensi CC)
- ✅ Form pemesanan yang otomatis membuat pesan WhatsApp
- ✅ Tombol WhatsApp mengambang, navbar responsif + menu mobile
- ✅ Animasi fade-up saat scroll (IntersectionObserver)

## Entri Fungsional (URI)
| Path | Metode | Deskripsi |
|------|--------|-----------|
| `/` | GET | Halaman utama (landing page lengkap) |
| `/api/produk` | GET | JSON daftar produk (id, nama, harga, satuan, deskripsi, badge) |
| `/static/logo-hiratake.png` | GET | Logo brand |
| `/static/style.css` | GET | CSS kustom tema Jepang |
| `/static/app.js` | GET | JavaScript frontend |

## Fitur yang Belum Diimplementasikan
- ❌ Deploy produksi ke Cloudflare Pages
- ❌ Database D1 untuk manajemen produk/pesanan (saat ini produk hardcoded di API)
- ❌ Halaman admin untuk mengubah produk & harga
- ❌ Nomor WhatsApp asli (masih placeholder `6281234567890` di `public/static/app.js` dan `src/index.tsx`)

## Rekomendasi Langkah Selanjutnya
1. **Ganti nomor WhatsApp** placeholder dengan nomor asli usaha
2. Deploy ke Cloudflare Pages agar punya URL permanen
3. Tambahkan D1 database + halaman admin untuk kelola produk
4. Tambahkan foto asli kumbung milik sendiri di galeri
5. Tambahkan testimoni pelanggan & resep masakan jamur

## Arsitektur Data
- **Model Data**: Produk (id, nama, nama Jepang, harga, satuan, deskripsi, ikon, badge)
- **Penyimpanan**: Hardcoded di route API Hono (belum ada database)
- **Alur Data**: Frontend fetch `/api/produk` → render kartu produk → tombol pesan membuka WhatsApp dengan pesan terformat

## Panduan Penggunaan
1. Buka website, jelajahi produk di bagian **Produk**
2. Klik tombol **Pesan** pada produk, atau isi **form pemesanan** di bagian Kontak
3. Pesanan otomatis terbuka di WhatsApp dengan detail lengkap — tinggal kirim

## Deployment
- **Platform**: Cloudflare Pages (sandbox dev via wrangler + PM2)
- **Status**: ✅ Aktif (sandbox development)
- **Tech Stack**: Hono + TypeScript + TailwindCSS (CDN) + Vite + Wrangler
- **Terakhir Diperbarui**: 2026-08-28
