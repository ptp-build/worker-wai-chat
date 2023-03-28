import { ENV, kv } from '../helpers/env';
import { User } from '../share/model/User';
import { Bot } from '../share/model/Bot';
import { Chat } from '../share/model/Chat';
import { Pdu } from '../../lib/ptp/protobuf/BaseMsg';
import Account from '../share/Account';
import UploadProfilePhotoReq from '../../lib/ptp/protobuf/PTPAuth/UploadProfilePhotoReq';
import UploadProfilePhotoRes from '../../lib/ptp/protobuf/PTPAuth/UploadProfilePhotoRes';
import { ERR } from '../../lib/ptp/protobuf/PTPCommon/types';
import { UpdateProfileReq, UpdateUsernameReq } from '../../lib/ptp/protobuf/PTPAuth';
import UserChat from '../share/model/UserChat';
import { OpenAPIRoute, Path, Str } from '@cloudflare/itty-router-openapi';
import Logger from '../share/utils/Logger';

let initSystemBot_down = false;

export function getInitSystemBots() {
	const { USER_ID_CHATGPT, USER_ID_BOT_FATHER, USER_ID_BOT_DEV } = ENV;
	return [
		{
			id: USER_ID_BOT_DEV,
			menuButton: {
				type: 'commands',
			},
			commands: [
				{
					botId: USER_ID_BOT_DEV,
					command: 'start',
					description: 'Start Chat',
				},
			],
			first_name: 'Dev Center',
			user_name: 'Dev',
			isPremium: true,
			description: 'Dev',
		},
		{
			id: USER_ID_CHATGPT,
			menuButton: {
				type: 'commands',
			},
			commands: [
				{
					botId: USER_ID_CHATGPT,
					command: 'start',
					description: '开始对话',
				},
				{
					botId: USER_ID_CHATGPT,
					command: 'history',
					description: '获取当前有效Prompt和对话的历史记录',
				},
				{
					botId: USER_ID_CHATGPT,
					command: 'clear',
					description: '清除当前有效Prompt和对话的历史记录',
				},
				{
					botId: USER_ID_CHATGPT,
					command: 'get_init_msg',
					description: '查看初始化消息',
				},
				{
					botId: USER_ID_CHATGPT,
					command: 'set_init_msg',
					description: '设置初始化消息',
				},
				{
					botId: USER_ID_CHATGPT,
					command: 'get_api_key',
					description: '查看API密钥',
				},
				{
					botId: USER_ID_CHATGPT,
					command: 'set_api_key',
					description: '设置API密钥',
				},
				{
					botId: USER_ID_CHATGPT,
					command: 'reset_config',
					description: '初始化配置',
				},
			],
			first_name: 'Chat Gpt',
			user_name: 'ChatGpt',
			isPremium: true,
			description:
				'ChatGPT是基于GPT（Generative Pre-trained Transformer）模型的聊天机器人，可以进行智能对话和自动生成文章。ChatGPT通过深度学习技术，对大量文本进行学习，并可生成符合上下文的语句，从而能够进行更加人性化的对话。',
		},
		{
			id: USER_ID_BOT_FATHER,
			menuButton: {
				type: 'commands',
			},
			commands: [
				{
					botId: USER_ID_BOT_FATHER,
					command: 'start',
					description: 'Start Chat',
				},
			],
			first_name: 'Bot Father',
			user_name: 'BotFather',
			isPremium: true,
			description:
				'BotFather是主宰所有机器人的机器人。使用它可以创建新的机器人账户和管理已有的机器人。',
		},
	];
}

export function resetInitSystemBot_down() {
	initSystemBot_down = false;
}

export async function initSystemBot(bots: any[], force?: boolean) {
	if (!force && initSystemBot_down) {
		return;
	}
	initSystemBot_down = true;
	for (let i = 0; i < bots.length; i++) {
		const { id, first_name, user_name, isPremium, description, commands, menuButton } = bots[i];
		let user = await User.getFromCache(id);
		if (!user) {
			const bot = new Bot({
				botId: id,
				isChatGpt: id === ENV.USER_ID_CHATGPT,
				menuButton,
				commands,
				description,
			});
			const userObj = new User();

			userObj.setUserInfo({
				phoneNumber: '',
				isMin: false,
				id,
				firstName: first_name,
				isPremium,
				type: 'userTypeBot',
				noStatus: true,
				fullInfo: {
					bio: description,
				},
			});
			userObj.setUsernames(user_name);
			userObj.setBotInfo(bot.getBotInfo());

			await userObj.save();
			const chat = new Chat();
			chat.setChatInfo({
				id,
				title: first_name,
				type: 'chatTypePrivate',
				isVerified: true,
			});
			const userChat = new UserChat(id);
			await userChat.init();
			userChat.addUserChatIds(id);
			await chat.save();
		}
	}
}

export async function uploadProfilePhotoReq(pdu: Pdu, account: Account) {
	const { id, is_video, thumbnail } = UploadProfilePhotoReq.parseMsg(pdu);
	Logger.log('uploadProfilePhotoReq', { id, is_video });

	const user = await User.getFromCache(account.getUid()!);
	if (!is_video) {
		const payload = {
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
		// @ts-ignore
		user?.setUserInfo({
			...user?.getUserInfo()!,
			...payload,
		});
		await user?.save();
		account.sendPdu(
			new UploadProfilePhotoRes({
				err: ERR.NO_ERROR,
				payload: JSON.stringify(payload),
			}).pack(),
			pdu.getSeqNum()
		);
	}
}

export async function updateUsername(pdu: Pdu, account: Account) {
	const { username } = UpdateUsernameReq.parseMsg(pdu);
	Logger.log('updateUsername', { username });
	const user = await User.getFromCache(account.getUid()!);
	user?.setUsernames(username);
	await user?.save();
	account.sendPdu(
		new UploadProfilePhotoRes({
			err: ERR.NO_ERROR,
		}).pack(),
		pdu.getSeqNum()
	);
}

export async function updateProfile(pdu: Pdu, account: Account) {
	const { about, firstName, lastName } = UpdateProfileReq.parseMsg(pdu);
	Logger.log('[updateProfile]', { about, firstName, lastName });
	const user = await User.getFromCache(account.getUid()!);
	const currentUser = user?.getUserInfo();
	user?.setUserInfo({
		...currentUser,
		firstName,
		lastName,
	});
	user?.setFullInfo({ bio: about });
	await user?.save();
	account.sendPdu(
		new UploadProfilePhotoRes({
			err: ERR.NO_ERROR,
		}).pack(),
		pdu.getSeqNum()
	);
}

export class UserGet extends OpenAPIRoute {
	static schema = {
		tags: ['User'],
		parameters: {
			userId: Path(Str, {
				description: 'User Id',
				default: '623415',
			}),
		},
		responses: {
			'200': {
				schema: {},
			},
		},
	};

	async handle(request: Request, data: Record<string, any>) {
		const { userId } = data;
		const user = await User.getFromCache(userId);

		// // @ts-ignore
		// Logger.log(user?.getUserInfo().photos[0]);
		return {
			metaData: { meta: 'data' },
			user: user?.getUserInfo(),
		};
	}
}

export class UserList extends OpenAPIRoute {
	static schema = {
		tags: ['User'],
		responses: {
			'200': {
				schema: {},
			},
		},
	};

	async handle(request: Request, data: Record<string, any>) {
		const userIds = await kv.get('USER_IDS');
		return {
			userIds,
		};
	}
}
