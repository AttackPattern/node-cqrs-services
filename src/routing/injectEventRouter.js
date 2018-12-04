import Router from 'koa-router';

export default class InjectEventRouter extends Router {
  constructor({ repositories, eventStore }) {
    super();

    this
      .post('/injectEvent', async ctx => {
        const { aggregate, aggregateId, type, ...body } = ctx.request.body;

        const identity = ctx.$identity;

        if (!identity.rights.includes('injectEvent')) {
          ctx.status = 401;
          return ctx.body = { message: 'User cannot call this endpoint' };
        }

        const target = await repositories[aggregate].get(aggregateId);

        if (!target) {
          ctx.status = 400;
          return ctx.body = { message: 'Aggregate target not found' };
        }
        const event = {
          aggregate,
          aggregateId,
          type,
          actor: 'injected',
          sequenceNumber: target.version + 1,
          ...body
        };

        await eventStore.recordEvent(event);
        ctx.status = 200;
        ctx.body = { messager: 'Saved' };
      });
  }
}
