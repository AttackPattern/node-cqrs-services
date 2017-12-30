import mysql from 'mysql2/promise';
import mysqlRaw from 'mysql2';
import knex from 'knex';

export default class DatabaseConnections {
  constructor(connectionOptions) {
    this.connectionOptions = {
      ...connectionOptions,
      multipleStatements: true,
      connectionLimit: 10
    };
  }

  knex = database => knex({
    client: 'mysql2',
    connection: {
      ...this.connectionOptions,
      database: database
    }
  })
}
