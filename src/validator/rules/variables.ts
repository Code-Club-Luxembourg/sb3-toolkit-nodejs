import type { ScratchField, ScratchStage, ScratchSprite } from '../../types';
import { ErrorCode, ValidationError, ValidationPath } from '../errors';

const VARIABLE_OPCODES = new Set([
  'data_variable',
  'data_setvariableto',
  'data_changevariableby',
  'data_showvariable',
  'data_hidevariable'
]);

const LIST_OPCODES = new Set([
  'data_listcontents',
  'data_addtolist',
  'data_deleteoflist',
  'data_deletealloflist',
  'data_insertatlist',
  'data_replaceitemoflist',
  'data_itemoflist',
  'data_itemnumoflist',
  'data_lengthoflist',
  'data_listcontainsitem',
  'data_showlist',
  'data_hidelist'
]);

export function validateVariableRefs(
  target: ScratchSprite | ScratchStage,
  targetIndex: number,
  targetPath: string,
  stage: ScratchStage,
  errors: ValidationError[]
): void {
  const blockPath = `${targetPath}.blocks`;

  for (const [id, block] of Object.entries(target.blocks)) {
    if (!block) continue;

    if (VARIABLE_OPCODES.has(block.opcode)) {
      const varField = block.fields.VARIABLE as ScratchField | undefined;
      if (varField && typeof varField[1] === 'string' && varField[1].length > 0) {
        const varId = varField[1];
        if (!(varId in target.variables) && !(varId in stage.variables)) {
          errors.push(
            new ValidationError(
              ErrorCode.DANGLING_VARIABLE_REF,
              new ValidationPath(`${blockPath}.${id}.fields.VARIABLE`, targetIndex, id),
              `Block "${id}" references variable "${varId}" ("${String(varField[0])}") which is not defined on this sprite or the stage`
            )
          );
        }
      }
    }

    if (LIST_OPCODES.has(block.opcode)) {
      const listField = block.fields.LIST as ScratchField | undefined;
      if (listField && typeof listField[1] === 'string' && listField[1].length > 0) {
        const listId = listField[1];
        if (!(listId in target.lists) && !(listId in stage.lists)) {
          errors.push(
            new ValidationError(
              ErrorCode.DANGLING_LIST_REF,
              new ValidationPath(`${blockPath}.${id}.fields.LIST`, targetIndex, id),
              `Block "${id}" references list "${listId}" ("${String(listField[0])}") which is not defined on this sprite or the stage`
            )
          );
        }
      }
    }
  }
}
