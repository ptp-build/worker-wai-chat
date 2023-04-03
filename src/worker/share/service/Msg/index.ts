import { SendRes } from '../../../../lib/ptp/protobuf/PTPMsg';
import {
	ERR,
	PbChatGpBotConfig_Type,
	PbMsg_Type,
	PbPhoto_Type,
} from '../../../../lib/ptp/protobuf/PTPCommon/types';
import { ENV, kv } from '../../../env';
import {
	Pdu,
	popByteBuffer,
	readInt16,
	readInt32,
	toUint8Array,
	wrapByteBuffer,
	writeInt16,
	writeInt32,
} from '../../../../lib/ptp/protobuf/BaseMsg';
import { PbChatGpBotConfig, PbMsg } from '../../../../lib/ptp/protobuf/PTPCommon';
import { AiChatHistory, AiChatRole } from '../../../../types';
import ChatMsg from '../ChatMsg';
import UserMsg from '../UserMsg';
import Logger from '../../utils/Logger';
import Account from '../../Account';

export type MsgType =
	| 'newMessage'
	| 'updateMessageSendSucceeded'
	| 'updateMessage'
	| 'updateGlobal'
	| 'createBot'
	| 'loadChats'
	| 'removeBot'
	| 'clearHistory';

export class Msg extends PbMsg {
	static MsgActionType = {
		historyClear: 'historyClear',
		contactSignUp: 'contactSignUp',
		chatCreate: 'chatCreate',
		topicCreate: 'topicCreate',
		suggestProfilePhoto: 'suggestProfilePhoto',
		other: 'other',
	};
	public declare msg?: PbMsg_Type;
	private chatId?: string;
	private user_id?: string;
	private senderId?: string;

	private isBotChat?: boolean;
	private isSelfChat?: boolean;
	private isPairChat?: boolean;
	public hasSent?: boolean = false;
	public chatIsNotGroupOrChannel?: boolean;

	public storageKey?: string;
	public senderMsgId?: number;
	public receiverMsgId?: number;
	public chatMsgId?: number;
	public chatMsg?: ChatMsg;
	public senderUserMsg?: UserMsg;
	public pairUserMsg?: UserMsg;

	static getStorageKey(user_id: string, chatId: string) {
		const chatIsNotGroupOrChannel = !chatId.startsWith('-');
		if (chatIsNotGroupOrChannel) {
			if (parseInt(chatId) > parseInt(user_id)) {
				return `${chatId}_${user_id}`;
			} else {
				return `${user_id}_${chatId}`;
			}
		} else {
			return `${chatId.replace('-', '_')}`;
		}
	}
	static getChatIsNotGroupOrChannel(chatId: string) {
		return !chatId.startsWith('-');
	}
	init(user_id: string, chatId: string, isBotChat?: boolean, senderId?: string) {
		this.chatMsg = new ChatMsg(chatId, user_id);

		this.senderId = senderId ? senderId : this.user_id;
		this.user_id = user_id;
		this.chatId = chatId;
		this.chatIsNotGroupOrChannel = Msg.getChatIsNotGroupOrChannel(chatId);
		this.storageKey = Msg.getStorageKey(user_id, chatId);
		this.isSelfChat = user_id === chatId;
		this.isBotChat = isBotChat;
		this.isPairChat = !this.isSelfChat && this.chatIsNotGroupOrChannel;

		if (user_id === senderId) {
			this.senderUserMsg = new UserMsg(user_id, chatId!);
			if (this.isPairChat) {
				this.pairUserMsg = new UserMsg(chatId, user_id!);
			}
		} else {
			this.senderUserMsg = new UserMsg(chatId, user_id!);
			if (this.isPairChat) {
				this.pairUserMsg = new UserMsg(user_id, chatId!);
			}
		}
	}

	setMsgFromApiMessage(msg: any) {
		this.msg = {
			id: msg.id,
			chatId: msg.chatId,
			date: msg.date,
			isOutgoing: msg.isOutgoing,
			senderId: msg.senderId,
			isForwardingAllowed: msg.isForwardingAllowed,
			previousLocalId: msg.previousLocalId,
			content: {},
		};
		if (msg.content) {
			//@ts-ignore
			this.msg.content = msg.content;
		}
	}

