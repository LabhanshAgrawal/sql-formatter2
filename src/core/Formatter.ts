import * as _ from 'lodash';
const trimEnd = _.trimEnd;
import tokenTypes from './tokenTypes';
import Indentation from './Indentation';
import InlineBlock from './InlineBlock';
import Params from './Params';
import Tokenizer from './Tokenizer';

import {Token, config} from './types';

export default class Formatter {
  cfg: config;
  indentation: Indentation;
  inlineBlock: InlineBlock;
  params: Params;
  tokenizer: Tokenizer;
  previousReservedWord: Token;
  index: number;
  tokens: Token[];
  /**
   * @param {Object} cfg
   *   @param {Object} cfg.indent
   *   @param {Object} cfg.params
   * @param {Tokenizer} tokenizer
   */
  constructor(cfg: config = {}, tokenizer: Tokenizer) {
    this.cfg = cfg;
    this.indentation = new Indentation(this.cfg.indent);
    this.inlineBlock = new InlineBlock();
    this.params = new Params(this.cfg.params);
    this.tokenizer = tokenizer;
    this.previousReservedWord = {type: '', value: '', key: ''};
    this.tokens = [];
    this.index = 0;
  }

  /**
   * Formats whitespaces in a SQL string to make it easier to read.
   *
   * @param {String} query The SQL query string
   * @return {String} formatted query
   */
  format(query: string): string {
    this.tokens = this.tokenizer.tokenize(query);
    const formattedQuery = this.getFormattedQueryFromTokens();
    return formattedQuery.trim();
  }

  getFormattedQueryFromTokens(): string {
    let formattedQuery = '';

    this.tokens.forEach((token, index) => {
      this.index = index;

      if (token.type === tokenTypes.WHITESPACE) {
        // ignore (we do our own whitespace formatting)
      } else if (token.type === tokenTypes.LINE_COMMENT) {
        formattedQuery = this.formatLineComment(token, formattedQuery);
      } else if (token.type === tokenTypes.BLOCK_COMMENT) {
        formattedQuery = this.formatBlockComment(token, formattedQuery);
      } else if (token.type === tokenTypes.RESERVED_TOPLEVEL) {
        formattedQuery = this.formatToplevelReservedWord(token, formattedQuery);
        this.previousReservedWord = token;
      } else if (token.type === tokenTypes.RESERVED_NEWLINE) {
        formattedQuery = this.formatNewlineReservedWord(token, formattedQuery);
        this.previousReservedWord = token;
      } else if (token.type === tokenTypes.RESERVED) {
        formattedQuery = this.formatWithSpaces(token, formattedQuery);
        this.previousReservedWord = token;
      } else if (token.type === tokenTypes.OPEN_PAREN) {
        formattedQuery = this.formatOpeningParentheses(token, formattedQuery);
      } else if (token.type === tokenTypes.CLOSE_PAREN) {
        formattedQuery = this.formatClosingParentheses(token, formattedQuery);
      } else if (token.type === tokenTypes.PLACEHOLDER) {
        formattedQuery = this.formatPlaceholder(token, formattedQuery);
      } else if (token.value === ',') {
        formattedQuery = this.formatComma(token, formattedQuery);
      } else if (token.value === ':') {
        formattedQuery = this.formatWithSpaceAfter(token, formattedQuery);
      } else if (token.value === '.') {
        formattedQuery = this.formatWithoutSpaces(token, formattedQuery);
      } else if (token.value === ';') {
        formattedQuery = this.formatQuerySeparator(token, formattedQuery);
      } else {
        formattedQuery = this.formatWithSpaces(token, formattedQuery);
      }
    });
    return formattedQuery;
  }

  formatLineComment({value}: {value: string}, query: string): string {
    return this.addNewline(query + value);
  }

  formatBlockComment({value}: {value: string}, query: string): string {
    return this.addNewline(this.addNewline(query) + this.indentComment(value));
  }

  indentComment(comment: string): string {
    return comment.replace(/\n/g, `\n${this.indentation.getIndent()}`);
  }

  formatToplevelReservedWord({value}: {value: string}, query: string): string {
    this.indentation.decreaseTopLevel();

    query = this.addNewline(query);

    this.indentation.increaseToplevel();

    query += this.equalizeWhitespace(value);
    return this.addNewline(query);
  }

  formatNewlineReservedWord({value}: {value: string}, query: string): string {
    return `${this.addNewline(query) + this.equalizeWhitespace(value)} `;
  }

  /** Replace any sequence of whitespace characters with single space
   */
  equalizeWhitespace(string: string): string {
    return string.replace(/\s+/g, ' ');
  }

  /** Opening parentheses increase the block indent level and start a new line
   */
  formatOpeningParentheses({value}: {value: string}, query: string): string {
    // Take out the preceding space unless there was whitespace there in the original query
    // or another opening parens or line comment
    const preserveWhitespaceFor: string[] = [tokenTypes.WHITESPACE, tokenTypes.OPEN_PAREN, tokenTypes.LINE_COMMENT];
    if (!preserveWhitespaceFor.includes(this.previousToken().type)) {
      query = trimEnd(query);
    }
    query += value;

    this.inlineBlock.beginIfPossible(this.tokens, this.index);

    if (!this.inlineBlock.isActive()) {
      this.indentation.increaseBlockLevel();
      query = this.addNewline(query);
    }
    return query;
  }

  /** Closing parentheses decrease the block indent level
   */
  formatClosingParentheses(token: Token, query: string): string {
    if (this.inlineBlock.isActive()) {
      this.inlineBlock.end();
      return this.formatWithSpaceAfter(token, query);
    } else {
      this.indentation.decreaseBlockLevel();
      return this.formatWithSpaces(token, this.addNewline(query));
    }
  }

  formatPlaceholder(token: Token, query: string): string {
    return `${query + this.params.get(token)} `;
  }

  /** Commas start a new line (unless within inline parentheses or SQL "LIMIT" clause)
   */
  formatComma({value}: {value: string}, query: string): string {
    query = `${this.trimTrailingWhitespace(query) + value} `;
    if (this.inlineBlock.isActive()) {
      return query;
    } else if (/^LIMIT$/i.test(this.previousReservedWord.value)) {
      return query;
    } else {
      return this.addNewline(query);
    }
  }

  formatWithSpaceAfter({value}: {value: string}, query: string): string {
    return `${this.trimTrailingWhitespace(query) + value} `;
  }

  formatWithoutSpaces({value}: {value: string}, query: string): string {
    return this.trimTrailingWhitespace(query) + value;
  }

  formatWithSpaces({value}: {value: string}, query: string): string {
    return `${query + value} `;
  }

  formatQuerySeparator({value}: {value: string}, query: string): string {
    return `${this.trimTrailingWhitespace(query)}\n${value}\n`;
  }

  addNewline(query: string): string {
    return `${trimEnd(query)}\n${this.indentation.getIndent()}`;
  }

  trimTrailingWhitespace(query: string): string {
    if (this.previousNonWhitespaceToken().type === tokenTypes.LINE_COMMENT) {
      return `${trimEnd(query)}\n`;
    } else {
      return trimEnd(query);
    }
  }

  previousNonWhitespaceToken(): Token {
    let n = 1;
    while (this.previousToken(n).type === tokenTypes.WHITESPACE) {
      n++;
    }
    return this.previousToken(n);
  }

  previousToken(offset = 1): Token {
    // const offset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;
    return this.tokens[this.index - offset] || {};
  }
}
