export type ResourceCacheMeta = {
  maxAge?: number;
  staleWhileRevalidate?: number;
};

export type ResourceSetOptions = {
  /** Author override; defaults to the `key` argument. */
  key?: string;
  tags?: string[];
  cache?: ResourceCacheMeta;
};

export type ResourceEntry = {
  key: string;
  value: unknown;
  tags: string[];
  cache: ResourceCacheMeta;
  generation: number;
};

/** Serializable store view for luxel-data v2 (slice #21). */
export type ResourceSnapshot = Record<
  string,
  {
    value: unknown;
    generation: number;
    tags: string[];
    cache: ResourceCacheMeta;
  }
>;
