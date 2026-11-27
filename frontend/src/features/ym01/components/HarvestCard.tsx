import { ArrowUpRight, MapPin, ShoppingBasket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate, formatNumber, type PublicHarvest } from '../api';
import HarvestImage from './HarvestImage';

export default function HarvestCard({ harvest }: { harvest: PublicHarvest }) {
  return <article className="harvest-card">
    <Link to={`/catalogue/${harvest.id}`} className="harvest-card-image-link" aria-label={`View ${harvest.cropName} harvest`}>
      <HarvestImage cropName={harvest.cropName} className="harvest-card-image" />
      <span className="harvest-grade-pill">{harvest.grade}</span>
    </Link>
    <div className="harvest-card-body">
      <div className="harvest-card-location"><MapPin size={14} /> {harvest.district} District</div>
      <Link to={`/catalogue/${harvest.id}`} className="harvest-card-title">{harvest.cropName}</Link>
      <p className="harvest-card-farm">{harvest.farmName}</p>
      <div className="harvest-card-meta"><span>Harvest date</span><strong>{formatDate(harvest.harvestDate)}</strong></div>
      <div className="harvest-card-bottom">
        <div><small>Available</small><strong>{formatNumber(harvest.availableQuantityKg, 3)} <span>kg</span></strong></div>
        <div className="harvest-card-price"><small>Price / kg</small><strong>LKR {formatNumber(harvest.unitPriceLkrPerKg, 2)}</strong></div>
        <Link className="harvest-card-arrow" to={`/catalogue/${harvest.id}`} aria-label={`View ${harvest.cropName} details`}><ArrowUpRight size={18} /></Link>
      </div>
      {Number(harvest.availableQuantityKg) > 0 && harvest.listingStatus.toLowerCase() === 'active' && <Link className="harvest-card-buy" to={`/catalogue/${encodeURIComponent(harvest.id)}/purchase?action=buy`}><ShoppingBasket size={15} /> Buy Now</Link>}
    </div>
  </article>;
}
