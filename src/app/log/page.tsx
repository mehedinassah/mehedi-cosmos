import Link from 'next/link';
import { universe } from '@/content/universe';

export const metadata = { title: 'Mission Log — Mehedi Hassan' };

/**
 * SSR'd semantic mirror — SEO + no-WebGL + screen-reader path (ADR-004).
 * Complete content as a real document.
 */
export default function LogPage() {
  return (
    <article className="log log--page">
      <header className="log__header">
        <h1>Mission Log</h1>
        <Link href="/">← Return to the universe</Link>
      </header>
      {universe.bodies.map((b) => (
        <section key={b.id} className="log__entry">
          <h2>{b.log.heading}</h2>
          <p className="log__meaning">{b.meaning}</p>
          <p>{b.log.body}</p>
          {b.log.links.length > 0 && (
            <ul>
              {b.log.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href}>{l.label}</a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <section className="log__entry">
        <h2>Skills</h2>
        <ul>
          {universe.skills.map((s) => (
            <li key={s.id}>{s.name}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
