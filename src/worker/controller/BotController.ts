import { OpenAPIRoute } from '@cloudflare/itty-router-openapi';
import BotWorker from '../share/model/Msg/BotWorker';

export class BotController extends OpenAPIRoute {
	static schema = {
		tags: ['Bot'],
		responses: {
			'200': {
				schema: {},
			},
		},
	};
	async handle(request: Request, data: Record<string, any>) {
		const { botInfo, user_id, answerCallbackButtonReq, msg } = await request.json();
		const res = await new BotWorker({
			botInfo,
			user_id,
			answerCallbackButtonReq,
			msg,
		}).process();
		if (res) {
			return res;
		} else {
			return {};
		}
	}
}
