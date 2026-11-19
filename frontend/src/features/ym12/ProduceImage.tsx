import { Image as ImageIcon } from 'lucide-react';
export function ProduceImage({ imageUrl, cropName }: { imageUrl: string | null; cropName: string }) {
  if (!imageUrl) return <div className="ym12-image-placeholder" role="img" aria-label={`No photo available for ${cropName}`}>
    <span className="ym12-placeholder-icon"><ImageIcon size={34} strokeWidth={1.4} aria-hidden="true" /></span>
    <strong>Image placeholder</strong><span>No photo available</span>
  </div>;
  return <img className="ym12-produce-image" src={imageUrl} alt={`${cropName} available from this supplier`} />;
}
