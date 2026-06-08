import { U as UNDEFINED, N as NAN, P as POSITIVE_INFINITY, a as NEGATIVE_INFINITY, b as NEGATIVE_ZERO, S as SPARSE, i as is_valid_array_len, M as MAX_ARRAY_INDEX, c as is_valid_array_index, H as HOLE, D as DevalueError, d as is_primitive, g as get_type, e as is_plain_object, f as enumerable_symbols, s as stringify_key, h as stringify_string, v as valid_array_indices, w as with_request_store, u as uneval, j as s, k as ur, l as U$1, R, T as T$1, C as C$1, q as q$1, z as z$1, A, I, O, m as i$2, n as a$1, L as L$1, $, o as j, p as f$1 } from './chunks/exports-D2Xdegq1.js';

/* Baseline 2025 runtimes */

/**	@type {(array_buffer: ArrayBuffer) => string} */
function encode_native(array_buffer) {
	return new Uint8Array(array_buffer).toBase64();
}

/**	@type {(base64: string) => ArrayBuffer} */
function decode_native(base64) {
	return Uint8Array.fromBase64(base64).buffer;
}

/* Node-compatible runtimes */

/** @type {(array_buffer: ArrayBuffer) => string} */
function encode_buffer(array_buffer) {
	return Buffer.from(array_buffer).toString('base64');
}

/**	@type {(base64: string) => ArrayBuffer} */
function decode_buffer(base64) {
	return Uint8Array.from(Buffer.from(base64, 'base64')).buffer;
}

/* Legacy runtimes */

/** @type {(array_buffer: ArrayBuffer) => string} */
function encode_legacy(array_buffer) {
	const array = new Uint8Array(array_buffer);
	let binary = '';

	// the maximum number of arguments to String.fromCharCode.apply
	// should be around 0xFFFF in modern engines
	const chunk_size = 0x8000;
	for (let i = 0; i < array.length; i += chunk_size) {
		const chunk = array.subarray(i, i + chunk_size);
		binary += String.fromCharCode.apply(null, chunk);
	}

	return btoa(binary);
}

/**	@type {(base64: string) => ArrayBuffer} */
function decode_legacy(base64) {
	const binary_string = atob(base64);
	const len = binary_string.length;
	const array = new Uint8Array(len);

	for (let i = 0; i < len; i++) {
		array[i] = binary_string.charCodeAt(i);
	}

	return array.buffer;
}

const native = typeof Uint8Array.fromBase64 === 'function';
const buffer = typeof process === 'object' && process.versions?.node !== undefined;

const encode64 = native ? encode_native : buffer ? encode_buffer : encode_legacy;
const decode64 = native ? decode_native : buffer ? decode_buffer : decode_legacy;

/**
 * Revive a value serialized with `devalue.stringify`
 * @param {string} serialized
 * @param {Record<string, (value: any) => any>} [revivers]
 */
function parse(serialized, revivers) {
	return unflatten(JSON.parse(serialized), revivers);
}

/**
 * Revive a value flattened with `devalue.stringify`
 * @param {number | any[]} parsed
 * @param {Record<string, (value: any) => any>} [revivers]
 */
function unflatten(parsed, revivers) {
	if (typeof parsed === 'number') return hydrate(parsed, true);

	if (!Array.isArray(parsed) || parsed.length === 0) {
		throw new Error('Invalid input');
	}

	const values = /** @type {any[]} */ (parsed);

	const hydrated = Array(values.length);

	/**
	 * A set of values currently being hydrated with custom revivers,
	 * used to detect invalid cyclical dependencies
	 * @type {Set<number> | null}
	 */
	let hydrating = null;

	/**
	 * @param {number} index
	 * @returns {any}
	 */
	function hydrate(index, standalone = false) {
		if (index === UNDEFINED) return undefined;
		if (index === NAN) return NaN;
		if (index === POSITIVE_INFINITY) return Infinity;
		if (index === NEGATIVE_INFINITY) return -Infinity;
		if (index === NEGATIVE_ZERO) return -0;

		if (standalone || typeof index !== 'number') {
			throw new Error(`Invalid input`);
		}

		if (index in hydrated) return hydrated[index];

		const value = values[index];

		if (!value || typeof value !== 'object') {
			hydrated[index] = value;
		} else if (Array.isArray(value)) {
			if (typeof value[0] === 'string') {
				const type = value[0];

				const reviver = revivers && Object.hasOwn(revivers, type) ? revivers[type] : undefined;

				if (reviver) {
					let i = value[1];
					if (typeof i !== 'number') {
						// if it's not a number, it was serialized by a builtin reviver
						// so we need to munge it into the format expected by a custom reviver
						i = values.push(value[1]) - 1;
					}

					hydrating ??= new Set();

					if (hydrating.has(i)) {
						throw new Error('Invalid circular reference');
					}

					hydrating.add(i);
					hydrated[index] = reviver(hydrate(i));
					hydrating.delete(i);

					return hydrated[index];
				}

				switch (type) {
					case 'Date':
						hydrated[index] = new Date(value[1]);
						break;

					case 'Set':
						const set = new Set();
						hydrated[index] = set;
						for (let i = 1; i < value.length; i += 1) {
							set.add(hydrate(value[i]));
						}
						break;

					case 'Map':
						const map = new Map();
						hydrated[index] = map;
						for (let i = 1; i < value.length; i += 2) {
							map.set(hydrate(value[i]), hydrate(value[i + 1]));
						}
						break;

					case 'RegExp':
						hydrated[index] = new RegExp(value[1], value[2]);
						break;

					case 'Object': {
						const wrapped_index = value[1];

						if (
							typeof values[wrapped_index] === 'object' &&
							values[wrapped_index][0] !== 'BigInt'
						) {
							// avoid infinite recusion in case of malformed input
							throw new Error('Invalid input');
						}

						hydrated[index] = Object(hydrate(wrapped_index));
						break;
					}

					case 'BigInt':
						hydrated[index] = BigInt(value[1]);
						break;

					case 'null':
						const obj = Object.create(null);
						hydrated[index] = obj;
						for (let i = 1; i < value.length; i += 2) {
							if (value[i] === '__proto__') {
								throw new Error('Cannot parse an object with a `__proto__` property');
							}

							obj[value[i]] = hydrate(value[i + 1]);
						}
						break;

					case 'Int8Array':
					case 'Uint8Array':
					case 'Uint8ClampedArray':
					case 'Int16Array':
					case 'Uint16Array':
					case 'Float16Array':
					case 'Int32Array':
					case 'Uint32Array':
					case 'Float32Array':
					case 'Float64Array':
					case 'BigInt64Array':
					case 'BigUint64Array':
					case 'DataView': {
						if (values[value[1]][0] !== 'ArrayBuffer') {
							// without this, if we receive malformed input we could
							// end up trying to hydrate in a circle or allocate
							// huge amounts of memory when we call `new TypedArrayConstructor(buffer)`
							throw new Error('Invalid data');
						}

						const TypedArrayConstructor = globalThis[type];
						const buffer = hydrate(value[1]);

						hydrated[index] =
							value[2] !== undefined
								? new TypedArrayConstructor(buffer, value[2], value[3])
								: new TypedArrayConstructor(buffer);

						break;
					}

					case 'ArrayBuffer': {
						const base64 = value[1];
						if (typeof base64 !== 'string') {
							throw new Error('Invalid ArrayBuffer encoding');
						}
						const arraybuffer = decode64(base64);
						hydrated[index] = arraybuffer;
						break;
					}

					case 'Temporal.Duration':
					case 'Temporal.Instant':
					case 'Temporal.PlainDate':
					case 'Temporal.PlainTime':
					case 'Temporal.PlainDateTime':
					case 'Temporal.PlainMonthDay':
					case 'Temporal.PlainYearMonth':
					case 'Temporal.ZonedDateTime': {
						const temporalName = type.slice(9);
						// @ts-expect-error TS doesn't know about Temporal yet
						hydrated[index] = Temporal[temporalName].from(value[1]);
						break;
					}

					case 'URL': {
						const url = new URL(value[1]);
						hydrated[index] = url;
						break;
					}

					case 'URLSearchParams': {
						const url = new URLSearchParams(value[1]);
						hydrated[index] = url;
						break;
					}

					default:
						throw new Error(`Unknown type ${type}`);
				}
			} else if (value[0] === SPARSE) {
				// Sparse array encoding: [SPARSE, length, idx, val, idx, val, ...]
				const len = value[1];

				if (!is_valid_array_len(len)) {
					throw new Error('Invalid input');
				}

				/** @type {any[]} */
				const array = [];
				hydrated[index] = array;

				// Setting `array.length = len` (or equivalently calling `new Array(len)`)
				// on an untrusted `len` is a DoS vector: V8 eagerly allocates a
				// contiguous backing store for array lengths below ~10^8, so a
				// small payload with a huge declared length can force arbitrary
				// memory allocation. Touching the largest-possible index first
				// forces V8 into dictionary-elements mode, where `length` is
				// just a number and no contiguous allocation occurs.
				array[MAX_ARRAY_INDEX] = undefined;
				delete array[MAX_ARRAY_INDEX];

				for (let i = 2; i < value.length; i += 2) {
					const idx = value[i];

					if (!is_valid_array_index(idx) || idx >= len) {
						throw new Error('Invalid input');
					}

					array[idx] = hydrate(value[i + 1]);
				}

				array.length = len;
			} else {
				const array = new Array(value.length);
				hydrated[index] = array;

				for (let i = 0; i < value.length; i += 1) {
					const n = value[i];
					if (n === HOLE) continue;

					array[i] = hydrate(n);
				}
			}
		} else {
			/** @type {Record<string, any>} */
			const object = {};
			hydrated[index] = object;

			for (const key of Object.keys(value)) {
				if (key === '__proto__') {
					throw new Error('Cannot parse an object with a `__proto__` property');
				}

				const n = value[key];
				object[key] = hydrate(n);
			}
		}

		return hydrated[index];
	}

	return hydrate(0);
}

/**
 * Turn a value into a JSON string that can be parsed with `devalue.parse`
 * @param {any} value
 * @param {Record<string, (value: any) => any>} [reducers]
 */
function stringify(value, reducers) {
	const stringified = run(false, value, reducers);
	return typeof stringified === 'string' ? stringified : `[${stringified.join(',')}]`;
}

/**
 * @param {boolean} async
 * @param {any} value
 * @param {Record<string, (value: any) => any>} [reducers]
 */
function run(async, value, reducers) {
	/** @type {any[]} */
	const stringified = [];

	/** @type {Map<any, number>} */
	const indexes = new Map();

	/** @type {Array<{ key: string, fn: (value: any) => any }>} */
	const custom = [];
	if (reducers) {
		for (const key of Object.getOwnPropertyNames(reducers)) {
			custom.push({ key, fn: reducers[key] });
		}
	}

	/** @type {string[]} */
	const keys = [];

	let p = 0;

	/**
	 * @param {any} thing
	 * @param {number} [index]
	 */
	function flatten(thing, index) {
		if (thing === undefined) return UNDEFINED;
		if (Number.isNaN(thing)) return NAN;
		if (thing === Infinity) return POSITIVE_INFINITY;
		if (thing === -Infinity) return NEGATIVE_INFINITY;
		if (thing === 0 && 1 / thing < 0) return NEGATIVE_ZERO;

		if (indexes.has(thing)) return /** @type {number} */ (indexes.get(thing));

		index ??= p++;
		indexes.set(thing, index);

		for (const { key, fn } of custom) {
			const value = fn(thing);
			if (value) {
				stringified[index] = `["${key}",${flatten(value)}]`;
				return index;
			}
		}

		if (typeof thing === 'function') {
			throw new DevalueError(`Cannot stringify a function`, keys, thing, value);
		} else if (typeof thing === 'symbol') {
			throw new DevalueError(`Cannot stringify a Symbol primitive`, keys, thing, value);
		}

		/** @type {string | Promise<any>} */
		let str = '';

		if (is_primitive(thing)) {
			str = stringify_primitive(thing);
		} else if (typeof thing.then === 'function') {
			{
				throw new DevalueError(
					`Cannot stringify a Promise or thenable — use stringifyAsync instead`,
					keys,
					thing,
					value
				);
			}
		} else {
			const type = get_type(thing);

			switch (type) {
				case 'Number':
				case 'String':
				case 'Boolean':
				case 'BigInt':
					str = `["Object",${flatten(thing.valueOf())}]`;
					break;

				case 'Date':
					const valid = !isNaN(thing.getDate());
					str = `["Date","${valid ? thing.toISOString() : ''}"]`;
					break;

				case 'URL':
					str = `["URL",${stringify_string(thing.toString())}]`;
					break;

				case 'URLSearchParams':
					str = `["URLSearchParams",${stringify_string(thing.toString())}]`;
					break;

				case 'RegExp':
					const { source, flags } = thing;
					str = flags
						? `["RegExp",${stringify_string(source)},"${flags}"]`
						: `["RegExp",${stringify_string(source)}]`;
					break;

				case 'Array': {
					// For dense arrays (no holes), we iterate normally.
					// When we encounter the first hole, we call Object.keys
					// to determine the sparseness, then decide between:
					//   - HOLE encoding: [-2, val, -2, ...] (default)
					//   - Sparse encoding: [-7, length, idx, val, ...] (for very sparse arrays)
					// Only the sparse path avoids iterating every slot, which
					// is what protects against the DoS of e.g. `arr[1000000] = 1`.
					let mostly_dense = false;

					str = '[';

					for (let i = 0; i < thing.length; i += 1) {
						if (i > 0) str += ',';

						if (Object.hasOwn(thing, i)) {
							keys.push(`[${i}]`);
							str += flatten(thing[i]);
							keys.pop();
						} else if (mostly_dense) {
							// Use dense encoding. The heuristic guarantees the
							// array is only mildly sparse, so iterating over every
							// slot is fine.
							str += HOLE;
						} else {
							// Decide between HOLE encoding and sparse encoding.
							//
							// HOLE encoding: each hole is serialized as the HOLE
							// sentinel (-2). For example, [, "a", ,] becomes
							// [-2, 0, -2]. Each hole costs 3 chars ("-2" + comma).
							//
							// Sparse encoding: lists only populated indices.
							// For example, [, "a", ,] becomes [-7, 3, 1, 0] — the
							// -7 sentinel, the array length (3), then index-value
							// pairs. This avoids paying per-hole, but each element
							// costs extra chars to write its index.
							//
							// The values are the same size either way, so the
							// choice comes down to structural overhead:
							//
							//   HOLE overhead:
							//     3 chars per hole ("-2" + comma)
							//     = (L - P) * 3
							//
							//   Sparse overhead:
							//     "-7,"          — 3 chars (sparse sentinel + comma)
							//     + length + "," — (d + 1) chars (array length + comma)
							//     + per element: index + "," — (d + 1) chars
							//     = (4 + d) + P * (d + 1)
							//
							// where L is the array length, P is the number of
							// populated elements, and d is the number of digits
							// in L (an upper bound on the digits in any index).
							//
							// Sparse encoding is cheaper when:
							//   (4 + d) + P * (d + 1) < (L - P) * 3
							const populated_keys = valid_array_indices(/** @type {any[]} */ (thing));
							const population = populated_keys.length;
							const d = String(thing.length).length;

							const hole_cost = (thing.length - population) * 3;
							const sparse_cost = 4 + d + population * (d + 1);

							if (hole_cost > sparse_cost) {
								str = '[' + SPARSE + ',' + thing.length;
								for (let j = 0; j < populated_keys.length; j++) {
									const key = populated_keys[j];
									keys.push(`[${key}]`);
									str += ',' + key + ',' + flatten(thing[key]);
									keys.pop();
								}
								break;
							} else {
								mostly_dense = true;
								str += HOLE;
							}
						}
					}

					str += ']';

					break;
				}

				case 'Set':
					str = '["Set"';

					for (const value of thing) {
						str += `,${flatten(value)}`;
					}

					str += ']';
					break;

				case 'Map':
					str = '["Map"';

					for (const [key, value] of thing) {
						keys.push(`.get(${is_primitive(key) ? stringify_primitive(key) : '...'})`);
						str += `,${flatten(key)},${flatten(value)}`;
						keys.pop();
					}

					str += ']';
					break;

				case 'Int8Array':
				case 'Uint8Array':
				case 'Uint8ClampedArray':
				case 'Int16Array':
				case 'Uint16Array':
				case 'Float16Array':
				case 'Int32Array':
				case 'Uint32Array':
				case 'Float32Array':
				case 'Float64Array':
				case 'BigInt64Array':
				case 'BigUint64Array':
				case 'DataView': {
					/** @type {import("./types.js").TypedArray} */
					const typedArray = thing;
					str = '["' + type + '",' + flatten(typedArray.buffer);

					// handle subarrays
					if (typedArray.byteLength !== typedArray.buffer.byteLength) {
						// to be used with `new TypedArray(buffer, byteOffset, length)`
						str += `,${typedArray.byteOffset},${typedArray.length}`;
					}

					str += ']';
					break;
				}

				case 'ArrayBuffer': {
					/** @type {ArrayBuffer} */
					const arraybuffer = thing;
					const base64 = encode64(arraybuffer);

					str = `["ArrayBuffer","${base64}"]`;
					break;
				}

				case 'Temporal.Duration':
				case 'Temporal.Instant':
				case 'Temporal.PlainDate':
				case 'Temporal.PlainTime':
				case 'Temporal.PlainDateTime':
				case 'Temporal.PlainMonthDay':
				case 'Temporal.PlainYearMonth':
				case 'Temporal.ZonedDateTime':
					str = `["${type}",${stringify_string(thing.toString())}]`;
					break;

				default:
					if (!is_plain_object(thing)) {
						throw new DevalueError(`Cannot stringify arbitrary non-POJOs`, keys, thing, value);
					}

					if (enumerable_symbols(thing).length > 0) {
						throw new DevalueError(`Cannot stringify POJOs with symbolic keys`, keys, thing, value);
					}

					if (Object.getPrototypeOf(thing) === null) {
						str = '["null"';
						for (const key of Object.keys(thing)) {
							if (key === '__proto__') {
								throw new DevalueError(
									`Cannot stringify objects with __proto__ keys`,
									keys,
									thing,
									value
								);
							}

							keys.push(stringify_key(key));
							str += `,${stringify_string(key)},${flatten(thing[key])}`;
							keys.pop();
						}
						str += ']';
					} else {
						str = '{';
						let started = false;
						for (const key of Object.keys(thing)) {
							if (key === '__proto__') {
								throw new DevalueError(
									`Cannot stringify objects with __proto__ keys`,
									keys,
									thing,
									value
								);
							}

							if (started) str += ',';
							started = true;
							keys.push(stringify_key(key));
							str += `${stringify_string(key)}:${flatten(thing[key])}`;
							keys.pop();
						}
						str += '}';
					}
			}
		}

		stringified[index] = str;
		return index;
	}

	const index = flatten(value);

	// special case — value is represented as a negative index
	if (index < 0) return `${index}`;

	return stringified;
}

