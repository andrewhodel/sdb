// Copyright 2020 Andrew Hodel
// License MIT
'use strict';

var fs = require('fs');
var crypto = require('crypto');

var sdb = function(path=false) {

	if (path) {
		if (fs.existsSync(path)) {
			// read from path
			var local_sdb = JSON.parse(fs.readFileSync(path));
			for (var key in local_sdb) {
				this[key] = local_sdb[key];
			}
		} else {
			// create that file
			this.docs = [];
			this.indexes = {};
			fs.writeFileSync(path, JSON.stringify(this).toString('utf-8'));
		}
	} else {
		this.docs = [];
		this.indexes = {};
	}
	this.canUse = 1;

}

sdb.prototype.insert = function(doc, already_blocking=false) {
	// doc is an object that is the document

	// ensure that no field names exist with _ as the first character
	for (var field in doc) {
		if (field[0] == '_') {
			return 'Documents cannot contain fields that start with an _, like '+field;
		}
	}

	if (already_blocking === false) {
		// wait for access to the db
		while (this.canUse == 0) {
			// wait
		}
		this.canUse = 0;
	}

	// add an _id to the document
	doc._id = crypto.createHash('sha1').update(Math.random().toString() + (new Date()).valueOf().toString()).digest('hex');

	var error = null;

	// test all required_fields in any indexes and make sure this document has them all
	for (var field in this.indexes) {
		if (this.indexes[field].required_field) {
			// this is a required field
			// check that the document has this field
			if (typeof(doc[field]) == 'undefined') {
				error = 'This document is missing the field "'+field+'" that is required by an index.';
				break;
			}
		}
	}

	// test if any indexes exist for any of these fields
	var add_to_indexes = [];
	for (var field in doc) {
		if (error != null) {
			break;
		}
		if (typeof(this.indexes[field]) == 'object') {
			// an index exists for this field
			if (this.indexes[field].unique) {
				// this is a unique index, test that this value is unique
				for (var c=0; c<this.indexes[field].values.length; c++) {
					if (this.indexes[field].values[c].value == doc[field]) {
						error = 'The field "'+field+'" in this document is indexed as unique and the value already exists in the index.';
						break;
					}
				}
			}
			// add this field and value to the indexes
			add_to_indexes.push({field: field, value: doc[field]});
		}
	}

	if (error == null) {
		// add doc to docs
		this.docs.push(doc);
		if (add_to_indexes.length > 0) {
			// add this document to all of the indexed fields in add_to_indexes
			// the position is this.docs.length-1 because it was just added to this.docs
			for (var c=0; c<add_to_indexes.length; c++) {
				for (var field in this.indexes) {
					if (add_to_indexes[c].field == field) {
						// matching index
						var found_matching_value = false;
						for (var r=0; r<this.indexes[field].values.length; r++) {
							if (this.indexes[field].values[r].value == add_to_indexes[c].value) {
								// this is an existing value in the index
								this.indexes[field].values[r].positions.push(this.docs.length-1);
								found_matching_value = true;
								break;
							}
						}
						if (!found_matching_value) {
							// this is a new value in the index
							this.indexes[field].values.push({value: add_to_indexes[c].value, positions: [this.docs.length-1]});
						}
					}
				}
			}
		}
	}

	if (already_blocking === false) {
		// release the atomic hold
		this.canUse = 1;
	}

	if (error == null) {
		// return the document
		return doc;
	} else {
		return error;
	}

};

