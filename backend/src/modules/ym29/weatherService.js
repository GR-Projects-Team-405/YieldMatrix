// YM29 · Yasindu Janapriya · Hardened Open-Meteo weather client with Sample weather fallback.
// Context only — weather is NEVER an input to demand forecasting models (SRS Section 24).

export const ALLOWED_DISTRICTS = Object.freeze([
  { name: 'Colombo', lat: 6.9271, lon: 79.8612, hubLabel: 'Manning Market / Peliyagoda Terminal' },
  { name: 'Nuwara Eliya', lat: 6.9497, lon: 80.7891, hubLabel: 'Nuwara Eliya Upcountry Hub' },
  { name: 'Kandy', lat: 7.2906, lon: 80.6337, hubLabel: 'Kandy Central Corridor' },
  { name: 'Badulla', lat: 6.9934, lon: 81.0550, hubLabel: 'Keppetipola / Badulla DEC' },
  { name: 'Jaffna', lat: 9.6615, lon: 80.0255, hubLabel: 'Jaffna Northern Market' },
  { name: 'Dambulla', lat: 7.8731, lon: 80.6517, hubLabel: 'Dambulla Dedicated Economic Centre' },
]);

const DISTRICT_MAP = new Map(ALLOWED_DISTRICTS.map((d) => [d.name.toLowerCase(), d]));
const CACHE_TTL_MS = 45 * 60 * 1000; // 45 minutes
const FETCH_TIMEOUT_MS = 4000;
const weatherCache = new Map();

export function normalizeDistrict(input) {
  if (typeof input !== 'string') return null;
  const match = DISTRICT_MAP.get(input.trim().toLowerCase());
  return match ? match.name : null;
}

export function getDistrictInfo(districtName) {
  if (typeof districtName !== 'string') return null;
  return DISTRICT_MAP.get(districtName.trim().toLowerCase()) || null;
}

function getColomboTodayIso() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

