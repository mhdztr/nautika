# DESIGN.md — Nautika Design Engineering System
**Standar Antarmuka Kelas Dunia Berdasarkan Sintesis Penuh Skills: `emil-design-eng`, `apple-design`, `animate`, `animation-performance`, `mobile-native`, `ask-sonner`, & `break-ui`**

Dokumen ini adalah **sumber kebenaran tunggal untuk seluruh aspek visual, gerak (motion), material, tipografi, dan interaksi** sistem monitoring maritim Nautika. Menggantikan seluruh versi sebelumnya. 

Karakter visual Nautika: **Mission-Critical Maritime Cockpit yang memadukan keanggunan Apple Human Interface Guidelines dengan presisi rekayasa desain Emil Kowalski (Linear/Vercel grade).** Antarmuka terasa hidup, tactile, tenang, dan beroperasi pada 60fps tanpa kompromi.

Nama produk: **Nautika**. Tidak ada subtitle/tagline di bawah nama produk maupun di bawah judul halaman mana pun.

---

## 1. Negative Prompt — Larangan Keras (Strict Anti-Slop & Anti-Outdated)

Setiap komponen yang dibangun **wajib bebas** dari 17 cacat desain berikut:

1. **DILARANG tombol 3D bevel / hard bottom border** (misal: `border-bottom: 4px solid rgba(0,0,0,0.25)` atau efek tombol timbul tebal). Seluruh tombol berasa *tactile* melalui kompresi pegas aktif (`transform: scale(0.97)` via `--ease-out` pada `:active`/`pointerdown`).
2. **DILARANG tabrakan multi-font (font collision)** (seperti Poppins bercampur Plus Jakarta Sans). Seluruh antarmuka 100% menggunakan **Plus Jakarta Sans** dengan tabel optical tracking yang presisi.
3. **DILARANG angka proporsional non-tabular pada metrik/tabel/waktu** (`font-variant-numeric: normal`). Semua angka KPI, jam operasional, nominal Rupiah, koordinat WPP, dan persentase WAJIB memakai `font-variant-numeric: tabular-nums` dan `-webkit-font-feature-settings: "tnum"`.
4. **DILARANG permukaan "kardus mati" (flat cardboard syndrome)** (kartu solid `#FFFFFF` kaku tanpa kedalaman optik di atas kanvas abu). Seluruh kartu mengadopsi material translusen berkilau halus via `backdrop-filter: blur(20px) saturate(180%)`, border 1px `rgba(0,0,0,0.07)`, dan inner light edge `inset 0 1px 0 rgba(255,255,255,0.7)`.
5. **DILARANG modal "teleportasi" tanpa titik asal spasial**. Modal dilarang muncul mendadak dari tengah layar secara kaku. Modal wajib menganimasikan pembesaran skala halus (`scale(0.95) translateY(10px) -> scale(1.0) translateY(0)`) berakar dari elemen pemicunya (*anchored origin*).
6. **DILARANG animasi `scale(0)`**. Tidak ada objek di dunia nyata yang muncul dari ukuran nol mutlak. State masuk elemen dimulai dari `scale(0.94–0.97)` dipadukan dengan `opacity: 0`.
7. **DILARANG kurva generik `ease` atau `ease-in` pada UI**. `ease-in` membuat awal transisi terasa lambat dan lagging. Seluruh gerak transisi UI menggunakan kurva perlambatan tajam Emil Kowalski: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`.
8. **DILARANG durasi animasi di atas 300ms untuk elemen UI harian**. Tombol: 100–160ms; dropdown/select: 150–220ms; modal/drawer: 200–280ms. Animasi lambat membuat software terasa lamban.
9. **DILARANG border radius yang melanggar hukum konsentris**. Berlaku mutlak rumus Apple: $\text{Radius Inner} = \max(0, \text{Radius Outer} - \text{Padding})$.
10. **DILARANG 1-warna-per-stat-card**. Tidak ada kartu metrik dengan ikon warni-warni (pink, cyan, oranye, ungu). Ikon (jika ada) monokrom abu/navy netral. Fokus ada pada angka dan label.
11. **DILARANG gradient blob/mesh dekoratif yang mengganggu baca data**.
12. **DILARANG badge status warna-warni tanpa makna fungsional**. Badge hanya digunakan untuk 3 status semantik nyata (Success/Warning/Critical).
13. **DILARANG banner alert inline invasif yang mendorong tata letak (*layout jump*)**. Seluruh notifikasi hasil operasi dialihkan ke arsitektur Sonner floating toast yang bertumpuk rapi di sudut layar.
14. **DILARANG efek hover tersangkut pada perangkat layar sentuh**. Seluruh deklarasi `:hover` wajib dibungkus kueri kapabilitas: `@media (hover: hover) and (pointer: fine)`.
15. **DILARANG kilatan abu-abu browser saat tap di ponsel**. Wajib mematikan `-webkit-tap-highlight-color: transparent` pada root.
16. **DILARANG animasi properti pemicu Layout & Paint**. Hanya menganimasikan properti GPU Compositor: `transform` dan `opacity` (serta `clip-path` berkinerja tinggi). Jangan pernah menganimasikan `width`, `height`, `margin`, `padding`, `top`, atau `left`.
17. **DILARANG huruf kapital penuh abu-abu pudar (washed-out all-caps AI-slop trope)** (seperti `text-transform: uppercase; color: var(--n-text-muted)` dengan tracking renggang pada judul kartu, label form, info row, dan header tabel). Pola visual ini terbukti merusak keterbacaan, tampak artifisial, dan tidak ergonomis untuk sistem kokpit operasional. Seluruh label metrik, header tabel, form label, dan penunjuk data WAJIB menggunakan Title Case atau Sentence Case alami dengan kontras tinggi Slate Navy (`var(--n-text-secondary)` / `#4A5568`), bobot tegas (`font-weight: 600`), dan tracking optik rapat natural (`-0.01em` hingga `-0.005em`).

