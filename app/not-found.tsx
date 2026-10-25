import { StatusScreen } from '../components/status-screen';

export default function NotFound() {
  return <main className="statusPage"><StatusScreen kind="notFound" actions={[{ label: 'Go home', href: '/', primary: true }, { label: 'Open the app', href: '/dashboard/' }]} /></main>;
}
