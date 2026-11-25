import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, ChevronLeft, CircleAlert, ClipboardCheck, CreditCard, ExternalLink, Search, Truck, UserRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ContentCard } from '../../components/ContentCard';
import { useAuth, type Role } from '../../context/AuthContext';
import api from '../../services/api';
import './notifications.css';

interface Notification {
  id: string;
  title: string;
  message: string;
  category: string;
  target_path: string | null;
  channel: 'in_app' | 'local_mail_sink';
  status: 'pending' | 'sent' | 'failed' | 'read';
  read_at: string | null;
  created_at: string;
}

interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
}

const workspaceLabels: Record<Role, string> = {
  farmer: 'Farmer',
  buyer: 'Buyer / Shop',
  driver: 'Driver',
  admin: 'Admin',
};

function notificationIcon(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes('delivery') || normalized.includes('dispatch')) return Truck;
  if (normalized.includes('payment') || normalized.includes('wallet') || normalized.includes('settlement')) return CreditCard;
  if (normalized.includes('approval') || normalized.includes('account')) return UserRound;
  if (normalized.includes('audit') || normalized.includes('review')) return ClipboardCheck;
  if (normalized.includes('error') || normalized.includes('exception') || normalized.includes('incident')) return CircleAlert;
  return Bell;
}

