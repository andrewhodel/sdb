# sdb, the right database
var sdb = require('sdb.js');

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

# finding all documents
mydb.find({});
###### returns an array containing documents
###### it also adds a field, _relevance to each document which is the number of matched fields
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
	it is either an object containing modifiers
	$set - change a fields value
	$remove - delete a field
	$add - add by a value
	$subtract - subtract by a value
	$multiply - multiply by a value
	$divide - divide by a value

	# or an object which will simply replace the existing object, except the _id
	{field: 'value'}

###### options sets the available options for the update
	multi - (default false) updates multiple documents if true
	upsert - (default false) adds a new document if no existing document matches if true
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

# npm
npm install sdbjs

# an example showing everything
node example.js

# License
Read AH-LICENSE-V1 before use!
