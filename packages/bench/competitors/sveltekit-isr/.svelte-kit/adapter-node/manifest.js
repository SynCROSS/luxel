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
		client: {start:"_app/immutable/entry/start.DzIevcqG.js",app:"_app/immutable/entry/app.E3BcpVXA.js",imports:["_app/immutable/entry/start.DzIevcqG.js","_app/immutable/chunks/D6rrw3q6.js","_app/immutable/chunks/CWWpg4CV.js","_app/immutable/chunks/B-BqGbX3.js","_app/immutable/entry/app.E3BcpVXA.js","_app/immutable/chunks/CWWpg4CV.js","_app/immutable/chunks/o_8-o35E.js","_app/immutable/chunks/BV-vrcpb.js","_app/immutable/chunks/B-BqGbX3.js","_app/immutable/chunks/DZcf2p2p.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
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

export const prerendered = new Set([]);

export const base = "";