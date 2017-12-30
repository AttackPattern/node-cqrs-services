import Router from 'koa-router';
import { Strategy as LocalStrategy } from 'passport-local';

export default class AuthenticationRouter extends Router {
  constructor({ passport, authStore, userProfiles, getVendor, authTokenMapper, passwordHandler }) {
    super();

    this.authStore = authStore;
    passport.use(new LocalStrategy({ session: false, passReqToCallback: false }, this.authenticate));

    this
      .post('/resetPassword', passwordHandler.handleResetCommand)
      .post('/changePassword', passwordHandler.handleChangeCommand)
      .post('/login', async (ctx, next) =>
        passport.authenticate('local', async (err, identity, info) => {
          if (err) {
            console.log('Authentication failure', err);
            ctx.status = 401;
            ctx.body = { error: 'Invalid username or password' };
            return;
          }

          let vendor = identity.claims.vendorId && (await getVendor(identity.claims.vendorId));
          ctx.body = {
            ...identity,
            token: authTokenMapper.sign(identity),
            profile: await userProfiles.getProfile(identity.userId),
            vendor: vendor && {
              companyName: vendor.companyName,
              capabilities: vendor.capabilities,
              phone: vendor.phone,
              homeLocation: vendor.homeLocation,
              incidentDetails: vendor.incidentDetails,
              reportEmail: vendor.reportEmail
            }
          };
          ctx.status = 200;
        })(ctx, next));
  }

  authenticate = async (username, password, done) => {
    let foundUser = await this.authStore.checkLogin(username, password);
    done(!foundUser && 'User not found', foundUser);
  }
}
