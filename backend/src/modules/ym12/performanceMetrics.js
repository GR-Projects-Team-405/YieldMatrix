export function calculatePerformanceMetrics(completedOrdersValue, confirmedOrdersValue) {
  const completed = BigInt(String(completedOrdersValue ?? 0));
  const confirmed = BigInt(String(confirmedOrdersValue ?? 0));
  if (confirmed === 0n) {
    return {
      completedOrders: completed > 0n ? Number(completed) : null,
      fulfilmentRatePercent: null,
      fulfilmentLabel: null,
      insufficientHistory: true,
    };
  }
  const roundedPercent = (completed * 100n + confirmed / 2n) / confirmed;
  return {
    completedOrders: Number(completed),
    fulfilmentRatePercent: Number(roundedPercent),
    fulfilmentLabel: `${completed.toString()} / ${confirmed.toString()} confirmed orders`,
    insufficientHistory: false,
  };
}
