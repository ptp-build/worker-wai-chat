import { ENV, kv } from '../../helpers/env';
import { Chat } from './Chat';
import { Msg } from './Msg';
import { PbUser, PbUserSetting } from '../../../lib/ptp/protobuf/PTPCommon';
import { Pdu } from '../../../lib/ptp/protobuf/BaseMsg';
import {
	PbBotInfo_Type,
	PbChatFolder_Type,
	PbFullInfo_Type,
	PbUser_Type,
	PbUserSetting_Type,
} from '../../../lib/ptp/protobuf/PTPCommon/types';
import UserChat from './UserChat';
import UserMsg from './UserMsg';
import Logger from '../utils/Logger';
import Account from '../Account';

export class User extends PbUser {
	public declare msg?: PbUser_Type;
	static userTypeBot = 'userTypeBot';
	static userTypeRegular = 'userTypeRegular';
	static userTypeDeleted = 'userTypeDeleted';
	static userTypeUnknown = 'userTypeUnknown';
	setAvatar(id: string, thumbnail: string) {
		const photo = {
			avatarHash: id,
			photos: [
				{
					id: id,
					thumbnail: {
						dataUri: thumbnail,
						width: 640,
						height: 640,
					},
					sizes: [
						{
							width: 160,
							height: 160,
							type: 's',
						},
						{
							width: 320,
							height: 320,
							type: 'm',
						},
						{
							width: 640,
							height: 640,
							type: 'x',
						},
					],
				},
			],
		};
		this.setUserInfo({
			...this.getUserInfo(),
			...photo,
		});
		return photo;
	}
	setUserInfo(user: any) {
		this.msg = {
			id: user.id,
			accessHash: user.accessHash || '',
			avatarHash: user.avatarHash || '',
			phoneNumber: user.phoneNumber,
			type: user.type,
			firstName: user.firstName,
			lastName: user.lastName,
			canBeInvitedToGroup: user.canBeInvitedToGroup || false,
			hasVideoAvatar: user.hasVideoAvatar || false,
			isMin: user.isMin || false,
			isPremium: user.isPremium || false,
			noStatus: user.noStatus || false,
			photos: user.photos || undefined,
			fullInfo: {
				isBlocked: false,
				noVoiceMessages: false,
			},
		};
		if (user.fullInfo) {
			//@ts-ignore
			this.msg.fullInfo = { ...this.msg.fullInfo, ...user.fullInfo };
		}

		if (user.usernames) {
			//@ts-ignore
			this.msg.usernames = user.usernames;
		}
		if (user.photos) {
			//@ts-ignore
			this.msg.photos = { ...user.photos };
		}
	}

	getUserInfo() {
		const { fullInfo, ...msg } = this.msg!;
		return {
			accessHash: '',
			firstName: '',
			lastName: '',
			canBeInvitedToGroup: true,
			hasVideoAvatar: false,
			isMin: false,
			isPremium: false,
			noStatus: false,
			fullInfo: {
				isBlocked: false,
				noVoiceMessages: false,
				...fullInfo,
			},
			...msg,
		};
	}
	static getDefaultChatFolder() {
		return {
			byId: {
				'1': {
					id: 1,
					channels: false,
					title: 'Bot',
					pinnedChatIds: [],
					includedChatIds: User.getPublicBots(),
					excludedChatIds: [],
				},
			},
			orderedIds: [0, 1],
		};
	}

	async getChatFolder() {
		const res = await kv.get(`UCF_${this.msg!.id}`);
		if (res) {
			return JSON.parse(res);
		} else {
			return null;
		}
	}
	async saveUserSetting(userSetting: PbUserSetting_Type) {
		await kv.put(
			`US_${this.msg!.id}`,
			Buffer.from(new PbUserSetting(userSetting).pack().getPbData()).toString('hex')
		);
	}

	async getUserSetting() {
		const str = await kv.get(`US_${this.msg!.id}`);
		return PbUserSetting.parseMsg(new Pdu(Buffer.from(str, 'hex')));
	}
	static UserChatIds: Record<string, string[]> = {};

	static async getChatIds(user_id: string) {
		const userChat = new UserChat(user_id!);
		await userChat.init();
		return userChat.getUserChatIds();
	}

	static async getChatsByChatIds(chatIds: string[]) {
		const chats = [];
		for (let i = 0; i < chatIds.length; i++) {
			const chat = await Chat.getFromCache(chatIds[i]);
			if (chat) {
				chats.push(chat?.getChatInfo());
			}
		}
		return chats;
	}

	static async getChats(user_id?: string) {
		const chatIds = await User.getChatIds(user_id!);
		const chats = [];
		for (let i = 0; i < chatIds!.length; i++) {
			const chat = await Chat.getFromCache(chatIds![i]);
			chats.push(chat);
		}
		return chats;
	}

