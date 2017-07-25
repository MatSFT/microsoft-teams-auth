export class OpenIdConfiguration {
  AuthorizationEndpoint: string;
  TokenEndpoint: string;
  JWKSUri: string;
  Issuer: string;
}

export class User {
  AADId: string;
  Name: string;
}

export class Tokens {
  AccessToken?: string;
  RefreshToken?: string;
  IdToken?: string;
  ExpiresIn?: number;
  ExpiresOn?: number;
}

export class Key {
  KeyType: string;
  PublicKeyUse: string;
  KeyId: string; 
  Certificate: string;
  Issuer: string;

  public toOpenSSL(): string {
    const beginCert = "-----BEGIN CERTIFICATE-----";
    const endCert = "-----END CERTIFICATE-----";

    let cert = this.Certificate;
    cert = cert.replace("\n", "");
    cert = cert.replace(beginCert, "");
    cert = cert.replace(endCert, "");

    let result = beginCert;
    while (cert.length > 0) {
      if (cert.length > 64) {
        result += "\n" + cert.substring(0, 64);
        cert = cert.substring(64, cert.length);
      }
      else {
        result += "\n" + cert;
        cert = "";
      }
    }

    if (result[result.length ] !== "\n") {
      result += "\n";
    }
    result += endCert + "\n";
    return result;
  }
}
