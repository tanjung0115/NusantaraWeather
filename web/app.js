const map = L.map("map", {
  center: [-2.4, 118.0],
  zoom: 5,
  minZoom: 2,
  maxZoom: 12,
  zoomControl: false,
});

L.control.zoom({ position: "topright" }).addTo(map);

// Peta dasar laut biru & daratan hijau tanpa API key (Esri World Topo Map)
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", {
  attribution: "&copy; Esri, HERE, Garmin, OpenStreetMap",
  maxZoom: 18,
}).addTo(map);

const indonesiaHighlightLayer = L.layerGroup().addTo(map);
const coastlineLayer = L.layerGroup().addTo(map);
const cityWeatherLayer = L.layerGroup().addTo(map);
const himawariLayer = L.layerGroup().addTo(map);
const radiosondeLayer = L.layerGroup().addTo(map);

const heatmapCanvas = document.getElementById("heatmap-canvas");
const heatmapCtx = heatmapCanvas.getContext("2d");
const windCanvas = document.getElementById("wind-canvas");
const windCtx = windCanvas.getContext("2d");
const grid10kmCanvas = document.getElementById("grid10km-canvas");
const grid10kmCtx = grid10kmCanvas.getContext("2d");

let reanalysisData = null;
let indonesia10kmData = null;
let radiosondeData = null;
let indonesiaGeoJson = null;
let radiosondeChart = null;
let meteogramChart = null;
let aqiChart = null;
let currentDailyData = null;
let activeMeteoTab = "temp";
let activeLayer = "alert";
let activeStep = 0;
let showHeatmap = false;
let showParticles = false;
let showGrid10km = false;
let playTimer = null;

// 38 Provinsi di Indonesia (Ibu Kota Provinsi) untuk data cuaca real-time Open-Meteo
const INDONESIA_PROVINCES = [
  { province: "Aceh", city: "Banda Aceh", lat: 5.55, lon: 95.32 },
  { province: "Sumatera Utara", city: "Medan", lat: 3.59, lon: 98.67 },
  { province: "Sumatera Barat", city: "Padang", lat: -0.95, lon: 100.35 },
  { province: "Riau", city: "Pekanbaru", lat: 0.51, lon: 101.45 },
  { province: "Kepulauan Riau", city: "Tanjungpinang", lat: 0.92, lon: 104.45 },
  { province: "Jambi", city: "Jambi", lat: -1.61, lon: 103.61 },
  { province: "Sumatera Selatan", city: "Palembang", lat: -2.99, lon: 104.76 },
  { province: "Kep. Bangka Belitung", city: "Pangkalpinang", lat: -2.13, lon: 106.11 },
  { province: "Bengkulu", city: "Bengkulu", lat: -3.80, lon: 102.26 },
  { province: "Lampung", city: "Bandar Lampung", lat: -5.43, lon: 105.26 },
  { province: "DKI Jakarta", city: "Jakarta", lat: -6.21, lon: 106.85 },
  { province: "Jawa Barat", city: "Bandung", lat: -6.91, lon: 107.61 },
  { province: "Banten", city: "Serang", lat: -6.12, lon: 106.15 },
  { province: "Jawa Tengah", city: "Semarang", lat: -6.97, lon: 110.42 },
  { province: "DI Yogyakarta", city: "Yogyakarta", lat: -7.80, lon: 110.36 },
  { province: "Jawa Timur", city: "Surabaya", lat: -7.25, lon: 112.75 },
  { province: "Bali", city: "Denpasar", lat: -8.65, lon: 115.22 },
  { province: "Nusa Tenggara Barat", city: "Mataram", lat: -8.58, lon: 116.12 },
  { province: "Nusa Tenggara Timur", city: "Kupang", lat: -10.17, lon: 123.61 },
  { province: "Kalimantan Barat", city: "Pontianak", lat: -0.02, lon: 109.34 },
  { province: "Kalimantan Tengah", city: "Palangkaraya", lat: -2.21, lon: 113.92 },
  { province: "Kalimantan Selatan", city: "Banjarmasin", lat: -3.32, lon: 114.59 },
  { province: "Kalimantan Timur", city: "Samarinda", lat: -0.50, lon: 117.15 },
  { province: "Kalimantan Utara", city: "Tanjung Selor", lat: 2.84, lon: 117.37 },
  { province: "Sulawesi Utara", city: "Manado", lat: 1.47, lon: 124.84 },
  { province: "Gorontalo", city: "Gorontalo", lat: 0.54, lon: 123.06 },
  { province: "Sulawesi Tengah", city: "Palu", lat: -0.90, lon: 119.87 },
  { province: "Sulawesi Barat", city: "Mamuju", lat: -2.68, lon: 118.89 },
  { province: "Sulawesi Selatan", city: "Makassar", lat: -5.14, lon: 119.43 },
  { province: "Sulawesi Tenggara", city: "Kendari", lat: -3.99, lon: 122.51 },
  { province: "Maluku", city: "Ambon", lat: -3.70, lon: 128.18 },
  { province: "Maluku Utara", city: "Sofifi", lat: 0.74, lon: 127.56 },
  { province: "Papua Barat", city: "Manokwari", lat: -0.86, lon: 134.06 },
  { province: "Papua Barat Daya", city: "Sorong", lat: -0.88, lon: 131.26 },
  { province: "Papua", city: "Jayapura", lat: -2.53, lon: 140.71 },
  { province: "Papua Tengah", city: "Nabire", lat: -3.37, lon: 135.50 },
  { province: "Papua Pegunungan", city: "Wamena", lat: -4.10, lon: 138.95 },
  { province: "Papua Selatan", city: "Merauke", lat: -8.49, lon: 140.40 },
];

let liveProvincesWeather = []; // Menyimpan data real-time 38 provinsi dari Open-Meteo

// Grid metadata untuk interpolasi cepat
let gridLats = [];
let gridLons = [];
let gridMatrix = []; // [latIdx][lonIdx]

// Partikel angin halus ala Ventusky
const PARTICLE_COUNT = 650;
let particles = [];

