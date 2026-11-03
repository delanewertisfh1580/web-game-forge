/**
 * spatial-hash.js — simple spatial hash grid for broad-phase collision.
 * @module spatial-hash
 */

/**
 * Spatial hash grid for AABB queries.
 */
export class SpatialHash {
  /**
   * @param {number} cellSize - size of each grid cell
   */
  constructor(cellSize = 64) {
    this.cellSize = cellSize;
    this._cells = new Map();
  }

  _key(cx, cy) { return `${cx},${cy}`; }

  _cellCoords(x, y) {
    return [Math.floor(x / this.cellSize), Math.floor(y / this.cellSize)];
  }

  /** Clear all entries */
  clear() {
    this._cells.clear();
  }

  /**
   * Insert an entity with AABB bounds.
   * @param {{x:number,y:number,w:number,h:number}} aabb
   * @param {any} entity
   */
  insert(aabb, entity) {
    const [cx1, cy1] = this._cellCoords(aabb.x, aabb.y);
    const [cx2, cy2] = this._cellCoords(aabb.x + aabb.w, aabb.y + aabb.h);
    for (let cx = cx1; cx <= cx2; cx++) {
      for (let cy = cy1; cy <= cy2; cy++) {
        const key = this._key(cx, cy);
        if (!this._cells.has(key)) this._cells.set(key, new Set());
        this._cells.get(key).add(entity);
      }
    }
  }

  /**
   * Query entities overlapping an AABB.
   * @param {{x:number,y:number,w:number,h:number}} aabb
   * @returns {Set<any>}
   */
  query(aabb) {
    const result = new Set();
    const [cx1, cy1] = this._cellCoords(aabb.x, aabb.y);
    const [cx2, cy2] = this._cellCoords(aabb.x + aabb.w, aabb.y + aabb.h);
    for (let cx = cx1; cx <= cx2; cx++) {
      for (let cy = cy1; cy <= cy2; cy++) {
        const key = this._key(cx, cy);
        const cell = this._cells.get(key);
        if (cell) {
          for (const entity of cell) result.add(entity);
        }
      }
    }
    return result;
  }

  /**
   * Remove an entity from all cells.
   * @param {any} entity
   */
  remove(entity) {
    for (const [, cell] of this._cells) {
      cell.delete(entity);
    }
  }

  /** @returns {number} total unique entities in grid */
  get size() {
    const all = new Set();
    for (const [, cell] of this._cells) {
      for (const e of cell) all.add(e);
    }
    return all.size;
  }

  destroy() {
    this.clear();
  }
}
