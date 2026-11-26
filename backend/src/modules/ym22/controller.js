import pool from '../../config/db.js';

const demoDriverId = '33333333-3333-3333-3333-333333333333';
const demoStopDetails = {
  '00000000-0000-4000-8000-000000010042': { crop:'Tomato', grade:'A', phone:'077 245 1180', latitude:7.019, longitude:79.972, distanceFromPreviousKm:6.2 },
  '00000000-0000-4000-8000-000000010043': { crop:'Tomato', grade:'A', phone:'071 330 8842', latitude:6.976, longitude:79.918, distanceFromPreviousKm:8.4 },
  '00000000-0000-4000-8000-000000010044': { crop:'Tomato', grade:'A', phone:'076 518 2290', latitude:null, longitude:null, schematicLatitude:7.083, schematicLongitude:79.89, distanceFromPreviousKm:11.8 },
};
const sampleTrips = [
  { id:'00000000-0000-4000-8000-000000001039', reference:'YM 1039', orderReference:'YM 1039', destination:'Green Basket', destinationDistrict:'Gampaha', scheduledStart:'2026-11-08T08:00:00+05:30', scheduledEnd:'2026-11-08T13:30:00+05:30', capacityKg:1200, plannedLoadKg:600, status:'in_progress', vehicle:'WP LO 4811', stops:[['00000000-0000-4000-8000-000000010039','Green Valley Farm','Demo Farmer','Gampaha','Demo pickup location, Gampaha','2026-11-08T08:00:00+05:30','picked_up',380],['00000000-0000-4000-8000-000000010040','Highland Harvest','Demo Farmer','Gampaha','Demo pickup location, Gampaha','2026-11-08T09:30:00+05:30','pending',220]] },
  { id:'00000000-0000-4000-8000-000000001042', reference:'YM 1042', orderReference:'YM 1042', destination:'FreshMart DC', destinationDistrict:'Colombo 10', destinationLatitude:6.9271, destinationLongitude:79.8612, buyerName:'FreshMart Distribution Centre', buyerDistrict:'Colombo 10', buyerPhone:'011 269 4410', orderDescription:'3 growers', scheduledStart:'2026-11-09T09:10:00+05:30', scheduledEnd:'2026-11-09T14:00:00+05:30', plannedArrivalAt:'2026-11-09T13:15:00+05:30', deliveryWindowStart:'13:00', deliveryWindowEnd:'14:00', routingMethod:'nearest_next_stop', routeNotes:'Driver base · Kadawatha', plannedDistanceKm:48.6, plannedDistanceIsApproximate:true, assignedAt:'2026-11-07T20:05:00+05:30', capacityKg:1500, plannedLoadKg:1000, status:'assigned', vehicle:'WP LO 4811 · light goods vehicle', stops:[['00000000-0000-4000-8000-000000010042','Green Valley Farm','Sunil Perera','Kadawatha, Gampaha','Green Valley Farm · Kadawatha, Gampaha · AL 1042-01','2026-11-09T09:30:00+05:30','pending',400],['00000000-0000-4000-8000-000000010043','Highland Harvest','Nadeesha Silva','Kiribathgoda, Gampaha','Highland Harvest · Kiribathgoda, Gampaha · AL 1042-02','2026-11-09T11:00:00+05:30','pending',350],['00000000-0000-4000-8000-000000010044','Sunrise Organics','Kamal Fernando','Ja-Ela, Gampaha','Sunrise Organics · Ja-Ela, Gampaha · AL 1042-03','2026-11-09T12:00:00+05:30','pending',250]] },
  { id:'00000000-0000-4000-8000-000000001043', reference:'YM 1043', orderReference:'YM 1043', destination:'Highland Grocers', destinationDistrict:'Kandy', scheduledStart:'2026-11-10T07:00:00+05:30', scheduledEnd:'2026-11-10T12:00:00+05:30', capacityKg:1500, plannedLoadKg:750, status:'assigned', vehicle:'WP LO 4811', stops:[['00000000-0000-4000-8000-000000010045','Green Valley Farm','Demo Farmer','Kandy','Demo pickup location, Nuwara Eliya','2026-11-10T07:00:00+05:30','pending',450],['00000000-0000-4000-8000-000000010046','Hilltop Produce','Demo Farmer','Kandy','Demo pickup location, Nuwara Eliya','2026-11-10T08:30:00+05:30','pending',300]] },
  { id:'00000000-0000-4000-8000-000000001035', reference:'YM 1035', orderReference:'YM 1035', destination:'City Fresh', destinationDistrict:'Negombo', scheduledStart:'2026-11-05T08:30:00+05:30', scheduledEnd:'2026-11-05T13:00:00+05:30', capacityKg:1600, plannedLoadKg:820, status:'completed', vehicle:'WP LO 4811', stops:[['00000000-0000-4000-8000-000000010035','Green Valley Farm','Demo Farmer','Negombo','Demo pickup location, Nuwara Eliya','2026-11-05T08:30:00+05:30','picked_up',500],['00000000-0000-4000-8000-000000010036','Highland Harvest','Demo Farmer','Negombo','Demo pickup location, Nuwara Eliya','2026-11-05T10:00:00+05:30','picked_up',320]] },
  { id:'00000000-0000-4000-8000-000000001031', reference:'YM 1031', orderReference:'YM 1031', destination:'FreshMart DC', destinationDistrict:'Colombo', scheduledStart:'2026-11-03T09:00:00+05:30', scheduledEnd:'2026-11-03T12:30:00+05:30', capacityKg:1800, plannedLoadKg:1200, status:'completed', vehicle:'WP LO 4811', stops:[['00000000-0000-4000-8000-000000010031','Green Valley Farm','Demo Farmer','Colombo','Demo pickup location, Nuwara Eliya','2026-11-03T09:00:00+05:30','picked_up',500],['00000000-0000-4000-8000-000000010032','Highland Harvest','Demo Farmer','Colombo','Demo pickup location, Nuwara Eliya','2026-11-03T10:00:00+05:30','picked_up',400],['00000000-0000-4000-8000-000000010033','Sunrise Organics','Demo Farmer','Colombo','Demo pickup location, Nuwara Eliya','2026-11-03T11:00:00+05:30','picked_up',300]] },
].map((trip) => ({ ...trip, ...(trip.reference==='YM 1042'?{startLocation:'Base · Kadawatha',startLatitude:7.03,startLongitude:79.98,estimatedDriveMinutes:115,routeLegs:[{sequence:1,from:'Base · Kadawatha',to:'Green Valley Farm',distanceKm:6.2,durationMinutes:15,arriveAt:'09:30',approximate:false},{sequence:2,from:'Green Valley Farm',to:'Highland Harvest',distanceKm:8.4,durationMinutes:25,arriveAt:'11:00',approximate:false},{sequence:3,from:'Highland Harvest',to:'Sunrise Organics',distanceKm:11.8,durationMinutes:30,arriveAt:'12:00',approximate:true},{sequence:4,from:'Sunrise Organics',to:'FreshMart DC',distanceKm:22.2,durationMinutes:45,arriveAt:'13:15',approximate:false}],beforeYouGo:['Weighing scale on board · record actual kg at every stop.','Highland Harvest: use the side gate off Kandy Road (farm note).'],sampleWeather:'Light showers after 14:00. Context only; it does not change the route.'}:{}), buyerName:trip.buyerName||trip.destination, buyerDistrict:trip.buyerDistrict||trip.destinationDistrict, buyerPhone:trip.buyerPhone||null, orderDescription:trip.orderDescription||`${trip.stops.length} growers`, progressEvents:trip.assignedAt?[{type:'assigned',occurredAt:trip.assignedAt,actor:'Operations',quantityKg:null}]:[], stops: trip.stops.map(([id,farm,farmer,district,address,scheduledAt,status,quantityKg],index) => ({ ...demoStopDetails[id], id, sequence:index+1, allocationReference:`AL ${trip.reference.replace('YM ','')}-${String(index+1).padStart(2,'0')}`, farm, farmer, district, address, scheduledAt, status, quantityKg, actualKg:status==='picked_up'?quantityKg:0, actualCompletedAt:status==='picked_up'?scheduledAt:null })) }));

