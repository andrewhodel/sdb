# SDB - a database in js that operates in memory and provides indexes, range searches, regex searches and fulltext searches

# Having Problems?
Please file a bug report if you have a problem.

# sdb, the right database
var sdb = require('sdbjs'); // use sdb.js is you got this from source, sdbjs is for npm

# create a new datastore
###### the first argument is optional and will load data from an existing save
###### if the path does not exist it will create it
var mydb = new sdb('/path/to/my.db');

# insert a document
###### it can only be a set of key|value pairs
var doc = {planet: 'Earth',
	ocean: 'Gulf of Mexico',
	lat: 25,
	lon: -90,
	max_width_km: 1500,
	surface_area_km_2: 1550000,
};

mydb.insert(doc);
###### returns the newly inserted document, including it's automatically generated _id
###### you cannot create documents which have fields with an _ as the first character

###### It will return an object if the insert was a success and an error string if the insert was a failure
###### Here is how you check for an error
var inserted_doc = db.insert({name: 'name'});
if (typeof(inserted_doc) == 'string') {
	// there was an error
} else {
	// insert was a success
}

# finding documents
###### the first argument is an object which is the query
###### you can use operator objects or a value
	{field: 'string to search by'} // string search
	{field: 10} // number search
	{field: {$regex: '/^string/i'}} // regex search
	{field: {$fulltext: 'words to search with'}} // fulltext search
	{field: {$gt: 0}} // greater than
	{field: {$gte: 0}} // greater than or equal
	{field: {$lt: 0}} // less than
	{field: {$lte: 0}} // less than or equal
###### the second argument (require_all_keys) is optional and if false
###### will return documents that only match some of the keys provided in the query
mydb.find({}, false);
###### returns an array containing documents that matched
###### it also returns a field, _relevance to each document which is the number of matched fields

###### you can sort by it using sort()
###### you may wonder why sort(), limit() and find() are not chained as it seems that it would be faster
###### the truth is that all the documents have to be found before limit() or find()
###### in order to sort by _relevance

# sorting documents
###### highest_first - Z10-A0
###### lowest_first - A0-Z10
mydb.sort({lat:'highest_first'}), docs);
###### returns an array containing sorted documents

# limiting the number of results
###### first argument is the number to limit the results to
mydb.limit(1, docs);
###### returns an array containing the limited documents

# skipping the first N results
mydb.skip(1, docs);
###### returns an array excluding the skipped documents

# updating documents
###### query is the same kind of query you would use with find or count

###### update explains how the document should be updated
###### it is either an object containing modifiers or a document to replace the document or documents found with the query
	{field1: 'value', field2: 'another value'} // replaces the entire document except _id
	{$set: {field: 'value'}} // change a fields value
	{$remove: {field: 1}} // delete a field
	{$add: {field: 1}} // add by a value
	{$subtract: {field: 1}}} // subtract by a value
	{$multiply: {field: 10}} // multiply by a value
	{$divide: {field: 10}} // divide by a value

###### options sets the available options for the update
	{multi: false} // (default false) updates multiple documents if true
	{upsert:false} // (default false) adds a new document if no existing document matches if true
mydb.update(query, update, options);
###### returns the updated documents on success
###### or a string indicating the error on failure

# removing documents
###### first argument is a query like that passed to find or update
mydb.remove({});
###### returns number of documents removed

# create an index
###### field (string) - name of the field to index
###### unique (boolean default false) - if the field should be a unique field
###### required_field (boolean default false) - if the field is required for an insert and cannot be removed with $remove
mydb.index(field, true, true);
###### returns true on success and error message string on failure

# remove an index
mydb.remove_index('field');
###### returns nothing

# save the datastore, it's always only in memory.
###### you need to write it to disk when you want, probably after you update it but maybe not
###### everything is an atomic operation meaning perfectly in series
###### so don't worry about anything not syncing up right
mydb.save('my.db');

# lock(), unlock() and the SQL vs noSQL wars
> SQL bitches because of this situation; imagine that
> 2 users were accessing the database and while one was
> reading a list of id's in one table and joining them to a list of
> names with corresponding id's in another table another user was
> modifying the list of corresponding names to id's in the other table.
> 
> so nosql tries to solve this by basically using only the locks
> of update and read per "table" or "collection" call
> (meaning they have no JOINS and they have plenty of hard drive space)
> they do this by storing the "oh I need to look up the _id to get that name"
> directly in the first table or collection.
> nosql basically says let's fragment everything up into tiny databases
> and handle the locks at a higher level, like at the API between 2 or more
> parties so that 50 people aren't accessing something at once anyway.
> you have to admit that does seem prone to error
> 
> the issue is that then if you have a table with a million rows storing the same
> data there's no point in using the relational part of a database
> 
> what I do not understand, is why can't they just pass along a function allowing
> the user to lock and unlock their own database?
> Then the user just needs find, update and delete and if they wan't to join
> in any crazy way they can dream up, they just do it in the data loops (they can store it locally in a big loop while locking)
> 
> that is why db.lock() and db.unlock() exist in sdb, you
> only need to use them if this type of situation were to arise

mydb.lock();
###### locks the database

mydb.unlock();
###### unlocks the database

# npm
npm install sdbjs

# an example showing everything
node example.js

# License
MIT
