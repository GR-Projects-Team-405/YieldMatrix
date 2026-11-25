import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, ChevronLeft, CircleAlert, ClipboardCheck, CreditCard, ExternalLink, Search, Truck, UserRound, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
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

type PreferenceMap = Record<string, boolean>;

interface PreferencesResponse {
  notificationPreferences: PreferenceMap;
  marketAdvisoryPreferences: PreferenceMap;
}

interface PreferenceToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onChange: () => void;
}

interface PreferenceActionsProps {
  hasChanges: boolean;
  disabled: boolean;
  saving: boolean;
  message: string | null;
  onReset: () => void;
  onSave: () => void;
}

const workspaceLabels: Record<Role, string> = {
  farmer: 'Farmer',
  buyer: 'Buyer / Shop',
  driver: 'Driver',
  admin: 'Admin',
};

const notificationTopicsByRole: Record<Role, { key: string; label: string }[]> = {
  farmer: [
    { key: 'farm_updates', label: 'Farm & account updates' },
    { key: 'orders_commitments', label: 'Orders & commitments' },
    { key: 'delivery_updates', label: 'Delivery updates' },
    { key: 'market_advisories', label: 'Market advisories' },
  ],
  buyer: [
    { key: 'orders_reservations', label: 'Orders & reservations' },
    { key: 'delivery_updates', label: 'Delivery updates' },
    { key: 'wallet_refunds', label: 'Wallet & refunds' },
    { key: 'market_advisories', label: 'Market advisories' },
  ],
  driver: [
    { key: 'delivery_requests', label: 'Delivery requests' },
    { key: 'pickup_route_updates', label: 'Pickup & route updates' },
    { key: 'earnings_settlements', label: 'Earnings & settlements' },
    { key: 'account_updates', label: 'Account updates' },
  ],
  admin: [
    { key: 'account_approvals', label: 'Account approvals' },
    { key: 'order_delivery_issues', label: 'Order & delivery issues' },
    { key: 'settlement_exceptions', label: 'Settlement exceptions' },
    { key: 'security_audit', label: 'Security & audit' },
  ],
};

const deliveryChannels = [
  { key: 'in_app', label: 'In-app notifications', description: 'Show updates in your notification center.' },
  { key: 'local_mail_sink', label: 'Email notifications', description: 'Email is handled by the configured local mail sink.' },
  { key: 'sms', label: 'SMS notifications', description: 'SMS delivery is not configured.', unavailable: true },
];

const marketAdvisoryTopics = [
  { key: 'price_changes', label: 'Price movements', description: 'Updates when relevant produce prices change.' },
  { key: 'supply_demand', label: 'Supply & demand', description: 'Changes in produce availability and demand.' },
  { key: 'new_opportunities', label: 'Market opportunities', description: 'Relevant new listings and buyer or supplier opportunities.' },
  { key: 'weekly_summary', label: 'Weekly market summary', description: 'A weekly overview of market activity.' },
];

function defaultNotificationPreferences(role: Role): PreferenceMap {
  const preferences: PreferenceMap = { in_app: true, local_mail_sink: true, sms: false };
  notificationTopicsByRole[role].forEach(({ key }) => { preferences[key] = true; });
  return preferences;
}

function defaultMarketAdvisoryPreferences(): PreferenceMap {
  return marketAdvisoryTopics.reduce<PreferenceMap>((preferences, { key }) => {
    preferences[key] = true;
    return preferences;
  }, {});
}

function mergePreferences(defaults: PreferenceMap, saved: PreferenceMap): PreferenceMap {
  return Object.keys(defaults).reduce<PreferenceMap>((preferences, key) => {
    preferences[key] = typeof saved?.[key] === 'boolean' ? saved[key] : defaults[key];
    return preferences;
  }, {});
}

function preferencesMatch(first: PreferenceMap, second: PreferenceMap) {
  const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
  return Array.from(keys).every((key) => first[key] === second[key]);
}

function PreferenceToggle({ label, description, enabled, disabled = false, onChange }: PreferenceToggleProps) {
  return <div className={`preference-toggle-row ${disabled ? 'is-disabled' : ''}`}>
    <div className="preference-toggle-copy">
      <strong>{label}</strong>
      <p>{description}</p>
    </div>
    <button className={`preference-switch ${enabled ? 'is-on' : ''}`} type="button" role="switch" aria-label={label} aria-checked={enabled} disabled={disabled} onClick={onChange}>
      <span />
    </button>
  </div>;
}

