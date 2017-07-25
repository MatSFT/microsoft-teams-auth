import '@types/node';
import * as cookieParser from 'cookie-parser';
import * as crypto from 'crypto';
import * as Interfaces from './Interfaces'
import * as Defaults from './Defaults'
import * as Caching from './Caching'
import {OpenIdConfigurationManager} from './OpenIdConfigurationManager'
import {TokenManager} from './TokenManager'
import {Key} from './Models'

/**
 * The MSTeamsAuthServer class registers routes that handle the authentication and admin consent flows.
 */
export class MicrosoftTeamsAuth extends NodeJS.EventEmitter implements Interfaces.IMicrosoftTeamsAuth {
  private _router: Interfaces.IRouter;
  private _logger: Interfaces.ILogger;
  private _tokenManager: TokenManager;
  private _openIdConfigurationManager: OpenIdConfigurationManager;
  private _config : Defaults.Config;

  /**
   * Creates a new MSTeamsAuthServer with the robot and config provided.
   */
  constructor(
    router: Interfaces.IRouter,
    http: Interfaces.IHTTP,
    tokenStore: Interfaces.ITokenStore,
    logger: Interfaces.ILogger,
    config: Interfaces.IConfig) {
    super();

    if (!router) {
      throw new Error("Argument 'router' is undefined.");
    }
    if (!http) {
      throw new Error("Argument 'http' is undefined.");
    }
    if (!tokenStore) {
      throw new Error("Argument 'tokenStore' is undefined.");
    }
    if (!config) {
      throw new Error("Argument 'config' is undefined.");
    }

    if (!logger) {
      logger = new Defaults.Logger();
    }

    this._logger = logger;
    this._router = router;
    this._config = new Defaults.Config(config);
    this._openIdConfigurationManager = new OpenIdConfigurationManager(this._config, http);
    this._tokenManager = new TokenManager(this._config, http, tokenStore, this._openIdConfigurationManager);

    this._logger.info(`Created 'MicrosoftTeamsAuth' with config: ${JSON.stringify(this._config, null, 2)}`);
    this.initialize();
  }
  
  /**
   * Returns the Login URI to send users to.
   */
  getLoginUri(): string {
    return `${this._config.rootUri}${this._config.loginEndpoint}`;
  }

  /**
   * Returns the Admin Consent URI to get admins to consent to the scopes.
   */
  getAdminConsentUri(): string {
    return `${this._config.rootUri}${this._config.adminConsentEndpoint}`;
  }

  async getAccessToken(userId: string) : Promise<string|undefined> {
    return this._tokenManager.getAccessToken(userId);
  }

  /**
   * Initializes the MicrosoftTeamsAuth server. Sets up the cache and registers the routes.
   */
  private initialize(): void {
    this._logger.info("Registering routes");
    // The admin consent endpoint is where we redirect admins to consent to the bot. This is a fairly thin wrapper that redirects users to AAD.
    this._router.get(
      this._config.adminConsentEndpoint,
      (req, res) => {
        // The state is set on the user's browser's cookies and also passed to AAD. It is later returned and the browser's cookies are compared against it to make sure there were no cross-site malicious attacks.
        this.createState()
          .then((state) => {
            const parameters: {[key: string]: string} = {
              client_id: this._config.microsoftAppId,
              redirect_uri:
                `${this._config.rootUri}${this._config.adminTokenEndpoint}`,
              state: state
            };
            
            const parameterStr = Object.keys(parameters)
              .map((key) => `${key}=${parameters[key]}`)
              .join("&");

            res.cookie('authstate', state);
            const redirectUri = this._config.adminConsentUri.replace('{tenant}', this._config.tenant);
            res.redirect(`${redirectUri}?${parameterStr}`);
          })
          .catch((error) => {
            this._logger.error(`${error}`);
            this._logger.debug(`StackTrace=${error.stack}`);
            res.status(500).send("Internal server error");
          });
      });

    // The admin token endpoint is where AAD redirects admin users after a successful consent flow. It simply closes the browser window.
    this._router.get(
      this._config.adminTokenEndpoint,
      cookieParser(),
      (req, res) => {
        req.query = this.repairQuery(req.query);
        if (req.cookies.authstate !== req.query.state) {
          return res.status(400).send('Cross-site scripting tken is invalid');
        }

        if (req.query.error) {
          res.status(400).send(req.query.error);
        }
        else {
          res.send("<script>window.close();</script>");
        }
      });

    // The login endpoint is where we redirect all users to login to the bot. This endpoint requests access to MS Graph resources that we need to operate.
    this._router.get(
      this._config.loginEndpoint,
      (req, res) => {
        // The state is set on the user's browser's cookies and also passed to AAD. It is later returned and the browser's cookies are compared against it to make sure there were no cross-site malicious attacks.
        Promise.all([this.createState(), this._openIdConfigurationManager.getConfiguration()])
          .then((values) => {
            const state = values[0];
            const openIdConfig = values[1];

            const parameters: {[key: string]: string} = {
              response_type: "code",
              client_id: this._config.microsoftAppId,
              redirect_uri: `${this._config.rootUri}${this._config.tokenEndpoint}`,
              state: state,
              scope: this.getScopesStr()
            };

            const parameterStr = Object.keys(parameters)
              .map((key) => `${key}=${parameters[key]}`)
              .join("&");

            res.cookie('authstate', state);
            res.redirect(`${openIdConfig.AuthorizationEndpoint}?${parameters}`);;
          })
          .catch((error) => {
            this._logger.error(`${error}`);
            this._logger.debug(`StackTrace=${error.stack}`);
            res.status(500).send("Internal server error");
          });
      });

    // The token endpoint is where all users are redirected to by AAD after they login.
    this._router.get(
      this._config.tokenEndpoint,
      cookieParser(),
      (req, res) => {
        req.query = this.repairQuery(req.query);
        if (req.cookies.authstate !== req.query.state) {
          return res.status(400).send('Cross-site scripting token is invalid');
        }

        if (req.query.error) {
          return res.status(400).send(req.query.error);
        }
        else {
          this._tokenManager.addTokensFromCode(req.query.code)
            .then((user) => {
              res.send("<script>window.close();</script>");
            })
            .catch((error) => {
              this._logger.error(`${error}`);
              this._logger.debug(`StackTrace=${error.stack}`);
              res.status(500).send("Internal server error");
            });
        }
      });

    this._logger.info("Routes Registered");
  }

  /**
   * The error string comes back HTML encoded for some reason so we have to remove the amp; at the beginning of each key.
   */
  private repairQuery(origQuery: any) {
    if(!origQuery.error) {
      return origQuery;
    }

    const keys = Object.keys(origQuery);
    keys.forEach((key) => {
      const newKey = key.replace(/^amp;/, "")
      if(newKey !== key) {
        origQuery[newKey] = origQuery[key];
        delete origQuery[key];
      }
    });
      
    return origQuery;
  }

  private createState(): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(48, (ex, buf) => {
        const state =
          buf.toString('base64').replace(/\//g,'_').replace(/\+/g,'-');
        resolve(state);
      });
    });
  }

  private getScopesStr(): string {
    return this._config.scopes.join('%20');
  }
}