---

## 2. Tipografi — Unified Plus Jakarta Sans & Optical Sizing

Seluruh antarmuka Nautika menggunakan satu keluarga font tunggal berkinerja tinggi: **Plus Jakarta Sans**.

### 2.1 Skala Tipografi & Tracking (Letter-Spacing) Apple
Tracking optik disesuaikan secara dinamis berbanding terbalik dengan ukuran font (semakin besar ukuran, semakin rapat tracking):

| Peran Tipografi | Ukuran | Bobot (Weight) | Tracking (Letter-Spacing) | Penggunaan |
|---|---|---|---|---|
| **Display Hero Metric** | `32px`–`38px` | 800 (Extra Bold) | `-0.025em` | Angka KPI utama ikhtisar, hero data |
| **Page Title** | `22px`–`24px` | 700 (Bold) | `-0.020em` | Judul modul utama (tanpa subtitle) |
| **Section Header** | `17px`–`18px` | 700 (Bold) | `-0.015em` | Judul sub-konteks, header tabel |
| **Card Label / Subhead** | `13px`–`14px` | 600 (Semi Bold) | `-0.010em` | Label kartu, header kolom |
| **Body Regular** | `13px`–`14px` | 400 (Regular) | `-0.005em` | Teks paragraf, sel tabel data |
| **Body Medium / Interactive** | `13px`–`14px` | 500 (Medium) | `-0.005em` | Input form, tombol aksi |
| **Caption / Micro Footnote** | `11px`–`12px` | 500 (Medium) | `+0.010em` | Label status, timestamp telemetri |
| **Micro Badge / Code** | `10px`–`11px` | 600 (Semi Bold) | `+0.025em` | Tag WPP, kode registrasi |

