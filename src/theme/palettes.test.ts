import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PALETTES,
  alertInkFor,
  contrastRatio,
  inkForFill,
  isLightColor,
  linkFor,
  migratePalette,
} from './palettes';

describe('migratePalette', () => {
  it('maps legacy dark themes to Plum night and light themes to Forest', () => {
    assert.equal(migratePalette('midnight'), 'plum');
    assert.equal(migratePalette('carbon'), 'plum');
    assert.equal(migratePalette('plum'), 'plum');
    assert.equal(migratePalette('cream'), 'forest');
    assert.equal(migratePalette('light'), 'forest');
    assert.equal(migratePalette('forest'), 'forest');
    assert.equal(migratePalette(undefined), 'forest');
    assert.equal(migratePalette('saffron'), 'forest');
    assert.equal(migratePalette('alpine'), 'forest');
    assert.equal(migratePalette('olive'), 'forest');
  });
});

describe('palette contrast', () => {
  it('keeps Forest and Plum night text at WCAG AA', () => {
    for (const id of ['forest', 'plum'] as const) {
      const p = PALETTES[id];
      const bgs = [p.background, p.surface];
      for (const bg of bgs) {
        assert.ok(contrastRatio(p.text, bg) >= 4.5, `${id} text on ${bg}`);
        assert.ok(contrastRatio(p.mutedText, bg) >= 4.5, `${id} mutedText on ${bg}`);
        assert.ok(contrastRatio(p.success, bg) >= 4.5, `${id} success on ${bg}`);
        assert.ok(contrastRatio(alertInkFor(p), bg) >= 4.5, `${id} alert ink on ${bg}`);
        assert.ok(contrastRatio(linkFor(p), bg) >= 4.5, `${id} link on ${bg}`);
      }
      const onPrimary = inkForFill(p.primary, p.background, isLightColor(p.background) ? '#000000' : p.background);
      assert.ok(contrastRatio(onPrimary, p.primary) >= 4.5, `${id} onPrimary`);
    }
  });

  it('stores the specified brand colors and locks the Pro themes', () => {
    assert.equal(PALETTES.forest.locked, false);
    assert.equal(PALETTES.forest.primary, '#2A4343');
    assert.equal(PALETTES.forest.secondary, '#416B66');
    assert.equal(PALETTES.forest.accent, '#F1D49A');
    assert.equal(PALETTES.forest.alert, '#D35E36');
    assert.equal(PALETTES.forest.mutedText, '#646756');
    assert.equal(PALETTES.forest.background, '#FBF6EA');
    assert.equal(PALETTES.plum.locked, false);
    assert.equal(PALETTES.plum.background, '#2B2238');
    assert.equal(PALETTES.plum.surface, '#3A3049');
    assert.equal(PALETTES.plum.primary, '#8E7DBE');
    assert.equal(PALETTES.plum.accent, '#F2B134');
    assert.equal(PALETTES.plum.alert, '#D9534F');
    assert.equal(PALETTES.plum.text, '#F7F3F9');
    assert.equal(PALETTES.plum.mutedText, '#C9BFD6');
    assert.deepEqual(
      [PALETTES.saffron.locked, PALETTES.alpine.locked, PALETTES.olive.locked],
      [true, true, true],
    );
  });
});
