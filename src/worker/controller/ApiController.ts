import { User } from '../share/model/User';
import { kv } from '../helpers/env';
import { OpenAPIRoute, Path, Str } from '@cloudflare/itty-router-openapi';
import { Chat } from '../share/model/Chat';
import Account from '../share/Account';

export class UserGet extends OpenAPIRoute {
	static schema = {
		tags: ['User'],
		parameters: {
			userId: Path(Str, {
				description: 'User Id',
			}),
		},
		responses: {
			'200': {
				schema: {},
			},
		},
	};

	async handle(request: Request, data: Record<string, any>) {
		const { userId } = data;
		const user = await User.getFromCache(userId);
		return {
			user: user?.getUserInfo(),
		};
	}
}

export class ChatGet extends OpenAPIRoute {
	static schema = {
		tags: ['Chat'],
		parameters: {
			chatId: Path(Str, {
				description: 'Chat Id',
			}),
		},
		responses: {
			'200': {
				schema: {},
			},
		},
	};

	async handle(request: Request, data: Record<string, any>) {
		const { chatId } = data;
		const chat = await Chat.getFromCache(chatId);
		return {
			chat: chat?.getChatInfo(),
		};
	}
}

export class UserList extends OpenAPIRoute {
	static schema = {
		tags: ['User'],
		responses: {
			'200': {
				schema: {},
			},
		},
	};

	async handle(request: Request, data: Record<string, any>) {
		return {
			userIds: Account.UserIdAccountIdMap,
		};
	}
}
