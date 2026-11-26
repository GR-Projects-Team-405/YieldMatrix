import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { Link } from 'react-router-dom';
export type CalendarBatch = {
  id: string;
  cropName: string;
  harvestDate: string;
  status: string;
  quantityKg: number;
};

const TZ = 'Asia/Colombo';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const dayKey = (value: string | Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(value));

export default function HarvestCalendarView({ batches }: { batches: CalendarBatch[] }) {
  const todayKey = dayKey(new Date());
  const [year, setYear] = useState(Number(todayKey.slice(0, 4)));
  const [month, setMonth] = useState(Number(todayKey.slice(5, 7)) - 1);

  const byDay = useMemo(() => {
    const map: Record<string, CalendarBatch[]> = {};
    batches.forEach((b) => {
      (map[dayKey(b.harvestDate)] ||= []).push(b);
    });
    return map;
  }, [batches]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const pad = (n: number) => String(n).padStart(2, '0');
  const title = new Date(year, month, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  const go = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const goToday = () => {
    setYear(Number(todayKey.slice(0, 4)));
    setMonth(Number(todayKey.slice(5, 7)) - 1);
  };

  return (
    <ContentCard title="Harvest Calendar" subtitle="Planned and completed harvests">
      <div className="ym-harvest-cal-toolbar">
        <h3 className="ym-harvest-cal-title">{title}</h3>
        <div className="ym-harvest-cal-nav">
          <Button variant="outline" onClick={() => go(-1)}>Previous</Button>
          <Button variant="outline" onClick={goToday}>Today</Button>
          <Button variant="outline" onClick={() => go(1)}>Next</Button>
        </div>
      </div>

      <div className="ym-harvest-cal-legend">
        <span><i className="ym-harvest-cal-dot ym-harvest-cal-dot--completed" /> Completed</span>
        <span><i className="ym-harvest-cal-dot ym-harvest-cal-dot--scheduled" /> Scheduled</span>
        <span><i className="ym-harvest-cal-dot ym-harvest-cal-dot--pending" /> Pending</span>
      </div>

      <div className="ym-harvest-cal-scroll">
        <div className="ym-harvest-cal-grid">
          {WEEKDAYS.map((d) => (
            <div key={d} className="ym-harvest-cal-head">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`b${i}`} className="ym-harvest-cal-cell ym-harvest-cal-empty" />;
            }
            const key = `${year}-${pad(month + 1)}-${pad(day)}`;
            const items = byDay[key] ?? [];
            const isToday = key === todayKey;
            return (
              <div key={key} className={`ym-harvest-cal-cell${isToday ? ' ym-harvest-cal-today' : ''}`}>
                <span className="ym-harvest-cal-day">{day}</span>
               {items.map((b) => (
  <Link
    key={b.id}
    to={`/farmer/harvest-calendar/${b.id}/edit`}
    className={`ym-harvest-cal-event ym-harvest-cal-event--${b.status.toLowerCase()}`}
    title={`${b.cropName} - ${b.quantityKg} kg (${b.status})`}
  >
    {b.cropName} · {b.quantityKg} kg
  </Link>
))}
              </div>
            );
          })}
        </div>
      </div>
    </ContentCard>
  );
}