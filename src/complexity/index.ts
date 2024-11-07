import fc from 'fast-check';
import { Iterator } from 'iterator-js';

export type ComplexityExpression =
  | {
      id: number;
      type: 'add';
      args: ComplexityExpression[];
      coeffs: [number, number];
    }
  | {
      id: number;
      type: 'exp' | 'log';
      arg: ComplexityExpression;
      coeffs: [number, number];
    }
  | { id: number; type: 'variable'; index: number; coeffs: [number, number] }
  | { id: number; type: 'constant'; value: number };

let nextId = 0;
const getNextId = () => nextId++;

const node = (
  type: ComplexityExpression['type'],
  rest?: any
): ComplexityExpression => ({ id: getNextId(), type, ...rest });

export const constant = (value: number): ComplexityExpression =>
  node('constant', { value });
export const variable = (
  index: number,
  coeffs: [number, number]
): ComplexityExpression => node('variable', { index, coeffs });
export const exp = (
  arg: ComplexityExpression,
  coeffs: [number, number]
): ComplexityExpression => node('exp', { arg, coeffs });
export const log = (
  arg: ComplexityExpression,
  coeffs: [number, number]
): ComplexityExpression => node('log', { arg, coeffs });
export const add = (
  coeffs: [number, number],
  ...args: ComplexityExpression[]
): ComplexityExpression => node('add', { args, coeffs });

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

export const cost = (expr: ComplexityExpression): number => {
  if (expr.type === 'constant') return 1;
  else if (expr.type === 'variable') return 2;
  else if (expr.type === 'exp' || expr.type === 'log')
    return 1 + cost(expr.arg);
  else if (expr.type === 'add')
    return 1 + expr.args.reduce((sum, arg) => sum + cost(arg), 0);
  return 0;
};

/** 0 - equal, >0 - expr1 is better, <0 - expr2 is better */
const compare = (
  expr1: ComplexityExpression,
  expr2: ComplexityExpression
): number => {
  if (expr1.type === 'constant') {
    if (expr2.type === 'constant') return 0;
    return 1;
  } else if (expr1.type === 'variable') {
    if (expr2.type === 'constant') return -1;
    else if (expr2.type === 'variable') return 0;
    else if (expr2.type === 'exp') return 1;
    else if (expr2.type === 'log') return 1;
    else if (expr2.type === 'add') return 1;
    return 0;
  } else if (expr1.type === 'exp') {
    if (expr2.type === 'exp') return 0;
    return -1;
  } else if (expr1.type === 'log') {
    if (expr2.type === 'constant') return -1;
    else if (expr2.type === 'variable') return -1;
    else if (expr2.type === 'exp') return 1;
    else if (expr2.type === 'log') return 0;
    else if (expr2.type === 'add') return 1;
    return 0;
  } else if (expr1.type === 'add') {
    if (expr2.type === 'constant') return -1;
    else if (expr2.type === 'variable') return -1;
    else if (expr2.type === 'exp') return 1;
    else if (expr2.type === 'log') return -1;
    else if (expr2.type === 'add') return 0;
    return 0;
  }
  return 0;
};

const _eval = (expr: ComplexityExpression, sizes: number[]): number => {
  if (expr.type === 'constant') return expr.value;

  const [a, b] = expr.coeffs;
  if (expr.type === 'variable') return a * sizes[expr.index] + b;
  else if (expr.type === 'exp') return a * Math.exp(_eval(expr.arg, sizes)) + b;
  else if (expr.type === 'log') return a * Math.log(_eval(expr.arg, sizes)) + b;
  else if (expr.type === 'add')
    return a * expr.args.reduce((sum, arg) => sum + _eval(arg, sizes), 0) + b;
  return 0;
};

export const datasetFitness = (
  expr: ComplexityExpression,
  data: { duration: number; sizes: number[] }[]
): number => {
  return data.reduce((sum, { duration, sizes }) => {
    const diff = duration - _eval(expr, sizes);
    return sum + diff * diff;
  }, 0);
};

export const arbComplexityExpression = (sizesCount: number) =>
  fc.letrec<{ expr: ComplexityExpression }>((tie) => ({
    expr: fc.tuple(fc.float(), fc.float()).chain((coeffs) =>
      fc.oneof(
        fc.constant(constant(coeffs[0])),
        fc.nat(sizesCount).map((index) => variable(index, coeffs)),
        tie('expr').map((arg) => exp(arg, coeffs)),
        tie('expr').map((arg) => log(arg, coeffs)),
        fc.array(tie('expr')).map((args) => add(coeffs, ...args))
      )
    ),
  })).expr;
