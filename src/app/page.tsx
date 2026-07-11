import Link from 'next/link';
import { UniverseShell } from '@/ui/UniverseShell';

export default function Page() {
  return (
    <main>
      {/* Crawler/no-JS path: the Mission Log carries all content (§14.1, §15) */}
      <noscript>
        <p>
          This experience requires JavaScript. The full content is available in the{' '}
          <Link href="/log">Mission Log</Link>.
        </p>
      </noscript>
      <UniverseShell />
    </main>
  );
}
