import { DashboardClient } from '../../components/dashboard-client';

export const metadata = { title: 'Dashboard | MyPetID' };

export default function DashboardPage() {
  return <DashboardClient initialTab="overview" />;
}
