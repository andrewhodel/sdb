# SDB - a database in js that operates in memory and provides indexes, range searches, regex searches and fulltext searches

# Having Problems?
Please file a bug report if you find a problem.

# sdb, the right database
```javascript
var sdb = require('./sdb/sdb.js');

# create a new db
###### the first argument is optional and will load data from an existing save
###### if the path does not exist it will create it
```javascript
var mydb = new sdb('/path/to/my.db');
```

# insert a document
###### it can only be a set of key|value pairs
```javascript
var doc = {planet: 'Earth',
	ocean: 'Gulf of Mexico',
	lat: 25,
	lon: -90,
	max_width_km: 1500,
	surface_area_km_2: 1550000,
};

mydb.insert(doc);
```
###### returns the newly inserted document, including it's automatically generated _id
###### will not create documents that have fields with an _ as the first character

###### It will return an object if the insert was a success and an error string if the insert was a failure
###### Here is how to check for an error
```javascript
var inserted_doc = db.insert({name: 'name'});
if (typeof(inserted_doc) == 'string') {
	// there was an error
} else {
	// insert was a success
}
```

# finding documents
###### the first argument is the query object
###### use operator objects or a value
```javascript
	{field: 'string to search by'} // string search
	{field: 10} // number search
	{field: {$undef: 1}} // not defined
	{field: {$ne: 1}} // not equal to 1 (works with strings also)
	{field: {$regex: '/^string/i'}} // regex search
	{field: {$fulltext: 'words to search with'}} // fulltext search
	{field: {$gt: 0}} // greater than
	{field: {$gte: 0}} // greater than or equal
	{field: {$lt: 0}} // less than
	{field: {$lte: 0}} // less than or equal
	{field: {$mod: 2}} // modulus 2 === 0
```

###### the second argument (require_all_keys) is optional and if false
###### will return documents that only match some of the keys provided in the query
```javascript
mydb.find({}, false);
```

###### returns an array containing documents that matched
###### it also returns a field, _relevance to each document that is the number of matched fields

###### sort by using sort()
###### sort(), limit() and find() are not chained
###### all the documents have to be found before limit() or find()
###### in order to sort by _relevance

# sorting documents
###### highest_first - Z10-A0
###### lowest_first - A0-Z10
```javascript
# returns an array containing sorted documents
mydb.sort({lat:'highest_first'}), docs);
```

# limiting the number of results
###### first argument is the number to limit the results to
```javascript
# returns an array containing the limited documents
mydb.limit(1, docs);
```

# skipping the first N results
```javascript
# returns an array excluding the skipped documents
mydb.skip(1, docs);
```

# updating documents
###### query is the same kind of query used with find or count

###### update explains how the document should be updated
###### it is either an object containing modifiers or a document to replace the document or documents found with the query
```javascript
	{field1: 'value', field2: 'another value'} // replaces the entire document except _id
	{$set: {field: 'value'}} // change a fields value
	{$remove: {field: 1}} // delete a field
	{$add: {field: 1}} // add by a value
	{$subtract: {field: 1}}} // subtract by a value
	{$multiply: {field: 10}} // multiply by a value
	{$divide: {field: 10}} // divide by a value
```

###### options sets the available options for the update
```javascript
	{multi: false} // (default false) updates multiple documents if true
	{upsert:false} // (default false) adds a new document if no existing document matches if true

# returns the updated documents on success
# or a string indicating the error on failure
mydb.update(query, update, options);
```

# removing documents
###### first argument is a query like that passed to find or update
```javascript
# returns number of documents removed
mydb.remove({});
```

# create an index
###### field (string) - name of the field to index
###### unique (boolean default false) - if the field should be a unique field
###### required_field (boolean default false) - if the field is required for an insert and cannot be removed with $remove
```javascript
# returns true on success and error message string on failure
mydb.index(field, true, true);
```

# remove an index
```javascript
# returns nothing
mydb.remove_index('field');
```

# save the db

Disk writes only happen when forced them.

```javascript
mydb.save('my.db');
```

# lock(), unlock() and the SQL vs noSQL wars
> SQL tries to maintain relations with data that is only accessed by row id's.
> example:
> 2 users were accessing the database and while one was
> reading a list of id's in one table and joining them to a list of
> names with corresponding id's in another table another user was
> modifying the list of corresponding names to id's in the other table.
>
> The result in SQL is having many tables locked up at the same time.
> 
> nosql tries to solve this by using only the locks
> of update and read per "table" or "collection" with duplicate data.
> (meaning they have fewer JOINS and they have plenty of hard drive space)
>
> Normally nosql engineers shard the data at the alphabet level and use replicas.
> That is easy to do with SDB, especially in English.
> 
> The issue is that if shards spend a lot of time updating all the data
> or need to join data but don't have copies of it resulting in heavy shard traffic.
> 
> sdb passes along a function allowing
> the user to lock and unlock their own database.
> sdb expects you to build the relational structure of the data
> with respect to the work being completed.
> 
> That is why db.lock() and db.unlock() exist in sdb.

```javascript
# lock the database
mydb.lock();

# unlock the database
mydb.unlock();
```

# npm
`npm install sdbjs`

# an example showing everything
`node example.js`

# License
MIT
