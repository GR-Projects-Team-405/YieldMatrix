import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { FarmForm } from './FarmForm';
import { farmsPath } from './farmProfile';

export default function AddFarm() {
  const navigate = useNavigate();
  return (
    <FarmForm cancelTo={farmsPath} onSave={async (profile) => {
      await api.post('/ym07/farms', profile);
      navigate(farmsPath, { replace: true, state: { farmNotice: 'Farm added successfully.' } });
    }} />
  );
}