	async reply(
		msgType: MsgType = 'newMessage',
		payload?: Record<string, any>,
		seqNum: number = 0
	) {
		Logger.debug('[reply]', msgType, payload);
		const pdu = new SendRes({
			err: ERR.NO_ERROR,
			action: msgType,
			payload: JSON.stringify({
				...payload,
			}),
		}).pack();
		await this.broadcast(pdu, seqNum);
	}
	async send(
		msgType: MsgType = 'newMessage',
		payloadOther?: Record<string, any>,
		seqNum: number = 0
	) {
		if (this.msg) {
			if (!this.msg.date) {
				this.msg.date = Msg.genMsgDate();
			}
			if (!this.chatMsgId) {
				await this.genMsgId();
			}
			this.msg!.id = this.user_id === this.senderId ? this.senderMsgId! : this.receiverMsgId!;
			this.msg.isOutgoing = this.user_id === this.senderId;
			this.msg.senderId = this.chatIsNotGroupOrChannel
				? this.msg.isOutgoing
					? this.user_id
					: this.chatId
				: this.user_id;

			this.hasSent = true;
			await this.reply(
				msgType,
				{
					msg: this.msg,
					...payloadOther,
				},
				seqNum
			);
		}
	}
	setMsgDate() {
		this.msg!.date = Msg.genMsgDate();
	}

	async sendPhoto(
		photo: PbPhoto_Type,
		msgType: MsgType = 'updateMessageSendSucceeded',
		other: Record<string, any> = {}
	) {
		if (!this.msg) {
			this.initMsg();
		}
		this.msg!.content = {
			photo,
		};
		// @ts-ignore
		this.msg = { ...this.msg, ...other };
		await this.send(msgType);
	}

	async sendVoice(
		voice: { id: string; duration: number; waveform: number[] },
		msgType: MsgType = 'updateMessageSendSucceeded',
		other: Record<string, any> = {},
		msgId?: number
	) {
		if (!this.msg) {
			this.initMsg();
		}
		if (this.msg) {
			this.msg!.content = {
				voice,
			};
			this.msg = {
				...this.msg,
				...other,
			};
			await this.send(msgType);
		}
	}
	initMsg() {
		this.msg = {
			content: {},
			date: 0,
			id: 0,
			isForwardingAllowed: false,
			isOutgoing: false,
			senderId: this.user_id,
			chatId: this.chatId!,
		};
	}
	async sendText(
		text: string,
		msgType: MsgType = 'updateMessageSendSucceeded',
		other: Record<string, any> = {}
	) {
		const entities = other.entities || undefined;
		if (!this.msg) {
			this.initMsg();
		}
		this.msg!.content = {
			text: {
				text: text,
				entities,
			},
		};
		// @ts-ignore
		this.msg = { ...this.msg, ...other };
		await this.send(msgType);
	}

	parseHeader(buf: Buffer) {
		const bb = wrapByteBuffer(buf);
		this.chatMsgId = readInt32(bb);
		this.senderMsgId = readInt32(bb);
		this.isBotChat = !!readInt16(bb);
		this.receiverMsgId = readInt32(bb);
	}

	getMsgHeader() {
		if (this.chatMsgId && this.senderMsgId) {
			const bb = popByteBuffer();
			writeInt32(bb, this.chatMsgId!);
			writeInt32(bb, this.senderMsgId!);
			writeInt16(bb, this.isBotChat ? 1 : 0);
			writeInt32(bb, this.receiverMsgId || 0);
			return Buffer.from(toUint8Array(bb));
		} else {
			throw Error('getMsgHeader error');
		}
	}

	static async getMsgList(
		user_id: string,
		chatId: string,
		lastMessageId?: number,
		limit: number = 10,
		isUp?: boolean
	) {
		const userMsg = new UserMsg(user_id, chatId);
		await userMsg.init();
		const lastMsgId = await userMsg.getLastMsgId();
		console.log('getMsgList', { chatId, lastMessageId, limit, lastMsgId, isUp });
		const rows: Msg[] = [];
		if (lastMsgId == 0) {
			return rows;
		}

		if (!lastMessageId) {
			lastMessageId = 0;
		}
		let chatMsgIds: { chatMsgId: number; msgId: number }[] = [];
		if (lastMessageId === 0) {
			chatMsgIds = userMsg.getUserChatMsgIdsByMsgId(lastMsgId + 1, limit, 'DOWN');
		} else {
			if (isUp) {
				if (lastMessageId < lastMsgId) {
					chatMsgIds = userMsg.getUserChatMsgIdsByMsgId(lastMessageId, limit, 'UP');
				}
			} else {
				if (lastMessageId > 0) {
					chatMsgIds = userMsg.getUserChatMsgIdsByMsgId(lastMessageId + 1, limit, 'DOWN');
				}
			}
		}

		if (chatMsgIds.length > 0) {
			for (let i = 0; i < chatMsgIds.length; i++) {
				const { chatMsgId, msgId } = chatMsgIds[i];
				const msgObj = await Msg.getFromCache(user_id, chatId, chatMsgId);
				if (msgObj) {
					msgObj.msg!.id = msgId;
					rows.push(msgObj);
				}
			}
		}
		return rows;
	}

