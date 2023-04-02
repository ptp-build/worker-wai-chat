import { AiChatHistory, BotWorkerResult } from '../../../../types';
import {
	PbBotInfo_Type,
	PbChatGpBotConfig_Type,
	PbCommands_Type,
	PbMsg_Type,
	PbPhoto_Type,
} from '../../../../lib/ptp/protobuf/PTPCommon/types';
import { genUserId, User } from '../User';
import UserChat from '../UserChat';
import { Chat } from '../Chat';
import { Msg } from './index';
import Logger from '../../utils/Logger';
import { ENV, kv } from '../../../env';
import { BOT_FATHER_COMMANDS, SUPER_BOT_COMMANDS } from '../../../setting';
import { AnswerCallbackButtonReq_Type } from '../../../../lib/ptp/protobuf/PTPMsg/types';
import { sendMessageToChatGPT } from '../../utils/openai';

export default class {
	private botId: string;
	private senderUserId?: string;
	private botUser?: User | null;
	private msg?: Msg;
	private user_id: string;
	private botInfo: PbBotInfo_Type;
	private answerCallbackButtonReq: AnswerCallbackButtonReq_Type | undefined;

	constructor({
		botInfo,
		user_id,
		msg,
		answerCallbackButtonReq,
	}: {
		botInfo: PbBotInfo_Type;
		user_id: string;
		msg: PbMsg_Type;
		answerCallbackButtonReq: AnswerCallbackButtonReq_Type | undefined;
	}) {
		if (msg) {
			this.msg = new Msg(msg);
			this.msg.init(user_id, botInfo.botId, true, msg.senderId);
			this.senderUserId = msg.senderId || user_id;
		}
		this.user_id = user_id;
		this.botInfo = botInfo;
		this.botId = botInfo.botId;
		this.answerCallbackButtonReq = answerCallbackButtonReq;
	}

