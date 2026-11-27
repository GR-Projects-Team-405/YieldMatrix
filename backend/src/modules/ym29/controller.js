// YM29 · Yasindu Janapriya · Market information controllers.
// Serves Farmer/Buyer insights (Screens 1-3) and Admin market data & CSV upload review (Screens 4-5).

import {
  isDatabaseConfigured,
  getApprovedUser,
  getActiveCrops,
  getActiveGrades,
  getLatestForecastRun,
  getLatestForecastRunsAll,
  getPriceStatsForSelection,
  getPriceStatsByAllGrades,
  getMarketIndexPriceRows,
  findExistingObservationKeys,
  commitMarketUpload,
  recordUploadRejection,
  getAdminObservationStats,
  getAdminUploadAuditHistory,
} from './queries.js';
import {
  ALLOWED_DISTRICTS,
  normalizeDistrict,
  getWeatherForDistrict,
  getCorridorWeather,
} from './weatherService.js';
import {
  getColomboTodayIso,
  formatDateIso,
  isStaleDate,
  evaluateForecastRun,
  evaluatePriceStats,
  buildAdvisoryReasons,
  buildEvidenceMatrix,
} from './analytics.js';
import {
  DEMO_CROPS,
  DEMO_GRADES,
  buildDemoForecast,
  buildDemoPriceStats,
  buildDemoMarketMatrix,
  buildDemoAdminEvaluation,
} from './demoFixtures.js';
import { validateMarketCsv } from './csvValidator.js';
import {
  createStagedUpload,
  getStagedUpload,
  listPendingUploads,
  markUploadCommitted,
  markUploadRejected,
  serializeUploadSummary,
  serializeUploadDetail,
} from './uploadStore.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isDemoRequested(req) {
  return String(req.query.demo || '').toLowerCase() === 'true';
}

