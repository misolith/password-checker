export type Locale = string;

export interface HibpOptions {
  enabled?: boolean;
  endpoint?: string;
  timeoutMs?: number;
}

export interface BloomLanguageConfig {
  size: number;
  hashes: number;
  minTokenLength?: number;
  data: string;
}

export interface ScoringConfig {
  baselineMultiplier?: number;
  penalties?: {
    repetitionScale?: number;
    sequence?: number;
    shortLength?: number;
    year?: number;
    predictablePhrase?: number;
    dictionary?: {
      one?: number;
      two?: number;
      many?: number;
      passphraseDiscount?: number;
      passphraseMin?: number;
    };
  };
  bonuses?: {
    passphraseBase?: number;
    fourWordMultiplier?: number;
    longLength?: number;
    separators?: number;
    max?: number;
    predictableFactor?: number;
    predictableMin?: number;
  };
  thresholds?: {
    shortLength?: number;
    passphraseLength?: number;
    passphraseLongLength?: number;
    passphraseCoverage?: number;
    wordOnlyPassphraseWords?: number;
  };
  labels?: {
    moderate?: number;
    good?: number;
    strong?: number;
  };
}

export interface PasswordCheckerConfig {
  defaultLanguage?: string;
  locale?: Locale;
  activeLanguages?: string[];
  languages: Record<string, BloomLanguageConfig>;
  hibp?: HibpOptions;
  scoring?: ScoringConfig;
  i18n?: Record<string, { labels?: Record<string, string>; tips?: Record<string, string>; errors?: Record<string, string> }>;
}

export interface AnalyzeResult {
  score: number;
  rawScore?: number;
  label: string;
  labelKey?: 'weak' | 'moderate' | 'good' | 'strong' | 'dangerous';
  confidence?: 'low' | 'medium' | 'high';
  tips: string[];
  matches: number;
  matchedParts?: Array<{ part: string; start: number; len: number }>;
  strategy?: 'random' | 'word_based' | 'mixed' | 'passphrase';
  dictionaryWordCount?: number;
  riskFlags?: string[];
  scoreBreakdown?: {
    baseline?: number;
    penalties?: { repetition?: number; sequence?: number; shortLength?: number; year?: number; dictionary?: number; predictablePhrase?: number };
    bonuses?: { passphrase?: number };
    totalPenalty?: number;
    rawFinal?: number;
    capPenalty?: number;
    final?: number;
    hibpOverride?: boolean;
  };
  languages?: string[];
}

export interface HibpResult {
  enabled: boolean;
  pwned: boolean;
  count?: number;
  error?: string;
}

export declare class PasswordDefenseCore {
  constructor(cfg: PasswordCheckerConfig);
  setLocale(locale: Locale): void;
  setActiveLanguages(languages: string[]): void;
  checkBloom(word: string, options?: { languages?: string[] }): boolean;
  analyze(password: string, options?: { locale?: Locale; languages?: string[] }): AnalyzeResult;
  checkPwned(password: string, options?: HibpOptions): Promise<HibpResult>;
  analyzeAsync(password: string, options?: { locale?: Locale; languages?: string[]; hibp?: HibpOptions }): Promise<AnalyzeResult & { hibp: HibpResult }>;
}
