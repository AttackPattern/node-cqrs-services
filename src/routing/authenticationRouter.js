import Router from 'koa-router';
import { Strategy as LocalStrategy } from 'passport-local';

import { extractToken } from './identityMiddleware';

export default class AuthenticationRouter extends Router {
  constructor({ passport, authStore, decorateUser, authTokenMapper, passwordHandler }) {
    super();

    this.authStore = authStore;
    passport.use(
      new LocalStrategy({ session: false, passReqToCallback: false }, this.authenticate)
    );

    this.post('/resetPassword', passwordHandler.handleResetCommand)
      .post('/changePassword', passwordHandler.handleChangeCommand)
      .post('/refresh', async (ctx, next) => {
        try {
          let { refresh } = ctx.headers;
          const { identity } = await authTokenMapper.verify(refresh);
          const user = await authStore.getUser(identity);
          const token = await authTokenMapper.sign({ ...user });
          ctx.body = {
            ...user,
            token,
          };
          ctx.status = 200;
        } catch (ex) {
          ctx.status = 401;
          ctx.body = { error: 'Bad refresh token' };
          return;
        }
      })
      .post('/enable2fa', async (ctx, next) => {
        try {
          const token = extractToken(ctx);
          const verify = await authTokenMapper.verify(token);
          if (!verify?.identity) throw new Error('You must be logged in to enable 2FA');
          const { body } = ctx.request;
          if (!!body?.totpCode) {
            // confirm 2FA
            ctx.body = await this.authStore.confirm2fa({
              ...verify?.identity,
              totpCode: body.totpCode,
            });
          } else {
            ctx.body = await this.authStore.enable2fa(verify?.identity);
          }
          console.log('ctx body', ctx.body);
          ctx.status = 200;
        } catch (ex) {
          ctx.status = 401;
          ctx.body = { error: ex?.message };
        }
      })
      .post('/login', async (ctx, next) =>
        passport.authenticate('local', async (err, identity) => {
          if (err) {
            console.log('Authentication failure', err);
            ctx.status = 401;
            ctx.body = { error: 'Invalid username or password' };
            return;
          }
          ctx.body = {
            ...identity,
            ...(await authTokenMapper.authenticate(identity)),
            ...(await decorateUser(identity)),
          };
          ctx.status = 200;
        })(ctx, next)
      );
  }

  authenticate = async (username, password, done) => {
    let foundUser = await this.authStore.checkLogin({ username, password });
    done(!foundUser && 'User not found', foundUser);
  };
}
