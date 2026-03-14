import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { PasswordDefenseCore } from '../src/index.js';

const bloom = JSON.parse(fs.readFileSync(new URL('../fixtures/blooms.generated.json', import.meta.url), 'utf8'));

function mkCore() {
  return new PasswordDefenseCore({
    defaultLanguage: bloom.defaultLanguage,
    locale: 'en',
    languages: bloom.languages,
    activeLanguages: ['fi', 'en']
  });
}

const CASES = [
  // very weak / predictable
  { pw: '123456', min: 0, max: 25 },
  { pw: 'qwerty', min: 0, max: 25 },
  { pw: 'password', min: 0, max: 45 },
  { pw: 'Password123', min: 0, max: 45 },
  { pw: 'Kissa2026!', min: 10, max: 60 },
  // corner: long + mixed random tail should not collapse to weak
  { pw: 'Kissa-ajaa-autolla-kovaa-eirbfkdlwwwiwiqiii€7u66(((', min: 60, max: 100 },

  // weak -> moderate
  { pw: 'Miso2026!', min: 15, max: 65 },
  { pw: 'AutoAjaa2026!', min: 10, max: 60 },
  { pw: 'lintulentaa', min: 15, max: 65 },
  { pw: 'liikennevalo', min: 15, max: 60 },
  { pw: 'testi-testi', min: 0, max: 45 },

  // moderate
  { pw: 'CoffeeMugRiver7', min: 45, max: 100 },
  { pw: 'Solar-Bridge-19', min: 45, max: 100 },
  { pw: 'north:river:stone', min: 45, max: 100 },
  { pw: 'Metsa!Joki!Taivas', min: 45, max: 100 },
  { pw: 'Harbor_Owl_Quartz9', min: 50, max: 100 },

  // stronger random-ish
  { pw: 'x7$Qp2!mR9#tV4', min: 70, max: 100 },
  { pw: 'vT9!mK2#rP7$zD4', min: 70, max: 100 },
  // corner: short random can be high but should not exceed sensible ceiling too easily
  { pw: 'xK9!qP2$', min: 45, max: 95 },
  { pw: 'R9$kP2!vT7#mL4@q', min: 75, max: 100 },
  { pw: 'N4!qZ8@vP2#rT7$mK5', min: 75, max: 100 },
  { pw: 'cA9!tQ2#vL7$mR4@pZ8%', min: 80, max: 100 }
];

test('score regression ranges stay stable-ish across updates', () => {
  const core = mkCore();

  for (const c of CASES) {
    const r = core.analyze(c.pw, { locale: 'en', languages: ['fi', 'en'] });
    assert.ok(
      r.score >= c.min && r.score <= c.max,
      `Password "${c.pw}" expected ${c.min}-${c.max}, got ${r.score} (label=${r.label}, flags=${(r.riskFlags || []).join(',')})`
    );
  }
});
