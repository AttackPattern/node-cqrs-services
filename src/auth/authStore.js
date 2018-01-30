import bcrypt from 'bcrypt';
import uuidV4 from 'uuid/v4';
import AuthStoreInitializer from './authStoreInitializer';
import { Identity } from 'node-cqrs-lib';

let saltRounds = 10;

export default class AuthStore {

  static create = async ({ db, roleMapping }) => {
    await AuthStoreInitializer.assureTables(db);

    let store = new AuthStore();
    store.getIdentity = id => ({
      ...new Identity(id),
      capabilities: roleMapping.getCapabilities(id.claims.roles)
    });
    store.Login = require('bookshelf')(db.knex('auth')).Model.extend({
      tableName: 'logins'
    });

    return store;
  }

  addLogin = async ({ userId, username, password, claims = { roles: [] }, status = 'active' }) => {
    try {
      let hashedPassword = await bcrypt.hash(password, saltRounds);
      let user = (await this.Login.where({ username }).fetch({ columns: ['id', 'userId', 'username', 'claims'] }));
      if (!user) {
        console.log('adding new user', username);
        await new this.Login().save({ userId, username, password: hashedPassword, claims: JSON.stringify(claims), version: uuidV4(), status });
      }
      else {
        console.log(`updating user ${username}`, user.get('claims'), claims);
        await user.save({ userId, password: hashedPassword, claims: JSON.stringify(merge(user.get('claims'), claims) || {}), version: uuidV4() }, { patch: true });
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
      return user && this.getIdentity(user);
    }
    catch (e) {
      console.log('Could not find user', e);
      return null;
    }
  }

  checkLogin = async (username, password) => {
    let userRecords = await this.Login.where({ username }).where('status', '<>', 'suspended').query();
    let user = userRecords.length && userRecords[0];
    if (user && await bcrypt.compare(password, user.password)) {
      return { ...this.getIdentity(user), status: user.status };
    }
  }

  addClaims = async ({ userId, claims }) => {
    try {
      let user = await this.Login.where({ userId }).fetch();
      await user.save({ claims: JSON.stringify(merge(user.get('claims') || {}, claims)), version: uuidV4() }, { patch: true });
    }
    catch (e) {
      console.log('Error updating roles', e);
      throw e;
    }
  }

  changePassword = async ({ userId, password }) => {
    let hashedPassword = await bcrypt.hash(password, saltRounds);
    let user = await this.Login.where({ userId }).fetch();
    await user.save({ password: hashedPassword, version: uuidV4(), status: 'active' }, { patch: true });
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
}

function merge(target = {}, values = {}) {
  return Object.entries(values)
    .map(entry => ({ key: entry[0], value: entry[1] }))
    .reduce((result, entry) => {
      result[entry.key] = Array.isArray(entry.value) ?
        Array.from(new Set(result[entry.key] ? entry.value.concat(result[entry.key]) : entry.value)) :
        entry.value;

      return result;
    }, target);
}
