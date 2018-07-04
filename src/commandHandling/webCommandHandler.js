import uuidValidate from 'uuid-validate';
import { ValidationError, AuthorizationError } from '@attackpattern/node-cqrs-lib';

export default class WebCommandHandler {
  constructor(domainCommandDeliverer) {
    this.domainCommandDeliverer = domainCommandDeliverer;
  }

  handleCommand = async ctx => {
    console.log('start handle');
    console.log('i mean it');
    const command = ctx.request.body;
    command.$position = ctx.$position;
    command.$identity = ctx.$identity;
    command.$timestamp = new Date();

    let aggregateId = ctx.params.aggregateId;
    if (aggregateId && !uuidValidate(aggregateId)) {
      ctx.status = 404;
      ctx.body = { error: `${aggregateId} is not a valid UUID` };
      return;
    }

    try {
      ctx.body = await this.domainCommandDeliverer.deliver({
        service: ctx.params.service,
        target: aggregateId,
        commandType: ctx.params.commandType,
        command
      });
      ctx.status = 200;
      return;
    }
    catch (e) {
      this.handleError(ctx, e);
    }
  }

  handleError(ctx, error) {
    if (error instanceof ValidationError) {
      console.log('Validation failure');
      ctx.status = 400;
    }
    else if (error instanceof AuthorizationError) {
      console.log('Authorization failure');
      ctx.status = 403;
    }
    else {
      console.log('Unexpected exception');
      ctx.status = 500;
    }

    ctx.body = { error: error ?.message };
    console.log(error);
  }
}
