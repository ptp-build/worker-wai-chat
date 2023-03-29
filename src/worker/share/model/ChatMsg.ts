import { kv } from '../../helpers/env';

export default class ChatMsg {
	private readonly chatId: string;
	private msgId?: number;
	static chatMsgIds: Map<string, number> = new Map();
	constructor(chatId: string, user_id: string) {
		if (chatId.startsWith('-') || chatId === user_id) {
			this.chatId = chatId.replace('-', '');
		} else {
			this.chatId =
				parseInt(chatId) > parseInt(user_id)
					? `${chatId}_${user_id}`
					: `${user_id}_${chatId}`;
		}

		this.msgId = undefined;
	}

	async init() {
		if (!ChatMsg.chatMsgIds.get(this.chatId)) {
			this.msgId = await this.getMsgIdFromKv();
			ChatMsg.chatMsgIds.set(this.chatId, this.msgId);
		} else {
			this.msgId = ChatMsg.chatMsgIds.get(this.chatId);
		}
	}

	async getMsgIdFromKv() {
		const key = `C_M_I_${this.chatId}`;
		let msgId = await kv.get(key);
		if (!msgId) {
			msgId = 0;
		}

		return parseInt(msgId);
	}

	async genMsgId() {
		await this.init();
		let msgId = await this.getMsgIdFromKv();
		msgId = msgId + 1;
		const key = `C_M_I_${this.chatId}`;
		await kv.put(key, msgId.toString());
		this.msgId = msgId;
		return msgId;
	}
	async getLastMsgId(forceCache?: boolean) {
		if (forceCache) {
			this.msgId = await this.getMsgIdFromKv();
			ChatMsg.chatMsgIds.set(this.chatId, this.msgId);
		}
		return this.msgId;
	}
}