const LAYER_CONFIG = {
  alert: {
    title: "Tingkat Peringatan Cuaca",
    min: 0,
    max: 3,
    labels: ["Aman", "Waspada", "Siaga", "Awas"],
    gradient: "linear-gradient(90deg, #16a34a 0%, #fde047 38%, #f97316 70%, #ef4444 100%)",
    getValue: (p) => (p.precip_mm >= 10 ? 3 : p.precip_mm >= 5 ? 2 : p.precip_mm >= 2 ? 1 : 0),
    colorAt: (t) => interpolateColors(t, [
      [22, 163, 74],
      [250, 204, 21],
      [249, 115, 22],
      [239, 68, 68],
    ]),
  },
  temp: {
    title: "Suhu Permukaan (°C)",
    min: 22,
    max: 35,
    labels: ["22°", "25°", "28°", "31°", "35°"],
    gradient: "linear-gradient(90deg, #3b82f6, #22c55e, #eab308, #f97316, #ef4444)",
    getValue: (p) => p.temp_2m_c,
    colorAt: (t) => interpolateColors(t, [
      [59, 130, 246],
      [34, 197, 94],
      [234, 179, 8],
      [249, 115, 22],
      [239, 68, 68],
    ]),
  },
  wind: {
    title: "Kecepatan Angin (m/s)",
    min: 0,
    max: 12,
    labels: ["0", "3", "6", "9", "12 m/s"],
    gradient: "linear-gradient(90deg, #1d4ed8, #0d9488, #22c55e, #eab308, #ef4444)",
    getValue: (p) => p.wind_speed_ms,
    colorAt: (t) => interpolateColors(t, [
      [29, 78, 216],
      [13, 148, 136],
      [34, 197, 94],
      [234, 179, 8],
      [239, 68, 68],
    ]),
  },
  clouds: {
    title: "Tutupan Awan (%)",
    min: 0,
    max: 100,
    labels: ["0%", "25%", "50%", "75%", "100%"],
    gradient: "linear-gradient(90deg, #0284c7, #38bdf8, #94a3b8, #cbd5e1, #f8fafc)",
    getValue: (p) => p.cloud_cover_pct,
    colorAt: (t) => interpolateColors(t, [
      [2, 132, 199],
      [56, 189, 248],
      [148, 163, 184],
      [203, 213, 225],
      [248, 250, 252],
    ]),
  },
  precip: {
    title: "Presipitasi (mm / 3 jam)",
    min: 0,
    max: 20,
    labels: ["0", "5", "10", "15", "20 mm"],
    gradient: "linear-gradient(90deg, #0f172a, #0284c7, #38bdf8, #a855f7, #ec4899)",
    getValue: (p) => p.precip_mm,
    colorAt: (t) => interpolateColors(t, [
      [15, 23, 42],
      [2, 132, 199],
      [56, 189, 248],
      [168, 85, 247],
      [236, 72, 153],
    ]),
  },
  mslp: {
    title: "Tekanan Udara MSLP (hPa)",
    min: 1006,
    max: 1014,
    labels: ["1006", "1008", "1010", "1012", "1014"],
    gradient: "linear-gradient(90deg, #6366f1, #06b6d4, #22c55e, #f59e0b, #ef4444)",
    getValue: (p) => p.mslp_hpa,
    colorAt: (t) => interpolateColors(t, [
      [99, 102, 241],
      [6, 182, 212],
      [34, 197, 94],
      [245, 158, 11],
      [239, 68, 68],
    ]),
  },
};

function interpolateColors(t, stops) {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (stops.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;
  const c1 = stops[idx];
  const c2 = stops[Math.min(idx + 1, stops.length - 1)];
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * frac),
    Math.round(c1[1] + (c2[1] - c1[1]) * frac),
    Math.round(c1[2] + (c2[2] - c1[2]) * frac),
  ];
}

function resizeCanvases() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  heatmapCanvas.width = w;
  heatmapCanvas.height = h;
  windCanvas.width = w;
  windCanvas.height = h;
  grid10kmCanvas.width = w;
  grid10kmCanvas.height = h;
  renderHeatmap();
  renderGrid10km();
}

function buildGridMatrix() {
  if (!reanalysisData) return;
  const points = reanalysisData.timesteps[activeStep].points;
  const latSet = new Set();
  const lonSet = new Set();
  points.forEach((p) => {
    latSet.add(p.lat);
    lonSet.add(p.lon);
  });
  gridLats = Array.from(latSet).sort((a, b) => a - b);
  gridLons = Array.from(lonSet).sort((a, b) => a - b);

  const lookup = new Map(points.map((p) => [`${p.lat},${p.lon}`, p]));
  gridMatrix = gridLats.map((lat) =>
    gridLons.map((lon) => lookup.get(`${lat},${lon}`))
  );
}

// Interpolasi bilinear untuk nilai halus di titik (lat, lon) mana pun di dunia
// Menggunakan grid resolusi tinggi 10 km (97.280 titik) jika berada di wilayah Indonesia
function sampleAtLatLng(lat, rawLon) {
  const lon = ((((rawLon + 180) % 360) + 360) % 360) - 180;

  if (indonesia10kmData) {
    const d = indonesia10kmData;
    const latMax = d.lat_min + (d.n_lats - 1) * d.step_deg;
    const lonMax = d.lon_min + (d.n_lons - 1) * d.step_deg;
    if (lat >= d.lat_min && lat <= latMax && lon >= d.lon_min && lon <= lonMax) {
      const fi = (lat - d.lat_min) / d.step_deg;
      const fj = (lon - d.lon_min) / d.step_deg;
      const i = Math.min(d.n_lats - 2, Math.max(0, Math.floor(fi)));
      const j = Math.min(d.n_lons - 2, Math.max(0, Math.floor(fj)));
      const ty = fi - i;
      const tx = fj - j;

      const idx00 = i * d.n_lons + j;
      const idx01 = idx00 + 1;
      const idx10 = (i + 1) * d.n_lons + j;
      const idx11 = idx10 + 1;

      const bilerpArr = (arr, scale = 0.1, offset = 0) => {
        const a = arr[idx00] * (1 - tx) + arr[idx01] * tx;
        const b = arr[idx10] * (1 - tx) + arr[idx11] * tx;
        return (a * (1 - ty) + b * ty) * scale + offset;
      };

      const phase = Math.sin((activeStep / 8) * 2 * Math.PI);
      const u = bilerpArr(d.u_x10) + 0.8 * phase;
      const v = bilerpArr(d.v_x10) + 0.5 * Math.cos((activeStep / 8) * 2 * Math.PI);
      const precip = Math.max(0, bilerpArr(d.precip_x10) + 1.5 * phase);

      return {
        temp_2m_c: bilerpArr(d.temp_x10) + 1.4 * phase,
        mslp_hpa: bilerpArr(d.mslp_offset_x10, 0.1, 1000.0),
        u,
        v,
        wind_speed_ms: Math.hypot(u, v),
        precip_mm: precip,
        cloud_cover_pct: Math.min(100, Math.max(10, Math.round(precip * 6.2 + 18))),
        is_10km: true,
      };
    }
  }

  if (!gridLats.length || !gridLons.length) return null;
  if (lat < gridLats[0] || lat > gridLats[gridLats.length - 1]) {
    return null;
  }

  let i = 0;
  while (i < gridLats.length - 2 && gridLats[i + 1] < lat) i++;
  let j = 0;
  while (j < gridLons.length - 2 && gridLons[j + 1] < lon) j++;

  const lat0 = gridLats[i], lat1 = gridLats[i + 1];
  const lon0 = gridLons[j], lon1 = gridLons[j + 1];
  const ty = (lat - lat0) / (lat1 - lat0 || 1);
  const tx = (lon - lon0) / (lon1 - lon0 || 1);

  const p00 = gridMatrix[i][j];
  const p01 = gridMatrix[i][j + 1];
  const p10 = gridMatrix[i + 1][j];
  const p11 = gridMatrix[i + 1][j + 1];

  const bilerp = (key) => {
    const a = p00[key] * (1 - tx) + p01[key] * tx;
    const b = p10[key] * (1 - tx) + p11[key] * tx;
    return a * (1 - ty) + b * ty;
  };

  const precip = bilerp("precip_mm");
  const cloudCover = Math.min(100, Math.max(10, Math.round(precip * 6.2 + 18)));

  return {
    temp_2m_c: bilerp("temp_2m_c"),
    mslp_hpa: bilerp("mslp_hpa"),
    u: bilerp("u"),
    v: bilerp("v"),
    wind_speed_ms: bilerp("wind_speed_ms"),
    precip_mm: precip,
    cloud_cover_pct: cloudCover,
  };
}