// must be a prototype child to access the this object of the module
var index_find = function(sdb_object, docs, positions, query) {

	// returns [docs, positions, query]

	// index search
	for (var key in query) {

		// convert regex operator searches to native javascript RegExp
		if (typeof(query[key]) == 'object') {
			for (var op in query[key]) {
				if (op == '$regex') {
					// this is a regex search, meaning that
					// string should equate to a regex
					// like '/asdf/i'

					// if the first character is / then the regex is a string in regex format, like /asdf/i
					// there can be a total of 5 flags after the last / in the regex, like /asdf/gimuy
					// find the position of the last / in the string
					var lastSlash = query[key][op].lastIndexOf('/');
					// now generate the regex with the flags
					var s = query[key][op].slice(1, lastSlash);
					var flags = query[key][op].slice(lastSlash+1);

					// convert it to a native javascript RegExp
					query[key] = new RegExp(s, flags);

				}
			}
		}

		var do_index_search = false;
		if (typeof(sdb_object.indexes[key]) == 'object') {
			// an index exists for this key
			do_index_search = true;
		}

		if (do_index_search) {

			/*
			if (query[key] instanceof RegExp) {
				console.log('doing a regex search through indexes');
			} else {
				console.log('doing a search through indexes');
			}
			*/

			// do an operator search
			var op_search = false;
			if (query[key] instanceof Object) {
				// this is an operator search
				op_search = true;
			}

			// check each value and look for a match
			for (var c=0; c<sdb_object.indexes[key].values.length; c++) {

				if (op_search === true) {

					// there's no operator index searches currently
					//console.log('index operator search unsupported', query[key]);
				
				} else if (sdb_object.indexes[key].values[c].value == query[key] || (query[key] instanceof RegExp && sdb_object.indexes[key].values[c].value.search(query[key]) > -1)) {
					// this is a string or regex search
					// found a matching value, add all these documents to docs
					for (var n=0; n<sdb_object.indexes[key].values[c].positions.length; n++) {
						// ensure the position isn't already added
						var existing_position = false;
						for (var l=0; l<positions.length; l++) {
							if (positions[l][0] == sdb_object.indexes[key].values[c].positions[n]) {
								// position is already found
								existing_position = true;
								// increase the relevance of the document
								docs[positions[l][1]]._relevance++;
								break;
							}
						}

						if (existing_position) {
							continue;
						}

						var t_doc = sdb_object.docs[sdb_object.indexes[key].values[c].positions[n]];
						// add the relevance, the number of matched fields
						try {
							t_doc._relevance = 1;
						} catch (err) {
							console.log(err);
							console.log('t_doc', t_doc);
							console.log('sdb_object.docs.length', sdb_object.docs.length);
							console.log('sdb_object.indexes[key].values[c]', sdb_object.indexes[key].values[c]);
							console.log('sdb_object.indexes[key].values[c].positions[n]', sdb_object.indexes[key].values[c].positions[n]);
							process.exit();
						}
						docs.push(t_doc);
						positions.push([sdb_object.indexes[key].values[c].positions[n], docs.length-1]);

					}
				}
			}

			// remove the key from query
			// there is no required deep search using this key, it was already indexed
			if (op_search === false) {
				// this conditional is required until op searches are supported for indexed fields
				// only delete this key if this was not an op search field
				delete query[key];
			}

		}
	}

	return [docs, positions, query];

}

