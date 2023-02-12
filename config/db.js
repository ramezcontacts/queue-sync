import { createPool } from "mysql";
import chalk from "chalk";

const pool = createPool({
  host: process.env.MYSQL_DB_HOST,
  user: process.env.MYSQL_DB_USER,
  password: process.env.MYSQL_DB_PASS,
  database: process.env.MYSQL_DB_DATABASE,
});
pool.getConnection((err) => {
  if (err) throw err;
  console.log(chalk.bgBlueBright("Connected to MYSQL"));
});


export const executeQuery = (query, arrParams) => {
  return new Promise((resolve, reject) => {
    try {

      pool.query(query, arrParams, (err, data) => {
        if (err) {
          console.log(err);
          reject(err);
        }
        resolve(data);
      });
    } catch (err) {
      reject(err);
    }
  });
};

export default pool;