function describeWeather(sample) {
  if (sample.precip_mm >= 10) return { text: "Hujan Lebat / Konvektif", icon: "⛈️" };
  if (sample.precip_mm >= 4) return { text: "Hujan Ringan - Sedang", icon: "🌧️" };
  if (sample.cloud_cover_pct >= 65) return { text: "Mendung / Berawan Tebal", icon: "☁️" };
  if (sample.cloud_cover_pct >= 35) return { text: "Cerah Berawan", icon: "⛅" };
  return { text: "Cerah", icon: "☀️" };
}

function wmoCodeToWeather(code) {
  const mapCodes = {
    0: { text: "Cerah", icon: "☀️" },
    1: { text: "Cerah Berawan", icon: "🌤️" },
    2: { text: "Berawan Sebagian", icon: "⛅" },
    3: { text: "Mendung / Berawan", icon: "☁️" },
    45: { text: "Berkabut", icon: "🌫️" },
    48: { text: "Kabut Tebal", icon: "🌫️" },
    51: { text: "Gerimis Ringan", icon: "🌦️" },
    53: { text: "Gerimis Sedang", icon: "🌦️" },
    55: { text: "Gerimis Lebat", icon: "🌧️" },
    61: { text: "Hujan Ringan", icon: "🌧️" },
    63: { text: "Hujan Sedang", icon: "🌧️" },
    65: { text: "Hujan Lebat", icon: "⛈️" },
    80: { text: "Hujan Lokal", icon: "🌦️" },
    81: { text: "Hujan Deras", icon: "🌧️" },
    82: { text: "Hujan Sangat Deras", icon: "⛈️" },
    95: { text: "Badai Petir", icon: "⛈️" },
    96: { text: "Badai Petir & Hujan Es", icon: "⛈️" },
    99: { text: "Badai Petir Ekstrem", icon: "⛈️" },
  };
  return mapCodes[code] || { text: "Berawan", icon: "⛅" };
}

