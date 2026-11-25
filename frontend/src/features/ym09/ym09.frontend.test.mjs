import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from '../../../node_modules/esbuild/lib/main.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bundleOutFile = '/tmp/ym09-frontend-test-bundle.mjs';

const entrySource = `
  export * as React from 'react';
  export { renderToStaticMarkup } from 'react-dom/server';
  export { MemoryRouter } from 'react-router-dom';
  export * as constants from ${JSON.stringify(path.join(__dirname, 'constants/produceConstants.ts'))};
  export * as formatters from ${JSON.stringify(path.join(__dirname, 'utils/produceFormatters.ts'))};
  export * as defaults from ${JSON.stringify(path.join(__dirname, 'utils/produceFormDefaults.ts'))};
  export * as validation from ${JSON.stringify(path.join(__dirname, 'utils/produceFormValidation.ts'))};
  export * as chartUtils from ${JSON.stringify(path.join(__dirname, 'utils/priceChartUtils.ts'))};
  export * as depsApi from ${JSON.stringify(path.join(__dirname, 'services/produceDependenciesApi.ts'))};
  export * as produceApi from ${JSON.stringify(path.join(__dirname, 'services/produceApi.ts'))};
  export { OverviewTab } from ${JSON.stringify(path.join(__dirname, 'components/details/OverviewTab.tsx'))};
  export { ProduceSummaryCard } from ${JSON.stringify(path.join(__dirname, 'components/details/ProduceSummaryCard.tsx'))};
  export { ProduceInformationForm } from ${JSON.stringify(path.join(__dirname, 'components/add-produce/ProduceInformationForm.tsx'))};
  export { default as apiClient } from ${JSON.stringify(path.resolve(__dirname, '../../services/api.ts'))};
`;

esbuild.buildSync({
  stdin: {
    contents: entrySource,
    resolveDir: __dirname,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'node22',
  outfile: bundleOutFile,
  define: {
    'import.meta.env': '{}',
  },
});

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
}

const ym09 = await import(`${pathToFileURL(bundleOutFile).href}?t=${Date.now()}`);

function renderDetailsElement(component, props) {
  return ym09.renderToStaticMarkup(
    ym09.React.createElement(
      ym09.MemoryRouter,
      null,
      ym09.React.createElement(component, props)
    )
  );
}

test('YM09 defaults to live API mode, removes DEV_SAMPLE_PRODUCE/DEV_SAMPLE_SUMMARY, and retains Add Produce sample batches', () => {
  assert.equal(ym09.constants.ENABLE_DEV_SAMPLE_DATA, false);
  assert.equal(ym09.constants.IMAGE_UNAVAILABLE_MESSAGE, 'Image cannot be shown');
  assert.equal('PRODUCE_PLACEHOLDERS' in ym09.constants, false);
  assert.equal('getPlaceholderImageForCategory' in ym09.constants, false);
  assert.equal('DEV_SAMPLE_PRODUCE' in ym09.constants, false);
  assert.equal('DEV_SAMPLE_SUMMARY' in ym09.constants, false);
  assert.ok(Array.isArray(ym09.constants.SAMPLE_HARVEST_BATCHES));
  assert.ok(ym09.constants.SAMPLE_HARVEST_BATCHES.length > 0);

  assert.deepEqual(
    ym09.constants.getAvailableListingStatusActions('active', 'Tomato').map((a) => ({
      target: a.targetStatus,
      label: a.label,
    })),
    [
      { target: 'paused', label: 'Pause listing' },
      { target: 'closed', label: 'Archive listing' },
    ]
  );
  assert.deepEqual(
    ym09.constants.getAvailableListingStatusActions('paused', 'Tomato').map((a) => ({
      target: a.targetStatus,
      label: a.label,
    })),
    [
      { target: 'active', label: 'Resume listing' },
      { target: 'closed', label: 'Archive listing' },
    ]
  );
  assert.deepEqual(
    ym09.constants.getAvailableListingStatusActions('draft', 'Tomato').map((a) => ({
      target: a.targetStatus,
      label: a.label,
    })),
    [
      { target: 'active', label: 'Activate listing' },
      { target: 'closed', label: 'Archive listing' },
    ]
  );
  assert.deepEqual(
    ym09.constants.getAvailableListingStatusActions('expired', 'Tomato').map((a) => ({
      target: a.targetStatus,
      label: a.label,
    })),
    [{ target: 'closed', label: 'Archive listing' }]
  );
  assert.deepEqual(
    ym09.constants.getAvailableListingStatusActions('closed', 'Tomato'),
    []
  );
});

