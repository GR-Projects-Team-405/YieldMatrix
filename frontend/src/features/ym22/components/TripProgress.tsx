import { Check, Circle, PackageCheck } from 'lucide-react';
import type { Trip } from './tripTypes';
const fmt=(value?:string|null)=>value?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Colombo'}).format(new Date(value)):'Pending';
export default function TripProgress({trip}:{trip:Trip}) {
  const events=trip.progressEvents||[];
  const assigned=events.find((event)=>event.type==='assigned');
  const pickup=events.find((event)=>event.type==='pickup')||trip.stops.find((stop)=>stop.status==='picked_up');
  const handover=events.find((event)=>event.type==='handover');
  const complete=['completed','handed_over'].includes(trip.status);
  const pickupAt=pickup?('occurredAt' in pickup?pickup.occurredAt:pickup.actualCompletedAt):undefined;
  const stages=[
    {label:'Assigned',detail:assigned?`Assigned by ${assigned.actor}`:'Trip assigned to driver',at:assigned?.occurredAt||trip.assignedAt,done:true},
    {label:'In progress',detail:pickup?(('actor' in pickup&&pickup.actor)||'First pickup recorded'):'Recorded when first pickup is confirmed',at:pickupAt,done:Boolean(pickup)||trip.status==='in_progress'||complete},
    {label:'Handed over',detail:handover?`At ${trip.destination}`:`Handover at ${trip.destination}`,at:handover?.occurredAt,done:Boolean(handover)||complete},
    {label:'Completed',detail:complete?'All assigned stops accounted for':'Trip completion recorded after handover',at:events.find((event)=>event.type==='completed')?.occurredAt,done:trip.status==='completed'},
  ];
  return <section className="ym22-detail-panel ym22-progress-panel"><header><div><h2>Trip progress</h2><p>Recorded events only · not live GPS tracking</p></div><PackageCheck size={17}/></header><div className="ym22-progress-track">{stages.map((stage,index)=><div className={`ym22-progress-stage ${stage.done?'is-done':''}`} key={stage.label}><span className="ym22-progress-dot">{stage.done?<Check size={12}/>:<Circle size={12}/>}</span>{index<stages.length-1&&<i/>}<div><b>{stage.label}</b><small>{fmt(stage.at)}</small><p>{stage.detail}</p></div></div>)}</div></section>;
}
