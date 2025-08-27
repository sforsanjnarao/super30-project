// import pkg from 'pg';
const pkg = require('pg')
const { Pool } = pkg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'mydb',
  password: 'postgres',
  port: 5432,
});

export default pool;