	async process(): Promise<BotWorkerResult | undefined> {
		const { botId, msg } = this;
		Logger.log('process: msg', msg);
		Logger.log('process: answerCallbackButtonReq', this.answerCallbackButtonReq);
		this.botUser = await User.getFromCache(botId);
		const MSG_ID_CONTEXT = await this.getMsgContext();
		Logger.log('process: MSG_ID_CONTEXT', MSG_ID_CONTEXT);
		if (MSG_ID_CONTEXT) {
			const msgContextRes = await this.handleMsgContext();
			if (msgContextRes) {
				// @ts-ignore
				return msgContextRes;
			}
		}
		if (!this.msg) {
			return {};
		}
		const msgText = this.msg.getMsgText();
		if (msgText.startsWith('/')) {
			const res = await this.handleCmd();
			if (res) {
				return res;
			}
		}
		return await this.handleText(msgText);
	}
	async createBot({ name }: { name: string }, type: 'chatgpt' | 'common') {
		await this.clearMsgContext();
		const botId = await genUserId();
		const userName = `bot_${botId}`;
		const getDefaultCmd = (botId: string) => {
			return [
				{
					command: 'start',
					description: '开始会话',
				},
				{
					command: 'setting',
					description: '管理修改机器人',
				},
				{
					command: 'clearHistory',
					description: '清空历史记录',
				},
			].map(item => {
				// @ts-ignore
				item.botId = botId;
				return item;
			});
		};
		// @ts-ignore
		const cms: PbCommands_Type[] = getDefaultCmd(botId);
		const menuButton = {
			type: 'commands',
		};
		const menuButton1 = {
			type: 'webApp',
			text: 'Order Food',
			url: 'https://webappcontent.telegram.org/cafe/?mode=menu',
		};
		await User.createBot(
			botId,
			userName,
			name,
			'您好,有什么需要帮助么？',
			menuButton,
			cms,
			false
		);

		const senderUser = await User.getFromCache(this.user_id!);
		const userSetting = await senderUser?.getUserSetting();
		let myBotIds: string[] = [];
		if (userSetting) {
			myBotIds = userSetting.myBotIds || [];
		}
		if (!myBotIds.includes(botId)) {
			myBotIds.push(botId);
			await senderUser!.saveMyBot(botId);
		}

		await senderUser?.saveUserSetting({
			...userSetting,
			chatFolders: userSetting!.chatFolders!.map(item => {
				if (item.id === 1) {
					item.includedChatIds!.push(botId);
				}
				return item;
			}),
			myBotIds,
		});
		const userChat = new UserChat(this.user_id!);
		await userChat.init();
		await userChat.addUserChatIds(botId);
		await this.clearMsgContext();
		const newBotMsg = new Msg({
			chatId: '',
			content: {
				action: {
					text: '',
					type: Msg.MsgActionType.chatCreate,
				},
			},
			date: Msg.genMsgDate(),
			id: 1,
			isOutgoing: false,
			senderId: botId,
		});
		newBotMsg.init(botId, this.user_id!, true, botId);
		const userMsg = new Msg();
		userMsg.init(this.user_id, botId, true, this.user_id);

		if (type === 'chatgpt') {
			await userMsg.updateAiConfig({
				init_system_content: '',
				api_key: '',
			});
		}

		await newBotMsg.save(false, true);
		return {
			action: 'createBot',
			reply: `恭喜创建成功! ${name} ${type}`,
		};
	}
	async handleCreateBot(command: string, payload: any) {
		Logger.log('handleCreateBot', command, this.answerCallbackButtonReq?.data, payload);
		if (this.answerCallbackButtonReq?.data) {
			switch (this.answerCallbackButtonReq?.data) {
				case '/createBot/ai/chatgpt':
					return await this.createBot(payload, 'chatgpt');
				case '/createBot/common':
					return await this.createBot(payload, 'common');
				case '/createBot/ai':
					const inlineButtonsModel = [
						[
							{
								type: 'callback',
								text: 'ChatGpt',
								data: '/createBot/ai/chatgpt',
							},
						],
						[
							{
								type: 'callback',
								text: '返回 🔙',
								data: '/createBot/0',
							},
						],
					];
					return this.replyButtonMsgContext(
						'/createBot',
						'选择模型',
						{
							...payload,
						},
						inlineButtonsModel
					);
				case '/createBot/0':
					await this.clearMsgContext();
					return this.replyText('已取消');
			}
		}

		switch (command) {
			case '/createBot':
				const inlineButtons = [
					[
						{
							type: 'callback',
							text: 'AI',
							data: '/createBot/ai',
						},
					],
					[
						{
							type: 'callback',
							text: '普通',
							data: '/createBot/common',
						},
					],
					[
						{
							type: 'callback',
							text: '返回 🔙',
							data: '/createBot/0',
						},
					],
				];
				return this.replyButtonMsgContext(
					'/createBot',
					'选择类型',
					{
						name: this.msg?.getMsgText(),
					},
					inlineButtons
				);
			default:
				break;
		}
	}

