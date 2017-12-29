import uuidValidate from 'uuid-validate';

export default class WebCommandHandler {
  constructor(domainCommandDeliverer) {
    this.domainCommandDeliverer = domainCommandDeliverer;
  }

  handleCommand = async ctx => {
    const command = ctx.request.body;
    command.$position = ctx.$position;
    command.$identity = ctx.$identity;

    let aggregateId = ctx.params.aggregateId;
    if (aggregateId && !uuidValidate(aggregateId)) {
      ctx.status = 404;
      ctx.body = { error: `${aggregateId} is not a valid UUID` };
      return;
    };

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
      if (!e.error) {
        console.log('Unexpected exception');
        ctx.status = 500;
      }
      // TODO (brett): get the typecheck working
      else if (e.error.name === 'ValidationError') {
        console.log('Validation failure');
        ctx.status = 400
      }
      else if (e.error.name === 'AuthorizationError') {
        console.log('Authorization failure');
        ctx.status = 403;
      }
      else {
        ctx.status = 404;
      }

      console.dir(e);
      ctx.body = { error: e.error ? e.error.message : e.message };
    }
  }
}