	async save(isUpdate?: boolean, stripHasSent?: boolean) {
		if (!this.hasSent && !stripHasSent) {
			return;
		}
		if (!this.chatMsgId) {
			await this.genMsgId();
		}
		if (this.msg && this.storageKey && this.chatMsgId && this.senderId) {
			this.msg.id = this.chatMsgId;
			this.msg.senderId = this.senderId;
			const buf = Buffer.from(this.pack().getPbData());
			const data = Buffer.concat([this.getMsgHeader(), buf]).toString('hex');
			await kv.put(`MSG_${this.storageKey}_${this.chatMsgId}`, data);
			if (!isUpdate) {
				this.senderUserMsg?.adduserChatMsgIds(this.senderMsgId!, this.chatMsgId);
				if (this.isPairChat) {
					this.pairUserMsg?.adduserChatMsgIds(this.receiverMsgId!, this.chatMsgId);
				}
			}
		} else {
			throw Error('save msg error');
		}
	}

	static async getChatMsgIds(user_id: string, chatId: string, msg_ids: number[] | undefined) {
		const chatMsgIds = [];
		if (msg_ids && msg_ids.length > 0) {
			for (let i = 0; i < msg_ids.length; i++) {
				const msg_id = msg_ids[i];
				const chatMsgId = await kv.get(`U_C_${user_id}_${chatId}_${msg_id}`);
				chatMsgIds.push(parseInt(chatMsgId));
			}
		}
		return chatMsgIds;
	}

	static async deleteMsg(user_id: string, chatId: string, msgIds: number[] | undefined) {
		if (msgIds && msgIds.length > 0) {
			const userMsg = new UserMsg(user_id, chatId);
			const rows = userMsg.getUserChatMsgIds();
			if (rows) {
				for (let i = 0; i < msgIds.length; i++) {
					const msgId = msgIds[i];
					rows.delete(msgId.toString());
				}
			}
			userMsg.setUserChatMsgIds(rows);
			userMsg.saveUserChatMsgIdsToKv();
		}

		// const chatMsgIds = await Msg.getChatMsgIds(user_id,chatId,msgIds);
		// if(chatMsgIds && chatMsgIds.length > 0){
		//   for (let i = 0; i < chatMsgIds.length; i++) {
		//     const chatMsgId = chatMsgIds[i];
		//     const storageKey = Msg.getStorageKey(user_id,chatId)
		//     await kv.delete(`MSG_${storageKey}_${chatMsgId}`)
		//   }
		// }
	}
	static handleCacheMsg(user_id: string, chatId: string, str: string) {
		const msgObj = new Msg();
		const buf = Buffer.from(str, 'hex');
		const header = buf.subarray(0, 14);
		msgObj.parseHeader(header);
		const body = buf.subarray(14);
		const pdu = new Pdu(body);
		msgObj.msg = Msg.parseMsg(pdu);
		msgObj.init(user_id, chatId, msgObj.isBotChat, msgObj.msg?.senderId);
		return msgObj;
	}
	static async getFromCache(
		user_id: string,
		chatId: string,
		chatMsgId: number
	): Promise<Msg | null> {
		const storageKey = Msg.getStorageKey(user_id, chatId);
		const str = await kv.get(`MSG_${storageKey}_${chatMsgId}`);
		if (str) {
			return Msg.handleCacheMsg(user_id, chatId, str);
		} else {
			return null;
		}
	}
	async broadcast(pdu: Pdu, seqNum: number = 0) {
		const user_id = this.user_id!;
		if (Account.UserIdAccountIdMap[user_id]) {
			Logger.log('[Broadcast]', Account.UserIdAccountIdMap[user_id].length);
			for (let i = 0; i < Account.UserIdAccountIdMap[user_id!].length; i++) {
				const account = Account.UserIdAccountIdMap[user_id!][i];
				if (user_id === account.getUid()) {
					pdu.updateSeqNo(seqNum);
				} else {
					pdu.updateSeqNo(0);
				}
				account.sendPdu(pdu);
			}
		}
	}
	static genMsgDate() {
		return Math.ceil(+new Date() / 1000);
	}

	getMsgText() {
		if (this.msg && this.msg.content.text && this.msg.content.text.text) {
			return this.msg.content.text.text;
		} else {
			return '';
		}
	}

