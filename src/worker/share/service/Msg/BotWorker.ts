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

const maskKey = (str: string) => {
	return str.substring(0, 4) + '****' + str.substring(str.length - 4);
};

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
			if (Object.keys(msgContextRes).length > 0) {
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
	async handleAiCmd(cmd: string) {
		const config = await this.msg?.getAiConfig();
		switch (cmd) {
			case '/getMaxHistoryLength':
				return this.replyButtonMsgContext(
					'/setMaxHistoryLength',
					`每次请求最大携带历史记录数: ${
						config?.max_history_length || ENV.MAX_HISTORY_LENGTH
					} \n\n 1.无效问答不会记录请求\n`,
					undefined,
					[
						[
							{
								type: 'callback',
								text: '修改',
								data: '/setMaxHistoryLength/modify',
							},
						],
						[
							{
								type: 'callback',
								text: '返回',
								data: '/setMaxHistoryLength/0',
							},
						],
					]
				);
			case '/getInitPrompt':
				return this.replyButtonMsgContext(
					'/setInitPrompt',
					config?.init_system_content || ENV.SYSTEM_INIT_MESSAGE,
					undefined,
					[
						[
							{
								type: 'callback',
								text: '修改',
								data: '/setInitPrompt/modify',
							},
						],
						[
							{
								type: 'callback',
								text: '返回',
								data: '/setInitPrompt/0',
							},
						],
					]
				);
			case '/getOpenAiApiKey':
				return this.replyButtonMsgContext(
					'/setOpenAiApiKey',
					config?.api_key ? maskKey(config?.api_key) : '没有设置apiKey',
					undefined,
					[
						[
							{
								type: 'callback',
								text: '修改',
								data: '/setOpenAiApiKey/modify',
							},
						],
						[
							{
								type: 'callback',
								text: '返回',
								data: '/setOpenAiApiKey/0',
							},
						],
					]
				);
		}
	}
	async handleAiMsgContext(command: string, payload?: Record<string, any>) {
		const config = await this.msg?.getAiConfig();
		const msgText = this.msg?.getMsgText();

		switch (command) {
			case '/setMaxHistoryLength/confirm':
				await this.clearMsgContext();
				await this.clearMsgContext();
				if (this.answerCallbackButtonReq?.data === '/setMaxHistoryLength/confirm/0') {
					return {
						removeMessageButton: this.answerCallbackButtonReq?.messageId,
						reply: `已取消`,
					};
				} else {
					if (msgText) {
						if (isNaN(Number(msgText))) {
							config!.max_history_length = ENV.MAX_HISTORY_LENGTH;
						} else {
							config!.max_history_length = parseInt(msgText);
						}
						await this.msg!.updateAiConfig(config!);
						return {
							reply: `当前每次请求最大携带历史记录数，已更新为: ${config!
								.max_history_length!}`,
							removeMessageButton: payload!.messageId,
						};
					}
				}
				break;
			case '/setMaxHistoryLength':
				await this.clearMsgContext();
				if (this.answerCallbackButtonReq?.data === '/setMaxHistoryLength/0') {
					return {
						removeMessageButton: this.answerCallbackButtonReq?.messageId,
						reply: ``,
					};
				} else {
					if (!msgText) {
						return await this.replyButtonMsgContext(
							'/setMaxHistoryLength/confirm',
							'请回复设置 数量',
							{
								messageId: this.answerCallbackButtonReq?.messageId! + 1,
							},
							[
								[
									{
										type: 'callback',
										text: '取消修改',
										data: '/setMaxHistoryLength/confirm/0',
									},
								],
							],
							{
								removeMessageButton: this.answerCallbackButtonReq?.messageId,
							}
						);
					}
				}
				break;
			case '/setOpenAiApiKey/confirm':
				await this.clearMsgContext();
				if (this.answerCallbackButtonReq?.data === '/setOpenAiApiKey/confirm/0') {
					return {
						removeMessageButton: this.answerCallbackButtonReq?.messageId,
						reply: `已取消`,
					};
				} else {
					if (msgText) {
						config!.api_key = msgText;
						await this.msg!.updateAiConfig(config!);
						return {
							reply: `当前api_key已更新为:${maskKey(config!.api_key!)}`,
							removeMessageButton: payload!.messageId,
						};
					}
				}

				break;
			case '/setOpenAiApiKey':
				await this.clearMsgContext();
				if (this.answerCallbackButtonReq?.data === '/setOpenAiApiKey/0') {
					return {
						removeMessageButton: this.answerCallbackButtonReq?.messageId,
						reply: ``,
					};
				} else {
					if (!msgText) {
						return await this.replyButtonMsgContext(
							'/setOpenAiApiKey/confirm',
							'请回复设置 api key',
							{
								messageId: this.answerCallbackButtonReq?.messageId! + 1,
							},
							[
								[
									{
										type: 'callback',
										text: '取消修改',
										data: '/setOpenAiApiKey/confirm/0',
									},
								],
							],
							{
								removeMessageButton: this.answerCallbackButtonReq?.messageId,
							}
						);
					}
				}
				break;
			case '/setInitPrompt/confirm':
				await this.clearMsgContext();
				if (this.answerCallbackButtonReq?.data === '/setInitPrompt/confirm/0') {
					return {
						removeMessageButton: this.answerCallbackButtonReq?.messageId,
						reply: `已取消`,
					};
				} else {
					if (msgText) {
						config!.init_system_content = msgText;
						await this.msg!.updateAiConfig(config!);
						return {
							reply: `当前初始化 Prompt已更新`,
							removeMessageButton: payload!.messageId,
						};
					}
				}
				break;
			case '/setInitPrompt':
				await this.clearMsgContext();
				if (this.answerCallbackButtonReq?.data === '/setInitPrompt/0') {
					return {
						removeMessageButton: this.answerCallbackButtonReq?.messageId,
						reply: ``,
					};
				} else {
					if (!msgText) {
						return await this.replyButtonMsgContext(
							'/setInitPrompt/confirm',
							'请回复修改 上下文 Prompt',
							{
								messageId: this.answerCallbackButtonReq?.messageId! + 1,
							},
							[
								[
									{
										type: 'callback',
										text: '取消修改',
										data: '/setInitPrompt/confirm/0',
									},
								],
							],
							{
								removeMessageButton: this.answerCallbackButtonReq?.messageId,
							}
						);
					}
				}
				break;
		}
	}
	async createBot(
		{ name }: { name: string },
		aiType: 'chatgpt' | 'common'
	): Promise<BotWorkerResult> {
		await this.clearMsgContext();
		const botId = await genUserId();
		const userName = `bot_${botId}`;
		const getDefaultCmd = (botId: string) => {
			if (aiType === 'chatgpt') {
				return [
					{
						command: 'start',
						description: '开始会话',
					},
					{
						command: 'getInitPrompt',
						description: '查看 上下文 Prompt',
					},
					{
						command: 'getOpenAiApiKey',
						description: '查看 openAi ApiKey',
					},
					{
						command: 'getMaxHistoryLength',
						description: '每次请求最大携带历史记录数',
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
			} else {
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
			}
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
		await User.createBot(botId, userName, name, '我是一名机器人', menuButton, cms, false);

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

		if (aiType === 'chatgpt') {
			await userMsg.updateAiConfig({
				init_system_content: ENV.SYSTEM_INIT_MESSAGE,
				api_key: '',
			});
		}

		await newBotMsg.save(false, true);
		let reply = '';
		if (aiType === 'chatgpt') {
			reply = `模型:ChatGpt`;
		} else {
			reply = `类型:普通`;
		}
		return {
			action: 'createBot',
			reply: `恭喜创建成功!`,
			replaceMessageButton: {
				reply: reply,
				inlineButtons: [],
				messageId: this.answerCallbackButtonReq?.messageId!,
			},
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
								text: '放弃流程 🔙',
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
						inlineButtonsModel,
						{
							replaceMessageButton: {
								reply: `类型: AI`,
								inlineButtons: [],
								messageId: this.answerCallbackButtonReq?.messageId!,
							},
						}
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
							text: '放弃流程 🔙',
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
		return {
			reply: '',
		};
	}

	async handleMsgContext(): Promise<BotWorkerResult> {
		const MSG_ID_CONTEXT = await this.getMsgContext();
		const msg = this.msg!;
		const { botId, description } = this.botInfo!;
		const { command, payload } = MSG_ID_CONTEXT;
		let res: BotWorkerResult = {};
		const { answerCallbackButtonReq } = this;
		const aiRes = await this.handleAiMsgContext(command, payload);
		if (aiRes) {
			return aiRes;
		}
		switch (command) {
			case '/setting/avatar':
				if (answerCallbackButtonReq?.data === '/setting/avatar/0') {
					res = {
						reply: '已取消',
						removeMessageButton: this.answerCallbackButtonReq?.messageId,
					};
					await this.clearMsgContext();
				} else if (answerCallbackButtonReq?.data === '/setting/avatar/back') {
					res = await this.replaceButtonMsgContext(
						'/setting',
						{
							...payload,
							messageId: this.answerCallbackButtonReq?.messageId!,
						},
						{
							replaceMessageButton: {
								messageId: this.answerCallbackButtonReq?.messageId!,
								...payload.menus['/setting'],
							},
						}
					);
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
							users: [botUser?.getUserInfo()!],
							action: 'updateGlobal',
							removeMessageButton: payload.messageId,
							reply: '恭喜修改成功',
						};
					}
				}
				break;
			case '/setting/name':
				if (answerCallbackButtonReq?.data === '/setting/name/0') {
					res = {
						reply: '已取消',
						removeMessageButton: this.answerCallbackButtonReq?.messageId,
					};
					await this.clearMsgContext();
				} else if (answerCallbackButtonReq?.data === '/setting/name/back') {
					res = await this.replaceButtonMsgContext(
						'/setting',
						{
							...payload,
							messageId: this.answerCallbackButtonReq?.messageId!,
						},
						{
							replaceMessageButton: {
								messageId: this.answerCallbackButtonReq?.messageId!,
								...payload.menus['/setting'],
							},
						}
					);
				} else {
					if (msg && msg.getMsgText()) {
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
							users: [botUser?.getUserInfo()!],
							chats: [chat?.getChatInfo()!],
							action: 'updateGlobal',
							removeMessageButton: payload.messageId,
							reply: '恭喜修改成功',
						};
					}
				}
				break;
			case '/setting/remove':
				if (answerCallbackButtonReq?.data === '/setting/remove/0') {
					res = {
						reply: '已取消',
						removeMessageButton: this.answerCallbackButtonReq?.messageId,
					};
					await this.clearMsgContext();
				} else if (answerCallbackButtonReq?.data === '/setting/remove/back') {
					res = await this.replaceButtonMsgContext(
						'/setting',
						{
							...payload,
							messageId: this.answerCallbackButtonReq?.messageId!,
						},
						{
							replaceMessageButton: {
								messageId: this.answerCallbackButtonReq?.messageId!,
								...payload.menus['/setting'],
							},
						}
					);
				} else if (answerCallbackButtonReq?.data === '/setting/remove/confirm') {
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
						return await this.replaceButtonMsgContext(
							'/setting/name',
							{
								...payload,
								messageId: this.answerCallbackButtonReq?.messageId,
							},
							{
								replaceMessageButton: {
									messageId: this.answerCallbackButtonReq?.messageId!,
									...payload.menus['/setting/name'],
								},
							}
						);
					case '/setting/avatar':
						return await this.replaceButtonMsgContext(
							'/setting/avatar',
							{
								...payload,
								messageId: this.answerCallbackButtonReq?.messageId,
							},
							{
								replaceMessageButton: {
									messageId: this.answerCallbackButtonReq?.messageId!,
									...payload.menus['/setting/avatar'],
								},
							}
						);
					case '/setting/remove':
						return await this.replaceButtonMsgContext(
							'/setting/remove',
							{
								...payload,
								messageId: this.answerCallbackButtonReq?.messageId,
							},
							{
								replaceMessageButton: {
									messageId: this.answerCallbackButtonReq?.messageId!,
									...payload.menus['/setting/remove'],
								},
							}
						);
					case '/setting/0':
						await this.clearMsgContext();
						return {
							reply: '已取消',
							removeMessageButton: this.answerCallbackButtonReq?.messageId,
						};
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
					res = this.replyText('已放弃清除历史记录', {
						removeMessageButton: this.answerCallbackButtonReq?.messageId,
					});
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
						users: [botUser?.getUserInfo()!],
						action: 'updateGlobal',
						reply: '恭喜修改成功',
					};
				}
				if (answerCallbackButtonReq?.data === '/setBotFatherAvatar/0') {
					await this.clearMsgContext();
					res = {
						reply: '已放弃',
						removeMessageButton: this.answerCallbackButtonReq?.messageId,
					};
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
						text: ' 🔙 放弃流程',
						data: cmd + '/0',
					},
				],
			];
		}
		return this.replyText(reply, { inlineButtons });
	}

	async replyButtonMsgContext(
		cmd: string,
		reply: string,
		payload?: any,
		inlineButtons?: any[],
		other?: Record<string, any>
	) {
		await kv.put(
			`M_ID_CONTEXT_${this.botId!}_${this.user_id!}`,
			JSON.stringify({
				msgId: this.msg?.getMsg().id,
				command: cmd,
				payload,
			})
		);

		return this.replyText(reply, {
			...other,
			inlineButtons,
		});
	}

	async replaceButtonMsgContext(cmd: string, payload?: any, other?: Record<string, any>) {
		await kv.put(
			`M_ID_CONTEXT_${this.botId!}_${this.user_id!}`,
			JSON.stringify({
				msgId: this.msg?.getMsg().id,
				command: cmd,
				payload,
			})
		);

		return this.replyText('', {
			...other,
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
		const msgSendByUser = this.msg!;
		const config = await msgSendByUser.getAiConfig();
		const init_history: AiChatHistory[] = msgSendByUser.getChatGptInitMsg(config);

		const history = await msgSendByUser.getAiMsgHistory(
			config.max_history_length || ENV.MAX_HISTORY_LENGTH
		);
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
				aiReply: true,
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
			const res = await this.handleAiCmd(msgText);
			if (res) {
				return res;
			}
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
									text: '放弃 🔙',
									data: '/setting/0',
								},
							],
						];
					} else {
						inlineButtons = [
							[
								{
									type: 'callback',
									text: '取消机器人',
									data: '/setting/remove',
								},
							],
							[
								{
									type: 'callback',
									text: '放弃 🔙',
									data: '/setting/0',
								},
							],
						];
					}

					const menus = {
						'/setting': {
							reply: '请点击下面按钮进行修改操作:',
							inlineButtons,
						},
						'/setting/remove': {
							reply: '点击删除确认删除：',
							inlineButtons: [
								[
									{
										type: 'callback',
										text: '删除',
										data: '/setting/remove/confirm',
									},
								],
								[
									{
										type: 'callback',
										text: ' 🔙 返回',
										data: '/setting/remove/back',
									},
									{
										type: 'callback',
										text: ' 取消流程',
										data: '/setting/remove/0',
									},
								],
							],
						},
						'/setting/avatar': {
							reply: '请上传头像,点击取消，取消此流程:',
							inlineButtons: [
								[
									{
										type: 'callback',
										text: ' 🔙 返回',
										data: '/setting/avatar/back',
									},
									{
										type: 'callback',
										text: ' 取消流程',
										data: '/setting/avatar/0',
									},
								],
							],
						},
						'/setting/name': {
							reply: '请输入名称,点击取消，取消此流程:',
							inlineButtons: [
								[
									{
										type: 'callback',
										text: ' 🔙 返回',
										data: '/setting/name/back',
									},
									{
										type: 'callback',
										text: ' 取消流程',
										data: '/setting/name/0',
									},
								],
							],
						},
					};
					return await this.replyButtonMsgContext(
						'/setting',
						menus['/setting'].reply,
						{
							menus,
						},
						menus['/setting'].inlineButtons
					);
				case '/createBot':
					return await this.replyMsgContext(
						'/createBot',
						'请输入机器人名称:',
						undefined,
						true
					);
				case '/clearHistory':
					return await this.replyConfirmMsgContext(
						'/clearHistory',
						'请点击 确定 清除历史记录.'
					);
				case '/start':
					await this.clearMsgContext();
					return this.replyText(
						`${
							description! || this.botUser!.getUserInfo()!.fullInfo!.bio!
						}\n您好,有什么需要帮助么？`
					);
			}
		}
	}
}
