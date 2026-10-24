// Fishing conditions for the Home page: moon phase (worked out on the phone, no internet
// needed) and current weather from Open-Meteo (free for non-commercial use, no key,
// CC BY 4.0: https://open-meteo.com/en/terms).

const SYNODIC_DAYS = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14); // 6 Jan 2000 18:14 UTC
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const WEATHER_CACHE_MIN = 30;

// Moon phase from 0 (new) through 0.5 (full) back to 1, plus a name and % lit.
// Accurate to within about a day, which is plenty for planning a trip.
function moonPhase(date) {
  const days = (date.getTime() - KNOWN_NEW_MOON) / 864e5;
  const phase = (((days / SYNODIC_DAYS) % 1) + 1) % 1;
  const lit = Math.round(((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100);
  const names = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];
  return { phase, lit, name: names[Math.round(phase * 8) % 8] };
}

// WMO weather codes used by Open-Meteo.
function weatherText(code) {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}

async function fetchWeather(lat, lng) {
  const key = `weather:${lat.toFixed(2)},${lng.toFixed(2)}`;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(key)); } catch { /* ignore */ }
  if (cached && Date.now() - cached.at < WEATHER_CACHE_MIN * 60000) return cached.data;

  const params = new URLSearchParams({
    latitude: lat.toFixed(4), longitude: lng.toFixed(4),
    current: "temperature_2m,wind_speed_10m,weather_code,surface_pressure",
    daily: "sunrise,sunset", timezone: "auto", forecast_days: "1",
  });
  try {
    const res = await fetch(`${WEATHER_URL}?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const data = {
      tempC: j.current.temperature_2m,
      windKmh: j.current.wind_speed_10m,
      pressureHpa: j.current.surface_pressure,
      text: weatherText(j.current.weather_code),
      sunrise: j.daily.sunrise[0],
      sunset: j.daily.sunset[0],
    };
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* ignore */ }
    return data;
  } catch (err) {
    if (cached) return cached.data;
    throw err;
  }
}

if (typeof module !== "undefined") module.exports = { moonPhase, weatherText };
