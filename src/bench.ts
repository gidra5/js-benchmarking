type BenchOptions<T> = {
  name: string;
  paramsCount?: number;
  genSamples?: (...args: number[]) => NoInfer<T>;
  bench: (args: T) => void | Promise<void>;
};

type Bench = <T>(options: BenchOptions<T>) => void;

export const benches: (BenchOptions<any> & { id: number })[] = [];

export const bench: Bench = (...args) => {
  benches.push({ ...args[0], id: benches.length });
};
