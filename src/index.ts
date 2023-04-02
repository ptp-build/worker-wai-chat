import { initEnv } from './worker/env';
import { handleEvent } from './route';
addEventListener('fetch', async event => {
	initEnv(global);
	// @ts-ignore
	event.respondWith(handleEvent(event));
});
