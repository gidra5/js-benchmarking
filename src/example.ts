import { bench } from './bench.ts';
import fc from 'fast-check';

bench({
  name: 'fib',
  bench: fib,
  paramsCount: 1,
  genSamples: (n) => n,
});

function fib(n: number) {
  if (n < 2) return 1;
  return fib(n - 1) + fib(n - 2);
}

bench({
  name: 'quicksort',
  bench: quicksort,
  paramsCount: 1,
  genSamples: (n) => {
    const arb = fc.array(fc.integer(), { minLength: n, maxLength: n });
    return fc.sample(arb, 1)[0];
  },
});

function quicksort(arr: number[]) {
  if (arr.length <= 1) return arr;
  const pivot = arr[0];
  const left = arr.filter((x) => x < pivot);
  const right = arr.filter((x) => x >= pivot);
  return [...quicksort(left), pivot, ...quicksort(right)];
}