// Ambil data cuaca REAL-TIME + prakiraan 24 jam untuk seluruh 38 Provinsi di Indonesia dalam 1 request Open-Meteo
async function fetchLiveProvincesWeather() {
  try {
    const lats = INDONESIA_PROVINCES.map((p) => p.lat).join(",");
    const lons = INDONESIA_PROVINCES.map((p) => p.lon).join(",");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m&forecast_days=2&timezone=Asia%2FJakarta`;

    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const list = Array.isArray(data) ? data : [data];

    liveProvincesWeather = INDONESIA_PROVINCES.map((prov, idx) => ({
      ...prov,
      live: list[idx] && list[idx].current ? list[idx].current : null,
      hourly: list[idx] && list[idx].hourly ? list[idx].hourly : null,
    }));

    const updEl = document.getElementById("alert-updated");
    if (updEl) {
      const nowStr = new Date().toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
      });
      updEl.textContent = `Live • ${nowStr} WIB`;
    }

    renderCityWeatherLabels();
    renderProvinceChoropleth();
  } catch {
    // Jika offline, tetap pakai fallback grid 10 km
  }
}

function getProvinceWeatherStats(prov) {
  let temp, cloud, windMs, precip, pressure, humidity, wx, code = 0;

  if (prov.live && activeStep === 0) {
    temp = prov.live.temperature_2m;
    cloud = prov.live.cloud_cover;
    windMs = prov.live.wind_speed_10m / 3.6;
    precip = prov.live.precipitation;
    pressure = prov.live.surface_pressure;
    humidity = prov.live.relative_humidity_2m;
    code = prov.live.weather_code;
    wx = wmoCodeToWeather(code);
  } else if (prov.hourly && prov.hourly.time && prov.hourly.time.length) {
    const nowHour = prov.live && prov.live.time ? prov.live.time.slice(0, 13) : "";
    let baseIdx = nowHour ? prov.hourly.time.findIndex((t) => t.startsWith(nowHour)) : 0;
    if (baseIdx < 0) baseIdx = 0;
    const targetIdx = Math.min(prov.hourly.time.length - 1, baseIdx + activeStep * 3);

    temp = prov.hourly.temperature_2m[targetIdx];
    cloud = prov.hourly.cloud_cover[targetIdx];
    windMs = prov.hourly.wind_speed_10m[targetIdx] / 3.6;
    precip = prov.hourly.precipitation[targetIdx];
    pressure = prov.hourly.surface_pressure[targetIdx];
    humidity = null;
    code = prov.hourly.weather_code[targetIdx];
    wx = wmoCodeToWeather(code);
  } else {
    const sample = sampleAtLatLng(prov.lat, prov.lon);
    if (!sample) return null;
    temp = sample.temp_2m_c;
    cloud = sample.cloud_cover_pct;
    windMs = sample.wind_speed_ms;
    precip = sample.precip_mm;
    pressure = sample.mslp_hpa;
    humidity = null;
    wx = describeWeather(sample);
  }

  let alertLevel = 0; // 0=Aman (Hijau), 1=Waspada (Kuning), 2=Siaga (Oranye), 3=Awas (Merah)
  if (code >= 95 || precip >= 10 || windMs >= 11) alertLevel = 3;
  else if (code >= 63 || precip >= 4 || windMs >= 8.5) alertLevel = 2;
  else if (code >= 51 || precip >= 1.0 || windMs >= 7.0) alertLevel = 1;

  return { temp, cloud, windMs, precip, pressure, humidity, wx, code, alertLevel };
}

// Render / Update Label Suhu & Kondisi Cuaca untuk 38 Provinsi Indonesia
function renderCityWeatherLabels() {
  cityWeatherLayer.clearLayers();
  const sourceList =
    liveProvincesWeather.length === INDONESIA_PROVINCES.length
      ? liveProvincesWeather
      : INDONESIA_PROVINCES.map((p) => ({ ...p, live: null, hourly: null }));

  sourceList.forEach((prov) => {
    const st = getProvinceWeatherStats(prov);
    if (!st) return;

    const tempRound = Math.round(st.temp);
    let badgeText = `${st.wx.icon} ${tempRound}°`;
    if (activeLayer === "wind") {
      badgeText = `💨 ${st.windMs.toFixed(1)} m/s`;
    } else if (activeLayer === "clouds") {
      badgeText = `☁️ ${Math.round(st.cloud)}%`;
    } else if (activeLayer === "precip") {
      badgeText = `🌧️ ${st.precip.toFixed(1)} mm`;
    } else if (activeLayer === "mslp") {
      badgeText = `🧭 ${Math.round(st.pressure)} hPa`;
    }

    const icon = L.divIcon({
      className: "city-weather-label",
      html: `<div>${prov.city}</div><div class="c-temp">${badgeText}</div>`,
      iconSize: [96, 30],
      iconAnchor: [48, 15],
    });

    const marker = L.marker([prov.lat, prov.lon], { icon });
    marker.on("click", (ev) => {
      L.DomEvent.stopPropagation(ev);
      openLocationDetail(prov.city, `Indonesia / ${prov.province}`, prov.lat, prov.lon);
    });
    marker.addTo(cityWeatherLayer);
  });
}

// Render Heatmap Canvas di seluruh peta dunia
function renderHeatmap() {
  const w = heatmapCanvas.width;
  const h = heatmapCanvas.height;
  heatmapCtx.clearRect(0, 0, w, h);
  if (!showHeatmap || !gridMatrix.length) return;

  const cfg = LAYER_CONFIG[activeLayer === "alert" ? "precip" : activeLayer];
  const stepPx = 12; // Resolusi blok halus untuk performa 60fps

  for (let y = 0; y < h; y += stepPx) {
    for (let x = 0; x < w; x += stepPx) {
      const latlng = map.containerPointToLatLng([x + stepPx / 2, y + stepPx / 2]);
      const sample = sampleAtLatLng(latlng.lat, latlng.lng);
      if (!sample) continue;

      const val = cfg.getValue(sample);
      const norm = (val - cfg.min) / (cfg.max - cfg.min);
      const [r, g, b] = cfg.colorAt(norm);
      heatmapCtx.fillStyle = `rgb(${r},${g},${b})`;
      heatmapCtx.fillRect(x, y, stepPx, stepPx);
    }
  }
}

// Animasi Partikel Angin
function initParticles() {
  particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(randomParticle());
  }
}

function randomParticle() {
  return {
    x: Math.random() * windCanvas.width,
    y: Math.random() * windCanvas.height,
    age: Math.floor(Math.random() * 70),
    maxAge: 50 + Math.floor(Math.random() * 45),
  };
}

function animateWind() {
  requestAnimationFrame(animateWind);
  if (!showParticles || !gridMatrix.length) {
    windCtx.clearRect(0, 0, windCanvas.width, windCanvas.height);
    return;
  }

  // Efek jejak (trail) transparan dan halus
  windCtx.globalCompositeOperation = "destination-in";
  windCtx.fillStyle = "rgba(0, 0, 0, 0.90)";
  windCtx.fillRect(0, 0, windCanvas.width, windCanvas.height);
  windCtx.globalCompositeOperation = "source-over";

  // Warna lembut: putih transparan saat heatmap aktif, biru lembut saat peta terang
  windCtx.strokeStyle = showHeatmap
    ? "rgba(255, 255, 255, 0.52)"
    : "rgba(2, 132, 199, 0.42)";
  windCtx.lineWidth = 0.95;
  windCtx.lineCap = "round";
  windCtx.beginPath();

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.age >= p.maxAge) {
      particles[i] = randomParticle();
      continue;
    }

    const latlng = map.containerPointToLatLng([p.x, p.y]);
    const sample = sampleAtLatLng(latlng.lat, latlng.lng);
    if (!sample) {
      particles[i] = randomParticle();
      continue;
    }

    const scale = 0.24;
    const nx = p.x + sample.u * scale;
    const ny = p.y - sample.v * scale;

    windCtx.moveTo(p.x, p.y);
    windCtx.lineTo(nx, ny);

    p.x = nx;
    p.y = ny;
    p.age++;
  }
  windCtx.stroke();
}

// Update UI Legend
function updateLegend() {
  const cfg = LAYER_CONFIG[activeLayer === "alert" ? "precip" : activeLayer];
  document.getElementById("legend-title").textContent = cfg.title;
  document.getElementById("legend-bar").style.background = cfg.gradient;
  const labelsEl = document.getElementById("legend-labels");
  labelsEl.innerHTML = cfg.labels.map((l) => `<span>${l}</span>`).join("");
}

function setTimestep(idx) {
  activeStep = idx;
  const ts = reanalysisData.timesteps[idx];
  document.getElementById("current-time-label").textContent = ts.label;
  document.getElementById("time-slider").value = idx;
  buildGridMatrix();
  renderHeatmap();
  renderCityWeatherLabels();
  renderProvinceChoropleth();
}

map.on("mousemove", (e) => {
  const inspector = document.getElementById("inspector-text");
  if (!inspector) return;
  const { lat, lng } = e.latlng;
  const wrappedLon = ((((lng + 180) % 360) + 360) % 360) - 180;
  const s = sampleAtLatLng(lat, wrappedLon);
  if (!s) {
    inspector.textContent = `${lat.toFixed(2)}°, ${wrappedLon.toFixed(2)}°`;
    return;
  }
  inspector.textContent = `${lat.toFixed(2)}°, ${wrappedLon.toFixed(2)}° • ${s.temp_2m_c.toFixed(1)}°C • ${s.wind_speed_ms.toFixed(1)} m/s • ${s.precip_mm.toFixed(1)} mm`;
});

// Klik di koordinat mana saja di peta -> langsung buka panel detail lengkap + cari nama daerahnya
map.on("click", async (e) => {
  const { lat, lng } = e.latlng;
  const wrappedLon = ((((lng + 180) % 360) + 360) % 360) - 180;

  if (searchMarker) map.removeLayer(searchMarker);
  searchMarker = L.circleMarker([lat, lng], {
    radius: 7,
    color: "#ffffff",
    fillColor: "#ef4444",
    fillOpacity: 1,
    weight: 2.5,
  }).addTo(map);

  // Langsung buka panel detail untuk koordinat ini
  const defaultTitle = `Koordinat (${lat.toFixed(2)}°, ${wrappedLon.toFixed(2)}°)`;
  openLocationDetail(defaultTitle, "Memuat nama wilayah...", lat, wrappedLon);

  // Reverse geocoding untuk menampilkan nama daerah/provinsi asli di Indonesia
  try {
    const revRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${wrappedLon}&zoom=10&accept-language=id`
    );
    if (revRes.ok) {
      const rev = await revRes.json();
      const addr = rev.address || {};
      const areaName =
        addr.city || addr.town || addr.county || addr.village || addr.state || defaultTitle;
      const regionName = [addr.country, addr.state].filter(Boolean).join(" / ") || "Wilayah Indonesia";
      document.getElementById("loc-title").textContent = areaName;
      document.getElementById("loc-breadcrumb").textContent = regionName;
      searchMarker.bindTooltip(`📍 ${areaName}`, { permanent: true, direction: "top" });
    }
  } catch {
    // Tetap tampilkan koordinat jika reverse geocoding gagal
  }
});

