import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mehedi Hassan — A Universe',
  description:
    'Software Engineer · Creative Technologist · Full-Stack Developer. An explorable universe, not a website.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