const tripSelect = `
  SELECT t.id,
         'YM ' || left(upper(replace(t.id::text, '-', '')), 4) AS reference,
         'YM ' || left(upper(replace(t.order_id::text, '-', '')), 4) AS order_reference,
         o.destination, o.destination_district, o.delivery_date,
         o.destination_latitude, o.destination_longitude,
         buyer.name AS buyer_name, buyer.phone AS buyer_phone, buyer.district AS buyer_district,
         t.scheduled_start, t.scheduled_end, t.routing_method, t.route_notes, t.created_at AS assigned_at,
         t.capacity_kg, t.planned_load_kg, t.status,
         v.registration || ' · ' || v.vehicle_type AS vehicle,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id', ts.id, 'sequence', ts.sequence, 'farmer', u.name, 'farm', f.name,
             'district', f.district, 'address', f.pickup_address, 'latitude', f.latitude, 'longitude', f.longitude,
             'phone', u.phone, 'crop', c.name, 'grade', g.name,
             'allocationReference', 'AL ' || left(upper(replace(a.id::text, '-', '')), 4) || '-' || lpad(ts.sequence::text, 2, '0'),
             'scheduledAt', ts.scheduled_at, 'status', ts.status, 'quantityKg', a.agreed_kg,
             'actualKg', a.picked_up_kg, 'actualCompletedAt', ts.completed_at
           ) ORDER BY ts.sequence)
           FROM trip_stops ts
           JOIN allocations a ON a.id = ts.allocation_id AND a.order_id = ts.order_id
           JOIN harvest_batches hb ON hb.id = a.batch_id AND hb.farmer_id = a.farmer_id
           JOIN farms f ON f.id = hb.farm_id AND f.farmer_id = hb.farmer_id
           JOIN users u ON u.id = a.farmer_id
           JOIN crops c ON c.id = hb.crop_id
           JOIN grades g ON g.id = hb.grade_id
           WHERE ts.trip_id = t.id AND ts.order_id = t.order_id
         ), '[]'::json) AS stops
         , COALESCE((
           SELECT json_agg(json_build_object('type', ce.event_type, 'occurredAt', ce.occurred_at, 'actor', actor.name, 'quantityKg', ce.quantity_kg) ORDER BY ce.occurred_at)
           FROM custody_events ce JOIN users actor ON actor.id = ce.actor_id WHERE ce.trip_id = t.id
         ), '[]'::json) AS progress_events
    FROM trips t
    JOIN orders o ON o.id = t.order_id
    JOIN vehicles v ON v.id = t.vehicle_id AND v.driver_id = t.driver_id
    JOIN users buyer ON buyer.id = o.buyer_id
   WHERE t.driver_id = $1 AND t.status <> 'cancelled'
`;

