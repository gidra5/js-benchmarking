type BenchOptions<T> = {
  name: string;
  iterations?: number;
  iterationsPerSample?: number;
  paramsCount?: number;
  genSamples?: (...args: number[]) => NoInfer<T>;
  bench: (args: T) => any | Promise<any>;
  baseCase?: number[];
};

type Bench = <T>(options: BenchOptions<T>) => void;

type BenchItem = BenchOptions<any> & {
  id: number;
  type: 'complexityMeasurement' | 'pureMeasurement';
};

export const benches: BenchItem[] = [];

export const bench: Bench = (options) => {
  if (options.genSamples) {
    benches.push({
      ...options,
      id: benches.length,
      type: 'complexityMeasurement',
    });
  } else {
    benches.push({ ...options, id: benches.length, type: 'pureMeasurement' });
  }
};
