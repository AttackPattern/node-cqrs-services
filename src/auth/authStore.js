import bcrypt from 'bcrypt';
import uuidV4 from 'uuid/v4';
import AuthStoreInitializer from './authStoreInitializer';

let saltRounds = 10;

export default class AuthStore {

  static create = async ({ db, identityMapper }) => {
    await AuthStoreInitializer.assureTables(db);

    let store = new AuthStore();
    store.getIdentity = user => identityMapper(user);
    store.Login = require('bookshelf')(db.knex('auth')).Model.extend({
      tableName: 'logins'
    });

    return store;
  }

  addUser = async ({ userId, username, password, claims, updateClaims = claims => claims }) => {
    try {
      let hashedPassword = await bcrypt.hash(password, saltRounds);
      // Determine if user already exists for update or creation.
      let user = await this.Login.where({ username }).fetch({ columns: ['id', 'userId', 'username', 'claims', 'status'] });
      let status;
      if (!user) {
        // No records, create new user
        status = 'onboard';
        await new this.Login().save({ userId, username, password: hashedPassword, claims: JSON.stringify({ ...claims, ...updateClaims({}) }), version: uuidV4(), status });
      }
      else {
        // User exists, so set their status back to active from a suspension.
        // Or, we are inviting user to a second organization.

        // Get users current status to determine if coming off a suspension or being re-invited to new organization.
        status = user.attributes.status;
        await user.save({
          userId,
          claims: JSON.stringify({ ...user.get('claims'), ...claims, ...updateClaims(user.get('claims') || {}) } || {}),
          status: 'active',
          version: uuidV4()
        }, { patch: true });
      }
      return { status };
    }
    catch (e) {
      console.log('Failed to add login', e);
      throw e;
    }
  }

  getUser = async ({ username, version }) => {
    try {
      let userRecords = await this.Login.where(version ? { username, version } : { username }).query();
      let user = userRecords.length && userRecords[0];
      if (user) {
        user.claims = user.claims || { roles: [] };
      }

      return user ? this.getIdentity(user) : null;
    }
    catch (e) {
      console.log('Could not find user', e);
      return null;
    }
  }

  removeUser = async ({ userId }) => {
    let user = await this.Login.where({ userId }).fetch({ columns: ['id', 'userId', 'claims', 'status'] });
    // NOTE: If removing a user that hasn't yet accepted their invite, just remove from db all together as they will never be able to login because initial random password is lost.
    if (user.attributes.status === 'onboard') {
      return this.Login.where({ userId: user.attributes.userId }).destroy();
    }
    await user.save({
      userId,
      status: 'suspended',
      claims: JSON.stringify({ ...user.get('claims'), organizations: {} } || {})
    }, { patch: true });
  }

  removeUserFromOrg = async ({ organizationId, userId }) => {
    let user = await this.Login.where({ userId }).fetch({ columns: ['id', 'userId', 'claims', 'status'] });
    // NOTE: If removing a user that hasn't yet accepted their invite, just remove from db all together as they will never be able to login because initial random password is lost.
    if (user.attributes.status === 'onboard') {
      return this.Login.where({ userId: user.attributes.userId }).destroy();
    }
    const organizations = {
      ...user.get('claims').organizations
    };
    delete organizations[organizationId];
    await user.save({
      userId,
      claims: JSON.stringify({ ...user.get('claims'), organizations } || {})
    }, { patch: true });
  }

  checkLogin = async ({ username, password }) => {
    let userRecords = await this.Login.where({ username }).where('status', '<>', 'suspended').query();
    let user = userRecords.length && userRecords[0];
    if (user && await bcrypt.compare(password, user.password)) {
      return { ...this.getIdentity(user), status: user.status };
    }
  }

  changePassword = async ({ userId, password, status }) => {
    let hashedPassword = await bcrypt.hash(password, saltRounds);
    let user = await this.Login.where({ userId }).fetch();
    await user.save({ password: hashedPassword, version: uuidV4(), status: status || 'active' }, { patch: true });
  }

  enableUser = async ({ userId }) => this._setUserStatus({ userId, status: 'active' });
  suspendUser = async ({ userId }) => this._setUserStatus({ userId, status: 'suspended' });

  _setUserStatus = async ({ userId, status }) => {
    try {
      let user = await this.Login.where({ userId }).fetch();
      await user.save({ status, version: uuidV4() }, { patch: true });
    }
    catch (e) {
      console.log('Error setting user status', e);
      throw e;
    }
  }

  count = () => this.Login.count();
}

function merge(target = {}, values = {}) {
  return Object.entries(values)
    .reduce((result, [key, value]) => {
      result[key] = Array.isArray(value) ?
        Array.from(new Set(result[key] ? value.concat(result[key]) : value)) :
        value;

      return result;
    }, target);
}
