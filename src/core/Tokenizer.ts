import * as _ from 'lodash';
const escapeRegExp = _.escapeRegExp;
import tokenTypes from './tokenTypes';

import {Token, ref, ref2, tokenizerConfig, ref3} from './types';

export default class Tokenizer {
  WHITESPACE_REGEX: RegExp;
  NUMBER_REGEX: RegExp;
  OPERATOR_REGEX: RegExp;
  BLOCK_COMMENT_REGEX: RegExp;
  LINE_COMMENT_REGEX: RegExp;
  RESERVED_TOPLEVEL_REGEX: RegExp;
  RESERVED_NEWLINE_REGEX: RegExp;
  RESERVED_PLAIN_REGEX: RegExp;
  WORD_REGEX: RegExp;
  STRING_REGEX: RegExp;
  OPEN_PAREN_REGEX: RegExp;
  CLOSE_PAREN_REGEX: RegExp;
  INDEXED_PLACEHOLDER_REGEX: RegExp;
  IDENT_NAMED_PLACEHOLDER_REGEX: RegExp;
  STRING_NAMED_PLACEHOLDER_REGEX: RegExp;

  /**
   *  @param cfg
   *  @param cfg.reservedWords - Reserved words in SQL
   *  @param cfg.reservedToplevelWords - Words that are set to new line separately
   *  @param cfg.reservedNewlineWords - Words that are set to newline
   *  @param cfg.stringTypes - String types to enable: "", '', ``, [], N''
   *  @param cfg.openParens - Opening parentheses to enable, like (, [
   *  @param cfg.closeParens - Closing parentheses to enable, like ), ]
   *  @param cfg.indexedPlaceholderTypes - Prefixes for indexed placeholders, like ?
   *  @param cfg.namedPlaceholderTypes - Prefixes for named placeholders, like @ and :
   *  @param cfg.lineCommentTypes - Line comments to enable, like # and --
   *  @param cfg.specialWordChars - Special chars that can be found inside of words, like @ and #
   */
  constructor(cfg: tokenizerConfig) {
    this.WHITESPACE_REGEX = /^(\s+)/;
    this.NUMBER_REGEX = /^((-\s*)?[0-9]+(\.[0-9]+)?|0x[0-9a-fA-F]+|0b[01]+)\b/;
    this.OPERATOR_REGEX = /^(!=|<>|==|<=|>=|!<|!>|\|\||::|->>|->|~~\*|~~|!~~\*|!~~|~\*|!~\*|!~|.)/;

    this.BLOCK_COMMENT_REGEX = /^(\/\*[^]*?(?:\*\/|$))/;
    this.LINE_COMMENT_REGEX = this.createLineCommentRegex(cfg.lineCommentTypes);

    this.RESERVED_TOPLEVEL_REGEX = this.createReservedWordRegex(cfg.reservedToplevelWords);
    this.RESERVED_NEWLINE_REGEX = this.createReservedWordRegex(cfg.reservedNewlineWords);
    this.RESERVED_PLAIN_REGEX = this.createReservedWordRegex(cfg.reservedWords);

    this.WORD_REGEX = this.createWordRegex(cfg.specialWordChars);
    this.STRING_REGEX = this.createStringRegex(cfg.stringTypes);

    this.OPEN_PAREN_REGEX = this.createParenRegex(cfg.openParens);
    this.CLOSE_PAREN_REGEX = this.createParenRegex(cfg.closeParens);

    this.INDEXED_PLACEHOLDER_REGEX = this.createPlaceholderRegex(cfg.indexedPlaceholderTypes, '[0-9]*');
    this.IDENT_NAMED_PLACEHOLDER_REGEX = this.createPlaceholderRegex(cfg.namedPlaceholderTypes, '[a-zA-Z0-9._$]+');
    this.STRING_NAMED_PLACEHOLDER_REGEX = this.createPlaceholderRegex(
      cfg.namedPlaceholderTypes,
      this.createStringPattern(cfg.stringTypes)
    );
  }

  createLineCommentRegex(lineCommentTypes: string[] = []): RegExp {
    return new RegExp(`^((?:${lineCommentTypes.map(c => escapeRegExp(c)).join('|')}).*?(?:\n|$))`);
  }