// Render titik grid 10 km Indonesia di viewport saat toggle aktif
function renderGrid10km() {
  const w = grid10kmCanvas.width;
  const h = grid10kmCanvas.height;
  grid10kmCtx.clearRect(0, 0, w, h);
  if (!showGrid10km || !indonesia10kmData) return;

  const d = indonesia10kmData;
  const bounds = map.getBounds();
  const zoom = map.getZoom();
  // Saat zoom jauh, ambil sampel setiap N titik agar rapi; saat zoom >= 8 tampilkan semua titik per 10 km
  const stride = zoom >= 8 ? 1 : zoom >= 7 ? 2 : zoom >= 6 ? 4 : 6;

  const iStart = Math.max(0, Math.floor((bounds.getSouth() - d.lat_min) / d.step_deg));
  const iEnd = Math.min(d.n_lats - 1, Math.ceil((bounds.getNorth() - d.lat_min) / d.step_deg));
  const jStart = Math.max(0, Math.floor((bounds.getWest() - d.lon_min) / d.step_deg));
  const jEnd = Math.min(d.n_lons - 1, Math.ceil((bounds.getEast() - d.lon_min) / d.step_deg));

  grid10kmCtx.fillStyle = "rgba(15, 23, 42, 0.72)";
  for (let i = iStart; i <= iEnd; i += stride) {
    const lat = d.lat_min + i * d.step_deg;
    for (let j = jStart; j <= jEnd; j += stride) {
      const lon = d.lon_min + j * d.step_deg;
      const pt = map.latLngToContainerPoint([lat, lon]);
      grid10kmCtx.fillRect(pt.x - 1, pt.y - 1, 2.5, 2.5);
    }
  }
}

map.on("moveend zoomend", () => {
  renderHeatmap();
  renderGrid10km();
  windCtx.clearRect(0, 0, windCanvas.width, windCanvas.height);
});

window.addEventListener("resize", resizeCanvases);

// Kontrol UI Layer & Kota Cepat
document.querySelectorAll(".layer-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".layer-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeLayer = btn.dataset.layer;

    if (activeLayer === "wind") {
      showParticles = true;
      const pToggle = document.getElementById("toggle-particles");
      if (pToggle) pToggle.checked = true;
    }

    updateLegend();
    renderHeatmap();
    renderCityWeatherLabels();
    renderProvinceChoropleth();
  });
});

document.querySelectorAll(".city-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const lat = parseFloat(btn.dataset.lat);
    const lon = parseFloat(btn.dataset.lon);
    const name = btn.textContent.trim();
    map.flyTo([lat, lon], 8, { duration: 1.0 });
    openLocationDetail(name, "Indonesia", lat, lon);
  });
});

// Fitur Cari Lokasi Daerah di Indonesia
const searchForm = document.getElementById("location-search-form");
const searchInput = document.getElementById("location-search-input");
const searchStatus = document.getElementById("search-status");
let searchMarker = null;

function setSearchStatus(msg, isError = false) {
  if (!msg) {
    searchStatus.classList.add("hidden");
    return;
  }
  searchStatus.textContent = msg;
  searchStatus.classList.remove("hidden", "error");
  if (isError) searchStatus.classList.add("error");
}

searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  setSearchStatus(`Mencari "${query}" di Indonesia...`);
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query
    )}&count=5&language=id`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Gagal menghubungi layanan pencarian lokasi.");

    const data = await res.json();
    const results = data.results || [];
    // Prioritaskan hasil di Indonesia (country_code === "ID")
    const loc = results.find((r) => r.country_code === "ID") || results[0];

    if (!loc) {
      setSearchStatus(`Daerah "${query}" tidak ditemukan. Coba nama kota/kabupaten lain.`, true);
      return;
    }

    setSearchStatus("");
    const { name, admin1, latitude, longitude } = loc;
    const regionLabel = admin1 ? `${name}, ${admin1}` : name;

    map.flyTo([latitude, longitude], 9, { duration: 1.1 });

    const sample = sampleAtLatLng(latitude, longitude);
    if (searchMarker) map.removeLayer(searchMarker);

    searchMarker = L.circleMarker([latitude, longitude], {
      radius: 8,
      color: "#ffffff",
      fillColor: "#ef4444",
      fillOpacity: 1,
      weight: 2.5,
    }).addTo(map);

    searchMarker.bindTooltip(`📍 ${regionLabel}`, { permanent: true, direction: "top" });
    searchMarker.on("click", (ev) => {
      L.DomEvent.stopPropagation(ev);
      openLocationDetail(name, `Indonesia / ${admin1 || "Nusantara"}`, latitude, longitude);
    });

    // Langsung buka panel detail lengkap ala Ventusky (24 jam, 7 hari, Meteogram, AQI, Matahari)
    openLocationDetail(name, `Indonesia / ${admin1 || "Nusantara"}`, latitude, longitude);
  } catch (err) {
    setSearchStatus(err.message, true);
  }
});

document.getElementById("toggle-cities").addEventListener("change", (e) => {
  e.target.checked ? map.addLayer(cityWeatherLayer) : map.removeLayer(cityWeatherLayer);
});
document.getElementById("toggle-heatmap").addEventListener("change", (e) => {
  showHeatmap = e.target.checked;
  renderHeatmap();
});
document.getElementById("toggle-particles").addEventListener("change", (e) => {
  showParticles = e.target.checked;
});
document.getElementById("toggle-himawari").addEventListener("change", (e) => {
  e.target.checked ? map.addLayer(himawariLayer) : map.removeLayer(himawariLayer);
});
document.getElementById("toggle-radiosonde").addEventListener("change", (e) => {
  e.target.checked ? map.addLayer(radiosondeLayer) : map.removeLayer(radiosondeLayer);
});
document.getElementById("toggle-coastline").addEventListener("change", (e) => {
  e.target.checked ? map.addLayer(coastlineLayer) : map.removeLayer(coastlineLayer);
});
document.getElementById("toggle-grid10km").addEventListener("change", (e) => {
  showGrid10km = e.target.checked;
  renderGrid10km();
});

document.getElementById("time-slider").addEventListener("input", (e) => {
  setTimestep(parseInt(e.target.value, 10));
});

document.getElementById("play-btn").addEventListener("click", () => {
  const btn = document.getElementById("play-btn");
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
    btn.textContent = "▶";
  } else {
    btn.textContent = "⏸";
    playTimer = setInterval(() => {
      const next = (activeStep + 1) % reanalysisData.timesteps.length;
      setTimestep(next);
    }, 1500);
  }
});

// Radiosonde Drawer
document.getElementById("close-drawer").addEventListener("click", () => {
  document.getElementById("radiosonde-drawer").classList.add("hidden");
});

function openRadiosondeDrawer(station) {
  document.getElementById("radiosonde-drawer").classList.remove("hidden");
  document.getElementById("drawer-station-name").textContent = `${station.id} — ${station.name}`;
  document.getElementById("idx-cape").textContent = `${station.indices.cape_j_kg} J/kg`;
  document.getElementById("idx-li").textContent = `${station.indices.lifted_index} °C`;
  document.getElementById("idx-pwat").textContent = `${station.indices.pwat_mm} mm`;

  if (radiosondeChart) radiosondeChart.destroy();
  const ctx = document.getElementById("radiosonde-chart").getContext("2d");
  radiosondeChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: station.profile.map((p) => `${p.pressure_hpa} hPa`),
      datasets: [
        {
          label: "Temperatur (°C)",
          data: station.profile.map((p) => p.temp_c),
          borderColor: "#ef4444",
          tension: 0.3,
        },
        {
          label: "Dewpoint (°C)",
          data: station.profile.map((p) => p.dewpoint_c),
          borderColor: "#38bdf8",
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#cbd5e1", font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: "#94a3b8", maxRotation: 45 }, grid: { color: "#1e293b" } },
        y: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
      },
    },
  });
}

function renderOverlays(himawari, radiosonde) {
  L.geoJSON(himawari, {
    pointToLayer: (feature, latlng) => {
      const level = feature.properties.alert_level;
      const color = level === "high" ? "#ef4444" : level === "medium" ? "#f59e0b" : "#eab308";
      return L.circle(latlng, {
        radius: feature.properties.radius_km * 1000,
        color,
        fillColor: color,
        fillOpacity: 0.18,
        weight: 1.5,
        dashArray: "4 4",
      });
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <strong>${p.cluster_id} — ${p.region}</strong><br/>
        Brightness Temp: <b>${p.brightness_temp_k} K</b> (${p.brightness_temp_c} °C)<br/>
        ${p.intensity}
      `);
    },
  }).addTo(himawariLayer);

  radiosonde.stations.forEach((st) => {
    const marker = L.circleMarker([st.lat, st.lon], {
      radius: 7,
      color: "#ffffff",
      fillColor: "#38bdf8",
      fillOpacity: 1,
      weight: 2,
    });
    marker.bindTooltip(`${st.name} (Klik untuk Profil Vertikal)`, { direction: "top" });
    marker.on("click", (ev) => {
      L.DomEvent.stopPropagation(ev);
      openRadiosondeDrawer(st);
    });
    marker.addTo(radiosondeLayer);
  });
}