> [!IMPORTANT]
> **Aturan Kapitalisasi Baku**: Seluruh judul kartu, subhead metrik, label formulir, header tabel, dan label navigasi WAJIB menggunakan **Title Case** atau **Sentence Case** alami dengan kontras tinggi (`var(--n-text-secondary)`). DILARANG menggunakan `text-transform: uppercase` yang dipadukan dengan warna abu-abu pudar (`var(--n-text-muted)`).

### 2.2 Aturan Baku Tabular Numbers
Semua elemen yang merender angka numerik (angka KPI, persentase serapan, nominal Rupiah, jam layar/terbang, koordinat GPS, timer live) **WAJIB** memiliki deklarasi CSS:
```css
font-variant-numeric: tabular-nums;
-webkit-font-feature-settings: "tnum";
font-feature-settings: "tnum";
```
Hal ini mencegah pergeseran lebar horizontal (*layout jitter*) saat data diperbarui secara real-time.

---

## 3. Palet Warna, Translucent Materials & Vibrancy

### 3.1 Netral & Material Translusen (Apple Vibrancy Layer)
| Token | Nilai / CSS | Karakter Optik & Penggunaan |
|---|---|---|
| `--n-bg-base` | `#F4F7FE` | Kanvas dasar sistem (latar belakang belakang layar) |
| `--n-material-surface` | `rgba(255, 255, 255, 0.84)` | Kartu KPI, kontainer tabel data (`backdrop-filter: blur(20px) saturate(180%)`) |
| `--n-material-glass` | `rgba(255, 255, 255, 0.65)` | Panel filter, input background idle, mini cards |
| `--n-material-floating` | `rgba(255, 255, 255, 0.94)` | Modal popup, dropdown menu, context drawer (`backdrop-filter: blur(32px)`) |
| `--n-material-header` | `rgba(244, 247, 254, 0.88)` | Navbar atas fixed (`backdrop-filter: blur(20px) saturate(180%)`) |
| `--n-text-primary` | `#2B3674` | Teks utama, angka dominan (Deep Maritime Navy) |
| `--n-text-secondary` | `#4A5568` | Teks keterangan, sub-data, deskripsi pekerjaan |
| `--n-text-muted` | `#A3AED0` | Label sekunder, placeholder input, divider hint |
| `--n-border-hairline` | `rgba(0, 0, 0, 0.07)` | Garis batas kartu & pembatas tipis (1px crisp) |
| `--n-border-highlight` | `rgba(255, 255, 255, 0.75)` | Inner light-catching edge atas kartu |
| `--n-border-focus-ring`| `rgba(43, 54, 116, 0.35)` | Focus ring halus dengan spread 3px |

### 3.2 Aksen & Status Semantik
| Token | Hex / RGBA | Penggunaan |
|---|---|---|
| `--n-primary` | `#2B3674` | Deep Navy — Tombol utama, rel sidebar, garis chart dominan |
| `--n-primary-light` | `#E4E7F2` | Tint navy muda — Seleksi aktif, hover background |
| `--n-status-success` | `#10B981` | Emerald — Siap Operasi / Laporan Masuk / Target Tercapai |
| `--n-status-success-bg` | `rgba(16, 185, 129, 0.12)` | Latar soft badge status sukses |
| `--n-status-warning` | `#F59E0B` | Amber — Siap Pangkalan / Mendekati Batas / Perhatian |
| `--n-status-warning-bg` | `rgba(245, 158, 11, 0.12)` | Latar soft badge status peringatan |
| `--n-status-critical` | `#EF4444` | Crimson — Tidak Siap / Harwat Galangan / Data Dianulir |
| `--n-status-critical-bg`| `rgba(239, 68, 68, 0.12)` | Latar soft badge status kritis / bahaya |

---

## 4. Geometri Konsentris & Layered Lighting

