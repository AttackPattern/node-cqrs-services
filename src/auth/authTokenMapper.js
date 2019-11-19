import jwt from 'jsonwebtoken';

class TokenExpiredError extends Error {
  name = 'TokenExpiredError';
}

export default class AuthTokenMapper {
  constructor({ authStore, secret, expiration, identityMapper }) {
    this.authStore = authStore;
    this.secret = secret;
    this.expiration = expiration;
    this.identityMapper = identityMapper;
  }

  signRefresh(identity) {
    return jwt.sign(identity, this.secret, {
      expiresIn: this.expiration.refresh
    });
  }

  async sign(identity) {
    // if the user belongs to an organization lets make sure to merge in all features of the org
    let features = [];
    if (Object.keys(identity?.claims?.organizations)?.length) {
      features = await this.authStore.getFeatures(Object.keys(identity?.claims?.organizations));
      features.forEach(f => {
        identity.claims.organizations[f.organizationId].features = Object.keys(f.claims);
      });

    }
    return jwt.sign(identity, this.secret, {
        expiresIn: this.expiration.identity
    });
  }

  async authenticate(identity) {
    return {
      token: await this.sign(identity),
      // refresh token is only needed for identity extraction on token refresh, minimize token size
      refresh: this.signRefresh({
        username: identity.username,
        userId: identity.userId,
        claims: { organizations: {} }
      })
    };
  }

  verify = async token => {
    try {
      let identity = this.identityMapper(await jwt.verify(token, this.secret));
      return {
        identity,
        token
      };
    }
    catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new TokenExpiredError();
      }
    }
  }
}
