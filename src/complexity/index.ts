export type ComplexityExpression =
  | {
      id: number;
      type: 'add';
      args: ComplexityExpression[];
    }
  | {
      id: number;
      type: 'exp' | 'log';
      arg: ComplexityExpression;
    }
  | {
      id: number;
      type: 'variable';
      index: number;
    }
  | { id: number; type: 'constant' };

let nextId = 0;
const getNextId = () => nextId++;

const node = (
  type: ComplexityExpression['type'],
  rest?: any
): ComplexityExpression => ({ id: getNextId(), type, ...rest });

export const constant = (): ComplexityExpression => node('constant');
export const variable = (index: number): ComplexityExpression =>
  node('variable', { index });
export const exp = (arg: ComplexityExpression): ComplexityExpression =>
  node('exp', { arg });
export const log = (arg: ComplexityExpression): ComplexityExpression =>
  node('log', { arg });
export const add = (...args: ComplexityExpression[]): ComplexityExpression =>
  node('add', { args });

export const stringify = (expr: ComplexityExpression): string => {
  switch (expr.type) {
    case 'constant':
      return '1';
    case 'variable':
      return `x${expr.index}`;
    case 'exp':
      return `exp(${stringify(expr.arg)})`;
    case 'log':
      return `log(${stringify(expr.arg)})`;
    case 'add':
      return expr.args.map(stringify).join(' + ');
  }
};
