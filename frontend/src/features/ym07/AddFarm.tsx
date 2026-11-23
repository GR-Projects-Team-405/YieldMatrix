import { isAxiosError } from 'axios';
import { useRef, useState, type FormEvent } from 'react';
import { Sprout } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import api from '../../services/api';
import styles from './farms.module.css';

const districtOptions = [
  { value: '', label: 'Select district', disabled: true },
  { value: 'Kandy', label: 'Kandy' },
  { value: 'Matale', label: 'Matale' },
  { value: 'Nuwara Eliya', label: 'Nuwara Eliya' },
  { value: 'other', label: 'Other district' },
];

const fields = {
  name: { label: 'Farm name', max: 120 },
  district: { label: 'District', max: 100 },
  pickup_address: { label: 'Private pickup location', max: 500 },
};
type FieldErrors = Partial<Record<keyof typeof fields, string>>;

export default function AddFarm() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [district, setDistrict] = useState('');
  const [otherDistrict, setOtherDistrict] = useState('');
  const [pickup, setPickup] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;

    const payload = {
      name: name.trim(),
      district: (district === 'other' ? otherDistrict : district).trim(),
      pickup_address: pickup.trim(),
    };
    const nextErrors: FieldErrors = {};
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
      const { label, max } = fields[key];
      if (!payload[key]) nextErrors[key] = `${label} is required.`;
      else if (payload[key].length > max) nextErrors[key] = `Use at most ${max} characters.`;
    }
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length) return;

    pending.current = true;
    setSaving(true);
    try {
      await api.post('/ym07/farms', payload);
      navigate('/farmer/farms', { replace: true, state: { farmNotice: 'Farm added successfully.' } });
    } catch (error) {
      if (isAxiosError<{ error?: string; fields?: FieldErrors }>(error)) {
        setErrors(error.response?.data?.fields ?? {});
        setServerError(error.response?.data?.error || 'Unable to add the farm. Please try again.');
      } else {
        setServerError('Unable to add the farm. Please try again.');
      }
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <section className={styles.page} aria-labelledby="ym07-add-heading">
      <h2 id="ym07-add-heading" className={styles.heading}>Add farm</h2>
      <div className={styles.formLayout}>
        <ContentCard title="Let’s set up your farm" subtitle="Fields marked * are required.">
          <form className={styles.form} onSubmit={submit} noValidate aria-busy={saving}>
            {serverError && <Alert type="error">{serverError}</Alert>}
            <InputField label="Farm name *" placeholder="Enter farm name" value={name}
              onChange={(event) => setName(event.target.value)} error={errors.name} required disabled={saving} />
            <SelectField label="District *" options={districtOptions} value={district}
              onChange={(event) => setDistrict(event.target.value)} error={district === 'other' ? undefined : errors.district} required disabled={saving} />
            {district === 'other' && (
              <InputField label="District name *" placeholder="Enter district name" value={otherDistrict}
                onChange={(event) => setOtherDistrict(event.target.value)} error={errors.district} required disabled={saving} />
            )}
            <InputField label="Private pickup location *" placeholder="Enter private pickup location" value={pickup}
              onChange={(event) => setPickup(event.target.value)} error={errors.pickup_address}
              aria-describedby="ym07-pickup-privacy" required disabled={saving} />
            <p id="ym07-pickup-privacy" className={styles.hint}>Visible only to you, admins and your assigned driver.</p>
            <div className={styles.formActions}>
              <Button type="submit" disabled={saving}>{saving ? 'Adding farm…' : 'Add farm'}</Button>
              {!saving && <Link className="ym-button ym-button--outline" to="/farmer/farms">Cancel</Link>}
            </div>
          </form>
        </ContentCard>
        <aside className={styles.guidance} aria-label="Farm record guidance">
          <Sprout size={22} aria-hidden="true" />
          <h3>Good records. Better harvests.</h3>
          <p>Keep each farm’s location accurate so your harvest batches stay linked to the right place.</p>
          <strong>Your pickup location stays private</strong>
          <p>It will never appear on public pages or QR trace.</p>
        </aside>
      </div>
    </section>
  );
}