var deep_find_in_doc = function(query, doc) {
	// returns match, relevance_mod, has_fulltext, all_query_fields_match
	var match = 0;
	var relevance_mod = 0;
	var has_fulltext = false;
	var all_query_fields_match = false;

	if (Object.keys(query).length === 0) {
		// should return as a match every time
		// there was no query
		return [1, 1, 0, 1];
	}

	var query_len = Object.keys(query).length;
	var matched_field_count = 0;

	for (var key in query) {

		if (query[key]['$undef'] !== undefined) {

			// the field does not exist in the document
			// make sure there is no $undef operator for this field
			if (doc[key] === undefined) {
				match++;
				matched_field_count++;
				//console.log('$undef match', key);
				delete query[key];
			}

		}

		for (var doc_key in doc) {

			if (doc_key == key) {

				if (doc[doc_key] == query[key] || (query[key] instanceof RegExp && doc[doc_key].search(query[key]) > -1)) {

					//console.log('field search in ' + key);

					// this is an exact string match or a regex match
					match++;;
					matched_field_count++;

				} else if (query[key] instanceof Object) {
					// test if the search key is an operator

					//console.log('operator search', query[key]);

					var op_field_match = false;
					// do an operator search
					for (var op in query[key]) {

						if (op == '$gt') {
							// test if the doc's field's value is greater than the search value
							if (Number(doc[doc_key]) > Number(query[key][op])) {
								op_field_match = true;
								match++;
							}
						} else if (op == '$gte') {
							// test if the doc's field's value is greater than or equal to the search value
							if (Number(doc[doc_key]) >= Number(query[key][op])) {
								op_field_match = true;
								match++;
							}
						} else if (op == '$lt') {
							// test if the doc's field's value is less than the search value
							if (Number(doc[doc_key]) < Number(query[key][op])) {
								op_field_match = true;
								match++;
							}
						} else if (op == '$lte') {
							// test if the doc's field's value is less than or equal to the search value
							if (Number(doc[doc_key]) <= Number(query[key][op])) {
								op_field_match = true;
								match++;
							}
						} else if (op == '$ne') {
							// test if the doc's field's value is not equal to the search value
							// works for numbers and strings
							if (doc[doc_key] != query[key][op]) {
								op_field_match = true;
								match++;
							}
						} else if (op == '$mod') {
							// test if the doc's field's value modulus the search value equals 0
							if (Number(doc[doc_key]) % Number(query[key][op]) === 0) {
								op_field_match = true;
								match++;
							}

						} else if (op == '$fulltext') {
							// perform a fulltext search and return how relevant each document is

							// first split up each of the words in the search query using the space character
							var spaced = query[key][op].split(' ');

							// remove simple words from spaced, these are of no use in a full text search
							var simple = ['i', 'you', 'the', 'this', 'is', 'of', 'a', 'we', 'us', 'it', 'them', 'they'];
							for (var r=spaced.length-1; r>=0; r--) {
								for (var n=0; n<simple.length; n++) {
									if (spaced[r].toLowerCase() == simple[n] || spaced[r].length == 1) {
										spaced.splice(r, 1);
										break;
									}
								}
							}

							// now loop through the field and test how many times each word was found
							var words = doc[doc_key].split(' ');
							for (var r=0; r<words.length; r++) {
								for (var n=0; n<spaced.length; n++) {
									if (words[r].toLowerCase() == spaced[n].toLowerCase()) {

										// increase the relevance by one divided by the total searched words found
										relevance_mod += (1/words.length);
										has_fulltext = true;

										op_field_match = true;

									}
								}
							}

						}

					}

					if (op_field_match === true) {
						matched_field_count++;
					}

				}

			}

		}

	}

	// this allows searching with {$op: {field: 1, field1: 1}}
	// or use the code above to search like {field: {$lt: 10, $gt: 1}}

	/*

	for (var key in query) {

		if (query[key] instanceof Object) {

			var op_field_match = false;
			// do an operator search
			for (var op in query[key]) {

				if (key == '$gt') {
					// test if the doc's field's value is greater than the search value
					if (Number(doc[op]) > Number(query[key][op])) {
						op_field_match = true;
						match++;
					}
				} else if (key == '$gte') {
					// test if the doc's field's value is greater than or equal to the search value
					if (Number(doc[op]) >= Number(query[key][op])) {
						op_field_match = true;
						match++;
					}
				} else if (key == '$lt') {
					// test if the doc's field's value is less than the search value
					if (Number(doc[op]) < Number(query[key][op])) {
						op_field_match = true;
						match++;
					}
				} else if (key == '$lte') {
					// test if the doc's field's value is less than or equal to the search value
					if (Number(doc[op]) <= Number(query[key][op])) {
						op_field_match = true;
						match++;
					}

				} else if (key == '$undef') {
					// test if the field is not defined
					if (doc[op] === undefined) {
						op_field_match = true;
						match++;
					}

				} else if (op == '$fulltext') {
					// perform a fulltext search and return how relevant each document is

					// first split up each of the words in the search query using the space character
					var spaced = query[key][op].split(' ');

					// remove simple words from spaced, these are of no use in a full text search
					var simple = ['i', 'you', 'the', 'this', 'is', 'of', 'a', 'we', 'us', 'it', 'them', 'they'];
					for (var r=spaced.length-1; r>=0; r--) {
						for (var n=0; n<simple.length; n++) {
							if (spaced[r].toLowerCase() == simple[n] || spaced[r].length == 1) {
								spaced.splice(r, 1);
								break;
							}
						}
					}

					// now loop through the field and test how many times each word was found
					var words = doc[key].split(' ');
					for (var r=0; r<words.length; r++) {
						for (var n=0; n<spaced.length; n++) {
							if (words[r].toLowerCase() == spaced[n].toLowerCase()) {

								// increase the relevance by one divided by the total searched words found
								relevance_mod += (1/words.length);
								has_fulltext = true;

								op_field_match = true;

							}

						}
					}

				}

			}

			if (op_field_match === true) {
				matched_field_count++;
			}

		} else {

			// exact match test
			if (doc[key] == query[key] || (query[key] instanceof RegExp && doc[key].search(query[key]) > -1)) {
				// this is an exact match or a regex match
				match++;
				matched_field_count++;
			}

		}

	}

	// end operator/field inversion
	*/

	if (matched_field_count == query_len) {
		all_query_fields_match = true;
	}

	return [match, relevance_mod, has_fulltext, all_query_fields_match];

}