/**
 * @param {any} thing
 * @returns {string}
 */
function stringify_primitive(thing) {
	const type = typeof thing;
	if (type === 'string') return stringify_string(thing);
	if (thing === void 0) return UNDEFINED.toString();
	if (thing === 0 && 1 / thing < 0) return NEGATIVE_ZERO.toString();
	if (type === 'bigint') return `["BigInt","${thing}"]`;
	return String(thing);
}

/** @import { StandardSchemaV1 } from '@standard-schema/spec' */

class HttpError {
	/**
	 * @param {number} status
	 * @param {{message: string} extends App.Error ? (App.Error | string | undefined) : App.Error} body
	 */
	constructor(status, body) {
		this.status = status;
		if (typeof body === 'string') {
			this.body = { message: body };
		} else if (body) {
			this.body = body;
		} else {
			this.body = { message: `Error: ${status}` };
		}
	}

	toString() {
		return JSON.stringify(this.body);
	}
}

class Redirect {
	/**
	 * @param {300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308} status
	 * @param {string} location
	 */
	constructor(status, location) {
		try {
			new Headers({ location });
		} catch {
			throw new Error(
				`Invalid redirect location ${JSON.stringify(location)}: ` +
					'this string contains characters that cannot be used in HTTP headers'
			);
		}

		this.status = status;
		this.location = location;
	}
}

/**
 * An error that was thrown from within the SvelteKit runtime that is not fatal and doesn't result in a 500, such as a 404.
 * `SvelteKitError` goes through `handleError`.
 * @extends Error
 */
class SvelteKitError extends Error {
	/**
	 * @param {number} status
	 * @param {string} text
	 * @param {string} message
	 */
	constructor(status, text, message) {
		super(message);
		this.status = status;
		this.text = text;
	}
}

/**
 * @template [T=undefined]
 */
class ActionFailure {
	/**
	 * @param {number} status
	 * @param {T} data
	 */
	constructor(status, data) {
		this.status = status;
		this.data = data;
	}
}

const text_encoder = new TextEncoder();

/** @import { StandardSchemaV1 } from '@standard-schema/spec' */


// TODO 3.0: remove these types as they are not used anymore (we can't remove them yet because that would be a breaking change)
/**
 * @template {number} TNumber
 * @template {any[]} [TArray=[]]
 * @typedef {TNumber extends TArray['length'] ? TArray[number] : LessThan<TNumber, [...TArray, TArray['length']]>} LessThan
 */

/**
 * @template {number} TStart
 * @template {number} TEnd
 * @typedef {Exclude<TEnd | LessThan<TEnd>, LessThan<TStart>>} NumericRange
 */

// Keep the status codes as `number` because restricting to certain numbers makes it unnecessarily hard to use compared to the benefits
// (we have runtime errors already to check for invalid codes). Also see https://github.com/sveltejs/kit/issues/11780

// we have to repeat the JSDoc because the display for function overloads is broken
// see https://github.com/microsoft/TypeScript/issues/55056

/**
 * Throws an error with a HTTP status code and an optional message.
 * When called during request handling, this will cause SvelteKit to
 * return an error response without invoking `handleError`.
 * Make sure you're not catching the thrown error, which would prevent SvelteKit from handling it.
 * @param {number} status The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses). Must be in the range 400-599.
 * @param {App.Error} body An object that conforms to the App.Error type. If a string is passed, it will be used as the message property.
 * @overload
 * @param {number} status
 * @param {App.Error} body
 * @return {never}
 * @throws {HttpError} This error instructs SvelteKit to initiate HTTP error handling.
 * @throws {Error} If the provided status is invalid (not between 400 and 599).
 */
/**
 * Throws an error with a HTTP status code and an optional message.
 * When called during request handling, this will cause SvelteKit to
 * return an error response without invoking `handleError`.
 * Make sure you're not catching the thrown error, which would prevent SvelteKit from handling it.
 * @param {number} status The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses). Must be in the range 400-599.
 * @param {{ message: string } extends App.Error ? App.Error | string | undefined : never} [body] An object that conforms to the App.Error type. If a string is passed, it will be used as the message property.
 * @overload
 * @param {number} status
 * @param {{ message: string } extends App.Error ? App.Error | string | undefined : never} [body]
 * @return {never}
 * @throws {HttpError} This error instructs SvelteKit to initiate HTTP error handling.
 * @throws {Error} If the provided status is invalid (not between 400 and 599).
 */
/**
 * Throws an error with a HTTP status code and an optional message.
 * When called during request handling, this will cause SvelteKit to
 * return an error response without invoking `handleError`.
 * Make sure you're not catching the thrown error, which would prevent SvelteKit from handling it.
 * @param {number} status The [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status#client_error_responses). Must be in the range 400-599.
 * @param {{ message: string } extends App.Error ? App.Error | string | undefined : never} body An object that conforms to the App.Error type. If a string is passed, it will be used as the message property.
 * @return {never}
 * @throws {HttpError} This error instructs SvelteKit to initiate HTTP error handling.
 * @throws {Error} If the provided status is invalid (not between 400 and 599).
 */
function error(status, body) {
	if ((isNaN(status) || status < 400 || status > 599)) {
		throw new Error(`HTTP error status codes must be between 400 and 599 — ${status} is invalid`);
	}

	throw new HttpError(status, body);
}

/**
 * Checks whether this is a redirect thrown by {@link redirect}.
 * @param {unknown} e The object to check.
 * @return {e is Redirect}
 */
function isRedirect(e) {
	return e instanceof Redirect;
}

/**
 * Create a JSON `Response` object from the supplied data.
 * @param {any} data The value that will be serialized as JSON.
 * @param {ResponseInit} [init] Options such as `status` and `headers` that will be added to the response. `Content-Type: application/json` and `Content-Length` headers will be added automatically.
 */
function json(data, init) {
	// TODO deprecate this in favour of `Response.json` when it's
	// more widely supported
	const body = JSON.stringify(data);

	// we can't just do `text(JSON.stringify(data), init)` because
	// it will set a default `content-type` header. duplicated code
	// means less duplicated work
	const headers = new Headers(init?.headers);
	if (!headers.has('content-length')) {
		headers.set('content-length', text_encoder.encode(body).byteLength.toString());
	}

	if (!headers.has('content-type')) {
		headers.set('content-type', 'application/json');
	}

	return new Response(body, {
		...init,
		headers
	});
}

/**
 * Create a `Response` object from the supplied body.
 * @param {string} body The value that will be used as-is.
 * @param {ResponseInit} [init] Options such as `status` and `headers` that will be added to the response. A `Content-Length` header will be added automatically.
 */
function text(body, init) {
	const headers = new Headers(init?.headers);
	if (!headers.has('content-length')) {
		const encoded = text_encoder.encode(body);
		headers.set('content-length', encoded.byteLength.toString());
		return new Response(encoded, {
			...init,
			headers
		});
	}

	return new Response(body, {
		...init,
		headers
	});
}

/**
 * @template {{ tracing: { enabled: boolean, root: import('@opentelemetry/api').Span, current: import('@opentelemetry/api').Span } }} T
 * @param {T} event_like
 * @param {import('@opentelemetry/api').Span} current
 * @returns {T}
 */
function merge_tracing(event_like, current) {
	return {
		...event_like,
		tracing: {
			...event_like.tracing,
			current
		}
	};
}

var defaultParseOptions = {
  decodeValues: true,
  map: false,
  silent: false,
  split: "auto", // auto = split strings but not arrays
};

function isForbiddenKey(key) {
  return typeof key !== "string" || key in {};
}

function createNullObj() {
  return Object.create(null);
}

function isNonEmptyString(str) {
  return typeof str === "string" && !!str.trim();
}

function parseString(setCookieValue, options) {
  var parts = setCookieValue.split(";").filter(isNonEmptyString);

  var nameValuePairStr = parts.shift();
  var parsed = parseNameValuePair(nameValuePairStr);
  var name = parsed.name;
  var value = parsed.value;

  options = options
    ? Object.assign({}, defaultParseOptions, options)
    : defaultParseOptions;

  if (isForbiddenKey(name)) {
    return null;
  }

  try {
    value = options.decodeValues ? decodeURIComponent(value) : value; // decode cookie value
  } catch (e) {
    console.error(
      "set-cookie-parser: failed to decode cookie value. Set options.decodeValues=false to disable decoding.",
      e
    );
  }

  var cookie = createNullObj();
  cookie.name = name;
  cookie.value = value;

  parts.forEach(function (part) {
    var sides = part.split("=");
    var key = sides.shift().trimLeft().toLowerCase();
    if (isForbiddenKey(key)) {
      return;
    }
    var value = sides.join("=");
    if (key === "expires") {
      cookie.expires = new Date(value);
    } else if (key === "max-age") {
      var n = parseInt(value, 10);
      if (!Number.isNaN(n)) cookie.maxAge = n;
    } else if (key === "secure") {
      cookie.secure = true;
    } else if (key === "httponly") {
      cookie.httpOnly = true;
    } else if (key === "samesite") {
      cookie.sameSite = value;
    } else if (key === "partitioned") {
      cookie.partitioned = true;
    } else if (key) {
      cookie[key] = value;
    }
  });

  return cookie;
}

function parseNameValuePair(nameValuePairStr) {
  // Parses name-value-pair according to rfc6265bis draft

  var name = "";
  var value = "";
  var nameValueArr = nameValuePairStr.split("=");
  if (nameValueArr.length > 1) {
    name = nameValueArr.shift();
    value = nameValueArr.join("="); // everything after the first =, joined by a "=" if there was more than one part
  } else {
    value = nameValuePairStr;
  }

  return { name: name, value: value };
}

function parseSetCookie(input, options) {
  options = options
    ? Object.assign({}, defaultParseOptions, options)
    : defaultParseOptions;

  if (!input) {
    if (!options.map) {
      return [];
    } else {
      return createNullObj();
    }
  }

  if (input.headers) {
    if (typeof input.headers.getSetCookie === "function") {
      // for fetch responses - they combine headers of the same type in the headers array,
      // but getSetCookie returns an uncombined array
      input = input.headers.getSetCookie();
    } else if (input.headers["set-cookie"]) {
      // fast-path for node.js (which automatically normalizes header names to lower-case)
      input = input.headers["set-cookie"];
    } else {
      // slow-path for other environments - see #25
      var sch =
        input.headers[
          Object.keys(input.headers).find(function (key) {
            return key.toLowerCase() === "set-cookie";
          })
        ];
      // warn if called on a request-like object with a cookie header rather than a set-cookie header - see #34, 36
      if (!sch && input.headers.cookie && !options.silent) {
        console.warn(
          "Warning: set-cookie-parser appears to have been called on a request object. It is designed to parse Set-Cookie headers from responses, not Cookie headers from requests. Set the option {silent: true} to suppress this warning."
        );
      }
      input = sch;
    }
  }

  var split = options.split;
  var isArray = Array.isArray(input);

  if (split === "auto") {
    split = !isArray;
  }

  if (!isArray) {
    input = [input];
  }

  input = input.filter(isNonEmptyString);

  if (split) {
    input = input.map(splitCookiesString).flat();
  }

  if (!options.map) {
    return input
      .map(function (str) {
        return parseString(str, options);
      })
      .filter(Boolean);
  } else {
    var cookies = createNullObj();
    return input.reduce(function (cookies, str) {
      var cookie = parseString(str, options);
      if (cookie && !isForbiddenKey(cookie.name)) {
        cookies[cookie.name] = cookie;
      }
      return cookies;
    }, cookies);
  }
}