	async handleMsgContext() {
		const MSG_ID_CONTEXT = await this.getMsgContext();
		const msg = this.msg!;
		const { botId, description } = this.botInfo!;
		const { command, payload } = MSG_ID_CONTEXT;
		let res;
		const { answerCallbackButtonReq } = this;
		switch (command) {
			case '/setting/avatar':
				if (answerCallbackButtonReq?.data === '/setting/avatar/0') {
					res = this.replyText('已放弃', {});
					await this.clearMsgContext();
				} else {
					if (msg.getMsgPhoto()) {
						await this.clearMsgContext();
						const botUser = await User.getFromCache(botId);
						botUser?.setAvatar(
							msg.getMsgPhoto()!.id,
							msg.getMsgPhoto()!.thumbnail!.dataUri
						);
						await botUser?.save();
						return {
							users: [botUser?.getUserInfo()],
							action: 'updateGlobal',
							reply: '恭喜修改成功',
						};
					}
				}
				break;
			case '/setting/name':
				if (answerCallbackButtonReq?.data === '/setting/name/0') {
					res = this.replyText('已放弃', {});
					await this.clearMsgContext();
				} else {
					if (msg.getMsgText()) {
						await this.clearMsgContext();
						const botUser = await User.getFromCache(botId);
						botUser?.setUserInfo({
							...botUser?.getUserInfo(),
							firstName: msg.getMsgText(),
						});
						await botUser?.save();
						const chat = await Chat.getFromCache(botId);
						chat?.setChatInfo({
							...chat?.getChatInfo(),
							title: msg.getMsgText(),
						});
						await chat?.save();
						return {
							users: [botUser?.getUserInfo()],
							chats: [chat?.getChatInfo()],
							action: 'updateGlobal',
							reply: '恭喜修改成功',
						};
					}
				}
				break;
			case '/setting/description':
				if (answerCallbackButtonReq?.data === '/setting/description/0') {
					res = this.replyText('已放弃', {});
					await this.clearMsgContext();
				} else {
					if (msg.getMsgText()) {
						await this.clearMsgContext();
						const botUser = await User.getFromCache(botId);
						botUser?.setFullInfo({
							...botUser?.getUserInfo().fullInfo,
							bio: msg.getMsgText(),
						});
						botUser?.setBotInfo({
							...this.botInfo!,
							description,
						});
						await botUser?.save();
						return {
							users: [botUser?.getUserInfo()],
							action: 'updateGlobal',
							reply: '恭喜修改成功',
						};
					}
				}
				break;
			case '/setting/remove':
				if (answerCallbackButtonReq?.data === '/setting/remove/0') {
					res = this.replyText('已放弃', {});
					await this.clearMsgContext();
				} else if (answerCallbackButtonReq?.data === '/setting/remove/1') {
					const userChat = new UserChat(this.user_id!);
					await userChat.init();
					await userChat.removeUserChatId(this.botId!);

					const senderUser = await User.getFromCache(this.user_id!);
					const userSetting = await senderUser?.getUserSetting();
					let myBotIds: string[] = [];
					if (userSetting) {
						myBotIds = userSetting.myBotIds || [];
					}
					if (myBotIds.includes(botId)) {
						myBotIds = myBotIds.filter(id => id !== botId);
					}
					await senderUser?.saveUserSetting({
						...userSetting,
						chatFolders: userSetting!.chatFolders!.map(item => {
							if (
								item.id === 1 &&
								item.includedChatIds &&
								item.includedChatIds.includes(botId)
							) {
								item.includedChatIds = item.includedChatIds!.filter(
									id => id !== botId
								);
							}
							return item;
						}),
						myBotIds,
					});

					return this.replyText('', {
						action: 'removeBot',
						chatId: botId,
					});
				}

				break;
			case '/setting':
				switch (answerCallbackButtonReq?.data) {
					case '/setting/description':
						return await this.replyMsgContext(
							'/setting/description',
							'请输入描述:',
							undefined,
							true
						);
					case '/setting/name':
						return await this.replyMsgContext(
							'/setting/name',
							'请输入名称:',
							undefined,
							true
						);
					case '/setting/avatar':
						return await this.replyMsgContext(
							'/setting/avatar',
							'请上传头像:',
							undefined,
							true
						);
					case '/setting/remove':
						return await this.replyConfirmMsgContext('/setting/remove', '点击确认删除');
					default:
						break;
				}
				await this.clearMsgContext();
				break;
			case '/clearHistory':
				await this.clearMsgContext();
				if (answerCallbackButtonReq?.data === '/clearHistory/1') {
					res = this.replyText('', {
						action: 'clearHistory',
					});
				} else {
					res = this.replyText('已放弃清除历史记录', {});
				}
				break;
			case '/createBot':
				res = await this.handleCreateBot(command, payload);
				break;
			case '/setBotFatherAvatar':
				if (answerCallbackButtonReq?.data === '/setBotFatherAvatar/1') {
					await this.clearMsgContext();
					const botUser = await User.getFromCache(ENV.USER_ID_BOT_FATHER);
					botUser?.setAvatar(
						msg.getMsgPhoto()!.id,
						msg.getMsgPhoto()!.thumbnail!.dataUri
					);
					await botUser?.save();
					return {
						users: [botUser?.getUserInfo()],
						action: 'updateGlobal',
						reply: '恭喜修改成功',
					};
				}
				if (answerCallbackButtonReq?.data === '/setBotFatherAvatar/0') {
					await this.clearMsgContext();
					res = this.replyText('已放弃', {});
				}
				break;
		}
		return res;
	}

