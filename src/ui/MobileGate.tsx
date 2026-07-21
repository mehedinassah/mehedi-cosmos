'use client';

import { useEffect, useState } from 'react';

export type DeviceClass = 'unknown' | 'mobile' | 'desktop';

/**
 * Live device classification. Phones and small/coarse-pointer screens are
 * classed 'mobile' so the heavy WebGL universe never mounts there — they get
 * the gate instead. Re-evaluates on resize/orientation change.
 *
 * Starts 'unknown' (matches SSR) and resolves after mount, so desktop still
 * renders the full shell immediately with no hydration mismatch.
 */
export function useDeviceClass(): DeviceClass {
  const [device, setDevice] = useState<DeviceClass>('unknown');

  useEffect(() => {
    // Phones in either orientation (coarse pointer) up to tablet-ish widths,
    // or any genuinely narrow viewport.
    const mq = window.matchMedia(
      '(max-width: 820px), (pointer: coarse) and (max-width: 1024px)',
    );
    const update = () => setDevice(mq.matches ? 'mobile' : 'desktop');
    update();
    mq.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      mq.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return device;
}

/**
 * Full-screen "please visit on desktop" gate. Shown instead of the universe on
 * phones so viewers never see the (still unfinished) mobile experience.
 */
export function MobileGate() {
  return (
    <div className="mobile-gate" role="alert">
      <div className="mobile-gate__inner">
        <p className="mobile-gate__eyebrow">Transmission from Mission Control</p>
        <h1 className="mobile-gate__title">
          This universe is a little too big for your pocket.
        </h1>
        <p className="mobile-gate__body">
          The full experience runs on real GPU horsepower — the kind your laptop
          hides under the keyboard. Your phone is a magnificent machine, but it
          politely declined to render an entire solar system today.
        </p>
        <p className="mobile-gate__cta">
          Open this on a <strong>laptop or desktop browser</strong> and take the
          full ride.
        </p>
        <p className="mobile-gate__wink">
          (A smartphone version is in the workshop. Your battery thanks you for
          your patience.)
        </p>
        <p className="mobile-gate__signature">— Mehedi Hassan</p>
      </div>
    </div>
  );
}
