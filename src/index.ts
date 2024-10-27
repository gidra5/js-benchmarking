type BenchOptions = {
  name: string;
  paramsCount: number;
  bench: (...args: number[]) => void;
};
type BenchArgs =
  | [
      name: string,
      f: (...args: number[]) => void,
      options?: Partial<Omit<BenchOptions, 'name' | 'bench'>>
    ]
  | [
      name: string,
      paramsCount: number,
      f: (...args: number[]) => void,
      options?: Partial<Omit<BenchOptions, 'paramsCount' | 'name' | 'bench'>>
    ]
  | [BenchOptions];

export const bench = async (...args: BenchArgs) => {};
