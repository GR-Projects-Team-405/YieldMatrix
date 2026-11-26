import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cropImage } from '../api';

export default function HarvestImage({ cropName, className = '' }: { cropName: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const image = cropImage(cropName);
  useEffect(() => setFailed(false), [image.url]);
  return <div className={`harvest-image ${className}`}>
    {!failed ? <img src={image.url} alt={`${cropName} harvest`} loading="lazy" onError={() => setFailed(true)} /> : <div className="harvest-image-fallback"><ImageOff size={24} /><span>Harvest image</span></div>}
    <span className="harvest-image-shade" aria-hidden="true" />
    <span className="harvest-image-label">{cropName}</span>
    {image.credit && <a className="harvest-image-credit" href={image.credit.url} target="_blank" rel="noreferrer">{image.credit.label}</a>}
  </div>;
}
