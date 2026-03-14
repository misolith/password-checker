const I18N = {
  fi: {
    labels: { weak: 'Heikko', moderate: 'Kohtalainen', good: 'Hyvä', strong: 'Vahva', dangerous: 'VAARALLINEN' },
    tips: {
      empty: 'Kirjoita salasana arvioitavaksi.',
      repetition: 'Salasana sisältää paljon toistoa tai vähän eri merkkejä.',
      sequence: 'Vältä näppäimistö- tai numerojärjestyksiä.',
      short: 'Lyhyt salasana on helpompi murtaa. Tavoittele vähintään 12 merkkiä.',
      phrase: 'Pitkäkin salasanalauseke kannattaa maustaa satunnaisella osalla, jos se koostuu vain yleisistä sanoista.',
      year: 'Vältä vuosilukuja (esim. 2026) salasanan osana.',
      pwned: 'Salasana löytyi tunnetuista tietovuodoista (HIBP). Älä käytä tätä salasanaa.'
    },
    errors: { noDecoder: 'Base64-dekooderia ei löytynyt tästä ajoympäristöstä.' }
  },
  en: {
    labels: { weak: 'Weak', moderate: 'Moderate', good: 'Good', strong: 'Strong', dangerous: 'DANGEROUS' },
    tips: {
      empty: 'Enter a password to analyze.',
      repetition: 'Password contains heavy repetition or too few unique characters.',
      sequence: 'Avoid keyboard patterns and number sequences.',
      short: 'Short passwords are easier to crack. Aim for at least 12 characters.',
      phrase: 'Even long passphrases should include a random element when built from very common words.',
      year: 'Avoid years (e.g. 2026) as part of a password.',
      pwned: 'Found in known data breaches (HIBP). Do not use this password.'
    },
    errors: { noDecoder: 'No base64 decoder available in this runtime.' }
  }
};

const ASCII_LETTER_RUN_RE = /[A-Za-z]+/g;

