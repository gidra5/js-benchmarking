import { Iterator } from 'iterator-js';
import { isDeepStrictEqual } from 'util';

export function binarySearch(stats: number[], duration: number): number {
  let left = 0;
  let right = stats.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (stats[mid] === duration) return mid;
    if (stats[mid] < duration) left = mid + 1;
    else right = mid - 1;
  }
  return left;
}

export function binarySearchSizeDurations(
  sizeDurations: { duration: number; sizes: number[] }[],
  duration: number,
  sizes: number[]
) {
  let left = 0;
  let right = sizeDurations.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const { duration: d, sizes: s } = sizeDurations[mid];
    if (d === duration && isDeepStrictEqual(s, sizes)) return mid;
    if (Iterator.zip(s, sizes).some(([s1, s2]) => s1 < s2)) left = mid + 1;
    else right = mid - 1;
  }
  return left;
}

function percentile(p: number, list: number[]): number {
  const index = Math.max(0, Math.ceil(list.length * p) - 1);
  return list[index];
}

export function variance(avg: number, avgSquares: number, len: number): number {
  if (len < 2) return 0;
  // return avgSquares - avg * avg;

  const k1 = len / (len - 1);
  return k1 * (avgSquares - avg * avg);
}

export type Stats = {
  [K in keyof typeof stats]: ReturnType<(typeof stats)[K]>;
};

export const stats = {
  ['avg']: (len: number, durations: number[], avg: number) => avg,
  ['st. dev.']: (
    len: number,
    durations: number[],
    avg: number,
    avgSquares: number
  ) => len > 0 && Math.sqrt(variance(avg, avgSquares, len)),
  ['min']: (len: number, durations: number[]) =>
    len > 0 && percentile(0, durations),
  ['p50']: (len: number, durations: number[]) =>
    len > 0 && percentile(0.5, durations),
  ['p75']: (len: number, durations: number[]) =>
    len > 0 && percentile(0.75, durations),
  ['p95']: (len: number, durations: number[]) =>
    len > 0 && percentile(0.95, durations),
  ['p99']: (len: number, durations: number[]) =>
    len > 0 && percentile(0.99, durations),
  ['p99.9']: (len: number, durations: number[]) =>
    len > 0 && percentile(0.999, durations),
  ['max']: (len: number, durations: number[]) =>
    len > 0 && percentile(1, durations),
};
