import { describe, expect, it } from '@jest/globals';

import { fitCamera, shows } from './camera';

describe('fitCamera', () => {
  it('shows nothing without readings', () => {
    expect(fitCamera([])).toBeNull();
  });

  it('centres on the readings and fits the larger span with room around it', () => {
    const camera = fitCamera([
      { latitude: 47.0, longitude: 8.6 },
      { latitude: 47.1, longitude: 8.62 },
    ])!;
    expect(camera.center.latitude).toBeCloseTo(47.05);
    expect(camera.center.longitude).toBeCloseTo(8.61);
    expect(360 / 2 ** camera.zoom).toBeCloseTo(0.14);
  });

  it('zooms no closer than street level for a single reading', () => {
    const camera = fitCamera([{ latitude: 47.0, longitude: 8.6 }])!;
    expect(camera.zoom).toBe(16);
    expect(camera.center).toEqual({ latitude: 47.0, longitude: 8.6 });
  });
});

describe('shows', () => {
  const camera = fitCamera([
    { latitude: 47.0, longitude: 8.6 },
    { latitude: 47.1, longitude: 8.62 },
  ])!;

  it('holds the readings it was fitted to', () => {
    expect(shows(camera, { latitude: 47.1, longitude: 8.62 })).toBe(true);
  });

  it('loses a reading beyond the fitted region', () => {
    expect(shows(camera, { latitude: 47.2, longitude: 8.61 })).toBe(false);
  });
});
