import { Identity } from 'node-cqrs-lib';

export default class IdentityMiddleware {
  constructor(authTokenMapper) {
    this.authTokenMapper = authTokenMapper;
  }

  inject = async(ctx, next) => {
    try {
      let { identity, token } = await this.getIdentity(ctx);
      ctx.$identity = identity;
      ctx.set('authorization', token);
      await next();
    }
    catch (err) {
      console.log('Failed validating authentication token', err);
      ctx.status = 401;
      ctx.body = { error: err.name || 'Failed validating authentication token' };
    }
  }

  getIdentity = ctx => {
    if (!ctx.headers.authorization) {
      return { identity: Identity.anonymous };
    }
    return this.authTokenMapper.verify(ctx.headers.authorization);
  }
}