	getMsgPhoto() {
		if (this.msg && this.msg.content.photo) {
			return this.msg.content.photo;
		} else {
			return undefined;
		}
	}
	getLastMsgText() {
		if (this.msg && this.msg.content.text && this.msg.content.text.text) {
			return this.msg.content.text.text;
		} else {
			return '';
		}
	}
	setMsgText(text: string) {
		if (this.msg) {
			this.msg!.content!.text!.text = text;
		}
	}
	async genMsgId() {
		this.senderMsgId = await this.senderUserMsg?.genMsgId();
		if (this.isPairChat) {
			this.receiverMsgId = await this.pairUserMsg?.genMsgId();
		}
		this.chatMsgId = await this.chatMsg?.genMsgId();
	}

	static async updateAiMsg(user_id: string, chatId: string, chatMsgId: number, role: AiChatRole) {
		await kv.put(`M_A_${user_id}_${chatId}_${chatMsgId}_${role.toString()}`, '1');
	}

	async getAiMsgIds() {
		const res = await kv.list({ prefix: `M_A_${this.user_id}_${this.chatId}_` });
		const msgList = res.map((key: any) => {
			const t = key.name.split('_');
			return {
				chatMsgId: parseInt(t[4]),
				role: parseInt(t[5]),
			};
		});
		msgList.sort((a, b) => a.chatMsgId - b.chatMsgId);
		return msgList;
	}

	async updateAiConfig(config: PbChatGpBotConfig_Type) {
		await kv.put(
			`A_C_${this.user_id}_${this.chatId}`,
			Buffer.from(new PbChatGpBotConfig(config).pack().getPbData()).toString('hex')
		);
	}

	async getAiConfig() {
		const str = await kv.get(`A_C_${this.user_id}_${this.chatId}`);
		if (str) {
			return PbChatGpBotConfig.parseMsg(new Pdu(Buffer.from(str, 'hex')));
		} else {
			return {};
		}
	}

	async hasAiConfig() {
		const config = await this.getAiConfig();
		return config && config.init_system_content !== undefined;
	}
	getChatGptInitMsg(config?: PbChatGpBotConfig_Type): AiChatHistory[] {
		let content = ENV.SYSTEM_INIT_MESSAGE;
		if (config && config.init_system_content) {
			content = config.init_system_content;
		}
		return [{ role: 'system', content }];
	}

	async getAiMsgHistory(): Promise<AiChatHistory[]> {
		const history: AiChatHistory[] = [];
		const rows = await this.getAiMsgIds();
		for (let i = 0; i < rows.length; i++) {
			const { chatMsgId, role } = rows[i];
			const msg = await Msg.getFromCache(this.user_id!, this.chatId!, chatMsgId);
			history.push({
				role: role === AiChatRole.USER ? 'user' : 'assistant',
				content: msg?.getMsgText()!,
			});
		}
		return this.handleHistory(history);
	}

	async handleHistory(history: AiChatHistory[]) {
		const MAX_TOKEN_LENGTH = 2000;
		if (ENV.AUTO_TRIM_HISTORY && ENV.MAX_HISTORY_LENGTH > 0) {
			// 历史记录超出长度需要裁剪
			if (history.length > ENV.MAX_HISTORY_LENGTH) {
				history.splice(history.length - ENV.MAX_HISTORY_LENGTH + 2);
			}
			// 处理token长度问题
			let tokenLength = 0;
			for (let i = history.length - 1; i >= 0; i--) {
				const historyItem = history[i];
				let length = 0;
				if (historyItem.content) {
					length = Array.from(historyItem.content).length;
				} else {
					historyItem.content = '';
				}
				// 如果最大长度超过maxToken,裁剪history
				tokenLength += length;
				if (tokenLength > MAX_TOKEN_LENGTH) {
					history.splice(i);
					break;
				}
			}
		}
		return history;
	}

	async clearAiMsgHistory() {
		const keys = await this.getAiMsgIds();
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			await kv.delete(
				`M_A_${this.user_id}_${this.chatId}_${key.chatMsgId}_${key.role.toString()}`
			);
		}
	}

	async getInitMsg() {
		const config = await this.getAiConfig();
		return config && 'init_system_content' in config && config.init_system_content
			? config?.init_system_content
			: ENV.SYSTEM_INIT_MESSAGE;
	}

	async setInitMsg(msg: string) {
		let config = await this.getAiConfig();
		if (!config) {
			config = {};
		}
		config.init_system_content = msg;
	}
}
