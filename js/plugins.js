/*!
  SerializeJSON jQuery plugin.
  https://github.com/marioizquierdo/jquery.serializeJSON
  version 2.5.0 (Mar, 2015)
  Copyright (c) 2012, 2015 Mario Izquierdo
  Dual licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
  and GPL (http://www.opensource.org/licenses/gpl-license.php) licenses.
*/
(function ($) {
  "use strict";

  // jQuery('form').serializeJSON()
  $.fn.serializeJSON = function (options) {
    var serializedObject, formAsArray, keys, type, value, _ref, f, opts;
    f = $.serializeJSON;
    opts = f.optsWithDefaults(options); // calculate values for options {parseNumbers, parseBoolens, parseNulls}
    f.validateOptions(opts);
    formAsArray = this.serializeArray(); // array of objects {name, value}
    f.readCheckboxUncheckedValues(formAsArray, this, opts); // add {name, value} of unchecked checkboxes if needed

    serializedObject = {};
    $.each(formAsArray, function (i, input) {
      keys = f.splitInputNameIntoKeysArray(input.name);
      type = keys.pop(); // the last element is always the type ("string" by default)
      if (type !== 'skip') { // easy way to skip a value
        value = f.parseValue(input.value, type, opts); // string, number, boolean or null
        if (opts.parseWithFunction && type === '_') value = opts.parseWithFunction(value, input.name); // allow for custom parsing
        f.deepSet(serializedObject, keys, value, opts);
      }
    });
    return serializedObject;
  };

  // Use $.serializeJSON as namespace for the auxiliar functions
  // and to define defaults
  $.serializeJSON = {

    defaultOptions: {
      parseNumbers: false, // convert values like "1", "-2.33" to 1, -2.33
      parseBooleans: false, // convert "true", "false" to true, false
      parseNulls: false, // convert "null" to null
      parseAll: false, // all of the above
      parseWithFunction: null, // to use custom parser, a function like: function(val){ return parsed_val; }
      checkboxUncheckedValue: undefined, // to include that value for unchecked checkboxes (instead of ignoring them)
      useIntKeysAsArrayIndex: false // name="foo[2]" value="v" => {foo: [null, null, "v"]}, instead of {foo: ["2": "v"]}
    },

    // Merge options with defaults to get {parseNumbers, parseBoolens, parseNulls, useIntKeysAsArrayIndex}
    optsWithDefaults: function(options) {
      var f, parseAll;
      if (options == null) options = {}; // arg default value = {}
      f = $.serializeJSON;
      parseAll = f.optWithDefaults('parseAll', options);
      return {
        parseNumbers:  parseAll || f.optWithDefaults('parseNumbers',  options),
        parseBooleans: parseAll || f.optWithDefaults('parseBooleans', options),
        parseNulls:    parseAll || f.optWithDefaults('parseNulls',    options),
        parseWithFunction:         f.optWithDefaults('parseWithFunction', options),
        checkboxUncheckedValue:    f.optWithDefaults('checkboxUncheckedValue', options),
        useIntKeysAsArrayIndex:    f.optWithDefaults('useIntKeysAsArrayIndex', options)
      }
    },

    optWithDefaults: function(key, options) {
      return (options[key] !== false) && (options[key] !== '') && (options[key] || $.serializeJSON.defaultOptions[key]);
    },

    validateOptions: function(opts) {
      var opt, validOpts;
      validOpts = ['parseNumbers', 'parseBooleans', 'parseNulls', 'parseAll', 'parseWithFunction', 'checkboxUncheckedValue', 'useIntKeysAsArrayIndex']
      for (opt in opts) {
        if (validOpts.indexOf(opt) === -1) {
          throw new  Error("serializeJSON ERROR: invalid option '" + opt + "'. Please use one of " + validOpts.join(','));
        }
      }
    },

    // Convert the string to a number, boolean or null, depending on the enable option and the string format.
    parseValue: function(str, type, opts) {
      var value, f;
      f = $.serializeJSON;
      if (type == 'string') return str; // force string
      if (type == 'number'  || (opts.parseNumbers  && f.isNumeric(str))) return Number(str); // number
      if (type == 'boolean' || (opts.parseBooleans && (str === "true" || str === "false"))) return (["false", "null", "undefined", "", "0"].indexOf(str) === -1); // boolean
      if (type == 'null'    || (opts.parseNulls    && str == "null")) return ["false", "null", "undefined", "", "0"].indexOf(str) !== -1 ? null : str; // null
      if (type == 'array' || type == 'object') return JSON.parse(str); // array or objects require JSON
      if (type == 'auto') return f.parseValue(str, null, {parseNumbers: true, parseBooleans: true, parseNulls: true}); // try again with something like "parseAll"
      return str; // otherwise, keep same string
    },

    isObject:          function(obj) { return obj === Object(obj); }, // is this variable an object?
    isUndefined:       function(obj) { return obj === void 0; }, // safe check for undefined values
    isValidArrayIndex: function(val) { return /^[0-9]+$/.test(String(val)); }, // 1,2,3,4 ... are valid array indexes
    isNumeric:         function(obj) { return obj - parseFloat(obj) >= 0; }, // taken from jQuery.isNumeric implementation. Not using jQuery.isNumeric to support old jQuery and Zepto versions

    // Split the input name in programatically readable keys.
    // The last element is always the type (default "_").
    // Examples:
    // "foo"              => ['foo', '_']
    // "foo:string"       => ['foo', 'string']
    // "foo:boolean"      => ['foo', 'boolean']
    // "[foo]"            => ['foo', '_']
    // "foo[inn][bar]"    => ['foo', 'inn', 'bar', '_']
    // "foo[inn[bar]]"    => ['foo', 'inn', 'bar', '_']
    // "foo[inn][arr][0]" => ['foo', 'inn', 'arr', '0', '_']
    // "arr[][val]"       => ['arr', '', 'val', '_']
    // "arr[][val]:null"  => ['arr', '', 'val', 'null']
    splitInputNameIntoKeysArray: function (name) {
      var keys, nameWithoutType, type, _ref, f;
      f = $.serializeJSON;
      _ref = f.extractTypeFromInputName(name), nameWithoutType = _ref[0], type = _ref[1];
      keys = nameWithoutType.split('['); // split string into array
      keys = $.map(keys, function (key) { return key.replace(/]/g, ''); }); // remove closing brackets
      if (keys[0] === '') { keys.shift(); } // ensure no opening bracket ("[foo][inn]" should be same as "foo[inn]")
      keys.push(type); // add type at the end
      return keys;
    },

    // Returns [name-without-type, type] from name.
    // "foo"              =>  ["foo", "_"]
    // "foo:boolean"      =>  ["foo", "boolean"]
    // "foo[bar]:null"    =>  ["foo[bar]", "null"]
    extractTypeFromInputName: function(name) {
      var match, f;
      f = $.serializeJSON;
      if (match = name.match(/(.*):([^:]+)$/)){
        var validTypes = ['string', 'number', 'boolean', 'null', 'array', 'object', 'skip', 'auto']; // validate type
        if (validTypes.indexOf(match[2]) !== -1) {
          return [match[1], match[2]];
        } else {
          throw new Error("serializeJSON ERROR: Invalid type " + match[2] + " found in input name '" + name + "', please use one of " + validTypes.join(', '))
        }
      } else {
        return [name, '_']; // no defined type, then use parse options
      }
    },

    // Set a value in an object or array, using multiple keys to set in a nested object or array:
    //
    // deepSet(obj, ['foo'], v)               // obj['foo'] = v
    // deepSet(obj, ['foo', 'inn'], v)        // obj['foo']['inn'] = v // Create the inner obj['foo'] object, if needed
    // deepSet(obj, ['foo', 'inn', '123'], v) // obj['foo']['arr']['123'] = v //
    //
    // deepSet(obj, ['0'], v)                                   // obj['0'] = v
    // deepSet(arr, ['0'], v, {useIntKeysAsArrayIndex: true})   // arr[0] = v
    // deepSet(arr, [''], v)                                    // arr.push(v)
    // deepSet(obj, ['arr', ''], v)                             // obj['arr'].push(v)
    //
    // arr = [];
    // deepSet(arr, ['', v]          // arr => [v]
    // deepSet(arr, ['', 'foo'], v)  // arr => [v, {foo: v}]
    // deepSet(arr, ['', 'bar'], v)  // arr => [v, {foo: v, bar: v}]
    // deepSet(arr, ['', 'bar'], v)  // arr => [v, {foo: v, bar: v}, {bar: v}]
    //
    deepSet: function (o, keys, value, opts) {
      var key, nextKey, tail, lastIdx, lastVal, f;
      if (opts == null) opts = {};
      f = $.serializeJSON;
      if (f.isUndefined(o)) { throw new Error("ArgumentError: param 'o' expected to be an object or array, found undefined"); }
      if (!keys || keys.length === 0) { throw new Error("ArgumentError: param 'keys' expected to be an array with least one element"); }

      key = keys[0];

      // Only one key, then it's not a deepSet, just assign the value.
      if (keys.length === 1) {
        if (key === '') {
          o.push(value); // '' is used to push values into the array (assume o is an array)
        } else {
          o[key] = value; // other keys can be used as object keys or array indexes
        }

      // With more keys is a deepSet. Apply recursively.
      } else {
        nextKey = keys[1];

        // '' is used to push values into the array,
        // with nextKey, set the value into the same object, in object[nextKey].
        // Covers the case of ['', 'foo'] and ['', 'var'] to push the object {foo, var}, and the case of nested arrays.
        if (key === '') {
          lastIdx = o.length - 1; // asume o is array
          lastVal = o[lastIdx];
          if (f.isObject(lastVal) && (f.isUndefined(lastVal[nextKey]) || keys.length > 2)) { // if nextKey is not present in the last object element, or there are more keys to deep set
            key = lastIdx; // then set the new value in the same object element
          } else {
            key = lastIdx + 1; // otherwise, point to set the next index in the array
          }
        }

        // '' is used to push values into the array "array[]"
        if (nextKey === '') {
          if (f.isUndefined(o[key]) || !$.isArray(o[key])) {
            o[key] = []; // define (or override) as array to push values
          }
        } else {
          if (opts.useIntKeysAsArrayIndex && f.isValidArrayIndex(nextKey)) { // if 1, 2, 3 ... then use an array, where nextKey is the index
            if (f.isUndefined(o[key]) || !$.isArray(o[key])) {
              o[key] = []; // define (or override) as array, to insert values using int keys as array indexes
            }
          } else { // for anything else, use an object, where nextKey is going to be the attribute name
            if (f.isUndefined(o[key]) || !f.isObject(o[key])) {
              o[key] = {}; // define (or override) as object, to set nested properties
            }
          }
        }

        // Recursively set the inner object
        tail = keys.slice(1);
        f.deepSet(o[key], tail, value, opts);
      }
    },

    // Fill the formAsArray object with values for the unchecked checkbox inputs,
    // using the same format as the jquery.serializeArray function.
    // The value of the unchecked values is determined from the opts.checkboxUncheckedValue
    // and/or the data-unchecked-value attribute of the inputs.
    readCheckboxUncheckedValues: function (formAsArray, $form, opts) {
      var selector, $uncheckedCheckboxes, $el, dataUncheckedValue, f;
      if (opts == null) opts = {};
      f = $.serializeJSON;

      selector = 'input[type=checkbox][name]:not(:checked):not([disabled])';
      $uncheckedCheckboxes = $form.find(selector).add($form.filter(selector));
      $uncheckedCheckboxes.each(function (i, el) {
        $el = $(el);
        dataUncheckedValue = $el.attr('data-unchecked-value');
        if(dataUncheckedValue) { // data-unchecked-value has precedence over option opts.checkboxUncheckedValue
          formAsArray.push({name: el.name, value: dataUncheckedValue});
        } else {
          if (!f.isUndefined(opts.checkboxUncheckedValue)) {
            formAsArray.push({name: el.name, value: opts.checkboxUncheckedValue});
          }
        }
      });
    }

  };

}(window.jQuery || window.Zepto || window.$));

