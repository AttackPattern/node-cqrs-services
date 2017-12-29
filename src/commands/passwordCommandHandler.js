export default class PasswordCommandHandler {
  constructor(domainCommandDeliverer, authStore) {
    this.domainCommandDeliverer = domainCommandDeliverer;
    this.authStore = authStore;
  }

  handleResetCommand = async ctx => {
    return this.handleCommand({ ctx, commandType: 'ResetPassword' });
  }

  handleChangeCommand = async ctx => {
    return this.handleCommand({ ctx, commandType: 'ChangePassword' });
  }

  handleCommand = async({ ctx, commandType }) => {
    const command = ctx.request.body;
    command.$identity = ctx.$identity;
    command.$position = ctx.$position;

    let username = command.username;
    let user = await this.authStore.getUser({ username });
    if (!user) {
      console.log('User not found or not enabled', username);
      ctx.body = { error: 'User not found or not enabled' };
      ctx.status = 404;
      return;
    }

    try {
      ctx.body = await this.domainCommandDeliverer.deliver({
        service: 'user',
        target: user.userId,
        commandType: commandType,
        command
      });
      ctx.status = 200;
      return;
    }
    catch (e) {
      if (e.error.name === 'ValidationError') {
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
