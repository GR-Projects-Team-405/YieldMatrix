// YM29 · Yasindu Janapriya · 5-day weather context strip (Open-Meteo or labelled Sample weather).

import { CloudRain, Sun } from 'lucide-react';
import { formatColomboDate, formatColomboTime } from '../formatters';
import type { WeatherPayload } from '../types';

export interface WeatherStripProps {
  weather: WeatherPayload;
}

export function WeatherStrip({ weather }: WeatherStripProps) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className={`ym29-chip ${weather.is_sample ? 'ym29-chip--demo' : 'ym29-chip--info'}`}>
          {weather.label}
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          Updated {formatColomboTime(weather.observed_at)} IST
        </span>
      </div>

      <div className="ym29-weather-strip">
        {weather.days.slice(0, 5).map((day) => {
          const heavyRain = day.rain_mm >= 12;
          return (
            <div key={day.date} className={`ym29-weather-day ${heavyRain ? 'ym29-weather-day--rain' : ''}`}>
              <small>{formatColomboDate(day.date, true)}</small>
              <div style={{ display: 'flex', justifyContent: 'center' }} aria-hidden="true">
                {day.rain_mm >= 5 ? <CloudRain size={16} /> : <Sun size={16} />}
              </div>
              <strong>{Math.round(day.temp_max)}°C</strong>
              <small>{day.rain_mm > 0 ? `${day.rain_mm.toFixed(0)} mm` : day.condition}</small>
            </div>
          );
        })}
      </div>

      <div className="ym29-note-box">
        <p style={{ margin: 0, color: 'var(--text)', fontWeight: 500 }}>{weather.summary}</p>
        <p style={{ margin: '6px 0 0', fontSize: 12 }}>
          Source: {weather.source}. <strong>{weather.transit_note}</strong>
        </p>
      </div>
    </div>
  );
}
