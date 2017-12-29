export default class EventStoreInitializer {

  static assureEventsTable = async db => {
    await db.knex().raw('CREATE DATABASE IF NOT EXISTS `eventstore`');

    let knex = db.knex('eventstore');
    if (!await knex.schema.hasTable('events')) {
      await knex.schema.createTableIfNotExists('events', table => {
        table.bigIncrements('id').primary().notNullable();
        table.string('aggregate', 255).notNullable();
        table.string('aggregateId', 36).notNullable();
        table.string('type', 255).notNullable();
        table.integer('sequenceNumber').notNullable();
        table.dateTime('timestamp').defaultTo(knex.raw('now()'));
        table.string('actor', 255).notNullable();
        table.text('position');
        table.text('body').notNullable();
        table.string('encryptionKey', 36);
        table.unique(['aggregateId', 'aggregate', 'sequenceNumber']);
      });
    }
  }
}