function PreferenceActions({ hasChanges, disabled, saving, message, onReset, onSave }: PreferenceActionsProps) {
  return <footer className="preferences-actions">
    <p className={hasChanges ? 'has-changes' : ''} role="status">{saving ? 'Saving preferences…' : hasChanges ? 'You have unsaved changes.' : message ?? 'All changes are saved.'}</p>
    <div className="preferences-action-buttons">
      <button className="preferences-reset-button" type="button" disabled={disabled || !hasChanges} onClick={onReset}>Reset</button>
      <button className="preferences-save-button" type="button" disabled={disabled || !hasChanges} onClick={onSave}>{saving ? 'Saving…' : 'Save changes'}</button>
    </div>
  </footer>;
}

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
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'notificationPreferences' | 'marketAdvisoryPreferences'>('inbox');
  const [notificationPreferences, setNotificationPreferences] = useState<PreferenceMap>({});
  const [savedNotificationPreferences, setSavedNotificationPreferences] = useState<PreferenceMap>({});
  const [marketAdvisoryPreferences, setMarketAdvisoryPreferences] = useState<PreferenceMap>({});
  const [savedMarketAdvisoryPreferences, setSavedMarketAdvisoryPreferences] = useState<PreferenceMap>({});
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [notificationPreferenceNotice, setNotificationPreferenceNotice] = useState<string | null>(null);
  const [marketPreferenceNotice, setMarketPreferenceNotice] = useState<string | null>(null);
  const [savingPreference, setSavingPreference] = useState<'notification' | 'market' | null>(null);
  const closeDetailsButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (requestedTab === 'preferences') setActiveTab('notificationPreferences');
    else if (requestedTab === 'market-advisory-preferences') setActiveTab('marketAdvisoryPreferences');
    else setActiveTab('inbox');
  }, [requestedTab]);

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

  const loadPreferences = useCallback(async () => {
    if (!user) return;
    setPreferencesLoading(true);
    setPreferencesError(null);
    try {
      const { data } = await api.get<PreferencesResponse>('/ym05/preferences');
      const savedNotifications = mergePreferences(defaultNotificationPreferences(user.role), data.notificationPreferences);
      const savedAdvisories = mergePreferences(defaultMarketAdvisoryPreferences(), data.marketAdvisoryPreferences);
      setNotificationPreferences(savedNotifications);
      setSavedNotificationPreferences(savedNotifications);
      setMarketAdvisoryPreferences(savedAdvisories);
      setSavedMarketAdvisoryPreferences(savedAdvisories);
      setPreferencesLoaded(true);
    } catch {
      setPreferencesError('Preferences could not be loaded. Please try again.');
    } finally {
      setPreferencesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

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

  const savePreferences = async (section: 'notification' | 'market') => {
    if (!user || savingPreference) return;
    const notificationsToSave = section === 'notification' ? notificationPreferences : savedNotificationPreferences;
    const advisoriesToSave = section === 'market' ? marketAdvisoryPreferences : savedMarketAdvisoryPreferences;
    setSavingPreference(section);
    setPreferencesError(null);
    try {
      const { data } = await api.put<PreferencesResponse>('/ym05/preferences', {
        notificationPreferences: notificationsToSave,
        marketAdvisoryPreferences: advisoriesToSave,
      });
      if (section === 'notification') {
        setNotificationPreferences(data.notificationPreferences);
        setSavedNotificationPreferences(data.notificationPreferences);
        setNotificationPreferenceNotice('Notification preferences saved.');
      } else {
        setMarketAdvisoryPreferences(data.marketAdvisoryPreferences);
        setSavedMarketAdvisoryPreferences(data.marketAdvisoryPreferences);
        setMarketPreferenceNotice('Market advisory preferences saved.');
      }
    } catch {
      setPreferencesError('Your preferences could not be saved. Please try again.');
    } finally {
      setSavingPreference(null);
    }
  };

  const toggleNotificationPreference = (key: string) => {
    setNotificationPreferences((current) => ({ ...current, [key]: !current[key] }));
    setNotificationPreferenceNotice(null);
    setPreferencesError(null);
  };

  const toggleMarketAdvisoryPreference = (key: string) => {
    setMarketAdvisoryPreferences((current) => ({ ...current, [key]: !current[key] }));
    setMarketPreferenceNotice(null);
    setPreferencesError(null);
  };

  const resetNotificationPreferences = () => {
    setNotificationPreferences(savedNotificationPreferences);
    setNotificationPreferenceNotice('Unsaved notification changes discarded.');
    setPreferencesError(null);
  };

  const resetMarketAdvisoryPreferences = () => {
    setMarketAdvisoryPreferences(savedMarketAdvisoryPreferences);
    setMarketPreferenceNotice('Unsaved market advisory changes discarded.');
    setPreferencesError(null);
  };

  const channelCounts = useMemo(() => notifications.reduce<Partial<Record<Notification['channel'], number>>>((counts, notification) => {
    counts[notification.channel] = (counts[notification.channel] ?? 0) + 1;
    return counts;
  }, {}), [notifications]);
  const preferenceControlsDisabled = preferencesLoading || !preferencesLoaded || savingPreference !== null;
  const hasNotificationPreferenceChanges = !preferencesMatch(notificationPreferences, savedNotificationPreferences);
  const hasMarketPreferenceChanges = !preferencesMatch(marketAdvisoryPreferences, savedMarketAdvisoryPreferences);

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

    <div className="notification-center-tabs" role="tablist" aria-label="Notification center sections">
      <button type="button" role="tab" id="notification-tab-inbox" aria-controls="notification-panel-inbox" aria-selected={activeTab === 'inbox'} className={activeTab === 'inbox' ? 'is-active' : ''} onClick={() => { setActiveTab('inbox'); setSelectedNotification(null); setSearchParams({}, { replace: true }); }}>Inbox</button>
      <button type="button" role="tab" id="notification-tab-preferences" aria-controls="notification-panel-preferences" aria-selected={activeTab === 'notificationPreferences'} className={activeTab === 'notificationPreferences' ? 'is-active' : ''} onClick={() => { setActiveTab('notificationPreferences'); setSelectedNotification(null); setSearchParams({ tab: 'preferences' }, { replace: true }); }}>Notification preferences</button>
      <button type="button" role="tab" id="notification-tab-market" aria-controls="notification-panel-market" aria-selected={activeTab === 'marketAdvisoryPreferences'} className={activeTab === 'marketAdvisoryPreferences' ? 'is-active' : ''} onClick={() => { setActiveTab('marketAdvisoryPreferences'); setSelectedNotification(null); setSearchParams({ tab: 'market-advisory-preferences' }, { replace: true }); }}>Market advisory preferences</button>
    </div>

    <div id="notification-panel-inbox" className="notification-center-grid notification-center-tab-panel" hidden={activeTab !== 'inbox'} role="tabpanel" aria-labelledby="notification-tab-inbox">
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
          <p>Notifications shown here are private to your signed-in account. Manage delivery and market updates in the preferences tabs.</p>
        </div>
      </ContentCard>
    </div>

    <div id="notification-panel-preferences" className="preferences-panel notification-center-tab-panel" hidden={activeTab !== 'notificationPreferences'} role="tabpanel" aria-labelledby="notification-tab-preferences">
      <ContentCard className="preferences-card">
        <div className="preferences-panel-heading">
          <h2>Notification preferences</h2>
          <p>Choose how you receive updates in your {workspaceLabels[user.role]} workspace.</p>
        </div>
        {preferencesError && <p className="preferences-error" role="alert">{preferencesError}<button type="button" onClick={() => void loadPreferences()}>Retry</button></p>}
        {preferencesLoading ? <p className="preferences-loading" role="status">Loading your preferences…</p> : <>
          <div className="preferences-layout">
            <section className="preferences-group preferences-group-card">
              <h3>Delivery channels</h3>
              {deliveryChannels.map(({ key, label, description, unavailable }) => <PreferenceToggle
                key={key}
                label={label}
                description={description}
                enabled={notificationPreferences[key] ?? false}
                disabled={preferenceControlsDisabled || unavailable}
                onChange={() => toggleNotificationPreference(key)}
              />)}
            </section>
            <section className="preferences-group preferences-group-card">
              <h3>Notify me about</h3>
              {notificationTopicsByRole[user.role].map(({ key, label }) => <PreferenceToggle
                key={key}
                label={label}
                description={`Receive ${label.toLocaleLowerCase()} notifications.`}
                enabled={notificationPreferences[key] ?? false}
                disabled={preferenceControlsDisabled}
                onChange={() => toggleNotificationPreference(key)}
              />)}
            </section>
          </div>
          <PreferenceActions
            hasChanges={hasNotificationPreferenceChanges}
            disabled={preferenceControlsDisabled}
            saving={savingPreference === 'notification'}
            message={notificationPreferenceNotice}
            onReset={resetNotificationPreferences}
            onSave={() => void savePreferences('notification')}
          />
        </>}
      </ContentCard>
    </div>

    <div id="notification-panel-market" className="preferences-panel notification-center-tab-panel" hidden={activeTab !== 'marketAdvisoryPreferences'} role="tabpanel" aria-labelledby="notification-tab-market">
      <ContentCard className="preferences-card">
        <div className="preferences-panel-heading">
          <h2>Market advisory preferences</h2>
          <p>Choose which market updates are relevant to your {workspaceLabels[user.role]} workspace.</p>
        </div>
        {preferencesError && <p className="preferences-error" role="alert">{preferencesError}<button type="button" onClick={() => void loadPreferences()}>Retry</button></p>}
        {preferencesLoading ? <p className="preferences-loading" role="status">Loading your preferences…</p> : <>
          <section className="preferences-group preferences-group-card preferences-market-group">
            <h3>Market updates</h3>
            <div className="preference-options-grid">
              {marketAdvisoryTopics.map(({ key, label, description }) => <PreferenceToggle
                key={key}
                label={label}
                description={description}
                enabled={marketAdvisoryPreferences[key] ?? false}
                disabled={preferenceControlsDisabled}
                onChange={() => toggleMarketAdvisoryPreference(key)}
              />)}
            </div>
          </section>
          <PreferenceActions
            hasChanges={hasMarketPreferenceChanges}
            disabled={preferenceControlsDisabled}
            saving={savingPreference === 'market'}
            message={marketPreferenceNotice}
            onReset={resetMarketAdvisoryPreferences}
            onSave={() => void savePreferences('market')}
          />
        </>}
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
