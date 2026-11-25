"""
Atmospheric & Environmental Data Processing Pipeline (Ventusky-Style Edition)
----------------------------------------------------------------------------
Processes and generates multi-timestep geospatial datasets for:
1. Radiosonde upper-air soundings (vertical profiles + stability indices)
2. Weather reanalysis dense spatial grid with U/V wind vectors & 8 timesteps
3. Himawari-8/9 IR satellite brightness temperature (GeoJSON convective clusters)

Outputs JSON/GeoJSON files into ../web/data/ for the web visualization platform.
"""

import json
import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "web" / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

random.seed(42)

PRESSURE_LEVELS = [1000, 925, 850, 700, 500, 400, 300, 250, 200, 150, 100]

RADIOSONDE_STATIONS = [
    {
        "id": "96749",
        "name": "Jakarta / Soekarno-Hatta",
        "lat": -6.12,
        "lon": 106.65,
        "surface_temp": 30.4,
        "cape": 1840,
        "lifted_index": -4.2,
        "pwat_mm": 54.6,
    },
    {
        "id": "96935",
        "name": "Surabaya / Juanda",
        "lat": -7.38,
        "lon": 112.78,
        "surface_temp": 31.2,
        "cape": 1420,
        "lifted_index": -3.1,
        "pwat_mm": 48.2,
    },
    {
        "id": "97180",
        "name": "Makassar / Hasanuddin",
        "lat": -5.06,
        "lon": 119.55,
        "surface_temp": 29.8,
        "cape": 1650,
        "lifted_index": -3.8,
        "pwat_mm": 52.1,
    },
    {
        "id": "97560",
        "name": "Biak / Frans Kaisiepo",
        "lat": -1.19,
        "lon": 136.11,
        "surface_temp": 28.9,
        "cape": 2120,
        "lifted_index": -4.9,
        "pwat_mm": 58.9,
    },
]


def pressure_to_altitude_m(pressure_hpa: float) -> int:
    return round(44330 * (1.0 - (pressure_hpa / 1013.25) ** 0.1903))


def process_radiosonde() -> dict:
    stations_out = []
    for st in RADIOSONDE_STATIONS:
        profile = []
        for p in PRESSURE_LEVELS:
            alt_m = pressure_to_altitude_m(p)
            alt_km = alt_m / 1000.0
            temp_c = round(st["surface_temp"] - (6.4 * alt_km) + random.uniform(-0.6, 0.6), 1)
            dew_spread = 3.0 + (alt_km * 1.4) + random.uniform(0.0, 2.5)
            dewpoint_c = round(temp_c - dew_spread, 1)
            wind_speed_kt = round(8 + (alt_km * 2.8) + random.uniform(-2, 4), 1)
            wind_dir_deg = round((110 + alt_km * 12 + random.uniform(-15, 15)) % 360)

            profile.append(
                {
                    "pressure_hpa": p,
                    "altitude_m": alt_m,
                    "temp_c": temp_c,
                    "dewpoint_c": dewpoint_c,
                    "wind_speed_kt": max(2.0, wind_speed_kt),
                    "wind_dir_deg": wind_dir_deg,
                }
            )

        stations_out.append(
            {
                "id": st["id"],
                "name": st["name"],
                "lat": st["lat"],
                "lon": st["lon"],
                "indices": {
                    "cape_j_kg": st["cape"],
                    "lifted_index": st["lifted_index"],
                    "pwat_mm": st["pwat_mm"],
                },
                "profile": profile,
            }
        )

    return {
        "dataset": "Radiosonde Upper-Air Soundings (00 UTC)",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stations": stations_out,
    }


