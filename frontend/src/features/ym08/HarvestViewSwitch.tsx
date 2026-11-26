import { Link, NavLink, Outlet } from 'react-router-dom';

const BASE = '/farmer/harvest-calendar';

export default function HarvestViewSwitch() {
  return (
    <div>
      <div className="ym-harvest-switch-row">
        <div className="ym-harvest-view-switch">
          <NavLink to={BASE} end>Calendar</NavLink>
          <NavLink to={`${BASE}/list`}>List</NavLink>
        </div>
        <Link className="ym-harvest-add-link" to={`${BASE}/new`}>+ Add Harvest Batch</Link>
      </div>
      <Outlet />
    </div>
  );
}