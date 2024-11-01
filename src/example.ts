import { bench } from './bench.js';
import { setTimeout } from 'node:timers/promises';
import fc from 'fast-check';
import { Iterator } from 'iterator-js';

function fib(n: number) {
  if (n < 2) return 1;
  return fib(n - 1) + fib(n - 2);
}

const fibMemoized = () => {
  const memo = new Map<number, number>();
  const f = (n: number) => {
    if (n < 2) return 1;
    if (memo.has(n)) return memo.get(n)!;
    const result = f(n - 1) + f(n - 2);
    memo.set(n, result);
    return result;
  };
  return f;
};

function quicksort(arr: number[]): number[] {
  if (arr.length <= 1) return arr;
  const pivot = arr[0];
  const left = arr.filter((x) => x < pivot);
  const right = arr.filter((x) => x > pivot);
  const equal = arr.filter((x) => x === pivot);
  return [...quicksort(left), ...equal, ...quicksort(right)];
}

bench({
  name: 'quicksort',
  bench: quicksort,
  paramsCount: 1,
  genSamples: (n) => {
    n = Math.min(n, 1000);
    const arb = fc.array(fc.integer(), { minLength: n, maxLength: n });
    return fc.sample(arb, 1)[0];
  },
});

bench({
  name: 'quicksort fixed worst case',
  bench: () => quicksort(Iterator.natural(1000).toArray().toReversed()),
});

bench({
  name: 'fib memoized',
  bench: (n: number) => fibMemoized()(n),
  paramsCount: 1,
  genSamples: (n) => Math.min(n, 32),
});

bench({
  name: 'fib',
  bench: fib,
  paramsCount: 1,
  genSamples: (n) => Math.min(n, 32),
});

for (let i = 0; i < 10; i++) {
  bench({
    name: 'bench ' + i,
    bench: async () => {
      await setTimeout(400 + Math.random() * 200);
    },
  });
}
