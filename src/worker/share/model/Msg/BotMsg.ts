import {
	PbBotInfo_Type,
	PbChat_Type,
	PbUser_Type,
} from '../../../../lib/ptp/protobuf/PTPCommon/types';
import { ENV } from '../../../helpers/env';
import { Msg, MsgType } from './index';
import Logger from '../../utils/Logger';
import UserMsg from '../UserMsg';

export default class {
	private user_id: string;
	private chatId: string;
	private msgSendByUser: Msg;
	private msgModelBotReply: Msg;
	private botInfo: PbBotInfo_Type;
	constructor(user_id: string, chatId: string, msgSendByUser: Msg, botInfo: PbBotInfo_Type) {
		this.user_id = user_id;
		this.msgSendByUser = msgSendByUser;
		this.chatId = chatId;
		this.botInfo = botInfo;
		this.msgModelBotReply = new Msg();
		this.msgModelBotReply.init(user_id, chatId, true, chatId);
	}
	async process() {
		const { user_id, msgSendByUser, msgModelBotReply, botInfo } = this;

		try {
			const resp: Response = await fetch(`${ENV.BOT_API}/bot`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${ENV.TEST_TOKEN}`,
				},
				body: JSON.stringify({
					botInfo,
					user_id,
					msg: msgSendByUser.msg,
				}),
			});
			const res: {
				reply?: string;
				users?: PbUser_Type[];
				chats?: PbChat_Type[];
				action?: MsgType;
				chatId?: string;
			} = await resp.json();
			Logger.log(res);
			switch (res.action) {
				case 'removeBot':
					await msgModelBotReply.reply(res.action, { chatId: res.chatId });
					break;
				case 'loadChats':
				case 'createBot':
					await msgModelBotReply.reply(res.action, {});
					await msgModelBotReply.save();
					break;
				case 'clearHistory':
					const userMsg = new UserMsg(user_id, botInfo.botId);
					userMsg.clear();
					await msgModelBotReply.reply(res.action, { chatId: botInfo.botId });
					break;
				case 'updateGlobal':
					const { chats, users } = res;
					await msgModelBotReply.reply(res.action, { chats, users });
					break;
			}

			if (res.reply) {
				await msgModelBotReply.sendText(res.reply);
				await msgModelBotReply.save();
			}
		} catch (e) {
			console.error(e);
			await msgModelBotReply.sendText('bot api invoke error');
		}
	}
}
