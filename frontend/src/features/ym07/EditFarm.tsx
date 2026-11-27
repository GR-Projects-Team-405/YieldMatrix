import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { FarmForm } from './FarmForm';
import { FarmLoadFeedback } from './FarmLoadFeedback';
import { farmPath } from './farmProfile';
import { useFarm } from './useFarm';

export default function EditFarm() {
  const { farmId = '' } = useParams();
  const { state, retry } = useFarm(farmId);
  const navigate = useNavigate();

  if (state.status !== 'ready') return <FarmLoadFeedback status={state.status} retry={retry} />;
  const details = farmPath(state.farm.id);
  return (
    <FarmForm key={state.farm.id} initial={state.farm} cancelTo={details} onSave={async (_, changes) => {
      await api.patch(`/ym07/farms/${state.farm.id}`, changes);
      navigate(details, { replace: true, state: { farmNotice: 'Farm changes saved.' } });
    }} />
  );
}
