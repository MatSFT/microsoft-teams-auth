import * as Interfaces from './Interfaces'

export class Config implements Interfaces.IConfig {
  microsoftAppId = "";
  microsoftAppPassword = "";
  rootUri = "";
  scopes = new Array<string>();
  tenant = "common";
  openIdConfigUri = "https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration";
  adminConsentUri = "https://login.microsoftonline.com/{tenant}/adminconsent";
  adminConsentEndpoint = "/adminconsent";
  adminTokenEndpoint = "/admintoken";
  loginEndpoint = "/login";
  tokenEndpoint = "/token";
  logoutEndpoint = "/logout";
  openIdConfigCacheDuration = 86400000;
  openIdCertCacheDuration = 86400000;

  constructor(config: Interfaces.IConfig) {
    this.microsoftAppId = config.microsoftAppId || this.microsoftAppId;
    this.microsoftAppPassword = config.microsoftAppPassword || this.microsoftAppPassword;
    this.rootUri = config.rootUri || this.rootUri;
    this.scopes = config.scopes || this.scopes;
    this.tenant = config.tenant || this.tenant;
    this.openIdConfigUri = config.openIdConfigUri || this.openIdConfigUri;
    this.adminConsentUri = config.adminConsentUri || this.adminConsentUri;
    this.adminConsentEndpoint = config.adminConsentEndpoint || this.adminConsentEndpoint;
    this.adminTokenEndpoint = config.adminTokenEndpoint || this.adminTokenEndpoint;
    this.loginEndpoint = config.loginEndpoint || this.loginEndpoint;
    this.tokenEndpoint = config.tokenEndpoint || this.tokenEndpoint;
    this.logoutEndpoint = config.logoutEndpoint || this.logoutEndpoint;
    this.openIdConfigCacheDuration = config.openIdConfigCacheDuration || this.openIdConfigCacheDuration;
    this.openIdCertCacheDuration = config.openIdCertCacheDuration || this.openIdCertCacheDuration;
  }
}

/* tslint:disable:no-console */
export class Logger implements Interfaces.ILogger {
  info(message: string): void {
    console.log(`${Date.now()} [Info] ${message}`);
  }
  warn(message: string): void {
    console.log(`${Date.now()} [Warn] ${message}`);
  }
  debug(message: string): void {
    console.log(`${Date.now()} [Debug] ${message}`);
  }
  error(message: string): void {
    console.log(`${Date.now()} [Error] ${message}`);
  }
}
/* tslint:enable:no-console */
