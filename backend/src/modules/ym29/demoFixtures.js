// YM29 · Yasindu Janapriya · Clearly labelled DEMO DATA fixtures for Phase 1 Option B preview.
// Every fixture explicitly sets is_demo = true and preserves SRS states (available, insufficient_data, stale).

import { ALLOWED_DISTRICTS } from './weatherService.js';

export const DEMO_CROPS = [
  { id: 'demo-crop-tomato', name: 'Tomato' },
  { id: 'demo-crop-carrot', name: 'Carrot' },
  { id: 'demo-crop-cabbage', name: 'Cabbage' },
  { id: 'demo-crop-potato', name: 'Potato' },
  { id: 'demo-crop-beans', name: 'Beans' },
];

export const DEMO_GRADES = [
  { id: 'demo-grade-a', name: 'Grade A', description: 'Grade A produce' },
  { id: 'demo-grade-b', name: 'Grade B', description: 'Grade B produce' },
  { id: 'demo-grade-c', name: 'Grade C', description: 'Grade C produce' },
];

const CROP_PROFILES = {
  Tomato: { baseKg: 1020, priceA: 28500, maeModel: 48.5, maeBase: 92.4, trendPct: 16.4, source: 'DEC wholesale (Demo)' },
  Carrot: { baseKg: 840, priceA: 22500, maeModel: 39.2, maeBase: 71.8, trendPct: 4.2, source: 'Farmgate history (Demo)' },
  Cabbage: { baseKg: 760, priceA: 15500, maeModel: 42.0, maeBase: 68.5, trendPct: 8.7, source: 'Buyer RFQs (Demo)' },
  Potato: { baseKg: 910, priceA: 26000, maeModel: 51.4, maeBase: 86.2, trendPct: 6.1, source: 'Wholesale arrivals (Demo)' },
  Beans: { baseKg: 620, priceA: 33500, maeModel: 36.8, maeBase: 64.0, trendPct: 12.8, source: 'Pre-orders (Demo)' },
};

const DISTRICT_MULTIPLIER = {
  Colombo: 1.15,
  'Nuwara Eliya': 0.92,
  Kandy: 0.98,
  Badulla: 0.85,
  Jaffna: 0.72,
  Dambulla: 1.08,
};

const GRADE_PRICE_FACTOR = {
  'Grade A': 1.0,
  'Grade B': 0.82,
  'Grade C': 0.62,
};

const WEEKDAY_PATTERN = [0.88, 0.95, 1.08, 1.24, 1.16, 0.98, 0.89];
const RULE_NOTES = [
  'Rule: Monday restock planning',
  'Rule: Tuesday retail replenishment',
  'Rule: Midweek wholesale buildup',
  'Rule: Prepare for peak wholesale intake',
  'Rule: Friday collection planning',
  'Rule: Weekend market distribution',
  'Rule: Sunday depot clearing',
];

function colomboTodayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDaysIso(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function buildDemoForecast(cropName, districtName) {
  const today = colomboTodayIso();
  const yesterday = addDaysIso(today, -1);
  const generatedAt = new Date().toISOString();

  // Deliberate SRS insufficient-data demonstration (Carrot in Jaffna: 18 of 56 days)
  if (cropName === 'Carrot' && districtName === 'Jaffna') {
    return {
      status: 'insufficient_data',
      method: 'none',
      model_version: 'demo-preview-v1',
      data_date: yesterday,
      input_from: addDaysIso(yesterday, -17),
      input_until: yesterday,
      training_from: null,
      training_until: null,
      evaluation_from: null,
      evaluation_until: null,
      observed_days: 18,
      required_days: 56,
      horizon_days: 7,
      series: [],
      total_projected_kg: null,
      peak_day: null,
      model_mae_kg: null,
      baseline_mae_kg: null,
      published_method_label: 'Insufficient data',
      explanation: 'Only 18 days of gap-free demand history are available for Carrot in Jaffna (minimum 56 days required). Unavailable predictions are never shown as zero.',
      limitations: 'Demand forecast requires at least 56 consecutive days of recorded volume. Weather and prices are not model inputs.',
      is_demo: true,
      generated_at: generatedAt,
    };
  }

  // Deliberate SRS stale-data demonstration (Beans in Jaffna: 11 days old > 7-day threshold)
  if (cropName === 'Beans' && districtName === 'Jaffna') {
    const staleDate = addDaysIso(today, -11);
    return {
      status: 'stale',
      method: 'weekday_baseline',
      model_version: 'demo-preview-v1',
      data_date: staleDate,
      input_from: addDaysIso(staleDate, -89),
      input_until: staleDate,
      training_from: addDaysIso(staleDate, -89),
      training_until: addDaysIso(staleDate, -14),
      evaluation_from: addDaysIso(staleDate, -13),
      evaluation_until: staleDate,
      observed_days: 90,
      required_days: 56,
      horizon_days: 7,
      series: [],
      total_projected_kg: null,
      peak_day: null,
      model_mae_kg: null,
      baseline_mae_kg: 64.0,
      published_method_label: 'Stale — suppressed',
      explanation: `Latest input data is dated ${staleDate} (older than 7 days). New forecast advice is suppressed until fresh market observations are uploaded.`,
      limitations: 'Stale datasets (>7 days old) cannot publish active forecasts.',
      is_demo: true,
      generated_at: generatedAt,
    };
  }

  const profile = CROP_PROFILES[cropName] || CROP_PROFILES.Tomato;
  const distMult = DISTRICT_MULTIPLIER[districtName] || 1.0;

  const series = Array.from({ length: 7 }, (_, i) => {
    const forecastDate = addDaysIso(today, i);
    const factor = WEEKDAY_PATTERN[i];
    const baselineKg = Math.round(profile.baseKg * distMult * (0.85 + (factor - 0.85) * 0.55));
    const projectedKg = Math.round(profile.baseKg * distMult * factor * (1 + profile.trendPct / 160));
    const variancePct = baselineKg > 0 ? Math.round(((projectedKg - baselineKg) / baselineKg) * 1000) / 10 : 0;
    return {
      date: forecastDate,
      predicted_kg: projectedKg,
      baseline_kg: baselineKg,
      variance_pct: variancePct,
      note: RULE_NOTES[i],
    };
  });

  const totalProjectedKg = series.reduce((sum, item) => sum + item.predicted_kg, 0);
  const peakDay = series.reduce((best, item) => (item.predicted_kg > best.predicted_kg ? item : best), series[0]);

  return {
    status: 'available',
    method: 'demo_preview_model',
    model_version: 'demo-preview-v1 (AI pending)',
    data_date: yesterday,
    input_from: addDaysIso(yesterday, -119),
    input_until: yesterday,
    training_from: addDaysIso(yesterday, -119),
    training_until: addDaysIso(yesterday, -14),
    evaluation_from: addDaysIso(yesterday, -13),
    evaluation_until: yesterday,
    observed_days: 120,
    required_days: 56,
    horizon_days: 7,
    series,
    total_projected_kg: totalProjectedKg,
    peak_day: peakDay,
    model_mae_kg: profile.maeModel,
    baseline_mae_kg: profile.maeBase,
    published_method_label: 'Demo preview (AI pending)',
    explanation: `Demo forecast preview for ${cropName} in ${districtName}. Peak intake (${peakDay.predicted_kg.toLocaleString('en-US')} kg) is projected on ${peakDay.date} (+${peakDay.variance_pct}% vs 7-day weekday baseline).`,
    limitations: 'Demo preview only until the local ML model runs. Demand forecasts use only recent recorded volume and day of week — weather and prices are shown separately as context.',
    is_demo: true,
    generated_at: generatedAt,
  };
}

export function buildDemoPriceStats(cropName, gradeName, districtName) {
  const today = colomboTodayIso();
  const yesterday = addDaysIso(today, -1);
  const windowFrom = addDaysIso(yesterday, -13);

  // Sparse price observations example for Carrot + Jaffna
  if (cropName === 'Carrot' && districtName === 'Jaffna') {
    return {
      status: 'insufficient_data',
      crop: cropName,
      grade: gradeName,
      district: districtName,
      p25_cents: null,
      median_cents: null,
      p75_cents: null,
      observation_count: 3,
      minimum_required: 5,
      window_from: windowFrom,
      window_until: yesterday,
      data_date: yesterday,
      source: 'Demo market observations',
      is_demo: true,
      note: 'Only 3 comparable observations recorded in the last 14 days (minimum 5 required for P25–P75 range).',
    };
  }

  const profile = CROP_PROFILES[cropName] || CROP_PROFILES.Tomato;
  const distFactor = districtName === 'Colombo' ? 1.05 : districtName === 'Nuwara Eliya' ? 0.92 : 0.98;
  const gradeFactor = GRADE_PRICE_FACTOR[gradeName] || 1.0;

  const median = Math.round((profile.priceA * distFactor * gradeFactor) / 100) * 100;
  const p25 = Math.round((median * 0.9) / 100) * 100;
  const p75 = Math.round((median * 1.1) / 100) * 100;

  return {
    status: 'available',
    crop: cropName,
    grade: gradeName,
    district: districtName,
    p25_cents: p25,
    median_cents: median,
    p75_cents: p75,
    observation_count: 14,
    minimum_required: 5,
    window_from: windowFrom,
    window_until: yesterday,
    data_date: yesterday,
    source: profile.source,
    is_demo: true,
    note: 'Statistical range (P25–P75) from comparable observations. You decide your offer price.',
  };
}

export function buildDemoMarketMatrix() {
  const pairs = [
    { crop: 'Tomato', grade: 'Grade A', district: 'Colombo' },
    { crop: 'Carrot', grade: 'Grade A', district: 'Nuwara Eliya' },
    { crop: 'Cabbage', grade: 'Grade B', district: 'Kandy' },
    { crop: 'Beans', grade: 'Grade A', district: 'Badulla' },
    { crop: 'Potato', grade: 'Grade A', district: 'Dambulla' },
    { crop: 'Carrot', grade: 'Grade A', district: 'Jaffna' },
    { crop: 'Beans', grade: 'Grade A', district: 'Jaffna' },
  ];

  return pairs.map(({ crop, grade, district }) => {
    const forecast = buildDemoForecast(crop, district);
    const price = buildDemoPriceStats(crop, grade, district);
    const cropObj = DEMO_CROPS.find((c) => c.name === crop);
    const gradeObj = DEMO_GRADES.find((g) => g.name === grade);

    return {
      crop_id: cropObj?.id || crop,
      crop,
      grade_id: gradeObj?.id || grade,
      grade,
      district,
      status: forecast.status,
      demand_trend_pct: forecast.peak_day ? forecast.peak_day.variance_pct : null,
      demand_trend_label:
        forecast.status === 'available' && forecast.peak_day
          ? `${forecast.peak_day.variance_pct >= 0 ? 'Rising' : 'Easing'} ${forecast.peak_day.variance_pct >= 0 ? '+' : ''}${forecast.peak_day.variance_pct}%`
          : forecast.status === 'insufficient_data'
            ? 'Insufficient data'
            : 'Stale data',
      p25_cents: price.p25_cents,
      median_cents: price.median_cents,
      p75_cents: price.p75_cents,
      method: forecast.published_method_label,
      evidence_source: price.source,
      data_date: forecast.data_date,
      is_demo: true,
    };
  });
}

export function buildDemoAdminEvaluation() {
  const today = colomboTodayIso();
  const yesterday = addDaysIso(today, -1);
  const byCrop = DEMO_CROPS.map((crop) => {
    const p = CROP_PROFILES[crop.name];
    return {
      crop: crop.name,
      model_mae_kg: p.maeModel,
      baseline_mae_kg: p.maeBase,
      published_method: p.maeModel < p.maeBase ? 'demo_preview_model' : 'weekday_baseline',
    };
  });

  const avgModel = Math.round((byCrop.reduce((s, c) => s + c.model_mae_kg, 0) / byCrop.length) * 10) / 10;
  const avgBase = Math.round((byCrop.reduce((s, c) => s + c.baseline_mae_kg, 0) / byCrop.length) * 10) / 10;

  return {
    status: 'available',
    is_demo: true,
    published_method: 'demo_preview_model',
    published_method_label: 'Demo Preview (AI pending)',
    model_version: 'demo-preview-v1',
    overall_model_mae_kg: avgModel,
    overall_baseline_mae_kg: avgBase,
    improvement_kg: Math.round((avgBase - avgModel) * 10) / 10,
    evaluation_window: `${addDaysIso(yesterday, -13)} to ${yesterday} (14-day holdout)`,
    data_date: yesterday,
    generated_at: new Date().toISOString(),
    by_crop: byCrop,
    coverage: {
      total_pairs: DEMO_CROPS.length * ALLOWED_DISTRICTS.length,
      available_pairs: DEMO_CROPS.length * ALLOWED_DISTRICTS.length - 2,
      insufficient_pairs: 1,
      stale_pairs: 1,
    },
  };
}