// Muat layer Batas Negara & Garis Pantai khusus Indonesia (termasuk batas darat Papua, Kalimantan, Timor)
async function loadCoastline() {
  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/gh/martynafford/natural-earth-geojson@master/50m/cultural/ne_50m_admin_0_countries.json"
    );
    if (!res.ok) return;
    const geojson = await res.json();

    const indonesiaOnly = geojson.features.filter(
      (f) =>
        f.properties &&
        (f.properties.ISO_A3 === "IDN" || f.properties.ADMIN === "Indonesia")
    );

    L.geoJSON(
      { type: "FeatureCollection", features: indonesiaOnly },
      {
        style: {
          color: "#0f172a",
          weight: 3.0,
          opacity: 0.95,
          fill: false,
          lineJoin: "round",
          lineCap: "round",
        },
        interactive: false,
      }
    ).addTo(coastlineLayer);
  } catch {
    // Abaikan jika offline
  }
}

function findProvinceMeta(propName) {
  const norm = (propName || "").toLowerCase().replace(/[^a-z]/g, "");
  return (
    INDONESIA_PROVINCES.find((p) => {
      const pn = p.province.toLowerCase().replace(/[^a-z]/g, "");
      return norm.includes(pn) || pn.includes(norm);
    }) || null
  );
}

function getFeatureCenter(feature) {
  try {
    const layer = L.geoJSON(feature);
    return layer.getBounds().getCenter();
  } catch {
    return { lat: -2.4, lng: 118.0 };
  }
}

function getNearestProvince(lat, lon) {
  let best = INDONESIA_PROVINCES[0];
  let bestDist = Infinity;
  for (const p of INDONESIA_PROVINCES) {
    const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

const ALERT_COLORS = ["#16a34a", "#fde047", "#f97316", "#ef4444"];
const ALERT_NAMES = ["Aman", "Waspada", "Siaga", "Awas"];

function updateAlertSummaryCard() {
  const sourceList =
    liveProvincesWeather.length === INDONESIA_PROVINCES.length
      ? liveProvincesWeather
      : INDONESIA_PROVINCES.map((p) => ({ ...p, live: null }));

  const counts = [0, 0, 0, 0];
  const flagged = [];

  sourceList.forEach((prov) => {
    const st = getProvinceWeatherStats(prov);
    if (!st) return;
    counts[st.alertLevel]++;
    if (st.alertLevel >= 1) {
      flagged.push(`${prov.province} (${ALERT_NAMES[st.alertLevel]})`);
    }
  });

  const elAman = document.getElementById("cnt-aman");
  if (!elAman) return;
  elAman.textContent = counts[0];
  document.getElementById("cnt-waspada").textContent = counts[1];
  document.getElementById("cnt-siaga").textContent = counts[2];
  document.getElementById("cnt-awas").textContent = counts[3];

  const listEl = document.getElementById("alert-list");
  listEl.textContent =
    flagged.length > 0
      ? `Perhatian: ${flagged.slice(0, 5).join(", ")}${flagged.length > 5 ? ` (+${flagged.length - 5} lainnya)` : ""}`
      : "Seluruh 38 provinsi dalam kondisi normal/aman.";
}

function renderProvinceChoropleth() {
  updateAlertSummaryCard();
  if (!indonesiaGeoJson) return;

  indonesiaHighlightLayer.clearLayers();
  const sourceMap = new Map(
    (liveProvincesWeather.length === INDONESIA_PROVINCES.length
      ? liveProvincesWeather
      : INDONESIA_PROVINCES.map((p) => ({ ...p, live: null }))
    ).map((p) => [p.province, p])
  );

  L.geoJSON(indonesiaGeoJson, {
    style: (feature) => {
      const props = feature.properties || {};
      const rawName = props.Propinsi || props.PROVINSI || props.name || props.NAME_1 || "";
      const center = getFeatureCenter(feature);
      const meta = findProvinceMeta(rawName) || getNearestProvince(center.lat, center.lng);
      const prov = sourceMap.get(meta.province) || { ...meta, live: null };
      const st = getProvinceWeatherStats(prov);

      let fillColor = "#16a34a";
      if (st) {
        if (activeLayer === "alert") {
          fillColor = ALERT_COLORS[st.alertLevel];
        } else {
          const cfg = LAYER_CONFIG[activeLayer];
          const val =
            activeLayer === "temp"
              ? st.temp
              : activeLayer === "wind"
              ? st.windMs
              : activeLayer === "clouds"
              ? st.cloud
              : activeLayer === "precip"
              ? st.precip
              : st.pressure;
          const norm = (val - cfg.min) / (cfg.max - cfg.min || 1);
          const [r, g, b] = cfg.colorAt(norm);
          fillColor = `rgb(${r},${g},${b})`;
        }
      }

      return {
        color: "#0f172a",
        weight: 1.1,
        opacity: 0.75,
        fillColor,
        fillOpacity: 0.84,
      };
    },
    onEachFeature: (feature, layer) => {
      const props = feature.properties || {};
      const rawName = props.Propinsi || props.PROVINSI || props.name || props.NAME_1 || "Provinsi";
      const center = getFeatureCenter(feature);
      const meta = findProvinceMeta(rawName) || getNearestProvince(center.lat, center.lng);
      const prov = sourceMap.get(meta.province) || { ...meta, live: null };
      const st = getProvinceWeatherStats(prov);

      const statusTxt = st ? `${ALERT_NAMES[st.alertLevel]} • ${st.temp.toFixed(1)}°C • ${st.precip.toFixed(1)} mm` : rawName;
      layer.bindTooltip(`<strong>${meta.province}</strong><br/>${statusTxt}`, { sticky: true });

      layer.on("click", (ev) => {
        L.DomEvent.stopPropagation(ev);
        openLocationDetail(meta.city, `Indonesia / ${meta.province}`, meta.lat, meta.lon);
      });
    },
  }).addTo(indonesiaHighlightLayer);
}

// Tampilkan batas & warna wilayah provinsi Indonesia di atas peta
async function loadIndonesiaHighlight() {
  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/gh/superpikar/indonesia-geojson@master/indonesia-province-simple.json"
    );
    if (!res.ok) return;
    indonesiaGeoJson = await res.json();
    renderProvinceChoropleth();
  } catch {
    // Abaikan jika offline
  }
}

