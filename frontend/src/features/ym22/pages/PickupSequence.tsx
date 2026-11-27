import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, CalendarClock, Clock3, MapPin, Navigation, Route } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { Trip } from '../components/tripTypes';
import MetricCard from '../components/MetricCard';
import LoadBuildUp from '../components/LoadBuildUp';
import SequenceStopCard from '../components/SequenceStopCard';
import RouteLine from '../components/RouteLine';

const time=(value:string|null)=>value?new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Colombo'}).format(new Date(value)):'—';
const formatDate=(value:string)=>new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',timeZone:'Asia/Colombo'}).format(new Date(value));
function distance(from:{latitude:number;longitude:number},to:{latitude:number;longitude:number}) { const rad=(n:number)=>n*Math.PI/180;const dLat=rad(to.latitude-from.latitude),dLon=rad(to.longitude-from.longitude);const a=Math.sin(dLat/2)**2+Math.cos(rad(from.latitude))*Math.cos(rad(to.latitude))*Math.sin(dLon/2)**2;return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); }
export default function PickupSequence({trip}:{trip:Trip}) {
  const [,setParams]=useSearchParams();
  const [expandedStop,setExpandedStop]=useState<string|null>(null);
  const pickedUp=trip.stops.filter((stop)=>stop.status==='picked_up').length;
  const firstPickup=trip.stops[0]?.scheduledAt||trip.scheduledStart;
  const missingCoordinates=trip.stops.some((stop)=>stop.latitude==null||stop.longitude==null);
  const orderRule=trip.routingMethod==='nearest_next_stop'?'Nearest next stop':'Manual sequence';
  return <div className="ym22-sequence-page">
    <div className="ym22-sequence-heading"><div><button className="ym22-back-link" onClick={()=>setParams({trip:trip.id,view:'details'})}><ArrowLeft size={14}/> Back to trip {trip.reference}</button><h1>Pickup sequence</h1><p>Suggested order for {trip.reference} · {trip.stops.length} farm stops, then handover at {trip.destination}</p></div><div className="ym22-sequence-actions"><button onClick={()=>setParams({trip:trip.id,view:'details'})}>Trip details</button><button className="ym22-primary" onClick={()=>setParams({trip:trip.id,view:'route'})}>Open route overview <ArrowUpRight size={15}/></button></div></div>
    <div className="ym22-sequence-tags"><span>{trip.routingMethod==='nearest_next_stop'?'SUGGESTED · NEAREST NEXT STOP':'MANUAL PICKUP ORDER'}</span><span><CalendarClock size={12}/> TRIP DATE {formatDate(trip.scheduledStart).toUpperCase()}</span><span><Clock3 size={12}/> TIMES IN ASIA/COLOMBO</span></div>
    <div className="ym22-sequence-metrics"><MetricCard label="Pickup stops" value={`${trip.stops.length} + 1 drop`} detail={`${pickedUp} of ${trip.stops.length} collected`} icon={<MapPin/>}/><MetricCard label="First pickup" value={time(firstPickup)} detail={trip.stops[0]?.farm||'No pickup assigned'} icon={<Clock3/>}/><MetricCard label="Planned distance" value={trip.plannedDistanceKm==null?'Unavailable':`${trip.plannedDistanceKm.toFixed(1)} km`} detail={trip.plannedDistanceKm==null?'Farm or destination coordinates missing':'Approximate · saved locations'} icon={<Route/>}/><MetricCard label="Planned arrival" value={time(trip.plannedArrivalAt||trip.scheduledEnd)} detail={trip.deliveryWindowStart&&trip.deliveryWindowEnd?`Receiving window ${trip.deliveryWindowStart}–${trip.deliveryWindowEnd}`:'Scheduled delivery target'} icon={<Navigation/>}/></div>
    <div className="ym22-sequence-grid"><section className="ym22-sequence-main"><header className="ym22-sequence-section-heading"><div><h2>Stops in order</h2><p>Planned times in Asia/Colombo · actual kg is recorded at each stop</p></div><span>{orderRule}</span></header>
      <div className="ym22-origin-row"><div className="ym22-origin-icon"><Navigation size={14}/></div><div><b>START · Driver base</b><small>{trip.routeNotes||'Starting address is not recorded for this trip.'}</small></div><span>Leave {time(trip.scheduledStart)}</span></div>
      {trip.stops.map((stop,index)=>{const prev=index>0?trip.stops[index-1]:null;const leg=stop.distanceFromPreviousKm??(prev?.latitude!=null&&prev.longitude!=null&&stop.latitude!=null&&stop.longitude!=null?distance({latitude:prev.latitude,longitude:prev.longitude},{latitude:stop.latitude,longitude:stop.longitude}):null);return <SequenceStopCard key={stop.id} stop={stop} index={index} expanded={expandedStop===stop.id} onToggle={()=>setExpandedStop(expandedStop===stop.id?null:stop.id)} distanceFromPreviousKm={leg}/>;})}
      {trip.stops.length===0&&<p className="ym22-table-state">No pickup stops have been assigned to this trip.</p>}
      <div className="ym22-handover-row"><span><MapPin size={15}/></span><div><small>HANDOVER</small><b>{trip.destination} · {trip.destinationDistrict}</b><p>{trip.stops.length?`${trip.plannedDistanceKm==null?'Route distance unavailable':`${trip.plannedDistanceKm.toFixed(1)} km from saved locations`} · deliver ${trip.plannedLoadKg.toLocaleString()} kg planned`:'Delivery target from trip order'}</p></div><strong>Arrive {time(trip.plannedArrivalAt||trip.scheduledEnd)}</strong></div>
    </section><aside className="ym22-sequence-sidebar"><LoadBuildUp trip={trip}/><section className="ym22-sequence-side-card"><div className="ym22-side-title"><div><h2>Why this order?</h2><p>Dispatch routing rule</p></div><span>{orderRule}</span></div>{trip.routingMethod==='nearest_next_stop'?<><p>Each next farm is selected using the saved pickup locations. The listed order is the sequence assigned to your trip.</p><ul>{trip.stops.slice(0,3).map((stop,index)=><li key={stop.id}>{stop.farm}{stop.latitude==null?' has no saved coordinates.':' is stop '+(index+1)+' in the assigned route.'}</li>)}</ul><small>Distance is an approximate straight-line estimate. Traffic and road conditions are not included.</small></>:<><p>{trip.routeNotes||'Dispatch assigned this stop order manually.'}</p><small>Follow the sequence shown above. Contact dispatch if a stop needs to change.</small></>}</section>
      {missingCoordinates&&<div className="ym22-coordinate-warning ym22-coordinate-warning--panel"><MapPin size={14}/><p>Some farms have no saved coordinates. Confirm the pickup location with the farm contact before leaving.</p></div>}
    </aside></div>
    {trip.stops.length>0&&trip.stops.some(stop=>stop.latitude!=null&&stop.longitude!=null)&&<section className="ym22-table-card ym22-sequence-route"><div className="ym22-table-heading"><div><h2>Route at a glance</h2><p>Pickup points followed by the handover destination</p></div></div><RouteLine stops={trip.stops}/></section>}
  </div>;
}
