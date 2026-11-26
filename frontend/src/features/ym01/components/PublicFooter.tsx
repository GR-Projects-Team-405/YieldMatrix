import { ArrowUpRight, Leaf } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../../../assets/yieldmatrix-logo.webp';

export default function PublicFooter() {
  return <footer className="public-footer">
    <div className="footer-main">
      <div className="footer-brand-block">
        <Link className="public-brand footer-brand" to="/"><img src={logo} alt="" width="40" height="40" /><span><strong>Yield<span>Matrix</span></strong><small>GROW · CONNECT · THRIVE</small></span></Link>
        <p>A clearer connection between the people who grow food and the people who need it.</p>
      </div>
      <div className="footer-links"><strong>Explore</strong><Link to="/catalogue">Harvest marketplace</Link><Link to="/roles">Platform roles</Link><Link to="/roles/buyer">Buyer / Shop information</Link></div>
      <div className="footer-note"><span><Leaf size={17} /> Built around better harvest connections</span><p>Public listings share harvest and district information while keeping private contact and pickup details protected.</p><Link to="/roles">Learn about the network <ArrowUpRight size={15} /></Link></div>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} YieldMatrix</span><span>Connecting agriculture with opportunity.</span></div>
  </footer>;
}