function addDaysIso(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function describeWeatherCode(code) {
  const numeric = Number(code);
  if (numeric === 0) return 'Clear';
  if ([1, 2].includes(numeric)) return 'Partly cloudy';
  if (numeric === 3) return 'Cloudy';
  if ([45, 48].includes(numeric)) return 'Misty';
  if ([51, 53, 55, 56, 57].includes(numeric)) return 'Light drizzle';
  if ([61, 63, 80, 81].includes(numeric)) return 'Rain';
  if ([65, 82].includes(numeric)) return 'Heavy rain';
  if ([95, 96, 99].includes(numeric)) return 'Thunderstorm';
  return 'Partly cloudy';
}

function buildOperationalGuidance(districtName, days) {
  const wettest = days.reduce((best, day) => (day.rain_mm > best.rain_mm ? day : best), days[0]);
  const hottest = days.reduce((best, day) => (day.temp_max > best.temp_max ? day : best), days[0]);

  if (wettest && wettest.rain_mm >= 20) {
    return {
      risk_level: 'high',
      summary: `Heavy rainfall (${wettest.rain_mm.toFixed(1)} mm) expected in ${districtName} on ${wettest.date}. Plan covered loading and earlier harvest to avoid wet-spoilage.`,
      transit_note: 'Context only; weather is not an input to the demand model.',
    };
  }
  if (wettest && wettest.rain_mm >= 8) {
    return {
      risk_level: 'moderate',
      summary: `Moderate showers (${wettest.rain_mm.toFixed(1)} mm) expected around ${wettest.date} in ${districtName}. Use ventilated plastic crates during transport.`,
      transit_note: 'Context only; weather is not an input to the demand model.',
    };
  }
  if (hottest && hottest.temp_max >= 33) {
    return {
      risk_level: 'moderate',
      summary: `Warm dry conditions up to ${hottest.temp_max.toFixed(1)}°C in ${districtName}. Schedule early morning dispatch to reduce moisture loss.`,
      transit_note: 'Context only; weather is not an input to the demand model.',
    };
  }
  return {
    risk_level: 'low',
    summary: `Favourable dry-to-mild conditions in ${districtName} over the next 5 days. Standard harvest and transit handling applies.`,
    transit_note: 'Context only; weather is not an input to the demand model.',
  };
}

function buildSampleWeather(districtInfo) {
  const today = getColomboTodayIso();
  const profiles = {
    'Nuwara Eliya': [
      { max: 21.0, min: 13.5, rain: 4.2, code: 2 },
      { max: 20.5, min: 13.0, rain: 6.5, code: 61 },
      { max: 19.8, min: 12.8, rain: 14.0, code: 63 },
      { max: 18.6, min: 12.2, rain: 34.5, code: 65 },
      { max: 20.4, min: 13.1, rain: 5.0, code: 2 },
    ],
    Colombo: [
      { max: 30.8, min: 24.5, rain: 2.0, code: 2 },
      { max: 31.2, min: 24.8, rain: 4.5, code: 61 },
      { max: 29.9, min: 24.1, rain: 9.8, code: 63 },
      { max: 29.1, min: 23.8, rain: 18.4, code: 80 },
      { max: 30.5, min: 24.4, rain: 3.2, code: 1 },
    ],
    Kandy: [
      { max: 28.4, min: 20.1, rain: 3.1, code: 2 },
      { max: 27.9, min: 19.8, rain: 7.4, code: 61 },
      { max: 26.8, min: 19.4, rain: 22.0, code: 65 },
      { max: 27.2, min: 19.7, rain: 11.2, code: 63 },
      { max: 28.1, min: 20.0, rain: 2.5, code: 1 },
    ],
    Badulla: [
      { max: 27.0, min: 18.2, rain: 2.8, code: 1 },
      { max: 26.5, min: 18.0, rain: 5.1, code: 2 },
      { max: 25.9, min: 17.6, rain: 12.4, code: 63 },
      { max: 26.2, min: 17.8, rain: 6.0, code: 61 },
      { max: 27.3, min: 18.4, rain: 1.8, code: 0 },
    ],
    Jaffna: [
      { max: 33.4, min: 26.2, rain: 0.0, code: 0 },
      { max: 33.8, min: 26.5, rain: 0.4, code: 1 },
      { max: 32.9, min: 26.0, rain: 1.5, code: 2 },
      { max: 33.1, min: 26.1, rain: 0.0, code: 0 },
      { max: 33.5, min: 26.3, rain: 0.2, code: 1 },
    ],
    Dambulla: [
      { max: 32.1, min: 23.4, rain: 1.0, code: 1 },
      { max: 32.6, min: 23.8, rain: 0.5, code: 0 },
      { max: 31.8, min: 23.2, rain: 4.2, code: 2 },
      { max: 31.2, min: 23.0, rain: 8.6, code: 61 },
      { max: 32.0, min: 23.5, rain: 1.2, code: 1 },
    ],
  };

  const selected = profiles[districtInfo.name] || profiles.Colombo;
  const days = selected.map((item, index) => ({
    date: addDaysIso(today, index),
    temp_max: item.max,
    temp_min: item.min,
    rain_mm: item.rain,
    condition: describeWeatherCode(item.code),
    status: 'forecast',
  }));

  const guidance = buildOperationalGuidance(districtInfo.name, days);
  return {
    district: districtInfo.name,
    hub_label: districtInfo.hubLabel,
    source: 'Sample weather (offline fixture)',
    label: 'Sample weather',
    is_sample: true,
    context_only: true,
    observed_at: new Date().toISOString(),
    data_date: today,
    days,
    ...guidance,
  };
}

function validateOpenMeteoDaily(payload) {
  if (!payload || typeof payload !== 'object' || !payload.daily || typeof payload.daily !== 'object') {
    return null;
  }
  const { time, temperature_2m_max, temperature_2m_min, precipitation_sum, weather_code } = payload.daily;
  if (
    !Array.isArray(time) ||
    !Array.isArray(temperature_2m_max) ||
    !Array.isArray(temperature_2m_min) ||
    !Array.isArray(precipitation_sum) ||
    !Array.isArray(weather_code)
  ) {
    return null;
  }
  const count = Math.min(5, time.length, temperature_2m_max.length, temperature_2m_min.length, precipitation_sum.length, weather_code.length);
  if (count < 1) return null;

  const days = [];
  for (let i = 0; i < count; i += 1) {
    const dateStr = typeof time[i] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(time[i]) ? time[i] : null;
    const tMax = Number(temperature_2m_max[i]);
    const tMin = Number(temperature_2m_min[i]);
    const rain = Number(precipitation_sum[i]);
    const wCode = Number(weather_code[i]);
    if (!dateStr || !Number.isFinite(tMax) || !Number.isFinite(tMin) || !Number.isFinite(rain) || !Number.isFinite(wCode)) {
      return null;
    }
    days.push({
      date: dateStr,
      temp_max: Math.round(tMax * 10) / 10,
      temp_min: Math.round(tMin * 10) / 10,
      rain_mm: Math.max(0, Math.round(rain * 10) / 10),
      condition: describeWeatherCode(wCode),
      status: 'forecast',
    });
  }
  return days;
}

export async function getWeatherForDistrict(districtInput) {
  const districtInfo = getDistrictInfo(districtInput) || ALLOWED_DISTRICTS[0];
  const cacheKey = districtInfo.name;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // Strictly constructed from hardcoded allowlisted coordinates — never from client input.
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${districtInfo.lat}&longitude=${districtInfo.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=Asia%2FColombo&forecast_days=5`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Weather API status ${response.status}`);

    const raw = await response.json();
    const days = validateOpenMeteoDaily(raw);
    if (!days) throw new Error('Invalid weather response schema');

    const guidance = buildOperationalGuidance(districtInfo.name, days);
    const result = {
      district: districtInfo.name,
      hub_label: districtInfo.hubLabel,
      source: 'Open-Meteo (free forecast API)',
      label: 'Live weather (Open-Meteo)',
      is_sample: false,
      context_only: true,
      observed_at: new Date().toISOString(),
      data_date: days[0].date,
      days,
      ...guidance,
    };

    weatherCache.set(cacheKey, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch {
    const fallback = buildSampleWeather(districtInfo);
    // Short cache (5 min) on fallback so live recovery happens quickly when connectivity returns.
    weatherCache.set(cacheKey, { value: fallback, expiresAt: Date.now() + 5 * 60 * 1000 });
    return fallback;
  }
}

export async function getCorridorWeather(primaryDistrict) {
  const normalized = normalizeDistrict(primaryDistrict) || 'Colombo';
  const ordered = [normalized, 'Nuwara Eliya', 'Kandy', 'Dambulla', 'Colombo']
    .filter((value, index, self) => self.indexOf(value) === index)
    .slice(0, 4);
  return Promise.all(ordered.map((d) => getWeatherForDistrict(d)));
}
