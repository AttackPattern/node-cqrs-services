import { Pay as MarkPaid } from '../domain/incident/commands';

export default class PaymentCommandHandler {
  constructor(domainCommandDeliverer, emailer) {
    this.domainCommandDeliverer = domainCommandDeliverer;
  }

  handleCommand = async ctx => {
    const command = ctx.request.body;
    command.$identity = ctx.$identity;
    let ids = command.ids;
    try {
      await Promise.all(ids
        .map(id =>
          this.domainCommandDeliverer.deliver({
            service: 'incident',
            target: id,
            commandType: 'Pay',
            command
          }))
      );
      ctx.status = 200;
      ctx.body = {};
      return;
    }
    catch (e) {
      console.log('Validation failure');
      ctx.status = 400;
      ctx.body = { error: e.error ? e.error.message : e.message };
    }
  }
}
