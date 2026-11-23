export const INSUFFICIENT_MIN_CONFIRMED_ORDERS = 5;

function toSafeCount(value) {
  const count = BigInt(String(value));
  const converted = Number(count);
  if (!Number.isSafeInteger(converted)) throw new RangeError('Performance count exceeds the safe integer range.');
  return converted;
}

export function calculateRateMetric(numeratorValue, denominatorValue, decimalPlaces = 0) {
  if (numeratorValue === null || numeratorValue === undefined
    || denominatorValue === null || denominatorValue === undefined) {
    return { percent: null, numerator: null, denominator: null };
  }
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 3) {
    throw new RangeError('Rate precision must be an integer between zero and three.');
  }

  const numerator = BigInt(String(numeratorValue));
  const denominator = BigInt(String(denominatorValue));
  const result = {
    percent: null,
    numerator: toSafeCount(numerator),
    denominator: toSafeCount(denominator),
  };
  if (denominator === 0n) return result;

  const scale = 10n ** BigInt(decimalPlaces);
  const rounded = (numerator * 100n * scale + denominator / 2n) / denominator;
  result.percent = Number(rounded) / Number(scale);
  return result;
}

export function calculatePerformanceMetrics(completedOrdersValue, confirmedOrdersValue) {
  const completed = BigInt(String(completedOrdersValue ?? 0));
  const confirmed = BigInt(String(confirmedOrdersValue ?? 0));
  if (confirmed < BigInt(INSUFFICIENT_MIN_CONFIRMED_ORDERS)) {
    return {
      completedOrders: completed > 0n ? toSafeCount(completed) : null,
      fulfilmentRatePercent: null,
      fulfilmentLabel: null,
      insufficientHistory: true,
    };
  }
  const roundedPercent = (completed * 100n + confirmed / 2n) / confirmed;
  return {
    completedOrders: toSafeCount(completed),
    fulfilmentRatePercent: Number(roundedPercent),
    fulfilmentLabel: `${completed.toString()} / ${confirmed.toString()} confirmed orders`,
    insufficientHistory: false,
  };
}