sdb.prototype.find = function(query, require_all_keys=true) {
	// query is an object of what to search by
	// require_all_keys is true by default and requires all query keys to be matched

	// wait for access to the db
	while (this.canUse == 0) {
		// wait
	}
	this.canUse = 0;

	var keys_length = Object.keys(query).length;
	if (keys_length == 0) {
		// return the whole db as a deep copy
		var ret_val = JSON.parse(JSON.stringify(this.docs));
		// release the atomic hold
		this.canUse = 1;
		return ret_val;
	}

	var docs = [];
	var positions = [];

	// docs, positions, query are returned
	var index_return_array = index_find(this, docs, positions, query);
	docs = index_return_array[0];
	positions = index_return_array[1];
	query = index_return_array[2];

	// if there are any remaining keys, do a deep search using them
	// meaning search by the fields that were not indexed
	if (Object.keys(query).length > 0) {

		var has_fulltext = false;

		for (var c=0; c<this.docs.length; c++) {

			// returns match, relevance_mod, has_fulltext, all_query_fields_match
			var deep_find_doc_result = deep_find_in_doc(query, this.docs[c]);
			var match = deep_find_doc_result[0];
			var relevance_mod = deep_find_doc_result[1];
			has_fulltext = deep_find_doc_result[2];
			var all_query_fields_match = deep_find_doc_result[3];

			if ((relevance_mod > 0 || match > 0) && (require_all_keys === all_query_fields_match)) {

				// this document matches the require_all_keys argument passed to find()

				// AND

				// relevance_mod > 0 is a $fulltext search match
				// match > 0 is the number of fields matched

				// check if this document has already been found
				var existing_position = false;
				for (var l=0; l<positions.length; l++) {
					if (positions[l][0] == c) {
						// this document is already added
						existing_position = true;
						// increase the relevance of the document
						if (relevance_mod == 0) {
							// this is a non $fulltext match
							docs[positions[l][1]]._relevance++;
						} else {
							// this is a $fulltext match, the relevance is a float value
							docs[positions[l][1]]._relevance += relevance_mod;
						}
						break;
					}
				}

				if (existing_position) {
					continue;
				}

				// add the document
				var t_doc = this.docs[c];
				// add the relevance
				t_doc._relevance = relevance_mod;

				docs.push(t_doc);
				positions.push([c, docs.length-1]);

			}

		}
	}

	// the documents have to be returned as a deep copy
	// to avoid being accidently modified
	var ret_val = JSON.parse(JSON.stringify(docs));

	// release the atomic hold
	this.canUse = 1;

	return ret_val;

};

//array.sort(naturalSort)
function naturalSort(a, b) {

	var re = /(^([+\-]?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?(?=\D|\s|$))|^0x[\da-fA-F]+$|\d+)/g,
		sre = /^\s+|\s+$/g, // trim pre-post whitespace
		snre = /\s+/g, // normalize all whitespace to single ' ' character
		dre = /(^([\w ]+,?[\w ]+)?[\w ]+,?[\w ]+\d+:\d+(:\d+)?[\w ]?|^\d{1,4}[\/\-]\d{1,4}[\/\-]\d{1,4}|^\w+, \w+ \d+, \d{4})/,
		hre = /^0x[0-9a-f]+$/i,
		ore = /^0/,
		i = function(s) {
			return (naturalSort.insensitive && ('' + s).toLowerCase() || '' + s).replace(sre, '');
		},
		// convert all to strings strip whitespace
		x = i(a),
		y = i(b),
		// chunk/tokenize
		xN = x.replace(re, '\0$1\0').replace(/\0$/, '').replace(/^\0/, '').split('\0'),
		yN = y.replace(re, '\0$1\0').replace(/\0$/, '').replace(/^\0/, '').split('\0'),
		// numeric, hex or date detection
		xD = parseInt(x.match(hre), 16) || (xN.length !== 1 && Date.parse(x)),
		yD = parseInt(y.match(hre), 16) || xD && y.match(dre) && Date.parse(y) || null,
		normChunk = function(s, l) {
			// normalize spaces; find floats not starting with '0', string or 0 if not defined (Clint Priest)
			return (!s.match(ore) || l == 1) && parseFloat(s) || s.replace(snre, ' ').replace(sre, '') || 0;
		},
		oFxNcL, oFyNcL;
	// first try and sort Hex codes or Dates
	if (yD) {
		if (xD < yD) {
			return -1;
		} else if (xD > yD) {
			return 1;
		}
	}
	// natural sorting through split numeric strings and default strings
	for (var cLoc = 0, xNl = xN.length, yNl = yN.length, numS = Math.max(xNl, yNl); cLoc < numS; cLoc++) {
		oFxNcL = normChunk(xN[cLoc] || '', xNl);
		oFyNcL = normChunk(yN[cLoc] || '', yNl);
		// handle numeric vs string comparison - number < string - (Kyle Adams)
		if (isNaN(oFxNcL) !== isNaN(oFyNcL)) {
			return isNaN(oFxNcL) ? 1 : -1;
		}
		// if unicode use locale comparison
		if (/[^\x00-\x80]/.test(oFxNcL + oFyNcL) && oFxNcL.localeCompare) {
			var comp = oFxNcL.localeCompare(oFyNcL);
			return comp / Math.abs(comp);
		}
		if (oFxNcL < oFyNcL) {
			return -1;
		} else if (oFxNcL > oFyNcL) {
			return 1;
		}
	}
}

