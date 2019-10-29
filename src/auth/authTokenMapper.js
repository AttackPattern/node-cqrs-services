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

  sign(identity) {
    return jwt.sign(identity, this.secret, {
        expiresIn: this.expiration.identity
    });
  }

  authenticate(identity) {
    return {
      token: this.sign(identity),
      refresh: this.signRefresh(identity)
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
