import Router from 'koa-router';
import rawBody from 'raw-body';

export default class TaskSchedulerRouter extends Router {
  constructor({ deliverer }) {
    super();
    this.deliverer = deliverer;

    this.prefix('/task').post('/deliver', async ctx => this.deliver(ctx));
  }

  deliver = async ctx => {
    try {
      const command = JSON.parse(
        (await rawBody(ctx.req, {
          length: ctx.req.headers['content-length'],
          limit: '1mb'
        })).toString()
      );
      console.log(`task scheduler delivery ${command.type}:${command.$scheduler.target} `);
      this.deliverer.deliver({
        service: command.$scheduler.service,
        target: command.$scheduler.target,
        command
      });
    }
    catch (ex) {
      console.log('task scheduler delivery failed', ex);
    }
    finally {
      ctx.status = 200;
      ctx.message = 'Received task';
    }
  };
}
