import { DashboardClient } from '../../../components/dashboard-client';

type Tab = 'overview' | 'public' | 'account' | 'pets' | 'walks' | 'diet' | 'medical' | 'docs' | 'play' | 'training' | 'lost' | 'pack' | 'goals' | 'settings' | 'admin';

const routeToTab: Record<string, Tab> = {
  home: 'overview',
  overview: 'overview',
  walks: 'walks',
  pet: 'pets',
  pets: 'pets',
  documents: 'docs',
  docs: 'docs',
  medical: 'medical',
  alerts: 'lost',
  lost: 'lost',
  pack: 'pack',
  settings: 'settings',
  account: 'account',
  public: 'public',
  training: 'training',
  play: 'play',
  goals: 'goals',
  diet: 'diet',
  admin: 'admin',
  'pet/public': 'public',
  'pet/training': 'training',
  'pet/play': 'play',
  'pet/medical': 'medical',
};

const staticRoutes = [
  ['walks'], ['pet'], ['documents'], ['alerts'], ['pack'], ['settings'], ['account'], ['goals'], ['diet'], ['admin'],
  ['pet', 'public'], ['pet', 'medical'], ['pet', 'training'], ['pet', 'play'],
];

export function generateStaticParams() {
  return staticRoutes.map((section) => ({ section }));
}

export const dynamicParams = false;

export default async function DashboardSectionPage({ params }: { params: Promise<{ section: string[] }> }) {
  const { section } = await params;
  const key = section.join('/');
  const initialTab = routeToTab[key] || routeToTab[section.at(-1) || 'overview'] || 'overview';
  return <DashboardClient initialTab={initialTab} />;
}
