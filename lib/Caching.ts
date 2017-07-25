/**
 * Interace for the callback that returns the value.
 */
export interface AsyncGetCallbackType {
  (value: any, error?: Error): void
}

/**
 * Interace for the callback that returns the value.
 */
export interface AsyncLoadOperationCallbackType {
  (value: any, error?: Error | string): void
}

/**
 * Interace for the load operation to use to fetch a new value if it is expired.
 */
export interface AsyncLoadOperation {
  (callback: AsyncLoadOperationCallbackType): void
}

/**
 * Interface for the object being stored.
 */
export interface AsyncMemoryCacheOptions<T> {
  value?: T;
  expires?: number;
  loadOperation?: AsyncLoadOperation;
  duration?: number;
}

/**
 * Interface for the implementation of asynchronous caches.
 */
export interface IAsyncCache<T> {
  set(key: string, options: AsyncMemoryCacheOptions<T>) : void
  get(key: string) : Promise<T|undefined>
  clear(key: string) : void
  clearAll() : void
}

/**
 * AsyncCache is used to store key-value pairs and refresh them when they expire
 *  using a load operation. The load operation is asynchronous so the get
 *  function is also asynchronous.
 */
export class AsyncMemoryCache<T> implements IAsyncCache<T> {
  protected _cache: {[key: string]: AsyncMemoryCacheOptions<T>};

  constructor() {
    this._cache = {};
  }

  /**
   * Sets a value onto the cache.
   * The value can be just a raw value or it can be an object with a
   *  loadOperation parameter to refresh the value.
   */
  set(key: string, options: AsyncMemoryCacheOptions<T>) : void {
    if (key) {
      this.clear(key);
      this._cache[key] = options;
    }
  }

  /**
   * Removes a key-value pair from the cache.
   */
  clear(key: string) : void {
    if(key) {
      delete this._cache[key];
    }
  }

  /**
   * Clears all the key-value pairs from the cache.
   */
  clearAll() : void {
    this._cache = {};
  }

  /**
   * Asynchronous operation to fetch a value from the cache.
   * This operation returns a Promise that eventually resolves to the requested value.
   */
  async get(key: string) : Promise<T|undefined> {
    return new Promise<T|undefined>((resolve, reject) => {
      if (!key) {
        reject(new Error("Argument 'key' is undefined."));
        return;
      }
    
      const options = this._cache[key];

      // No value at all; return undefined
      if (!options) {
        resolve(undefined);
        return;
      }

      // There is a value and it is not expired; return the value
      if (options.value && (!options.expires || options.expires > Date.now())) {
        resolve(options.value);
        return;
      }

      // The value wasn't there or it was expired; if there is a
      //  loadOperation try to run it to get the value
      if (options.loadOperation) {
        let expires = 0;
        if (options.duration) {
            expires = Date.now() + options.duration;
        }
        options.loadOperation((value, error) => {
          if (error) {
            if (typeof(error) === 'string') {
              error = new Error(error);
            }
            reject(error);
            return;
          }

          options.value = value;
          options.expires = expires;
          resolve(value)
        });
        return;
      }

      // The value is expired and there is no loadOperation; return undefined
      resolve(undefined);
    });
  }
}
