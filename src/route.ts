import { getCorsHeader, ResponseJson } from './worker/helpers/network';
import WsController from './worker/controller/WsController';
import ProtoController from './worker/controller/ProtoController';
import TestController from './worker/controller/TestController';
import TaskController from './worker/controller/TaskController';

import { OpenAPIRouter } from '@cloudflare/itty-router-openapi';
import { ENV } from './worker/helpers/env';
import { SWAGGER_DOC } from './setting';
import * as ApiController from './worker/controller/ApiController';
import * as BotController from './worker/controller/BotController';

const router = OpenAPIRouter(SWAGGER_DOC);

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

router.post('/api/bot', BotController.BotController);

router.get('/api/bot/public', ApiController.PublicBots);

router.get('/api/chat/:chatId', ApiController.ChatGet);
router.get('/api/LoadChatsReq', ApiController.LoadChatsReq);

router.get('/api/chatMsg/:userId/:chatId', ApiController.ChatMsgGet);
router.get('/api/user/:userId', ApiController.UserGet);
router.get('/api/users', ApiController.UserList);

router.original.get('/', request => Response.redirect(`${request.url}docs`, 302));
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
	return await router.handle(event.request);
}
