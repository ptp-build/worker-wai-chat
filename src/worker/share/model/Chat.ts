import { kv } from '../../env';
import { PbChat } from '../../../lib/ptp/protobuf/PTPCommon';
import { Pdu } from '../../../lib/ptp/protobuf/BaseMsg';
import { PbChat_Type } from '../../../lib/ptp/protobuf/PTPCommon/types';

export class Chat extends PbChat {
	public declare msg?: PbChat_Type;
	static chatTypePrivate = 'chatTypePrivate';
	static chatTypeSecret = 'chatTypeSecret';
	static chatTypeBasicGroup = 'chatTypeBasicGroup';
	static chatTypeSuperGroup = 'chatTypeSuperGroup';
	static chatTypeChannel = 'chatTypeChannel';

	getChatInfo() {
		return {
			isMuted: false,
			isMin: false,
			hasPrivateLink: false,
			isSignaturesShown: false,
			isVerified: false,
			isJoinToSend: true,
			isJoinRequest: true,
			isForum: false,
			isListed: true,
			settings: {
				isAutoArchived: false,
				canReportSpam: false,
				canAddContact: false,
				canBlockContact: false,
			},
			...this.msg,
		};
	}
	setChatInfo(chat: any) {
		this.msg = {
			id: chat.id,
			type: chat.type,
			accessHash: chat.accessHash || '',
			lastMessage: chat.lastMessage
				? JSON.parse(JSON.stringify(chat.lastMessage))
				: undefined,
			title: chat.title,
			usernames: chat.usernames,
			isMuted: chat.isMuted || false,
			isMin: chat.isMin || false,
			hasPrivateLink: chat.hasPrivateLink || false,
			isSignaturesShown: chat.isSignaturesShown || false,
			isVerified: chat.isVerified || false,
			isJoinToSend: chat.isJoinToSend || true,
			isJoinRequest: chat.isJoinRequest || true,
			isForum: chat.isForum || false,
			isListed: chat.isListed || true,
			settings: chat.settings || {
				isAutoArchived: false,
				canReportSpam: false,
				canAddContact: false,
				canBlockContact: false,
			},
		};
	}

	setSettings(
		isAutoArchived: boolean = false,
		canReportSpam: boolean = false,
		canAddContact: boolean = false,
		canBlockContact: boolean = false
	) {
		this.msg!.settings = {
			isAutoArchived,
			canReportSpam,
			canAddContact,
			canBlockContact,
		};
	}

	setUsernames(username: string, isActive: boolean = true, isEditable: boolean = true) {
		if (!this.msg!.usernames) {
			this.msg!.usernames = [];
		}
		this.msg!.usernames.push({
			username,
			isActive,
			isEditable,
		});
	}

	async save() {
		await kv.put(`C_${this.msg!.id}`, Buffer.from(this.pack().getPbData()).toString('hex'));
	}

	static async getFromCache(id: string, forceCache?: boolean): Promise<Chat | null> {
		let t = await kv.get(`C_${id}`, forceCache);
		if (t) {
			const u = new Chat();
			u.msg = Chat.parseMsg(new Pdu(Buffer.from(t, 'hex')));
			return u;
		} else {
			return null;
		}
	}
}