	async clearMsgContext() {
		await kv.delete(`M_ID_CONTEXT_${this.botId}_${this.user_id!}`);
	}

	async getMsgContext() {
		const str = await kv.get(`M_ID_CONTEXT_${this.botId}_${this.user_id!}`, true);
		if (str) {
			return JSON.parse(str);
		} else {
			return null;
		}
	}

	replyText(reply: string, payload?: Record<string, any>) {
		return {
			...payload,
			reply,
		};
	}

	replyPhoto(photo: PbPhoto_Type) {
		return {
			photo: photo,
		};
	}

	async replyMsgContext(cmd: string, reply: string, payload?: any, needInlineButtons?: boolean) {
		await kv.put(
			`M_ID_CONTEXT_${this.botId!}_${this.user_id!}`,
			JSON.stringify({
				msgId: this.msg?.getMsg().id,
				command: cmd,
				botId: this.botId,
				payload,
			})
		);
		let inlineButtons;
		if (needInlineButtons) {
			inlineButtons = [
				[
					{
						type: 'callback',
						text: ' 🔙 返回',
						data: cmd + '/0',
					},
				],
			];
		}
		return this.replyText(reply, { inlineButtons });
	}

	async replyButtonMsgContext(cmd: string, reply: string, payload?: any, inlineButtons?: any[]) {
		await kv.put(
			`M_ID_CONTEXT_${this.botId!}_${this.user_id!}`,
			JSON.stringify({
				msgId: this.msg?.getMsg().id,
				command: cmd,
				payload,
			})
		);

		return this.replyText(reply, {
			inlineButtons,
		});
	}

	async replyConfirmMsgContext(cmd: string, reply: string, payload?: any) {
		await kv.put(
			`M_ID_CONTEXT_${this.botId!}_${this.user_id!}`,
			JSON.stringify({
				msgId: this.msg?.getMsg().id,
				command: cmd,
				payload,
			})
		);

		return this.replyText(reply, {
			inlineButtons: [
				[
					{
						type: 'callback',
						text: '✅ 确定',
						data: cmd + '/1',
					},
					{
						type: 'callback',
						text: '🔙 放弃',
						data: cmd + '/0',
					},
				],
			],
		});
	}

	async handleText(msgText: string) {
		if (msgText.startsWith(`"photo":`)) {
			try {
				return this.replyPhoto(JSON.parse(msgText.replace(`"photo":`, '')));
			} catch (e) {
				console.error(e);
			}
		}
		const aiConfig = await this.msg?.getAiConfig();
		if (aiConfig && Object.keys(aiConfig!).length > 0) {
			return await this.handleAiText(msgText, aiConfig!);
		}
		return {};
	}

	async handleAiText(askText: string, aiConfig: PbChatGpBotConfig_Type) {
		Logger.log(askText, aiConfig);

		// const config = await msgSendByUser.getAiConfig();
		// const msg = await Msg.getFromCache(this.user_id, this.chatId, msgSendByUser.msg?.id! - 2);
		// console.log(msg?.getMsgText());
		// switch (msg?.getMsgText()) {
		// 	case '/set_init_msg':
		// 		config!.init_system_content = askText;
		// 		await msgSendByUser.updateAiConfig(config);
		// 		await msgModelBotReply.sendText(
		// 			`当初始化信息已更新为:${config!.init_system_content}`
		// 		);
		// 		break;
		// 	case '/set_api_key':
		// 		config!.api_key = askText;
		// 		await msgSendByUser.updateAiConfig(config);
		// 		await msgModelBotReply.sendText(`当api_key已更新为:${config!.api_key}`);
		// 		break;
		// 	case '/clear':
		// 		if (askText.toLowerCase() === 'yes') {
		// 			await msgSendByUser.clearAiMsgHistory();
		// 			await msgModelBotReply.sendText(`已为您清空！`);
		// 		}
		// 		break;
		// 	default:
		// 		await this.askChatGpt(askText);
		// 		break;
		// }
		const msgSendByUser = this.msg!;
		const config = await msgSendByUser.getAiConfig();
		const init_history: AiChatHistory[] = msgSendByUser.getChatGptInitMsg(config);

		const history = await msgSendByUser.getAiMsgHistory();
		console.log(msgSendByUser.getMsgText());

		let [error, reply] = await sendMessageToChatGPT(
			askText,
			[...init_history, ...history],
			aiConfig.api_key || ENV.OPENAI_API_KEY,
			{}
		);
		if (!error) {
			reply = reply.replace('```html', '```');
			console.log(reply);
			return {
				reply,
			};
		} else {
			return {
				reply: 'error invoke api',
			};
		}
	}

