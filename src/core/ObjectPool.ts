export interface ObjectPoolOptions<T> {
  create: () => T;
  reset?: (item: T) => void;
  maxRetained?: number;
}

export class ObjectPool<T> {
  private readonly available: T[] = [];
  private readonly create: () => T;
  private readonly reset?: (item: T) => void;
  private readonly maxRetained: number;

  constructor(options: ObjectPoolOptions<T>) {
    this.create = options.create;
    this.reset = options.reset;
    this.maxRetained = Math.max(0, options.maxRetained ?? Number.POSITIVE_INFINITY);
  }

  acquire(): T {
    return this.available.pop() ?? this.create();
  }

  release(item: T): void {
    this.reset?.(item);
    if (this.available.length < this.maxRetained) this.available.push(item);
  }

  get retainedCount(): number {
    return this.available.length;
  }
}
