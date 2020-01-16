import { Identity } from '@facetdev/node-cqrs-lib';

export const extractToken = ctx => {
  let { [0]: type, [1]: token } =
    (!!ctx.headers.authorization && ctx.headers.authorization.split(' ')) || [];

  return token || type;
};

export default class IdentityMiddleware {
  constructor(authTokenMapper) {
    this.authTokenMapper = authTokenMapper;
  }

  inject = async (ctx, next) => {
    try {
      const { identity, token } = await this.getIdentity(ctx);
      if (identity?.claims?.require2fa && ctx.request.url !== '/verify2fa')
        throw new Error('2FA verification required');
      ctx.$identity = identity;
      await next();
    } catch (err) {
      console.log('Failed validating authentication token', err.message);
      ctx.status = 401;
      ctx.body = { error: err.name || 'Failed validating authentication token' };
    }
  };

  getIdentity = ctx => {
    let token = extractToken(ctx);
    if (!token) {
      return { identity: Identity.anonymous };
    }
    return this.authTokenMapper.verify(token);
  };
}
