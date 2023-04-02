import { PbBotInfo_Type } from '../../../../lib/ptp/protobuf/PTPCommon/types';
import { Msg } from './index';
import Logger from '../../utils/Logger';
import UserMsg from '../UserMsg';
import BotWorker from './BotWorker';
import { BotWorkerResult } from '../../../../types';
import { AnswerCallbackButtonReq_Type } from '../../../../lib/ptp/protobuf/PTPMsg/types';
import { ENV } from '../../../env';

export default class {
	private user_id: string;
	private chatId: string;
	private botId: string;
	private msgSendByUser?: Msg;
	private msgModelBotReply: Msg;
	private botInfo: PbBotInfo_Type;
	private answerCallbackButtonReq: AnswerCallbackButtonReq_Type | undefined;
	constructor(
		user_id: string,
		chatId: string,
		botInfo: PbBotInfo_Type,
		answerCallbackButtonReq?: AnswerCallbackButtonReq_Type,
		msgSendByUser?: Msg
	) {
		this.user_id = user_id;
		this.msgSendByUser = msgSendByUser;
		this.chatId = chatId;
		this.botId = botInfo.botId;
		this.answerCallbackButtonReq = answerCallbackButtonReq;
		this.botInfo = botInfo;
		this.msgModelBotReply = new Msg();
		this.msgModelBotReply.init(user_id, chatId, true, chatId);
	}
	async process() {
		const { user_id, msgSendByUser, msgModelBotReply, botInfo } = this;
		try {
			const msg = msgSendByUser?.getMsg();

			let res: BotWorkerResult;
			if (ENV.BOT_WORKER_API) {
				const resp: Response = await fetch(`${ENV.BOT_WORKER_API}/bot`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${ENV.WAI_WORKER_API_TOKEN}`,
					},
					body: JSON.stringify({
						botInfo,
						user_id,
						answerCallbackButtonReq: this.answerCallbackButtonReq,
						msg,
					}),
				});
				res = await resp.json();
			} else {
				// @ts-ignore
				res = await new BotWorker({
					botInfo,
					user_id,
					answerCallbackButtonReq: this.answerCallbackButtonReq,
					msg: msgSendByUser?.getMsg(),
				}).process();
			}

			Logger.log(res);
			let delay = 0;
			switch (res.action) {
				case 'removeBot':
					await msgModelBotReply.reply(res.action, { chatId: res.chatId });
					break;
				case 'loadChats':
				case 'createBot':
					await msgModelBotReply.reply(res.action, {});
					delay = 200;
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
			await this.reply(res, delay);
		} catch (e) {
			console.error(e);
			await msgModelBotReply.sendText('bot api invoke error');
		}
	}
	async reply(res: BotWorkerResult, delay: number = 0) {
		setTimeout(async () => {
			const { msgModelBotReply } = this;
			let msgPayload: {
				inlineButtons?: any[];
			} = {};

			if (res.inlineButtons) {
				msgPayload.inlineButtons = res.inlineButtons;
			}

			if (res.reply) {
				await msgModelBotReply.sendText(
					res.reply,
					'updateMessageSendSucceeded',
					msgPayload
				);
				await msgModelBotReply.save();
			}

			if (res.photo) {
				await msgModelBotReply.sendPhoto(
					res.photo,
					'updateMessageSendSucceeded',
					msgPayload
				);
				await msgModelBotReply.save();
			}
		}, delay);
	}
}