  createReservedWordRegex(reservedWords: string[] = []): RegExp {
    const reservedWordsPattern = reservedWords.join('|').replace(/ /g, '\\s+');
    return new RegExp(`^(${reservedWordsPattern})\\b`, 'i');
  }

  createWordRegex(specialChars: string[] = []): RegExp {
    // const specialChars = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    return new RegExp(`^([\\w${specialChars.join('')}]+)`);
  }

  createStringRegex(stringTypes: string[] = []): RegExp {
    return new RegExp(`^(${this.createStringPattern(stringTypes)})`);
  }

  // This enables the following string patterns:
  // 1. backtick quoted string using `` to escape
  // 2. square bracket quoted string (SQL Server) using ]] to escape
  // 3. double quoted string using "" or \" to escape
  // 4. single quoted string using '' or \' to escape
  // 5. national character quoted string using N'' or N\' to escape
  createStringPattern(stringTypes: string[] = []): string {
    const patterns: {[k: string]: string} = {
      '``': '((`[^`]*($|`))+)',
      '[]': '((\\[[^\\]]*($|\\]))(\\][^\\]]*($|\\]))*)',
      '""': '(("[^"\\\\]*(?:\\\\.[^"\\\\]*)*("|$))+)',
      // eslint-disable-next-line quotes
      "''": "(('[^'\\\\]*(?:\\\\.[^'\\\\]*)*('|$))+)",
      // eslint-disable-next-line quotes
      "N''": "((N'[^N'\\\\]*(?:\\\\.[^N'\\\\]*)*('|$))+)"
    };
    return stringTypes.map(t => patterns[t]).join('|');
  }

  createParenRegex(parens: string[] = []): RegExp {
    return new RegExp(`^(${parens.map(p => this.escapeParen(p)).join('|')})`, 'i');
  }

  escapeParen(paren: string): string {
    if (paren.length === 1) {
      // A single punctuation character
      return escapeRegExp(paren);
    } else {
      // longer word
      return `\\b${paren}\\b`;
    }
  }

  createPlaceholderRegex(types: string[] = [], pattern: string): RegExp {
    // if (isEmpty(types)) {
    //     return false;
    // }
    const typesRegex = types.map(escapeRegExp).join('|');

    return new RegExp(`^((?:${typesRegex})(?:${pattern}))`);
  }

  /**
   * Takes a SQL string and breaks it into tokens.
   * Each token is an object with type and value.
   *
   * @param {String} input The SQL string
   * @return {Object[]} tokens An array of tokens.
   *  @return {String} token.type
   *  @return {String} token.value
   */
  tokenize(input: string): Token[] {
    const tokens = [];
    let token: Token | undefined = undefined;
    // Keep processing the string until it is empty
    while (input.length) {
      // Get the next token and the token type
      token = this.getNextToken(input, token);
      // Advance the string
      if (token) {
        input = input.substring(token.value.length);
        tokens.push(token);
      }
    }
    // tokens.forEach((val) => console.log(val.type, val.value));
    return tokens;
  }

  getNextToken(input: string, previousToken?: Token): Token | undefined {
    return (
      this.getWhitespaceToken(input) ||
      this.getCommentToken(input) ||
      this.getStringToken(input) ||
      this.getOpenParenToken(input) ||
      this.getCloseParenToken(input) ||
      this.getPlaceholderToken(input) ||
      this.getNumberToken(input) ||
      this.getReservedWordToken(input, previousToken) ||
      this.getWordToken(input) ||
      this.getOperatorToken(input)
    );
  }

