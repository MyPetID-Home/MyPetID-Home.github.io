type IconProps = { className?: string };
const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
export function PawPrint(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><circle cx="6" cy="8" r="2"/><circle cx="10" cy="5" r="2"/><circle cx="14" cy="5" r="2"/><circle cx="18" cy="8" r="2"/><path d="M8 16c.6-3 2.3-5 4-5s3.4 2 4 5c.5 2.6-1.2 4-4 4s-4.5-1.4-4-4Z"/></svg>; }
export function ShieldCheck(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/></svg>; }
export function MapPinned(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15M15 6v15"/><path d="M12 7.5a2.5 2.5 0 0 1 2.5 2.5c0 2-2.5 4-2.5 4s-2.5-2-2.5-4A2.5 2.5 0 0 1 12 7.5Z"/></svg>; }
export function Users(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
export function QrCode(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3z"/><path d="M15 15h2v2h-2zM19 15h2v6h-6v-2M13 13h2M13 17h2M17 11h4"/></svg>; }
export function Home(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>; }
export function Footprints(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6C14.6 6 14 7.8 14 9.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4M4 13h4"/></svg>; }
export function FileText(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>; }
export function Bell(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>; }
export function Menu(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M4 7h16M4 12h16M4 17h10"/></svg>; }
export function Close(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M18 6 6 18M6 6l12 12"/></svg>; }
export function Stethoscope(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>; }
export function Chat(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/><path d="M8 9h8M8 13h5"/></svg>; }
export function User(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>; }
export function Settings(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.6a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.6a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/></svg>; }
export function Sparkles(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M19 3v4M21 5h-4M5 17v4M7 19H3"/></svg>; }
export function Heart(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/></svg>; }
export function Trophy(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2-1.2.5-2 2-2 3.8M14 14.7V17c0 .6.5 1 1 1.2 1.2.5 2 2 2 3.8"/><path d="M18 2H6v7a6 6 0 0 0 12 0Z"/></svg>; }
export function Nfc(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M6 8.3a6 6 0 0 1 0 7.4M9.5 6a10 10 0 0 1 0 12M13 3.5a14 14 0 0 1 0 17"/><path d="M17 2a18 18 0 0 1 0 20"/></svg>; }
export function ArrowRight(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>; }
export function Check(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="m5 12 5 5 9-10"/></svg>; }
export function Google(props: IconProps) { return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.6-.2-2.3H12v4.3h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2-1.9 3.2-4.7 3.2-8.2Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.7 14a6.6 6.6 0 0 1 0-4.2V7H2a11 11 0 0 0 0 9.9Z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2 7l3.7 2.8C6.6 7.3 9.1 5.4 12 5.4Z"/></svg>; }
/** Menu button icon: a dog bone in two halves that snaps apart ("broken") when the menu is open. */
export function BoneMenu({ broken = false }: { broken?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`boneMenu ${broken ? 'broken' : ''}`} aria-hidden="true">
      <g className="boneHalf left"><circle cx="5" cy="9.2" r="2.7" /><circle cx="5" cy="14.8" r="2.7" /><path d="M5.5 10.3H12l.9 1.2-1 .9.8 1.3H5.5Z" /></g>
      <g className="boneHalf right"><circle cx="19" cy="9.2" r="2.7" /><circle cx="19" cy="14.8" r="2.7" /><path d="M12 10.3h6.5v3.4h-5.8l-.8-1.3 1-.9Z" /></g>
    </svg>
  );
}
export function Lock(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>; }
export function Bowl(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M7 8c0-1.5 1.3-2 2.5-2M12 7c0-1.5 1.3-2.5 2.5-2.5"/></svg>; }
export function Activity(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>; }
export function Scissors(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>; }
export function Plus(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="M12 5v14M5 12h14"/></svg>; }
export function ChevronRight(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><path d="m9 6 6 6-6 6"/></svg>; }
export function Calendar(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14l2 2 4-4"/></svg>; }
export function ContactCard(props: IconProps) { return <svg viewBox="0 0 24 24" {...common} {...props}><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7.5 18a4.5 4.5 0 0 1 9 0M2 7h2M2 12h2M2 17h2"/></svg>; }
