var sdb = require('./sdb.js');
var util = require('util');

var mydb = new sdb();

console.log('\nmydb.insert({a_simple_field: \'a_simple_value\'})');
var doc = mydb.insert({a_simple_field: 'a_simple_value'});
console.log(util.inspect(doc, true, 10, true));

console.log('\nmydb.insert({second_simple_field: \'second_simple_value\'})');
var doc = mydb.insert({second_simple_field: 'second_simple_value'});
console.log(util.inspect(doc, true, 10, true));

console.log('\nmydb.update({second_simple_field: \'2nd second_simple_value\'}, {$set: {second_simple_field: \'2nd second_simple_value\'}}, {upsert: true})');
var doc = mydb.update({second_simple_field: '2nd second_simple_value'}, {$set: {second_simple_field: '2nd second_simple_value'}, $add: {counter: 2}}, {upsert: true});
console.log(util.inspect(doc, true, 10, true));

console.log('\nmydb.find({})');
var data = mydb.find({});
console.log(util.inspect(data, true, 10, true));

console.log('\nmydb.sort({second_simple_field: \'lowest_first\'})');
data = mydb.sort({second_simple_field: 'lowest_first'}, data);
console.log(util.inspect(data, true, 10, true));

console.log('\nmydb.limit(1)');
var limited_data = mydb.limit(1, data);
console.log(util.inspect(limited_data, true, 10, true));

console.log('\nmydb.skip(1)');
var skipped_data = mydb.skip(1, data);
console.log(util.inspect(skipped_data, true, 10, true));

console.log('\nmydb.update({second_simple_field: \'second_simple_value\'}, {test: \'test\'})');
var doc = mydb.update({second_simple_field: 'second_simple_value'}, {test: 'test'});
console.log(util.inspect(doc, true, 10, true));

console.log('\nmydb.find({test: \'test\'})');
var data = mydb.find({test: 'test'});
console.log(util.inspect(data, true, 10, true));

console.log('\nmydb.remove({test: \'test\'})');
var num_removed = mydb.remove({test: 'test'});
console.log(num_removed);

console.log('\nmydb.find({})');
var data = mydb.find({});
console.log(util.inspect(data, true, 10, true));

console.log('\nmydb.index(\'a_simple_field\', true, false)');
var did_index_work = mydb.index('a_simple_field', true, false);
console.log('did_index_work', did_index_work);

console.log('\nsdb:');
console.log(util.inspect(mydb, true, 10, true));

console.log('\nmydb.insert({a_simple_field: \'another_simple_value\'})');
var doc = mydb.insert({a_simple_field: 'another_simple_value'});
console.log(util.inspect(doc, true, 10, true));

console.log('\nsdb:');
console.log(util.inspect(mydb, true, 10, true));

console.log('\nmydb.update({_id: doc._id}, {a_simple_field: \'updated_another_simple_value_with_index\'})');
var doc = mydb.update({_id: doc._id}, {a_simple_field: 'updated_another_simple_value_with_index'});
console.log(util.inspect(doc, true, 10, true));

console.log('\nsdb:');
console.log(util.inspect(mydb, true, 10, true));

console.log('\nmydb.find({})');
var data = mydb.find({});
console.log(util.inspect(data, true, 10, true));

console.log('\nmydb.update({_id: doc[0]._id}, {$set: {a_simple_field: \'updated_another_simple_value_with_index_using_modifier\'}})');
var doc = mydb.update({_id: doc[0]._id}, {$set: {a_simple_field: 'updated_another_simple_value_with_index_using_modifier'}});
console.log(util.inspect(doc, true, 10, true));

console.log('\nsdb:');
console.log(util.inspect(mydb, true, 10, true));

console.log('\nmydb.remove({_id: doc[0]._id})');
var num_removed = mydb.remove({_id: doc[0]._id});
console.log(num_removed);

console.log('\nsdb:');
console.log(util.inspect(mydb, true, 10, true));

console.log('\nmydb.remove_index(\'a_simple_field\')');
mydb.remove_index('a_simple_field');

console.log('\nsdb:');
console.log(util.inspect(mydb, true, 10, true));

console.log('\nand finally some simple math with $multiply\nmydb.insert({total: 10})');
var doc = mydb.insert({total: 10});
console.log(util.inspect(doc, true, 10, true));

console.log('\nmydb.find({})');
var data = mydb.find({});
console.log(util.inspect(data, true, 10, true));

console.log('\nmydb.update({_id: doc._id}, {$multiply: {total: 10}})');
var doc = mydb.update({_id: doc._id}, {$multiply: {total: 10}});
console.log(util.inspect(doc, true, 10, true));

console.log('\nmydb.find({})');
var data = mydb.find({});
console.log(util.inspect(data, true, 10, true));

console.log('\nmydb.save(\'./my.db\')');
mydb.save('./my.db');

var read_mydb = new sdb('./my.db');

console.log('\nread_mydb.find({})');
var data = read_mydb.find({});
console.log(util.inspect(data, true, 10, true));

mydb.insert({title: 'this is a test'});
mydb.insert({title: 'this is a test of a test'});
mydb.insert({title: 'this is a test of a test of a test'});
console.log('\nfull text search example');
console.log('mydb.find({title: {$fulltext: "test is a"}})');
var data = mydb.find({title: {$fulltext: 'test is a'}});
console.log(util.inspect(data, true, 10, true));
