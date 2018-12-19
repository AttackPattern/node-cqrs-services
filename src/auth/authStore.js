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

  addUser = async ({ userId, username, password, claims, updateClaims = claims => claims, status = 'active' }) => {
    try {
      let hashedPassword = await bcrypt.hash(password, saltRounds);
      let user = (await this.Login.where({ username }).fetch({ columns: ['id', 'userId', 'username', 'claims'] }));
      if (!user) {
        console.log('adding new user', username);
        await new this.Login().save({ userId, username, password: hashedPassword, claims: JSON.stringify({ ...claims, ...updateClaims({}) }), version: uuidV4(), status });
      }
      else {
        console.log('updating user', username);
        await user.save({
          userId,
          claims: JSON.stringify({ ...user.get('claims'), ...claims, ...updateClaims(user.get('claims') || {}) } || {}),
          version: uuidV4()
        }, { patch: true });
      }
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