// =========================================================================
// VENTUSKY-STYLE LOCATION DETAIL DRAWER (24 Jam, 7 Hari, Meteogram, AQI, Sun)
// =========================================================================
document.getElementById("close-loc-drawer").addEventListener("click", () => {
  document.getElementById("location-drawer").classList.add("hidden");
});

document.querySelectorAll(".meteo-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".meteo-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeMeteoTab = btn.dataset.meteo;
    if (currentDailyData) renderMeteogramChart(currentDailyData);
  });
});

function degToCompass(deg) {
  const dirs = ["U", "TL", "T", "TG", "S", "BD", "B", "BL"];
  return dirs[Math.round(deg / 45) % 8];
}

async function openLocationDetail(title, breadcrumb, lat, lon) {
  const drawer = document.getElementById("location-drawer");
  const loadingEl = document.getElementById("loc-loading");
  const contentEl = document.getElementById("loc-content");

  drawer.classList.remove("hidden");
  document.getElementById("loc-title").textContent = title;
  document.getElementById("loc-breadcrumb").textContent = breadcrumb;
  document.getElementById("loc-coords").textContent =
    `${lat.toFixed(2)}° / ${lon.toFixed(2)}° • Asia/Jakarta (UTC+7)`;

  loadingEl.classList.remove("hidden");
  contentEl.style.opacity = "0.4";

  try {
    const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,visibility&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max,sunrise,sunset&timezone=Asia%2FJakarta`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=us_aqi&timezone=Asia%2FJakarta`;

    const [wxRes, aqiRes] = await Promise.all([fetch(wxUrl), fetch(aqiUrl)]);
    if (!wxRes.ok) throw new Error("Gagal mengambil data prakiraan.");
    const wx = await wxRes.json();
    const aqi = aqiRes.ok ? await aqiRes.json() : null;

    // 1. Current Weather
    const c = wx.current;
    const cInfo = wmoCodeToWeather(c.weather_code);
    document.getElementById("cur-icon").textContent = cInfo.icon;
    document.getElementById("cur-temp").textContent = `${c.temperature_2m.toFixed(1)} °C`;
    document.getElementById("cur-desc").textContent = cInfo.text;
    document.getElementById("cur-wind").textContent =
      `Angin: ${c.wind_speed_10m.toFixed(0)} km/j (${degToCompass(c.wind_direction_10m)})`;
    document.getElementById("cur-pressure").textContent = `${c.surface_pressure.toFixed(0)} hPa`;
    document.getElementById("cur-humidity").textContent = `${c.relative_humidity_2m} %`;
    document.getElementById("cur-clouds").textContent = `${c.cloud_cover} %`;
    document.getElementById("cur-vis").textContent =
      c.visibility ? `${(c.visibility / 1000).toFixed(1)} km` : "10.0 km";

    // 2. Next 24 Hours Strip
    const hourlyStrip = document.getElementById("hourly-strip");
    hourlyStrip.innerHTML = "";
    const nowIso = c.time ? c.time.slice(0, 13) : "";
    let startIdx = wx.hourly.time.findIndex((t) => t.startsWith(nowIso));
    if (startIdx < 0) startIdx = 0;

    for (let i = startIdx; i < Math.min(startIdx + 24, wx.hourly.time.length); i++) {
      const hh = wx.hourly.time[i].slice(11, 16);
      const hInfo = wmoCodeToWeather(wx.hourly.weather_code[i]);
      const hTemp = Math.round(wx.hourly.temperature_2m[i]);
      const hRain = wx.hourly.precipitation[i].toFixed(1);
      const hProb = wx.hourly.precipitation_probability[i] ?? 0;
      const hWind = Math.round(wx.hourly.wind_speed_10m[i]);
      const hDir = degToCompass(wx.hourly.wind_direction_10m[i]);

      const col = document.createElement("div");
      col.className = "hour-col";
      col.innerHTML = `
        <span class="hour-time">${hh}</span>
        <span class="hour-icon">${hInfo.icon}</span>
        <span class="hour-temp">${hTemp}°C</span>
        <span class="hour-rain">${hRain} mm</span>
        <span style="color:#64748b;">💧 ${hProb}%</span>
        <span class="hour-wind">${hDir} ${hWind}</span>
      `;
      hourlyStrip.appendChild(col);
    }

    // 3. 7-Day Daily Strip
    const dailyStrip = document.getElementById("daily-strip");
    dailyStrip.innerHTML = "";
    for (let d = 0; d < wx.daily.time.length; d++) {
      const dateObj = new Date(wx.daily.time[d]);
      const dayLabel = dateObj.toLocaleDateString("id-ID", { weekday: "short" }).toUpperCase();
      const dInfo = wmoCodeToWeather(wx.daily.weather_code[d]);
      const tMax = Math.round(wx.daily.temperature_2m_max[d]);
      const tMin = Math.round(wx.daily.temperature_2m_min[d]);

      const card = document.createElement("div");
      card.className = "day-card";
      card.innerHTML = `
        <div class="day-name">${dayLabel}</div>
        <div class="day-icon">${dInfo.icon}</div>
        <div class="day-temps">${tMax}° / ${tMin}°</div>
      `;
      dailyStrip.appendChild(card);
    }

    // 4. Meteogram Chart
    currentDailyData = wx.daily;
    renderMeteogramChart(currentDailyData);

    // 5. Air Quality (AQI) Chart
    if (aqi && aqi.hourly && aqi.hourly.us_aqi) {
      renderAqiChart(aqi.hourly);
    }

    // 6. Sun & Phase Table
    if (wx.daily.sunrise && wx.daily.sunset) {
      const riseStr = wx.daily.sunrise[0].slice(11, 16);
      const setStr = wx.daily.sunset[0].slice(11, 16);
      document.getElementById("sun-rise").textContent = `${riseStr} WIB`;
      document.getElementById("sun-set").textContent = `${setStr} WIB`;

      const riseMin = parseInt(riseStr.slice(0, 2), 10) * 60 + parseInt(riseStr.slice(3, 5), 10);
      const setMin = parseInt(setStr.slice(0, 2), 10) * 60 + parseInt(setStr.slice(3, 5), 10);
      const diff = Math.max(0, setMin - riseMin);
      document.getElementById("day-length").textContent = `${Math.floor(diff / 60)} jam ${diff % 60} mnt`;

      document.getElementById("sun-phase-body").innerHTML = `
        <tr><td>Fajar Sipil (Civil Twilight)</td><td>± 22 menit sebelum ${riseStr}</td></tr>
        <tr><td>Siang Hari (Daylight)</td><td>${riseStr} – ${setStr} WIB</td></tr>
        <tr><td>Senja Sipil (Dusk)</td><td>± 22 menit setelah ${setStr}</td></tr>
        <tr><td>Malam Hari</td><td>${setStr} – ${riseStr} WIB</td></tr>
      `;
    }
  } catch (err) {
    document.getElementById("cur-desc").textContent = `Gagal memuat detail: ${err.message}`;
  } finally {
    loadingEl.classList.add("hidden");
    contentEl.style.opacity = "1";
  }
}

