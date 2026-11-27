export function rankListings(listings) {
  return [...listings].sort((left, right) => {
    const leftPrice = BigInt(String(left.pricePerKgCents));
    const rightPrice = BigInt(String(right.pricePerKgCents));
    if (leftPrice < rightPrice) return -1;
    if (leftPrice > rightPrice) return 1;
    if (left.distanceKm === null && right.distanceKm !== null) return 1;
    if (left.distanceKm !== null && right.distanceKm === null) return -1;
    if (left.distanceKm !== null && right.distanceKm !== null && left.distanceKm !== right.distanceKm) {
      return left.distanceKm - right.distanceKm;
    }
    const leftId = left.listingId.toLowerCase();
    const rightId = right.listingId.toLowerCase();
    if (leftId < rightId) return -1;
    if (leftId > rightId) return 1;
    return 0;
  });
}
