export default function HarvestSkeleton({ count = 3 }: { count?: number }) {
  return <div className="harvest-grid" aria-label="Loading harvests" aria-busy="true">{Array.from({ length: count }, (_, index) => <div className="harvest-skeleton" key={index}><div className="skeleton-image" /><div className="skeleton-line short" /><div className="skeleton-line" /><div className="skeleton-line medium" /></div>)}</div>;
}
