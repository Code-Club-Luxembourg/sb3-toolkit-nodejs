import type { BlockRef } from './block-ref';
import type { Scriptable } from './scriptable';

/**
 * A script (top-level block) together with the target it belongs to.
 *
 * Yielded by `ScratchProject.findAllScripts()`. `target` is either a `Sprite`
 * or a `Stage`; `script` is a `BlockRef` pointing at the hat / root block.
 */
export class ScriptLocation {
  constructor(
    public readonly target: Scriptable,
    public readonly script: BlockRef
  ) {}
}
