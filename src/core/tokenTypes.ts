/**
 * Constants for token types
 */
const tokenTypes = {
  WHITESPACE: 'whitespace' as const,
  WORD: 'word' as const,
  STRING: 'string' as const,
  RESERVED: 'reserved' as const,
  RESERVED_TOPLEVEL: 'reserved-toplevel' as const,
  RESERVED_NEWLINE: 'reserved-newline' as const,
  OPERATOR: 'operator' as const,
  OPEN_PAREN: 'open-paren' as const,
  CLOSE_PAREN: 'close-paren' as const,
  LINE_COMMENT: 'line-comment' as const,
  BLOCK_COMMENT: 'block-comment' as const,
  NUMBER: 'number' as const,
  PLACEHOLDER: 'placeholder' as const,
  COMMENT: 'comment' as const
};
export default tokenTypes;
