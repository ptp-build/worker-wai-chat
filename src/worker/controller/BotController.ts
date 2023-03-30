import { OpenAPIRoute, Path, Str } from '@cloudflare/itty-router-openapi';
import Account from '../share/Account';
import { PbBotInfo_Type, PbMsg_Type } from '../../lib/ptp/protobuf/PTPCommon/types';
import { Msg } from '../share/model/Msg';
import UserMsg from '../share/model/UserMsg';
import ChatMsg from '../share/model/ChatMsg';
import Logger from '../share/utils/Logger';
import { kv } from '../helpers/env';
import { User } from '../share/model/User';

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
			if (msg.content.photo) {
				await kv.delete(`MSG_ID_CONTEXT_${botId}_${senderId}`);
				console.log(msg.content.photo);
				const botUser = await User.getFromCache(botId);
				botUser?.setAvatar(msg.content.photo.id, msg.content.photo!.thumbnail!.dataUri);
				await botUser?.save();
				return {
					botUser: botUser?.getUserInfo(),
					reply: '恭喜修改成功',
				};
			} else {
				await kv.delete(`MSG_ID_CONTEXT_${botId}_${senderId}`);
			}
		}

		switch (msgText) {
			case '/avatar':
				// const msgId = msg.id;
				// await kv.put(`MSG_ID_CONTEXT_${botId}_${senderId}`, msgId.toString());
				return {
					msg: description,
				};
			case '/start':
				const msgId = msg.id;
				await kv.put(`MSG_ID_CONTEXT_${botId}_${senderId}`, msgId.toString());
				return {
					reply: '请上传头像',
				};
			// return {
			// 	msg: description,
			// };
		}
		return {};
	}
}
