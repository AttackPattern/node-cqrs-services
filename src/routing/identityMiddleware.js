import { Identity } from '@facetdev/node-cqrs-lib';

export default class IdentityMiddleware {
  constructor(authTokenMapper) {
    this.authTokenMapper = authTokenMapper;
  }

  inject = async (ctx, next) => {
    try {
      const { identity, token } = await this.getIdentity(ctx);
      ctx.$identity = identity;
      ctx.set('authorization', token);
      await next();
    }
    catch (err) {
      console.log('Failed validating authentication token', err.message);
      ctx.status = 401;
      ctx.body = { error: err.name || 'Failed validating authentication token' };
    }
  }

  getIdentity = ctx => {
    let { [0]: type, [1]: token } = !!ctx.headers.authorization && ctx.headers.authorization.split(' ') || [];

    token = token || type;
    if (!token) {
      return { identity: Identity.anonymous };
    }
    return this.authTokenMapper.verify(token);
  }
}
