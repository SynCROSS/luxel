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
		client: {start:"_app/immutable/entry/start.CrzYG4RD.js",app:"_app/immutable/entry/app.DUMmRZys.js",imports:["_app/immutable/entry/start.CrzYG4RD.js","_app/immutable/chunks/CBtu0wN_.js","_app/immutable/chunks/CWWpg4CV.js","_app/immutable/chunks/B-BqGbX3.js","_app/immutable/entry/app.DUMmRZys.js","_app/immutable/chunks/CWWpg4CV.js","_app/immutable/chunks/o_8-o35E.js","_app/immutable/chunks/BV-vrcpb.js","_app/immutable/chunks/B-BqGbX3.js","_app/immutable/chunks/DZcf2p2p.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-BRcGW-_I.js')),
			__memo(() => import('./chunks/1-DaRk8eTy.js')),
			__memo(() => import('./chunks/2-Dn1Tyg9q.js'))
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
