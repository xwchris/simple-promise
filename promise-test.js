var promisesAplusTests = require('promises-aplus-tests');
var adapter = require('./src/simple-promise');

promisesAplusTests(adapter, function (err) {
  if (err) {
    console.log(err);
  } else {
    console.log('test success');
  }
});
