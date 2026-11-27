const DISTANCE_KM = new Map([
  ['Colombo|Dambulla', 88],
  ['Colombo|Matale', 110],
]);

export function getDistanceKm(fromDistrict, toDistrict) {
  if (!fromDistrict || !toDistrict) return null;
  return DISTANCE_KM.get(`${fromDistrict.trim()}|${toDistrict.trim()}`) ?? null;
}
