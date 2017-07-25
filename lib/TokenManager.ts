import * as jwt from 'jsonwebtoken';
import * as Interfaces from './Interfaces';
import {OpenIdConfigurationManager} from './OpenIdConfigurationManager';
import {User, Tokens, Key} from './Models'

export class TokenManager {
  private _config: Interfaces.IConfig;
  private _http: Interfaces.IHTTP;
  private _tokenStore: Interfaces.ITokenStore;
  private _openIdConfigurationManager: OpenIdConfigurationManager;

  constructor(
    config: Interfaces.IConfig,
    http: Interfaces.IHTTP,
    tokenStore: Interfaces.ITokenStore,
    openIdConfigurationManager: OpenIdConfigurationManager) {
    if (!config) {
      throw new Error("Argument 'config' is undefined.");
    }
    if (!http) {
      throw new Error("Argument 'http' is undefined.");
    }
    if (!tokenStore) {
      throw new Error("Argument 'tokenStore' is undefined.");
    }
    if (!openIdConfigurationManager) {
      throw new Error("Argument 'openIdConfigurationManager' is undefined.");
    }

    this._config = config;
    this._http = http;
    this._tokenStore = tokenStore;
    this._openIdConfigurationManager = openIdConfigurationManager;
  }

  async addTokensFromCode(code: string): Promise<User> {
    if (!code) {
      throw new Error("Argument 'code' is undefined.");
    }

    return this.getTokensFromCode(code)
      .then((tokens) => {
        return this.validateTokens(tokens)
          .then((user) => {
            this._tokenStore.set(user, tokens);
            return user;
          });
      });
  }

  async getAccessToken(userId: string) : Promise<string|undefined> {
    return new Promise<string|undefined>((resolve, reject) => {
      this._tokenStore.get(userId)
        .then((tokens) => {
          // No tokens at all.
          if (!tokens) {
            return Promise.resolve(undefined);
          }

          // No AccessToken or AccessToken expired.
          if (!tokens.AccessToken || (tokens.ExpiresOn && tokens.ExpiresOn >= Date.now())) {
            if (tokens.RefreshToken) {
              return this.getTokensFromRefreshToken(tokens.RefreshToken)
                .then((tokens) => {
                  return this.validateTokens(tokens)
                    .then((user) => {
                      this._tokenStore.set(user, tokens);
                      return tokens.AccessToken;
                    });
                });
            }
            return Promise.resolve(undefined);
          }

          return Promise.resolve(tokens.AccessToken);
        });
    });
  }

  /**
   * Helper function to validate that the tokens came back from a trusted endpoint. We validate only the id_token because this token tells us which user the other tokens belong to. This protects us from having a malicious attacker try to associate their user id with another users access and refresh tokens.
  */
  private async validateTokens(tokens: Tokens) : Promise<User> {
    return this._openIdConfigurationManager.getSigningKeys()
      .then((keys) => {
        return new Promise<User>((resolve, reject) => {
          keys = keys || []
          if (!Array.isArray(keys)) {
            keys = [keys]
          }

          // decode the id_token to grab some header information we need.
          const idToken = tokens.IdToken;
          if (!idToken) {
            reject("Id Token not present.");
            return;
          }
          const claims: any = jwt.decode(idToken, { complete: true });
          if (!claims) {
            reject("Id Token format invalid");
            return;
          }

          const type = claims.header.typ;
          const algorithm = claims.header.alg;
          const signingKeyId = claims.header.kid;
          const tenantId = claims.payload.tid;

          if (type !== "JWT") {
            reject("Id Token not a JWT");
            return;
          }

          // get the issuer and signingKey we are expecting to use.
          const issuer = issuerTemplate.replace('{tenantid}', tenantId);
          const signingKey = keys.find((key) => key.KeyId === signingKeyId);
          if(!signingKey) {
            reject("Specified signing key not found");
            return;
          }

          // Try to verify the id_token
          const openSSLKey = signingKey.toOpenSSL();
          jwt.verify(
            idToken,
            openSSLKey, {
              audience: this._config.microsoftAppId,
              algorithms: [algorithm],
              issuer: issuer
            },
            (error, decodedToken : any) => {
              if (error) {
                reject(error);
                return;
              }
              const user = new User();
              user.AADId = decodedToken.oid;
              user.Name = decodedToken.name;
              resolve(user);
            }
          );
        });
      });
  }
  
  private getScopesStr(): string {
    return this._config.scopes.join('%20');
  }

  /**
   * Fetches the user data and access tokens. This also performs validation
   *  on the access tokens to make sure they came back from the the trusted
   *  endpoint. Returns a promise.
   */
  private getTokensFromCode(code: string): Promise<Tokens> {
    return this._openIdConfigurationManager.getConfiguration()
      .then((openIdConfig) => {
        const parameters: {[key: string]: string} = {
          grant_type: "authorization_code",
          client_id: this._config.microsoftAppId,
          client_secret: this._config.microsoftAppPassword,
          redirect_uri: `${this._config.rootUri}${this._config.tokenEndpoint}`,
          code: code,
          scope: this.getScopesStr()
        };

        const parameterStr = Object.keys(parameters)
          .map((key) => `${key}=${parameters[key]}`)
          .join("&");

        return this._http.post(openIdConfig.TokenEndpoint, parameterStr);
      })
      .then((body) => {
        const tokensJSON = JSON.parse(body);
        const tokens = new Tokens();
        tokens.AccessToken = tokensJSON.access_token;
        tokens.RefreshToken = tokensJSON.refresh_token;
        tokens.IdToken = tokensJSON.id_token;
        tokens.ExpiresIn = tokensJSON.expires_in;
        if (tokensJSON.expires_in) {
          tokens.ExpiresOn = Date.now() + (900 * tokensJSON.expires_in);
        }
        return tokens;
      });
  }

  /**
   * Fetches the user data and access tokens. This also performs validation
   *  on the access tokens to make sure they came back from the the trusted
   *  endpoint. Returns a promise.
   */
  private getTokensFromRefreshToken(refreshToken: string): Promise<Tokens> {
    return this._openIdConfigurationManager.getConfiguration()
      .then((openIdConfig) => {
        const parameters: {[key: string]: string} = {
          grant_type: "refresh_token",
          client_id: this._config.microsoftAppId,
          client_secret: this._config.microsoftAppPassword,
          refresh_token: refreshToken
        };

        const parameterStr = Object.keys(parameters)
          .map((key) => `${key}=${parameters[key]}`)
          .join("&");

        return this._http.post(openIdConfig.TokenEndpoint, parameterStr);
      })
      .then((body) => {
        const tokensJSON = JSON.parse(body);
        const tokens = new Tokens();
        tokens.AccessToken = tokensJSON.access_token;
        tokens.RefreshToken = tokensJSON.refresh_token;
        tokens.IdToken = tokensJSON.id_token;
        tokens.ExpiresIn = tokensJSON.expires_in;
        if (tokensJSON.expires_in) {
          tokens.ExpiresOn = Date.now() + (900 * tokensJSON.expires_in);
        }
        return tokens;
      });
  }
}