test('YM09 Details components render all action buttons, remove Description section, and show Image cannot be shown', () => {
  const detailListing = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    batchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    batchNumber: 'HB-2026-001',
    cropName: 'Tomato',
    category: 'Vegetables',
    gradeName: 'Grade A',
    farmId: 'f1111111-1111-1111-1111-111111111111',
    farmName: 'GreenField Farm',
    district: 'Nuwara Eliya',
    unitPriceCents: 32000,
    offeredKg: 120,
    availableKg: 80,
    reservedKg: 40,
    committedKg: 20,
    status: 'active',
    validFrom: '2026-11-15T00:00:00Z',
    validUntil: '2026-11-30T23:59:59Z',
    createdAt: '2026-11-15T08:30:00Z',
    updatedAt: '2026-11-16T10:00:00Z',
    allocations: [],
    orders: [],
    priceHistory: [],
    priceTrend: [],
    activityLog: [],
  };

  // OverviewTab renders Listing Information cleanly with zero Description section
  const overviewHtml = renderDetailsElement(ym09.OverviewTab, { listing: detailListing });
  assert.match(overviewHtml, /Listing Information/);
  assert.match(overviewHtml, /Tomato/);
  assert.match(overviewHtml, /HB-2026-001/);
  assert.equal(/No description provided for this listing/i.test(overviewHtml), false);
  assert.equal(/listing-desc-title/.test(overviewHtml), false);
  assert.equal(/ym09-description-/.test(overviewHtml), false);

  // ProduceSummaryCard (active) renders all 3 visible action buttons + image fallback
  const activeSummaryHtml = renderDetailsElement(ym09.ProduceSummaryCard, {
    listing: detailListing,
  });
  assert.match(activeSummaryHtml, /Edit Listing/);
  assert.match(activeSummaryHtml, /Pause listing/);
  assert.match(activeSummaryHtml, /Archive listing/);
  assert.match(activeSummaryHtml, /Image cannot be shown/);

  // ProduceSummaryCard (paused) switches Pause -> Resume while keeping Edit & Archive visible
  const pausedSummaryHtml = renderDetailsElement(ym09.ProduceSummaryCard, {
    listing: { ...detailListing, status: 'paused' },
  });
  assert.match(pausedSummaryHtml, /Edit Listing/);
  assert.match(pausedSummaryHtml, /Resume listing/);
  assert.match(pausedSummaryHtml, /Archive listing/);

  // ProduceSummaryCard (draft) displays Activate listing + Archive listing + Edit Listing
  const draftSummaryHtml = renderDetailsElement(ym09.ProduceSummaryCard, {
    listing: { ...detailListing, status: 'draft' },
  });
  assert.match(draftSummaryHtml, /Edit Listing/);
  assert.match(draftSummaryHtml, /Activate listing/);
  assert.match(draftSummaryHtml, /Archive listing/);

  // ProduceSummaryCard (closed) prevents invalid Pause/Activate/Archive buttons
  const closedSummaryHtml = renderDetailsElement(ym09.ProduceSummaryCard, {
    listing: { ...detailListing, status: 'closed' },
  });
  assert.match(closedSummaryHtml, /Edit Listing/);
  assert.equal(/Pause listing|Resume listing|Activate listing|Archive listing/.test(closedSummaryHtml), false);
});