	setFullInfo(fullInfo: PbFullInfo_Type) {
		if (!this.msg!.fullInfo) {
			this.msg!.fullInfo = {};
		}
		this.msg!.fullInfo = {
			...this.msg?.fullInfo,
			...fullInfo,
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

	setBotInfo(botInfo: PbBotInfo_Type) {
		if (!this.msg!.fullInfo) {
			this.msg!.fullInfo = {};
		}
		this.msg!.fullInfo = {
			...this.msg!.fullInfo,
			botInfo,
		};
	}
	async save() {
		if (this.msg?.photos && !this.msg.photos.id) {
			// @ts-ignore
			this.msg.photos = this.msg.photos[0];
		} else {
			// @ts-ignore
			this.msg.photos = undefined;
		}
		await kv.put(`U_${this.msg!.id}`, Buffer.from(this.pack().getPbData()).toString('hex'));
	}

	static async getFromCache(id: string, forceCache?: boolean): Promise<User | null> {
		let t = await kv.get(`U_${id}`, forceCache);
		if (t) {
			const u = new User();
			u.msg = User.parseMsg(new Pdu(Buffer.from(t, 'hex')));
			if (u.msg.photos && u.msg.photos.id) {
				// @ts-ignore
				u.msg.photos = [u.msg.photos];
			} else {
				// @ts-ignore
				u.msg.photos = [];
			}
			return u;
		} else {
			return null;
		}
	}
	isBot() {
		return !!this.msg?.fullInfo?.botInfo;
	}
	static getPublicBots() {
		const { USER_IDS_PUBLIC, IS_PROD, USER_ID_BOT_DEV } = ENV;
		if (!IS_PROD) {
			USER_IDS_PUBLIC.push(USER_ID_BOT_DEV);
		}
		return USER_IDS_PUBLIC;
	}

	static async loadChats(user_id?: string) {
		let chatIds = User.getPublicBots();
		let userStatusesById: Record<string, any> = {};
		let chatFolders: any = User.getDefaultChatFolder();
		let chats = [];
		if (user_id) {
			const user = await User.init(user_id);
			const userSetting = await user.getUserSetting();
			userSetting.chatFolders?.forEach((item: PbChatFolder_Type) => {
				item.pinnedChatIds = [];
				item.excludedChatIds = [];
				chatFolders.byId[item.id] = item;
			});
			chatFolders.orderedIds = userSetting.chatFolderOrderedIds!;
			const chatIds1 = await User.getChatIds(user_id);
			if (!chatIds1!.includes(user_id)) {
				chatIds1!.push(user_id);
			}

			chatIds = chatIds.concat(chatIds1!);
			chats = await User.getChatsByChatIds(chatIds);
			for (let i = 0; i < chats.length; i++) {
				const chat = chats[i];
				const userMsg = new UserMsg(user_id, chat.id!);
				await userMsg.init();

				const msgId = await userMsg.getLastMsgId();
				if (msgId) {
					const chatMsgId = await userMsg.getLastChatMsgId(msgId);
					if (chatMsgId) {
						const lastMessage = await Msg.getFromCache(user_id, chat.id!, chatMsgId!);
						if (lastMessage) {
							lastMessage!.msg!.id = msgId;
							chats[i]!.lastMessage = lastMessage.msg;
						}
					}
				}
				console.log('lastMessage', msgId, chats[i]!.lastMessage);
			}
		} else {
			chats = await User.getChatsByChatIds(chatIds);
		}

		const users = [];
		for (let i = 0; i < chatIds.length; i++) {
			if (chatIds.indexOf('-') === -1) {
				const user = await User.getFromCache(chatIds[i]);
				if (user) {
					const id = user?.getUserInfo()!.id!;
					if (id === user_id) {
						user!.msg!.isSelf = true;
					}
					users.push(user?.getUserInfo());
					if (!user?.isBot()) {
						if (Account.UserIdAccountIdMap[id]) {
							userStatusesById[id] = {
								type: 'userStatusOnline',
								expires: Math.ceil(+new Date() / 1000) + 24 * 3600,
							};
						} else {
							userStatusesById[id] = {
								type: 'userStatusOffline',
							};
						}
					} else {
						userStatusesById[id] = {
							type: 'userStatusEmpty',
						};
					}
				}
			}
		}
		return {
			publicBotIds: User.getPublicBots(),
			userStatusesById,
			users,
			chats,
			chatIds,
			chatFolders,
			draftsById: {},
			replyingToById: {},
			orderedPinnedIds: [],
			totalChatCount: chatIds.length,
		};
	}
	static async init(user_id: string) {
		let user = await User.getFromCache(user_id);
		if (!user) {
			user = new User({
				id: user_id,
				type: User.userTypeRegular,
				phoneNumber: '',
			});
			await user.save();

			const chatFolders: PbChatFolder_Type[] = [];
			Object.keys(User.getDefaultChatFolder().byId).forEach(key => {
				// @ts-ignore
				chatFolders.push(User.getDefaultChatFolder().byId[key]);
			});
			await user.saveUserSetting({
				chatFolders: chatFolders,
				chatFolderOrderedIds: [0, 1],
				myBotIds: [],
				myGroups: [],
			});
		}
		let chat = await Chat.getFromCache(user_id);
		if (!chat) {
			chat = new Chat();
			chat.setChatInfo({
				id: user_id,
				type: 'chatTypePrivate',
				title: '',
			});
			await chat.save();
			const userChat = new UserChat(user_id);
			userChat.addUserChatIds(user_id);
		}
		return user;
	}
}
