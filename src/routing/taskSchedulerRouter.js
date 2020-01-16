import Router from 'koa-router';
import rawBody from 'raw-body';
import jwt from 'jsonwebtoken';

export default class TaskSchedulerRouter extends Router {
  constructor({ deliverer, secret }) {
    super();
    this.deliverer = deliverer;
    this.secret = secret;

    this.prefix('/task').post('/deliver', async ctx => this.deliver(ctx));
  }

  deliver = async ctx => {
    try {
      const command = JSON.parse(
        (await rawBody(ctx.req, {
          length: ctx.req.headers['content-length'],
          limit: '1mb',
        })).toString()
      );
      const validToken = await jwt.verify(command.$scheduler.token, this.secret);
      if (validToken) {
        console.log(`task scheduler delivery ${command.type}:${validToken.target}`);
        this.deliverer.deliver({
          service: validToken.service,
          target: validToken.target,
          command,
        });
      }
    } catch (ex) {
      console.log('task scheduler delivery failed', ex);
    } finally {
      ctx.status = 200;
      ctx.message = 'Received task';
    }
  };
}
