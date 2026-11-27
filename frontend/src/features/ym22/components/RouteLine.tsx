import { MapPin } from 'lucide-react';
import type { Stop } from './tripTypes';
export default function RouteLine({ stops }: { stops: Stop[] }) {
  return <div className="ym22-route-line" aria-label="Pickup route overview"><div className="ym22-route-track" />{stops.slice(0,4).map((stop,index)=><div className="ym22-route-stop" key={stop.id} style={{left:`${Math.min(5+index*(85/Math.max(stops.length-1,1)),90)}%`}}><span />{stop.farm} · {stop.district}</div>)}<span className="ym22-route-end"><MapPin size={15}/></span></div>;
}
