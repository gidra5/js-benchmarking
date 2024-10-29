import { program } from 'commander';
import { benches } from './bench';
import { ui } from './ui';

program
  .argument('<bench-file>', 'Path to benchmark file')
  .description('Run benchmarks in given file')
  .action(async (file) => {
    console.log(`Running benchmarks in ${file}`);
    await import(file);
    console.log(benches);
    ui();
  });

program.parse();
