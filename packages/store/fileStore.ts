import type { DexieDatabase } from "./dexieDatabase.ts";
import type { FileStore } from "./ports.ts";

/** File bytes kept in the device's IndexedDB, beside its records. */
export class IndexedDbFileStore implements FileStore {
  readonly #database: DexieDatabase;

  constructor(database: DexieDatabase) {
    this.#database = database;
  }

  async put(id: string, bytes: Blob): Promise<void> {
    await this.#database.db.blobs.put({ id, bytes });
  }

  async get(id: string): Promise<Blob | undefined> {
    return (await this.#database.db.blobs.get(id))?.bytes;
  }

  remove(id: string): Promise<void> {
    return this.#database.db.blobs.delete(id);
  }
}
