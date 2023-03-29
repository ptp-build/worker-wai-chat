import { kv } from '../../helpers/env';
import Logger from '../utils/Logger';

export default class UserMsg {
	private readonly user_id: string;
	public readonly user_chat_id: string;
	static userChatMsgIds: Map<string, Map<string, number>> = new Map();
	static userMsgIds: Map<string, number> = new Map();
	private msgId?: number;

	constructor(user_id: string, chatId: string) {
		this.user_id = user_id;
		this.user_chat_id = `${user_id}_${chatId}`;
	}

	async init() {
		// if (!UserMsg.userMsgIds.get(this.user_id)) {
		// 	this.msgId = await this.getMsIdFromKv();
		// 	UserMsg.userMsgIds.set(this.user_id, this.msgId);
		// } else {
		// 	this.msgId = UserMsg.userMsgIds.get(this.user_id);
		// }
		this.msgId = await this.getMsIdFromKv();
		UserMsg.userMsgIds.set(this.user_id, this.msgId);
		// let msgIds = this.getUserChatMsgIds();
		// if (!msgIds || Object.keys(Object.fromEntries(msgIds)).length === 0) {
		// 	msgIds = await this.getUserChatMsgIdsFromKv();
		// 	this.setUserChatMsgIds(msgIds);
		// }
		let msgIds = await this.getUserChatMsgIdsFromKv();
		this.setUserChatMsgIds(msgIds);
		return this;
	}

	async getMsIdFromKv() {
		const key = `U_M_I_${this.user_id}`;
		let msgId = await kv.get(key, true);
		if (!msgId) {
			msgId = 0;
		}
		return parseInt(msgId);
	}

	async genMsgId() {
		await this.init();
		let msgId = await this.getMsIdFromKv();
		msgId = msgId + 1;
		const key = `U_M_I_${this.user_id}`;
		UserMsg.userMsgIds.set(this.user_id, msgId);
		kv.put(key, msgId.toString()).catch(console.error);
		this.msgId = msgId;
		return msgId;
	}

	async getLastMsgId(forceCache?: boolean) {
		let msgIds = this.getUserChatMsgIds();
		if (forceCache) {
			const res = await this.getUserChatMsgIdsFromKv();
			this.setUserChatMsgIds(res);
			msgIds = res;
		}
		if (msgIds) {
			const rows = Array.from(msgIds.keys()).map(Number);
			rows.sort((a, b) => b - a);
			return rows[0];
		} else {
			return 0;
		}
	}

	async getLastChatMsgId(msgId?: number, forceCache?: boolean) {
		if (!msgId) {
			msgId = await this.getLastMsgId(forceCache);
		}
		let msgIds = this.getUserChatMsgIds();
		if (forceCache) {
			msgIds = await this.getUserChatMsgIdsFromKv();
			this.setUserChatMsgIds(msgIds);
		}
		return msgIds && msgIds.has(msgId.toString()) ? msgIds.get(msgId.toString()) : 0;
	}

	async saveUserChatMsgIdsToKv() {
		const msgIds = this.getUserChatMsgIds();
		if (msgIds) {
			await kv.put(`U_M_${this.user_chat_id}`, JSON.stringify(Object.fromEntries(msgIds)));
		}
	}

	async getUserChatMsgIdsFromKv() {
		const str = await kv.get(`U_M_${this.user_chat_id}`, true);
		if (str) {
			return new Map(Object.entries(JSON.parse(str)));
		} else {
			return new Map();
		}
	}

	getUserChatMsgIdsByMsgId(msgId: number, limit: number = 10, type: 'UP' | 'DOWN' = 'UP') {
		const msgIds = UserMsg.userChatMsgIds.get(this.user_chat_id);
		if (msgIds) {
			let msgIdsList: { chatMsgId: number; msgId: number }[] = [];
			msgIds.forEach((chatMsgId, msgId1) => {
				if (type === 'UP') {
					if (Number(msgId1) > msgId) {
						msgIdsList.push({ chatMsgId, msgId: Number(msgId1) });
					}
				} else {
					if (Number(msgId1) < msgId) {
						msgIdsList.push({ chatMsgId, msgId: Number(msgId1) });
					}
				}
			});

			if (type === 'UP') {
				msgIdsList.sort((a, b) => a.msgId - b.msgId);
				msgIdsList = msgIdsList.slice(0, limit);
			} else {
				msgIdsList.sort((a, b) => -a.msgId + b.msgId);
				msgIdsList = msgIdsList.slice(0, limit);
			}

			msgIdsList.sort((a, b) => a.msgId - b.msgId);
			console.log('getUserChatMsgIdsByMsgId', this.user_chat_id, msgIdsList);
			return msgIdsList;
		} else {
			return [];
		}
	}

	getUserChatMsgIds() {
		return UserMsg.userChatMsgIds.get(this.user_chat_id);
	}

	setUserChatMsgIds(msgIds?: Map<string, number>) {
		UserMsg.userChatMsgIds.set(this.user_chat_id, msgIds!);
	}

	adduserChatMsgIds(msgId: number, chatMsgId: number) {
		const msgIds = this.getUserChatMsgIds();
		if (msgIds) {
			msgIds.set(msgId.toString(), chatMsgId);
			this.setUserChatMsgIds(msgIds);
			this.saveUserChatMsgIdsToKv().catch(console.error);
		}
	}
}
