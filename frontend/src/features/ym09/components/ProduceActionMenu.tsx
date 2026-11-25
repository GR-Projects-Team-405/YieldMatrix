import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  Eye,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  PlayCircle,
} from 'lucide-react';
import {
  getAvailableListingStatusActions,
  type ListingStatusActionOption,
} from '../constants/produceConstants';
import type { ListingStatus } from '../types/produce';

interface ProduceActionMenuProps {
  produceName: string;
  listingId: string;
  currentStatus: ListingStatus;
  onSelectStatusAction?: (action: ListingStatusActionOption) => void;
}

function getActionIcon(targetStatus: ListingStatus) {
  switch (targetStatus) {
    case 'active':
      return <PlayCircle size={14} aria-hidden="true" />;
    case 'paused':
      return <PauseCircle size={14} aria-hidden="true" />;
    case 'closed':
    default:
      return <Archive size={14} aria-hidden="true" />;
  }
}

/**
 * Accessible context action menu for produce cards and table rows.
 * Supports keyboard navigation (ArrowDown, ArrowUp, Home, End, Escape) and focus return.
 */
export function ProduceActionMenu({
  produceName,
  listingId,
  currentStatus,
  onSelectStatusAction,
}: ProduceActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPopoverRef = useRef<HTMLDivElement>(null);
  const focusFirstOnOpenRef = useRef(false);
  const menuId = useId();
  const navigate = useNavigate();

  const statusActions = onSelectStatusAction
    ? getAvailableListingStatusActions(currentStatus, produceName)
    : [];

  const getEnabledMenuItems = (): HTMLButtonElement[] => {
    if (!menuPopoverRef.current) return [];
    return Array.from(
      menuPopoverRef.current.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not([disabled])'
      )
    );
  };

  useEffect(() => {
    if (!open) return;

    if (focusFirstOnOpenRef.current) {
      focusFirstOnOpenRef.current = false;
      const items = getEnabledMenuItems();
      items[0]?.focus();
    }

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      } else if (event.key === 'Tab') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleDocumentKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleDocumentKeyDown);
    };
  }, [open]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (!open) {
        e.preventDefault();
        focusFirstOnOpenRef.current = true;
        setOpen(true);
      }
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = getEnabledMenuItems();
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % items.length : 0;
      items[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex =
        currentIndex >= 0 ? (currentIndex - 1 + items.length) % items.length : items.length - 1;
      items[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  return (
    <div
      ref={menuRef}
      className="ym09-action-menu"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        className="ym09-action-menu-trigger"
        aria-label={`Actions for ${produceName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onKeyDown={handleTriggerKeyDown}
        onClick={(e) => {
          e.stopPropagation();
          focusFirstOnOpenRef.current = false;
          setOpen((prev) => !prev);
        }}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          ref={menuPopoverRef}
          role="menu"
          aria-label={`Actions for ${produceName}`}
          className="ym09-action-menu-popover"
          onKeyDown={handleMenuKeyDown}
        >
          <button
            type="button"
            role="menuitem"
            className="ym09-action-menu-item"
            onClick={() => {
              setOpen(false);
              navigate(`/farmer/produce/${listingId}`);
            }}
          >
            <Eye size={14} aria-hidden="true" />
            <span>View details</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="ym09-action-menu-item"
            onClick={() => {
              setOpen(false);
              navigate(`/farmer/produce/${listingId}/edit`);
            }}
          >
            <Pencil size={14} aria-hidden="true" />
            <span>Edit listing</span>
          </button>

          {statusActions.map((action) => (
            <button
              key={action.targetStatus}
              type="button"
              role="menuitem"
              className="ym09-action-menu-item"
              onClick={() => {
                setOpen(false);
                onSelectStatusAction?.(action);
              }}
            >
              {getActionIcon(action.targetStatus)}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
