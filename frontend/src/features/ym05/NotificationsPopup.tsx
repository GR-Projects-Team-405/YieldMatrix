import { useEffect, useMemo, useState } from 'react';
import { Bell, CircleAlert, ClipboardCheck, CreditCard, Settings, Truck, UserRound, X } from 'lucide-react';
import api from '../../services/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  category: string;
  target_path: string | null;
  status: string;
  read_at: string | null;
  created_at: string;
}

interface NotificationResponse {
  notifications: Notification[];
  unreadCount: number;
}

interface NotificationsPopupProps {
  open: boolean;
  onClose: () => void;
  workspaceLabel: string;
}

function notificationIcon(category: string) {
  if (category.includes('delivery') || category.includes('dispatch')) return Truck;
  if (category.includes('payment') || category.includes('wallet')) return CreditCard;
  if (category.includes('approval') || category.includes('account')) return UserRound;
  if (category.includes('audit') || category.includes('review')) return ClipboardCheck;
  if (category.includes('error') || category.includes('exception')) return CircleAlert;
  return Bell;
}

function notificationDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysAgo = Math.round((dayStart - dateStart) / 86400000);
  if (daysAgo === 0) return `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (daysAgo === 1) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function NotificationsPopup({ open, onClose, workspaceLabel }: NotificationsPopupProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(null);
    api.get<NotificationResponse>('/ym05/notifications').then(({ data }) => {
      if (!active) return;
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    }).catch(() => {
      if (active) setError('Notifications could not be loaded.');
    });
    return () => { active = false; };
  }, [open]);

  const visibleNotifications = useMemo(
    () => filter === 'unread' ? notifications.filter((notification) => notification.status !== 'read') : notifications,
    [filter, notifications],
  );

  if (!open) return null;

  return <div className="notification-popup" role="dialog" aria-modal="false" aria-labelledby="notifications-title">
    <header className="notification-popup-header">
      <div>
        <h2 id="notifications-title">Notifications</h2>
        <p>{workspaceLabel}&nbsp; · &nbsp;{unreadCount} unread</p>
      </div>
      <div className="notification-popup-actions">
        <button type="button" className="notification-icon-button" aria-label="Notification settings" title="Notification settings"><Settings size={19} /></button>
        <button type="button" className="notification-icon-button" aria-label="Close notifications" onClick={onClose}><X size={22} /></button>
      </div>
    </header>
    <div className="notification-filters" role="tablist" aria-label="Notification filters">
      <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')} role="tab" aria-selected={filter === 'all'}>All</button>
      <button type="button" className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')} role="tab" aria-selected={filter === 'unread'}>Unread {unreadCount}</button>
    </div>
    <div className="notification-popup-body">
      {error && <p className="notification-error" role="alert">{error}</p>}
      {!error && visibleNotifications.length === 0 && <p className="notification-empty">{filter === 'unread' ? 'You are all caught up.' : 'No notifications yet.'}</p>}
      {!error && visibleNotifications.map((notification) => {
        const Icon = notificationIcon(notification.category.toLowerCase());
        const unread = notification.status !== 'read';
        return <article className={`notification-item ${unread ? 'is-unread' : ''}`} key={notification.id}>
          <div className="notification-item-icon"><Icon size={17} aria-hidden="true" /></div>
          <div className="notification-item-content">
            <h3>{notification.title}</h3>
            <p>{notification.message}</p>
            <time dateTime={notification.created_at}>{notificationDate(notification.created_at)}</time>
          </div>
          {unread && <span className="notification-unread-dot" aria-label="Unread" />}
        </article>;
      })}
    </div>
    <footer className="notification-popup-footer"><a href="./notifications" onClick={onClose}>View notification centre <span aria-hidden="true">→</span></a></footer>
  </div>;
}
