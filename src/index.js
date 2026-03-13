const I18N = {
  fi: {
    labels: { weak: 'Heikko', moderate: 'Kohtalainen', strong: 'Vahva', dangerous: 'VAARALLINEN' },
    tips: {
      empty: 'Kirjoita salasana arvioitavaksi.',
      repetition: 'Salasana sisältää paljon toistoa tai vähän eri merkkejä.',
      sequence: 'Vältä näppäimistö- tai numerojärjestyksiä.'
    },
    errors: { noDecoder: 'Base64-dekooderia ei löytynyt tästä ajoympäristöstä.' }
  },
  en: {
    labels: { weak: 'Weak', moderate: 'Moderate', strong: 'Strong', dangerous: 'DANGEROUS' },
    tips: {
      empty: 'Enter a password to analyze.',
      repetition: 'Password contains heavy repetition or too few unique characters.',
      sequence: 'Avoid keyboard patterns and number sequences.'
    },
    errors: { noDecoder: 'No base64 decoder available in this runtime.' }
  }
};

export class PasswordDefenseCore {
  constructor(cfg = {}) {
    this.defaultLanguage = cfg.defaultLanguage || 'en';
    this.locale = cfg.locale || 'en';
    this.activeLanguages = cfg.activeLanguages || [this.defaultLanguage];
    this.languages = cfg.languages || cfg.blooms || {};
    this.state = {};
    for (const [lang, lc] of Object.entries(this.languages)) {
      this.state[lang] = {
        bloomReady: false,
        bloomBytes: null,
        size: Number(lc.size) || 120000,
        hashes: Number(lc.hashes) || 7,
        minTokenLength: Number(lc.minTokenLength) || 3,
        data: typeof lc.data === 'string' ? lc.data : ''
      };
    }
  }

  t(path) {
    const dict = I18N[this.locale] || I18N.en;
    return path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), dict) || path;
  }

  setLocale(locale = 'en') {
    this.locale = I18N[locale] ? locale : 'en';
  }

  setActiveLanguages(languages = []) {
    if (!Array.isArray(languages) || languages.length === 0) {
      this.activeLanguages = [this.defaultLanguage];
      return;
    }
    this.activeLanguages = languages.filter((l) => this.state[l]);
    if (this.activeLanguages.length === 0) this.activeLanguages = [this.defaultLanguage];
  }

  decodeBloomBase64(b64) {
    const clean = (b64 || '').replace(/[^A-Za-z0-9+/=_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!clean) return null;
    const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4);

    // Node.js path
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(padded, 'base64'));
    }

    // Browser path
    if (typeof atob !== 'undefined') {
      const bin = atob(padded);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }

    throw new Error(this.t('errors.noDecoder'));
  }

  ensureBloomLoaded(lang) {
    const s = this.state[lang];
    if (!s || s.bloomReady) return;
    s.bloomBytes = this.decodeBloomBase64(s.data);
    s.bloomReady = true;
  }

  hash1FNV1a(word) {
    let h = 0x811c9dc5;
    for (let i = 0; i < word.length; i++) {
      h ^= word.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  hash2DJB2(word) {
    let h = 5381;
    for (let i = 0; i < word.length; i++) {
      h = ((h << 5) + h + word.charCodeAt(i)) >>> 0;
    }
    return h >>> 0;
  }

  checkBloomForLanguage(word, lang) {
    const s = this.state[lang];
    if (!s) return false;
    if (!word || word.length < s.minTokenLength) return false;
    this.ensureBloomLoaded(lang);
    if (!s.bloomBytes || s.bloomBytes.length === 0) return false;

    const w = word.toLowerCase();
    const h1 = this.hash1FNV1a(w);
    let h2 = this.hash2DJB2(w);
    if (h2 === 0) h2 = 1;

    for (let i = 0; i < s.hashes; i++) {
      const mixed = (h1 + Math.imul(i, h2) + Math.imul(i, i + 3)) >>> 0;
      const hash = mixed % s.size;
      const byteIdx = Math.floor(hash / 8);
      const bitIdx = hash % 8;
      if (!s.bloomBytes[byteIdx] || !(s.bloomBytes[byteIdx] & (1 << bitIdx))) return false;
    }
    return true;
  }

  checkBloom(word, options = {}) {
    const langs = options.languages || this.activeLanguages;
    for (const lang of langs) {
      if (this.checkBloomForLanguage(word, lang)) return true;
    }
    return false;
  }

  analyze(pw, options = {}) {
    if (options.locale) this.setLocale(options.locale);
    if (!pw) return { score: 0, label: this.t('labels.weak'), tips: [this.t('tips.empty')] };

    let charsetSize = 0;
    if (/[a-z]/.test(pw)) charsetSize += 26;
    if (/[A-Z]/.test(pw)) charsetSize += 26;
    if (/[0-9]/.test(pw)) charsetSize += 10;
    if (/[^A-Za-z0-9]/.test(pw)) charsetSize += 33;
    let score = (pw.length * Math.log2(charsetSize || 1) / 80) * 100;

    let penalty = 0;
    const tips = [];
    const uniqueChars = new Set(pw.split('')).size;
    if (pw.length > 6) {
      const ratio = uniqueChars / pw.length;
      if (ratio <= 0.6) {
        penalty += Math.round((1 - ratio) * 80);
        tips.push(this.t('tips.repetition'));
      }
    }
    if (/(123|abc|qwe|asd|zxc|321|cba|ewq)/i.test(pw)) {
      penalty += 20;
      tips.push(this.t('tips.sequence'));
    }

    let dictionaryMatches = 0;
    const tempPw = pw.toLowerCase();
    const langs = options.languages || this.activeLanguages;

    for (let i = 0; i < tempPw.length; i++) {
      for (let len = 12; len >= 3; len--) {
        if (i + len <= tempPw.length) {
          const part = tempPw.substring(i, i + len);
          if (this.checkBloom(part, { languages: langs })) {
            dictionaryMatches++;
            i += len - 1;
            break;
          }
        }
      }
    }

    if (dictionaryMatches === 1) penalty += 60;
    else if (dictionaryMatches === 2) penalty += 45;
    else if (dictionaryMatches > 2) penalty += 15;

    const finalScore = Math.max(0, Math.min(100, Math.round(score - penalty)));
    let label = this.t('labels.weak');
    if (finalScore >= 80) label = this.t('labels.strong');
    else if (finalScore >= 50) label = this.t('labels.moderate');
    if (finalScore === 0 && penalty >= 50) label = this.t('labels.dangerous');

    return { score: finalScore, label, tips, matches: dictionaryMatches, languages: langs };
  }
}