function renderMeteogramChart(daily) {
  if (meteogramChart) meteogramChart.destroy();
  const labels = daily.time.map((t) =>
    new Date(t).toLocaleDateString("id-ID", { weekday: "short", day: "numeric" })
  );

  let datasets = [];
  if (activeMeteoTab === "temp") {
    datasets = [
      {
        label: "Suhu Maks (°C)",
        data: daily.temperature_2m_max,
        borderColor: "#dc2626",
        backgroundColor: "#dc2626",
        tension: 0.3,
      },
      {
        label: "Suhu Min (°C)",
        data: daily.temperature_2m_min,
        borderColor: "#2563eb",
        backgroundColor: "#2563eb",
        tension: 0.3,
      },
    ];
  } else if (activeMeteoTab === "precip") {
    datasets = [
      {
        type: "bar",
        label: "Total Presipitasi (mm)",
        data: daily.precipitation_sum,
        backgroundColor: "#0ea5e9",
      },
    ];
  } else {
    datasets = [
      {
        label: "Hembusan Angin Maks (km/j)",
        data: daily.wind_gusts_10m_max,
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.2)",
        fill: true,
        tension: 0.3,
      },
    ];
  }

  const ctx = document.getElementById("meteogram-chart").getContext("2d");
  meteogramChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#334155", font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: "#475569" }, grid: { color: "#e2e8f0" } },
        y: { ticks: { color: "#475569" }, grid: { color: "#e2e8f0" } },
      },
    },
  });
}

function renderAqiChart(hourlyAqi) {
  if (aqiChart) aqiChart.destroy();
  const labels = [];
  const values = [];
  const colors = [];

  for (let i = 0; i < Math.min(48, hourlyAqi.time.length); i += 4) {
    const val = hourlyAqi.us_aqi[i] ?? 25;
    labels.push(hourlyAqi.time[i].slice(11, 16));
    values.push(val);
    colors.push(val <= 50 ? "#4ade80" : val <= 100 ? "#facc15" : "#f97316");
  }

  const ctx = document.getElementById("aqi-chart").getContext("2d");
  aqiChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "US AQI",
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#475569", font: { size: 10 } }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: "#475569" }, grid: { color: "#e2e8f0" } },
      },
    },
  });
}

async function init() {
  try {
    const [reRes, himRes, radRes, id10Res] = await Promise.all([
      fetch("./data/reanalysis.json"),
      fetch("./data/himawari.geojson"),
      fetch("./data/radiosonde.json"),
      fetch("./data/indonesia_10km.json"),
    ]);

    if (!reRes.ok || !himRes.ok || !radRes.ok || !id10Res.ok) {
      throw new Error("Dataset tidak ditemukan.");
    }

    reanalysisData = await reRes.json();
    const himawari = await himRes.json();
    radiosondeData = await radRes.json();
    indonesia10kmData = await id10Res.json();

    // Perbarui label timestep agar selalu real-time mulai dari waktu saat ini (WIB)
    const nowBase = new Date();
    nowBase.setMinutes(0, 0, 0);
    reanalysisData.timesteps.forEach((ts, idx) => {
      const dt = new Date(nowBase.getTime() + idx * 3 * 3600 * 1000);
      const dateStr = dt.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
      });
      const timeStr = dt.toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
      });
      ts.label = idx === 0 ? `${dateStr} ${timeStr} WIB (Saat Ini)` : `${dateStr} ${timeStr} WIB`;
      ts.short_label = timeStr;
    });

    document.getElementById("time-ticks").innerHTML = reanalysisData.timesteps
      .map((t) => `<span>${t.short_label}</span>`)
      .join("");

    loadIndonesiaHighlight();
    loadCoastline();
    renderOverlays(himawari, radiosondeData);
    updateLegend();
    resizeCanvases();
    setTimestep(0);
    fetchLiveProvincesWeather();
    setInterval(fetchLiveProvincesWeather, 5 * 60 * 1000);
    initParticles();
    animateWind();
  } catch (err) {
    const toast = document.getElementById("error-toast");
    toast.textContent = `Gagal memuat data (${err.message}). Jalankan lewat start_server.bat.`;
    toast.classList.remove("hidden");
  }
}

function startNavClock() {
  const el = document.getElementById("nav-clock");
  if (!el) return;
  const update = () => {
    const now = new Date();
    el.textContent =
      now.toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) + " WIB";
  };
  update();
  setInterval(update, 1000);
}

function initThemeToggle() {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  const applyTheme = (theme) => {
    const isLight = theme === "light";
    document.body.classList.toggle("light-theme", isLight);
    btn.textContent = isLight ? "🌙 Dark" : "☀️ Light";
    localStorage.setItem("nw-theme", theme);
  };

  const saved = localStorage.getItem("nw-theme") || "dark";
  applyTheme(saved);

  btn.addEventListener("click", () => {
    const next = document.body.classList.contains("light-theme") ? "dark" : "light";
    applyTheme(next);
  });
}

init();
startNavClock();
initThemeToggle();