function mapTrip(row) {
  const stops = row.stops.map((stop) => ({
    ...stop,
    quantityKg: Number(stop.quantityKg),
    actualKg: Number(stop.actualKg || 0),
    latitude: stop.latitude == null ? null : Number(stop.latitude),
    longitude: stop.longitude == null ? null : Number(stop.longitude),
  }));
  const points = [...stops.map((stop) => ({ latitude: stop.latitude, longitude: stop.longitude })), { latitude: row.destination_latitude == null ? null : Number(row.destination_latitude), longitude: row.destination_longitude == null ? null : Number(row.destination_longitude) }];
  const hasAllCoordinates = points.length > 1 && points.every((point) => point.latitude != null && point.longitude != null);
  const distanceKm = (from, to) => {
    const radians = (degrees) => degrees * Math.PI / 180;
    const dLat = radians(to.latitude - from.latitude);
    const dLon = radians(to.longitude - from.longitude);
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  };
  const plannedDistanceKm = hasAllCoordinates ? points.slice(1).reduce((sum, point, index) => sum + distanceKm(points[index], point), 0) : null;
  const routeLegs = stops.slice(1).map((stop,index) => ({ sequence:index+1, from:stops[index].farm, to:stop.farm, distanceKm:stops[index].latitude!=null&&stop.latitude!=null?Math.round(distanceKm(stops[index],stop)*10)/10:null, durationMinutes:null, arriveAt:stop.scheduledAt, approximate:stops[index].latitude==null||stop.latitude==null }));
  if (stops.length) {
    const last=stops[stops.length-1];
    routeLegs.push({sequence:routeLegs.length+1,from:last.farm,to:row.destination,distanceKm:last.latitude!=null&&row.destination_latitude!=null?Math.round(distanceKm(last,{latitude:Number(row.destination_latitude),longitude:Number(row.destination_longitude)})*10)/10:null,durationMinutes:null,arriveAt:row.scheduled_end,approximate:last.latitude==null||row.destination_latitude==null});
  }
  return {
    id: row.id,
    reference: row.reference,
    orderReference: row.order_reference,
    destination: row.destination,
    destinationDistrict: row.destination_district,
    buyerName: row.buyer_name,
    buyerPhone: row.buyer_phone,
    buyerDistrict: row.buyer_district,
    deliveryDate: row.delivery_date,
    destinationLatitude: row.destination_latitude == null ? null : Number(row.destination_latitude),
    destinationLongitude: row.destination_longitude == null ? null : Number(row.destination_longitude),
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    routingMethod: row.routing_method,
    routeNotes: row.route_notes,
    assignedAt: row.assigned_at,
    capacityKg: Number(row.capacity_kg),
    plannedLoadKg: Number(row.planned_load_kg),
    status: row.status,
    vehicle: row.vehicle,
    plannedDistanceKm: plannedDistanceKm == null ? null : Math.round(plannedDistanceKm * 10) / 10,
    plannedDistanceIsApproximate: plannedDistanceKm != null,
    startLocation: 'First assigned pickup',
    startLatitude: null,
    startLongitude: null,
    estimatedDriveMinutes: null,
    routeLegs,
    beforeYouGo: stops.filter((stop)=>stop.latitude==null||stop.longitude==null).map((stop)=>`${stop.farm} has no saved coordinates. Confirm its address with the farm contact.`),
    sampleWeather: null,
    progressEvents: row.progress_events,
    stops,
  };
}

