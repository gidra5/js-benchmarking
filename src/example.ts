import { bench } from './bench.js';
import { setTimeout } from 'node:timers/promises';
import fc from 'fast-check';

function fib(n: number) {
  if (n < 2) return 1;
  return fib(n - 1) + fib(n - 2);
}

function quicksort(arr: number[]) {
  if (arr.length <= 1) return arr;
  const pivot = arr[0];
  const left = arr.filter((x) => x < pivot);
  const right = arr.filter((x) => x >= pivot);
  return [...quicksort(left), pivot, ...quicksort(right)];
}

bench({
  name: 'fib',
  bench: fib,
  paramsCount: 1,
  genSamples: (n) => Math.ceil((n / (2 ** 32 - 1)) * 1024),
});

bench({
  name: 'quicksort',
  bench: quicksort,
  paramsCount: 1,
  genSamples: (n) => {
    const arb = fc.array(fc.integer(), { minLength: n, maxLength: n });
    return fc.sample(arb, 1)[0];
  },
});

for (let i = 0; i < 100; i++) {
  bench({
    name: 'bench ' + i,
    bench: async () => {
      await setTimeout(400 + Math.random() * 200);
    },
  });
}