sdb.prototype.sort = function(sort, docs) {

	while (this.canUse == 0) {
		// wait
	}
	this.canUse = 0;

	var ret_docs = JSON.parse(JSON.stringify(docs));
	var ret_sorted_docs = [];
	var sorted_values = [];
	var append_docs = [];

	// sort ret_docs by a field value
	// {field: sortType}
	// highest_first - Z10-A0
	// lowest_first - A0-Z10

	for (var c=0; c<ret_docs.length; c++) {
		if (typeof(ret_docs[c][Object.keys(sort)[0]]) != 'undefined') {
			// this field has a value for this document
			// add it to the list to of ids and values to be sorted
			sorted_values.push(ret_docs[c][Object.keys(sort)[0]]);
		} else {
			// add it to the list of documents to append to ret_sorted_docs
			append_docs.push(ret_docs[c]);
		}
	}

	// sort the values
	sorted_values.sort(naturalSort);

	// reverse the values if the user specified highest_first
	if (sort[Object.keys(sort)[0]] == 'highest_first') {
		sorted_values.reverse();
	}

	// now loop through the sorted_values and find each corresponding ret_doc
	// to place it in ret_sorted_docs
	for (var c=0; c<sorted_values.length; c++) {
		for (var d=0; d<ret_docs.length; d++) {
			if (ret_docs[d][Object.keys(sort)[0]] == sorted_values[c]) {
				ret_sorted_docs.push(ret_docs[d]);
				ret_docs.splice(d, 1);
				break;
			}
		}
	}

	// append the docs in append_docs
	for (var c=0; c<append_docs.length; c++) {
		ret_sorted_docs.push(append_docs[c]);
	}

	this.canUse = 1;
	return ret_sorted_docs;

};

sdb.prototype.limit = function(len, docs) {

	while (this.canUse == 0) {
		// wait
	}
	this.canUse = 0;

	var ret_docs = JSON.parse(JSON.stringify(docs));

	// leave only the first len values in docs
	for (var c=docs.length-1; c>=0; c--) {
		if (c >= len) {
			ret_docs.splice(c, 1);
		} else {
			break;
		}
	}
	
	this.canUse = 1;
	return ret_docs;

};

sdb.prototype.skip = function(len, docs) {

	while (this.canUse == 0) {
		// wait
	}
	this.canUse = 0;

	var ret_docs = [];

	// skip the first len documents
	for (var c=0; c<docs.length; c++) {
		if (c < len) {
			// skip
			continue;
		} else {
			ret_docs.push(docs[c]);
		}
	}
	
	this.canUse = 1;
	return ret_docs;

};

