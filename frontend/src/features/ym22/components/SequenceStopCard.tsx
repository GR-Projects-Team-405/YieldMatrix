import { ChevronDown, MapPin, Phone } from 'lucide-react';
import type { Stop } from './tripTypes';
import StatusBadge from './StatusBadge';
const time=(value:string|null)=>value?new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Colombo'}).format(new Date(value)):'Time pending';
export default function SequenceStopCard({stop,index,expanded,onToggle,distanceFromPreviousKm}:{stop:Stop;index:number;expanded:boolean;onToggle:()=>void;distanceFromPreviousKm:number|null}) {
  const missingLocation=stop.latitude==null||stop.longitude==null;
  return <article className={`ym22-sequence-stop ${expanded?'is-expanded':''}`}>
    <div className="ym22-sequence-step"><span>{index+1}</span><i/></div>
    <div className="ym22-sequence-card"><header><div><h3>{stop.farm}</h3><p>{stop.district}{stop.latitude==null?' · Approximate location':''}</p></div><StatusBadge status={stop.status}/></header>
      <div className="ym22-stop-meta"><span>ETA {time(stop.scheduledAt)}</span>{distanceFromPreviousKm!=null&&<span>{distanceFromPreviousKm.toFixed(1)} km from {index===0?'base':`stop ${index}`}</span>}{stop.crop&&<span>{stop.crop} · {stop.grade||'Standard'}</span>}<b>{stop.quantityKg.toLocaleString()} kg</b></div>
      <div className="ym22-stop-contact">{stop.phone?<><Phone size={12}/>{stop.farmer} · {stop.phone}</>:<><MapPin size={12}/>{stop.address}</>}<button onClick={onToggle}>{expanded?'Hide':'Stop details'} <ChevronDown size={13}/></button></div>
      {expanded&&<div className="ym22-stop-expanded"><p><MapPin size={13}/>{stop.address}</p>{stop.phone&&<p><Phone size={13}/>{stop.phone}</p>}{missingLocation&&<div className="ym22-coordinate-warning">Approximate location · this farm has no saved coordinates. Call the farm contact before leaving.</div>}</div>}
    </div>
  </article>;
}