test('YM09 form validation & defaults enforce edit source lock, stock precision, and clean mapping', () => {
  const emptyDefaults = ym09.defaults.createDefaultProduceFormState([]);
  assert.equal(emptyDefaults.totalQuantity, '');
  assert.equal(emptyDefaults.unitPrice, '');
  assert.equal(emptyDefaults.status, 'active');
  assert.equal(emptyDefaults.cropId, '');
  assert.equal(emptyDefaults.gradeId, '');

  const listing = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    batchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    batchNumber: 'HB-BBBBBBBB',
    cropName: 'Tomato',
    category: 'Vegetables',
    gradeName: 'Grade A',
    farmId: 'f1111111-1111-1111-1111-111111111111',
    farmName: 'Green Valley Farm',
    district: 'Nuwara Eliya',
    unitPriceCents: 32050,
    offeredKg: 100,
    availableKg: 60,
    reservedKg: 40,
    committedKg: 20,
    sellableKg: 120,
    status: 'active',
    validFrom: '2026-11-15T00:00:00Z',
    validUntil: '2026-11-30T23:59:59Z',
    createdAt: '2026-11-15T08:00:00Z',
  };

  const unencumberedEditLock = ym09.validation.getHarvestSourceLockState('edit', {
    ...listing,
    reservedKg: 0,
    committedKg: 0,
  });
  assert.equal(unencumberedEditLock.isSourceLocked, true);

  const editBounds = ym09.validation.calculateStockValidationBounds({
    mode: 'edit',
    existingListing: listing,
    activeHolds: 40,
  });
  assert.equal(editBounds.minAvailableKg, 40);
  assert.equal(editBounds.maxAvailableKg, 120);

  const mappedEdit = ym09.defaults.mapListingToFormState(listing);
  assert.equal(mappedEdit.batchNumber, 'HB-BBBBBBBB');
  assert.equal(mappedEdit.unitPrice, 320.5);
  assert.equal(mappedEdit.availableFrom, '2026-11-15');
  assert.equal(mappedEdit.availableUntil, '2026-11-30');

  assert.deepEqual(
    ym09.validation.validateProduceListingForm(mappedEdit, editBounds, 'edit'),
    {}
  );

  const badPrecisionErrors = ym09.validation.validateProduceListingForm(
    { ...mappedEdit, totalQuantity: 45.1234, unitPrice: 320.123, availableUntil: '2026-11-10' },
    editBounds,
    'edit'
  );
  assert.match(badPrecisionErrors.totalQuantity, /3 decimal/i);
  assert.match(badPrecisionErrors.unitPrice, /2 decimal/i);
  assert.match(badPrecisionErrors.availableUntil, /earlier than start date/i);

  assert.equal(ym09.formatters.formatLkrTotal(32050), 'LKR 320.50');
  assert.equal(ym09.chartUtils.formatCompactLkrRate(32050), 'LKR 320.50 / kg');
});

