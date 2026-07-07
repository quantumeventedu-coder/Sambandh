const { haversineKm, cityDistanceKm, userDistanceKm } = require('../src/data/cities');

describe('geo distance', () => {
  test('haversine matches known Mumbai–Delhi distance (~1150 km)', () => {
    const d = haversineKm(19.076, 72.8777, 28.7041, 77.1025);
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1200);
  });

  test('distance to self is 0', () => {
    expect(haversineKm(19.076, 72.8777, 19.076, 72.8777)).toBe(0);
  });

  test('invalid/missing coordinates return null (never NaN)', () => {
    expect(haversineKm(19, 72, undefined, 72)).toBeNull();
    expect(haversineKm(NaN, 1, 2, 3)).toBeNull();
  });

  test('cityDistanceKm resolves known Indian cities', () => {
    const d = cityDistanceKm('Mumbai', 'Delhi');
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1200);
  });

  test('userDistanceKm prefers precise coords over city centroids', () => {
    // Both users list "Mumbai" (centroid distance would be 0), but their real
    // GPS points are ~15 km apart — precise coords must win.
    const me = { profile: { city: 'Mumbai', location: { lat: 19.076, lng: 72.8777 } } };
    const u = { profile: { city: 'Mumbai', location: { lat: 19.20, lng: 72.90 } } };
    const d = userDistanceKm(me, u);
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(30);
  });

  test('userDistanceKm falls back to city when a user lacks coords', () => {
    const me = { profile: { city: 'Mumbai', location: { lat: 19.076, lng: 72.8777 } } };
    const u = { profile: { city: 'Delhi' } };
    expect(userDistanceKm(me, u)).toBeGreaterThan(1100);
  });
});
