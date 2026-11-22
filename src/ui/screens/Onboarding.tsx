import { useStore } from '../../data/store';
import { todayISO } from '../../domain/dates';
import { Logo } from '../components/Logo';
import { ProfileForm } from './ProfileForm';

export function Onboarding() {
  const setProfile = useStore((s) => s.setProfile);
  const logBody = useStore((s) => s.logBody);
  return (
    <div className="app">
      <div className="hero">
        <div className="mark"><Logo size={64} /></div>
        <div className="brand-name" style={{ fontSize: 30 }}>Micenae</div>
        <p>Training and nutrition, measured with care — towards the classical physique.</p>
      </div>
      <div className="meander" />
      <div className="card">
        <h1 className="h-section" style={{ marginBottom: 14 }}>Your measure</h1>
        <ProfileForm
          submitLabel="Begin"
          onSubmit={(p) => {
            setProfile(p);
            logBody({ date: todayISO(), weightKg: p.weightKg, bodyFatPct: p.bodyFatPct });
          }}
        />
      </div>
    </div>
  );
}
