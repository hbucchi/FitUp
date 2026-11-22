import { useEffect, useState } from 'react';
import { useStore } from './data/store';
import { Logo } from './ui/components/Logo';
import { IconDiary, IconFoods, IconProfile, IconTraining } from './ui/components/Icons';
import { Onboarding } from './ui/screens/Onboarding';
import { Diary } from './ui/screens/Diary';
import { Foods } from './ui/screens/Foods';
import { Training } from './ui/screens/Training';
import { ProfileScreen } from './ui/screens/Profile';
import { PlanScreen } from './ui/screens/Plan';
import { LevelUp } from './ui/screens/LevelUp';
import { IconPlan, IconPulse } from './ui/components/IconsExtra';
import { Wellbeing } from './ui/screens/Wellbeing';
import { SignIn } from './ui/screens/SignIn';
import { useAuthUser } from './firebase/auth';
import { db, PREVIEW } from './firebase/app';
import { startSync, type SyncStatus } from './firebase/sync';
import { useSession } from './firebase/session';
import { t } from './i18n';

const TABS = [
  { id: 'diary', label: 'Diary', icon: IconDiary },
  { id: 'plan', label: 'Plan', icon: IconPlan },
  { id: 'wellbeing', label: 'Wellbeing', icon: IconPulse },
  { id: 'foods', label: 'Foods', icon: IconFoods },
  { id: 'training', label: 'Training', icon: IconTraining },
  { id: 'profile', label: 'Profile', icon: IconProfile },
] as const;
type Tab = (typeof TABS)[number]['id'];

const fromHash = (): Tab => {
  const h = location.hash.slice(1) as Tab;
  return TABS.some((tab) => tab.id === h) ? h : 'diary';
};

function Splash({ text }: { text: string }) {
  return (
    <div className="app">
      <div className="hero">
        <div className="mark"><Logo size={56} /></div>
        <p className="muted">{text}</p>
      </div>
    </div>
  );
}

/** Decides between sign-in, account sync and local-only mode. */
export function App() {
  return PREVIEW ? <Main /> : <AccountApp />;
}

function AccountApp() {
  const user = useAuthUser();
  const localMode = useSession((s) => s.localMode);
  const setLocalMode = useSession((s) => s.setLocalMode);
  const [sync, setSync] = useState<SyncStatus>({ state: 'connecting' });

  useEffect(() => {
    if (!user) return;
    if (localMode) setLocalMode(false);
    return startSync(db, user.uid, setSync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  if (user === undefined) return <Splash text={t('Loading…')} />;
  if (!user && !localMode) return <SignIn onLocal={() => setLocalMode(true)} />;
  if (user && sync.state === 'connecting') return <Splash text={t('Opening your diary…')} />;
  if (user && sync.state === 'error' && !useStore.getState().profile)
    return <Splash text={t('Could not load your account: {msg}', { msg: sync.message ?? '' })} />;
  return <Main />;
}

function Main() {
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
          <div className="brand"><Logo /><span className="brand-name">{t('Micenae')}</span></div>
        </header>
        <div className="meander" />
        <main>
          {tab === 'diary' && <Diary />}
          {tab === 'plan' && <PlanScreen />}
          {tab === 'wellbeing' && <Wellbeing />}
          {tab === 'foods' && <Foods />}
          {tab === 'training' && <Training />}
          {tab === 'profile' && <ProfileScreen />}
        </main>
      </div>
      <LevelUp />
      <nav className="tabbar" aria-label={t('Main')}>
        <div className="tabbar-inner">
          {TABS.map((it) => (
            <button key={it.id} className="tab" aria-current={tab === it.id ? 'page' : undefined} onClick={() => (location.hash = it.id)}>
              <it.icon />
              {t(it.label)}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
