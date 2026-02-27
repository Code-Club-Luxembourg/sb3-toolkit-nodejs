/**
 * In-memory index of Scratch asset buffers keyed by `md5ext`.
 */
export class ScratchAssetIndex {
  private readonly byMd5ext = new Map<string, Buffer>();

  /**
   * Add an asset buffer if the `md5ext` key is not already present.
   */
  add(md5ext: string, data: Buffer): void {
    if (!this.byMd5ext.has(md5ext)) {
      this.byMd5ext.set(md5ext, data);
    }
  }

  /**
   * Check whether an asset exists for the given `md5ext`.
   */
  has(md5ext: string): boolean {
    return this.byMd5ext.has(md5ext);
  }

  /**
   * Retrieve the asset buffer for the given `md5ext`, if present.
   */
  get(md5ext: string): Buffer | undefined {
    return this.byMd5ext.get(md5ext);
  }

  /**
   * Number of assets tracked by this index.
   */
  get size(): number {
    return this.byMd5ext.size;
  }

  /**
   * Remove the asset at `md5ext`. Returns true when an entry was removed.
   */
  remove(md5ext: string): boolean {
    return this.byMd5ext.delete(md5ext);
  }

  /**
   * Iterate over `[md5ext, buffer]` entries.
   */
  entries(): IterableIterator<[string, Buffer]> {
    return this.byMd5ext.entries();
  }

  /**
   * Default iterator that yields `[md5ext, buffer]` entries.
   */
  [Symbol.iterator](): IterableIterator<[string, Buffer]> {
    return this.byMd5ext.entries();
  }
}