/*

jQuery Populate Plugin

This plugin supports full PHP naming and deep data structures, as well as checkbox arrays, other non-standard UI controls, and even standard HTML elements such as labels or divs.
The plugin can be used as part of your AJAX toolkit, or for separating server-side code from HTML by populating a form after the page has loaded eg:

Useage: $('form').populate(property MAP of form elements) 

If a form element is of an array type with square brackets , <input type='checkbox' name='options[]> 
it is important that the key name not have the square brackets.   {options: ['music','software']} 

http://www.keyframesandcode.com/code/development/javascript/jquery-populate-plugin/
*/

jQuery.fn.populate = function(obj, options) {
	
	
	// ------------------------------------------------------------------------------------------
	// JSON conversion function
	
		// convert 
			function parseJSON(obj, path)
			{
				// prepare
					path = path || '';
				
				// iteration (objects / arrays)
					if(obj == undefined)
					{
						// do nothing
					}
					else if(obj.constructor == Object)
					{
						for(var prop in obj)
						{
							var name	= path + (path == '' ? prop : '[' +prop+ ']');
							parseJSON(obj[prop], name);
						}
					}
						
					else if(obj.constructor == Array)
					{
						for(var i = 0; i < obj.length; i++)
						{
							var index	= options.useIndices ? i : '';
							index		= options.phpNaming ? '[' +index+']' : index;
							var name	= path + index;
							parseJSON(obj[i], name);
						}
					}
					
				// assignment (values)
					else
					{
						// if the element name hasn't yet been defined, create it as a single value
						if(arr[path] == undefined)
						{
							arr[path] = obj;
						}
		
						// if the element name HAS been defined, but it's a single value, convert to an array and add the new value
						else if(arr[path].constructor != Array)
						{
							arr[path] = [arr[path], obj];
						}
							
						// if the element name HAS been defined, and is already an array, push the single value on the end of the stack
						else
						{
							arr[path].push(obj);
						}
					}
	
			};


	// ------------------------------------------------------------------------------------------
	// population functions
		
		function debug(str)
		{
			if(window.console && console.log)
			{
				console.log(str);
			}
		}
		
		function getElementName(name)
		{
			if (!options.phpNaming)
			{
				name = name.replace(/\[\]$/,'');
			}
			return name;
		}
		
		function populateElement(parentElement, name, value)
		{
			var selector	= options.identifier == 'id' ? '#' + name : '[' +options.identifier+ '="' +name+ '"]';
			var element		= jQuery(selector, parentElement);
			value			= value.toString();
			value			= value == 'null' ? '' : value;
			element.html(value);
		}
		
		function populateFormElement(form, name, value)
		{

			// check that the named element exists in the form
				var name	= getElementName(name); // handle non-php naming
				var element	= form[name];
				
			// if the form element doesn't exist, check if there is a tag with that id
				if(element == undefined)
				{
					// look for the element
						element = jQuery('#' + name, form);
						if(element)
						{
							element.html(value);
							return true;
						}
					
					// nope, so exit
						if(options.debug)
						{
							debug('No such element as ' + name);
						}
						return false;
				}
					
			// debug options				
				if(options.debug)
				{
					_populate.elements.push(element);
				}
				
			// now, place any single elements in an array.
			// this is so that the next bit of code (a loop) can treat them the 
			// same as any array-elements passed, ie radiobutton or checkox arrays,
			// and the code will just work

				elements = element.type == undefined && element.length ? element : [element];
				
				
			// populate the element correctly
			
				for(var e = 0; e < elements.length; e++)
				{
					
				// grab the element
					var element = elements[e];
					
				// skip undefined elements or function objects (IE only)
					if(!element || typeof element == 'undefined' || typeof element == 'function')
					{
						continue;
					}
					
				// anything else, process
					switch(element.type || element.tagName)
					{
	
						case 'radio':
							// use the single value to check the radio button
							element.checked = (element.value != '' && value.toString() == element.value);
							
						case 'checkbox':
							// depends on the value.
							// if it's an array, perform a sub loop
							// if it's a value, just do the check
							
							var values = value.constructor == Array ? value : [value];
							for(var j = 0; j < values.length; j++)
							{
								element.checked |= element.value == values[j];
							}
							
							//element.checked = (element.value != '' && value.toString().toLowerCase() == element.value.toLowerCase());
							break;
							
						case 'select-multiple':
							var values = value.constructor == Array ? value : [value];
							for(var i = 0; i < element.options.length; i++)
							{
								for(var j = 0; j < values.length; j++)
								{
									element.options[i].selected |= element.options[i].value == values[j];
								}
							}
							break;
						
						case 'select':
						case 'select-one':
							element.value = value.toString() || value;
							break;
	
						case 'text':
						case 'button':
						case 'textarea':
						case 'submit':
						default:
							value			= value == null ? '' : value;
							element.value	= value;
							
					}
						
				}

		}
		

		
	// ------------------------------------------------------------------------------------------
	// options & setup
		
		// exit if no data object supplied
			if (obj === undefined)
			{
				return this;
			};
		
		// options
			var options = jQuery.extend
			(
				{
					phpNaming:			true,
					phpIndices:			false,
					resetForm:			true,
					identifier:			'id',
					debug:				false
				},
				options
			);
				
			if(options.phpIndices)
			{
				options.phpNaming = true;
			}
	
	// ------------------------------------------------------------------------------------------
	// convert hierarchical JSON to flat array
		
			var arr	= [];
			parseJSON(obj);
			
			if(options.debug)
			{
				_populate =
				{
					arr:		arr,
					obj:		obj,
					elements:	[]
				}
			}
	
	// ------------------------------------------------------------------------------------------
	// main process function
		
		this.each
		(
			function()
			{
				
				// variables
					var tagName	= this.tagName.toLowerCase();
					var method	= tagName == 'form' ? populateFormElement : populateElement;
					
				// reset form?
					if(tagName == 'form' && options.resetForm)
					{
						this.reset();
					}

				// update elements
					for(var i in arr)
					{
						method(this, i, arr[i]);
					}
			}
			
		);

return this;
};