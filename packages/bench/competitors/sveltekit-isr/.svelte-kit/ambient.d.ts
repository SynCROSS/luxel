
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const npm_execpath: string;
	export const CHROME_CRASHPAD_PIPE_NAME: string;
	export const NODE_ENV: string;
	export const FNM_COREPACK_ENABLED: string;
	export const ALLUSERSPROFILE: string;
	export const POSH_THEMES_PATH: string;
	export const CHROME_EXECUTABLE: string;
	export const ChocolateyToolsLocation: string;
	export const APPDATA: string;
	export const ChocolateyInstall: string;
	export const ChocolateyLastPathUpdate: string;
	export const npm_config_local_prefix: string;
	export const DokanLibrary1_LibraryPath_x64: string;
	export const CommonProgramW6432: string;
	export const COLORTERM: string;
	export const CommonProgramFiles: string;
	export const GIT_ASKPASS: string;
	export const npm_package_version: string;
	export const HOMEDRIVE: string;
	export const COMPOSE_DOCKER_CLI_BUILD: string;
	export const PROCESSOR_IDENTIFIER: string;
	export const COMPUTERNAME: string;
	export const USERNAME: string;
	export const ComSpec: string;
	export const DokanLibrary2: string;
	export const npm_node_execpath: string;
	export const DokanLibrary1_LibraryPath_x86: string;
	export const DOCKER_BUILDKIT: string;
	export const DokanLibrary1: string;
	export const DokanLibrary2_LibraryPath_x64: string;
	export const LOGONSERVER: string;
	export const DokanLibrary2_LibraryPath_x86: string;
	export const DriverData: string;
	export const npm_lifecycle_script: string;
	export const EFC_2524_1592913036: string;
	export const FNM_ARCH: string;
	export const HOMEPATH: string;
	export const FNM_AUTORUN_GUARD: string;
	export const FNM_DIR: string;
	export const FNM_LOGLEVEL: string;
	export const FNM_MULTISHELL_PATH: string;
	export const FNM_NODE_DIST_MIRROR: string;
	export const FNM_RESOLVE_ENGINES: string;
	export const npm_lifecycle_event: string;
	export const FNM_VERSION_FILE_STRATEGY: string;
	export const JAVA_HOME: string;
	export const JAVA_HOME8: string;
	export const OneDrive: string;
	export const LANG: string;
	export const LOCALAPPDATA: string;
	export const NODE: string;
	export const VSCODE_GIT_IPC_HANDLE: string;
	export const npm_command: string;
	export const OS: string;
	export const npm_config_user_agent: string;
	export const npm_package_json: string;
	export const npm_package_name: string;
	export const NUMBER_OF_PROCESSORS: string;
	export const path: string;
	export const PATHEXT: string;
	export const PNPM_HOME: string;
	export const PROCESSOR_ARCHITECTURE: string;
	export const PROCESSOR_LEVEL: string;
	export const PROCESSOR_REVISION: string;
	export const ProgramData: string;
	export const VSCODE_GIT_IPC_AUTH_TOKEN: string;
	export const ProgramFiles: string;
	export const ProgramW6432: string;
	export const PROMPT: string;
	export const PSModulePath: string;
	export const PUBLIC: string;
	export const PWD: string;
	export const SESSIONNAME: string;
	export const SystemDrive: string;
	export const SystemRoot: string;
	export const TEMP: string;
	export const TERM_PROGRAM: string;
	export const TERM_PROGRAM_VERSION: string;
	export const TMP: string;
	export const USERDOMAIN: string;
	export const USERDOMAIN_ROAMINGPROFILE: string;
	export const USERPROFILE: string;
	export const VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
	export const VSCODE_GIT_ASKPASS_MAIN: string;
	export const VSCODE_GIT_ASKPASS_NODE: string;
	export const VSCODE_NONCE: string;
	export const windir: string;
	export const ZES_ENABLE_SYSMAN: string;
	export const SVELTEKIT_FORK: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		npm_execpath: string;
		CHROME_CRASHPAD_PIPE_NAME: string;
		NODE_ENV: string;
		FNM_COREPACK_ENABLED: string;
		ALLUSERSPROFILE: string;
		POSH_THEMES_PATH: string;
		CHROME_EXECUTABLE: string;
		ChocolateyToolsLocation: string;
		APPDATA: string;
		ChocolateyInstall: string;
		ChocolateyLastPathUpdate: string;
		npm_config_local_prefix: string;
		DokanLibrary1_LibraryPath_x64: string;
		CommonProgramW6432: string;
		COLORTERM: string;
		CommonProgramFiles: string;
		GIT_ASKPASS: string;
		npm_package_version: string;
		HOMEDRIVE: string;
		COMPOSE_DOCKER_CLI_BUILD: string;
		PROCESSOR_IDENTIFIER: string;
		COMPUTERNAME: string;
		USERNAME: string;
		ComSpec: string;
		DokanLibrary2: string;
		npm_node_execpath: string;
		DokanLibrary1_LibraryPath_x86: string;
		DOCKER_BUILDKIT: string;
		DokanLibrary1: string;
		DokanLibrary2_LibraryPath_x64: string;
		LOGONSERVER: string;
		DokanLibrary2_LibraryPath_x86: string;
		DriverData: string;
		npm_lifecycle_script: string;
		EFC_2524_1592913036: string;
		FNM_ARCH: string;
		HOMEPATH: string;
		FNM_AUTORUN_GUARD: string;
		FNM_DIR: string;
		FNM_LOGLEVEL: string;
		FNM_MULTISHELL_PATH: string;
		FNM_NODE_DIST_MIRROR: string;
		FNM_RESOLVE_ENGINES: string;
		npm_lifecycle_event: string;
		FNM_VERSION_FILE_STRATEGY: string;
		JAVA_HOME: string;
		JAVA_HOME8: string;
		OneDrive: string;
		LANG: string;
		LOCALAPPDATA: string;
		NODE: string;
		VSCODE_GIT_IPC_HANDLE: string;
		npm_command: string;
		OS: string;
		npm_config_user_agent: string;
		npm_package_json: string;
		npm_package_name: string;
		NUMBER_OF_PROCESSORS: string;
		path: string;
		PATHEXT: string;
		PNPM_HOME: string;
		PROCESSOR_ARCHITECTURE: string;
		PROCESSOR_LEVEL: string;
		PROCESSOR_REVISION: string;
		ProgramData: string;
		VSCODE_GIT_IPC_AUTH_TOKEN: string;
		ProgramFiles: string;
		ProgramW6432: string;
		PROMPT: string;
		PSModulePath: string;
		PUBLIC: string;
		PWD: string;
		SESSIONNAME: string;
		SystemDrive: string;
		SystemRoot: string;
		TEMP: string;
		TERM_PROGRAM: string;
		TERM_PROGRAM_VERSION: string;
		TMP: string;
		USERDOMAIN: string;
		USERDOMAIN_ROAMINGPROFILE: string;
		USERPROFILE: string;
		VSCODE_GIT_ASKPASS_EXTRA_ARGS: string;
		VSCODE_GIT_ASKPASS_MAIN: string;
		VSCODE_GIT_ASKPASS_NODE: string;
		VSCODE_NONCE: string;
		windir: string;
		ZES_ENABLE_SYSMAN: string;
		SVELTEKIT_FORK: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
