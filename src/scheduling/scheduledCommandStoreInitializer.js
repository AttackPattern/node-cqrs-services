import mysql from 'mysql2/promise';

export default class ScheduledCommandStoreInitializer {

  static assureTables = async db => {
    await db.knex().raw('CREATE DATABASE IF NOT EXISTS `scheduledcommands`');
    let scheduledCommands = db.knex('scheduledcommands').schema;
    if (!await scheduledCommands.hasTable('commands')) {
      await scheduledCommands.createTable('commands', table => {
        table.bigIncrements('id').primary().notNullable();
        table.string('service', 255).notNullable();
        table.string('type', 255).notNullable();
        table.string('target', 36).defaultTo('');
        table.dateTime('created');
        table.dateTime('due').notNullable();
        table.text('etag');
        table.integer('attempts').defaultTo(0);
        table.text('command').notNullable();
      });
    }
  }
}
