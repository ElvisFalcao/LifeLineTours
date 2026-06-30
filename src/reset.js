// Deletes the SQLite database files so the next start re-seeds fresh demo data.
const fs = require('fs');
const { DB_PATH } = require('./config');

for (const suffix of ['', '-wal', '-shm']) {
  const file = DB_PATH + suffix;
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log('Removed', file);
  }
}
console.log('Database reset. Run "npm start" to recreate demo data.');
