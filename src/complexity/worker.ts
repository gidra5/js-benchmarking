import { Iterator } from 'iterator-js';
import {
  add,
  arbComplexityExpression,
  ComplexityExpression,
  constant,
  cost,
  datasetFitness,
  exp,
  log,
  variable,
} from './index.js';
import fc from 'fast-check';

export const objective = (
  data: { duration: number; sizes: number[] }[],
  expr: ComplexityExpression
) => {
  return datasetFitness(expr, data) + cost(expr);
};

export const obj2fitness = (objs: number[]) => {
  const low = Math.min(...objs);
  const minimal = (Math.max(...objs) - low) * 0.1;
  return objs.map((val) => val - low + minimal);
};

export const init = (
  sizesCount: number,
  populationSize: number
): ComplexityExpression[] => {
  let population = Iterator.natural(populationSize)
    .map(() => fc.sample(arbComplexityExpression(sizesCount), 1)[0])
    .toArray();
  return population;
};

const select = (fitnesses: number[]) => {
  const total = fitnesses.reduce((sum, fitness) => sum + fitness, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (let i = 0; i < fitnesses.length; i++) {
    acc += fitnesses[i];
    if (acc >= r) return i;
  }
  return 0;
};

const crossoverCoeffs = (
  expr1: ComplexityExpression,
  expr2: ComplexityExpression
): [ComplexityExpression, ComplexityExpression] => {
  if (expr1.type === 'constant') {
    if (expr2.type === 'constant') {
      return [expr2, expr1];
    }
    const _expr1: ComplexityExpression = { ...expr1, value: expr2.coeffs[0] };
    const _expr2: ComplexityExpression = {
      ...expr2,
      coeffs: [expr1.value, expr2.coeffs[1]],
    };
    return [_expr1, _expr2];
  }
  if (expr2.type === 'constant') {
    return crossoverCoeffs(expr2, expr1);
  }
  const coeffs1 = expr1.coeffs;
  const coeffs2 = expr2.coeffs;
  const _expr1 = { ...expr1, coeffs: coeffs2 };
  const _expr2 = { ...expr2, coeffs: coeffs1 };
  return [_expr1, _expr2];
};

const crossover = (
  expr1: ComplexityExpression,
  expr2: ComplexityExpression,
  prob: number
): [ComplexityExpression, ComplexityExpression] => {
  if (!(Math.random() < prob)) return [expr1, expr2];

  switch (expr1.type) {
    case 'constant':
    case 'variable':
      return crossoverCoeffs(expr1, expr2);
    case 'exp':
    case 'log':
      switch (expr2.type) {
        case 'constant':
        case 'variable':
        case 'add':
          return crossoverCoeffs(expr1, expr2);
        case 'exp':
        case 'log':
          const [arg1, arg2] = crossover(expr1.arg, expr2.arg, prob);
          return crossoverCoeffs(
            { ...expr1, arg: arg1 },
            { ...expr2, arg: arg2 }
          );
      }
    case 'add':
      switch (expr2.type) {
        case 'constant':
        case 'variable':
        case 'exp':
        case 'log':
          return crossoverCoeffs(expr1, expr2);
        case 'add':
          const x = Iterator.zip(expr1.args, expr2.args).map(([expr1, expr2]) =>
            crossover(expr1, expr2, prob)
          );
          const args1 = x.map(([expr1, expr2]) => expr1).toArray();
          const args2 = x.map(([expr1, expr2]) => expr2).toArray();

          return crossoverCoeffs(
            { ...expr1, args: args1 },
            { ...expr2, args: args2 }
          );
      }
  }
};

const mutation = (
  expr: ComplexityExpression,
  sizesCount: number,
  prob: number
): ComplexityExpression => {
  if (Math.random() < prob) return expr;

  switch (expr.type) {
    case 'constant': {
      const r = Math.random() * 5;
      if (r < 1) {
        const coeffs: [number, number] = [expr.value, 0];
        const index = Math.floor(Math.random() * sizesCount);
        return variable(index, coeffs);
      } else if (r < 2) {
        return exp(expr, [1, 0]);
      } else if (r < 3) {
        return log(expr, [1, 0]);
      } else if (r < 4) {
        return add(
          [1, 0],
          expr,
          variable(Math.floor(Math.random() * sizesCount), [1, 0])
        );
      } else {
        const r2 = Math.random();
        const step = 0.1;
        const d = 2 * r2 - 1;
        return constant(expr.value + d * step);
      }
    }
    case 'variable': {
      const r = Math.random() * 6;
      if (r < 1) {
        const index = Math.floor(Math.random() * sizesCount);
        return variable(index, expr.coeffs);
      } else if (r < 2) {
        return exp(expr, [1, 0]);
      } else if (r < 3) {
        return log(expr, [1, 0]);
      } else if (r < 4) {
        return add(
          [1, 0],
          expr,
          variable(Math.floor(Math.random() * sizesCount), [1, 0])
        );
      } else if (r < 4) {
        return constant(expr.coeffs[0]);
      } else {
        const step = 0.1;
        const d1 = 2 * Math.random() - 1;
        const d2 = 2 * Math.random() - 1;
        const coeffs: [number, number] = [
          expr.coeffs[0] + d1 * step,
          expr.coeffs[1] + d2 * step,
        ];
        return { ...expr, coeffs };
      }
    }
    case 'exp':
    case 'log': {
      const r = Math.random() * 6;
      if (r < 1) {
        return expr.arg;
      } else if (r < 2) {
        return exp(expr, [1, 0]);
      } else if (r < 3) {
        return log(expr, [1, 0]);
      } else if (r < 4) {
        const arg = mutation(expr.arg, sizesCount, prob);
        return { ...expr, arg };
      } else if (r < 5) {
        return add(
          [1, 0],
          expr,
          variable(Math.floor(Math.random() * sizesCount), [1, 0])
        );
      } else {
        const step = 0.1;
        const d1 = 2 * Math.random() - 1;
        const d2 = 2 * Math.random() - 1;
        const coeffs: [number, number] = [
          expr.coeffs[0] + d1 * step,
          expr.coeffs[1] + d2 * step,
        ];
        return { ...expr, coeffs };
      }
    }
    case 'add': {
      const r = Math.random() * 4;
      if (r < 1) {
        const index = Math.floor(Math.random() * expr.args.length);
        const args = expr.args.filter((_, i) => i !== index);
        if (args.length === 1) return args[0];
        return { ...expr, args };
      } else if (r < 2) {
        const newArg = fc.sample(arbComplexityExpression(sizesCount), 1)[0];
        return { ...expr, args: [...expr.args, newArg] };
      } else if (r < 3) {
        const args = expr.args.map((arg) => mutation(arg, sizesCount, prob));
        return { ...expr, args };
      } else {
        const step = 0.1;
        const d1 = 2 * Math.random() - 1;
        const d2 = 2 * Math.random() - 1;
        const coeffs: [number, number] = [
          expr.coeffs[0] + d1 * step,
          expr.coeffs[1] + d2 * step,
        ];
        return { ...expr, coeffs };
      }
    }
  }
};

export const generation = (
  data: { duration: number; sizes: number[] }[],
  population: ComplexityExpression[],
  sizesCount: number,
  crossoverProbability: number,
  mutationProbability: number
): ComplexityExpression[] => {
  const objectives = population.map((x) => objective(data, x));
  const fitnesses = obj2fitness(objectives);
  const oldBest = Math.min(...objectives);
  const indexOfBest = objectives.indexOf(oldBest);
  const newPopulation = Iterator.natural()
    .flatMap(() => {
      const p1 = population[select(fitnesses)];
      const p2 = population[select(fitnesses)];
      return crossover(p1, p2, crossoverProbability).map((s) =>
        mutation(s, sizesCount, mutationProbability)
      );
    })
    .take(population.length)
    .toArray();
  const newObjectives = newPopulation.map((x) => objective(data, x));
  const newBest = Math.min(...newObjectives);
  const indexOfWorst = newObjectives.indexOf(Math.max(...newObjectives));
  if (oldBest < newBest) {
    newPopulation[indexOfWorst] = population[indexOfBest];
    newObjectives[indexOfWorst] = oldBest;
  }

  return newPopulation.toSorted(
    (a, b) => objective(data, a) - objective(data, b)
  );
};