function addDaysIso(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Enforces approved user account in DB whenever DATABASE_URL is configured.
 * Matches existing YM29 scaffold security contract.
 */
async function requireApprovedCaller(req, res, { allowOfflineDemo = false } = {}) {
  if (!isDatabaseConfigured()) {
    if (allowOfflineDemo && process.env.NODE_ENV !== 'production') {
      return { id: req.user.id, name: req.user.name, role: req.user.role, offlineDemo: true };
    }
    res.status(503).json({
      error: 'Database connection is not configured yet. Add DATABASE_URL to backend/.env.',
      code: 'DB_NOT_CONFIGURED',
      requestId: req.requestId,
    });
    return null;
  }

  try {
    const user = await getApprovedUser(req.user.id, req.user.role);
    if (!user) {
      res.status(403).json({ error: 'Account is not approved', requestId: req.requestId });
      return null;
    }
    return { ...user, offlineDemo: false };
  } catch {
    if (allowOfflineDemo && process.env.NODE_ENV !== 'production') {
      return { id: req.user.id, name: req.user.name, role: req.user.role, offlineDemo: true };
    }
    res.status(503).json({
      error: 'Database connection unavailable',
      code: 'DB_UNAVAILABLE',
      requestId: req.requestId,
    });
    return null;
  }
}

function resolveCropAndGrade({ crops, grades, cropIdParam, cropNameParam, gradeIdParam, gradeNameParam }) {
  const crop =
    crops.find((c) => cropIdParam && c.id === cropIdParam) ||
    crops.find((c) => cropNameParam && c.name.toLowerCase() === cropNameParam.trim().toLowerCase()) ||
    crops[0];

  const grade =
    grades.find((g) => gradeIdParam && g.id === gradeIdParam) ||
    grades.find((g) => gradeNameParam && g.name.toLowerCase() === gradeNameParam.trim().toLowerCase()) ||
    grades[0];

  return { crop, grade };
}

// Existing scaffold endpoint preserved
export async function getStatus(req, res, next) {
  try {
    const caller = await requireApprovedCaller(req, res);
    if (!caller) return;
    return res.json({
      module: 'YM29',
      owner: 'Yasindu Janapriya',
      status: 'ready',
      user: { id: caller.id, name: caller.name, role: caller.role },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/ym29/reference
export async function getReferenceData(req, res, next) {
  try {
    const caller = await requireApprovedCaller(req, res, { allowOfflineDemo: true });
    if (!caller) return;

    let crops = DEMO_CROPS;
    let grades = DEMO_GRADES;
    let dbConnected = false;

    if (!caller.offlineDemo) {
      const [dbCrops, dbGrades] = await Promise.all([getActiveCrops(), getActiveGrades()]);
      if (dbCrops.length > 0) crops = dbCrops;
      if (dbGrades.length > 0) grades = dbGrades;
      dbConnected = true;
    }

    return res.json({
      crops,
      grades,
      districts: ALLOWED_DISTRICTS.map((d) => ({ name: d.name, hub_label: d.hubLabel })),
      db_connected: dbConnected,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/ym29/insights (Screen 1 — Farmer & Buyer)
export async function getMarketInsights(req, res, next) {
  try {
    const demoMode = isDemoRequested(req);
    const caller = await requireApprovedCaller(req, res, { allowOfflineDemo: demoMode });
    if (!caller) return;

    const district = normalizeDistrict(req.query.district) || 'Colombo';
    const crops = caller.offlineDemo || demoMode ? (caller.offlineDemo ? DEMO_CROPS : await getActiveCrops()) : await getActiveCrops();
    const grades = caller.offlineDemo || demoMode ? (caller.offlineDemo ? DEMO_GRADES : await getActiveGrades()) : await getActiveGrades();

    const effectiveCrops = crops.length > 0 ? crops : DEMO_CROPS;
    const effectiveGrades = grades.length > 0 ? grades : DEMO_GRADES;

    const { crop, grade } = resolveCropAndGrade({
      crops: effectiveCrops,
      grades: effectiveGrades,
      cropIdParam: req.query.cropId,
      cropNameParam: req.query.crop,
      gradeIdParam: req.query.gradeId,
      gradeNameParam: req.query.grade,
    });

    const weather = await getWeatherForDistrict(district);
    const todayIso = getColomboTodayIso();
    const windowFrom = addDaysIso(todayIso, -13);

    if (demoMode || caller.offlineDemo) {
      const forecast = buildDemoForecast(crop.name, district);
      const priceStats = buildDemoPriceStats(crop.name, grade.name, district);
      const reasons = buildAdvisoryReasons({
        forecast,
        priceStats,
        weather,
        cropName: crop.name,
        gradeName: grade.name,
        districtName: district,
      });
      const matrix = buildDemoMarketMatrix();

      return res.json({
        mode: 'demo',
        status: forecast.status,
        data_date: forecast.data_date || priceStats.data_date,
        method: forecast.published_method_label,
        generated_at: forecast.generated_at,
        is_demo: true,
        selection: { crop, grade, district },
        kpis: {
          top_demand_crop: 'Tomato',
          top_demand_subtext: `${district} · Demo preview`,
          suggested_price_cents: priceStats.median_cents,
          forecast_mae_kg: forecast.model_mae_kg,
          baseline_mae_kg: forecast.baseline_mae_kg,
          last_updated_at: forecast.generated_at,
        },
        forecast,
        price_stats: priceStats,
        weather,
        reasons,
        market_matrix: matrix,
        requestId: req.requestId,
      });
    }

    // Live DB mode (Option B: reads stored forecast_runs if present, else returns service_unavailable)
    const [runRow, priceRow, allRuns, matrixPriceRows] = await Promise.all([
      getLatestForecastRun(crop.id, district),
      getPriceStatsForSelection(crop.id, grade.id, district, todayIso),
      getLatestForecastRunsAll(),
      getMarketIndexPriceRows(todayIso),
    ]);

    const forecast = evaluateForecastRun(runRow, crop.name, district);
    const priceStats = evaluatePriceStats(priceRow, crop.name, grade.name, district, windowFrom, todayIso);
    const reasons = buildAdvisoryReasons({
      forecast,
      priceStats,
      weather,
      cropName: crop.name,
      gradeName: grade.name,
      districtName: district,
    });

    const runByKey = new Map(allRuns.map((r) => [`${r.crop_id}|${r.district}`, r]));
    const marketMatrix = matrixPriceRows.map((row) => {
      const matchedRun = runByKey.get(`${row.crop_id}|${row.district}`);
      const evaluatedRun = evaluateForecastRun(matchedRun, row.crop_name, row.district);
      const evaluatedPrice = evaluatePriceStats(row, row.crop_name, row.grade_name, row.district, windowFrom, todayIso);

      return {
        crop_id: row.crop_id,
        crop: row.crop_name,
        grade_id: row.grade_id,
        grade: row.grade_name,
        district: row.district,
        status: evaluatedRun.status,
        demand_trend_pct: evaluatedRun.peak_day?.variance_pct ?? null,
        demand_trend_label:
          evaluatedRun.status === 'available' && evaluatedRun.peak_day?.variance_pct !== null
            ? `${evaluatedRun.peak_day.variance_pct >= 0 ? 'Rising' : 'Easing'} ${evaluatedRun.peak_day.variance_pct >= 0 ? '+' : ''}${evaluatedRun.peak_day.variance_pct}%`
            : evaluatedRun.published_method_label,
        p25_cents: evaluatedPrice.p25_cents,
        median_cents: evaluatedPrice.median_cents,
        p75_cents: evaluatedPrice.p75_cents,
        method: evaluatedRun.published_method_label,
        evidence_source: evaluatedPrice.source,
        data_date: evaluatedPrice.data_date || evaluatedRun.data_date,
        is_demo: Boolean(evaluatedPrice.is_demo || evaluatedRun.is_demo),
      };
    });

    // Pick top demand crop from available stored runs (or null if none exist yet)
    const availableRuns = allRuns
      .map((r) => ({ crop: r.crop_name, district: r.district, evalRun: evaluateForecastRun(r, r.crop_name, r.district) }))
      .filter((item) => item.evalRun.status === 'available' && item.evalRun.total_projected_kg !== null)
      .sort((a, b) => b.evalRun.total_projected_kg - a.evalRun.total_projected_kg);

    const topRun = availableRuns[0] || null;
    const effectiveDataDate = forecast.data_date || priceStats.data_date || null;

    return res.json({
      mode: 'live',
      status: forecast.status,
      data_date: effectiveDataDate,
      method: forecast.published_method_label,
      generated_at: forecast.generated_at,
      is_demo: Boolean(forecast.is_demo || priceStats.is_demo),
      selection: { crop, grade, district },
      kpis: {
        top_demand_crop: topRun ? topRun.crop : null,
        top_demand_subtext: topRun ? `${topRun.district} · 7d projection` : 'Awaiting stored forecast runs',
        suggested_price_cents: priceStats.median_cents,
        forecast_mae_kg: forecast.model_mae_kg ?? forecast.baseline_mae_kg,
        baseline_mae_kg: forecast.baseline_mae_kg,
        last_updated_at: effectiveDataDate ? forecast.generated_at : null,
      },
      forecast,
      price_stats: priceStats,
      weather,
      reasons,
      market_matrix: marketMatrix,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/ym29/forecast (Screen 2 — Farmer & Buyer)
export async function getDemandForecast(req, res, next) {
  try {
    const demoMode = isDemoRequested(req);
    const caller = await requireApprovedCaller(req, res, { allowOfflineDemo: demoMode });
    if (!caller) return;

    const district = normalizeDistrict(req.query.district) || 'Colombo';
    const crops = caller.offlineDemo ? DEMO_CROPS : await getActiveCrops();
    const effectiveCrops = crops.length > 0 ? crops : DEMO_CROPS;
    const { crop } = resolveCropAndGrade({
      crops: effectiveCrops,
      grades: DEMO_GRADES,
      cropIdParam: req.query.cropId,
      cropNameParam: req.query.crop,
    });

    if (demoMode || caller.offlineDemo) {
      const forecast = buildDemoForecast(crop.name, district);
      return res.json({
        mode: 'demo',
        selection: { crop, district },
        ...forecast,
        requestId: req.requestId,
      });
    }

    const runRow = await getLatestForecastRun(crop.id, district);
    const forecast = evaluateForecastRun(runRow, crop.name, district);

    return res.json({
      mode: 'live',
      selection: { crop, district },
      ...forecast,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/ym29/price-advice (Screen 3 — Farmer & Buyer)
export async function getPriceWeatherAdvice(req, res, next) {
  try {
    const demoMode = isDemoRequested(req);
    const caller = await requireApprovedCaller(req, res, { allowOfflineDemo: demoMode });
    if (!caller) return;

    const district = normalizeDistrict(req.query.district) || 'Colombo';
    const crops = caller.offlineDemo ? DEMO_CROPS : await getActiveCrops();
    const grades = caller.offlineDemo ? DEMO_GRADES : await getActiveGrades();
    const effectiveCrops = crops.length > 0 ? crops : DEMO_CROPS;
    const effectiveGrades = grades.length > 0 ? grades : DEMO_GRADES;

    const { crop, grade } = resolveCropAndGrade({
      crops: effectiveCrops,
      grades: effectiveGrades,
      cropIdParam: req.query.cropId,
      cropNameParam: req.query.crop,
      gradeIdParam: req.query.gradeId,
      gradeNameParam: req.query.grade,
    });

    const todayIso = getColomboTodayIso();
    const windowFrom = addDaysIso(todayIso, -13);
    const [primaryWeather, corridorWeather] = await Promise.all([
      getWeatherForDistrict(district),
      getCorridorWeather(district),
    ]);

    if (demoMode || caller.offlineDemo) {
      const forecast = buildDemoForecast(crop.name, district);
      const gradePrices = effectiveGrades.map((g) => buildDemoPriceStats(crop.name, g.name, district));
      const selectedPrice = gradePrices.find((p) => p.grade === grade.name) || gradePrices[0];
      const reasons = buildAdvisoryReasons({
        forecast,
        priceStats: selectedPrice,
        weather: primaryWeather,
        cropName: crop.name,
        gradeName: grade.name,
        districtName: district,
      });
      const evidenceMatrix = buildEvidenceMatrix({
        forecast,
        priceStats: selectedPrice,
        weather: primaryWeather,
        cropName: crop.name,
        gradeName: grade.name,
        districtName: district,
      });

      return res.json({
        mode: 'demo',
        status: selectedPrice.status,
        data_date: selectedPrice.data_date || forecast.data_date,
        method: forecast.published_method_label,
        generated_at: new Date().toISOString(),
        is_demo: true,
        advisory_disclaimer: 'You decide your offer price. YieldMatrix provides statistics and context only — never automated price changes or order commitments.',
        selection: { crop, grade, district },
        forecast_summary: forecast,
        selected_price: selectedPrice,
        grade_prices: gradePrices,
        weather: primaryWeather,
        corridor_weather: corridorWeather,
        reasons,
        evidence_matrix: evidenceMatrix,
        requestId: req.requestId,
      });
    }

    const [runRow, gradeRows] = await Promise.all([
      getLatestForecastRun(crop.id, district),
      getPriceStatsByAllGrades(crop.id, district, todayIso),
    ]);

    const forecast = evaluateForecastRun(runRow, crop.name, district);
    const gradePrices = gradeRows.map((row) =>
      evaluatePriceStats(row, crop.name, row.grade_name, district, windowFrom, todayIso),
    );
    const selectedPrice =
      gradePrices.find((p) => p.grade.toLowerCase() === grade.name.toLowerCase()) ||
      evaluatePriceStats(null, crop.name, grade.name, district, windowFrom, todayIso);

    const reasons = buildAdvisoryReasons({
      forecast,
      priceStats: selectedPrice,
      weather: primaryWeather,
      cropName: crop.name,
      gradeName: grade.name,
      districtName: district,
    });
    const evidenceMatrix = buildEvidenceMatrix({
      forecast,
      priceStats: selectedPrice,
      weather: primaryWeather,
      cropName: crop.name,
      gradeName: grade.name,
      districtName: district,
    });

    return res.json({
      mode: 'live',
      status: selectedPrice.status,
      data_date: selectedPrice.data_date || forecast.data_date,
      method: forecast.published_method_label,
      generated_at: new Date().toISOString(),
      is_demo: Boolean(selectedPrice.is_demo || forecast.is_demo),
      advisory_disclaimer: 'You decide your offer price. YieldMatrix provides statistics and context only — never automated price changes or order commitments.',
      selection: { crop, grade, district },
      forecast_summary: forecast,
      selected_price: selectedPrice,
      grade_prices: gradePrices,
      weather: primaryWeather,
      corridor_weather: corridorWeather,
      reasons,
      evidence_matrix: evidenceMatrix,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/ym29/admin/datasets (Screen 4 — Admin)
export async function getAdminDatasets(req, res, next) {
  try {
    const demoMode = isDemoRequested(req);
    const caller = await requireApprovedCaller(req, res, { allowOfflineDemo: demoMode });
    if (!caller) return;

    const pendingUploads = listPendingUploads();

    if (demoMode || caller.offlineDemo) {
      const todayIso = getColomboTodayIso();
      const yesterday = addDaysIso(todayIso, -1);
      return res.json({
        mode: 'demo',
        is_demo: true,
        status: 'available',
        data_date: yesterday,
        generated_at: new Date().toISOString(),
        summary: {
          approved_imports: 3,
          rejected_imports: 1,
          total_observations: 4520,
          active_series_count: 28,
          stale_series_count: 1,
          insufficient_series_count: 1,
          earliest_date: addDaysIso(yesterday, -149),
          latest_date: yesterday,
          is_stale: false,
          has_sample_data: true,
        },
        pending_uploads: pendingUploads,
        datasets: [
          {
            id: 'demo-audit-1',
            upload_id: 'demo-upload-1',
            file_name: 'DEC_Wholesale_Arrivals_Demo.csv',
            sources: ['DEC wholesale (Demo)'],
            date_from: addDaysIso(yesterday, -149),
            date_until: yesterday,
            row_count: 4520,
            status: 'approved',
            sample_data: true,
            actor_name: 'Demo Admin',
            occurred_at: new Date().toISOString(),
            reason: 'Approved and published 4520 market observation rows',
          },
          {
            id: 'demo-audit-2',
            upload_id: 'demo-upload-2',
            file_name: 'Jaffna_Arrivals_Draft_BadRows.csv',
            sources: ['Jaffna Market'],
            date_from: null,
            date_until: null,
            row_count: 180,
            error_rows: 3,
            status: 'rejected',
            sample_data: false,
            actor_name: 'Demo Admin',
            occurred_at: new Date(Date.now() - 3600 * 1000).toISOString(),
            reason: 'Rejected due to negative price and invalid grade rows',
          },
        ],
        requestId: req.requestId,
      });
    }

    const [obsStats, auditRows] = await Promise.all([
      getAdminObservationStats(),
      getAdminUploadAuditHistory(30),
    ]);

    const totals = obsStats.totals || {};
    const latestDate = formatDateIso(totals.latest_date);
    const earliestDate = formatDateIso(totals.earliest_date);
    const todayIso = getColomboTodayIso();

    let staleSeriesCount = 0;
    let insufficientSeriesCount = 0;
    for (const s of obsStats.series) {
      if (isStaleDate(formatDateIso(s.latest_date), todayIso)) staleSeriesCount += 1;
      if (Number(s.observed_days) < 56) insufficientSeriesCount += 1;
    }

    const datasets = auditRows.map((row) => {
      const details = row.safe_changes || {};
      const status =
        details.status ||
        (row.action === 'market_data.import_committed'
          ? 'approved'
          : row.action === 'market_data.import_rejected'
            ? 'rejected'
            : 'recorded');
      return {
        id: row.id,
        upload_id: row.upload_id,
        file_name: details.file_name || 'Market CSV upload',
        sources: Array.isArray(details.sources) ? details.sources : [],
        date_from: details.date_from || null,
        date_until: details.date_until || null,
        row_count: Number(details.row_count ?? details.total_rows ?? 0),
        error_rows: Number(details.error_rows ?? 0),
        status,
        sample_data: Boolean(details.sample_data),
        actor_name: row.actor_name || 'Admin',
        occurred_at: row.occurred_at ? new Date(row.occurred_at).toISOString() : null,
        reason: row.reason || '',
      };
    });

    const approvedImports = datasets.filter((d) => d.status === 'approved').length;
    const rejectedImports = datasets.filter((d) => d.status === 'rejected').length;
    const globalStale = latestDate ? isStaleDate(latestDate, todayIso) : false;

    return res.json({
      mode: 'live',
      is_demo: Boolean(totals.has_sample_data),
      status: latestDate ? (globalStale ? 'stale' : 'available') : 'empty',
      data_date: latestDate,
      generated_at: new Date().toISOString(),
      summary: {
        approved_imports: approvedImports,
        rejected_imports: rejectedImports,
        total_observations: Number(totals.total_observations || 0),
        active_series_count: Number(totals.active_series_count || 0),
        stale_series_count: staleSeriesCount,
        insufficient_series_count: insufficientSeriesCount,
        earliest_date: earliestDate,
        latest_date: latestDate,
        is_stale: globalStale,
        has_sample_data: Boolean(totals.has_sample_data),
      },
      pending_uploads: pendingUploads,
      datasets,
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/ym29/admin/evaluation (Screen 4 — Admin)
export async function getAdminEvaluation(req, res, next) {
  try {
    const demoMode = isDemoRequested(req);
    const caller = await requireApprovedCaller(req, res, { allowOfflineDemo: demoMode });
    if (!caller) return;

    if (demoMode || caller.offlineDemo) {
      return res.json({
        mode: 'demo',
        ...buildDemoAdminEvaluation(),
        requestId: req.requestId,
      });
    }

    const runs = await getLatestForecastRunsAll();
    if (runs.length === 0) {
      return res.json({
        mode: 'live',
        status: 'service_unavailable',
        is_demo: false,
        published_method: 'none',
        published_method_label: 'Awaiting ML pipeline (Phase 2)',
        model_version: null,
        overall_model_mae_kg: null,
        overall_baseline_mae_kg: null,
        improvement_kg: null,
        evaluation_window: null,
        data_date: null,
        generated_at: new Date().toISOString(),
        by_crop: [],
        coverage: { total_pairs: 0, available_pairs: 0, insufficient_pairs: 0, stale_pairs: 0 },
        requestId: req.requestId,
      });
    }

    const evaluated = runs.map((r) => ({
      crop: r.crop_name,
      district: r.district,
      run: evaluateForecastRun(r, r.crop_name, r.district),
    }));

    const available = evaluated.filter((item) => item.run.status === 'available');
    const insufficientCount = evaluated.filter((item) => item.run.status === 'insufficient_data').length;
    const staleCount = evaluated.filter((item) => item.run.status === 'stale').length;

    const cropMap = new Map();
    for (const item of evaluated) {
      const current = cropMap.get(item.crop) || { modelSum: 0, modelN: 0, baseSum: 0, baseN: 0, method: item.run.method };
      if (item.run.model_mae_kg !== null) {
        current.modelSum += item.run.model_mae_kg;
        current.modelN += 1;
      }
      if (item.run.baseline_mae_kg !== null) {
        current.baseSum += item.run.baseline_mae_kg;
        current.baseN += 1;
      }
      cropMap.set(item.crop, current);
    }

    const byCrop = Array.from(cropMap.entries()).map(([crop, agg]) => ({
      crop,
      model_mae_kg: agg.modelN > 0 ? Math.round((agg.modelSum / agg.modelN) * 100) / 100 : null,
      baseline_mae_kg: agg.baseN > 0 ? Math.round((agg.baseSum / agg.baseN) * 100) / 100 : null,
      published_method: agg.method,
    }));

    const modelValues = evaluated.map((e) => e.run.model_mae_kg).filter((v) => v !== null);
    const baseValues = evaluated.map((e) => e.run.baseline_mae_kg).filter((v) => v !== null);
    const overallModel = modelValues.length > 0 ? Math.round((modelValues.reduce((a, b) => a + b, 0) / modelValues.length) * 100) / 100 : null;
    const overallBase = baseValues.length > 0 ? Math.round((baseValues.reduce((a, b) => a + b, 0) / baseValues.length) * 100) / 100 : null;
    const latestRun = evaluated[0].run;

    return res.json({
      mode: 'live',
      status: available.length > 0 ? 'available' : staleCount > 0 ? 'stale' : 'insufficient_data',
      is_demo: evaluated.some((e) => e.run.is_demo),
      published_method: latestRun.method,
      published_method_label: latestRun.published_method_label,
      model_version: latestRun.model_version,
      overall_model_mae_kg: overallModel,
      overall_baseline_mae_kg: overallBase,
      improvement_kg: overallModel !== null && overallBase !== null ? Math.round((overallBase - overallModel) * 100) / 100 : null,
      evaluation_window:
        latestRun.evaluation_from && latestRun.evaluation_until
          ? `${latestRun.evaluation_from} to ${latestRun.evaluation_until} (14-day holdout)`
          : null,
      data_date: latestRun.data_date,
      generated_at: latestRun.generated_at,
      by_crop: byCrop,
      coverage: {
        total_pairs: evaluated.length,
        available_pairs: available.length,
        insufficient_pairs: insufficientCount,
        stale_pairs: staleCount,
      },
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/ym29/admin/uploads (Screen 5 — parse & validate CSV preview)
export async function uploadMarketCsv(req, res, next) {
  try {
    const caller = await requireApprovedCaller(req, res);
    if (!caller) return;

    const csvText = typeof req.body === 'string' ? req.body : '';
    const rawFileName = String(req.headers['x-file-name'] || req.query.fileName || 'market-upload.csv');
    const safeFileName = rawFileName.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'market-upload.csv';
    const sampleData = String(req.headers['x-sample-data'] || req.query.sampleData || 'false').toLowerCase() === 'true';

    const [crops, grades] = await Promise.all([getActiveCrops(), getActiveGrades()]);
    if (crops.length === 0 || grades.length === 0) {
      return res.status(422).json({
        error: 'Active crops and grades must be seeded in the database before importing market CSVs.',
        requestId: req.requestId,
      });
    }

    const validation = await validateMarketCsv({
      csvText,
      fileName: safeFileName,
      crops,
      grades,
      findExistingKeys: findExistingObservationKeys,
    });

    if (validation.fatalError) {
      return res.status(422).json({
        error: validation.fatalError,
        missing_columns: validation.missingColumns || undefined,
        requestId: req.requestId,
      });
    }

    const staged = createStagedUpload({
      uploadedBy: caller.id,
      uploadedByName: caller.name,
      fileName: safeFileName,
      fileSizeBytes: Buffer.byteLength(csvText, 'utf8'),
      sampleData,
      validation,
    });

    return res.status(201).json({
      upload: serializeUploadDetail(staged),
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/ym29/admin/uploads/:id (Screen 5 — retrieve staged preview)
export async function getUploadReview(req, res, next) {
  try {
    const caller = await requireApprovedCaller(req, res);
    if (!caller) return;

    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid upload ID', requestId: req.requestId });
    }

    const staged = getStagedUpload(id);
    if (!staged) {
      return res.status(404).json({
        error: 'Upload preview not found or expired. Please upload the CSV again.',
        requestId: req.requestId,
      });
    }

    return res.json({
      upload: serializeUploadDetail(staged),
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/ym29/admin/uploads/:id/commit (Screen 5 — approve & publish)
export async function commitUpload(req, res, next) {
  try {
    const caller = await requireApprovedCaller(req, res);
    if (!caller) return;

    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid upload ID', requestId: req.requestId });
    }

    const staged = getStagedUpload(id);
    if (!staged) {
      return res.status(404).json({
        error: 'Upload preview not found or expired. Please upload the CSV again.',
        requestId: req.requestId,
      });
    }

    if (staged.status !== 'pending_review') {
      return res.status(409).json({
        error: `Upload is already ${staged.status} and cannot be committed again.`,
        requestId: req.requestId,
      });
    }

    // Whole-file rejection safeguard enforced server-side
    if (staged.errorCount > 0 || staged.validatedRows.length === 0) {
      return res.status(422).json({
        error: `Cannot publish dataset: ${staged.errorCount} row error(s) must be fixed and re-uploaded (whole-file validation policy).`,
        error_rows: staged.errorCount,
        requestId: req.requestId,
      });
    }

    try {
      const result = await commitMarketUpload({
        uploadId: staged.id,
        rows: staged.validatedRows,
        importedBy: caller.id,
        sampleData: staged.sampleData,
        fileName: staged.fileName,
        checksum: staged.checksum,
        dateRange: staged.dateRange,
        sources: staged.sources,
        crops: staged.crops,
        districts: staged.districts,
        requestId: req.requestId,
      });

      const updated = markUploadCommitted(staged.id, caller.id);
      return res.json({
        message: `Published ${result.insertedCount} market observation rows.`,
        inserted_count: result.insertedCount,
        upload: serializeUploadSummary(updated),
        requestId: req.requestId,
      });
    } catch (dbErr) {
      if (dbErr.code === 'YM29_DUPLICATE_CONFLICT' || dbErr.code === '23505') {
        return res.status(409).json({
          error: dbErr.message || 'Commit rejected: one or more rows already exist in market_observations.',
          requestId: req.requestId,
        });
      }
      throw dbErr;
    }
  } catch (error) {
    next(error);
  }
}

// POST /api/ym29/admin/uploads/:id/reject (Screen 5 — reject staged dataset)
export async function rejectUpload(req, res, next) {
  try {
    const caller = await requireApprovedCaller(req, res);
    if (!caller) return;

    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Invalid upload ID', requestId: req.requestId });
    }

    const staged = getStagedUpload(id);
    if (!staged) {
      return res.status(404).json({
        error: 'Upload preview not found or expired.',
        requestId: req.requestId,
      });
    }

    if (staged.status !== 'pending_review') {
      return res.status(409).json({
        error: `Upload is already ${staged.status}.`,
        requestId: req.requestId,
      });
    }

    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < 3 || reason.length > 300) {
      return res.status(400).json({
        error: 'A rejection reason (3 to 300 characters) is required for the audit log.',
        requestId: req.requestId,
      });
    }

    await recordUploadRejection({
      uploadId: staged.id,
      actorId: caller.id,
      reason,
      metadata: staged,
      requestId: req.requestId,
    });

    const updated = markUploadRejected(staged.id, caller.id, reason);
    return res.json({
      message: 'Dataset upload rejected and recorded in audit log.',
      upload: serializeUploadSummary(updated),
      requestId: req.requestId,
    });
  } catch (error) {
    next(error);
  }
}
