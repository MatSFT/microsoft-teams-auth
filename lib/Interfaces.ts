import {User, Tokens} from './Models'

export interface IHTTP {
  get(uri: string): Promise<string>;
  post(uri: string, body: string) : Promise<string>;
}

export interface RouterCallback {
  (res: any, req: any): void
}

export interface IRouter {
  get(endpoint: string, callback: RouterCallback): void
  get(endpoint: string, middletier: any, callback: RouterCallback): void
  post(endpoint: string, callback: RouterCallback): void
}

export interface ILogger {
  info(message: string): void
  warn(message: string): void
  debug(message: string): void
  error(message: string): void
}

export interface IConfig {
  microsoftAppId: string,
  microsoftAppPassword: string,
  rootUri: string,
  scopes: Array<string>
  tenant?: string,
  openIdConfigUri?: string,
  adminConsentUri?: string,
  adminConsentEndpoint?: string,
  adminTokenEndpoint?: string,
  loginEndpoint?: string,
  logoutEndpoint?: string,
  tokenEndpoint?: string,
  openIdConfigCacheDuration?: number,
  openIdCertCacheDuration?: number
}

export interface IMicrosoftTeamsAuth {
  getLoginUri(): string
  getAdminConsentUri(): string
}

export interface ITokenStore {
  set(user: User, tokens: Tokens): void
  get(userId: string): Promise<Tokens|undefined>
}