/*
  Set-Cookie header field-values are sometimes comma joined in one string. This splits them without choking on commas
  that are within a single set-cookie field-value, such as in the Expires portion.

  This is uncommon, but explicitly allowed - see https://tools.ietf.org/html/rfc2616#section-4.2
  Node.js does this for every header *except* set-cookie - see https://github.com/nodejs/node/blob/d5e363b77ebaf1caf67cd7528224b651c86815c1/lib/_http_incoming.js#L128
  React Native's fetch does this for *every* header, including set-cookie.

  Based on: https://github.com/google/j2objc/commit/16820fdbc8f76ca0c33472810ce0cb03d20efe25
  Credits to: https://github.com/tomball for original and https://github.com/chrusart for JavaScript implementation
*/
function splitCookiesString(cookiesString) {
  if (Array.isArray(cookiesString)) {
    return cookiesString;
  }
  if (typeof cookiesString !== "string") {
    return [];
  }

  var cookiesStrings = [];
  var pos = 0;
  var start;
  var ch;
  var lastComma;
  var nextStart;
  var cookiesSeparatorFound;

  function skipWhitespace() {
    while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) {
      pos += 1;
    }
    return pos < cookiesString.length;
  }

  function notSpecialChar() {
    ch = cookiesString.charAt(pos);

    return ch !== "=" && ch !== ";" && ch !== ",";
  }

  while (pos < cookiesString.length) {
    start = pos;
    cookiesSeparatorFound = false;

    while (skipWhitespace()) {
      ch = cookiesString.charAt(pos);
      if (ch === ",") {
        // ',' is a cookie separator if we have later first '=', not ';' or ','
        lastComma = pos;
        pos += 1;

        skipWhitespace();
        nextStart = pos;

        while (pos < cookiesString.length && notSpecialChar()) {
          pos += 1;
        }

        // currently special character
        if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
          // we found cookies separator
          cookiesSeparatorFound = true;
          // pos is inside the next cookie, so back up and return it.
          pos = nextStart;
          cookiesStrings.push(cookiesString.substring(start, lastComma));
          start = pos;
        } else {
          // in param ',' or param separator ';',
          // we continue from that comma
          pos = lastComma + 1;
        }
      } else {
        pos += 1;
      }
    }

    if (!cookiesSeparatorFound || pos >= cookiesString.length) {
      cookiesStrings.push(cookiesString.substring(start, cookiesString.length));
    }
  }

  return cookiesStrings;
}

// named export for CJS
parseSetCookie.parseSetCookie = parseSetCookie;
// for backwards compatibility
parseSetCookie.parse = parseSetCookie;
parseSetCookie.parseString = parseString;
parseSetCookie.splitCookiesString = splitCookiesString;