function notificationAge(value: string) {
  const date = new Date(value);
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24 && date.toDateString() === new Date().toDateString()) {
    return `${elapsedHours} hr${elapsedHours === 1 ? '' : 's'} ago`;
  }
  if (date.toDateString() === new Date(Date.now() - 86400000).toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function fullDate(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function NotificationCenter() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeDetailsButton = useRef<HTMLButtonElement>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<NotificationResponse>('/ym05/notifications?limit=50');
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setTotalCount(data.totalCount);
    } catch {
      setError('Notifications could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!selectedNotification) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedNotification(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    closeDetailsButton.current?.focus();
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedNotification?.id]);

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return notifications.filter((notification) => {
      if (filter === 'unread' && notification.status === 'read') return false;
      if (!query) return true;
      return [notification.title, notification.message, notification.category]
        .some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [filter, notifications, search]);

  const groups = useMemo(() => {
    const result = new Map<string, Notification[]>();
    filteredNotifications.forEach((notification) => {
      const label = dayLabel(notification.created_at);
      const group = result.get(label) ?? [];
      group.push(notification);
      result.set(label, group);
    });
    return Array.from(result.entries());
  }, [filteredNotifications]);

  const markAsRead = async (notification: Notification): Promise<boolean> => {
    if (notification.status === 'read') return true;
    if (updatingId) return false;
    setUpdatingId(notification.id);
    setError(null);
    try {
      const { data } = await api.patch<{ notification: Notification }>(`/ym05/notifications/${notification.id}/read`);
      setNotifications((current) => current.map((item) => item.id === notification.id ? data.notification : item));
      setSelectedNotification((current) => current?.id === notification.id ? data.notification : current);
      setUnreadCount((current) => Math.max(0, current - 1));
      return true;
    } catch {
      setError('This notification could not be marked as read. Please try again.');
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  const openNotification = (notification: Notification) => {
    setError(null);
    setSelectedNotification(notification);
    if (notification.status !== 'read') void markAsRead(notification);
  };

  const channelCounts = useMemo(() => notifications.reduce<Partial<Record<Notification['channel'], number>>>((counts, notification) => {
    counts[notification.channel] = (counts[notification.channel] ?? 0) + 1;
    return counts;
  }, {}), [notifications]);

  if (!user) return null;

  return <section className="notification-center">
    <Link className="notification-center-back-link" to={`/${user.role}/overview`}><ChevronLeft size={17} aria-hidden="true" /> Back to overview</Link>
    <div className="notification-center-title-row">
      <div>
        <h1>Notification center</h1>
        <p>{workspaceLabels[user.role]} workspace · Manage your updates and stay informed.</p>
      </div>
      <span className="notification-center-role-badge">{workspaceLabels[user.role]}</span>
    </div>

    <div className="notification-center-grid">
      <ContentCard className="notification-center-list-card">
        <div className="notification-center-card-title">
          <h3>Your notifications</h3>
          <span>{unreadCount} unread</span>
        </div>
        <div className="notification-center-toolbar">
          <div className="notification-center-filter-group" role="tablist" aria-label="Notification filter">
            <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')} role="tab" aria-selected={filter === 'all'}>All</button>
            <button type="button" className={filter === 'unread' ? 'is-active' : ''} onClick={() => setFilter('unread')} role="tab" aria-selected={filter === 'unread'}>Unread {unreadCount}</button>
          </div>
          <label className="notification-center-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notifications" aria-label="Search notifications" />
          </label>
        </div>

        {error && <div className="notification-center-error" role="alert">{error}<button type="button" onClick={() => void loadNotifications()}>Retry</button></div>}
        {loading ? <p className="notification-center-state" role="status">Loading notifications…</p> : !error && groups.length === 0 ?
          <div className="notification-center-empty">
            <Bell size={24} aria-hidden="true" />
            <h4>{search ? 'No matching notifications' : filter === 'unread' ? 'You’re all caught up' : 'No notifications yet'}</h4>
            <p>{search ? 'Try another search term.' : filter === 'unread' ? 'There are no unread updates for your account.' : 'Updates for your account will appear here.'}</p>
          </div> : !error && <div className="notification-center-groups">
          {groups.map(([label, items]) => <section className="notification-center-group" key={label} aria-label={label}>
            <h4>{label}</h4>
            <div className="notification-center-items">
              {items.map((notification) => {
                const Icon = notificationIcon(notification.category);
                const unread = notification.status !== 'read';
                return <article className={`notification-center-item ${unread ? 'is-unread' : ''}`} key={notification.id}>
                  <div className="notification-center-icon"><Icon size={17} aria-hidden="true" /></div>
                  <button className="notification-center-copy" type="button" onClick={() => openNotification(notification)} disabled={Boolean(updatingId)} aria-label={`Open details for ${notification.title}`}>
                    <span className="notification-center-item-heading">
                      <strong>{notification.title}</strong>
                      <time dateTime={notification.created_at}>{notificationAge(notification.created_at)}</time>
                    </span>
                    <span className="notification-center-message">{notification.message}</span>
                    <span className="notification-center-meta">{notification.category} · {notification.channel === 'in_app' ? 'In-app' : 'Local mail sink'}</span>
                  </button>
                  {unread ? <button className="notification-center-read-action" type="button" onClick={() => void markAsRead(notification)} disabled={updatingId === notification.id} aria-label={`Mark ${notification.title} as read`} title="Mark as read">
                    {updatingId === notification.id ? 'Saving…' : <><Check size={15} aria-hidden="true" /> Mark read</>}
                  </button> : notification.target_path?.startsWith('/') && !notification.target_path.startsWith('//') && <ExternalLink className="notification-center-read-icon" size={15} aria-hidden="true" />}
                  {unread && <span className="notification-center-unread-dot" aria-label="Unread" />}
                </article>;
              })}
            </div>
          </section>)}
        </div>}
        {!loading && totalCount > notifications.length && <p className="notification-center-results-note">Showing the {notifications.length} most recent of {totalCount} notifications.</p>}
      </ContentCard>

      <ContentCard className="notification-center-summary-card">
        <div className="notification-center-summary-heading"><Bell size={19} aria-hidden="true" /><h3>Notification activity</h3></div>
        <p className="notification-center-summary-description">A summary of updates delivered to your account.</p>
        <dl className="notification-center-summary-stats">
          <div><dt>Unread</dt><dd>{unreadCount}</dd></div>
          <div><dt>Loaded recent updates</dt><dd>{notifications.length}</dd></div>
        </dl>
        <div className="notification-center-summary-section">
          <h4>Delivery channels in recent updates</h4>
          {Object.keys(channelCounts).length === 0 ? <p className="notification-center-summary-empty">Channel details appear when you receive notifications.</p> :
            <ul>{Object.entries(channelCounts).map(([channel, count]) => <li key={channel}><span>{channel === 'in_app' ? 'In-app notifications' : 'Local mail sink'}</span><strong>{count}</strong></li>)}</ul>}
        </div>
        <div className="notification-center-control-note">
          <strong>Your account, your updates</strong>
          <p>Notifications shown here are private to your signed-in account. Delivery preferences are not available in the current notification data.</p>
        </div>
      </ContentCard>
    </div>
    {selectedNotification && <div className="notification-detail-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setSelectedNotification(null);
    }}>
      <section className="notification-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="notification-detail-title">
        <header className="notification-detail-header">
          <div className="notification-detail-heading">
            <div className="notification-center-icon"><Bell size={18} aria-hidden="true" /></div>
            <div>
              <p>Notification details</p>
              <h2 id="notification-detail-title">{selectedNotification.title}</h2>
            </div>
          </div>
          <button ref={closeDetailsButton} className="notification-detail-close" type="button" onClick={() => setSelectedNotification(null)} aria-label="Close notification details">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="notification-detail-content">
          <p className="notification-detail-message">{selectedNotification.message}</p>
          {error && <p className="notification-detail-error" role="alert">{error}</p>}
          <dl className="notification-detail-fields">
            <div><dt>Category</dt><dd>{selectedNotification.category}</dd></div>
            <div><dt>Status</dt><dd className={`notification-detail-status is-${selectedNotification.status}`}>{selectedNotification.status}</dd></div>
            <div><dt>Delivery channel</dt><dd>{selectedNotification.channel === 'in_app' ? 'In-app' : 'Local mail sink'}</dd></div>
            <div><dt>Received</dt><dd><time dateTime={selectedNotification.created_at}>{fullDate(selectedNotification.created_at)}</time></dd></div>
            <div><dt>Read</dt><dd>{selectedNotification.read_at ? <time dateTime={selectedNotification.read_at}>{fullDate(selectedNotification.read_at)}</time> : 'Not read yet'}</dd></div>
            <div className="notification-detail-id"><dt>Notification ID</dt><dd>{selectedNotification.id}</dd></div>
          </dl>
          {selectedNotification.target_path?.startsWith('/') && !selectedNotification.target_path.startsWith('//') && <Link className="notification-detail-link" to={selectedNotification.target_path} onClick={() => setSelectedNotification(null)}>
            <ExternalLink size={16} aria-hidden="true" /> Open related page
          </Link>}
        </div>
      </section>
    </div>}
  </section>;
}
