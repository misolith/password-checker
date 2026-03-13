import { PasswordDefenseCore } from '../src/index.js';
import fs from 'fs';

const bloom = JSON.parse(fs.readFileSync(new URL('../fixtures/blooms.generated.json', import.meta.url), 'utf8'));
const core = new PasswordDefenseCore({
  defaultLanguage: bloom.defaultLanguage,
  languages: bloom.languages,
  activeLanguages: ['fi', 'en']
});

console.log('lintu', core.checkBloom('lintu'));
console.log('password', core.checkBloom('password'));
console.log('random', core.checkBloom('qzxvbnm'));
console.log('analyze', core.analyze('passwordaurinko'));
console.log('analyzeAsync', await core.analyzeAsync('passwordaurinko'));