### 4.1 Hukum Geometri Konsentris (Concentric Radius Law)
Elemen di dalam kontainer bersudut lengkung wajib mengikuti rumus kelengkungan konsentris Apple:
$$\text{Radius Inner} = \max(0, \text{Radius Outer} - \text{Padding})$$
Penerapan standar di Nautika:
- Kartu Kontainer (Outer): `border-radius: 18px`, `padding: 20px` $\rightarrow$ Input / Tombol di dalamnya: `border-radius: 10px`.
- Filter Box Container: `border-radius: 12px`, `padding: 4px` $\rightarrow$ Segmented Pill di dalamnya: `border-radius: 8px`.

### 4.2 Layered Ambient Lighting (Apple Soft Diffuse Shadows)
Menghindari shadow hitam pekat satu lapis. Menggunakan difusi multi-layer berbasis ambient navy:
- **Level 1 (Card / Container Surface)**:
  `box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03), 0 6px 16px -2px rgba(43, 54, 116, 0.05);`
- **Level 2 (Dropdown / Popover / Hover Lift)**:
  `box-shadow: 0 3px 6px -1px rgba(0, 0, 0, 0.04), 0 12px 28px -4px rgba(43, 54, 116, 0.10);`
- **Level 3 (Modal Dialog / Command Sheet / Toaster)**:
  `box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.12), 0 32px 72px -12px rgba(43, 54, 116, 0.22);`

---

## 5. Fisika Pegas & Rekayasa Animasi (Emil Kowalski Standard)

Antarmuka Nautika beroperasi seperti mesin fisik presisi: cepat, responsif, dan stabil.

### 5.1 Token Kurva & Kecepatan
```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1);    /* Perlambatan tajam untuk antarmuka UI */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* Gerak kontinu objek di layar */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);   /* Kurva inersia sheet iOS */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1); /* Penegasan centang sukses */
```

### 5.2 Umpan Balik Tekanan Taktil (Instant Press Response)
Semua elemen interaktif (tombol, segmented control, opsi dropdown, kartu klik) memberikan umpan balik skala instan pada `pointerdown`:
```css
.btn-primary:active,
.btn-ghost:active,
.nav-item:active,
.kdl-option:active {
  transform: scale(0.97);
  transition: transform 90ms var(--ease-out);
}
```

### 5.3 Anchored Modal & Popover Presentation
- Modal **DILARANG** muncul dari tengah tanpa arah.
- Modal berakar dari koordinat elemen pemicu (*trigger origin*):
  - State awal: `transform: scale(0.95) translateY(10px); opacity: 0;`
  - State aktif: `transform: scale(1.0) translateY(0); opacity: 1; transition: transform 220ms var(--ease-out), opacity 200ms var(--ease-out);`
- Backdrop overlay menggunakan frosted dark scrim:
  ```css
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(12px) saturate(140%);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  ```

### 5.4 Staggered Entrance pada Navigasi Antar Halaman
Saat berpindah view (misal dari Overview ke Operasi Laut), kartu KPI dan tabel tidak muncul bersamaan secara kaku, melainkan mengalir dalam cascade bertingkat:
- Kartu KPI 1: delay `0ms`
- Kartu KPI 2: delay `35ms`
- Kartu KPI 3: delay `70ms`
- Kartu KPI 4: delay `105ms`
- Chart Section: delay `140ms`
- Tabel Riwayat: delay `175ms`

Setiap item masuk dari `scale(0.97) translateY(8px)` ke posisi normal dalam 240ms dengan kurva `--ease-out`.

---

## 6. Arsitektur Sonner Toast (Non-Blocking Floating Notification)

Menggantikan banner error/sukses inline yang menyebabkan layout shift.

### 6.1 Posisi & Tumpukan (Stacking Physics)
- Kontainer `#n-toaster` ditempatkan fixed di sudut kanan bawah (`bottom: 24px; right: 24px; z-index: 1000;`).
- Mendukung maksimal 3 toast bertumpuk di mana toast terdepan tampil penuh, dan toast di belakangnya terskala mundur (`scale(0.94)`, `translateY(-10px)`).
- Mendukung gestur usap ke kanan (*swipe-to-dismiss*) untuk menutup instan.

