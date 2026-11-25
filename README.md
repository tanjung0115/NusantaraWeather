# NusantaraWeather — Platform Pemantauan & Peringatan Cuaca Indonesia

Platform pemantauan atmosfer, peringatan dini cuaca provinsi, dan visualisasi data geospasial interaktif untuk wilayah Indonesia yang menggabungkan pipeline data Python dengan antarmuka web berbasis **Leaflet** dan **Chart.js**.

## Fitur Utama

1. **Peta Cuaca & Peringatan 38 Provinsi (Real-Time)**
   - Mengambil data cuaca *real-time* dan prakiraan *hourly* untuk seluruh 38 ibu kota provinsi di Indonesia melalui **Open-Meteo API** (otomatis diperbarui setiap 5 menit).
   - **Pewarnaan Provinsi (Choropleth):**
     - **Peringatan Cuaca:** Hijau (*Aman*), Kuning (*Waspada*), Oranye (*Siaga*), Merah (*Awas*).
     - **Mode Layer Lain:** Suhu Permukaan (2m), Kecepatan Angin, Tutupan Awan, Presipitasi, dan Tekanan Udara (MSLP).
   - **Basemap Terang & Mode Gelap/Terang:** Dilengkapi tombol **Dark / Light Mode** di bilah navigasi atas yang tersimpan otomatis di `localStorage`.

2. **Simulasi Waktu Atmosfer & Overlay Geospasial**
   - *Time slider* interaktif berbasis waktu **WIB** (*real-time* mulai dari jam saat ini hingga +21 jam ke depan) dengan tombol putar/jeda.
   - **Overlay Opsional:** Label cuaca 38 provinsi, Heatmap Global, Partikel Angin animasi, Satelit Himawari-8/9 IR (GeoJSON), Stasiun Radiosonde, Batas Wilayah RI, dan Titik Grid 10 km.
   - **Inspektor Koordinat:** Menampilkan koordinat, suhu, kecepatan angin, dan presipitasi secara langsung saat kursor diarahkan ke peta.

3. **Panel Detail Lokasi & Pencarian Daerah**
   - Pencarian lokasi di seluruh Indonesia (Open-Meteo Geocoding) serta *reverse geocoding* (Nominatim) saat mengklik titik mana saja di peta.
   - Menampilkan cuaca saat ini, prakiraan 24 jam, prakiraan 7 hari, grafik **Meteogram** (Temperatur, Presipitasi, Hembusan Angin), grafik **Kualitas Udara (US AQI)**, serta informasi **Matahari & Fase Hari**.

4. **Profil Vertikal Radiosonde**
   - Klik marker stasiun Radiosonde untuk melihat indeks stabilitas atmosfer (**CAPE**, **Lifted Index**, **PWAT**) dan grafik profil vertikal temperatur serta *dewpoint* (1000–100 hPa).

5. **Python Atmospheric Data Pipeline (`python/process_atmospheric_data.py`)**
   - Menghasilkan dataset lokal `radiosonde.json`, `reanalysis.json`, `himawari.geojson`, dan `indonesia_10km.json` ke dalam folder `web/data/`.

## Struktur Folder

```text
C:\PEMANTAUAN CUACA
├── python/
│   └── process_atmospheric_data.py   # Generator dataset atmosfer & grid 10 km
├── web/
│   ├── data/                         # Dataset JSON & GeoJSON lokal
│   ├── index.html                    # Antarmuka utama
│   ├── style.css                     # Styling Dark & Light Mode
│   └── app.js                        # Logika peta, Open-Meteo live, & grafik
├── start_server.bat                  # Peluncur cepat server lokal (Windows)
└── README.md
```

## Cara Menjalankan

Klik dua kali **`start_server.bat`** di folder proyek, atau jalankan secara manual melalui terminal:

```powershell
cd "C:\PEMANTAUAN CUACA"
python python/process_atmospheric_data.py
cd web
python -m http.server 8000
```

Kemudian buka browser dan akses `http://localhost:8000`.
