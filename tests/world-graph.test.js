// tests/world-graph.test.js — the relationship-graph pure core (no DB): mutual
// connections, shared context between two users, and the human-readable label.

const wg = require('../src/services/world-graph');

describe('world-graph pure core', () => {
  test('intersectIds returns the shared ids (string-normalised, deduped)', () => {
    expect(wg.intersectIds(['a', 'b', 'c'], ['b', 'c', 'd']).sort()).toEqual(['b', 'c']);
    expect(wg.intersectIds([1, 2], ['2', '3'])).toEqual(['2']);   // number/string equivalence
    expect(wg.intersectIds([], ['x'])).toEqual([]);
  });

  test('sharedContext finds mutual connections, communities, language, intent, city', () => {
    const ctx = wg.sharedContext({
      aUser: { profile: { languages: ['Hindi', 'English'], city: 'Mumbai' }, intent: ['marriage'] },
      bUser: { profile: { languages: ['English', 'Tamil'], city: 'Mumbai' }, intent: ['marriage', 'dating'] },
      aConnIds: ['u1', 'u2', 'u3'],
      bConnIds: ['u2', 'u3', 'u9'],
      aRooms: [{ slug: 'founders', title: "Founders' Corner" }, { slug: 'music', title: 'Music' }],
      bRooms: [{ slug: 'founders', title: "Founders' Corner" }, { slug: 'books', title: 'Books' }]
    });
    expect(ctx.mutualConnections.sort()).toEqual(['u2', 'u3']);
    expect(ctx.sharedCommunities).toEqual([{ slug: 'founders', title: "Founders' Corner" }]);
    expect(ctx.sharedLanguages).toEqual(['English']);
    expect(ctx.sharedIntent).toEqual(['marriage']);
    expect(ctx.sameCity).toBe(true);
    expect(ctx.strength).toBeGreaterThan(0);
    expect(ctx.strength).toBeLessThanOrEqual(1);
  });

  test('strangers with nothing in common → empty context and null label', () => {
    const ctx = wg.sharedContext({
      aUser: { profile: { languages: ['Hindi'], city: 'Delhi' }, intent: ['dating'] },
      bUser: { profile: { languages: ['Tamil'], city: 'Chennai' }, intent: ['friendship'] },
      aConnIds: ['x'], bConnIds: ['y'], aRooms: [], bRooms: []
    });
    expect(ctx.mutualConnections).toEqual([]);
    expect(ctx.sharedCommunities).toEqual([]);
    expect(ctx.sameCity).toBe(false);
    expect(ctx.strength).toBe(0);
    expect(wg.connectionLabel(ctx)).toBeNull();
  });

  test('connectionLabel reads naturally and pluralises', () => {
    const one = wg.connectionLabel({ mutualConnections: ['a'], sharedCommunities: [], sameCity: false, sharedLanguages: [] });
    expect(one).toBe('1 mutual connection');
    const many = wg.connectionLabel({
      mutualConnections: ['a', 'b'],
      sharedCommunities: [{ slug: 'founders', title: "Founders' Corner" }],
      sameCity: true, sharedLanguages: ['English']
    });
    expect(many).toMatch(/^2 mutual connections/);
    expect(many).toContain("Founders' Corner");
    expect(many).toContain('same city');
  });

  test('strength rises with more shared ties (monotone-ish)', () => {
    const weak = wg.sharedContext({ aUser: {}, bUser: {}, aConnIds: ['a'], bConnIds: ['a'], aRooms: [], bRooms: [] });
    const strong = wg.sharedContext({
      aUser: { profile: { city: 'Mumbai' } }, bUser: { profile: { city: 'Mumbai' } },
      aConnIds: ['a', 'b', 'c'], bConnIds: ['a', 'b', 'c'],
      aRooms: [{ slug: 'x', title: 'X' }], bRooms: [{ slug: 'x', title: 'X' }]
    });
    expect(strong.strength).toBeGreaterThan(weak.strength);
  });
});