var modifier_update_doc = function(update, existing_doc={}) {

	var updated_doc = {};

	// generate an array containing every field that will be updated using the modifiers
	// to copy all of the other fields in the existing document to updated_doc
	var modded_fields = [];

	// loop through each modifier
	for (var mod in update) {
		// mod will be the modifier to use and update[mod] will be an object containing fields and values to use the modifier on
		for (var field in update[mod]) {
			var field_already_modded = false;
			for (var l=0; l<modded_fields.length; l++) {
				if (modded_fields[l] == field) {
					field_already_modded = true;
					break;
				}
			}
			if (!field_already_modded) {
				modded_fields.push(field);
			}
		}
	}

	// with all the modded_fields
	// loop through the existing document and add any non-modded fields to updated_doc
	for (var afield in existing_doc) {
		var afield_exists = false;
		for (var o=0; o<modded_fields.length; o++) {
			if (modded_fields[o] == afield) {
				afield_exists = true;
				break;
			}
		}
		if (!afield_exists) {
			// actually add the non modded field to updated_doc
			updated_doc[afield] = existing_doc[afield];
		}

	}

	// go back through the modifiers and process the updates for each field
	for (var mod in update) {
		// mod will be the modifier to use and update[mod] will be an object containing fields and values to use the modifier on
		for (var field in update[mod]) {

			// apply the modifier to the value in the existing doc and copy the field to updated_doc
			switch (mod) {
				case '$set':
					updated_doc[field] = update[mod][field];
					break;
				case '$remove':
					// don't add it to the updated_doc
					break;
				case '$add':
					if (typeof(existing_doc[field]) == 'undefined') {
						updated_doc[field] = Number(update[mod][field]);
					} else {
						updated_doc[field] = Number(existing_doc[field])+Number(update[mod][field]);
					}
					break;
				case '$subtract':
					if (typeof(existing_doc[field]) == 'undefined') {
						updated_doc[field] = -Number(update[mod][field]);
					} else {
						updated_doc[field] = Number(existing_doc[field])-Number(update[mod][field]);
					}
					break;
				case '$multiply':
					if (typeof(existing_doc[field]) == 'undefined') {
						updated_doc[field] = 0;
					} else {
						updated_doc[field] = Number(existing_doc[field])*Number(update[mod][field]);
					}
					break;
				case '$divide':
					if (typeof(existing_doc[field]) == 'undefined') {
						updated_doc[field] = 0;
					} else {
						updated_doc[field] = Number(existing_doc[field])/Number(update[mod][field]);
					}
					break;
			}
		}
	}

	return updated_doc;

}