	async handleCmd() {
		const { botInfo } = this;
		const { botId, description, commands } = this.botInfo!;
		const commandsList = commands ? commands?.map(cmd => '/' + cmd.command) : [];

		const msgText = this.msg!.getMsgText();
		Logger.log(botId, botId, msgText);
		if (commandsList.includes(msgText) || botId === ENV.USER_ID_SUPER_ADMIN) {
			switch (msgText) {
				case '/setBotFatherAvatar':
					return await this.replyMsgContext(
						'/setBotFatherAvatar',
						'请上传头像:',
						undefined,
						true
					);
				case '/setBotFatherCmd':
					if (botId === ENV.USER_ID_SUPER_ADMIN) {
						const commands = BOT_FATHER_COMMANDS.map(c => {
							return { ...c, botId: ENV.USER_ID_BOT_FATHER };
						});
						const botUser = await User.getFromCache(ENV.USER_ID_BOT_FATHER);
						botUser?.setBotInfo({
							...botUser?.getBotInfo()!,
							commands: [...commands],
						});
						await botUser?.save();
						return this.replyText('设置成功', {
							action: 'updateGlobal',
							users: [botUser?.getUserInfo()],
						});
					}
					break;
				case '/superAdmin':
					if (botId === ENV.USER_ID_SUPER_ADMIN) {
						const commands = SUPER_BOT_COMMANDS.map(c => {
							return { ...c, botId };
						});
						const botUser = await User.getFromCache(botId);
						botUser?.setBotInfo({
							...botInfo!,
							commands: [...commands],
						});
						await botUser?.save();
						return this.replyText('[superAdmin] 设置成功', {
							action: 'updateGlobal',
							users: [botUser?.getUserInfo()],
						});
					}
					break;
				case '/setting':
					const user = await User.getFromCache(this.user_id);
					let inlineButtons;
					if (user?.checkMyBot(this.botId)) {
						inlineButtons = [
							[
								{
									type: 'callback',
									text: '修改名称',
									data: '/setting/name',
								},
								{
									type: 'callback',
									text: '修改头像',
									data: '/setting/avatar',
								},
							],
							[
								{
									type: 'callback',
									text: '删除机器人',
									data: '/setting/remove',
								},
							],
							[
								{
									type: 'callback',
									text: '返回 🔙',
									data: '/setting/back',
								},
							],
						];
					} else {
						inlineButtons = [
							[
								{
									type: 'callback',
									text: '取消机器人',
									data: 'setting/remove',
								},
							],
							[
								{
									type: 'callback',
									text: '返回 🔙',
									data: 'setting/back',
								},
							],
						];
					}

					return await this.replyButtonMsgContext(
						'/setting',
						'settings:',
						undefined,
						inlineButtons
					);
				case '/createBot':
					return await this.replyMsgContext(
						'/createBot',
						'请输入机器人名称:',
						undefined,
						false
					);
				case '/clearHistory':
					return await this.replyConfirmMsgContext(
						'/clearHistory',
						'请点击 确定 清除历史记录.'
					);
				case '/start':
					await this.clearMsgContext();
					return this.replyText(
						description! || this.botUser!.getUserInfo()!.fullInfo!.bio!
					);
			}
		}
	}
}
