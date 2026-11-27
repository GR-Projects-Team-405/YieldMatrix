import React, { useMemo, useState } from 'react';
import {
  Clock,
  Pencil,
  PlusCircle,
  ShoppingBag,
  ShoppingCart,
  Tag,
} from 'lucide-react';
import { ProduceListingDetailView, ActivityEventRecord } from '../../types/produce';
import { formatDisplayDateTimeColombo } from '../../utils/produceFormatters';

interface ActivityTabProps {
  listing: ProduceListingDetailView;
}

/**
 * Renders a consistent icon for each listing activity event type.
 */
function renderActivityIcon(eventType: ActivityEventRecord['eventType']) {
  switch (eventType) {
    case 'price_update':
      return <Tag size={16} aria-hidden="true" />;
    case 'allocation_confirmed':
    case 'allocation_created':
      return <ShoppingBag size={16} aria-hidden="true" />;
    case 'order_completed':
    case 'order_placed':
      return <ShoppingCart size={16} aria-hidden="true" />;
    case 'listing_updated':
      return <Pencil size={16} aria-hidden="true" />;
    case 'listing_created':
    default:
      return <PlusCircle size={16} aria-hidden="true" />;
  }
}

export const ActivityTab: React.FC<ActivityTabProps> = ({ listing }) => {
  const [filterType, setFilterType] = useState<string>('all');

  const rawEvents: ActivityEventRecord[] = useMemo(() => {
    return listing.activityLog || [];
  }, [listing.activityLog]);

  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return rawEvents;
    if (filterType === 'price') return rawEvents.filter((e) => e.eventType === 'price_update');
    if (filterType === 'allocations') {
      return rawEvents.filter(
        (e) => e.eventType === 'allocation_confirmed' || e.eventType === 'allocation_created'
      );
    }
    if (filterType === 'orders') {
      return rawEvents.filter(
        (e) => e.eventType === 'order_completed' || e.eventType === 'order_placed'
      );
    }
    if (filterType === 'updates') {
      return rawEvents.filter(
        (e) =>
          e.eventType === 'listing_updated' ||
          e.eventType === 'listing_created' ||
          e.eventType === 'status_change'
      );
    }
    return rawEvents;
  }, [rawEvents, filterType]);

  return (
    <div className="ym09-activity-layout" data-testid="activity-tab">
      <section className="ym09-details-card" aria-labelledby="activity-log-title">
        <header className="ym09-details-card-header">
          <div>
            <h3 id="activity-log-title" className="ym09-details-card-title">
              <Clock size={20} aria-hidden="true" />
              Activity Log
            </h3>
            <p className="ym09-details-card-subtitle">
              A timeline of key actions and updates for this listing.
            </p>
          </div>

          <div style={{ position: 'relative' }}>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="ym09-select"
              aria-label="Filter activity event types"
            >
              <option value="all">All Activities</option>
              <option value="price">Price Updates</option>
              <option value="allocations">Allocations</option>
              <option value="orders">Orders</option>
              <option value="updates">Listing Edits</option>
            </select>
          </div>
        </header>

        {filteredEvents.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)' }}>
            No activity recorded for this listing.
          </div>
        ) : (
          <div className="ym09-timeline-list" role="feed" aria-label="Listing activity events">
            {filteredEvents.map((event) => (
              <article
                key={event.id}
                className="ym09-timeline-item"
                aria-labelledby={`event-title-${event.id}`}
              >
                <div className="ym09-timeline-icon">
                  {renderActivityIcon(event.eventType)}
                </div>

                <div className="ym09-timeline-body">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '16px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <h4 id={`event-title-${event.id}`} className="ym09-timeline-title">
                      {event.title}
                    </h4>
                    <time dateTime={event.timestamp} className="ym09-timeline-time">
                      {formatDisplayDateTimeColombo(event.timestamp)}
                    </time>
                  </div>
                  <p className="ym09-timeline-desc">{event.description}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
