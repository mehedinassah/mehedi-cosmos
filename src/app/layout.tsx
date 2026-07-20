import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mehedi Hassan — A Universe',
  description:
    'Software Engineer · Creative Technologist · Full-Stack Developer. An explorable universe, not a website.',
};

// Full-screen immersive canvas: fill the whole device (under the notch), match
// the browser chrome to the void, and lock zoom so a stray pinch/double-tap
// never leaves the WebGL scene in a half-zoomed state. The /log page is the
// accessible, fully-zoomable text mirror of the same content.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#020207',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