async function requireApprovedDriver(req, res) {
  const { rows } = await pool.query("SELECT id FROM users WHERE id = $1 AND role = 'driver' AND approval_status = 'approved'", [req.user.id]);
  if (rows[0]) return true;
  res.status(403).json({ error: 'Driver account is not approved', requestId: req.requestId });
  return false;
}

export async function getAssignedTrips(req, res, next) {
  try {
    if (!(await requireApprovedDriver(req, res))) return;
    if (req.user.id === demoDriverId && process.env.NODE_ENV !== 'production') return res.json({ trips: sampleTrips, requestId: req.requestId, demo: true });
    const { rows } = await pool.query(`${tripSelect} ORDER BY t.scheduled_start ASC`, [req.user.id]);
    const useDemoData = rows.length === 0 && req.user.id === demoDriverId && process.env.NODE_ENV !== 'production';
    const trips = rows.length ? rows.map(mapTrip) : (useDemoData ? sampleTrips : []);
    return res.json({ trips, requestId: req.requestId, demo: useDemoData });
  } catch (error) { next(error); }
}

export async function getAssignedTrip(req, res, next) {
  try {
    if (!(await requireApprovedDriver(req, res))) return;
    if (req.user.id === demoDriverId && process.env.NODE_ENV !== 'production') {
      const sample = sampleTrips.find((trip) => trip.id === req.params.tripId);
      if (sample) return res.json({ trip: sample, requestId: req.requestId, demo: true });
    }
    const { rows } = await pool.query(`${tripSelect} AND t.id = $2`, [req.user.id, req.params.tripId]);
    if (!rows[0] && req.user.id === demoDriverId && process.env.NODE_ENV !== 'production') {
      const sample = sampleTrips.find((trip) => trip.id === req.params.tripId);
      if (sample) return res.json({ trip: sample, requestId: req.requestId, demo: true });
    }
    if (!rows[0]) return res.status(404).json({ error: 'Assigned trip not found', requestId: req.requestId });
    return res.json({ trip: mapTrip(rows[0]), requestId: req.requestId });
  } catch (error) { next(error); }
}
