import { Link, useLocation } from 'react-router-dom';
import { Users, UserCheck, Clock, Ban } from 'lucide-react';

// YM30 · Yugen Suresh · People & Access Sub-Navigation Bar
// Surfaces distinct, clickable navigation tabs with separate icons for all 04 pages:
// 1. People and access   -> /admin/people
// 2. Account details     -> /admin/people/account
// 3. Approval requests   -> /admin/people/approvals
// 4. Suspended accounts  -> /admin/people/suspended

interface PeopleSubNavProps {
  pendingCount?: number;
  suspendedCount?: number;
}

export function PeopleSubNav({ pendingCount = 12, suspendedCount = 12 }: PeopleSubNavProps) {
  const location = useLocation();
  const path = location.pathname;

  const isApprovals = path.includes('/approvals');
  const isSuspended = path.includes('/suspended');
  const isAccount =
    path.includes('/account') ||
    (!isApprovals && !isSuspended && path !== '/admin/people' && path !== '/admin/people/');
  const isPeople = !isApprovals && !isSuspended && !isAccount && (path === '/admin/people' || path === '/admin/people/');

  const navItems = [
    {
      id: 'people',
      to: '/admin/people',
      title: 'People and access',
      desc: 'Member directory & overview',
      icon: Users,
      iconColorClass: 'ym30-subnav-icon-wrap--green',
      isActive: isPeople,
    },
    {
      id: 'account',
      to: '/admin/people/account',
      title: 'Account details',
      desc: 'Profile, roles & activity',
      icon: UserCheck,
      iconColorClass: 'ym30-subnav-icon-wrap--blue',
      isActive: isAccount,
    },
    {
      id: 'approvals',
      to: '/admin/people/approvals',
      title: 'Approval requests',
      desc: 'Review pending registrations',
      icon: Clock,
      iconColorClass: 'ym30-subnav-icon-wrap--peach',
      isActive: isApprovals,
      badgeText: `${pendingCount} pending`,
      badgeClass: 'ym30-subnav-count--peach',
    },
    {
      id: 'suspended',
      to: '/admin/people/suspended',
      title: 'Suspended accounts',
      desc: 'Manage access restoration',
      icon: Ban,
      iconColorClass: 'ym30-subnav-icon-wrap--red',
      isActive: isSuspended,
      badgeText: `${suspendedCount} suspended`,
      badgeClass: 'ym30-subnav-count--red',
    },
  ];

  return (
    <nav className="ym30-subnav-bar" aria-label="People & access navigation">
      {navItems.map((item) => {
        const IconComponent = item.icon;
        return (
          <Link
            key={item.id}
            to={item.to}
            className={`ym30-subnav-link ${item.isActive ? 'active' : ''}`}
            title={`Open ${item.title}`}
          >
            <div className={`ym30-subnav-icon-wrap ${item.iconColorClass}`}>
              <IconComponent size={18} />
            </div>

            <div className="ym30-subnav-text">
              <strong className="ym30-subnav-title">{item.title}</strong>
              <small className="ym30-subnav-desc">{item.desc}</small>
            </div>

            {item.badgeText && (
              <span className={`ym30-subnav-count ${item.badgeClass}`}>
                {item.badgeText}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
