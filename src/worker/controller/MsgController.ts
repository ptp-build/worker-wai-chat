import { Pdu } from '../../lib/ptp/protobuf/BaseMsg';
import Account from '../share/Account';
import {
	AnswerCallbackButtonReq,
	MsgDeleteReq,
	MsgDeleteRes,
	MsgListReq,
	MsgListRes,
	MsgUpdateReq,
	MsgUpdateRes,
	SendReq,
} from '../../lib/ptp/protobuf/PTPMsg';
import { Msg } from '../share/model/Msg';
import { User } from '../share/model/User';
import { ActionCommands } from '../../lib/ptp/protobuf/ActionCommands';
import { ERR } from '../../lib/ptp/protobuf/PTPCommon/types';
import BotMsgDispatcher from '../share/model/Msg/BotMsgDispatcher';
import UserMsg from '../share/model/UserMsg';
import Logger from '../share/utils/Logger';
import { AnswerCallbackButtonReq_Type } from '../../lib/ptp/protobuf/PTPMsg/types';

export async function msgHandler(pdu: Pdu, account: Account) {
	switch (pdu.getCommandId()) {
		case ActionCommands.CID_MsgListReq:
			const handleMsgListReq = async (pdu: Pdu) => {
				const { lastMessageId, isUp, limit, chatId } = MsgListReq.parseMsg(pdu);
				// console.log(payload)
				console.log('CID_MsgListReq', { chatId });
				const user_id = account.getUid();
				const res = {
					users: [],
					chats: [],
					repliesThreadInfos: [],
					messages: [],
				};
				if (user_id) {
					const rows = await Msg.getMsgList(user_id, chatId, lastMessageId, limit, isUp);
					rows.forEach((msg: any) => {
						// @ts-ignore
						return res.messages.push(msg.msg);
					});
				}
				account.sendPdu(
					new MsgListRes({
						err: ERR.NO_ERROR,
						payload: JSON.stringify(res),
					}).pack(),
					pdu.getSeqNum()
				);
			};
			await handleMsgListReq(pdu);
			return;
		default:
			break;
	}
	if (!account.getUid()) {
		return;
	}
	switch (pdu.getCommandId()) {
		case ActionCommands.CID_MsgUpdateReq:
			const msgUpdateReq = MsgUpdateReq.parseMsg(pdu);
			const userMsg = new UserMsg(msgUpdateReq.user_id, msgUpdateReq.chat_id);
			const rows = userMsg.getUserChatMsgIds();
			if (rows) {
				const chatMsgId = rows.get(msgUpdateReq.msg_id.toString());
				if (chatMsgId) {
					const msg = await Msg.getFromCache(
						msgUpdateReq.user_id,
						msgUpdateReq.chat_id,
						chatMsgId
					);
					if (msg) {
						msg.chatMsgId = chatMsgId;
						msg.setMsgText(msgUpdateReq.text);
						await msg.save(true, true);
					}
				}
			}
			account.sendPdu(
				new MsgUpdateRes({
					err: ERR.NO_ERROR,
				}).pack(),
				pdu.getSeqNum()
			);
			return;
		case ActionCommands.CID_MsgDeleteReq:
			const msgDeleteReq = MsgDeleteReq.parseMsg(pdu);
			await Msg.deleteMsg(msgDeleteReq.user_id, msgDeleteReq.chat_id, msgDeleteReq.msg_ids);
			account.sendPdu(
				new MsgDeleteRes({
					err: ERR.NO_ERROR,
				}).pack(),
				pdu.getSeqNum()
			);
			return;
		default:
			break;
	}
	const user_id = account.getUid()!;
	let botInfo;
	let chatId;
	let msgSendByUser: Msg | undefined;
	let answerCallbackButtonReq: AnswerCallbackButtonReq_Type | undefined;
	if (pdu.getCommandId() === ActionCommands.CID_AnswerCallbackButtonReq) {
		answerCallbackButtonReq = AnswerCallbackButtonReq.parseMsg(pdu);
		chatId = answerCallbackButtonReq.chatId;
		const chatUser = await User.getFromCache(chatId, true);
		botInfo = chatUser?.isBot() ? chatUser?.getUserInfo()!.fullInfo?.botInfo! : null;
	}
	if (pdu.getCommandId() === ActionCommands.CID_SendReq) {
		const sendReq = SendReq.parseMsg(pdu);
		const seq_num = pdu.getSeqNum();
		const { payload } = sendReq;
		const { msg } = JSON.parse(payload);
		const { id } = msg;
		chatId = msg.chatId;
		msgSendByUser = new Msg(msg);
		const chatIsNotGroupOrChannel = Msg.getChatIsNotGroupOrChannel(chatId);
		if (chatIsNotGroupOrChannel) {
			const chatUser = await User.getFromCache(chatId, true);
			botInfo = chatUser?.isBot() ? chatUser?.getUserInfo()!.fullInfo?.botInfo! : null;
		}
		msgSendByUser.init(user_id, chatId, !!botInfo, user_id);
		await msgSendByUser.send('updateMessageSendSucceeded', { localMsgId: id }, seq_num);
		await msgSendByUser.save();

		Logger.log({
			senderLastMsgId: await msgSendByUser.senderUserMsg?.getLastMsgId(),
			senderLastChatMsgId: await msgSendByUser.senderUserMsg?.getLastChatMsgId(),
			pairLastMsgId: await msgSendByUser.pairUserMsg?.getLastMsgId(),
			pairLastChatMsgId: await msgSendByUser.pairUserMsg?.getLastChatMsgId(),
			lastChatMsgId: await msgSendByUser.chatMsg?.getLastMsgId(),
			botId: botInfo?.botId,
			user_id,
			chatId,
			msgText: msgSendByUser.getMsgText(),
		});
	}

	if (botInfo && chatId && user_id) {
		await new BotMsgDispatcher(
			user_id,
			chatId,
			botInfo,
			answerCallbackButtonReq,
			msgSendByUser
		).process();
	}
}
