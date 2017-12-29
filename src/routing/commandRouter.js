import Router from 'koa-router';

export default class CommandRouter extends Router {
  constructor({ webHandler, passwordHandler }) {
    super();

    this
      .post('/resetPassword', passwordHandler.handleResetCommand)
      .post('/changePassword', passwordHandler.handleChangeCommand)
      .post('/:service/:commandType', webHandler.handleCommand)
      .post('/:service/:aggregateId/:commandType', webHandler.handleCommand)
  }
}
