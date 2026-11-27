import { ArrowRight, Leaf } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Harvest } from '../ym06Api';
import { formatDate } from '../ym06Api';

const cropEmoji = (crop: string) => {
  const value = crop.toLowerCase();
  if (value.includes('tomato')) return '\u{1F345}';
  if (value.includes('carrot')) return '\u{1F955}';
  if (value.includes('cabbage')) return '\u{1F96C}';
  if (value.includes('potato')) return '\u{1F954}';
  if (value.includes('bean')) return '\u{1FAD8}';
  return '\u{1F331}';
};

export default function FieldNotesCard({ harvests }: { harvests: Harvest[] }) {
  const crops = harvests.slice(0, 3);
  const first = harvests[0];
  const last = harvests.length > 1 ? harvests[harvests.length - 1] : first;
  const harvestWindow = first && last
    ? `${formatDate(first.planned_harvest_date, { day: '2-digit', month: 'short' })}${first.id !== last.id ? ` – ${formatDate(last.planned_harvest_date, { day: '2-digit', month: 'short' })}` : ''}`
    : 'No dates planned';
  return <section className="ym06-panel ym06-field-notes">
    <div className="ym06-panel-heading"><div><h3>Your field notes</h3><p>A little growing goes a long way.</p></div><span className="ym06-field-icon"><Leaf size={16}/></span></div>
    {crops.length ? <><div className="ym06-field-crops">{crops.map((item) => <div className="ym06-field-crop" key={item.id} title={`${item.crop}, ${item.grade}`}><span>{cropEmoji(item.crop)}</span><small>{item.crop}</small></div>)}</div><div className="ym06-field-window"><span>Next harvest window</span><strong>{harvestWindow}</strong></div></> : <p className="ym06-field-empty">Upcoming crop notes will appear when you plan a harvest.</p>}
    <Link className="ym06-field-link" to="../harvest-calendar">Open harvest calendar <ArrowRight size={14}/></Link>
  </section>;
}