sdb.prototype.update = function(query, update, options=null) {

	if (options == null) {
		options = {};
		options.multi = false;
		options.upsert = false;
	}

	var error = null;

	// ensure that no field names exist with _ as the first character
	for (var field in update) {
		if (field[0] == '_') {
			return 'Documents cannot contain fields that start with an _, like '+field;
		}
	}

	while (this.canUse == 0) {
		// wait
	}
	this.canUse = 0;

	var keys_length = Object.keys(query).length;

	// set modifier status
	var is_modifier = 0;
	for (var key in update) {
		if (key == '$set' || key == '$remove' || key == '$add' || key == '$subtract' || key == '$multiply' || key == '$divide') {
			is_modifier = 1;
			break;
		}
	}

	var updated_docs = [];

	// search through the keys and find matching documents
	var num_updated_docs = 0;
	for (var c=0; c<this.docs.length; c++) {

		// returns match, relevance_mod, has_fulltext, all_query_fields_match
		var deep_find_doc_result = deep_find_in_doc(query, this.docs[c]);
		var match = deep_find_doc_result[0];
		var relevance_mod = deep_find_doc_result[1];
		var all_query_fields_match = deep_find_doc_result[3];

		if ((relevance_mod > 0 || match > 0) && all_query_fields_match === true) {
			// all_query_fields_match means safe to modify/delete

			// relevance_mod > 0 is a $fulltext search match
			// match > 0 is the number of matching fields

			num_updated_docs++;

			var updated_doc;

			if (is_modifier) {
				// this is a modifier update
				// it will be $set, $remove, $add, $subtract, $multiply, $divide
				updated_doc = modifier_update_doc(update, this.docs[c]);

			} else {
				// this is a whole document update
				updated_doc = update;
			}

			// save the _id
			updated_doc._id = this.docs[c]._id;

			// need to update the indexes here
			for (var field in this.indexes) {
				// first check if this index is a required_field and ensure it exists in the updated_doc
				if (this.indexes[field].required_field) {
					if (typeof(updated_doc[field]) == 'undefined') {
						error = 'The update does not include the field "'+field+'" that is required by an index.';
						break;
					}
				}

				// then check if this updated_doc actually has this field
				if (typeof(updated_doc[field]) != 'undefined') {
					// this updated_doc has this index field

					// test if the index is unique
					if (this.indexes[field].unique) {
						// this is a unique index, test if the updated_doc's field's value exists in the index
						for (var n=0; n<this.indexes[field].values.length; n++) {
							if (this.indexes[field].values[n].value == updated_doc[field] && this.indexes[field].values[n].positions[0] != c) {
								// this value for this field already exists in this unique index
								// and it is not the already existing document
								error = 'The unique index for "'+field+'" already has the value "'+updated_doc[field]+'" so the update failed.';
								break;
							}
						}
					}

				}
				if (error != null) {
					// there was an error, no need to continue going through the fields in this.indexes
					break;
				}
			}

			if (error != null) {
				// there was an error, break here to avoid updating the document
				break;
			}

			// there was no error with the proposed insertion of the indexes
			// loop through every index field and every value within
			// and remove any occurences with a position of that of the original document
			for (var field in this.indexes) {

				for (var n=this.indexes[field].values.length-1; n>=0; n--) {
					for (var p=this.indexes[field].values[n].positions.length-1; p>=0; p--) {
						if (this.indexes[field].values[n].positions[p] == c) {
							// the original (non updated) document
							// had a position here, remove it
							this.indexes[field].values[n].positions.splice(p, 1);
							//break;
						}
					}
					if (this.indexes[field].values[n].positions.length == 0) {
						// there are no positions left for this value, go ahead and remove the value
						this.indexes[field].values.splice(n, 1);
					}
				}

				// add the position of each value for this field from the document
				if (typeof(updated_doc[field]) != 'undefined') {
					// this is safe because required_field indexes has been cleaned
					// and checked on unique indexes
					var value_exists = false;
					for (var n=0; n<this.indexes[field].values.length; n++) {
						if (this.indexes[field].values[n].value == updated_doc[field]) {
							// this value already exists in the index
							value_exists = true;
							break;
						}
					}
					if (!value_exists) {
						this.indexes[field].values.push({value: updated_doc[field], positions: []});
					}
					// add it with a position of c, the original documents position
					this.indexes[field].values[n].positions.push(c);
				}
			}

			// actually update the document
			this.docs[c] = updated_doc;
			// add this document to docs
			updated_docs.push(this.docs[c]);

			num_updated_docs++;

		}

		if (!options.multi && num_updated_docs == 1) {
			// only update a single document
			break;
		}

		if (error != null) {
			break;
		}

	}

	if (is_modifier == 1 && num_updated_docs == 0 && options.upsert) {
		// this is an upsert
		// that is creating a new document not updating any documents
		// and has modifiers
		update = modifier_update_doc(update);
	}

	var ret_val = null;

	if (error == null) {
		if (num_updated_docs == 0 && options.upsert) {
			// this is an upsert and there were no documents updated, insert it with already_blocking=true
			//console.log('upsert -> insert', update);
			updated_docs.push(this.insert(update, true));
		}

		//console.log('num_updated_docs', num_updated_docs);
		//console.log('updated_docs (with inserted docs)', updated_docs);

		// as a deep copy
		ret_val = JSON.parse(JSON.stringify(updated_docs));

	} else {
		ret_val = error;
	}

	this.canUse = 1;

	return ret_val;

};