def process_reanalysis() -> dict:
    """Memproses grid spasial global (skala dunia) dengan 8 timestep (setiap 3 jam) ala Ventusky."""
    lats = list(range(-75, 76, 5))     # -75 .. 75 (31 baris)
    lons = list(range(-180, 181, 6))   # -180 .. 180 (61 kolom)

    base_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    timesteps = []

    for step in range(8):
        ts_time = base_time + timedelta(hours=step * 3)
        diurnal_phase = math.sin((step / 8.0) * 2 * math.pi)
        grid_points = []

        for lat in lats:
            abs_lat = abs(lat)
            for lon in lons:
                # Suhu realistis global: hangat di ekuator (~29C), dingin di lintang tinggi
                base_temp = 29.5 - (abs_lat * 0.55)
                temp_2m = round(
                    base_temp
                    + 2.2 * math.sin(math.radians(lon) + diurnal_phase * 2.0)
                    + 1.2 * math.cos(math.radians(lat * 3)),
                    1,
                )
                mslp_hpa = round(
                    1012.0
                    - 4.0 * math.cos(math.radians(lat * 3))
                    + 2.5 * math.sin(math.radians(lon * 2 + step * 15)),
                    1,
                )
                # Pola angin global + pusaran siklonik/antisiklonik (vortices) ala Ventusky
                if abs_lat < 28:
                    u_wind = -4.2 * math.cos(math.radians(lat * 3)) + 1.5 * math.sin(math.radians(lon * 2 + step * 10))
                else:
                    u_wind = 5.5 * math.sin(math.radians((abs_lat - 25) * 2.5)) + 1.5 * math.cos(math.radians(lon * 2))
                v_wind = 2.2 * math.sin(math.radians(lon * 2.5 - step * 12)) * math.cos(math.radians(lat * 2))

                # Tambahkan beberapa pusat pusaran (High/Low pressure eddies) di sekitar Samudra Hindia & Pasifik
                eddies = [
                    (-14.0 + step * 0.4, 92.0 + step * 0.8, 1.0),   # Pusaran Samudra Hindia
                    (6.0 - step * 0.3, 114.0 - step * 0.6, -0.8),   # Pusaran Laut Cina Selatan
                    (-18.0, 134.0 + step * 0.5, 0.9),               # Pusaran Australia Utara
                    (15.0, 142.0 - step * 0.7, -1.1),               # Pusaran Pasifik Barat
                ]
                for e_lat, e_lon, strength in eddies:
                    d_lat = lat - e_lat
                    d_lon = lon - e_lon
                    dist_sq = d_lat * d_lat + d_lon * d_lon + 36.0
                    swirl = (180.0 / dist_sq) * strength
                    u_wind += -d_lat * swirl * 0.35
                    v_wind += d_lon * swirl * 0.35

                u_wind = round(u_wind, 2)
                v_wind = round(v_wind, 2)
                wind_speed = round(math.hypot(u_wind, v_wind), 1)

                # Presipitasi lebih tinggi di sabuk tropis (ITCZ) & lintang menengah
                tropical_rain = max(0.0, math.cos(math.radians(lat * 4))) * 10.0
                wave = math.sin(math.radians(lon * 3 + step * 20)) * 6.0
                precip_mm = round(max(0.0, tropical_rain + wave), 1)

                grid_points.append(
                    {
                        "lat": lat,
                        "lon": lon,
                        "temp_2m_c": temp_2m,
                        "mslp_hpa": mslp_hpa,
                        "u": u_wind,
                        "v": v_wind,
                        "wind_speed_ms": wind_speed,
                        "precip_mm": precip_mm,
                    }
                )

        timesteps.append(
            {
                "label": ts_time.strftime("%d %b %H:%M UTC"),
                "short_label": ts_time.strftime("%H:%M"),
                "points": grid_points,
            }
        )

    return {
        "dataset": "ERA5-Style Global Weather Reanalysis (Multi-Timestep)",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "bounds": {"lat_min": lats[0], "lat_max": lats[-1], "lon_min": lons[0], "lon_max": lons[-1]},
        "timesteps": timesteps,
    }


