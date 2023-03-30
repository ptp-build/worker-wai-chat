import { OpenAPIRoute } from '@cloudflare/itty-router-openapi';
import {
	PbBotInfo_Type,
	PbCommands_Type,
	PbMsg_Type,
} from '../../lib/ptp/protobuf/PTPCommon/types';
import { Msg } from '../share/model/Msg';
import UserMsg from '../share/model/UserMsg';
import ChatMsg from '../share/model/ChatMsg';
import Logger from '../share/utils/Logger';
import { ENV, kv } from '../helpers/env';
import { User } from '../share/model/User';
import { Chat } from '../share/model/Chat';
import { SUPER_BOT_COMMANDS } from '../../setting';
import { genUserId } from './AuthController';
import UserChat from '../share/model/UserChat';

export class BotController extends OpenAPIRoute {
	static schema = {
		tags: ['Bot'],
		responses: {
			'200': {
				schema: {},
			},
		},
	};
	private user_id?: string;
	private msg?: Msg;

	private botInfo?: PbBotInfo_Type;
	private botId?: string;
	private senderUserId?: string;

	async handle(request: Request, data: Record<string, any>) {
		const { botInfo, user_id, msg } = await request.json();
		console.log(botInfo, user_id, msg);
		return await this.handleMsg({ botInfo, user_id, msg });
	}

	async handleCreateBot(command: string, payload: any) {
		const msg = this.msg!;
		console.log('handleCreateBot', payload, msg.getMsgText());
		if (msg.getMsgText()) {
			switch (command) {
				case '/createBot:name':
					const name = msg.getMsgText();
					const botId = await genUserId();
					const userName = `bot_${botId}`;
					const getDefaultCmd = (botId: string) => {
						return [
							{
								command: 'avatar',
								description: '设置头像',
							},
							{
								command: 'name',
								description: '设置名称',
							},
							{
								command: 'description',
								description: '设置描述',
							},
							{
								command: 'remove',
								description: '删除机器人',
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
					await User.createBot(
						botId,
						userName,
						name,
						'',
						{
							type: 'commands',
						},
						cms,
						false
					);

					const user = await User.getFromCache(botId);
					const senderUser = await User.getFromCache(this.senderUserId!);
					const userSetting = await senderUser?.getUserSetting();
					let myBotIds: string[] = [];
					if (userSetting) {
						myBotIds = userSetting.myBotIds || [];
					}
					if (!myBotIds.includes(botId)) {
						myBotIds.push(botId);
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
					const userChat = new UserChat(this.senderUserId!);
					await userChat.init();
					await userChat.addUserChatIds(botId);
					const chat = await Chat.getFromCache(botId);
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
					newBotMsg.init(botId, this.senderUserId!, true, botId);

					await newBotMsg.save(false, true);
					return {
						action: 'createBot',
						reply: `恭喜创建成功!`,
					};
				default:
					break;
			}
		} else {
			await this.clearMsgContext();
		}
	}

	async handleMsgContext() {
		const MSG_ID_CONTEXT = await this.getMsgContext();
		const msg = this.msg!;
		const { botId, description } = this.botInfo!;

		const { command, payload } = MSG_ID_CONTEXT;
		Logger.log('[handleMsgContext]', botId, command, payload);
		let res;
		switch (command) {
			case '/remove':
				if (this.msg?.getMsgText() === 'yes') {
					const userChat = new UserChat(this.user_id!);
					await userChat.init();
					await userChat.removeUserChatId(this.botId!);

					const senderUser = await User.getFromCache(this.senderUserId!);
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

					res = this.replyText('', {
						action: 'removeBot',
						chatId: botId,
					});
				}
				await this.clearMsgContext();
				break;
			case '/clearHistory':
				if (this.msg?.getMsgText() === 'yes') {
					res = this.replyText('', {
						action: 'clearHistory',
					});
				}
				await this.clearMsgContext();
				break;
			case '/createBot:name':
				res = await this.handleCreateBot(command, payload);
				break;
			case '/avatar':
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
				} else {
					await this.clearMsgContext();
				}
				break;
			case '/description':
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
				} else {
					await this.clearMsgContext();
				}
				break;
			case '/name':
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
				} else {
					await this.clearMsgContext();
				}
				break;
		}
		return res;
	}
	async clearMsgContext() {
		await kv.delete(`M_ID_CONTEXT_${this.botId}_${this.senderUserId!}`);
	}
	async getMsgContext() {
		const str = await kv.get(`M_ID_CONTEXT_${this.botId}_${this.senderUserId!}`, true);
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
	async replyMsgContext(cmd: string, reply: string, payload?: any) {
		await kv.put(
			`M_ID_CONTEXT_${this.botId!}_${this.senderUserId!}`,
			JSON.stringify({
				msgId: this.msg?.getMsg().id,
				command: cmd,
				payload,
			})
		);
		return this.replyText(reply);
	}
	async handleMsg({
		botInfo,
		user_id,
		msg,
	}: {
		user_id: string;
		msg: PbMsg_Type;
		botInfo: PbBotInfo_Type;
	}) {
		this.user_id = user_id;
		this.msg = new Msg(msg);
		this.botInfo = botInfo;
		const { botId, description, commands } = this.botInfo;
		this.msg.init(user_id, botId, true, msg.senderId);

		this.senderUserId = msg.senderId || user_id;
		this.botId = botId;

		const senderMsg = new UserMsg(this.senderUserId!, botId!);
		const botMsg = new UserMsg(botId, this.senderUserId!);
		const chatMsg = new ChatMsg(botId, botId);

		const lastMsgId = await botMsg.getLastMsgId(true);
		const lastChatMsgId = await botMsg.getLastChatMsgId(lastMsgId, true);
		const msgText = this.msg.getMsgText();
		const MSG_ID_CONTEXT = await this.getMsgContext();
		Logger.log({ msg, lastMsgId, lastChatMsgId, MSG_ID_CONTEXT });
		if (MSG_ID_CONTEXT) {
			const msgContextRes = await this.handleMsgContext();
			if (msgContextRes) {
				return msgContextRes;
			}
		}
		switch (msgText) {
			case '/superAdmin':
				if (botId === ENV.USER_ID_SUPER_ADMIN) {
					const commands = SUPER_BOT_COMMANDS.map(c => {
						return { ...c, botId };
					});
					const botUser = await User.getFromCache(botId);
					botUser?.setBotInfo({
						...botInfo,
						commands: [...commands],
					});
					await botUser?.save();
					return this.replyText('[superAdmin] 设置成功', {
						action: 'updateGlobal',
						users: [botUser?.getUserInfo()],
					});
				}
				break;
			case '/delete':
				return await this.replyMsgContext('/avatar', '请上传头像:');
			case '/avatar':
				return await this.replyMsgContext('/avatar', '请上传头像:');
			case '/description':
				return await this.replyMsgContext('/description', '请输入描述:');
			case '/name':
				return await this.replyMsgContext('/name', '请输入名称:');
			case '/copy_bot':
				return this.replyText('复制成功');
			case '/createBot':
				return await this.replyMsgContext('/createBot:name', '请输入机器人用户名:');
			case '/clearHistory':
				return await this.replyMsgContext(
					'/clearHistory',
					'请输入:```yes``` 继续;```no``` 放弃'
				);
			case '/remove':
				return await this.replyMsgContext('/remove', '请输入:```yes``` 继续;```no``` 放弃');
			case '/start':
				return this.replyText(description!);
		}
		return {};
	}
}
