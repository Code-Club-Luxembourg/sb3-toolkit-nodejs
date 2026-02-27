import type { Command } from 'commander';
import { resolvePaths, ScratchProject, ScratchValidator } from '../../model';
import { OrphanedBlocksRule } from '../../validator/rules/orphaned-blocks';
import { UnusedVariablesRule } from '../../validator/rules/unused-variables';

interface ValidateOptions {
  strictOpcodes: boolean;
  semantic: boolean;
  warningsAsErrors: boolean;
}

/** Register the `validate` CLI command. */
export function registerValidateCommand(program: Readonly<Command>): void {
  program
    .command('validate')
    .description('Validate one or more .sb3 projects against the structural + semantic rules')
    .argument('<files...>', 'One or more .sb3 files')
    .option('--strict-opcodes', 'Treat unknown opcodes as errors', false)
    .option('--semantic', 'Enable orphaned-block + unused-variable rules', false)
    .option('--warnings-as-errors', 'Fail the run when any warning is present', false)
    .addHelpText(
      'after',
      '\nExample:\n  $ sb3 validate project.sb3\n  $ sb3 validate *.sb3 --semantic --strict-opcodes'
    )
    .action(async (files: readonly string[], options: Readonly<ValidateOptions>) => {
      const resolved = await resolvePaths(files);
      let totalErrors = 0;
      let totalWarnings = 0;
      let exitCode = 0;

      for (const path of resolved) {
        const project = await ScratchProject.fromSb3File(path);
        let validator = new ScratchValidator({
          assets: project.assets,
          strictOpcodes: options.strictOpcodes
        });
        if (options.semantic) {
          validator = validator.withRule(new OrphanedBlocksRule()).withRule(new UnusedVariablesRule());
        }
        const result = validator.run(project);

        let errors = 0;
        let warnings = 0;
        for (const error of result.errors) {
          if (error.severity === 'error') errors += 1;
          else warnings += 1;
          console.log(
            `[${error.severity}] ${baseName(path)} — ${error.code} ${String(error.path)}: ${error.message}`
          );
        }
        console.log(`${baseName(path)}: ${errors} error(s), ${warnings} warning(s)`);

        totalErrors += errors;
        totalWarnings += warnings;
        if (!result.isValid || (options.warningsAsErrors && warnings > 0)) {
          exitCode = 1;
        }
      }

      console.log(
        `\nTotal: ${resolved.length} project(s), ${totalErrors} error(s), ${totalWarnings} warning(s)`
      );
      process.exit(exitCode);
    });
}

function baseName(p: string): string {
  const slash = p.lastIndexOf('/');
  return slash === -1 ? p : p.slice(slash + 1);
}
