/**
 * A reference to a Scratch variable (display name + generated id).
 *
 * Returned by `ScratchProject.addVariable()` and `Sprite.addVariable()`, and
 * accepted by every Data factory and `Input.variable()`, so name and id never
 * drift out of sync.
 */
export class VariableRef {
  constructor(
    public readonly name: string,
    public readonly id: string
  ) {}
}

/**
 * A reference to a Scratch list (display name + generated id).
 *
 * Returned by `ScratchProject.addList()` and `Sprite.addList()`, and accepted
 * by every Data list factory and `Input.list()`.
 */
export class ListRef {
  constructor(
    public readonly name: string,
    public readonly id: string
  ) {}
}

/**
 * A reference to a Scratch broadcast (display name + id).
 *
 * Accepted by `Input.broadcast()` so name and id stay in sync.
 */
export class BroadcastRef {
  constructor(
    public readonly name: string,
    public readonly id: string
  ) {}
}
