export const manifest = (() => {
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
		client: {start:"_app/immutable/entry/start.BqIqX1aW.js",app:"_app/immutable/entry/app.Bb_PGYd2.js",imports:["_app/immutable/entry/start.BqIqX1aW.js","_app/immutable/chunks/B6KJwFhG.js","_app/immutable/chunks/DtgZCYjD.js","_app/immutable/chunks/Dbgvh6Gg.js","_app/immutable/entry/app.Bb_PGYd2.js","_app/immutable/chunks/DtgZCYjD.js","_app/immutable/chunks/Cbm3AjX0.js","_app/immutable/chunks/DlFdhP-i.js","_app/immutable/chunks/Dbgvh6Gg.js","_app/immutable/chunks/DtqG8Htf.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
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