export class PasswordDefenseCore {
  constructor(cfg = {}) {
    this.defaultLanguage = cfg.defaultLanguage || 'en';
    this.locale = cfg.locale || 'en';
    this.activeLanguages = cfg.activeLanguages || [this.defaultLanguage];
    this.languages = cfg.languages || cfg.blooms || {};
    this.hibp = {
      enabled: !!cfg.hibp?.enabled,
      endpoint: cfg.hibp?.endpoint || 'https://api.pwnedpasswords.com/range/',
      timeoutMs: Number(cfg.hibp?.timeoutMs || 6000)
    };
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

  resolveLocale(locale) {
    return I18N[locale] ? locale : 'en';
  }

  t(path, locale = this.locale) {
    const dict = I18N[this.resolveLocale(locale)] || I18N.en;
    return path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), dict) || path;
  }

  setLocale(locale = 'en') {
    this.locale = this.resolveLocale(locale);
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

    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(padded, 'base64'));
    }
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

  createUnicodeRegex(source, flags) {
    try {
      return new RegExp(source, flags);
    } catch {
      return null;
    }
  }

  getLetterRuns(input) {
    const source = String(input || '');
    const matches = [];
    const re = this.createUnicodeRegex('\\p{L}+', 'gu') || new RegExp(ASCII_LETTER_RUN_RE);
    let match;
    while ((match = re.exec(source)) !== null) {
      matches.push({ text: match[0], start: match.index });
    }
    return matches;
  }

  findDictionaryMatches(password, languages) {
    const matches = [];
    const seen = new Set();
    const letterRuns = this.getLetterRuns(password);

    for (const run of letterRuns) {
      const normalized = run.text.toLowerCase();
      for (let i = 0; i < normalized.length; i++) {
        const maxLen = Math.min(20, normalized.length - i);
        for (let len = maxLen; len >= 3; len--) {
          const part = normalized.substring(i, i + len);
          if (part.length < 3) continue;
          if (!this.checkBloom(part, { languages })) continue;

          const start = run.start + i;
          const key = `${start}:${part}`;
          if (!seen.has(key)) {
            matches.push({ part, start, len });
            seen.add(key);
          }
          i += len - 1;
          break;
        }
      }
    }

    return matches.sort((a, b) => a.start - b.start);
  }

  assessPassphrase(password, matchedParts = []) {
    if (matchedParts.length < 2) {
      return { qualifies: false, words: 0, separators: 0, coverage: 0, bonus: 0, strategy: matchedParts.length === 1 ? 'word_based' : 'random' };
    }

    const uniqueWords = [...new Set(matchedParts.map((m) => m.part))];
    const separatorRe = this.createUnicodeRegex('[^0-9\\p{L}]+', 'gu');
    const separators = separatorRe ? (password.match(separatorRe) || []).length : (password.match(/[^0-9A-Za-z]+/g) || []).length;
    const letterChars = this.getLetterRuns(password).reduce((sum, run) => sum + run.text.length, 0);
    const coveredChars = matchedParts.reduce((sum, match) => sum + match.len, 0);
    const coverage = letterChars > 0 ? coveredChars / letterChars : 0;
    const longEnough = password.length >= 16;
    const enoughWords = uniqueWords.length >= 3 || (uniqueWords.length >= 2 && password.length >= 24 && separators >= 1);
    const qualifies = longEnough && enoughWords && coverage >= 0.6;

    let bonus = 0;
    if (qualifies) {
      // 3-word passphrase gets baseline uplift; 4+ words doubles the phrase uplift.
      bonus = 18;
      if (uniqueWords.length >= 4) bonus *= 2;
      if (password.length >= 24) bonus += 8;
      if (separators >= 2) bonus += 4;
      bonus = Math.min(60, bonus);
    }

    let strategy = 'mixed';
    if (qualifies) strategy = 'passphrase';
    else if (coverage >= 0.75) strategy = 'word_based';

    return {
      qualifies,
      words: uniqueWords.length,
      separators,
      coverage,
      bonus,
      strategy
    };
  }

  async sha1Hex(input) {
    const data = new TextEncoder().encode(input);
    if (!globalThis.crypto?.subtle) {
      throw new Error('WebCrypto subtle API not available for SHA-1');
    }
    const hash = await globalThis.crypto.subtle.digest('SHA-1', data);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  async checkPwned(password, options = {}) {
    const enabled = options.enabled ?? this.hibp.enabled;
    if (!enabled) return { enabled: false, pwned: false };
    if (!password || password.length < 1) return { enabled: true, pwned: false, count: 0 };

    const hashHex = await this.sha1Hex(password);
    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || this.hibp.timeoutMs);
    try {
      const endpoint = options.endpoint || this.hibp.endpoint;
      const res = await fetch(`${endpoint}${prefix}`, { signal: controller.signal });
      if (!res.ok) {
        return { enabled: true, pwned: false, count: 0, error: `hibp_http_${res.status}` };
      }
      const text = await res.text();
      const line = text.split('\n').find((l) => l.toUpperCase().startsWith(suffix));
      if (!line) return { enabled: true, pwned: false, count: 0 };
      const count = Number((line.split(':')[1] || '0').trim()) || 0;
      return { enabled: true, pwned: count > 0, count };
    } catch (err) {
      return { enabled: true, pwned: false, count: 0, error: err?.name || String(err) };
    } finally {
      clearTimeout(timeout);
    }
  }

  async analyzeAsync(pw, options = {}) {
    const locale = this.resolveLocale(options.locale || this.locale);
    const base = this.analyze(pw, { ...options, locale });
    const hibp = await this.checkPwned(pw, options.hibp || {});
    if (hibp.pwned) {
      return {
        ...base,
        score: 0,
        label: this.t('labels.dangerous', locale),
        labelKey: 'dangerous',
        confidence: 'high',
        tips: [...base.tips, this.t('tips.pwned', locale)],
        riskFlags: [...new Set([...(base.riskFlags || []), 'hibp_breached'])],
        scoreBreakdown: {
          ...(base.scoreBreakdown || {}),
          final: 0,
          hibpOverride: true
        },
        hibp
      };
    }
    return { ...base, hibp };
  }

  analyze(pw, options = {}) {
    const locale = this.resolveLocale(options.locale || this.locale);
    if (!pw) return { score: 0, label: this.t('labels.weak', locale), tips: [this.t('tips.empty', locale)] };

    let charsetSize = 0;
    if (/[a-z]/.test(pw)) charsetSize += 26;
    if (/[A-Z]/.test(pw)) charsetSize += 26;
    if (/[0-9]/.test(pw)) charsetSize += 10;
    if (/[^A-Za-z0-9]/.test(pw)) charsetSize += 33;
    const baselineScore = (pw.length * Math.log2(charsetSize || 1) / 80) * 100;
    let score = baselineScore;

    let penalty = 0;
    const penaltyBreakdown = { repetition: 0, sequence: 0, shortLength: 0, year: 0, dictionary: 0, predictablePhrase: 0 };
    const riskFlags = [];
    const tips = [];
    const uniqueChars = new Set(pw.split('')).size;
    if (pw.length > 6) {
      const ratio = uniqueChars / pw.length;
      if (ratio <= 0.6) {
        const p = Math.round((1 - ratio) * 80);
        penalty += p;
        penaltyBreakdown.repetition += p;
        riskFlags.push('repetition');
        tips.push(this.t('tips.repetition', locale));
      }
    }
    if (/(123|abc|qwe|asd|zxc|321|cba|ewq)/i.test(pw)) {
      penalty += 20;
      penaltyBreakdown.sequence += 20;
      riskFlags.push('sequence');
      tips.push(this.t('tips.sequence', locale));
    }

    // Short passwords are easier to brute-force even with decoration/leetspeak.
    if (pw.length < 12) {
      penalty += 24; // 1.5x from prior 16
      penaltyBreakdown.shortLength += 24;
      riskFlags.push('short_length');
      tips.push(this.t('tips.short', locale));
    }

    // Year-like patterns are highly predictable (e.g. name + 2026 + !)
    if (/(?:19\d{2}|20\d{2})/.test(pw)) {
      penalty += 36; // doubled year penalty
      penaltyBreakdown.year += 36;
      riskFlags.push('year_pattern');
      tips.push(this.t('tips.year', locale));
    }

    const langs = options.languages || this.activeLanguages;
    const matchedParts = this.findDictionaryMatches(pw, langs);
    const dictionaryMatches = matchedParts.length;
    const passphrase = this.assessPassphrase(pw, matchedParts);

    const letterRuns = this.getLetterRuns(pw);
    const letterCount = letterRuns.reduce((sum, run) => sum + run.text.length, 0);
    const matchedLetterCount = matchedParts.reduce((sum, m) => sum + m.len, 0);
    const dictionaryCoverage = letterCount > 0 ? matchedLetterCount / letterCount : 0;

    if (dictionaryMatches === 1) penaltyBreakdown.dictionary += 40;
    else if (dictionaryMatches === 2) penaltyBreakdown.dictionary += 35;
    else if (dictionaryMatches > 2) penaltyBreakdown.dictionary += 15;

    if (penaltyBreakdown.dictionary > 0) {
      if (passphrase.qualifies) {
        penaltyBreakdown.dictionary = Math.max(10, penaltyBreakdown.dictionary - 10);
      }
      penalty += penaltyBreakdown.dictionary;
      riskFlags.push('dictionary_pattern');
    }

    // If phrase is almost entirely common dictionary words, keep score realistic.
    const wordOnlyComposition = /^[A-Za-zÅÄÖåäö\-_'\s]+$/.test(pw);
    const isPredictablePhrase = passphrase.qualifies && (dictionaryCoverage >= 0.9 || (wordOnlyComposition && passphrase.words >= 3));
    if (isPredictablePhrase) {
      penaltyBreakdown.predictablePhrase = 35;
      penalty += penaltyBreakdown.predictablePhrase;
      riskFlags.push('predictable_phrase');
      tips.push(this.t('tips.phrase', locale));
    }

    const bonusBreakdown = { passphrase: 0 };
    if (passphrase.qualifies && !riskFlags.includes('sequence') && !riskFlags.includes('year_pattern')) {
      bonusBreakdown.passphrase = isPredictablePhrase
        ? Math.max(6, Math.round(passphrase.bonus * 0.35))
        : passphrase.bonus;
    }

    const rawScore = Math.max(0, Math.min(100, Math.round(score - penalty + bonusBreakdown.passphrase)));

    // Base label by score band
    let labelKey = 'weak';
    if (rawScore >= 85) labelKey = 'strong';
    else if (rawScore >= 70) labelKey = 'good';
    else if (rawScore >= 40) labelKey = 'moderate';

    // Conservative cap: predictable structure cannot be labeled too high
    const hasCriticalRisk = riskFlags.includes('year_pattern') || riskFlags.includes('dictionary_pattern') || riskFlags.includes('sequence');
    if (hasCriticalRisk && (labelKey === 'strong' || labelKey === 'good')) {
      labelKey = passphrase.qualifies && !riskFlags.includes('year_pattern') && !riskFlags.includes('sequence') ? 'good' : 'moderate';
    }

    if (rawScore === 0 && penalty >= 50) labelKey = 'dangerous';

    const label = this.t(`labels.${labelKey}`, locale);

    // No global score capping. Only apply a soft ceiling for highly predictable, word-only passphrases.
    let adjustedScore = rawScore;
    if (isPredictablePhrase) {
      const softCeiling = Math.min(88, 70 + Math.max(0, (pw.length - 12) * 0.8));
      adjustedScore = Math.min(adjustedScore, Math.round(softCeiling));
    }
    return {
      score: adjustedScore,
      rawScore,
      label,
      labelKey,
      confidence: hasCriticalRisk ? 'high' : (matchedParts.length > 0 ? 'medium' : 'low'),
      tips,
      matches: dictionaryMatches,
      matchedParts,
      strategy: passphrase.strategy,
      dictionaryWordCount: passphrase.words,
      riskFlags: [...new Set(riskFlags)],
      scoreBreakdown: {
        baseline: Math.round(baselineScore),
        penalties: penaltyBreakdown,
        bonuses: bonusBreakdown,
        totalPenalty: penalty,
        rawFinal: rawScore,
        capPenalty: Math.max(0, rawScore - adjustedScore),
        final: adjustedScore
      },
      languages: langs
    };
  }
}
