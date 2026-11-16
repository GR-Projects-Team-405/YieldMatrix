import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Available visual treatments for a YieldMatrix button. */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'unavailable';

/** Native button attributes plus YieldMatrix styling. */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual treatment. Defaults to primary; unavailable always disables the button. */
  variant?: ButtonVariant;
  /** Button label, icon, or other inline content. */
  children?: ReactNode;
  /** Additional CSS classes applied to the button. */
  className?: string;
}

/** A 48px action button with shared YieldMatrix variants. */
export function Button({ variant = 'primary', className = '', disabled, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`ym-button ym-button--${variant} ${className}`} disabled={disabled || variant === 'unavailable'} {...props} />;
}
