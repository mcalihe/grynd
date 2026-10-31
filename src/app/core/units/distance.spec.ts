import {
  displayToMeters,
  formatDistance,
  formatTempo,
  M_PER_MI,
  metersToDisplay,
  tempo,
} from './distance';

describe('distance units (decision 0024)', () => {
  it('shows metres in km or mi, rounded to 0.01', () => {
    expect(metersToDisplay(5234, 'km')).toBe(5.23);
    expect(metersToDisplay(M_PER_MI * 3.1, 'mi')).toBe(3.1);
    expect(metersToDisplay(null, 'km')).toBeNull();
  });

  it('stores typed values so the same value shows again', () => {
    expect(displayToMeters(5.2, 'km')).toBe(5200);
    const meters = displayToMeters(3.15, 'mi');
    expect(metersToDisplay(meters, 'mi')).toBe(3.15);
    expect(displayToMeters(null, 'mi')).toBeNull();
  });

  it('works out pace, speed and splits', () => {
    expect(tempo('pace', 1500, 5000, 'km')).toEqual({ kind: 'pace', secondsPer: 300 });
    expect(tempo('pace', 1500, M_PER_MI * 2, 'mi')).toEqual({ kind: 'pace', secondsPer: 750 });
    expect(tempo('speed', 3600, 25_000, 'km')).toEqual({ kind: 'speed', perHour: 25 });
    expect(tempo('split500', 480, 2000, 'km')).toEqual({
      kind: 'split',
      secondsPer: 120,
      meters: 500,
    });
    expect(tempo('split100', 1800, 1500, 'mi')).toEqual({
      kind: 'split',
      secondsPer: 120,
      meters: 100,
    });
  });

  it('has no tempo without distance or duration', () => {
    expect(tempo('pace', 1500, null, 'km')).toBeNull();
    expect(tempo('pace', 0, 5000, 'km')).toBeNull();
    expect(tempo(null, 1500, 5000, 'km')).toBeNull();
  });

  it('formats tempo and distance', () => {
    expect(formatTempo({ kind: 'pace', secondsPer: 288 }, 'km', 'de')).toBe('4:48 /km');
    expect(formatTempo({ kind: 'speed', perHour: 25.3 }, 'km', 'de')).toBe('25,3 km/h');
    expect(formatTempo({ kind: 'speed', perHour: 15 }, 'mi', 'en')).toBe('15 mph');
    expect(formatTempo({ kind: 'split', secondsPer: 120, meters: 500 }, 'km', 'de')).toBe(
      '2:00 /500 m',
    );
    expect(formatDistance(5234, 'km', 'de')).toBe('5,23 km');
    expect(formatDistance(M_PER_MI * 3.1, 'mi', 'en')).toBe('3.1 mi');
  });
});
