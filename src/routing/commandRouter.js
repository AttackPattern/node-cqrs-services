import Router from 'koa-router';

export default class CommandRouter extends Router {
  constructor({ webHandler }) {
    super();

    this.post('/:service/:commandType', webHandler.handleCommand).post(
      '/:service/:aggregateId/:commandType',
      webHandler.handleCommand
    );
  }
}
