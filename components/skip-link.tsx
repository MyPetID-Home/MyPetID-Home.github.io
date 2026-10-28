"use client";

/**
 * "Skip to content" for keyboard and screen-reader users (first focusable element on every page).
 * Pages render their own <main>; this moves focus to the first one without needing an id on each.
 * Styles: the `/* Accessibility *\/` block at the end of app/globals.css.
 */
export function SkipLink() {
  function skip(event: React.MouseEvent<HTMLAnchorElement>) {
    const main = document.getElementById('main-content') || document.querySelector('main');
    if (!main) return;
    event.preventDefault();
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    main.focus();
    main.scrollIntoView({ block: 'start' });
  }
  return <a className="skipLink" href="#main-content" onClick={skip}>Skip to content</a>;
}
