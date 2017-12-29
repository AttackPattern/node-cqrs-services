import { Position } from '../models';

export default class PositionMiddleware {
  inject = async(ctx, next) => {
    ctx.$position = this.getPosition(ctx);
    await next();
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
