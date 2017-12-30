export default class PositionCommandHandler {
  constructor(name, positionStore) {
    this.name = name;
    this.positionStore = positionStore;
  }

  handleCommand = async ctx => {
    const command = ctx.request.body || {};
    let position = ctx.$position;
    let identity = ctx.$identity;

    if (!position.validate()) {
      ctx.status = 400;
      ctx.body = { error: 'position was not valid ' };
      return;
    }

    if (!identity.claims.responderId) {
      ctx.status = 400;
      ctx.body = { error: 'Only responder positions can be tracked' };
      return;
    }

    try {
      await this.positionStore.store({
        responderId: identity.claims.responderId,
        position: position
      });
      ctx.status = 200;
      return ctx.body = { message: 'Position saved' };
    }
    catch (err) {
      console.log('Failed to record tracked position', err);
      ctx.status = 400;
      return ctx.body = { error: 'Position not saved' };
    }
  }
}
