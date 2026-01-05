const Shuttle = require('./shuttle');
const shuttle = new Shuttle();
const id = process.argv[2];
if (!id) {
  console.log('Usage: node example-pull.js {ID}');
  process.exit(1);
}
shuttle.pull(id).then(data => {
  console.log('Received Payload:', data);
  process.exit(0);
}).catch(console.error);