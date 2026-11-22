import { useEffect, useState } from 'react';
import { useStore } from './data/store';
import { Logo } from './ui/components/Logo';
import { IconDiary, IconFoods, IconProfile, IconTraining } from './ui/components/Icons';
import { Onboarding } from './ui/screens/Onboarding';
import { Diary } from './ui/screens/Diary';
import { Foods } from './ui/screens/Foods';
import { Training } from './ui/screens/Training';
import { ProfileScreen } from './ui/screens/Profile';

const TABS = [
  { id: 'diary', label: 'Diary', icon: IconDiary },
  { id: 'foods', label: 'Foods', icon: IconFoods },
  { id: 'training', label: 'Training', icon: IconTraining },
  { id: 'profile', label: 'Profile', icon: IconProfile },
] as const;
type Tab = (typeof TABS)[number]['id'];

const fromHash = (): Tab => {
  const h = location.hash.slice(1) as Tab;
  return TABS.some((t) => t.id === h) ? h : 'diary';
};

export function App() {
  const profile = useStore((s) => s.profile);
  const [tab, setTab] = useState<Tab>(fromHash);
  useEffect(() => {
    const on = () => setTab(fromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  if (!profile) return <Onboarding />;

  return (
    <>
      <div className="app">
        <header className="topbar">
          <div className="brand"><Logo /><span className="brand-name">Micenae</span></div>
        </header>
        <div className="meander" />
        <main>
          {tab === 'diary' && <Diary />}
          {tab === 'foods' && <Foods />}
          {tab === 'training' && <Training />}
          {tab === 'profile' && <ProfileScreen />}
        </main>
      </div>
      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => (location.hash = t.id)}>
              <t.icon />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
