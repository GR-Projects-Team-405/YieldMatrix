// YM29 · Yasindu Janapriya · Deterministic non-AI analytics, provenance, and rule-based explanations.

const STALE_THRESHOLD_DAYS = 7;

export function getColomboTodayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function daysBetweenIso(fromIso, toIso) {
  if (!fromIso || !toIso) return null;
  const from = new Date(`${String(fromIso).slice(0, 10)}T00:00:00Z`);
  const to = new Date(`${String(toIso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function isStaleDate(dateIso, referenceIso = getColomboTodayIso()) {
  const diff = daysBetweenIso(dateIso, referenceIso);
  if (diff === null) return true;
  return diff > STALE_THRESHOLD_DAYS;
}

export function formatDateIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

const WEEKDAY_NOTES = [
  'Rule: Sunday depot clearing',
  'Rule: Monday restock planning',
  'Rule: Tuesday retail replenishment',
  'Rule: Midweek wholesale planning',
  'Rule: Thursday market preparation',
  'Rule: Friday collection planning',
  'Rule: Weekend market distribution',
];

function ruleNoteForDate(isoDate) {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return 'Rule: Daily volume planning';
  return WEEKDAY_NOTES[dt.getUTCDay()];
}

export function evaluateForecastRun(runRow, cropName, districtName) {
  const todayIso = getColomboTodayIso();

  if (!runRow) {
    return {
      status: 'service_unavailable',
      method: 'none',
      model_version: null,
      data_date: null,
      input_from: null,
      input_until: null,
      training_from: null,
      training_until: null,
      evaluation_from: null,
      evaluation_until: null,
      horizon_days: 7,
      series: [],
      total_projected_kg: null,
      peak_day: null,
      model_mae_kg: null,
      baseline_mae_kg: null,
      published_method_label: 'Forecast unavailable',
      explanation: `No stored demand forecast is available yet for ${cropName} in ${districtName}. Trading continues normally; unavailable predictions are never shown as zero.`,
      limitations: 'Demand forecasts are generated offline from recorded market observations. Weather and price data are displayed separately as context.',
      is_demo: false,
      generated_at: new Date().toISOString(),
    };
  }

  const inputUntil = formatDateIso(runRow.input_until);
  const inputFrom = formatDateIso(runRow.input_from);
  const trainingFrom = formatDateIso(runRow.training_from);
  const trainingUntil = formatDateIso(runRow.training_until);
  const evaluationFrom = formatDateIso(runRow.evaluation_from);
  const evaluationUntil = formatDateIso(runRow.evaluation_until);
  const modelMae = runRow.model_mae_kg !== null && runRow.model_mae_kg !== undefined ? Number(runRow.model_mae_kg) : null;
  const baselineMae = runRow.baseline_mae_kg !== null && runRow.baseline_mae_kg !== undefined ? Number(runRow.baseline_mae_kg) : null;

  let effectiveStatus = runRow.status === 'failed' ? 'service_unavailable' : runRow.status;
  if (effectiveStatus === 'available' && isStaleDate(inputUntil, todayIso)) {
    effectiveStatus = 'stale';
  }

  const rawSeries = Array.isArray(runRow.series) ? runRow.series : [];
  const normalizedSeries =
    effectiveStatus === 'available'
      ? rawSeries.map((pt) => {
          const date = formatDateIso(pt.date || pt.forecast_date);
          const predictedKg = Number(pt.predicted_kg);
          const baselineKg = pt.baseline_kg !== undefined && pt.baseline_kg !== null ? Number(pt.baseline_kg) : null;
          const variancePct =
            baselineKg && baselineKg > 0 && Number.isFinite(predictedKg)
              ? Math.round(((predictedKg - baselineKg) / baselineKg) * 1000) / 10
              : null;
          return {
            date,
            predicted_kg: Number.isFinite(predictedKg) ? predictedKg : null,
            baseline_kg: Number.isFinite(baselineKg) ? baselineKg : null,
            variance_pct: variancePct,
            note: pt.note || ruleNoteForDate(date),
          };
        })
      : [];

  const validPoints = normalizedSeries.filter((p) => p.predicted_kg !== null);
  const totalProjectedKg = validPoints.length > 0 ? Math.round(validPoints.reduce((s, p) => s + p.predicted_kg, 0) * 1000) / 1000 : null;
  const peakDay =
    validPoints.length > 0
      ? validPoints.reduce((best, p) => (p.predicted_kg > best.predicted_kg ? p : best), validPoints[0])
      : null;

  const methodLabel =
    effectiveStatus === 'stale'
      ? 'Stale — suppressed'
      : effectiveStatus === 'insufficient_data'
        ? 'Insufficient data'
        : effectiveStatus === 'service_unavailable'
          ? 'Forecast unavailable'
          : runRow.method === 'weekday_baseline'
            ? '7-day weekday baseline'
            : runRow.method || 'Demand model';

  return {
    status: effectiveStatus,
    method: runRow.method,
    model_version: runRow.model_version,
    data_date: inputUntil,
    input_from: inputFrom,
    input_until: inputUntil,
    training_from: trainingFrom,
    training_until: trainingUntil,
    evaluation_from: evaluationFrom,
    evaluation_until: evaluationUntil,
    horizon_days: Number(runRow.horizon_days || 7),
    series: normalizedSeries,
    total_projected_kg: totalProjectedKg,
    peak_day: peakDay,
    model_mae_kg: modelMae,
    baseline_mae_kg: baselineMae,
    published_method_label: methodLabel,
    explanation:
      effectiveStatus === 'stale'
        ? `Latest forecast input is dated ${inputUntil} (older than 7 days). Forecast advice is suppressed until new market observations are imported.`
        : runRow.explanation,
    limitations: 'Demand forecasts use only historical daily volume and day of week. Weather and wholesale prices are presented separately as operational context.',
    is_demo: Boolean(runRow.sample_data),
    generated_at: runRow.generated_at ? new Date(runRow.generated_at).toISOString() : new Date().toISOString(),
  };
}

export function evaluatePriceStats(row, cropName, gradeName, districtName, windowFrom, windowUntil) {
  const count = Number(row?.observation_count || 0);
  const latestDate = formatDateIso(row?.latest_date);
  const isDemo = Boolean(row?.any_sample_data);

  if (count === 0) {
    return {
      status: 'insufficient_data',
      crop: cropName,
      grade: gradeName,
      district: districtName,
      p25_cents: null,
      median_cents: null,
      p75_cents: null,
      observation_count: 0,
      minimum_required: 5,
      window_from: windowFrom,
      window_until: windowUntil,
      data_date: null,
      source: 'market_observations',
      is_demo: false,
      note: 'No comparable price observations recorded in the preceding 14 days (minimum 5 required).',
    };
  }

  if (isStaleDate(latestDate)) {
    return {
      status: 'stale',
      crop: cropName,
      grade: gradeName,
      district: districtName,
      p25_cents: null,
      median_cents: null,
      p75_cents: null,
      observation_count: count,
      minimum_required: 5,
      window_from: windowFrom,
      window_until: windowUntil,
      data_date: latestDate,
      source: row?.primary_source || 'market_observations',
      is_demo: isDemo,
      note: `Latest observation is dated ${latestDate} (older than 7 days). Price advice is suppressed until newer data is uploaded.`,
    };
  }

  if (count < 5) {
    return {
      status: 'insufficient_data',
      crop: cropName,
      grade: gradeName,
      district: districtName,
      p25_cents: null,
      median_cents: null,
      p75_cents: null,
      observation_count: count,
      minimum_required: 5,
      window_from: windowFrom,
      window_until: windowUntil,
      data_date: latestDate,
      source: row?.primary_source || 'market_observations',
      is_demo: isDemo,
      note: `Only ${count} comparable observations found in the preceding 14 days (at least 5 required to publish P25–P75 range).`,
    };
  }

  return {
    status: 'available',
    crop: cropName,
    grade: gradeName,
    district: districtName,
    p25_cents: Math.round(Number(row.p25_cents)),
    median_cents: Math.round(Number(row.median_cents)),
    p75_cents: Math.round(Number(row.p75_cents)),
    observation_count: count,
    minimum_required: 5,
    window_from: windowFrom,
    window_until: windowUntil,
    data_date: latestDate,
    source: row?.primary_source || 'market_observations',
    is_demo: isDemo,
    note: 'Statistical P25–P75 range across comparable observations. You decide your offer price.',
  };
}

function formatLkrFromCents(cents) {
  if (cents === null || cents === undefined) return '—';
  return `LKR ${(Number(cents) / 100).toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function buildAdvisoryReasons({ forecast, priceStats, weather, cropName, gradeName, districtName }) {
  const reasons = [];

  if (forecast.status === 'available' && forecast.peak_day) {
    reasons.push({
      category: 'demand',
      title: 'Demand outlook',
      evidence_type: forecast.is_demo ? 'Demo forecast' : 'Demand forecast',
      date: forecast.data_date,
      text: `${forecast.peak_day.date}: projected ${forecast.peak_day.predicted_kg.toLocaleString('en-US')} kg${forecast.peak_day.variance_pct !== null ? ` (${forecast.peak_day.variance_pct >= 0 ? '+' : ''}${forecast.peak_day.variance_pct}% vs baseline)` : ''}. Based on recent demand and day of week.`,
      scope: 'Demand volume only; does not set prices.',
    });
  } else {
    reasons.push({
      category: 'demand',
      title: 'Demand outlook',
      evidence_type: 'Demand forecast',
      date: forecast.data_date || getColomboTodayIso(),
      text: forecast.explanation,
      scope: `Status: ${forecast.status.replaceAll('_', ' ')}`,
    });
  }

  if (priceStats.status === 'available') {
    reasons.push({
      category: 'price',
      title: `${districtName} price context (${gradeName})`,
      evidence_type: 'Price statistics',
      date: priceStats.data_date,
      text: `Median ${formatLkrFromCents(priceStats.median_cents)}/kg (P25–P75: ${formatLkrFromCents(priceStats.p25_cents)} – ${formatLkrFromCents(priceStats.p75_cents)}) from ${priceStats.observation_count} observations (${priceStats.window_from} to ${priceStats.window_until}).`,
      scope: 'You decide your offer price.',
    });
  } else {
    reasons.push({
      category: 'price',
      title: `${districtName} price context (${gradeName})`,
      evidence_type: 'Price statistics',
      date: priceStats.data_date || priceStats.window_until,
      text: priceStats.note,
      scope: `Status: ${priceStats.status.replaceAll('_', ' ')}`,
    });
  }

  if (weather) {
    reasons.push({
      category: 'weather',
      title: weather.is_sample ? 'Sample weather context' : 'Weather context',
      evidence_type: weather.is_sample ? 'Sample weather' : 'Weather (Open-Meteo)',
      date: weather.data_date,
      text: weather.summary,
      scope: 'Context only; not a demand-model input.',
    });
  }

  return reasons;
}

export function buildEvidenceMatrix({ forecast, priceStats, weather, cropName, gradeName, districtName }) {
  return [
    {
      element: `${cropName} demand outlook (${districtName})`,
      evidence_type: forecast.is_demo ? 'Demo forecast' : 'Demand forecast',
      supporting_source: forecast.model_version || 'Offline forecast pipeline',
      data_date: forecast.data_date || '—',
      method_scope: `${forecast.published_method_label} · Demand volume only`,
      updated_at: forecast.generated_at,
    },
    {
      element: `${cropName} ${gradeName} price range (${districtName})`,
      evidence_type: 'Price statistics',
      supporting_source: priceStats.source || 'market_observations',
      data_date: priceStats.data_date || '—',
      method_scope:
        priceStats.status === 'available'
          ? `P25–P75 (n=${priceStats.observation_count}, 14d window)`
          : `${priceStats.status.replaceAll('_', ' ')} (n=${priceStats.observation_count}/5 min)`,
      updated_at: new Date().toISOString(),
    },
    {
      element: `${districtName} 5-day weather context`,
      evidence_type: weather.is_sample ? 'Sample weather' : 'Weather',
      supporting_source: weather.source,
      data_date: weather.data_date,
      method_scope: 'Operational context only · Not a model input',
      updated_at: weather.observed_at,
    },
  ];
}
