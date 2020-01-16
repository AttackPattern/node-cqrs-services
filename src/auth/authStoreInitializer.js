export default class AuthStoreInitializer {
  static assureTables = async db => {
    await db.knex().raw('CREATE DATABASE IF NOT EXISTS `auth`');

    let knex = db.knex('auth');
    if (!(await knex.schema.hasTable('logins'))) {
      await knex.schema.createTable('logins', table => {
        table
          .bigIncrements('id')
          .primary()
          .notNullable();
        table.string('userId', 36).notNullable();
        table.string('username', 255).notNullable();
        table.string('password', 128).notNullable();
        table.specificType('claims', 'json');
        table
          .string('status', 36)
          .notNullable()
          .defaultTo('active');
        table.string('version', 36).notNullable();
        table.string('secret', 64);
        table.boolean('enabled2FA').defaultTo(0);
        table.unique('username');
      });
    }
    if (!(await knex.schema.hasTable('features'))) {
      await knex.schema.createTable('features', table => {
        table
          .bigIncrements('id')
          .primary()
          .notNullable();
        table.string('organizationId', 36).notNullable();
        table.specificType('claims', 'json');
        table.unique('organizationId');
      });
    }
  };
}