### 6.2 Alur Operasi Asinkron (`toast.promise`)
Setiap kali pelaporan atau data disimpan ke server via GAS:
1. Menampilkan loading toast: icon spinner ringkas + pesan "Menyimpan ke server..."
2. Jika sukses: bertransisi mulus dalam toast yang sama menjadi centang hijau emerald + teks "Laporan Berhasil Disimpan" + tombol aksi opsional.
3. Jika gagal: bertransisi menjadi tanda seru merah ruby + pesan error ramah + tombol `Coba Lagi`.

---

## 7. Standar Mobile-Native (`mobile-native`)

Menjamin pengalaman penggunaan di ponsel terasa seperti aplikasi native yang terpasang, bukan sekadar website:

1. **Tap Highlight**: `-webkit-tap-highlight-color: transparent` pada root.
2. **Hover Gating**: Seluruh hover hanya aktif pada mouse:
   ```css
   @media (hover: hover) and (pointer: fine) {
     .kpi-card:hover { transform: translateY(-1px); box-shadow: var(--n-shadow-ambient-2); }
     .btn-primary:hover { background: var(--n-primary-hover); }
   }
   ```
3. **No 300ms Delay**: `touch-action: manipulation` pada seluruh tombol, tautan, dan elemen input.
4. **Cegah iOS Zoom**: Seluruh `input`, `select`, dan `textarea` memiliki ukuran font minimal `16px` pada perangkat coarse pointer:
   ```css
   @media (pointer: coarse) {
     input, select, textarea { font-size: 16px !important; }
   }
   ```
5. **Viewport Dinamis**: Menggunakan `100dvh` (bukan `100vh`) agar elemen tidak tertutup oleh bar alamat peramban ponsel.
6. **Safe Area Insets**: Mendukung `padding-bottom: env(safe-area-inset-bottom)` pada floating controls dan footer.

---

## 8. Panduan Visualisasi Data & Chart (Tunduk pada PRD §10)

1. **Five-Second Rule**: Pengguna wajib dapat memahami *"berapa angkanya, baik/buruk, perlu tindakan atau tidak"* dalam $\le 5$ detik.
2. **Satu Palet Terbatas**: Seluruh chart hanya menggunakan variasi intensitas warna `--n-primary` (Deep Navy) dipadukan dengan abu-abu netral untuk pembanding target. Tidak ada palet pelangi dekoratif.
3. **Bebas Chartjunk**: Tanpa gridline tebal, tanpa background warna-warni, tanpa efek 3D, tanpa gauge speedometer.
4. **Variasi 2 Tipe Representasi**: Setiap halaman minimal menyajikan dua format representasi berbeda (mis. KPI strip + Horizontal Bar Chart + Tabel Data).
5. **Data-Ink Ratio Maksimal**: Angka penting selalu ditampilkan sebagai teks readout besar di kartu ringkasan, bukan tersembunyi hanya dalam tooltip.

---

## 9. Ketahanan Data Ekstrem (`break-ui` Standard)

Setiap komponen yang dibangun wajib lolos dari pengujian data terburuk:
- **Nama Panjang**: Penanganan teks hingga 100 karakter dengan `min-width: 0`, `text-overflow: ellipsis`, dan atribut `title` lengkap.
- **Nilai Ekstrem**: Angka desimal, triliunan Rupiah, dan 0-state diuji agar tidak merusak kisi tata letak.
- **Teks Tak Terputus**: Penggunaan `overflow-wrap: anywhere` pada deskripsi dan identifikasi maritim.
- **Zero-State**: Jika tidak ada data laporan, tampilkan status kosong elegan (ilustrasi monokromatik netral + instruksi langkah pertama), bukan kontainer putih kosong tak bermakna.

---

## 10. Nada Bahasa UI

Lugas, fungsional, bahasa Indonesia formal-teknis kedinasan Direktorat POA KKP RI. Bebas dari istilah marketing, emoji, atau kalimat motivasi basa-basi.
