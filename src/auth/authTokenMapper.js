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

  sign(identity) {
    return jwt.sign({
      identity: jwt.sign(identity, this.secret, {
        expiresIn: this.expiration.identity
      }),
      refresh: {
        username: identity.username,
        version: identity.version
      }
    }, this.secret, {
      expiresIn: this.expiration.refresh
    });
  }

  verify = async token => {
    let { identity: identityToken, refresh } = await jwt.verify(token, this.secret);
    try {
      let identity = this.identityMapper(await jwt.verify(identityToken, this.secret));
      return {
        identity,
        token
      };
    }
    catch (err) {
      if (err.name === 'TokenExpiredError') {
        let identity = await this.authStore.getUser(refresh);
        if (!identity) {
          throw new TokenExpiredError();
        }
        return {
          identity,
          token: this.sign(identity)
        };
      }
    }
  }
}
