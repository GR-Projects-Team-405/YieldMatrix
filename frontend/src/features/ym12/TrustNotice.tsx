import { ShieldCheck } from 'lucide-react';
import type { ProduceDetailsResponse } from './types';
export function TrustNotice({ data }: { data: ProduceDetailsResponse }) {
  const message = data.dataSource === 'sample'
    ? 'Sample supplier profile. Confirm final quality and terms before placing an order.'
    : data.supplier.verified
      ? 'Supplier account approved. Confirm final quality and terms before placing an order.'
      : 'Supplier identity verification is not recorded. Confirm final quality and terms before placing an order.';
  return <aside className="ym12-trust-notice"><ShieldCheck size={24} strokeWidth={1.7} aria-hidden="true" /><div>
    <h3>Trade with greater confidence</h3><p>{message}</p>
  </div></aside>;
}
