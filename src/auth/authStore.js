import bcrypt from 'bcrypt';
import uuidV4 from 'uuid/v4';
import speakeasy from 'speakeasy';

import AuthStoreInitializer from './authStoreInitializer';
let saltRounds = 10;

export default class AuthStore {
  static create = async ({ db, identityMapper }) => {
    await AuthStoreInitializer.assureTables(db);

    let store = new AuthStore();
    store.getIdentity = user => identityMapper(user);
    const auth = require('bookshelf')(db.knex('auth'));
    store.Login = auth.Model.extend({
      tableName: 'logins',
    });
    store.Feature = auth.Model.extend({
      tableName: 'features',
    });

    return store;
  };

  addUser = async ({
    userId,
    username,
    password,
    claims,
    updateClaims = claims => claims,
    status = 'active',
  }) => {
    try {
      let hashedPassword = await bcrypt.hash(password, saltRounds);
      let user = await this.Login.where({ username }).fetch({
        columns: ['id', 'userId', 'username', 'claims'],
      });
      if (!user) {
        await new this.Login().save({
          userId,
          username,
          password: hashedPassword,
          claims: JSON.stringify({ ...claims, ...updateClaims({}) }),
          version: uuidV4(),
          status,
        });
        return await this.getUser({ username });
      }
      await user.save(
        {
          userId,
          claims: JSON.stringify(
            { ...user.get('claims'), ...claims, ...updateClaims(user.get('claims') || {}) } || {}
          ),
          version: uuidV4(),
        },
        { patch: true }
      );
    } catch (e) {
      console.log('Failed to add login', e);
      throw e;
    }
  };

  enable2fa = async ({ username }, config = {}) => {
    let userModel = await this.Login.where({ username }).fetch({
      columns: ['id', 'username', 'userId', 'enabled2FA', 'secret', 'status'],
    });
    const user = userModel.toJSON();
    // we might want to block flooding of the system by preventing calls when a secret is present
    // current approach allows easy re-issue of token in the case they lose their otp url
    if (!userModel || !!user?.enabled2FA) {
      throw new Error(
        !user ? "User doesn't exist" : '2FA is already enabled/pending for this account'
      );
    }
    if (user.status !== 'active') {
      throw new Error(
        `user must be active to enable 2fa.  current status: ${userModel.get('status')}`
      );
    }
    // merge in the users email (username) to the name object for the 2FA config
    const speakeasyConfig = config?.name
      ? { ...config, name: `${config.name} (${user.username})` }
      : config;
    const secret = speakeasy.generateSecret(speakeasyConfig);
    await userModel.save({ secret: secret.base32 });
    return { userId: user.id, qrCodeUrl: secret.otpauth_url };
  };

  confirm2fa = async ({ username, totpCode }) => {
    let userModel = await this.Login.where({ username }).fetch({
      columns: ['id', 'userId', 'secret', 'enabled2FA'],
    });
    const user = userModel.toJSON();
    if (!user || !user?.secret) {
      throw new Error(!user ? "User doesn't exist" : 'no secret present to verify against');
    }
    if (user.secret && user.enable2fa) {
      throw new Error('2FA already enabled and confirmed');
    }
    const verified = speakeasy.totp.verify({
      secret: user.secret,
      encoding: 'base32',
      token: totpCode,
    });
    if (verified) {
      await userModel.save({ enabled2FA: true });
      return { confirmed: true };
    } else {
      throw new Error("Confirmation code doesn't match");
    }
  };

  deactivate2fa = async ({ username, totpCode }) => {
    let userModel = await this.Login.where({ username }).fetch({
      columns: ['id', 'userId', 'secret', 'enabled2FA'],
    });
    const user = userModel.toJSON();
    if (!user || !user?.secret || !user?.enabled2FA) {
      throw new Error(!user ? "User doesn't exist" : '2FA not enabled');
    }
    const verified = speakeasy.totp.verify({
      secret: user.secret,
      encoding: 'base32',
      token: totpCode,
      window: 6,
    });
    if (verified) {
      await userModel.save({ enabled2FA: false, secret: '' });
      return { removed: true };
    } else {
      throw new Error("Confirmation code doesn't match");
    }
  };

