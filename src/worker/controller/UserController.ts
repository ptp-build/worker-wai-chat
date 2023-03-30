import { ENV } from '../helpers/env';
import { User } from '../share/model/User';
import { Pdu } from '../../lib/ptp/protobuf/BaseMsg';
import Account from '../share/Account';
import UploadProfilePhotoReq from '../../lib/ptp/protobuf/PTPAuth/UploadProfilePhotoReq';
import UploadProfilePhotoRes from '../../lib/ptp/protobuf/PTPAuth/UploadProfilePhotoRes';
import { ERR } from '../../lib/ptp/protobuf/PTPCommon/types';
import { UpdateProfileReq, UpdateUsernameReq } from '../../lib/ptp/protobuf/PTPAuth';
import { LoadChatsReq, LoadChatsRes } from '../../lib/ptp/protobuf/PTPChats';

let initSystemBot_down = false;

export function getInitSystemBots() {
	const { USER_ID_BOT_FATHER } = ENV;
	return [
		{
			id: USER_ID_BOT_FATHER,
			commands: [
				{
					botId: USER_ID_BOT_FATHER,
					command: 'start',
					description: 'Start Chat',
				},
				{
					botId: USER_ID_BOT_FATHER,
					command: 'createBot',
					description: 'Create a Bot',
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
		await User.createBot(
			id,
			user_name,
			first_name,
			description,
			menuButton,
			commands,
			isPremium
		);
	}
}

export async function apiLoadChatsReq(pdu: Pdu, account: Account) {
	const loadChatsReq = LoadChatsReq.parseMsg(pdu);
	const payload = await User.apiLoadChatReq(account.getUid(), loadChatsReq);
	account.sendPdu(
		new LoadChatsRes({
			err: ERR.NO_ERROR,
			payload: JSON.stringify(payload),
		}).pack(),
		pdu.getSeqNum()
	);
}

export async function uploadProfilePhotoReq(pdu: Pdu, account: Account) {
	const { id, is_video, thumbnail } = UploadProfilePhotoReq.parseMsg(pdu);
	console.log('uploadProfilePhotoReq', { id, is_video });

	const user = await User.getFromCache(account.getUid()!);
	if (!is_video) {
		const payload = user?.setAvatar(id, thumbnail);
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
	console.log('updateUsername', { username });
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
	console.log('[updateProfile]', { about, firstName, lastName });
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