test('YM09 dependency adapter stays pending in live mode and renders explicit preview indicator when sample batches are enabled', async () => {
  const liveFarms = await ym09.depsApi.fetchFarmerFarms({ useSampleData: false });
  assert.equal(liveFarms.status, 'pending');
  assert.equal(liveFarms.isSampleData, false);
  assert.deepEqual(liveFarms.items, []);

  const liveBatches = await ym09.depsApi.fetchEligibleHarvestBatches({ useSampleData: false });
  assert.equal(liveBatches.status, 'pending');
  assert.equal(liveBatches.isSampleData, false);
  assert.deepEqual(liveBatches.items, []);

  const sampleBatches = await ym09.depsApi.fetchEligibleHarvestBatches({ useSampleData: true });
  assert.equal(sampleBatches.status, 'ready');
  assert.equal(sampleBatches.isSampleData, true);
  assert.ok(sampleBatches.items.length > 0);
  assert.ok(
    sampleBatches.items
      .filter((b) => ym09.depsApi.isEligibleCreateBatch(b))
      .every((b) => b.status === 'harvested' && b.availableStockKg > 0 && !b.hasActiveListing)
  );

  const emptyDefaults = ym09.defaults.createDefaultProduceFormState([]);
  const livePendingFormHtml = renderDetailsElement(ym09.ProduceInformationForm, {
    mode: 'create',
    formState: emptyDefaults,
    errors: {},
    farms: [],
    harvestBatches: [],
    dependencyNotice: liveBatches.message,
    isSamplePreview: false,
    onFarmChange: () => {},
    onBatchChange: () => {},
  });
  assert.equal(/DEVELOPMENT PREVIEW/.test(livePendingFormHtml), false);
  assert.match(livePendingFormHtml, /External Module Integration Pending/);

  const samplePreviewFormHtml = renderDetailsElement(ym09.ProduceInformationForm, {
    mode: 'create',
    formState: emptyDefaults,
    errors: {},
    farms: [],
    harvestBatches: sampleBatches.items,
    isSamplePreview: true,
    onFarmChange: () => {},
    onBatchChange: () => {},
  });
  assert.match(samplePreviewFormHtml, /DEVELOPMENT PREVIEW:/);
  assert.match(samplePreviewFormHtml, /not real database records/i);
});

