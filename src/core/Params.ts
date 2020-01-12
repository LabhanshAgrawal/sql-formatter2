import {parameters, Token} from './types';

/**
 * Handles placeholder replacement with given params.
 */
export default class Params {
  params: parameters;
  index: number;
  /**
   * @param {Object} params
   */
  constructor(params: parameters = {}) {
    this.params = params;
    this.index = 0;
  }

  /**
   * Returns param value that matches given placeholder with param key.
   * @param {Object} token
   *   @param {String} token.key Placeholder key
   *   @param {String} token.value Placeholder value
   * @return {String} param or token.value when params are missing
   */
  get(_ref: Token): string {
    const key = _ref.key;
    const value = _ref.value;

    if (!this.params) {
      return value;
    }
    if (!Array.isArray(this.params)) {
      if (Object.keys(this.params).includes(key)) {
        return this.params[key];
      }
    } else {
      return this.params[this.index++];
    }
    return value;
  }
}
