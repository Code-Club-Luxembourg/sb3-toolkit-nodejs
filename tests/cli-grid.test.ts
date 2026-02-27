import { describe, expect, it } from 'vitest';
import { createProgram } from '../src/cli/index';

describe('CLI grid validation', () => {
  it('rejects invalid columns via commander parsing', async () => {
    const program = createProgram().exitOverride();

    await expect(
      program.parseAsync([
        'node',
        'cli',
        'grid',
        '--columns',
        'nope',
        '-o',
        'out.sb3',
        'one.sb3'
      ])
    ).rejects.toThrow('Grid columns must be a positive integer.');
  });

  it('rejects invalid rows via commander parsing', async () => {
    const program = createProgram().exitOverride();

    await expect(
      program.parseAsync([
        'node',
        'cli',
        'grid',
        '--columns',
        '2',
        '--rows',
        'bad',
        '-o',
        'out.sb3',
        'one.sb3'
      ])
    ).rejects.toThrow('Grid rows must be a positive integer.');
  });
});
