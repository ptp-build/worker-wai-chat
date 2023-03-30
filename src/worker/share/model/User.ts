import { ENV, kv } from '../../helpers/env';
import { Chat } from './Chat';
import { Msg } from './Msg';
import {
	PbCommands,
	PbMenuButton,
	PbUser,
	PbUserSetting,
} from '../../../lib/ptp/protobuf/PTPCommon';
import { Pdu } from '../../../lib/ptp/protobuf/BaseMsg';
import {
	PbBotInfo_Type,
	PbChatFolder_Type,
	PbFullInfo_Type,
	PbMenuButton_Type,
	PbUser_Type,
	PbUserSetting_Type,
	PbCommands_Type,
} from '../../../lib/ptp/protobuf/PTPCommon/types';
import UserChat from './UserChat';
import UserMsg from './UserMsg';
import Logger from '../utils/Logger';
import Account from '../Account';
import { Bot } from './Bot';
import { LoadChatsReq_Type } from '../../../lib/ptp/protobuf/PTPChats/types';
import { getInitSystemBots, initSystemBot } from '../../controller/UserController';

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
		if (user.photos && user.photos.id) {
			user.photos = [user.photos];
		}
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
		if (msg.photos && msg.photos.id) {
			// @ts-ignore
			msg.photos = [msg.photos];
		}
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
					includedChatIds: [],
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
		Logger.log('saveUserSetting', userSetting);
		await kv.put(
			`US_${this.msg!.id}`,
			Buffer.from(new PbUserSetting(userSetting).pack().getPbData()).toString('hex')
		);
	}

	async getUserSetting() {
		const str = await kv.get(`US_${this.msg!.id}`, true);
		if (str) {
			return PbUserSetting.parseMsg(new Pdu(Buffer.from(str, 'hex')));
		} else {
			return undefined;
		}
	}
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

	static async getPublicBotIds(force?: boolean) {
		const { USER_ID_BOT_FATHER } = ENV;
		let botIds = await kv.get('BOTS_PUB', force);
		if (botIds) {
			botIds = JSON.parse(botIds);
		} else {
			botIds = [];
		}
		if (!botIds.includes(USER_ID_BOT_FATHER)) {
			botIds.push(USER_ID_BOT_FATHER);
		}
		return botIds;
	}

	static async setPublicBotIds(botIds: string[]) {
		await kv.put('BOTS_PUB', JSON.stringify(botIds));
	}
	static async addPublicBotId(botId: string) {
		const botIds = await User.getPublicBotIds();
		if (!botIds.includes(botId)) {
			botIds.push(botId);
			await kv.put('BOTS_PUB', JSON.stringify(botIds));
		}
	}

	static async init(user_id: string, type: string = User.userTypeRegular) {
		let user = await User.getFromCache(user_id);
		if (!user) {
			user = new User({
				id: user_id,
				type: type,
				phoneNumber: '',
			});
			await user.save();
			const publicBotIds = await User.getPublicBotIds();
			const chatFolder = User.getDefaultChatFolder();
			chatFolder.byId['1'].includedChatIds = publicBotIds;
			const chatFolders: PbChatFolder_Type[] = Object.values(chatFolder.byId);
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

	static async apiLoadChatReq(user_id?: string, loadChatsReq?: LoadChatsReq_Type) {
		await initSystemBot(getInitSystemBots());
		const publicBotIds = await User.getPublicBotIds();
		let chatIds = publicBotIds;
		let userStatusesById: Record<string, any> = {};
		let chatFolders: any = User.getDefaultChatFolder();

		let chats = [];
		if (user_id) {
			const user = await User.init(user_id);
			let userSetting = await user.getUserSetting();
			if (!userSetting) {
				userSetting = {};
			}
			userSetting.chatFolders?.forEach((item: PbChatFolder_Type) => {
				item.pinnedChatIds = [];
				item.excludedChatIds = [];
				chatFolders.byId[item.id] = item;
			});
			chatFolders.orderedIds = userSetting.chatFolderOrderedIds!;
			const chatIds1 = await User.getChatIds(user_id);
			if (!chatIds!.includes(user_id)) {
				chatIds!.push(user_id);
			}
			chatIds1?.forEach(chatId => {
				if (!chatIds.includes(chatId)) {
					chatIds.push(chatId);
				}
			});
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
			}
		} else {
			chatFolders.byId['1'].includedChatIds = publicBotIds;
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
	static async createBot(
		botId: string,
		userName: string,
		botName: string = '',
		description: string = '',
		menuButton?: PbMenuButton_Type,
		commands?: PbCommands_Type[],
		isPremium: boolean = false
	) {
		let user = await User.getFromCache(botId);
		if (!user) {
			if (!menuButton) {
				menuButton = {
					type: 'commands',
				};
			}

			const bot = new Bot({
				botId,
				menuButton,
				commands,
				description,
			});
			const userObj = new User();

			userObj.setUserInfo({
				phoneNumber: '',
				isMin: false,
				id: botId,
				firstName: botName,
				isPremium,
				type: User.userTypeBot,
				noStatus: true,
				fullInfo: {
					bio: description,
				},
			});

			if (userName) {
				userObj.setUsernames(userName);
			}

			userObj.setBotInfo(bot.getBotInfo());

			await userObj.save();
			const chat = new Chat();
			chat.setChatInfo({
				id: botId,
				title: botName,
				type: Chat.chatTypePrivate,
				isVerified: true,
			});
			await chat.save();
		}
	}
}
