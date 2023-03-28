import { getCorsHeader, ResponseJson } from './worker/helpers/network';
import WsController from './worker/controller/WsController';
import ProtoController from './worker/controller/ProtoController';
import TestController from './worker/controller/TestController';
import TaskController from './worker/controller/TaskController';

import { OpenAPIRouter } from '@cloudflare/itty-router-openapi';
import { UserGet, UserList } from './worker/controller/UserController';
import { ENV } from './worker/helpers/env';

const router = OpenAPIRouter({
	schema: {
		info: {
			title: 'Worker Wai Chat',
			version: '1.0',
		},
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
				},
			},
		},
		security: [
			{
				bearerAuth: [],
			},
		],
	},
});

router.all('*', (request: Request) => {
	const { TEST_TOKEN, IS_PROD } = ENV;
	if (IS_PROD && request.url.includes('/api/')) {
		if (!TEST_TOKEN || request.headers.get('Authorization') !== `Bearer ${TEST_TOKEN}`) {
			return ResponseJson({
				err_msg: 'invalid token',
			});
		}
	}
});

router.get('/api/user/:userId', UserGet);
router.get('/api/users', UserList);

router.original.get('/', request => Response.redirect(`${request.url}docs`, 302));

// 404 for everything else
router.all('*', () => new Response('Not Found.', { status: 404 }));

export async function handleEvent(event: FetchEvent) {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method === 'OPTIONS') {
		return new Response('', {
			headers: {
				...getCorsHeader(),
			},
		});
	}
	if (url.pathname === '/ws') {
		return WsController(event);
	}

	if (url.pathname === '/proto') {
		return ProtoController.dispatch(event.request);
	}

	if (url.pathname === '/tests') {
		return TestController(event.request);
	}

	if (url.pathname === '/task') {
		return TaskController(event.request);
	}

	if (url.pathname.startsWith('/version')) {
		return ResponseJson({
			v: '1.0.1',
		});
	}
	return await router.handle(event.request);
}