def process_himawari_geojson() -> dict:
    clusters = [
        {"name": "Selat Sunda - Jawa Barat", "lat": -6.3, "lon": 105.8, "bt_k": 208.4, "radius_km": 115},
        {"name": "Laut Jawa Tengah", "lat": -5.6, "lon": 111.2, "bt_k": 216.8, "radius_km": 95},
        {"name": "Selat Makassar", "lat": -2.4, "lon": 118.4, "bt_k": 203.1, "radius_km": 140},
        {"name": "Kalimantan Barat", "lat": 0.4, "lon": 110.5, "bt_k": 224.5, "radius_km": 110},
        {"name": "Teluk Cenderawasih (Papua)", "lat": -2.1, "lon": 135.6, "bt_k": 199.7, "radius_km": 155},
        {"name": "Pesisir Barat Sumatra", "lat": -1.8, "lon": 99.6, "bt_k": 212.0, "radius_km": 125},
    ]

    features = []
    for idx, cl in enumerate(clusters, start=1):
        bt_c = round(cl["bt_k"] - 273.15, 1)
        if cl["bt_k"] < 210:
            intensity = "Deep Convective (Potensi Hujan Lebat & Petir)"
            level = "high"
        elif cl["bt_k"] < 220:
            intensity = "Moderate Convective (Awan Hujan Aktif)"
            level = "medium"
        else:
            intensity = "Developing Cloud Cluster"
            level = "low"

        features.append(
            {
                "type": "Feature",
                "properties": {
                    "cluster_id": f"HIM-{idx:02d}",
                    "region": cl["name"],
                    "brightness_temp_k": cl["bt_k"],
                    "brightness_temp_c": bt_c,
                    "radius_km": cl["radius_km"],
                    "intensity": intensity,
                    "alert_level": level,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [cl["lon"], cl["lat"]],
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "name": "Himawari_IR_Band13_Convective_Clusters",
        "features": features,
    }


def process_indonesia_10km() -> dict:
    """
    Memproses grid resolusi tinggi ~10 km (0.09 derajat) untuk seluruh wilayah Indonesia
    (-11.0 LS .. 6.0 LU, 95.0 BT .. 141.0 BT) dalam format array datar (compact)
    agar cepat dimuat oleh browser.
    """
    step_deg = 0.09  # ~10 km di ekuator
    lat_min, lat_max = -11.0, 6.0
    lon_min, lon_max = 95.0, 141.0

    n_lats = int(round((lat_max - lat_min) / step_deg)) + 1
    n_lons = int(round((lon_max - lon_min) / step_deg)) + 1

    # Array datar skala x10 (integer) agar ukuran file tetap ringan (~2 MB)
    temp_x10 = []
    mslp_x10 = []
    u_x10 = []
    v_x10 = []
    precip_x10 = []

    for i in range(n_lats):
        lat = lat_min + i * step_deg
        rad_lat = math.radians(lat)
        for j in range(n_lons):
            lon = lon_min + j * step_deg
            rad_lon = math.radians(lon)

            # Variasi mikro-iklim lokal per 10 km (topografi & konvergensi lokal)
            local_wave = math.sin(rad_lat * 18.0) * math.cos(rad_lon * 14.0)
            temp_val = 28.4 + 1.6 * math.cos(rad_lat * 5.0) + 1.1 * local_wave
            mslp_val = 1010.2 + 1.4 * math.sin(rad_lon * 2.5) + 0.6 * math.cos(rad_lat * 8.0)
            u_val = -4.2 * math.cos(rad_lat * 3.0) + 1.8 * math.sin(rad_lon * 4.0) + 0.7 * local_wave
            v_val = 2.1 * math.sin(rad_lon * 3.0) + 0.8 * math.cos(rad_lat * 10.0)
            precip_val = max(0.0, 4.5 + 7.5 * math.sin(rad_lon * 5.0 + rad_lat * 6.0) + 3.0 * local_wave)

            temp_x10.append(int(round(temp_val * 10)))
            mslp_x10.append(int(round((mslp_val - 1000.0) * 10)))
            u_x10.append(int(round(u_val * 10)))
            v_x10.append(int(round(v_val * 10)))
            precip_x10.append(int(round(precip_val * 10)))

    return {
        "dataset": "Indonesia High-Resolution 10km Atmospheric Grid (0.09 deg)",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "step_deg": step_deg,
        "lat_min": lat_min,
        "lon_min": lon_min,
        "n_lats": n_lats,
        "n_lons": n_lons,
        "total_points": n_lats * n_lons,
        "temp_x10": temp_x10,
        "mslp_offset_x10": mslp_x10,
        "u_x10": u_x10,
        "v_x10": v_x10,
        "precip_x10": precip_x10,
    }


def main() -> None:
    radiosonde = process_radiosonde()
    reanalysis = process_reanalysis()
    himawari = process_himawari_geojson()
    indonesia_10km = process_indonesia_10km()

    (OUTPUT_DIR / "radiosonde.json").write_text(json.dumps(radiosonde, indent=2), encoding="utf-8")
    (OUTPUT_DIR / "reanalysis.json").write_text(json.dumps(reanalysis, indent=2), encoding="utf-8")
    (OUTPUT_DIR / "himawari.geojson").write_text(json.dumps(himawari, indent=2), encoding="utf-8")
    (OUTPUT_DIR / "indonesia_10km.json").write_text(json.dumps(indonesia_10km), encoding="utf-8")

    print(f"[OK] Ventusky-style datasets saved to: {OUTPUT_DIR}")
    print(f"     - Timesteps           : {len(reanalysis['timesteps'])}")
    print(f"     - Global grid pts     : {len(reanalysis['timesteps'][0]['points'])}")
    print(f"     - Indonesia 10km pts  : {indonesia_10km['total_points']} ({indonesia_10km['n_lats']}x{indonesia_10km['n_lons']})")
    print(f"     - Radiosonde stations : {len(radiosonde['stations'])}")


if __name__ == "__main__":
    main()