test('YM09 API client calls real backend endpoints, unwraps DTOs, handles status/error paths, never fabricates chart points', async () => {
  const originalAdapter = ym09.apiClient.defaults.adapter;
  const capturedRequests = [];

  try {
    ym09.apiClient.defaults.adapter = async (config) => {
      capturedRequests.push({
        method: config.method,
        url: config.url,
        data: config.data ? JSON.parse(config.data) : undefined,
      });

      if (config.url === '/ym09/produce' && config.method === 'get') {
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: {
            success: true,
            total: 1,
            data: [
              {
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                batchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                cropName: 'Tomato',
                gradeName: 'Grade A',
                farmId: 'f1111111-1111-1111-1111-111111111111',
                farmName: 'GreenField Farm',
                district: 'Nuwara Eliya',
                unitPriceCents: 32000,
                offeredKg: 100,
                availableKg: 80,
                reservedKg: 20,
                committedKg: 10,
                status: 'active',
                validFrom: '2026-11-15T00:00:00Z',
                validUntil: '2026-11-30T23:59:59Z',
                createdAt: '2026-11-15T08:00:00Z',
              },
            ],
          },
        };
      }

      if (config.url === '/ym09/produce/not-found' && config.method === 'get') {
        const err = new Error('Not found');
        err.isAxiosError = true;
        err.response = { status: 404, data: { error: 'Produce listing not found' } };
        throw err;
      }

      if (config.url === '/ym09/produce/forbidden' && config.method === 'get') {
        const err = new Error('Forbidden');
        err.isAxiosError = true;
        err.response = { status: 403, data: { error: 'Account is pending approval' } };
        throw err;
      }

      if (config.url === '/ym09/produce' && config.method === 'post') {
        return {
          status: 201,
          statusText: 'Created',
          headers: {},
          config,
          data: {
            success: true,
            data: {
              id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              batchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              cropName: 'Carrot',
              gradeName: 'Grade A',
              farmId: 'f1111111-1111-1111-1111-111111111111',
              farmName: 'GreenField Farm',
              district: 'Nuwara Eliya',
              unitPriceCents: 28000,
              offeredKg: 50,
              availableKg: 50,
              reservedKg: 0,
              committedKg: 0,
              status: 'draft',
              validFrom: '2026-11-20T00:00:00Z',
              validUntil: '2026-11-25T23:59:59Z',
              createdAt: '2026-11-20T09:00:00Z',
            },
          },
        };
      }

      if (config.url === '/ym09/produce/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/status' && config.method === 'patch') {
        const requestedStatus = JSON.parse(config.data).status;
        if (requestedStatus === 'expired') {
          const err = new Error('Conflict');
          err.isAxiosError = true;
          err.response = { status: 409, data: { error: 'Invalid listing status transition' } };
          throw err;
        }
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: {
            success: true,
            data: {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              batchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              offeredKg: 100,
              unitPriceCents: 32000,
              status: requestedStatus,
              validFrom: '2026-11-15T00:00:00Z',
              validUntil: '2026-11-30T23:59:59Z',
              createdAt: '2026-11-15T08:00:00Z',
            },
          },
        };
      }

      if (config.url === '/ym09/produce/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/details' && config.method === 'get') {
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: {
            success: true,
            data: {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              batchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              batchNumber: 'HB-BBBBBBBB',
              cropName: 'Tomato',
              gradeName: 'Grade A',
              farmId: 'f1111111-1111-1111-1111-111111111111',
              farmName: 'GreenField Farm',
              district: 'Nuwara Eliya',
              unitPriceCents: 32000,
              offeredKg: 100,
              availableKg: 80,
              reservedKg: 20,
              committedKg: 10,
              status: 'active',
              validFrom: '2026-11-15T00:00:00Z',
              validUntil: '2026-11-30T23:59:59Z',
              createdAt: '2026-11-15T08:00:00Z',
              allocations: [],
              orders: [],
              priceTrend: [],
              priceHistory: [],
              activityLog: [],
            },
          },
        };
      }

      throw new Error(`Unexpected test request: ${config.method} ${config.url}`);
    };

    const listRes = await ym09.produceApi.fetchMyProduce({
      search: '',
      category: 'All',
      status: 'all',
      farm: 'all',
      viewMode: 'grid',
      page: 1,
      pageSize: 8,
    });
    assert.equal('isSampleData' in listRes, false);
    assert.equal(listRes.listings[0].imageUrl, undefined);
    assert.equal(listRes.summary.activeListingsCount, 1);

    // Failed live list call must propagate API error cleanly and never silently substitute sample data
    ym09.apiClient.defaults.adapter = async () => {
      const err = new Error('Server error');
      err.isAxiosError = true;
      err.response = { status: 500, data: { error: 'Database unavailable' } };
      throw err;
    };
    await assert.rejects(
      () =>
        ym09.produceApi.fetchMyProduce({
          search: '',
          category: 'All',
          status: 'all',
          farm: 'all',
          viewMode: 'grid',
          page: 1,
          pageSize: 8,
        }),
      /Database unavailable/
    );

    // Restore mock adapter for remaining endpoint assertions
    ym09.apiClient.defaults.adapter = async (config) => {
      capturedRequests.push({
        method: config.method,
        url: config.url,
        data: config.data ? JSON.parse(config.data) : undefined,
      });
      if (config.url === '/ym09/produce/not-found' && config.method === 'get') {
        const err = new Error('Not found');
        err.isAxiosError = true;
        err.response = { status: 404, data: { error: 'Produce listing not found' } };
        throw err;
      }
      if (config.url === '/ym09/produce/forbidden' && config.method === 'get') {
        const err = new Error('Forbidden');
        err.isAxiosError = true;
        err.response = { status: 403, data: { error: 'Account is pending approval' } };
        throw err;
      }
      if (config.url === '/ym09/produce' && config.method === 'post') {
        return {
          status: 201,
          statusText: 'Created',
          headers: {},
          config,
          data: {
            success: true,
            data: {
              id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              batchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              cropName: 'Carrot',
              gradeName: 'Grade A',
              farmId: 'f1111111-1111-1111-1111-111111111111',
              farmName: 'GreenField Farm',
              district: 'Nuwara Eliya',
              unitPriceCents: 28000,
              offeredKg: 50,
              availableKg: 50,
              reservedKg: 0,
              committedKg: 0,
              status: 'draft',
              validFrom: '2026-11-20T00:00:00Z',
              validUntil: '2026-11-25T23:59:59Z',
              createdAt: '2026-11-20T09:00:00Z',
            },
          },
        };
      }
      if (config.url === '/ym09/produce/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/status' && config.method === 'patch') {
        const requestedStatus = JSON.parse(config.data).status;
        if (requestedStatus === 'expired') {
          const err = new Error('Conflict');
          err.isAxiosError = true;
          err.response = { status: 409, data: { error: 'Invalid listing status transition' } };
          throw err;
        }
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: {
            success: true,
            data: {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              batchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              offeredKg: 100,
              unitPriceCents: 32000,
              status: requestedStatus,
              validFrom: '2026-11-15T00:00:00Z',
              validUntil: '2026-11-30T23:59:59Z',
              createdAt: '2026-11-15T08:00:00Z',
            },
          },
        };
      }
      if (config.url === '/ym09/produce/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/details' && config.method === 'get') {
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          data: {
            success: true,
            data: {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              batchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              batchNumber: 'HB-BBBBBBBB',
              cropName: 'Tomato',
              gradeName: 'Grade A',
              farmId: 'f1111111-1111-1111-1111-111111111111',
              farmName: 'GreenField Farm',
              district: 'Nuwara Eliya',
              unitPriceCents: 32000,
              offeredKg: 100,
              availableKg: 80,
              reservedKg: 20,
              committedKg: 10,
              status: 'active',
              validFrom: '2026-11-15T00:00:00Z',
              validUntil: '2026-11-30T23:59:59Z',
              createdAt: '2026-11-15T08:00:00Z',
              allocations: [],
              orders: [],
              priceTrend: [],
              priceHistory: [],
              activityLog: [],
            },
          },
        };
      }
      throw new Error(`Unexpected test request: ${config.method} ${config.url}`);
    };

    assert.equal(await ym09.produceApi.getProduceListingById('not-found'), null);
    await assert.rejects(
      () => ym09.produceApi.getProduceListingById('forbidden'),
      /Account is pending approval/
    );

    const created = await ym09.produceApi.createProduceListing({
      farmId: 'f1111111-1111-1111-1111-111111111111',
      farmName: 'GreenField Farm',
      cropId: 'c1',
      cropName: 'Carrot',
      category: 'Vegetables',
      batchId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      batchNumber: 'HB-1',
      gradeId: 'g1',
      gradeName: 'Grade A',
      totalQuantity: 50,
      unitPrice: 280,
      availableFrom: '2026-11-20',
      availableUntil: '2026-11-25',
      status: 'draft',
    });
    assert.equal(created.status, 'draft');
    const postReq = capturedRequests.find((r) => r.method === 'post');
    assert.equal(postReq.data.validFrom, '2026-11-20T00:00:00Z');
    assert.equal(postReq.data.validUntil, '2026-11-25T23:59:59Z');
    assert.equal(postReq.data.unitPriceCents, 28000);
    assert.equal(postReq.data.status, 'draft');

    // Pause, archive, and backend conflict error extraction
    const paused = await ym09.produceApi.updateProduceListingStatus(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'paused'
    );
    assert.equal(paused.status, 'paused');

    const archived = await ym09.produceApi.updateProduceListingStatus(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'closed'
    );
    assert.equal(archived.status, 'closed');

    await assert.rejects(
      () =>
        ym09.produceApi.updateProduceListingStatus(
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          'expired'
        ),
      /Invalid listing status transition/
    );

    const details = await ym09.produceApi.getProduceListingDetails(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    );
    assert.equal(details.imageUrl, undefined);
    assert.equal('description' in details, false);
    const preparedChart = ym09.chartUtils.preparePriceChartData(
      details.priceTrend,
      details.priceHistory,
      'all'
    );
    assert.equal(preparedChart.source, 'none');
    assert.deepEqual(preparedChart.points, []);
  } finally {
    ym09.apiClient.defaults.adapter = originalAdapter;
  }
});
