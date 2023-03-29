import { User } from '../share/model/User';
import { kv } from '../helpers/env';
import { OpenAPIRoute, Path, Str } from '@cloudflare/itty-router-openapi';
import { Chat } from '../share/model/Chat';
import Account from '../share/Account';
import UserMsg from '../share/model/UserMsg';
import { Msg } from '../share/model/Msg';
import ChatMsg from '../share/model/ChatMsg';

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

export class ChatMsgGet extends OpenAPIRoute {
	static schema = {
		tags: ['Msg'],
		parameters: {
			chatId: Path(Str, {
				description: 'Chat Id',
				default: '623415',
			}),
			userId: Path(Str, {
				description: 'User Id',
				default: '10002',
			}),
		},
		responses: {
			'200': {
				schema: {},
			},
		},
	};

	async handle(request: Request, data: Record<string, any>) {
		const { userId, chatId } = data;
		const senderMsg = new UserMsg(userId, chatId);
		const revMsg = new UserMsg(chatId, userId);
		const chatMsg = new ChatMsg(chatId, userId);

		const lastChatMsgId = await chatMsg.getLastMsgId(true);

		const senderLastMsgId = await senderMsg.getLastMsgId(true);
		const senderLastChatMsgId = await senderMsg.getLastChatMsgId(senderLastMsgId, true);
		const senderMsgIds = await senderMsg.getUserChatMsgIdsFromKv();

		const revLastMsgId = await revMsg.getLastMsgId(true);
		const revLastChatMsgId = await revMsg.getLastChatMsgId(revLastMsgId, true);
		const revMsgIds = await revMsg.getUserChatMsgIdsFromKv();

		return {
			userId,
			chatId,
			lastChatMsgId,
			senderMsgIds: Object.fromEntries(senderMsgIds),
			senderLastMsgId,
			senderLastChatMsgId,
			revLastMsgId,
			revLastChatMsgId,
			revMsgIds: Object.fromEntries(revMsgIds),
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
