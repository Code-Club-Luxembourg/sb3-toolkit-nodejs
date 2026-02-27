import type { ScratchProject } from '../../scratch/project';
import { ErrorCode, ValidationError, ValidationPath } from '../errors';
import type { Rule } from './rule';

const VARIABLE_OPCODES: Record<string, string> = {
  data_variable: 'VARIABLE',
  data_setvariableto: 'VARIABLE',
  data_changevariableby: 'VARIABLE',
  data_showvariable: 'VARIABLE',
  data_hidevariable: 'VARIABLE'
};

const LIST_OPCODES: Record<string, string> = {
  data_listcontents: 'LIST',
  data_addtolist: 'LIST',
  data_deleteoflist: 'LIST',
  data_deletealloflist: 'LIST',
  data_insertatlist: 'LIST',
  data_replaceitemoflist: 'LIST',
  data_itemoflist: 'LIST',
  data_itemnumoflist: 'LIST',
  data_lengthoflist: 'LIST',
  data_listcontainsitem: 'LIST',
  data_showlist: 'LIST',
  data_hidelist: 'LIST'
};

/**
 * Flag variables and lists that are declared on a target (or the stage) but
 * never referenced by any block on the same target or any sprite. These are
 * not bugs — they just survived a refactor — but they bloat the project.
 *
 * Reported as warnings.
 */
export class UnusedVariablesRule implements Rule {
  *validate(project: ScratchProject): Iterable<ValidationError> {
    const { varRefs, listRefs } = collectReferences(project);
    const targets = project.data.targets;
    for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
      const target = targets[targetIndex];
      for (const [id, entry] of Object.entries(target.variables)) {
        if (varRefs.has(id)) continue;
        const name = typeof entry[0] === 'string' ? entry[0] : id;
        yield new ValidationError(
          ErrorCode.UNUSED_VARIABLE,
          new ValidationPath(`targets[${targetIndex}].variables.${id}`, targetIndex),
          `Variable "${name}" is declared but never referenced`,
          'warning'
        );
      }
      for (const [id, entry] of Object.entries(target.lists)) {
        if (listRefs.has(id)) continue;
        const name = typeof entry[0] === 'string' ? entry[0] : id;
        yield new ValidationError(
          ErrorCode.UNUSED_LIST,
          new ValidationPath(`targets[${targetIndex}].lists.${id}`, targetIndex),
          `List "${name}" is declared but never referenced`,
          'warning'
        );
      }
    }
  }
}

function collectReferences(project: ScratchProject): { varRefs: Set<string>; listRefs: Set<string> } {
  const varRefs = new Set<string>();
  const listRefs = new Set<string>();
  for (const target of project.data.targets) {
    for (const block of Object.values(target.blocks)) {
      if (!block) continue;
      if (block.opcode in VARIABLE_OPCODES) {
        const field = block.fields[VARIABLE_OPCODES[block.opcode]];
        if (Array.isArray(field) && typeof field[1] === 'string') {
          varRefs.add(field[1]);
        }
      }
      if (block.opcode in LIST_OPCODES) {
        const field = block.fields[LIST_OPCODES[block.opcode]];
        if (Array.isArray(field) && typeof field[1] === 'string') {
          listRefs.add(field[1]);
        }
      }
    }
  }
  return { varRefs, listRefs };
}