  getWhitespaceToken(input: string): Token | undefined {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.WHITESPACE,
      regex: this.WHITESPACE_REGEX
    });
  }

  getCommentToken(input: string): Token | undefined {
    return this.getLineCommentToken(input) || this.getBlockCommentToken(input);
  }

  getLineCommentToken(input: string): Token | undefined {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.LINE_COMMENT,
      regex: this.LINE_COMMENT_REGEX
    });
  }

  getBlockCommentToken(input: string): Token | undefined {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.BLOCK_COMMENT,
      regex: this.BLOCK_COMMENT_REGEX
    });
  }

  getStringToken(input: string): Token | undefined {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.STRING,
      regex: this.STRING_REGEX
    });
  }

  getOpenParenToken(input: string): Token | undefined {
    const tk = this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.OPEN_PAREN,
      regex: this.OPEN_PAREN_REGEX
    });
    if (tk) {
      tk.value = tk.value.toUpperCase();
    }
    return tk;
  }

  getCloseParenToken(input: string): Token | undefined {
    const tk = this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.CLOSE_PAREN,
      regex: this.CLOSE_PAREN_REGEX
    });
    if (tk) {
      tk.value = tk.value.toUpperCase();
    }
    return tk;
  }

  getPlaceholderToken(input: string): Token | undefined {
    return (
      this.getIdentNamedPlaceholderToken(input) ||
      this.getStringNamedPlaceholderToken(input) ||
      this.getIndexedPlaceholderToken(input)
    );
  }

  getIdentNamedPlaceholderToken(input: string): Token | undefined {
    return this.getPlaceholderTokenWithKey({
      input,
      regex: this.IDENT_NAMED_PLACEHOLDER_REGEX,
      parseKey: v => v.slice(1)
    });
  }

  getStringNamedPlaceholderToken(input: string): Token | undefined {
    return this.getPlaceholderTokenWithKey({
      input,
      regex: this.STRING_NAMED_PLACEHOLDER_REGEX,
      parseKey: v => this.getEscapedPlaceholderKey({key: v.slice(2, -1), quoteChar: v.slice(-1)})
    });
  }

  getIndexedPlaceholderToken(input: string): Token | undefined {
    return this.getPlaceholderTokenWithKey({
      input,
      regex: this.INDEXED_PLACEHOLDER_REGEX,
      parseKey: v => v.slice(1)
    });
  }

  getPlaceholderTokenWithKey(_ref: ref): Token | undefined {
    const input = _ref.input;
    const regex = _ref.regex;
    const parseKey = _ref.parseKey;
    const token = this.getTokenOnFirstMatch({input, regex, type: tokenTypes.PLACEHOLDER});
    if (token) {
      token.key = parseKey(token.value);
    }
    return token;
  }

  getEscapedPlaceholderKey(_ref2: ref2): string {
    const key = _ref2.key;
    const quoteChar = _ref2.quoteChar;
    return key.replace(new RegExp(escapeRegExp('\\') + quoteChar, 'g'), quoteChar);
  }

  // Decimal, binary, or hex numbers
  getNumberToken(input: string): Token | undefined {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.NUMBER,
      regex: this.NUMBER_REGEX
    });
  }

  // Punctuation and symbols
  getOperatorToken(input: string): Token | undefined {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.OPERATOR,
      regex: this.OPERATOR_REGEX
    });
  }

  getReservedWordToken(input: string, previousToken?: Token): Token | undefined {
    // A reserved word cannot be preceded by a "."
    // this makes it so in "mytable.from", "from" is not considered a reserved word
    if (previousToken && previousToken.value && previousToken.value === '.') {
      return;
    }
    const tk =
      this.getToplevelReservedToken(input) || this.getNewlineReservedToken(input) || this.getPlainReservedToken(input);
    if (tk) {
      tk.value = tk.value.toUpperCase();
    }
    return tk;
  }

  getToplevelReservedToken(input: string): Token | undefined {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.RESERVED_TOPLEVEL,
      regex: this.RESERVED_TOPLEVEL_REGEX
    });
  }

  getNewlineReservedToken(input: string): Token | undefined {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.RESERVED_NEWLINE,
      regex: this.RESERVED_NEWLINE_REGEX
    });
  }

  getPlainReservedToken(input: string): Token | undefined {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.RESERVED,
      regex: this.RESERVED_PLAIN_REGEX
    });
  }

  getWordToken(input: string): Token | undefined {
    return this.getTokenOnFirstMatch({
      input,
      type: tokenTypes.WORD,
      regex: this.WORD_REGEX
    });
  }

  getTokenOnFirstMatch(_ref3: ref3): Token | undefined {
    const input = _ref3.input;
    const type = _ref3.type;
    const regex = _ref3.regex;
    const matches = input.match(regex);
    if (matches) {
      return {type, value: matches[1], key: ''};
    }
    return;
  }
}
