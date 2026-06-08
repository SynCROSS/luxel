const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.B49e52wv.js",app:"_app/immutable/entry/app.q6AQKi9M.js",imports:["_app/immutable/entry/start.B49e52wv.js","_app/immutable/chunks/C6YlfMfr.js","_app/immutable/chunks/DtgZCYjD.js","_app/immutable/chunks/Dbgvh6Gg.js","_app/immutable/entry/app.q6AQKi9M.js","_app/immutable/chunks/DtgZCYjD.js","_app/immutable/chunks/Cbm3AjX0.js","_app/immutable/chunks/DlFdhP-i.js","_app/immutable/chunks/Dbgvh6Gg.js","_app/immutable/chunks/DtqG8Htf.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-Bmm9UyWv.js')),
			__memo(() => import('./chunks/1-CcUfrvLj.js')),
			__memo(() => import('./chunks/2-D5crKjJh.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

const prerendered = new Set([]);

const base = "";

export { base, manifest, prerendered };
//# sourceMappingURL=manifest.js.map
