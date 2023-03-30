import { OpenAPIRoute, Path, Str } from '@cloudflare/itty-router-openapi';
import Account from '../share/Account';
import { PbBotInfo_Type, PbMsg_Type } from '../../lib/ptp/protobuf/PTPCommon/types';
import { Msg } from '../share/model/Msg';
import UserMsg from '../share/model/UserMsg';
import ChatMsg from '../share/model/ChatMsg';
import Logger from '../share/utils/Logger';
import { ENV, kv } from '../helpers/env';
import { User } from '../share/model/User';
import { Chat } from '../share/model/Chat';

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
		const { botInfo, msg } = await request.json();
		console.log(botInfo, msg);
		return await this.handleMsg({ botInfo, msg });
	}
	async handleMsg({ botInfo, msg }: { msg: PbMsg_Type; botInfo: PbBotInfo_Type }) {
		const { botId, description, commands } = botInfo;
		const { senderId } = msg;
		const senderMsg = new UserMsg(senderId!, botId!);
		const botMsg = new UserMsg(botId, senderId!);
		const chatMsg = new ChatMsg(botId, botId);

		const lastMsgId = await botMsg.getLastMsgId(true);
		const lastChatMsgId = await botMsg.getLastChatMsgId(lastMsgId, true);
		const msgObj = new Msg(msg);
		const msgText = msgObj.getMsgText();
		msgObj.init(botId, msg.senderId!, true, botId);
		const MSG_ID_CONTEXT = await kv.get(`MSG_ID_CONTEXT_${botId}_${senderId}`);
		Logger.log({ msg, botInfo, lastMsgId, lastChatMsgId, MSG_ID_CONTEXT });

		if (MSG_ID_CONTEXT) {
			const { msgId, command } = JSON.parse(MSG_ID_CONTEXT);
			switch (command) {
				case '/avatar':
					if (msg.content.photo) {
						await kv.delete(`MSG_ID_CONTEXT_${botId}_${senderId}`);
						console.log(msg.content.photo);
						const botUser = await User.getFromCache(botId);
						botUser?.setAvatar(
							msg.content.photo.id,
							msg.content.photo!.thumbnail!.dataUri
						);
						await botUser?.save();
						return {
							botUser: botUser?.getUserInfo(),
							reply: '恭喜修改成功',
						};
					} else {
						await kv.delete(`MSG_ID_CONTEXT_${botId}_${senderId}`);
					}
					break;
				case '/name':
					if (msg.content.text) {
						await kv.delete(`MSG_ID_CONTEXT_${botId}_${senderId}`);
						const botUser = await User.getFromCache(botId);
						botUser?.setUserInfo({
							...botUser?.getUserInfo(),
							firstName: msg.content.text.text,
						});
						await botUser?.save();
						const chat = await Chat.getFromCache(botId);
						chat?.setChatInfo({
							...chat?.getChatInfo(),
							title: msg.content.text.text,
						});
						await chat?.save();
						return {
							botUser: botUser?.getUserInfo(),
							botChat: chat?.getChatInfo(),
							reply: '恭喜修改成功',
						};
					} else {
						await kv.delete(`MSG_ID_CONTEXT_${botId}_${senderId}`);
					}
					break;
			}
		}

		switch (msgText) {
			case '/set_command':
				const commands = [
					{
						botId,
						command: 'start',
						description: '开始对话',
					},
					{
						botId,
						command: 'avatar',
						description: '设置头像',
					},
					{
						botId,
						command: 'name',
						description: '设置名称',
					},
					{
						botId,
						command: 'copy_bot',
						description: '复制机器人',
					},
					{
						botId,
						command: 'set_command',
						description: '设置',
					},
					{
						botId,
						command: 'history',
						description: '获取当前有效Prompt和对话的历史记录',
					},
					{
						botId,
						command: 'clear',
						description: '清除当前有效Prompt和对话的历史记录',
					},
					{
						botId,
						command: 'get_init_msg',
						description: '查看初始化消息',
					},
					{
						botId,
						command: 'set_init_msg',
						description: '设置初始化消息',
					},
					{
						botId,
						command: 'get_api_key',
						description: '查看API密钥',
					},
					{
						botId,
						command: 'set_api_key',
						description: '设置API密钥',
					},
					{
						botId,
						command: 'reset_config',
						description: '初始化配置',
					},
				];
				const botUser = await User.getFromCache(botId);
				botUser?.setBotInfo({
					...botInfo,
					commands: [...commands],
				});
				await botUser?.save();
				return {
					botUser: botUser?.getUserInfo(),
					reply: '设置成功.',
				};
			case '/avatar':
				await kv.put(
					`MSG_ID_CONTEXT_${botId}_${senderId}`,
					JSON.stringify({
						msgId: msg.id,
						command: '/avatar',
					})
				);
				return {
					reply: '请上传头像',
				};
			case '/name':
				await kv.put(
					`MSG_ID_CONTEXT_${botId}_${senderId}`,
					JSON.stringify({
						msgId: msg.id,
						command: '/name',
					})
				);
				return {
					reply: '请输入名称',
				};
			case '/copy_bot':
				return {
					reply: '复制成功.',
				};
			case '/start':
				return {
					reply: description,
				};
		}
		return {};
	}
}
