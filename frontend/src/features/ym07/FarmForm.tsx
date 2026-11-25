import { isAxiosError } from 'axios';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { ContentCard } from '../../components/ContentCard';
import { InputField } from '../../components/InputField';
import { SelectField } from '../../components/SelectField';
import type { FarmProfile } from './farmProfile';
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

export function FarmForm({ initial, cancelTo, onSave }: {
  initial?: FarmProfile;
  cancelTo: string;
  onSave: (profile: FarmProfile, changes: Partial<FarmProfile>) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const initialDistrict = initial?.district ?? '';
  const predefinedDistrict = districtOptions.slice(0, -1).some((option) => option.value === initialDistrict);
  const [district, setDistrict] = useState(predefinedDistrict ? initialDistrict : 'other');
  const [otherDistrict, setOtherDistrict] = useState(predefinedDistrict ? '' : initialDistrict);
  const [pickup, setPickup] = useState(initial?.pickup_address ?? '');
  const editing = Boolean(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);

  const dirty = initial && (name !== initial.name || pickup !== initial.pickup_address ||
    (district === 'other' ? otherDistrict : district) !== initial.district);
  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;

    const payload = {
      name: name.trim(),
      district: (district === 'other' ? otherDistrict : district).trim(),
      pickup_address: pickup.trim(),
    };
    const changes: Partial<FarmProfile> = {};
    const nextErrors: FieldErrors = {};
    for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
      if (initial && payload[key] === initial[key].trim()) continue;
      changes[key] = payload[key];
      const { label, max } = fields[key];
      if (!payload[key]) nextErrors[key] = `${label} is required.`;
      else if (payload[key].length > max) nextErrors[key] = `Use at most ${max} characters.`;
    }
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length) return;
    if (editing && !Object.keys(changes).length) {
      setServerError('Make a change before saving.');
      return;
    }

    pending.current = true;
    setSaving(true);
    try {
      await onSave(payload, changes);
    } catch (error) {
      if (isAxiosError<{ error?: string; fields?: FieldErrors }>(error)) {
        setErrors(error.response?.data?.fields ?? {});
        setServerError(error.response?.data?.error || 'Unable to save the farm. Please try again.');
      } else {
        setServerError('Unable to save the farm. Please try again.');
      }
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <section className={styles.page} aria-labelledby="ym07-add-heading">
      <h1 id="ym07-add-heading" className={styles.heading}>{editing ? 'Edit farm' : 'Add farm'}</h1>
      <div className={styles.formLayout}>
        <ContentCard title={editing ? 'Update farm information' : 'Let’s set up your farm'} subtitle="Fields marked * are required.">
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
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add farm'}</Button>
              {!saving && <Link className="ym-button ym-button--outline" to={cancelTo} onClick={(event) => { if (dirty && !window.confirm('Discard unsaved changes?')) event.preventDefault(); }}>Cancel</Link>}
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
