export type Token = {
  type: string;
  value: string;
  key: string;
};

export type parameters = Record<string, string> | string[];

export type ref = {
  input: string;
  regex: RegExp;
  parseKey: (v: string) => string;
  type?: string;
};

export type ref3 = {
  input: string;
  regex: RegExp;
  type: string;
};

export type ref2 = {key: string; quoteChar: string};

export type reff = {key: string; value: string};

export type config = Partial<{
  indent: string;
  language: 'db2' | 'n1ql' | 'sql' | 'pl/sql';
  params: parameters;
}>;

export type tokenizerConfig = Partial<{
  reservedWords: string[]; // Reserved words in SQL
  reservedToplevelWords: string[]; // Words that are set to new line separately
  reservedNewlineWords: string[]; // Words that are set to newline
  stringTypes: string[]; // String types to enable: "", '', ``, [], N''
  openParens: string[]; // Opening parentheses to enable, like (, [
  closeParens: string[]; // Closing parentheses to enable, like ), ]
  indexedPlaceholderTypes: string[]; // Prefixes for indexed placeholders, like ?
  namedPlaceholderTypes: string[]; // Prefixes for named placeholders, like @ and :
  lineCommentTypes: string[]; // Line comments to enable, like # and --
  specialWordChars: string[]; // Special chars that can be found inside of words, like @ and #
}>;
