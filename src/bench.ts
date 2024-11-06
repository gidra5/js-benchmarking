type BenchConfig = {
  iterations?: number;
  complexityIterations?: number;
  iterationsPerSample?: number;
};
type ComplexityConfig<T> = {
  paramsCount: number;
  genSamples: (...params: number[]) => T;
  baseCase: () => T;
};

type BenchOptions<T> = BenchConfig &
  ({} | ComplexityConfig<NoInfer<T>>) & {
    name: string;
    bench: (arg: T) => any | Promise<any>;
  };

type Bench = <T>(options: BenchOptions<T>) => void;

type BenchItem = BenchOptions<any> & {
  id: number;
};

export const benches: BenchItem[] = [];

export const bench: Bench = (options) => {
  benches.push({ ...options, id: benches.length });
};