  verify2fa = async ({ username, totpCode }) => {
    let userModel = await this.Login.where({ username })
      .where('status', '<>', 'suspended')
      .fetch();
    const user = userModel.toJSON();
    if (!user || !user?.secret || !user?.enabled2FA) {
      throw new Error(!user ? "User doesn't exist" : '2FA not enabled');
    }
    const verified = speakeasy.totp.verify({
      secret: user.secret,
      encoding: 'base32',
      token: totpCode,
      window: 6,
    });
    if (!verified) throw new Error('Incorrect totp code');
    return { ...this.getIdentity(user), status: user.status };
  };

  toggleFeatures = async ({ organizationId, features }) => {
    let organization = await this.Feature.where({ organizationId }).fetch();
    if (organization) {
      organization.save({
        claims: JSON.stringify({ ...features }),
      });
    } else {
      await new this.Feature().save({ organizationId, claims: JSON.stringify({ ...features }) });
    }
  };

  getFeatures = async organizationIds => {
    try {
      const featureSets = await this.Feature.where({ organizationId: organizationIds }).query();
      return featureSets || {};
    } catch (e) {
      console.log('Could not find organization with enabled features', e.message);
      return null;
    }
  };

  getUser = async ({ username, version }) => {
    try {
      let userRecords = await this.Login.where(
        version ? { username, version } : { username }
      ).query();
      let user = userRecords.length && userRecords[0];
      if (user) {
        user.claims = user.claims || { roles: [] };
      }

      return user ? this.getIdentity(user) : null;
    } catch (e) {
      console.log('Could not find user', e);
      return null;
    }
  };

  updateEmail = async ({ userId, newEmail }) => {
    try {
      let user = await this.Login.where({ userId }).fetch();
      await user.save(
        {
          userId,
          username: newEmail,
        },
        { patch: true }
      );
      return user;
    } catch (ex) {
      console.log('user not found for email update');
      return null;
    }
  };

  removeUser = async ({ userId }) => {
    // if we remove a user, destroy (delete) their login credentials from the db.
    // This will orphan the user in projections which leaves them in place for historical lookup purposes
    // this also allows a user of the same email/name to now exist with updated data.
    const user = await new this.Login({ userId }).fetch();
    await user.destroy();
  };

  removeUserFromOrg = async ({ organizationId, userId }) => {
    let user = await this.Login.where({ userId }).fetch({ columns: ['id', 'userId', 'claims'] });
    const organizations = {
      ...user.get('claims').organizations,
    };
    delete organizations[organizationId];
    await user.save(
      {
        userId,
        claims: JSON.stringify({ ...user.get('claims'), organizations } || {}),
      },
      { patch: true }
    );
  };

  checkLogin = async ({ username, password }) => {
    let userRecords = await this.Login.where({ username })
      .where('status', '<>', 'suspended')
      .query();
    let user = userRecords.length && userRecords[0];
    if (user && (await bcrypt.compare(password, user.password))) {
      return { ...this.getIdentity(user), status: user.status };
    }
  };

  changePassword = async ({ userId, password, status }) => {
    let hashedPassword = await bcrypt.hash(password, saltRounds);
    let user = await this.Login.where({ userId }).fetch();
    await user.save(
      { password: hashedPassword, version: uuidV4(), status: status || 'active' },
      { patch: true }
    );
  };

  updateRoles = async ({ userId, organizationId, roles = [] }) => {
    let error = null;
    if (!organizationId) {
      error = 'No organizationId provided to updateRoles.';
    }
    if (!roles.length) {
      error = 'No roles provided to updateRoles. A user must have at least one role.';
    }
    let user = await this.Login.where({ userId }).fetch();
    if (!user) {
      error = 'User not found for updateRoles.';
    }
    const organizations = { ...user.get('claims').organizations };
    if (!organizations[organizationId]) {
      error = 'Organization not found for updateRoles.';
    }
    if (error) {
      console.log(error);
      throw error;
    }
    organizations[organizationId].roles = roles;
    const claims = user.get('claims') || {};
    await user.save({ claims: JSON.stringify({ ...claims, organizations }) }, { patch: true });
  };

  enableUser = async ({ userId }) => this._setUserStatus({ userId, status: 'active' });
  suspendUser = async ({ userId }) => this._setUserStatus({ userId, status: 'suspended' });

  _setUserStatus = async ({ userId, status }) => {
    try {
      let user = await this.Login.where({ userId }).fetch();
      await user.save({ status, version: uuidV4() }, { patch: true });
    } catch (e) {
      console.log('Error setting user status', e);
      throw e;
    }
  };

  count = () => this.Login.count();
}
