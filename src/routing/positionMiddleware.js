import { Position } from '../models';

export default class PositionMiddleware {
  constructor(positionStore) {
    this.positionStore = positionStore;
  }

  inject = async(ctx, next) => {
    ctx.$position = this.getPosition(ctx);
    await next();

    if (ctx.request.url !== '/position/TrackPosition' &&
      ctx.$position &&
      ctx.$identity &&
      ctx.$identity.claims.responderId) {
      this.positionStore.store({
        responderId: ctx.$identity.claims.responderId,
        position: ctx.$position
      });
    }
  }

  getPosition = ctx => {
    try {
      return ctx.headers.position && ctx.headers.position.length &&
        new Position(JSON.parse(new Buffer(ctx.headers.position, 'base64').toString()));
    }
    catch (error) {
      return null;
    }
  };
}
