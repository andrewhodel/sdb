var sdb = require('./sdb.js');
var util = require('util');

var mydb = new sdb();

var admin = mydb.insert({email: 'user@domain.com', pw: 'test'});
console.log(util.inspect(admin, true, 10, true));

console.log('\nmydb.find({})');
var data = mydb.find({});
console.log(util.inspect(data, true, 10, true));


console.log('\nmydb.find({email: \'user@domain.com\', pw: \'\'})');
var data = mydb.find({email: 'user@domain.com', pw: ''});
console.log(util.inspect(data, true, 10, true));

mydb.index('email', true, true);
mydb.index('pw', true, true);

console.log('\nmydb.find({email: \'user@domain.com\', pw: \'\'})');
var data = mydb.find({email: 'user@domain.com', pw: 'tesasdft'});
console.log(util.inspect(data, true, 10, true));

