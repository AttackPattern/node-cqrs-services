import { ValidationError, AuthorizationError } from '@facetdev/node-cqrs-lib';

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

  handleCommand = async ({ ctx, commandType }) => {
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
    catch (error) {
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
}
