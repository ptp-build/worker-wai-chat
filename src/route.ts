import { getCorsHeader, ResponseJson } from './worker/helpers/network';
import WsController from './worker/controller/WsController';
import ProtoController from './worker/controller/ProtoController';
import TestController from './worker/controller/TestController';
import TaskController from './worker/controller/TaskController';
import { ENV } from './worker/helpers/env';

import { OpenAPIRouter } from '@cloudflare/itty-router-openapi';
import { TaskCreate, TaskDelete, TaskFetch, TaskList } from './worker/controller/tasks';

const router = OpenAPIRouter({
	schema: {
		info: {
			title: 'Worker OpenAPI Example',
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

router.get('/api/tasks/', TaskList);
router.post('/api/tasks/', TaskCreate);
router.get('/api/tasks/:taskSlug/', TaskFetch);
router.delete('/api/tasks/:taskSlug/', TaskDelete);

// Redirect root request to the /docs page
router.original.get('/', request => Response.redirect(`${request.url}docs`, 302));

// 404 for everything else
router.all('*', () => new Response('Not Found.', { status: 404 }));


export async function handleEvent(event:FetchEvent) {

	const {request} = event;
	const url = new URL(request.url);
	if(request.method === "OPTIONS"){
		return new Response("",{
			headers:{
				...getCorsHeader()
			}
		})
	}
	if(url.pathname === "/ws"){
		return WsController(event);
	}

	if(url.pathname === "/proto" ){
		return ProtoController.dispatch(event.request)
	}

	if(url.pathname === "/tests" ){
		return TestController(event.request);
	}

	if(url.pathname === "/task" ){
		return TaskController(event.request);
	}

	if(url.pathname.startsWith("/version")){
		return ResponseJson({
			v:"1.0.1",
		})
	}
	if(ENV.IS_PROD){
		return new Response("",{
			status: 302,
			headers: {
				location: `${ENV.FRONTEND_URL}`,
			},
		})
	}else {
		return await router.handle(event.request)
	}
}
