"use client";

import { useId } from 'react';
import { LANGS, setLang, useDocumentLang, useT, type Lang } from '../lib/i18n';

/**
 * Language switcher for the finder-facing pages. The static HTML shows English; the saved or
 * browser language is applied after mount (see lib/i18n.ts). The choice is saved as 'mypetid.lang'.
 */
export function LanguagePicker({ className = '' }: { className?: string }) {
  const { t, lang } = useT();
  const id = useId();
  useDocumentLang(lang);
  return (
    <div className={`languagePicker ${className}`.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <label htmlFor={id} className="formHint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
        {t('lang.label')}
      </label>
      <select id={id} value={lang} onChange={(event) => setLang(event.target.value as Lang)} style={{ width: 'auto', minWidth: 0 }}>
        {LANGS.map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.label}</option>)}
      </select>
    </div>
  );
}
