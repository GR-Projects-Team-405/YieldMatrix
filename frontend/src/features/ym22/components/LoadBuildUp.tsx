import type { Trip } from './tripTypes';
const colors=['#173c2c','#a4472b','#a8d2b3','#8caaa0'];
export default function LoadBuildUp({trip}:{trip:Trip}) {
  let running=0;
  const rows=trip.stops.map((stop,index)=>{running+=Number(stop.quantityKg)||0;return {stop,index,load:running,percent:trip.capacityKg?Math.min(100,running/trip.capacityKg*100):0};});
  const total=rows.at(-1)?.load||trip.plannedLoadKg;
  return <section className="ym22-sequence-side-card"><h2>Load build-up</h2><p>Planned kg on board after each stop</p><div className="ym22-load-bar">{rows.map((row)=><i key={row.stop.id} style={{width:`${total?row.stop.quantityKg/total*100:0}%`,background:colors[row.index%colors.length]}}/> )}</div><div className="ym22-load-rows">{rows.map((row)=><div key={row.stop.id}><span><i style={{background:colors[row.index%colors.length]}}/>After stop {row.index+1}</span><b>{row.load.toLocaleString()} kg <small>{Math.round(row.percent)}%</small></b></div>)}</div><div className="ym22-capacity-note">Within capacity · {(trip.capacityKg-total).toLocaleString()} kg spare on {trip.vehicle}</div></section>;
}
