/**
 * A reference to a single comment within a live comments map, for in-place
 * reads and edits. Comments are either free-floating (`blockId === null`) or
 * anchored to a specific block.
 */
export class CommentRef {
  constructor(
    private readonly comments: Record<string, unknown>,
    public readonly id: string
  ) {}

  /** Return the referenced comment, throwing if it is missing. */
  data(): Record<string, unknown> {
    const comment = this.comments[this.id];
    if (!comment || typeof comment !== 'object') {
      throw new Error(`Comment "${this.id}" not found`);
    }
    return comment as Record<string, unknown>;
  }

  text(): string {
    const t = this.data().text;
    return typeof t === 'string' ? t : '';
  }

  setText(text: string): this {
    this.data().text = text;
    return this;
  }

  /** The block this comment is anchored to, or null for free-floating comments. */
  blockId(): string | null {
    const b = this.data().blockId;
    return typeof b === 'string' ? b : null;
  }

  setBlockId(blockId: string | null): this {
    this.data().blockId = blockId;
    return this;
  }

  setPosition(x: number, y: number): this {
    const d = this.data();
    d.x = x;
    d.y = y;
    return this;
  }

  setSize(width: number, height: number): this {
    const d = this.data();
    d.width = width;
    d.height = height;
    return this;
  }

  setMinimized(minimized: boolean): this {
    this.data().minimized = minimized;
    return this;
  }

  delete(): void {
    Reflect.deleteProperty(this.comments, this.id);
  }
}
