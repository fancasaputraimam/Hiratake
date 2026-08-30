/** @type {import('tailwindcss').Config} */
// Konfigurasi Tailwind untuk BUILD CSS STATIS (menggantikan CDN cdn.tailwindcss.com).
// Warna `vermillion` sengaja memakai CSS variable agar owner tetap bisa mengganti
// warna tema dari dashboard tanpa perlu build ulang.
module.exports = {
  content: [
    './src/**/*.{ts,tsx,js,jsx}',
    './public/static/**/*.js',
    './public/static/*.html'
  ],
  theme: {
    extend: {
      colors: {
        // rgb(var(--x) / <alpha-value>) → mendukung modifier opasitas (bg-vermillion/10)
        vermillion: 'rgb(var(--vermillion-rgb) / <alpha-value>)',
        sumi: '#2B2B2B',
        washi: '#F7F3EA',
        matcha: '#7A8450',
        kin: '#C9A227'
      },
      fontFamily: {
        serifjp: ['"Noto Serif JP"', 'serif'],
        sans: ['Poppins', 'sans-serif']
      }
    }
  },
  // Kelas yang dibentuk secara dinamis di runtime (dari data DB) tidak terdeteksi
  // pemindai Tailwind — didaftarkan manual di sini.
  safelist: [
    'bg-red-50', 'bg-red-100', 'bg-green-50', 'bg-green-100', 'bg-orange-50', 'bg-orange-100',
    'bg-blue-50', 'bg-blue-100', 'bg-yellow-50', 'bg-yellow-100', 'bg-purple-100', 'bg-gray-100',
    'text-red-500', 'text-red-600', 'text-red-700', 'text-green-600', 'text-green-700',
    'text-orange-600', 'text-orange-700', 'text-blue-700', 'text-yellow-700', 'text-purple-700',
    'text-gray-400', 'text-gray-500', 'text-gray-700',
    'border-red-500', 'border-orange-400', 'border-kin',
    'bg-kin/15', 'border-kin/40', 'text-kin', 'text-sumi/80',
    'opacity-50', 'font-semibold', 'font-bold', 'hidden',
    // Fase 11 — panel Otomatisasi & pemeriksa sistem (warna skor dinamis)
    'bg-amber-50', 'bg-amber-600', 'bg-red-600', 'bg-blue-600',
    'text-amber-600', 'text-amber-700', 'text-blue-600',
    'text-green-700', 'text-red-700',
    'border-green-200', 'border-sumi/10', 'bg-sumi/5',
    'text-sumi/30', 'text-sumi/35', 'text-sumi/55',
    // Fase 13 — kartu kas opname, aset tetap & ekspor buku besar
    'border-red-200', 'border-amber-200', 'bg-green-100',
    'text-green-800', 'text-red-800', 'text-amber-800',
    'text-red-800/80', 'text-amber-800/80',
    'text-sumi/40', 'text-sumi/45', 'text-sumi/50', 'text-sumi/60',
    'bg-vermillion', 'bg-matcha', 'text-matcha'
  ],
  plugins: []
}