function Le(){}function Me$1(e){let t=false,r;return ()=>t?r:(t=true,r=e())}const Re=false;const qe="x-sveltekit-invalidated",Ne="x-sveltekit-trailing-slash";function Be$1(e,t){const r=Object.fromEntries(Object.entries(t).map(([n,s])=>[n,s.encode]));return stringify(e,r)}Object.getOwnPropertyNames(Object.prototype).sort().join("\0");const z="__skrao",q="__skram",N$1="__skras";function fe$1(e){const t={[z]:i=>i,[q]:i=>{if(!Array.isArray(i))throw new Error("Invalid data for Map reviver");const c=new Map;for(const o of i){if(!Array.isArray(o)||o.length!==2||typeof o[0]!="string"||typeof o[1]!="string")throw new Error("Invalid data for Map reviver");const[u,d]=o;c.set(s(u),s(d));}return c},[N$1]:i=>{if(!Array.isArray(i))throw new Error("Invalid data for Set reviver");const c=new Set;for(const o of i){if(typeof o!="string")throw new Error("Invalid data for Set reviver");c.add(s(o));}return c}},n={...Object.fromEntries(Object.entries(e).map(([i,c])=>[i,c.decode])),...t},s=i=>parse(i,n);return n}function Ce$1(e,t){if(!e)return;const r=new TextDecoder().decode(s(e.replaceAll("-","+").replaceAll("_","/")));return parse(r,fe$1(t))}function Fe$1(e,t){return e+"/"+t}function Ue$1(e){const t=e.lastIndexOf("/");if(t===-1)throw new Error(`Invalid remote key: ${e}`);return {id:e.slice(0,t),payload:e.slice(t+1)}}const Ve="/_svelte_kit_assets",ue=["GET","POST","PUT","PATCH","DELETE","OPTIONS","HEAD"],Ye$1=["GET","POST","HEAD"],x=new TextDecoder;function le(e,t,r){t.startsWith("n:")?(t=t.slice(2),r=r===""?void 0:parseFloat(r)):t.startsWith("b:")&&(t=t.slice(2),r=r==="on"),pe(e,me$1(t),r);}function de(e){const t={};for(let r of e.keys()){const n=r.endsWith("[]");let s=e.getAll(r);if(n&&(r=r.slice(0,-2)),s.length>1&&!n)throw new Error(`Form cannot contain duplicated keys — "${r}" has ${s.length} values`);s=s.filter(i=>typeof i=="string"||i.name!==""||i.size>0),r.startsWith("n:")?(r=r.slice(2),s=s.map(i=>i===""?void 0:parseFloat(i))):r.startsWith("b:")&&(r=r.slice(2),s=s.map(i=>i==="on")),le(t,r,n?s:s[0]);}return t}const H="application/x-sveltekit-formdata",L=0,v$1=7;async function Je$1(e){if(e.headers.get("content-type")!==H){const a=await e.formData();return {data:de(a),meta:{},form_data:a}}if(!e.body)throw b("no body");const t=e.body.getReader(),r=[];function n(a){if(a in r)return r[a];let l=r.length;for(;l<=a;)r[l]=t.read().then(m=>m.value),l++;return r[a]}async function s(a,l){let m,p=0,w;for(w=0;;w++){const y=await n(w);if(!y)return null;const I=p+y.byteLength;if(a>=p&&a<I){m=y;break}p=I;}if(a+l<=p+m.byteLength)return m.subarray(a-p,a+l-p);const E=[m.subarray(a-p)];let O=m.byteLength-a+p;for(;O<l;){w++;let y=await n(w);if(!y)return null;y.byteLength>l-O&&(y=y.subarray(0,l-O)),E.push(y),O+=y.byteLength;}const S=new Uint8Array(l);O=0;for(const y of E)S.set(y,O),O+=y.byteLength;return S}const i=await s(0,v$1);if(!i)throw b("too short");if(i[0]!==L)throw b(`got version ${i[0]}, expected version ${L}`);const c=new DataView(i.buffer,i.byteOffset,i.byteLength),o=c.getUint32(1,true),u=c.getUint16(5,true),d=await s(v$1,o);if(!d)throw b("data too short");let f,h;if(u>0){const a=await s(v$1+o,u);if(!a)throw b("file offset table too short");const l=JSON.parse(x.decode(a));if(!Array.isArray(l)||l.some(m=>typeof m!="number"||!Number.isInteger(m)||m<0))throw b("invalid file offset table");f=l,h=v$1+o+u;}const _=[],[P,g]=parse(x.decode(d),{File:([a,l,m,p,w])=>{if(typeof a!="string"||typeof l!="string"||typeof m!="number"||typeof p!="number"||typeof w!="number")throw b("invalid file metadata");let E=f[w];if(E===void 0)throw b("duplicate file offset table index");return f[w]=void 0,E+=h,_.push({offset:E,size:m}),new Proxy(new T(a,l,m,p,n,E),{getPrototypeOf(){return File.prototype}})}});_.sort((a,l)=>a.offset-l.offset||a.size-l.size);for(let a=1;a<_.length;a++){const l=_[a-1],m=_[a],p=l.offset+l.size;if(p<m.offset)throw b("gaps in file data");if(p>m.offset)throw b("overlapping file data")}return (async()=>{let a=true;for(;a;)a=!!await n(r.length);})(),{data:P,meta:g,form_data:null}}function b(e){return new SvelteKitError(400,"Bad Request",`Could not deserialize binary form: ${e}`)}class T{#t;#e;constructor(t,r,n,s,i,c){this.name=t,this.type=r,this.size=n,this.lastModified=s,this.webkitRelativePath="",this.#t=i,this.#e=c,this.arrayBuffer=this.arrayBuffer.bind(this),this.bytes=this.bytes.bind(this),this.slice=this.slice.bind(this),this.stream=this.stream.bind(this),this.text=this.text.bind(this);}#r;async arrayBuffer(){return this.#r??=await new Response(this.stream()).arrayBuffer(),this.#r}async bytes(){return new Uint8Array(await this.arrayBuffer())}slice(t=0,r=this.size,n=this.type){t<0?t=Math.max(this.size+t,0):t=Math.min(t,this.size),r<0?r=Math.max(this.size+r,0):r=Math.min(r,this.size);const s=Math.max(r-t,0);return new T(this.name,n,s,this.lastModified,this.#t,this.#e+t)}stream(){let t=0,r=0;return new ReadableStream({start:async n=>{let s=0,i;for(r=0;;r++){const c=await this.#t(r);if(!c)return null;const o=s+c.byteLength;if(this.#e>=s&&this.#e<o){i=c;break}s=o;}this.#e+this.size<=s+i.byteLength?(n.enqueue(i.subarray(this.#e-s,this.#e+this.size-s)),n.close()):(n.enqueue(i.subarray(this.#e-s)),t=i.byteLength-this.#e+s);},pull:async n=>{r++;let s=await this.#t(r);if(!s){n.error("incomplete file data"),n.close();return}s.byteLength>this.size-t&&(s=s.subarray(0,this.size-t)),n.enqueue(s),t+=s.byteLength,t>=this.size&&n.close();}})}async text(){return x.decode(await this.arrayBuffer())}}const he=/^[a-zA-Z_$]\w*(\.[a-zA-Z_$]\w*|\[\d+\])*$/;function me$1(e){if(!he.test(e))throw new Error(`Invalid path ${e}`);return e.split(/\.|\[|\]/).filter(Boolean)}function M(e){if(e==="__proto__"||e==="constructor"||e==="prototype")throw new Error(`Invalid key "${e}"`)}function pe(e,t,r){let n=e;for(let i=0;i<t.length-1;i+=1){const c=t[i];M(c);const o=/^\d+$/.test(t[i+1]),u=Object.hasOwn(n,c)?n[c]:void 0,d=u!=null;if(d&&o!==Array.isArray(u))throw new Error(`Invalid array key ${t[i+1]}`);d||(n[c]=o?[]:{}),n=n[c];}const s=t[t.length-1];M(s),n[s]=r;}function ge(e){return e instanceof Error||e&&e.name&&e.message?e:new Error(JSON.stringify(e))}function Qe$1(e){return e}function C(e){return e instanceof HttpError||e instanceof SvelteKitError?e.status:500}function we(e){return e instanceof SvelteKitError?e.text:"Internal Error"}function ke(e,t){const r=[];e.split(",").forEach((i,c)=>{const o=/([^/ \t]+)\/([^; \t]+)[ \t]*(?:;[ \t]*q=([0-9.]+))?/.exec(i);if(o){const[,u,d,f="1"]=o;r.push({type:u,subtype:d,q:+f,i:c});}}),r.sort((i,c)=>i.q!==c.q?c.q-i.q:i.subtype==="*"!=(c.subtype==="*")?i.subtype==="*"?1:-1:i.type==="*"!=(c.type==="*")?i.type==="*"?1:-1:i.i-c.i);let n,s=1/0;for(const i of t){const[c,o]=i.split("/"),u=r.findIndex(d=>(d.type===c||d.type==="*")&&(d.subtype===o||d.subtype==="*"));u!==-1&&u<s&&(n=i,s=u);}return n}function Xe$1(e){if(typeof e.getSetCookie=="function")return e.getSetCookie();const t=e.get("set-cookie");return t?splitCookiesString(t):[]}function Ee(e,...t){const r=e.headers.get("content-type")?.split(";",1)[0].trim()??"";return t.includes(r.toLowerCase())}function et(e){return Ee(e,"application/x-www-form-urlencoded","multipart/form-data","text/plain",H)}const F={"&":"&amp;",'"':"&quot;"},U={"&":"&amp;","<":"&lt;"},G="[\\ud800-\\udbff](?![\\udc00-\\udfff])|[\\ud800-\\udbff][\\udc00-\\udfff]|[\\udc00-\\udfff]",Oe$1=new RegExp(`[${Object.keys(F).join("")}]|`+G,"g"),je$1=new RegExp(`[${Object.keys(U).join("")}]|`+G,"g");function ve(e,t){const r=t?F:U;return e.replace(t?Oe$1:je$1,s=>s.length===2?s:r[s]??`&#${s.charCodeAt(0)};`)}function tt(e,t){return text(`${t} method not allowed`,{status:405,headers:{allow:xe(e).join(", ")}})}function xe(e){const t=ue.filter(r=>r in e);return "GET"in e&&!("HEAD"in e)&&t.push("HEAD"),t}function rt(e){return `__sveltekit_${e.version_hash}`}function Ae(e,t,r){let n=e.templates.error({status:t,message:ve(r)});return text(n,{headers:{"content-type":"text/html; charset=utf-8"},status:t})}async function nt(e,t,r,n){n=n instanceof HttpError?n:ge(n);const s=C(n),i=await $e(e,t,r,n),c=ke(e.request.headers.get("accept")||"text/html",["application/json","text/html"]);return e.isDataRequest||c==="application/json"?json(i,{status:s}):Ae(r,s,i.message)}async function $e(e,t,r,n){if(n instanceof HttpError)return {message:"Unknown Error",...n.body};const s=C(n),i=we(n);return await with_request_store({event:e,state:t},()=>r.hooks.handleError({error:n,event:e,status:s,message:i}))??{message:i}}function st(e,t){return new Response(void 0,{status:e,headers:{location:t}})}function it(e,t){return t.path?`Data returned from \`load\` while rendering ${e.route.id} is not serializable: ${t.message} (${t.path}). If you need to serialize/deserialize custom types, use transport hooks: https://svelte.dev/docs/kit/hooks#Universal-hooks-transport.`:t.path===""?`Data returned from \`load\` while rendering ${e.route.id} is not a plain object`:t.message}function ot(e){const t={};return e.uses&&e.uses.dependencies.size>0&&(t.dependencies=Array.from(e.uses.dependencies)),e.uses&&e.uses.search_params.size>0&&(t.search_params=Array.from(e.uses.search_params)),e.uses&&e.uses.params.size>0&&(t.params=Array.from(e.uses.params)),e.uses?.parent&&(t.parent=1),e.uses?.route&&(t.route=1),e.uses?.url&&(t.url=1),t}function at(e,t){return e._.prerendered_routes.has(t)||t.at(-1)==="/"&&e._.prerendered_routes.has(t.slice(0,-1))}function ct(e,t,r){const n=`
\x1B[1;31m[${e}] ${r.request.method} ${r.url.pathname}\x1B[0m`;return e===404?n:`${n}
${t.stack}`}function ft$1(e){const r=e?.split("/")?.at(-1);return r?r.split(".").slice(0,-1).join("."):"unknown"}function ut$1(e){const t=r=>{for(const n in e){const s=e[n].encode(r);if(s)return `app.decode('${n}', ${uneval(s,t)})`}};return t}

let e="",t=e;const i$1="_app",r=true,a={base:e,assets:t};function o$1(s){e=s.base,t=s.assets;}function c(){e=a.base,t=a.assets;}

let i={};function p(t){}function f(t){i=t;}let o=null;function h(t){o=t;}const _={app_template_contains_nonce:false,async:false,csp:{mode:"auto",directives:{"upgrade-insecure-requests":false,"block-all-mixed-content":false},reportOnly:{"upgrade-insecure-requests":false,"block-all-mixed-content":false}},csrf_check_origin:true,csrf_trusted_origins:[],embedded:false,env_public_prefix:"PUBLIC_",env_private_prefix:"",hash_routing:false,hooks:null,preload_strategy:"modulepreload",root:ur,service_worker:false,service_worker_options:void 0,server_error_boundaries:false,templates:{app:({head:t,body:e,assets:n,nonce:r,env:a})=>'<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>Luxel</title>'+t+"</head><body><main>"+e+"</main></body></html>",error:({status:t,message:e})=>`<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<title>`+e+`</title>

		<style>
			body {
				--bg: white;
				--fg: #222;
				--divider: #ccc;
				background: var(--bg);
				color: var(--fg);
				font-family:
					system-ui,
					-apple-system,
					BlinkMacSystemFont,
					'Segoe UI',
					Roboto,
					Oxygen,
					Ubuntu,
					Cantarell,
					'Open Sans',
					'Helvetica Neue',
					sans-serif;
				display: flex;
				align-items: center;
				justify-content: center;
				height: 100vh;
				margin: 0;
			}

			.error {
				display: flex;
				align-items: center;
				max-width: 32rem;
				margin: 0 1rem;
			}

			.status {
				font-weight: 200;
				font-size: 3rem;
				line-height: 1;
				position: relative;
				top: -0.05rem;
			}

			.message {
				border-left: 1px solid var(--divider);
				padding: 0 0 0 1rem;
				margin: 0 0 0 1rem;
				min-height: 2.5rem;
				display: flex;
				align-items: center;
			}

			.message h1 {
				font-weight: 400;
				font-size: 1em;
				margin: 0;
			}

			@media (prefers-color-scheme: dark) {
				body {
					--bg: #222;
					--fg: #ddd;
					--divider: #666;
				}
			}
		</style>
	</head>
	<body>
		<div class="error">
			<span class="status">`+t+`</span>
			<div class="message">
				<h1>`+e+`</h1>
			</div>
		</div>
	</body>
</html>
`},version_hash:"1d3byus"};async function v(){let t,e,n,r,a;return {handle:t,handleFetch:e,handleError:n,handleValidationError:r,init:a}=await import('./chunks/hooks.server-B551XSUD.js'),{handle:t,handleFetch:e,handleError:n,handleValidationError:r,init:a,reroute:void 0,transport:void 0}}

var cookie = {};

/*!
 * cookie
 * Copyright(c) 2012-2014 Roman Shtylman
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

var hasRequiredCookie;

function requireCookie () {
	if (hasRequiredCookie) return cookie;
	hasRequiredCookie = 1;

	/**
	 * Module exports.
	 * @public
	 */

	cookie.parse = parse;
	cookie.serialize = serialize;

	/**
	 * Module variables.
	 * @private
	 */

	var __toString = Object.prototype.toString;

	/**
	 * RegExp to match field-content in RFC 7230 sec 3.2
	 *
	 * field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]
	 * field-vchar   = VCHAR / obs-text
	 * obs-text      = %x80-FF
	 */

	var fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;

	/**
	 * Parse a cookie header.
	 *
	 * Parse the given cookie header string into an object
	 * The object has the various cookies as keys(names) => values
	 *
	 * @param {string} str
	 * @param {object} [options]
	 * @return {object}
	 * @public
	 */

	function parse(str, options) {
	  if (typeof str !== 'string') {
	    throw new TypeError('argument str must be a string');
	  }

	  var obj = {};
	  var opt = options || {};
	  var dec = opt.decode || decode;

	  var index = 0;
	  while (index < str.length) {
	    var eqIdx = str.indexOf('=', index);

	    // no more cookie pairs
	    if (eqIdx === -1) {
	      break
	    }

	    var endIdx = str.indexOf(';', index);

	    if (endIdx === -1) {
	      endIdx = str.length;
	    } else if (endIdx < eqIdx) {
	      // backtrack on prior semicolon
	      index = str.lastIndexOf(';', eqIdx - 1) + 1;
	      continue
	    }

	    var key = str.slice(index, eqIdx).trim();

	    // only assign once
	    if (undefined === obj[key]) {
	      var val = str.slice(eqIdx + 1, endIdx).trim();

	      // quoted values
	      if (val.charCodeAt(0) === 0x22) {
	        val = val.slice(1, -1);
	      }

	      obj[key] = tryDecode(val, dec);
	    }

	    index = endIdx + 1;
	  }

	  return obj;
	}

	/**
	 * Serialize data into a cookie header.
	 *
	 * Serialize the a name value pair into a cookie string suitable for
	 * http headers. An optional options object specified cookie parameters.
	 *
	 * serialize('foo', 'bar', { httpOnly: true })
	 *   => "foo=bar; httpOnly"
	 *
	 * @param {string} name
	 * @param {string} val
	 * @param {object} [options]
	 * @return {string}
	 * @public
	 */

	function serialize(name, val, options) {
	  var opt = options || {};
	  var enc = opt.encode || encode;

	  if (typeof enc !== 'function') {
	    throw new TypeError('option encode is invalid');
	  }

	  if (!fieldContentRegExp.test(name)) {
	    throw new TypeError('argument name is invalid');
	  }

	  var value = enc(val);

	  if (value && !fieldContentRegExp.test(value)) {
	    throw new TypeError('argument val is invalid');
	  }

	  var str = name + '=' + value;

	  if (null != opt.maxAge) {
	    var maxAge = opt.maxAge - 0;

	    if (isNaN(maxAge) || !isFinite(maxAge)) {
	      throw new TypeError('option maxAge is invalid')
	    }

	    str += '; Max-Age=' + Math.floor(maxAge);
	  }

	  if (opt.domain) {
	    if (!fieldContentRegExp.test(opt.domain)) {
	      throw new TypeError('option domain is invalid');
	    }

	    str += '; Domain=' + opt.domain;
	  }

	  if (opt.path) {
	    if (!fieldContentRegExp.test(opt.path)) {
	      throw new TypeError('option path is invalid');
	    }

	    str += '; Path=' + opt.path;
	  }

	  if (opt.expires) {
	    var expires = opt.expires;

	    if (!isDate(expires) || isNaN(expires.valueOf())) {
	      throw new TypeError('option expires is invalid');
	    }

	    str += '; Expires=' + expires.toUTCString();
	  }

	  if (opt.httpOnly) {
	    str += '; HttpOnly';
	  }

	  if (opt.secure) {
	    str += '; Secure';
	  }

	  if (opt.partitioned) {
	    str += '; Partitioned';
	  }

	  if (opt.priority) {
	    var priority = typeof opt.priority === 'string'
	      ? opt.priority.toLowerCase()
	      : opt.priority;

	    switch (priority) {
	      case 'low':
	        str += '; Priority=Low';
	        break
	      case 'medium':
	        str += '; Priority=Medium';
	        break
	      case 'high':
	        str += '; Priority=High';
	        break
	      default:
	        throw new TypeError('option priority is invalid')
	    }
	  }

	  if (opt.sameSite) {
	    var sameSite = typeof opt.sameSite === 'string'
	      ? opt.sameSite.toLowerCase() : opt.sameSite;

	    switch (sameSite) {
	      case true:
	        str += '; SameSite=Strict';
	        break;
	      case 'lax':
	        str += '; SameSite=Lax';
	        break;
	      case 'strict':
	        str += '; SameSite=Strict';
	        break;
	      case 'none':
	        str += '; SameSite=None';
	        break;
	      default:
	        throw new TypeError('option sameSite is invalid');
	    }
	  }

	  return str;
	}

	/**
	 * URL-decode string value. Optimized to skip native call when no %.
	 *
	 * @param {string} str
	 * @returns {string}
	 */

	function decode (str) {
	  return str.indexOf('%') !== -1
	    ? decodeURIComponent(str)
	    : str
	}

	/**
	 * URL-encode value.
	 *
	 * @param {string} val
	 * @returns {string}
	 */

	function encode (val) {
	  return encodeURIComponent(val)
	}

	/**
	 * Determine if value is a Date.
	 *
	 * @param {*} val
	 * @private
	 */

	function isDate (val) {
	  return __toString.call(val) === '[object Date]' ||
	    val instanceof Date
	}

	/**
	 * Try decoding a string using a decoding function.
	 *
	 * @param {string} str
	 * @param {function} decode
	 * @private
	 */

	function tryDecode(str, decode) {
	  try {
	    return decode(str);
	  } catch (e) {
	    return str;
	  }
	}
	return cookie;
}

var cookieExports = requireCookie();

const N=JSON.stringify;function xr(e,t,r){const s={},n=e.slice(1),a=n.filter(i=>i!==void 0);let o=0;for(let i=0;i<t.length;i+=1){const c=t[i];let f=n[i-o];if(c.chained&&c.rest&&o&&(f=n.slice(i-o,i+1).filter(u=>u).join("/"),o=0),f===void 0)if(c.rest)f="";else continue;if(!c.matcher||r[c.matcher](f)){s[c.name]=f;const u=t[i+1],_=n[i+1];u&&!u.rest&&u.optional&&_&&c.chained&&(o=0),!u&&!_&&Object.keys(s).length===a.length&&(o=0);continue}if(c.optional&&c.chained){o++;continue}return}if(!o)return s}function Ut(e,t,r){for(const s of t){const n=s.pattern.exec(e);if(!n)continue;const a=xr(n,s.params,r);if(a)return {route:s,params:C$1(a)}}return null}function Ct(...e){let t=5381;for(const r of e)if(typeof r=="string"){let s=r.length;for(;s;)t=t*33^r.charCodeAt(--s);}else if(ArrayBuffer.isView(r)){const s=new Uint8Array(r.buffer,r.byteOffset,r.byteLength);let n=s.length;for(;n;)t=t*33^s[--n];}else throw new TypeError("value must be a string or TypedArray");return (t>>>0).toString(36)}function je(e){return e.filter(t=>t!=null)}const Je="/__data.json",Te=".html__data.json";function Er(e){return e.endsWith(Je)||e.endsWith(Te)}function Be(e){return e.endsWith(".html")?e.replace(/\.html$/,Te):e.replace(/\/$/,"")+Je}function Rr(e){return e.endsWith(Te)?e.slice(0,-Te.length)+".html":e.slice(0,-Je.length)}const Xe="/__route.js";function Sr(e){return e.endsWith(Xe)}function Nt(e){return e.replace(/\/$/,"")+Xe}function jr(e){return e.slice(0,-Xe.length)}const Tr={spanContext(){return qr},setAttribute(){return this},setAttributes(){return this},addEvent(){return this},setStatus(){return this},updateName(){return this},end(){return this},isRecording(){return  false},recordException(){return this},addLink(){return this},addLinks(){return this}},qr={traceId:"",spanId:"",traceFlags:0};function Ht(){let e,t;return {promise:new Promise((s,n)=>{e=s,t=n;}),resolve:e,reject:t}}const Ar=[101,103,204,205,304],Or=!!globalThis.process?.versions?.webcontainer;async function Pr(e,t,r,s){const n=e.request.method;let a=r[n]||r.fallback;if(n==="HEAD"&&!r.HEAD&&r.GET&&(a=r.GET),!a)return tt(r,n);const o=r.prerender??s.prerender_default;if(o&&(r.POST||r.PATCH||r.PUT||r.DELETE))throw new Error("Cannot prerender endpoints that have mutative methods");if(s.prerendering&&!s.prerendering.inside_reroute&&!o){if(s.depth>0)throw new Error(`${e.route.id} is not prerenderable`);return new Response(void 0,{status:204})}try{const i=await with_request_store({event:e,state:t},()=>a(e));if(!(i instanceof Response))throw new Error(`Invalid response from route ${e.url.pathname}: handler should return a Response object`);if(s.prerendering&&(!s.prerendering.inside_reroute||o)){const c=new Response(i.clone().body,{status:i.status,statusText:i.statusText,headers:new Headers(i.headers)});if(c.headers.set("x-sveltekit-prerender",String(o)),s.prerendering.inside_reroute&&o)c.headers.set("x-sveltekit-routeid",encodeURI(e.route.id)),s.prerendering.dependencies.set(e.url.pathname,{response:c,body:null});else return c}return i}catch(i){if(i instanceof Redirect)return new Response(void 0,{status:i.status,headers:{location:i.location}});throw i}}function zr(e){const{method:t,headers:r}=e.request;if(ue.includes(t)&&!Ye$1.includes(t))return  true;if(t==="POST"&&r.get("x-sveltekit-action")==="true")return  false;const s=e.request.headers.get("accept")??"*/*";return ke(s,["*","text/html"])!=="text/html"}async function Q({name:e,attributes:t,fn:r}){return r(Tr)}function Lt(e){return ke(e.request.headers.get("accept")??"*/*",["application/json","text/html"])==="application/json"&&e.request.method==="POST"}async function Ur(e,t,r,s){const n=s?.actions;if(!n){const a=new SvelteKitError(405,"Method Not Allowed","POST method not allowed. No form actions exist for this page");return fe({type:"error",error:await $e(e,t,r,a)},{status:a.status,headers:{allow:"GET"}})}Mt(n);try{const a=await Wt(e,t,n);return a instanceof ActionFailure?fe({type:"failure",status:a.status,data:ut(a.data,e.route.id,r.hooks.transport)}):fe({type:"success",status:a?200:204,data:ut(a,e.route.id,r.hooks.transport)})}catch(a){const o=Qe$1(a);return o instanceof Redirect?It(o):fe({type:"error",error:await $e(e,t,r,Ke(o))},{status:C(o)})}}function Ke(e){return e instanceof ActionFailure?new Error('Cannot "throw fail()". Use "return fail()"'):e}function It(e){return fe({type:"redirect",status:e.status,location:e.location})}function fe(e,t){return json(e,t)}function Cr(e){return e.request.method==="POST"}async function Nr(e,t,r){const s=r?.actions;if(!s)return e.setHeaders({allow:"GET"}),{type:"error",error:new SvelteKitError(405,"Method Not Allowed","POST method not allowed. No form actions exist for this page")};Mt(s);try{const n=await Wt(e,t,s);return n instanceof ActionFailure?{type:"failure",status:n.status,data:n.data}:{type:"success",status:200,data:n}}catch(n){const a=Qe$1(n);return a instanceof Redirect?{type:"redirect",status:a.status,location:a.location}:{type:"error",error:Ke(a)}}}function Mt(e){if(e.default&&Object.keys(e).length>1)throw new Error("When using named actions, the default action cannot be used. See the docs for more info: https://svelte.dev/docs/kit/form-actions#named-actions")}async function Wt(e,t,r){const s=new URL(e.request.url);let n="default";for(const o of s.searchParams)if(o[0].startsWith("/")){if(n=o[0].slice(1),n==="default")throw new Error('Cannot use reserved action name "default"');break}const a=r[n];if(!a)throw new SvelteKitError(404,"Not Found",`No action with name '${n}' found`);if(!et(e.request))throw new SvelteKitError(415,"Unsupported Media Type",`Form actions expect form-encoded data — received ${e.request.headers.get("content-type")}`);return Q({name:"sveltekit.form_action",attributes:{"http.route":e.route.id||"unknown"},fn:async o=>{const i=merge_tracing(e,o),c=await with_request_store({event:i,state:t},()=>a(i));return c instanceof ActionFailure&&o.setAttributes({"sveltekit.form_action.result.type":"failure","sveltekit.form_action.result.status":c.status}),c}})}function Hr(e,t,r){const s=ut$1(r);return Dt(e,n=>uneval(n,s),t)}function ut(e,t,r){const s=Object.fromEntries(Object.entries(r).map(([n,a])=>[n,a.encode]));return Dt(e,n=>stringify(n,s),t)}function Dt(e,t,r){try{return t(e)}catch(s){const n=s;if(e instanceof Response)throw new Error(`Data returned from action inside ${r} is not serializable. Form actions need to return plain objects or fail(). E.g. return { success: true } or return fail(400, { message: "invalid" });`,{cause:s});if("path"in n){let a=`Data returned from action inside ${r} is not serializable: ${n.message}`;throw n.path!==""&&(a+=` (data.${n.path})`),new Error(a,{cause:s})}throw n}}function Ft(){let e=-1,t=-1;const r=[];return {iterate:(s=n=>n)=>({[Symbol.asyncIterator](){return {next:async()=>{const n=r[++t];if(!n)return {value:null,done:true};const a=await n.promise;return {value:s(a),done:false}}}}}),add:s=>{r.push(Ht()),s.then(n=>{r[++e].resolve(n);});}}}function _e(e,t,r){let s=1,n=-1;const a=Ft(),o=rt(r);function i(f){return function u(_){if(typeof _?.then=="function"){const m=s++,g=_.then(l=>({data:l})).catch(async l=>({error:await $e(e,t,r,l)})).then(async({data:l,error:h})=>{let p;try{p=uneval(h?[,h]:[l],u);}catch{h=await $e(e,t,r,new Error(`Failed to serialize promise while rendering ${e.route.id}`)),p=uneval([,h],u);}return {index:f,str:`${o}.resolve(${m}, ${p.includes("app.decode")?`(app) => ${p}`:`() => ${p}`})`}});return a.add(g),`${o}.defer(${m})`}else for(const m in r.hooks.transport){const g=r.hooks.transport[m].encode(_);if(g)return `app.decode('${m}', ${uneval(g,u)})`}}}const c=[];return {set_max_nodes(f){n=f;},add_node(f,u){try{if(!u){c[f]="null";return}const _={type:"data",data:u.data,uses:ot(u)};u.slash&&(_.slash=u.slash),c[f]=uneval(_,i(f));}catch(_){throw _.path=_.path.slice(1),new Error(it(e,_),{cause:_})}},get_data(f){const u=`<script${f.script_needs_nonce?` nonce="${f.nonce}"`:""}>`,_=`<\/script>
`;return {data:`[${je(n>-1?c.slice(0,n):c).join(",")}]`,chunks:s>1?a.iterate(({index:m,str:g})=>n>-1&&m>=n?"":u+g+_):null}}}}function Gt(e,t,r){let s=1;const n=Ft(),a={...Object.fromEntries(Object.entries(r.hooks.transport).map(([i,c])=>[i,c.encode])),Promise:i=>{if(typeof i?.then!="function")return;const c=s++;let f="data";const u=i.catch(async _=>(f="error",$e(e,t,r,_))).then(async _=>{let m;try{m=stringify(_,a);}catch{const g=await $e(e,t,r,new Error(`Failed to serialize promise while rendering ${e.route.id}`));f="error",m=stringify(g,a);}return `{"type":"chunk","id":${c},"${f}":${m}}
`});return n.add(u),c}},o=[];return {add_node(i,c){try{if(!c){o[i]="null";return}if(c.type==="error"||c.type==="skip"){o[i]=JSON.stringify(c);return}o[i]=`{"type":"data","data":${stringify(c.data,a)},"uses":${JSON.stringify(ot(c))}${c.slash?`,"slash":${JSON.stringify(c.slash)}`:""}}`;}catch(f){throw f.path="data"+f.path,new Error(it(e,f),{cause:f})}},get_data(){return {data:`{"type":"data","nodes":[${o.join(",")}]}
`,chunks:s>1?n.iterate():null}}}}async function Ye({event:e,event_state:t,state:r,node:s,parent:n}){if(!s?.server)return null;let a=true;const o={dependencies:new Set,params:new Set,parent:false,route:false,url:false,search_params:new Set},i=s.server.load,c=s.server.trailingSlash;if(!i)return {type:"data",data:null,uses:o,slash:c};const f=L$1(e.url,()=>{a&&(o.url=true);},_=>{a&&o.search_params.add(_);});return r.prerendering&&T$1(f),{type:"data",data:await Q({name:"sveltekit.load",attributes:{"sveltekit.load.node_id":s.server_id||"unknown","sveltekit.load.node_type":ft$1(s.server_id),"http.route":e.route.id||"unknown"},fn:async _=>{const m=merge_tracing(e,_);return await with_request_store({event:m,state:t},()=>i.call(null,{...m,fetch:(l,h)=>(new URL(l instanceof Request?l.url:l,e.url),e.fetch(l,h)),depends:(...l)=>{for(const h of l){const{href:p}=new URL(h,e.url);o.dependencies.add(p);}},params:new Proxy(e.params,{get:(l,h)=>(a&&o.params.add(h),l[h])}),parent:async()=>(a&&(o.parent=!0),n()),route:new Proxy(e.route,{get:(l,h)=>(a&&(o.route=!0),l[h])}),url:f,untrack(l){a=!1;try{return l()}finally{a=!0;}}}))}})??null,uses:o,slash:c}}async function Vt({event:e,event_state:t,fetched:r,node:s,parent:n,server_data_promise:a,state:o,resolve_opts:i,csr:c}){const f=await a,u=s?.universal?.load;return u?await Q({name:"sveltekit.load",attributes:{"sveltekit.load.node_id":s.universal_id||"unknown","sveltekit.load.node_type":ft$1(s.universal_id),"http.route":e.route.id||"unknown"},fn:async m=>{const g=merge_tracing(e,m),l={...t,is_in_universal_load:true};return await with_request_store({event:g,state:l},()=>u.call(null,{url:e.url,params:e.params,data:f?.data??null,route:e.route,fetch:Lr(e,o,r,c,i),setHeaders:e.setHeaders,depends:Le,parent:n,untrack:h=>h(),tracing:g.tracing}))}})??null:f?.data??null}function Lr(e,t,r,s,n){const a=async(o,i)=>{const c=o instanceof Request&&o.body?o.clone().body:null,f=o instanceof Request&&[...o.headers].length?new Headers(o.headers):i?.headers;let u=await e.fetch(o,i);const _=new URL(o instanceof Request?o.url:o,e.url),m=_.origin===e.url.origin;let g;if(m)t.prerendering&&(g={response:u,body:null},t.prerendering.dependencies.set(_.pathname,g));else if(_.protocol==="https:"||_.protocol==="http:")if((o instanceof Request?o.mode:i?.mode??"cors")==="no-cors")u=new Response("",{status:u.status,statusText:u.statusText,headers:u.headers});else {const w=u.headers.get("access-control-allow-origin");if(!w||w!==e.url.origin&&w!=="*")throw new Error(`CORS error: ${w?"Incorrect":"No"} 'Access-Control-Allow-Origin' header is present on the requested resource`)}let l;const h=new Proxy(u,{get(p,w,$){async function S(v,b){const d=Number(p.status);if(isNaN(d))throw new Error(`response.status is not a number. value: "${p.status}" type: ${typeof p.status}`);r.push({url:m?_.href.slice(e.url.origin.length):_.href,method:e.request.method,request_body:o instanceof Request&&c?await Ir(c):i?.body,request_headers:f,response_body:v,response:p,is_b64:b});}if(w==="body"){if(p.body===null)return null;if(l)return l;const[v,b]=p.body.tee();return (async()=>{let d=new Uint8Array;for await(const y of v){const k=new Uint8Array(d.length+y.length);k.set(d,0),k.set(y,d.length),d=k;}g&&(g.body=new Uint8Array(d)),S(f$1(d),true);})(),l=b}if(w==="arrayBuffer")return async()=>{const v=await p.arrayBuffer(),b=new Uint8Array(v);return g&&(g.body=b),v instanceof ArrayBuffer&&await S(f$1(b),true),v};async function E(){const v=await p.text();if(v===""&&Ar.includes(p.status)){await S(void 0,false);return}return (!v||typeof v=="string")&&await S(v,false),g&&(g.body=v),v}if(w==="text")return E;if(w==="json")return async()=>{const v=await E();return v?JSON.parse(v):void 0};const x=Reflect.get(p,w,p);return x instanceof Function?Object.defineProperties(function(){return Reflect.apply(x,this===$?p:this,arguments)},{name:{value:x.name},length:{value:x.length}}):x}});if(s){const p=u.headers.get;u.headers.get=w=>{const $=w.toLowerCase(),S=p.call(u.headers,$);if(S&&!$.startsWith("x-sveltekit-")&&!n.filterSerializedResponseHeaders($,S))throw new Error(`Failed to get response header "${$}" — it must be included by the \`filterSerializedResponseHeaders\` option: https://svelte.dev/docs/kit/hooks#Server-hooks-handle (at ${e.route.id})`);return S};}return h};return (o,i)=>{const c=a(o,i);return c.catch(Le),c}}async function Ir(e){let t="";const r=e.getReader(),s=new TextDecoder;for(;;){const{done:n,value:a}=await r.read();if(n){t+=s.decode();break}t+=s.decode(a,{stream:true});}return t}const Jt={"<":"\\u003C","\u2028":"\\u2028","\u2029":"\\u2029"},Mr=new RegExp(`[${Object.keys(Jt).join("")}]`,"g");function Wr(e,t,r=false){const s={};let n=null,a=null,o=false;for(const[u,_]of e.response.headers)t(u,_)&&(s[u]=_),u==="cache-control"?n=_:u==="age"?a=_:u==="vary"&&_.trim()==="*"&&(o=true);const i={status:e.response.status,statusText:e.response.statusText,headers:s,body:e.response_body},c=JSON.stringify(i).replace(Mr,u=>Jt[u]),f=['type="application/json"',"data-sveltekit-fetched",`data-url="${ve(e.url,true)}"`];if(e.is_b64&&f.push("data-b64"),e.request_headers||e.request_body){const u=[];e.request_headers&&u.push([...new Headers(e.request_headers)].join(",")),e.request_body&&u.push(e.request_body),f.push(`data-hash="${Ct(...u)}"`);}if(!r&&e.method==="GET"&&n&&!o){const u=/s-maxage=(\d+)/g.exec(n)??/max-age=(\d+)/g.exec(n);if(u){const _=+u[1]-+(a??"0");f.push(`data-ttl="${_}"`);}}return `<script ${f.join(" ")}>${c}<\/script>`}function ft(e){Ie[0]||Dr();const t=Bt.slice(0),r=Fr(e);for(let n=0;n<r.length;n+=16){const a=r.subarray(n,n+16);let o,i,c,f=t[0],u=t[1],_=t[2],m=t[3],g=t[4],l=t[5],h=t[6],p=t[7];for(let w=0;w<64;w++)w<16?o=a[w]:(i=a[w+1&15],c=a[w+14&15],o=a[w&15]=(i>>>7^i>>>18^i>>>3^i<<25^i<<14)+(c>>>17^c>>>19^c>>>10^c<<15^c<<13)+a[w&15]+a[w+9&15]|0),o=o+p+(g>>>6^g>>>11^g>>>25^g<<26^g<<21^g<<7)+(h^g&(l^h))+Ie[w],p=h,h=l,l=g,g=m+o|0,m=_,_=u,u=f,f=o+(u&_^m&(u^_))+(u>>>2^u>>>13^u>>>22^u<<30^u<<19^u<<10)|0;t[0]=t[0]+f|0,t[1]=t[1]+u|0,t[2]=t[2]+_|0,t[3]=t[3]+m|0,t[4]=t[4]+g|0,t[5]=t[5]+l|0,t[6]=t[6]+h|0,t[7]=t[7]+p|0;}const s=new Uint8Array(t.buffer);return Xt(s),btoa(String.fromCharCode(...s))}const Bt=new Uint32Array(8),Ie=new Uint32Array(64);function Dr(){function e(r){return (r-Math.floor(r))*4294967296}let t=2;for(let r=0;r<64;t++){let s=true;for(let n=2;n*n<=t;n++)if(t%n===0){s=false;break}s&&(r<8&&(Bt[r]=e(t**(1/2))),Ie[r]=e(t**(1/3)),r++);}}function Xt(e){for(let t=0;t<e.length;t+=4){const r=e[t+0],s=e[t+1],n=e[t+2],a=e[t+3];e[t+0]=a,e[t+1]=n,e[t+2]=s,e[t+3]=r;}}function Fr(e){const t=a$1.encode(e),r=t.length*8,s=512*Math.ceil((r+65)/512),n=new Uint8Array(s/8);n.set(t),n[t.length]=128,Xt(n);const a=new Uint32Array(n.buffer);return a[a.length-2]=Math.floor(r/4294967296),a[a.length-1]=r,a}const ht=new Uint8Array(16);function Gr(){return crypto.getRandomValues(ht),btoa(String.fromCharCode(...ht))}const Vr=new Set(["self","unsafe-eval","unsafe-hashes","unsafe-inline","none","strict-dynamic","report-sample","wasm-unsafe-eval","script"]),Jr=/^(nonce|sha\d\d\d)-/;class Kt{#e;#t;#r;#s;#n;#a;#o;#h;#d;#c;#l;#u;#f;#i;script_needs_nonce;style_needs_nonce;script_needs_hash;#p;constructor(t,r,s){this.#e=t,this.#d=r;const n=this.#d;this.#c=new Set,this.#l=new Set,this.#u=new Set,this.#f=new Set,this.#i=new Set;const a=n["script-src"]||n["default-src"],o=n["script-src-elem"],i=n["style-src"]||n["default-src"],c=n["style-src-attr"],f=n["style-src-elem"],u=m=>!!m&&!m.some(g=>g==="unsafe-inline"),_=m=>!!m&&(!m.some(g=>g==="unsafe-inline")||m.some(g=>g==="strict-dynamic"));this.#r=_(a),this.#s=_(o),this.#a=u(i),this.#o=u(c),this.#h=u(f),this.#t=this.#r||this.#s,this.#n=this.#a||this.#o||this.#h,this.script_needs_nonce=this.#t&&!this.#e,this.style_needs_nonce=this.#n&&!this.#e,this.script_needs_hash=this.#t&&this.#e,this.#p=s;}add_script(t){if(!this.#t)return;const r=this.#e?`sha256-${ft(t)}`:`nonce-${this.#p}`;this.#r&&this.#c.add(r),this.#s&&this.#l.add(r);}add_script_hashes(t){for(const r of t)this.#r&&this.#c.add(r),this.#s&&this.#l.add(r);}add_style(t){if(!this.#n)return;const r=this.#e?`sha256-${ft(t)}`:`nonce-${this.#p}`;if(this.#a&&this.#u.add(r),this.#o&&this.#f.add(r),this.#h){const s="sha256-9OlNO0DNEeaVzHL4RZwCLsBHA8WBQ8toBp/4F5XV2nc=",n=this.#d;n["style-src-elem"]&&!n["style-src-elem"].includes(s)&&!this.#i.has(s)&&this.#i.add(s),r!==s&&this.#i.add(r);}}get_header(t=false){const r=[],s={...this.#d};this.#u.size>0&&(s["style-src"]=[...s["style-src"]||s["default-src"]||[],...this.#u]),this.#f.size>0&&(s["style-src-attr"]=[...s["style-src-attr"]||[],...this.#f]),this.#i.size>0&&(s["style-src-elem"]=[...s["style-src-elem"]||[],...this.#i]),this.#c.size>0&&(s["script-src"]=[...s["script-src"]||s["default-src"]||[],...this.#c]),this.#l.size>0&&(s["script-src-elem"]=[...s["script-src-elem"]||[],...this.#l]);for(const n in s){if(t&&(n==="frame-ancestors"||n==="report-uri"||n==="sandbox"))continue;const a=s[n];if(!a)continue;const o=[n];Array.isArray(a)&&a.forEach(i=>{Vr.has(i)||Jr.test(i)?o.push(`'${i}'`):o.push(i);}),r.push(o.join(" "));}return r.join("; ")}}class Br extends Kt{get_meta(){const t=this.get_header(true);if(t)return `<meta http-equiv="content-security-policy" content="${ve(t,true)}">`}}class Xr extends Kt{constructor(t,r,s){if(super(t,r,s),Object.values(r).filter(n=>!!n).length>0){const n=r["report-to"]?.length??false,a=r["report-uri"]?.length??false;if(!n&&!a)throw Error("`content-security-policy-report-only` must be specified with either the `report-to` or `report-uri` directives, or both")}}}class Kr{nonce=Gr();csp_provider;report_only_provider;constructor({mode:t,directives:r,reportOnly:s},{prerender:n}){const a=t==="hash"||t==="auto"&&n;this.csp_provider=new Br(a,r,this.nonce),this.report_only_provider=new Xr(a,s,this.nonce);}get script_needs_hash(){return this.csp_provider.script_needs_hash||this.report_only_provider.script_needs_hash}get script_needs_nonce(){return this.csp_provider.script_needs_nonce||this.report_only_provider.script_needs_nonce}get style_needs_nonce(){return this.csp_provider.style_needs_nonce||this.report_only_provider.style_needs_nonce}add_script(t){this.csp_provider.add_script(t),this.report_only_provider.add_script(t);}add_script_hashes(t){this.csp_provider.add_script_hashes(t),this.report_only_provider.add_script_hashes(t);}add_style(t){this.csp_provider.add_style(t),this.report_only_provider.add_style(t);}}function Yt(e,t,r){const{errors:s,layouts:n,leaf:a}=e,o=[...s,...n.map(i=>i?.[1]),a[1]].filter(i=>typeof i=="number").map(i=>`'${i}': () => ${Qt(r._.client.nodes?.[i],t)}`).join(`,
		`);return [`{
	id: ${N(e.id)}`,`errors: ${N(e.errors)}`,`layouts: ${N(e.layouts)}`,`leaf: ${N(e.leaf)}`,`nodes: {
		${o}
	}
}`].join(`,
	`)}function Qt(e$1,t$1){if(!e$1)return "Promise.resolve({})";if(e$1[0]==="/")return `import('${e$1}')`;if(t!=="")return `import('${t}/${e$1}')`;let r=i$2(t$1.pathname,`${e}/${e$1}`);return r[0]!=="."&&(r=`./${r}`),`import('${r}')`}async function Yr(e,t,r){if(!r._.client.routes)return text("Server-side route resolution disabled",{status:400});const s=await r._.matchers(),n=Ut(e,r._.client.routes,s);return Zt(n?.route??null,n?.params??{},t,r).response}function Zt(e,t,r,s){const n=new Headers({"content-type":"application/javascript; charset=utf-8"});if(e){const a=Yt(e,r,s),o=`${Qr(e,r,s)}
export const route = ${a}; export const params = ${JSON.stringify(t)};`;return {response:text(o,{headers:n}),body:o}}else return {response:text("",{headers:n}),body:""}}function Qr(e$1,t$1,r){const{errors:s,layouts:n,leaf:a}=e$1;let o="";for(const i of [...s,...n.map(c=>c?.[1]),a[1]]){if(typeof i!="number")continue;const c=r._.client.css?.[i];for(const f of c??[])o+=`'${t||e}/${f}',`;}return o?`${Qt(r._.client.start,t$1)}.then(x => x.load_css([${o}]));`:""}const Zr={...j(false),check:()=>false};async function me({branch:e$1,fetched:t$1,options:r$1,manifest:s,state:n,page_config:a,status:o,error:i$2=null,event:c$1,event_state:f,resolve_opts:u,action_result:_,data_serializer:m,error_components:g}){if(n.prerendering){if(r$1.csp.mode==="nonce")throw new Error('Cannot use prerendering if config.kit.csp.mode === "nonce"');if(r$1.app_template_contains_nonce)throw new Error("Cannot use prerendering if page template contains %sveltekit.nonce%")}const{client:l}=s._,h=new Set(l.imports),p=new Set(l.stylesheets),w=new Set(l.fonts),$$1=new Set,S=new Map;let E;const x=_?.type==="success"||_?.type==="failure"?_.data??null:null;let v=e,b=t,d=N(e);const y=new Kr(r$1.csp,{prerender:!!n.prerendering});if(n.prerendering?.fallback?r$1.hash_routing&&(d="new URL('.', location).pathname.slice(0, -1)"):(v=c$1.url.pathname.slice(e.length).split("/").slice(2).map(()=>"..").join("/")||".",d=`new URL(${N(v)}, location).pathname.slice(0, -1)`,(!t||t[0]==="/"&&t!==Ve)&&(b=v)),a.ssr){const R={stores:{page:$(null),navigating:$(null),updated:Zr},constructors:await Promise.all(e$1.map(({node:C})=>{if(!C.component)throw new Error(`Missing +page.svelte component for route ${c$1.route.id}`);return C.component()})),form:x};g&&(i$2&&(R.error=i$2),R.errors=g);let j={};for(let C=0;C<e$1.length;C+=1)j={...j,...e$1[C].data},R[`data_${C}`]=j;R.page={error:i$2,params:c$1.params,route:c$1.route,status:o,url:c$1.url,data:j,form:x,state:{}};const H={context:new Map([["__request__",{page:R.page}]]),csp:y.script_needs_nonce?{nonce:y.nonce}:{hash:y.script_needs_hash},transformError:g?(async C$1=>{if(isRedirect(C$1))throw C$1;const X=await $e(c$1,f,r$1,C$1);return R.page.error=R.error=i$2=X,R.page.status=o=C(C$1),X}):void 0};try{const C={...f,is_in_render:!0};E=await with_request_store({event:c$1,state:C},async()=>{r&&o$1({base:v,assets:b});const X=r$1.root.render(R,H),le=r$1.async&&"then"in X?X.then(O=>O):X;r$1.async&&c();const{head:be,html:de,css:ke,hashes:se}=r$1.async?await le:le;return se&&y.add_script_hashes(se.script),{head:be,html:de,css:ke,hashes:se}});}finally{c();}}else E={head:"",html:"",css:{code:"",map:null},hashes:{script:[]}};for(const{node:R}of e$1){for(const j of R.imports)h.add(j);for(const j of R.stylesheets)p.add(j);for(const j of R.fonts)w.add(j);R.inline_styles&&!l.inline&&Object.entries(await R.inline_styles()).forEach(([j,H])=>{if(typeof H=="string"){S.set(j,H);return}S.set(j,H(`${b}/${i$1}/immutable/assets`,b));});}const k=new es(E.head,!!n.prerendering);let T=E.html;const q=R=>R.startsWith("/")?e+R:`${b}/${R}`,A=l.inline?l.inline?.style:Array.from(S.values()).join(`
`);if(A){const R=[];y.style_needs_nonce&&R.push(`nonce="${y.nonce}"`),y.add_style(A),k.add_style(A,R);}for(const R of p){const j=q(R),H=['rel="stylesheet"'];S.has(R)?H.push("disabled",'media="(max-width: 0)"'):u.preload({type:"css",path:j})&&$$1.add(`<${encodeURI(j)}>; rel="preload"; as="style"; nopush`),k.add_stylesheet(j,H);}for(const R of w){const j=q(R);if(u.preload({type:"font",path:j})){const H=R.slice(R.lastIndexOf(".")+1);k.add_link_tag(j,['rel="preload"','as="font"',`type="font/${H}"`,"crossorigin"]),$$1.add(`<${encodeURI(j)}>; rel="preload"; as="font"; type="font/${H}"; crossorigin; nopush`);}}const P=rt(r$1),{data:G,chunks:J}=m.get_data(y);if(a.ssr&&a.csr&&(T+=`
			${t$1.map(R=>Wr(R,u.filterSerializedResponseHeaders,!!n.prerendering)).join(`
			`)}`),a.csr){const R=s._.client.routes?.find(O=>O.id===c$1.route.id)??null;if(l.uses_env_dynamic_public&&n.prerendering&&h.add(`${i$1}/env.js`),!l.inline){const O=Array.from(h,z=>q(z)).filter(z=>u.preload({type:"js",path:z}));for(const z of O)$$1.add(`<${encodeURI(z)}>; rel="modulepreload"; nopush`),r$1.preload_strategy!=="modulepreload"?k.add_script_preload(z):k.add_link_tag(z,['rel="modulepreload"']);}if(s._.client.routes&&n.prerendering&&!n.prerendering.fallback){const O=Nt(c$1.url.pathname);n.prerendering.dependencies.set(O,Zt(R,c$1.params,new URL(O,c$1.url),s));}const j=[],H=l.uses_env_dynamic_public&&n.prerendering,re=[`base: ${d}`];if(t&&re.push(`assets: ${N(t)}`),l.uses_env_dynamic_public&&re.push(`env: ${H?"null":N(i)}`),J){j.push("const deferred = new Map();"),re.push(`defer: (id) => new Promise((fulfil, reject) => {
							deferred.set(id, { fulfil, reject });
						})`);let O="";Object.keys(r$1.hooks.transport).length>0&&(l.inline?O=`const app = __sveltekit_${r$1.version_hash}.app.app;`:l.app?O=`const app = await import(${N(q(l.app))});`:O=`const { app } = await import(${N(q(l.start))});`);const z=O?`${O}
							const [data, error] = fn(app);`:"const [data, error] = fn();";re.push(`resolve: async (id, fn) => {
							${z}

							const try_to_resolve = () => {
								if (!deferred.has(id)) {
									setTimeout(try_to_resolve, 0);
									return;
								}
								const { fulfil, reject } = deferred.get(id);
								deferred.delete(id);
								if (error) reject(error);
								else fulfil(data);
							}
							try_to_resolve();
						}`);}j.push(`${P} = {
						${re.join(`,
						`)}
					};`);const C=["element"];if(j.push("const element = document.currentScript.parentElement;"),a.ssr){const O={form:"null",error:"null"};x&&(O.form=Hr(x,c$1.route.id,r$1.hooks.transport)),i$2&&(O.error=uneval(i$2));const z=[`node_ids: [${e$1.map(({node:Z})=>Z.index).join(", ")}]`,`data: ${G}`,`form: ${O.form}`,`error: ${O.error}`];if(o!==200&&z.push(`status: ${o}`),s._.client.routes){if(R){const Z=Yt(R,c$1.url,s).replaceAll(`
`,`
							`);z.push(`params: ${uneval(c$1.params)}`,`server_route: ${Z}`);}}else r$1.embedded&&z.push(`params: ${uneval(c$1.params)}`,`route: ${N(c$1.route)}`);const ne="	".repeat(H?7:6);C.push(`{
${ne}	${z.join(`,
${ne}	`)}
${ne}}`);}const{remote:X}=f;let le="",be="";if(X.data){const O={},z={};for(const[Z,Ze]of X.data)if(Z.id)for(const et in Ze){const Ae=Ze[et];if(!Ae.serialize)continue;const $e=Fe$1(Z.id,et),tt=Z.type==="prerender"?z:O;if(f.remote.refreshes?.has($e)||f.remote.reconnects?.has($e))tt[$e]=await Ae.data;else {const ve=await Promise.race([Promise.resolve(Ae.data).then(ue=>({settled:true,value:ue}),ue=>({settled:true,error:ue})),new Promise(ue=>{queueMicrotask(()=>ue({settled:false}));})]);if(ve.settled){if("error"in ve)throw ve.error;tt[$e]=ve.value;}}}const ne=ut$1(r$1.hooks.transport);Object.keys(O).length>0&&(le=`${P}.query = ${uneval(O,ne)};

						`),Object.keys(z).length>0&&(be=`${P}.prerender = ${uneval(z,ne)};

						`);}const de=`${le}${be}`,ke=l.inline?`${l.inline.script}

					${de}${P}.app.start(${C.join(", ")});`:l.app?`Promise.all([
						import(${N(q(l.start))}),
						import(${N(q(l.app))})
					]).then(([kit, app]) => {
						${de}kit.start(app, ${C.join(", ")});
					});`:`import(${N(q(l.start))}).then((app) => {
						${de}app.start(${C.join(", ")})
					});`;if(H?j.push(`import(${N(`${v}/${i$1}/env.js`)}).then(({ env }) => {
						${P}.env = env;

						${ke.replace(/\n/g,`
	`)}
					});`):j.push(ke),r$1.service_worker){let O="";if(r$1.service_worker_options!=null){const z={...r$1.service_worker_options};O=`, ${N(z)}`;}j.push(`if ('serviceWorker' in navigator) {
						const script_url = '${q("service-worker.js")}';
						const policy = globalThis?.window?.trustedTypes?.createPolicy(
							'sveltekit-trusted-url',
							{ createScriptURL(url) { return url; } }
						);
						const sanitised = policy?.createScriptURL(script_url) ?? script_url;
						addEventListener('load', function () {
							navigator.serviceWorker.register(sanitised${O});
						});
					}`);}const se=`
				{
					${j.join(`

					`)}
				}
			`;y.add_script(se),T+=`
			<script${y.script_needs_nonce?` nonce="${y.nonce}"`:""}>${se}<\/script>
		`;}const V=new Headers({"x-sveltekit-page":"true","content-type":"text/html"});if(n.prerendering){const R=y.csp_provider.get_meta();R&&k.add_http_equiv(R),n.prerendering.cache&&k.add_http_equiv(`<meta http-equiv="cache-control" content="${n.prerendering.cache}">`);}else {const R=y.csp_provider.get_header();R&&V.set("content-security-policy",R);const j=y.report_only_provider.get_header();j&&V.set("content-security-policy-report-only",j),$$1.size&&V.set("link",Array.from($$1).join(", "));}const te=r$1.templates.app({head:k.build(),body:T,assets:b,nonce:y.nonce,env:i}),ce=await u.transformPageChunk({html:te,done:true})||"";return J||V.set("etag",`"${Ct(ce)}"`),J?new Response(new ReadableStream({async start(R){R.enqueue(a$1.encode(ce+`
`));for await(const j of J)j.length&&R.enqueue(a$1.encode(j));R.close();},type:"bytes"}),{headers:V}):text(ce,{status:o,headers:V})}class es{#e;#t;#r=[];#s=[];#n=[];#a=[];#o=[];constructor(t,r){this.#e=t,this.#t=r;}build(){return [...this.#r,...this.#s,...this.#n,this.#e,...this.#a,...this.#o].join(`
		`)}add_style(t,r){this.#a.push(`<style${r.length?" "+r.join(" "):""}>${t}</style>`);}add_stylesheet(t,r){this.#o.push(`<link href="${t}" ${r.join(" ")}>`);}add_script_preload(t){this.#n.push(`<link rel="preload" as="script" crossorigin="anonymous" href="${t}">`);}add_link_tag(t,r){this.#t&&this.#s.push(`<link href="${t}" ${r.join(" ")}>`);}add_http_equiv(t){this.#t&&this.#r.push(t);}}class Qe{data;constructor(t){this.data=t;}layouts(){return this.data.slice(0,-1)}page(){return this.data.at(-1)}validate(){for(const r of this.layouts())r&&(q$1(r.server,r.server_id),z$1(r.universal,r.universal_id));const t=this.page();t&&(A(t.server,t.server_id),I(t.universal,t.universal_id));}#e(t){return this.data.reduce((r,s)=>s?.universal?.[t]??s?.server?.[t]??r,void 0)}csr(){return this.#e("csr")??true}ssr(){return this.#e("ssr")??true}prerender(){return this.#e("prerender")??false}trailing_slash(){return this.#e("trailingSlash")??"never"}get_config(){let t={};for(const r of this.data)!r?.universal?.config&&!r?.server?.config||(t={...t,...r?.universal?.config,...r?.server?.config});return Object.keys(t).length?t:void 0}should_prerender_data(){return this.data.some(t=>t?.server?.load||t?.server?.trailingSlash!==void 0)}}async function Me({event:e,event_state:t,options:r,manifest:s,state:n,status:a,error:o,resolve_opts:i}){if(e.request.headers.get("x-sveltekit-error"))return Ae(r,a,o.message);const c=[];try{const f=[],u=await s._.nodes[0](),_=new Qe([u]),m=_.ssr(),g=_.csr(),l=_e(e,t,r);if(m){n.error=!0;const h=Ye({event:e,event_state:t,state:n,node:u,parent:async()=>({})}),p=await h;l.add_node(0,p);const w=await Vt({event:e,event_state:t,fetched:c,node:u,parent:async()=>({}),resolve_opts:i,server_data_promise:h,state:n,csr:g});f.push({node:u,server_data:p,data:w},{node:await s._.nodes[1](),data:null,server_data:null});}return await me({options:r,manifest:s,state:n,page_config:{ssr:m,csr:g},status:a,error:await $e(e,t,r,o),branch:f,error_components:[],fetched:c,event:e,event_state:t,resolve_opts:i,data_serializer:l})}catch(f){return f instanceof Redirect?st(f.status,f.location):Ae(r,C(f),(await $e(e,t,r,f)).message)}}async function ts(e,t,r,s,n){return Q({name:"sveltekit.remote.call",attributes:{},fn:a=>{const o=merge_tracing(e,a);return with_request_store({event:o,state:t},()=>rs(o,t,r,s,n))}})}async function rs(e,t,r,s,n){const[a,o,i]=n.split("/"),c=s._.remotes;c[a]||error(404);const u=(await c[a]()).default[o];u||error(404);const _=u.__,m=r.hooks.transport;e.tracing.current.setAttributes({"sveltekit.remote.call.type":_.type,"sveltekit.remote.call.name":_.name});try{if(_.type==="query_batch"){if(e.request.method!=="POST")throw new SvelteKitError(405,"Method Not Allowed",`\`query.batch\` functions must be invoked via POST request, not ${e.request.method}`);const{payloads:p}=await e.request.json(),w=await Promise.all(p.map(S=>Ce$1(S,m))),$=await with_request_store({event:e,state:t},()=>_.run(w,r));return json({type:"result",result:Be$1($,m)})}if(_.type==="form"){if(e.request.method!=="POST")throw new SvelteKitError(405,"Method Not Allowed",`\`form\` functions must be invoked via POST request, not ${e.request.method}`);if(!et(e.request))throw new SvelteKitError(415,"Unsupported Media Type",`\`form\` functions expect form-encoded data — received ${e.request.headers.get("content-type")}`);const{data:p,meta:w,form_data:$}=await Je$1(e.request);t.remote.requested=pt(w.remote_refreshes),i&&!("id"in p)&&(p.id=JSON.parse(decodeURIComponent(i)));const S=_.fn,E=await with_request_store({event:e,state:t},()=>S(p,w,$));return json({type:"result",result:Be$1(E,m),refreshes:E.issues?void 0:await g(t.remote.refreshes),reconnects:E.issues?void 0:await g(t.remote.reconnects)})}if(_.type==="command"){const{payload:p,refreshes:w}=await e.request.json();t.remote.requested=pt(w);const $=Ce$1(p,m),S=await with_request_store({event:e,state:t},()=>u($));return json({type:"result",result:Be$1(S,m),refreshes:await g(t.remote.refreshes),reconnects:await g(t.remote.reconnects)})}if(_.type==="query_live"){let S=function(b,d){b.enqueue($.encode(JSON.stringify(d)+`
`));};if(e.request.method!=="GET")throw new SvelteKitError(405,"Method Not Allowed",`\`query.live\` functions must be invoked via GET request, not ${e.request.method}`);const p=new URL(e.request.url).searchParams.get("payload"),w=_.run(e,t,Ce$1(p,m)),$=new TextEncoder;let E=!1,x;async function v(){E||(E=!0,await w.return(void 0));}return e.request.signal.addEventListener("abort",v,{once:!0}),new Response(new ReadableStream({async pull(b){if(e.request.signal.aborted){await v(),b.close();return}try{for(;;){const{value:d,done:y}=await w.next();if(y){await v(),b.close();return}if(x!==(x=Be$1(d,m))){S(b,{type:"result",result:x});return}}}catch(d){if(!e.request.signal.aborted)if(d instanceof Redirect)S(b,{type:"redirect",location:d.location});else {const y=d instanceof HttpError||d instanceof SvelteKitError?d.status:500;S(b,{type:"error",error:await $e(e,t,r,d),status:y});}await v(),b.close();}},cancel:v}),{headers:{"cache-control":"private, no-store","content-type":"application/x-ndjson"}})}const l=_.type==="prerender"?i:new URL(e.request.url).searchParams.get("payload"),h=await with_request_store({event:e,state:t},()=>u(Ce$1(l,m)));return json({type:"result",result:Be$1(h,m)})}catch(l){if(l instanceof Redirect)return json({type:"redirect",location:l.location,refreshes:await g(t.remote.refreshes),reconnects:await g(t.remote.reconnects)});const h=l instanceof HttpError||l instanceof SvelteKitError?l.status:500;return json({type:"error",error:await $e(e,t,r,l),status:h},{status:t.prerendering?h:void 0,headers:{"cache-control":"private, no-store"}})}async function g(l){if(!l||l.size===0)return;const h=await Promise.all(Array.from(l,async([p,w])=>{try{return [p,{type:"result",data:await w}]}catch($){const S=$ instanceof HttpError||$ instanceof SvelteKitError?$.status:500;return [p,{type:"error",status:S,error:await $e(e,t,r,$)}]}}));return Be$1(Object.fromEntries(h),m)}}function pt(e){const t=new Map;for(const r of e??[]){const s=Ue$1(r),n=t.get(s.id);n?n.push(s.payload):t.set(s.id,[s.payload]);}return t}async function ss(e,t,r,s){return Q({name:"sveltekit.remote.form.post",attributes:{},fn:n=>{const a=merge_tracing(e,n);return with_request_store({event:a,state:t},()=>ns(a,t,r,s))}})}async function ns(e,t,r,s){const[n,a,o]=s.split("/");let f=(await r._.remotes[n]?.())?.default[a];if(!f)return e.setHeaders({allow:"GET"}),{type:"error",error:new SvelteKitError(405,"Method Not Allowed","POST method not allowed. No form actions exist for this page")};o&&(f=with_request_store({event:e,state:t},()=>f.for(JSON.parse(o))));try{const u=f.__.fn,{data:_,meta:m,form_data:g}=await Je$1(e.request);return o&&!("id"in _)&&(_.id=JSON.parse(decodeURIComponent(o))),await with_request_store({event:e,state:t},()=>u(_,m,g)),{type:"success",status:200}}catch(u){const _=Qe$1(u);return _ instanceof Redirect?{type:"redirect",status:_.status,location:_.location}:{type:"error",error:Ke(_)}}}function as(e$1){return e$1.pathname.startsWith(`${e}/${i$1}/remote/`)&&e$1.pathname.replace(`${e}/${i$1}/remote/`,"")}function os(e){return e.searchParams.get("/remote")}const is=10;async function cs(e,t,r,s,n,a,o,i){if(a.depth>is)return text(`Not found: ${e.url.pathname}`,{status:404});if(Lt(e)){const c=await n._.nodes[r.leaf]();return Ur(e,t,s,c?.server)}try{const c=o.page();let f=200,u;if(Cr(e)){const b=os(e.url);if(b?u=await ss(e,t,n,b):u=await Nr(e,t,c.server),u?.type==="redirect")return st(u.status,u.location);u?.type==="error"&&(f=C(u.error)),u?.type==="failure"&&(f=u.status);}const _=o.prerender();if(_){if(c.server?.actions)throw new Error("Cannot prerender pages with actions")}else if(a.prerendering)return new Response(void 0,{status:204});a.prerender_default=_;const m=o.should_prerender_data(),g=Be(e.url.pathname),l=[],h=o.ssr(),p=o.csr();if(h===!1&&!(a.prerendering&&m))return Re&&u&&e.request.headers.has("x-sveltekit-action"),await me({branch:je(o.data).map(b=>({node:b,data:null,server_data:null})),fetched:l,page_config:{ssr:!1,csr:p},status:f,error:null,event:e,event_state:t,options:s,manifest:n,state:a,resolve_opts:i,data_serializer:_e(e,t,s)});const w=[];let $=null;const S=_e(e,t,s),E=a.prerendering&&m?Gt(e,t,s):null,x=o.data.map((b,d)=>{if($)throw $;return Promise.resolve().then(async()=>{try{if(b===c&&u?.type==="error")throw u.error;const y=await Ye({event:e,event_state:t,state:a,node:b,parent:async()=>{const k={};for(let T=0;T<d;T+=1){const q=await x[T];q&&Object.assign(k,q.data);}return k}});return b&&S.add_node(d,y),E?.add_node(d,y),y}catch(y){throw $=y,$}})}),v=o.data.map((b,d)=>{if($)throw $;return Promise.resolve().then(async()=>{try{return await Vt({event:e,event_state:t,fetched:l,node:b,parent:async()=>{const y={};for(let k=0;k<d;k+=1)Object.assign(y,await v[k]);return y},resolve_opts:i,server_data_promise:x[d],state:a,csr:p})}catch(y){throw $=y,$}})});for(const b of x)b.catch(Le);for(const b of v)b.catch(Le);for(let b=0;b<o.data.length;b+=1){const d=o.data[b];if(d)try{const y=await x[b],k=await v[b];w.push({node:d,server_data:y,data:k});}catch(y){const k=Qe$1(y);if(k instanceof Redirect){if(a.prerendering&&m){const A=JSON.stringify({type:"redirect",location:k.location});a.prerendering.dependencies.set(g,{response:text(A),body:A});}return st(k.status,k.location)}const T=C(k),q=await $e(e,t,s,k);for(;b--;)if(r.errors[b]){const A=r.errors[b],P=await n._.nodes[A]();let G=b;for(;!w[G];)G-=1;S.set_max_nodes(G+1);const J=je(w.slice(0,G+1)),V=new Qe(J.map(ce=>ce.node)),te=J.concat({node:P,data:null,server_data:null});return await me({event:e,event_state:t,options:s,manifest:n,state:a,resolve_opts:i,page_config:{ssr:V.ssr(),csr:V.csr()},status:T,error:q,error_components:await _t(s,h,te,r,n),branch:te,fetched:l,data_serializer:S})}return Ae(s,T,q.message)}else w.push(null);}if(a.prerendering&&E){let{data:b,chunks:d}=E.get_data();if(d)for await(const y of d)b+=y;a.prerendering.dependencies.set(g,{response:text(b),body:b});}return await me({event:e,event_state:t,options:s,manifest:n,state:a,resolve_opts:i,page_config:{csr:p,ssr:h},status:f,error:null,branch:je(w),action_result:u,fetched:l,data_serializer:h?S:_e(e,t,s),error_components:await _t(s,h,w,r,n)})}catch(c){return c instanceof Redirect?st(c.status,c.location):await Me({event:e,event_state:t,options:s,manifest:n,state:a,status:c instanceof HttpError?c.status:500,error:c,resolve_opts:i})}}async function _t(e,t,r,s,n){let a;if(e.server_error_boundaries&&t){let o=-1;a=await Promise.all(r.map((i,c)=>{if(c===0)return;if(!i)return null;for(c--;c>o+1&&s.errors[c]===void 0;)c-=1;o=c;const f=s.errors[c];if(f!=null)return n._.nodes[f]?.().then(u=>u.component?.()).catch(()=>{})}).filter(i=>i!==null));}return a}async function ls(e,t,r,s,n,a,o,i){if(!r.page)return new Response(void 0,{status:404});try{const c=[...r.page.layouts,r.page.leaf],f=o??c.map(()=>!0);let u=!1;const _=new URL(e.url);_.pathname=R(_.pathname,i);const m={...e,url:_},g=c.map((E,x)=>Me$1(async()=>{try{if(u)return {type:"skip"};const v=E==null?E:await n._.nodes[E]();return Ye({event:m,event_state:t,state:a,node:v,parent:async()=>{const b={};for(let d=0;d<x;d+=1){const y=await g[d]();y&&Object.assign(b,y.data);}return b}})}catch(v){throw u=!0,v}})),l=g.map(async(E,x)=>f[x]?E():{type:"skip"});let h=l.length;const p=await Promise.all(l.map((E,x)=>E.catch(async v=>{if(v instanceof Redirect)throw v;return h=Math.min(h,x+1),{type:"error",error:await $e(e,t,s,v),status:v instanceof HttpError||v instanceof SvelteKitError?v.status:void 0}}))),w=Gt(e,t,s);for(let E=0;E<p.length;E++)w.add_node(E,p[E]);const{data:$,chunks:S}=w.get_data();return S?new Response(new ReadableStream({async start(E){E.enqueue(a$1.encode($));for await(const x of S)E.enqueue(a$1.encode(x));E.close();},type:"bytes"}),{headers:{"content-type":"text/sveltekit-data","cache-control":"private, no-store"}}):We($)}catch(c){const f=Qe$1(c);return f instanceof Redirect?De(f):We(await $e(e,t,s,f),500)}}function We(e,t=200){return text(typeof e=="string"?e:JSON.stringify(e),{status:t,headers:{"content-type":"application/json","cache-control":"private, no-store"}})}function De(e){return We({type:"redirect",location:e.location})}const ds=/[\x00-\x1F\x7F()<>@,;:"/[\]?={} \t]/;function Oe(e){if(e?.path===void 0)throw new Error("You must specify a `path` when setting, deleting or serializing cookies")}function us(e,t,r){return `${e||""}${t}?${encodeURIComponent(r)}`}function fs(e,t){const r=e.headers.get("cookie")??"",s=cookieExports.parse(r,{decode:m=>m});let n;const a=new Map,o={httpOnly:true,sameSite:"lax",secure:!(t.hostname==="localhost"&&t.protocol==="http:")},i={get(m,g){const l=Array.from(a.values()).filter(w=>w.name===m&&Pe(t.hostname,w.options.domain)&&ze(t.pathname,w.options.path)).sort((w,$)=>$.options.path.length-w.options.path.length)[0];return l?l.options.maxAge===0?void 0:l.value:cookieExports.parse(r,{decode:g?.decode})[m]},getAll(m){const g=cookieExports.parse(r,{decode:m?.decode}),l=new Map;for(const h of a.values())if(Pe(t.hostname,h.options.domain)&&ze(t.pathname,h.options.path)){const p=l.get(h.name);(!p||h.options.path.length>p.options.path.length)&&l.set(h.name,h);}for(const h of l.values())g[h.name]=h.value;return Object.entries(g).map(([h,p])=>({name:h,value:p}))},set(m,g,l){const h=m.match(ds);h&&console.warn(`The cookie name "${m}" will be invalid in SvelteKit 3.0 as it contains ${h.join(" and ")}. See RFC 2616 for more details https://datatracker.ietf.org/doc/html/rfc2616#section-2.2`),Oe(l),u(m,g,{...o,...l});},delete(m,g){Oe(g),i.set(m,"",{...g,maxAge:0});},serialize(m,g,l){Oe(l);let h=l.path;if(!l.domain||l.domain===t.hostname){if(!n)throw new Error("Cannot serialize cookies until after the route is determined");h=O(n,h);}return cookieExports.serialize(m,g,{...o,...l,path:h})}};function c(m,g){const l={...s};for(const h of a.values()){if(!Pe(m.hostname,h.options.domain)||!ze(m.pathname,h.options.path))continue;const p=h.options.encode||encodeURIComponent;l[h.name]=p(h.value);}if(g){const h=cookieExports.parse(g,{decode:p=>p});for(const p in h)l[p]=h[p];}return Object.entries(l).map(([h,p])=>`${h}=${p}`).join("; ")}const f=[];function u(m,g,l){if(!n){f.push(()=>u(m,g,l));return}let h=l.path;(!l.domain||l.domain===t.hostname)&&(h=O(n,h));const p=us(l.domain,h,m),w={name:m,value:g,options:{...l,path:h}};a.set(p,w);}function _(m){n=R(t.pathname,m),f.forEach(g=>g());}return {cookies:i,new_cookies:a,get_cookie_header:c,set_internal:u,set_trailing_slash:_}}function Pe(e,t){if(!t)return  true;const r=t[0]==="."?t.slice(1):t;return e===r?true:e.endsWith("."+r)}function ze(e,t){if(!t)return  true;const r=t.endsWith("/")?t.slice(0,-1):t;return e===r?true:e.startsWith(r+"/")}function mt(e,t){for(const r of t){const{name:s,value:n,options:a}=r;if(e.append("set-cookie",cookieExports.serialize(s,n,a)),a.path.endsWith(".html")){const o=Be(a.path);e.append("set-cookie",cookieExports.serialize(s,n,{...a,path:o}));}}}function hs({event:e$1,options:t$1,manifest:r,state:s,get_cookie_header:n,set_internal:a}){const o$1=async(i,c)=>{const f=yt(i,c,e$1.url);let u=(i instanceof Request?i.mode:c?.mode)??"cors",_=(i instanceof Request?i.credentials:c?.credentials)??"same-origin";return t$1.hooks.handleFetch({event:e$1,request:f,fetch:async(m,g)=>{const l=yt(m,g,e$1.url),h=new URL(l.url);l.headers.has("origin")||l.headers.set("origin",e$1.url.origin),m!==f&&(u=(m instanceof Request?m.mode:g?.mode)??"cors",_=(m instanceof Request?m.credentials:g?.credentials)??"same-origin"),(l.method==="GET"||l.method==="HEAD")&&(u==="no-cors"&&h.origin!==e$1.url.origin||h.origin===e$1.url.origin)&&l.headers.delete("origin");const p=decodeURIComponent(h.pathname);if(h.origin!==e$1.url.origin||e&&p!==e&&!p.startsWith(`${e}/`)){if(`.${h.hostname}`.endsWith(`.${e$1.url.hostname}`)&&_!=="omit"){const b=n(h,l.headers.get("cookie"));b&&l.headers.set("cookie",b);}return fetch(l)}const w=t||e,$=(p.startsWith(w)?p.slice(w.length):p).slice(1),S=`${$}/index.html`,E=r.assets.has($)||$ in r._.server_assets,x=r.assets.has(S)||S in r._.server_assets;if(E||x){const b=E?$:S;if(s.read){const d=E?r.mimeTypes[$.slice($.lastIndexOf("."))]:"text/html";return new Response(s.read(b),{headers:d?{"content-type":d}:{}})}else if(o&&b in r._.server_assets){const d=r._.server_assets[b],y=r.mimeTypes[b.slice(b.lastIndexOf("."))];return new Response(o(b),{headers:{"Content-Length":""+d,"Content-Type":y}})}return await fetch(l)}if(at(r,e+p))return await fetch(l);if(_!=="omit"){const b=n(h,l.headers.get("cookie"));b&&l.headers.set("cookie",b);const d=e$1.request.headers.get("authorization");d&&!l.headers.has("authorization")&&l.headers.set("authorization",d);}l.headers.has("accept")||l.headers.set("accept","*/*"),l.headers.has("accept-language")||l.headers.set("accept-language",e$1.request.headers.get("accept-language"));const v=await ps(l,t$1,r,s);for(const b of Xe$1(v.headers)){const{name:d,value:y,...k}=parseString(b,{decodeValues:false}),T=k.path??(h.pathname.split("/").slice(0,-1).join("/")||"/");a(d,y,{path:T,encode:q=>q,...k});}return v}})};return (i,c)=>{const f=o$1(i,c);return f.catch(Le),f}}function yt(e,t,r){return e instanceof Request?e:new Request(typeof e=="string"?new URL(e,r):e,t)}async function ps(e,t,r,s){if(e.signal){if(e.signal.aborted)throw new DOMException("The operation was aborted.","AbortError");let n=Le;const a=new Promise((i,c)=>{const f=()=>{c(new DOMException("The operation was aborted.","AbortError"));};e.signal.addEventListener("abort",f,{once:true}),n=()=>e.signal.removeEventListener("abort",f);}),o=await Promise.race([Fe(e,t,r,{...s,depth:s.depth+1}),a]);return n(),o}else return await Fe(e,t,r,{...s,depth:s.depth+1})}let Ue,Ce,Se;function _s(e){const t=e.url.endsWith(".script.js"),r=i;return Ue??=uneval(r),Ce??=`W/${Date.now()}`,Se??=new Headers({"content-type":"application/javascript; charset=utf-8",etag:Ce}),e.headers.get("if-none-match")===Ce?new Response(void 0,{status:304,headers:Se}):t?new Response(`globalThis.__sveltekit_sw={env:${Ue}}`,{headers:Se}):new Response(`export const env=${Ue}`,{headers:Se})}const gt=({html:e})=>e,wt=()=>false,bt=({type:e})=>e==="js"||e==="css",ms=new Set(["GET","HEAD","POST"]),ys=new Set(["GET","HEAD","OPTIONS"]),Fe=bs(gs);async function gs(e$1,t,r,s){const n=new URL(e$1.url),a=Sr(n.pathname),o=Er(n.pathname),i=as(n);{const d=e$1.headers.get("origin");if(i){if(e$1.method!=="GET"&&d!==n.origin)return json({message:"Cross-site remote requests are forbidden"},{status:403})}else if(t.csrf_check_origin&&et(e$1)&&(e$1.method==="POST"||e$1.method==="PUT"||e$1.method==="PATCH"||e$1.method==="DELETE")&&d!==n.origin&&(!d||!t.csrf_trusted_origins.includes(d))){const k=`Cross-site ${e$1.method} form submissions are forbidden`,T={status:403};return e$1.headers.get("accept")==="application/json"?json({message:k},T):text(k,T)}}if(t.hash_routing&&n.pathname!==e+"/"&&n.pathname!=="/[fallback]")return text("Not found",{status:404});let c;a?n.pathname=jr(n.pathname):o?(n.pathname=Rr(n.pathname)+(n.searchParams.get(Ne)==="1"?"/":"")||"/",n.searchParams.delete(Ne),c=n.searchParams.get(qe)?.split("").map(d=>d==="1"),n.searchParams.delete(qe)):i&&(n.pathname=e$1.headers.get("x-sveltekit-pathname")??e,n.search=e$1.headers.get("x-sveltekit-search")??"");const f={},{cookies:u,new_cookies:_,get_cookie_header:m,set_internal:g,set_trailing_slash:l}=fs(e$1,n),h={prerendering:s.prerendering,transport:t.hooks.transport,handleValidationError:t.hooks.handleValidationError,tracing:{record_span:Q},remote:{data:null,forms:null,refreshes:null,requested:null,reconnects:null,batches:null,live_iterators:null},is_in_remote_function:false,is_in_render:false,is_in_universal_load:false},p={cookies:u,fetch:null,getClientAddress:s.getClientAddress||(()=>{throw new Error("@sveltejs/adapter-node does not specify getClientAddress. Please raise an issue")}),locals:{},params:{},platform:s.platform,request:e$1,route:{id:null},setHeaders:d=>{for(const y in d){const k=y.toLowerCase(),T=d[y];if(k==="set-cookie")throw new Error("Use `event.cookies.set(name, value, options)` instead of `event.setHeaders` to set cookies");if(k in f)if(k==="server-timing")f[k]+=", "+T;else throw new Error(`"${y}" header is already set`);else f[k]=T,s.prerendering&&k==="cache-control"&&(s.prerendering.cache=T);}},url:n,isDataRequest:o,isSubRequest:s.depth>0,isRemoteRequest:!!i};p.fetch=hs({event:p,options:t,manifest:r,state:s,get_cookie_header:m,set_internal:g}),s.emulator?.platform&&(p.platform=await s.emulator.platform({config:{},prerender:!!s.prerendering?.fallback}));let w=n.pathname;if(!i){const d=s.prerendering?.inside_reroute;try{s.prerendering&&(s.prerendering.inside_reroute=!0),w=await t.hooks.reroute({url:new URL(n),fetch:p.fetch})??n.pathname;}catch{return text("Internal Server Error",{status:500})}finally{s.prerendering&&(s.prerendering.inside_reroute=d);}}let $={transformPageChunk:gt,filterSerializedResponseHeaders:wt,preload:bt},S="never",E;try{w=U$1(w);}catch{return w=null,await v()}if(w!==U$1(n.pathname)&&!s.prerendering?.fallback&&at(r,w)){const d=new URL(e$1.url);d.pathname=o?Be(w):a?Nt(w):w;try{const y=await fetch(d,e$1),k=new Headers(y.headers);return k.has("content-encoding")&&(k.delete("content-encoding"),k.delete("content-length")),new Response(y.body,{headers:k,status:y.status,statusText:y.statusText})}catch(y){return await nt(p,h,t,y)}}let x=null;if(e&&!s.prerendering?.fallback){if(!w.startsWith(e))return text("Not found",{status:404});w=w.slice(e.length)||"/";}if(a)return Yr(w,new URL(e$1.url),r);if(w===`/${i$1}/env.js`||w===`/${i$1}/env.script.js`)return _s(e$1);if(!i&&w.startsWith(`/${i$1}`)){const d=new Headers;return d.set("cache-control","public, max-age=0, must-revalidate"),text("Not found",{status:404,headers:d})}if(!s.prerendering?.fallback){const d=await r._.matchers(),y=Ut(w,r._.routes,d);y&&(x=y.route,p.route={id:x.id},p.params=y.params);}try{if(E=x?.page?new Qe(await ws(x.page,r)):void 0,x&&!i){if(n.pathname===e||n.pathname===e+"/"?S="always":E?S=E.trailing_slash():x.endpoint&&(S=(await x.endpoint()).trailingSlash??"never"),!o){const d=R(n.pathname,S);if(d!==n.pathname&&!s.prerendering?.fallback)return new Response(void 0,{status:308,headers:{"x-sveltekit-normalize":"1",location:(d.startsWith("//")?n.origin+d:d)+(n.search==="?"?"":n.search)}})}if(s.before_handle||s.emulator?.platform){let d={},y=!1;if(x.endpoint){const k=await x.endpoint();d=k.config??d,y=k.prerender??y;}else E&&(d=E.get_config()??d,y=E.prerender());if(s.emulator?.platform&&(p.platform=await s.emulator.platform({config:d,prerender:y})),s.before_handle)return await s.before_handle(p,d,y,v)}}return await v()}catch(d){if(d instanceof Redirect)try{const y=o||i?De(d):x?.page&&Lt(p)?It(d):st(d.status,d.location);return mt(y.headers,_.values()),y}catch(y){return await nt(p,h,t,y)}return await nt(p,h,t,d)}async function v(){l(S),s.prerendering&&!s.prerendering.fallback&&!s.prerendering.inside_reroute&&T$1(n);const d=await Q({name:"sveltekit.handle.root",attributes:{"http.route":p.route.id||"unknown","http.method":p.request.method,"http.url":p.url.href,"sveltekit.is_sub_request":p.isSubRequest},fn:async y=>{const k={...p,tracing:{enabled:false,root:y,current:y}};return await with_request_store({event:k,state:h},()=>t.hooks.handle({event:k,resolve:(T,q)=>Q({name:"sveltekit.resolve",attributes:{"http.route":T.route.id||"unknown"},fn:A=>with_request_store(null,()=>b(merge_tracing(T,A),E,q).then(P=>{for(const G in f){const J=f[G];P.headers.set(G,J);}return mt(P.headers,_.values()),s.prerendering&&T.route.id!==null&&P.headers.set("x-sveltekit-routeid",encodeURI(T.route.id)),A.setAttributes({"http.response.status_code":P.status,"http.response.body.size":P.headers.get("content-length")||"unknown"}),P}))})}))}});if(d.status===200&&d.headers.has("etag")){let y=e$1.headers.get("if-none-match");y?.startsWith('W/"')&&(y=y.substring(2));const k=d.headers.get("etag");if(y===k){const T=new Headers({etag:k});for(const q of ["cache-control","content-location","date","expires","vary"]){const A=d.headers.get(q);A&&T.set(q,A);}for(const q of Xe$1(d.headers))T.append("set-cookie",q);return new Response(void 0,{status:304,headers:T})}}if(o&&d.status>=300&&d.status<=308){const y=d.headers.get("location");if(y)return De(new Redirect(d.status,y))}return d}async function b(d,y,k){try{if(k&&($={transformPageChunk:k.transformPageChunk||gt,filterSerializedResponseHeaders:k.filterSerializedResponseHeaders||wt,preload:k.preload||bt}),w===null)return await Me({event:d,event_state:h,options:t,manifest:r,state:s,status:400,error:new SvelteKitError(400,"Malformed URI",`Failed to decode URI: ${d.url.pathname}`),resolve_opts:$});if(t.hash_routing||s.prerendering?.fallback)return await me({event:d,event_state:h,options:t,manifest:r,state:s,page_config:{ssr:!1,csr:!0},status:200,error:null,branch:[{node:await r._.nodes[0](),data:null,server_data:null}],fetched:[],resolve_opts:$,data_serializer:_e(d,h,t)});if(i)return await ts(d,h,t,r,i);if(x){const q=d.request.method;let A;if(o)A=await ls(d,h,x,t,r,s,c,S);else if(x.endpoint&&(!x.page||zr(d)))A=await Pr(d,h,await x.endpoint(),s);else if(x.page)if(y)if(ms.has(q))A=await cs(d,h,x.page,t,r,s,y,$);else {const P=new Set(ys);if((await r._.nodes[x.page.leaf]())?.server?.actions&&P.add("POST"),q==="OPTIONS")A=new Response(null,{status:204,headers:{allow:Array.from(P.values()).join(", ")}});else {const J=[...P].reduce((V,te)=>(V[te]=!0,V),{});A=tt(J,q);}}else throw new Error("page_nodes not found. This should never happen");else throw new Error("Route is neither page nor endpoint. This should never happen");if(e$1.method==="GET"&&x.page&&x.endpoint){const P=A.headers.get("vary")?.split(",")?.map(G=>G.trim().toLowerCase());P?.includes("accept")||P?.includes("*")||(A=new Response(A.body,{status:A.status,statusText:A.statusText,headers:new Headers(A.headers)}),A.headers.append("Vary","Accept"));}return A}if(s.error&&d.isSubRequest){const q=new Headers(e$1.headers);return q.set("x-sveltekit-error","true"),await fetch(e$1,{headers:q})}if(s.error)return text("Internal Server Error",{status:500});if(s.depth===0)return await Me({event:d,event_state:h,options:t,manifest:r,state:s,status:404,error:new SvelteKitError(404,"Not Found",`Not found: ${d.url.pathname}`),resolve_opts:$});if(s.prerendering)return text("not found",{status:404});const T=await fetch(e$1);return new Response(T.body,T)}catch(T){return await nt(d,h,t,T)}finally{d.cookies.set=()=>{throw new Error("Cannot use `cookies.set(...)` after the response has been generated")},d.setHeaders=()=>{throw new Error("Cannot use `setHeaders(...)` after the response has been generated")};}}}function ws(e,t){return Promise.all([...e.layouts.map(r=>r==null?r:t._.nodes[r]()),t._.nodes[e.leaf]()])}function bs(e){return async(t,...r)=>e(t,...r)}function kt(e,t,r){return Object.fromEntries(Object.entries(e).filter(([s])=>s.startsWith(t)&&(r===""||!s.startsWith(r))))}let ks,$t=null;class Us{#e;#t;constructor(t){if(this.#e=_,this.#t=t,Or){const r=this.respond.bind(this);this.respond=async(...s)=>{const{promise:n,resolve:a}=Ht(),o=$t;return $t=n,await o,r(...s).finally(a)};}}async init({env:t,read:r}){const{env_public_prefix:s,env_private_prefix:n}=this.#e;p(kt(t,n,s)),f(kt(t,s,n)),r&&h(o=>{const i=r(o);return i instanceof ReadableStream?i:new ReadableStream({async start(c){try{const f=await Promise.resolve(i);if(!f){c.close();return}const u=f.getReader();for(;;){const{done:_,value:m}=await u.read();if(_)break;c.enqueue(m);}c.close();}catch(f){c.error(f);}}})}),await(ks??=(async()=>{try{const a=await v();this.#e.hooks={handle:a.handle||(({event:o,resolve:i})=>i(o)),handleError:a.handleError||(({status:o,error:i,event:c})=>{const f=ct(o,i,c);console.error(f);}),handleFetch:a.handleFetch||(({request:o,fetch:i})=>i(o)),handleValidationError:a.handleValidationError||(({issues:o})=>(console.error("Remote function schema validation failed:",o),{message:"Bad Request"})),reroute:a.reroute||Le,transport:a.transport||{}},a.transport&&Object.fromEntries(Object.entries(a.transport).map(([o,i])=>[o,i.decode])),a.init&&await a.init();}catch(a){throw a}})());}async respond(t,r){return Fe(t,this.#e,this.#t,{...r,error:false,depth:0})}}

export { Us as Server };
//# sourceMappingURL=index.js.map