sdb.prototype.remove = function(query) {
	// query is an object of what to search by

	// wait for access to the db
	while (this.canUse == 0) {
		// wait
	}
	this.canUse = 0;

	var keys_length = Object.keys(query).length;

	var num_removed = 0;
	var removed_positions = [];

	for (var c=this.docs.length-1; c>=0; c--) {

		// returns match, relevance_mod, has_fulltext, all_query_fields_match
		var deep_find_doc_result = deep_find_in_doc(query, this.docs[c]);
		var match = deep_find_doc_result[0];
		var relevance_mod = deep_find_doc_result[1];
		var all_query_fields_match = deep_find_doc_result[3];

		if ((relevance_mod > 0 || match > 0) && all_query_fields_match === true) {
			// all_query_fields_match means safe to modify/delete

			// relevance_mod > 0 is a $fulltext search match
			// match > 0 is the number of matching fields

			num_removed++;

			// need to remove this document from all indexes with a matching position
			for (var field in this.indexes) {

				for (var n=this.indexes[field].values.length-1; n>=0; n--) {
					for (var p=this.indexes[field].values[n].positions.length-1; p>=0; p--) {
						if (this.indexes[field].values[n].positions[p] == c) {
							// the original (non updated) document
							// had a position here, remove it
							this.indexes[field].values[n].positions.splice(p, 1);
							break;
						}
					}
					if (this.indexes[field].values[n].positions.length == 0) {
						// there are no positions left for this value, go ahead and remove the value
						this.indexes[field].values.splice(n, 1);
					}
				}
			}

			// remove the document
			this.docs.splice(c, 1);

			// store the initial position of the removed document
			removed_positions.push(c);
		}
	}

	if (num_removed > 0) {
		// go back through the indexes and adjust for the new positions
		// because if a document at position 0 was removed, then every index position for all fields and values
		// will need to be decremented by 1
		//
		// if a document at position 1 was removed, then every index position that
		// is >= 1 will need to be decremented by 1
		//
		// -------------------------
		//
		// take into account the removed_positions array and that documents
		// stored in it were removed with a reverse loop
		//
		// if 2 documents were removed, one with position 4 and one with position 2
		// removed_positions would look like this: [4, 2]
		//
		// first decrement every index position that is >= 4 by 1
		// then reloop and decrement every index position that is >= 2 by 1

		for (var c=0; c<removed_positions.length; c++) {
			for (var field in this.indexes) {
				for (var r=0; r<this.indexes[field].values.length; r++) {
					for (var n=0; n<this.indexes[field].values[r].positions.length; n++) {
						if (this.indexes[field].values[r].positions[n] >= removed_positions[c]) {
							// decrement this position by 1
							this.indexes[field].values[r].positions[n]--;
						}
					}
				}
			}
		}

	}

	// release the atomic hold
	this.canUse = 1;

	return num_removed;

};

sdb.prototype.index = function(field, unique=false, required_field=false) {
	// field is the name of the field to index
	// unique is a boolean for if the field should be a unique field
	// required_field is a boolean for if the field is required for an insert and cannot be removed with $remove

	// wait for access to the db
	while (this.canUse == 0) {
		// wait
	}
	this.canUse = 0;

	// first check if the index already exists
	if (typeof(this.indexes[field]) == 'object') {
		this.canUse = 1;
		return 'this index already exists';
	}

	var values = [];
	var db_positions = [];
	var error = null;

	if (unique || required_field) {
		// loop through the documents and enforce this index
		for (var c=0; c<this.docs.length; c++) {
			if (typeof(this.docs[c][field]) != 'undefined') {
				// the to be indexed field exists in this document

				// this is a unique index
				// test if this value existins in db_positions
				for (var d=0; d<db_positions.length; d++) {
					if (db_positions[d] == c) {
						// already exists, report an error
						error = 'This is an unique index and multiple documents have the field "'+field+'" with the value "'+this.docs[c][field]+'".';
						break;
					}
				}

			} else if (required_field) {
				// this would mean that the indexed field does not exist in the document and the index
				// is requiring this field to exist
				// report an error
				error = 'This is a required field in this index and the document with _id: '+this.docs[c]._id+' does not have this field.';
			} else {
				// this document does not have this field and it is not a required field, continue forward on this loop
				// because this document is not part of this index, so on to the next document
				continue;
			}

			if (error != null) {
				break;
			}

			// add this value and it's position
			var value_found = false;
			for (var l=0; l<values.length; l++) {
				if (values[l].value == this.docs[c][field]) {
					value_found = true;
					break;
				}
			}
			if (!value_found) {
				// create the value
				values.push({value: this.docs[c][field], positions: []});
			}

			// add the position
			values[l].positions.push(c);
		}
	}

	// add all the existing _id's to the index
	if (error == null) {
		// add the index to this sdb
		this.indexes[field] = {unique: unique, required_field: required_field, values: values};
	}

	this.canUse = 1;

	if (error == null) {
		return true;
	} else {
		return error;
	}

};

sdb.prototype.remove_index = function(field) {
	// remove the index

	// wait for access to the db
	while (this.canUse == 0) {
		// wait
	}
	this.canUse = 0;

	delete this.indexes[field];

	this.canUse = 1;

};

sdb.prototype.save = function(path) {

	// write the db to path

	// wait for access to the db
	while (this.canUse == 0) {
		// wait
	}
	this.canUse = 0;

	fs.writeFileSync(path, JSON.stringify(this).toString('utf8'));

	this.canUse = 1;

};

sdb.prototype.lock = function() {
	// lock the db
	while (this.canUse == 0) {
		// wait
	}
	this.canUse = 0;
};

sdb.prototype.unlock = function() {
	// unlock the db
	this.canUse = 1;
};

module.exports = sdb;
