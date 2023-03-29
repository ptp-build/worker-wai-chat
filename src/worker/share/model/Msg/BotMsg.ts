import { TEXT_AI_THINKING } from '../../../../setting';
import { sendMessageToChatGPT } from '../../../helpers/openai';
import { PbBotInfo_Type } from '../../../../lib/ptp/protobuf/PTPCommon/types';
import { AiChatHistory, AiChatRole } from '../../../../types';
import { ENV } from '../../../helpers/env';
import { Msg } from './index';
import Logger from '../../utils/Logger';

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

	async askChatGpt(question: string) {
		const { msgModelBotReply, msgSendByUser } = this;
		const config = await msgSendByUser.getAiConfig();
		const init_history: AiChatHistory[] = msgSendByUser.getChatGptInitMsg(config);

		const history = await msgSendByUser.getAiMsgHistory();
		console.log(msgSendByUser.getMsgText());
		await msgModelBotReply.sendText(TEXT_AI_THINKING);
		let [error, reply] = await sendMessageToChatGPT(question, [...init_history, ...history]);
		if (!error) {
			reply = reply.replace('```html', '```');
			console.log(reply);
			await msgModelBotReply.sendText(reply, 'updateMessageSendSucceeded', {
				date: Msg.genMsgDate(),
			});
			await msgSendByUser.updateAiMsg(AiChatRole.USER);
			await msgModelBotReply.updateAiMsg(AiChatRole.ASSISTANT);
		} else {
			msgModelBotReply.hasSent = false;
		}
	}
	async processCmd() {
		const { msgModelBotReply, msgSendByUser, botInfo } = this;
		if (botInfo.botId === ENV.USER_ID_CHATGPT) {
			switch (msgSendByUser.getMsgText()) {
				case '/start':
					await this.askChatGpt('你好');
					break;
				case '/reset_config':
					await msgSendByUser.updateAiConfig({
						init_system_content: undefined,
						api_key: undefined,
					});
					const config1 = await msgSendByUser.getAiConfig();
					console.log(config1);
					await msgModelBotReply.sendText(`配置已经还原初始化`);
					break;
				case '/get_api_key':
					const config = await msgSendByUser.getAiConfig();
					if (config?.api_key) {
						await msgModelBotReply.sendText(config.api_key);
					} else {
						await msgModelBotReply.sendText(
							'您还没有设置自己的api_kay,当前api_key属于平台公用'
						);
					}
					break;
				case '/set_api_key':
					await msgModelBotReply.sendText(`好的，请回复api_key,为您设置:`);
					break;
				case '/get_init_msg':
					await msgModelBotReply.sendText(await msgSendByUser.getInitMsg());
					break;
				case '/set_init_msg':
					await msgModelBotReply.sendText(`好的，请回复初始化信息:`);
					break;
				case '/clear':
					await msgModelBotReply.sendText(`好的，输入: yes 清空记录; no: 忽略`);
					break;
				case '/history':
					const history = await msgSendByUser.getAiMsgHistory();
					await msgModelBotReply.sendText(
						`===\nHistory\n==============\n\n${history
							.map(({ role, content }) => {
								return `${role === 'user' ? '\n>' : '<'}:${content}`;
							})
							.join('\n')}`
					);
					break;
				default:
					return;
			}
		} else if (botInfo.botId === ENV.USER_ID_BOT_FATHER) {
			switch (msgSendByUser.getMsgText()) {
				case '/start':
					await msgModelBotReply.sendText(botInfo['description']!);
					break;
				default:
					return;
			}
		} else {
			switch (msgSendByUser.getMsgText()) {
				case '/start':
					await msgModelBotReply.sendText(botInfo['description']!);
					break;
				default:
					return;
			}
		}
	}
	async process() {
		try {
			const { user_id, msgSendByUser, msgModelBotReply, botInfo } = this;
			const resp: Response = await fetch(`${ENV.BOT_API}/bot`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer `,
				},
				body: JSON.stringify({
					botInfo,
					user_id,
					msg: msgSendByUser.msg,
				}),
			});
			const res: { msg: string } = await resp.json();
			console.log(res);
			if (res.msg) {
				await msgModelBotReply.sendText(res.msg);
				await msgModelBotReply.save();
			}
		} catch (e) {
			console.error(e);
		}
		//
		// const askText = msgSendByUser.getMsgText();
		// if (askText) {
		// 	if (askText.indexOf('/') === 0) {
		// 		await this.processCmd();
		// 	} else {
		// 		if (botInfo.isChatGpt) {
		// 			const config = await msgSendByUser.getAiConfig();
		// 			const msg = await Msg.getFromCache(this.user_id, this.chatId, msgSendByUser.msg?.id! - 2);
		// 			console.log(msg?.getMsgText());
		// 			switch (msg?.getMsgText()) {
		// 				case '/set_init_msg':
		// 					config!.init_system_content = askText;
		// 					await msgSendByUser.updateAiConfig(config);
		// 					await msgModelBotReply.sendText(
		// 						`当初始化信息已更新为:${config!.init_system_content}`
		// 					);
		// 					break;
		// 				case '/set_api_key':
		// 					config!.api_key = askText;
		// 					await msgSendByUser.updateAiConfig(config);
		// 					await msgModelBotReply.sendText(`当api_key已更新为:${config!.api_key}`);
		// 					break;
		// 				case '/clear':
		// 					if (askText.toLowerCase() === 'yes') {
		// 						await msgSendByUser.clearAiMsgHistory();
		// 						await msgModelBotReply.sendText(`已为您清空！`);
		// 					}
		// 					break;
		// 				default:
		// 					await this.askChatGpt(askText);
		// 					break;
		// 			}
		// 		}
		// 	}
		// 	msgModelBotReply.save().catch(console.error);
		// }
	}
}
