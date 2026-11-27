
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CircleHelp,
  ExternalLink,
  Sprout,
  Store,
  Truck,
} from 'lucide-react';

type Role = 'farmer' | 'buyer' | 'driver';

const roles = [
  {
    id: 'farmer',
    title: 'Farmer',
    category: 'Production & Harvest',
    description:
      'Manage your farms, list your harvests, and connect with commercial buyers across regions.',
    features: [
      'Manage farms and harvests',
      'List available produce real-time',
      'Receive & negotiate buyer requests',
    ],
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBocZVgw-dG6XDP0PphLxmvNy-GCZg-a6xU2Zina92FowcNNjoRvSDvYEFJWYMq6X84jXrvT8i4kcl7cGXoG4k2PU3_LXnMKP-AEyqm3J0wFORjVzuO8_rKbm7PglZbG5PmHg_7whOjHfI1yZZl9RbWU_Tcyp1GoaUedcSQkXtDZj3xA_eyvczgK9jh5GKWVu78yiPzMm0Njov45HLZzRIlaTBVHG-FWS1iiQt5hmX5',
    imageText: '4,820 Active Growers',
    route: '/signup/farmer',
    icon: Sprout,
  },
  {
    id: 'buyer',
    title: 'Buyer / Shop',
    category: 'Procurement & Retail',
    description:
      'Discover fresh produce, connect directly with growers, and orchestrate wholesale purchase orders.',
    features: [
      'Browse certified harvest catalogs',
      'Create recurring buying demands',
      'Automated contracts & invoicing',
    ],
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAIxmPNzQ6A9rwGzPm45eJG-36vzIJLNMV-Nka9EoDc01AlKuptum6gvxAyHfS-_3oyY69wc1Yjgoq8GiX3xtKYYoDFjwxlg9lOwzdZrFSSjHZyps5xyfkhrHsJ25CK5QQ3PdvIzr-YyYpqEXyBMymoJtwA9pD6459N44Tho02NN39Rms45278nyhGzVKuwCfMkn2niTUl3EAwouyrFoirnBi3MOwrHNlJ_iSVwH3IH',
    imageText: '1,290 Verified Outlets',
    route: '/signup/buyer',
    icon: Store,
  },
  {
    id: 'driver',
    title: 'Driver',
    category: 'Cold-Chain & Freight',
    description:
      'Manage assigned dispatch trips, coordinate multi-stop farm pickups, and track agricultural delivery routes.',
    features: [
      'View pre-routed trip assignments',
      'Digital manifest & stop checklists',
      'Live telemetry & prompt settlement',
    ],
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDdliH9cMfgEHYZ3tAAHpK5YSh_y9bZsyICxaYOvHoPX-n2FPTmcC_Ioh_R79HQwYwimbCllo8qsuKBuykiSbMyFQUH9mEAOJ7_3uwic1qO8VcYD6FWI2Xww41iETWuJFrqKUG6_KBehmvNEIe-75oAVQgWhQhmTrUNkF9JH3nO_cImYykxyXxaNh1xV58NtP6PBo75Ekt9BzZvmJcz1LMlQUxWQu_3SolWrVRNMTxx',
    imageText: '860 Logistics Partners',
    route: '/signup/driver',
    icon: Truck,
  },
] as const;

export default function RoleSelectionPage() {
  const [selectedRole, setSelectedRole] =
    useState<Role>('farmer');

  const navigate = useNavigate();

  return (
    <div className="ym03-role-page">
      <div className="ym03-role-container">
        <div className="ym03-role-heading">
          <span className="ym03-step-pill">
            <span className="ym03-step-dot" />
            STEP 01 OF 04 • ROLE SELECTION
          </span>

          <h1>Join the YieldMatrix community</h1>

          <p>
            Choose how you want to grow, trade or
            deliver with YieldMatrix
          </p>
        </div>

        <div className="ym03-role-grid">
          {roles.map((role) => {
            const isSelected = selectedRole === role.id;
            const Icon = role.icon;

            return (
              <article
                key={role.id}
                className={`ym03-role-card ${
                  isSelected ? 'ym03-role-selected' : ''
                }`}
              >
                <button
                  type="button"
                  className="ym03-role-select"
                  onClick={() => setSelectedRole(role.id)}
                  aria-pressed={isSelected}
                  aria-label={`Select ${role.title}`}
                >
                  <span className="ym03-role-icon">
                    <Icon size={26} />
                  </span>

                  <span
                    className={`ym03-selection-indicator ${
                      isSelected ? 'active' : ''
                    }`}
                  >
                    {isSelected && <Check size={15} />}
                  </span>

                  <span className="ym03-role-category">
                    {role.category}
                  </span>

                  <span className="ym03-role-title">
                    {role.title}
                  </span>

                  <span className="ym03-role-description">
                    {role.description}
                  </span>
                </button>

                <div className="ym03-feature-list">
                  {role.features.map((feature) => (
                    <div
                      className="ym03-feature-item"
                      key={feature}
                    >
                      <span className="ym03-feature-check">
                        <Check size={12} />
                      </span>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="ym03-role-image">
                  <img
                    src={role.image}
                    alt={`${role.title} agricultural network`}
                  />
                  <span>{role.imageText}</span>
                </div>

                <button
                  type="button"
                  className={`ym03-role-continue ${
                    isSelected ? 'active' : ''
                  }`}
                  onClick={() => navigate(role.route)}
                >
                  Continue as {role.title}
                  <ArrowRight size={17} />
                </button>
              </article>
            );
          })}
        </div>

        <div className="ym03-role-support">
          <div className="ym03-role-support-copy">
            <span className="ym03-help-icon">
              <CircleHelp size={21} />
            </span>

            <div>
              <strong>Not sure which role fits best?</strong>
              <p>
                You can request multi-role workspace access
                or switch account types later in your settings.
              </p>
            </div>
          </div>

          <div className="ym03-role-support-actions">
            <span className="ym03-guide-label">
              Read Onboarding Guide
              <ExternalLink size={16} />
            </span>
            <span className="ym03-support-label">
              Contact Support
            </span>
          </div>
        </div>

        <div className="ym03-role-stats">
          <div>
            <strong>99.4%</strong>
            <span>ON-TIME DELIVERY</span>
          </div>
          <div>
            <strong>$42M+</strong>
            <span>ANNUAL PRODUCE TRADED</span>
          </div>
          <div>
            <strong>12,000+</strong>
            <span>FARMS CONNECTED</span>
          </div>
          <div>
            <strong>&lt;24h</strong>
            <span>SETTLEMENT WINDOW</span>
          </div>
        </div>
      </div>
    </div>
  );
}
