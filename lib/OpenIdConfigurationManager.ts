import * as Interfaces from './Interfaces'
import * as Caching from './Caching'
import {OpenIdConfiguration, Key} from './Models'

export class OpenIdConfigurationManager {
  private _config: Interfaces.IConfig;
  private _http: Interfaces.IHTTP;
  private _cache: Caching.AsyncMemoryCache<any>;

  constructor(config: Interfaces.IConfig, http: Interfaces.IHTTP) {
    if(!config) {
      throw new Error("Argument 'config' is undefined.");
    }
    if(!http) {
      throw new Error("Argument 'http' is undefined.");
    }

    this._config = config;
    this._http = http;
    this._cache = new Caching.AsyncMemoryCache();
    
    this._cache.set(
      "openIdConfig",
      {
        duration: this._config.openIdConfigCacheDuration,
        loadOperation: (done) => {
          return this._http.get(this.getOpenIdConfigUri())
            .then((body) => {
              const openIdConfigJSON = JSON.parse(body);
              const openIdConfig = new OpenIdConfiguration();
              openIdConfig.AuthorizationEndpoint = openIdConfigJSON.authorization_endpoint;
              openIdConfig.TokenEndpoint = openIdConfigJSON.token_endpoint;
              openIdConfig.Issuer = openIdConfigJSON.issuer;
              openIdConfig.JWKSUri = openIdConfigJSON.jwks_uri;
              done(openIdConfig);
            })
            .catch((error) => {
              done(null, error);
            });
        }
      });

    this._cache.set(
      "keys",
      {
        duration: this._config.openIdCertCacheDuration,
        loadOperation: (done) => {
          // We fetch the URL to get the keys from by first fetching the openIdConfig.
          this.getConfiguration()
            .then((openIdConfig) => {
              if (!openIdConfig.JWKSUri) {
                return Promise.reject(
                  "A valid JWT key endpoint was not returned with the OpenId configuration.");
              }

              return this._http.get(openIdConfig.JWKSUri);
            })
            .then((body) => {
              let keys = JSON.parse(body).keys as any[];
              if (!keys) {
                return Promise.reject("Response was not a valid array of keys");
              }
              keys = keys.filter((key) => key.kid && Array.isArray(key.x5c) && key.x5c.length > 0);

              return Promise.resolve(keys.map((key) => {
                const mappedKey = new Key();
                mappedKey.KeyType = key.kyt;
                mappedKey.KeyId = key.kid;
                mappedKey.PublicKeyUse = key.use;
                mappedKey.Issuer = key.iss;
                mappedKey.Certificate = key.x5c[0];
                return mappedKey;
              }));
            })
            .then((keys) => {
              done(keys);
            })
            .catch((error) => {
              done(null, error)
            });
        }
      });
  }

  async getConfiguration(): Promise<OpenIdConfiguration> {
    return this._cache.get("openIdConfig");
  }

  async getSigningKeys(): Promise<Key[]> {
    return this._cache.get("keys");
  }

  private getOpenIdConfigUri(): string {
    if(!this._config) {
      throw new Error("Invalid Operation requested. State '_config' is undefined.");
    }
    if(!this._config.openIdConfigUri) {
      throw new Error("Invalid Operation requested. State '_config.openIdConfigUri' is undefined.");
    }
    if(!this._config.tenant) {
      throw new Error("Invalid Operation requested. State '_config.tenant' is undefined.");
    }

    return this._config.openIdConfigUri.replace('{tenant}', this._config.tenant);
  }
}
