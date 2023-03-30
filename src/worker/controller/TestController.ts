import { ResponseJson } from '../helpers/network';
import * as utils from 'worktop/utils';
import { ENV, kv, storage } from '../helpers/env';
import { RequestForm } from '../../types';
import { Msg } from '../share/model/Msg';
import { getInitSystemBots, initSystemBot, resetInitSystemBot_down } from './UserController';
import { Chat } from '../share/model/Chat';
import { User } from '../share/model/User';
import { Pdu } from '../../lib/ptp/protobuf/BaseMsg';
import { PbMsg } from '../../lib/ptp/protobuf/PTPCommon';

export default async function (request: Request) {
	const TEST_TOKEN = ENV.TEST_TOKEN;
	const IS_PROD = ENV.IS_PROD;
	if (IS_PROD) {
		if (!TEST_TOKEN || request.headers.get('Authorization') !== `Bearer ${TEST_TOKEN}`) {
			return ResponseJson({
				err_msg: 'invalid token',
			});
		}
	}

	let input;
	try {
		input = await utils.body<RequestForm>(request);
	} catch (err) {
		return ResponseJson({
			err_msg: 'Error parsing request body',
		});
	}
	//@ts-ignore
	const { action, payload } = await input;
	const { auth_uid } = payload;
	switch (action) {
		case 'upload':
			const blob = new Blob([payload.body], { type: 'text/plain' });
			payload.put = await storage.put('test/t.jpg', blob);
			payload.get = await storage.get('test/t.jpg');
			break;

		case 'protoUser':
			const u: any = {
				id: '4001',
				accessHash: '',
				canBeInvitedToGroup: false,
				firstName: '',
				lastName: '',
				hasVideoAvatar: false,
				isMin: false,
				isPremium: false,
				noStatus: false,
				phoneNumber: '',
				type: 'userTypeRegular',
				usernames: [],
			};
			const user = new User();
			user.setUserInfo(u);
			await user.save();
			const u_ = await User.getFromCache(user.msg!.id);

			const user1 = user.pack();
			const user2 = user.pack().getPbData();
			const u1 = User.parseMsg(new Pdu(user.pack().getPbData()));
			const u2 = User.parseMsg(user1);
			const u3 = User.parseMsg(new Pdu(Buffer.from(Buffer.from(user2).toString())));
			await kv.put('test', Buffer.from(user2).toString());
			const u4 = await kv.get('test');
			const u5 = User.parseMsg(new Pdu(Buffer.from(u4)));
			payload.user = u5;
			break;
		case 'protoChat':
			const c: any = {
				type: 'chatTypePrivate',
				id: '4002',
				title: 'Bot Father',
				usernames: [],
				isMuted: false,
				isMin: false,
				hasPrivateLink: false,
				isSignaturesShown: false,
				accessHash: '',
				isVerified: false,
				isJoinToSend: false,
				isJoinRequest: false,
				isForum: false,
				isListed: true,
				settings: {
					isAutoArchived: false,
					canReportSpam: false,
					canAddContact: false,
					canBlockContact: false,
				},
			};
			const obj = new Chat();
			obj.setChatInfo(c);
			await obj.save();
			const c_ = await Chat.getFromCache(obj.msg!.id);
			payload.chat = c_?.getChatInfo();
			break;

		case 'protoMsg':
			// const m:ApiChat = {"type":"chatTypePrivate","id":"20000","title":"Bot Father","usernames":[],"isMuted":false,"isMin":false,"hasPrivateLink":false,"isSignaturesShown":false,"accessHash":"","isVerified":false,"isJoinToSend":false,"isJoinRequest":false,"isForum":false,"isListed":true,"settings":{"isAutoArchived":false,"canReportSpam":false,"canAddContact":false,"canBlockContact":false}}
			const msg = new Msg({
				id: 10029,
				chatId: '4002',
				content: {
					text: {
						text: 'www',
						entities: [
							{
								type: 't',
								length: 1,
								offset: 1,
								cipher: '1data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDACgcHiMeGSgjISMtKygwPGRBPDc3PHtYXUlkkYCZlo+AjIqgtObDoKrarYqMyP/L2u71////m8H////6/+b9//j/2wBDASstLTw1PHZBQXb4pYyl+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj/wAARCAAoACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCpHljtXknpSyFRjbnOOc+tMjYoN4PParRjW5G7BE7D7vQE03qKK5V6kA96OKuNYA/ut7ebjPT5ah2LajzMEzIPu9QDU2udDqqOkUVn3IDkYYdRRTd5fcWOSaKNibtpO4rDoOwFXrWS2kPO6KQjBIPHv+dZe8lcE8VbUrawneCZXH3f7o/xP6VRnJpvQvKbwzfdXGd3OMYqC5mtFJ275ZAMZPT8fpUYu0EYbC4x/q8DGaZIi3MW+MYlA6D+If4/zpA9UVz/AKrC9e9FMQ7csfpj1opMqykld2I80pZnYliSTRRVGYq4zzTy5XbsbBXnIoopdSk9GR5ooopkn//Z',
							},
							{
								type: 't',
								length: 1,
								offset: 1,
								cipher: '2data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDACgcHiMeGSgjISMtKygwPGRBPDc3PHtYXUlkkYCZlo+AjIqgtObDoKrarYqMyP/L2u71////m8H////6/+b9//j/2wBDASstLTw1PHZBQXb4pYyl+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj/wAARCAAoACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCpHljtXknpSyFRjbnOOc+tMjYoN4PParRjW5G7BE7D7vQE03qKK5V6kA96OKuNYA/ut7ebjPT5ah2LajzMEzIPu9QDU2udDqqOkUVn3IDkYYdRRTd5fcWOSaKNibtpO4rDoOwFXrWS2kPO6KQjBIPHv+dZe8lcE8VbUrawneCZXH3f7o/xP6VRnJpvQvKbwzfdXGd3OMYqC5mtFJ275ZAMZPT8fpUYu0EYbC4x/q8DGaZIi3MW+MYlA6D+If4/zpA9UVz/AKrC9e9FMQ7csfpj1opMqykld2I80pZnYliSTRRVGYq4zzTy5XbsbBXnIoopdSk9GR5ooopkn//Z',
							},
						],
					},
					photo: {
						id: '3438953743482627600',
						thumbnail: {
							width: 64,
							height: 88,
							dataUri:
								'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDACgcHiMeGSgjISMtKygwPGRBPDc3PHtYXUlkkYCZlo+AjIqgtObDoKrarYqMyP/L2u71////m8H////6/+b9//j/2wBDASstLTw1PHZBQXb4pYyl+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj/wAARCAAoACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCpHljtXknpSyFRjbnOOc+tMjYoN4PParRjW5G7BE7D7vQE03qKK5V6kA96OKuNYA/ut7ebjPT5ah2LajzMEzIPu9QDU2udDqqOkUVn3IDkYYdRRTd5fcWOSaKNibtpO4rDoOwFXrWS2kPO6KQjBIPHv+dZe8lcE8VbUrawneCZXH3f7o/xP6VRnJpvQvKbwzfdXGd3OMYqC5mtFJ275ZAMZPT8fpUYu0EYbC4x/q8DGaZIi3MW+MYlA6D+If4/zpA9UVz/AKrC9e9FMQ7csfpj1opMqykld2I80pZnYliSTRRVGYq4zzTy5XbsbBXnIoopdSk9GR5ooopkn//Z',
						},
						sizes: [
							{
								width: 64,
								height: 88,
								type: 'y',
							},
						],
					},
				},
				date: 1679588708,
				isOutgoing: true,
				senderId: '623418',
				isForwardingAllowed: true,
				previousLocalId: 5035892082.000002,
			});
			// msg.handlePhotoThumbnail()
			msg.init('4001', '4002', false, '4001');
			payload.msg = msg.getMsg();
			payload.msg_len = JSON.stringify(msg.getMsg()).length;
			payload.msg_pack = msg.pack();
			payload.msg_pack_len = msg.pack().getPbDataLength();
			payload.msg1 = PbMsg.parseMsg(msg.pack());
			msg.hasSent = true;
			await msg.save();
			const c_1 = await Msg.getFromCache(msg.msg!.senderId!, msg.msg!.chatId, msg.msg!.id);
			payload.get_msg = c_1?.getMsg();
			payload.get_msg.content!.photo!.thumbnail!.dataUri =
				payload.get_msg.content.photo.thumbnail.dataUri.toString('base64');

			break;
		case 'msg':
			const msgObj = new Msg({
				id: 10029,
				chatId: '4001',
				content: {
					text: {
						text: 'www',
						entities: [
							{
								type: 't',
								length: 1,
								offset: 1,
								cipher: '1data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDACgcHiMeGSgjISMtKygwPGRBPDc3PHtYXUlkkYCZlo+AjIqgtObDoKrarYqMyP/L2u71////m8H////6/+b9//j/2wBDASstLTw1PHZBQXb4pYyl+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj/wAARCAAoACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCpHljtXknpSyFRjbnOOc+tMjYoN4PParRjW5G7BE7D7vQE03qKK5V6kA96OKuNYA/ut7ebjPT5ah2LajzMEzIPu9QDU2udDqqOkUVn3IDkYYdRRTd5fcWOSaKNibtpO4rDoOwFXrWS2kPO6KQjBIPHv+dZe8lcE8VbUrawneCZXH3f7o/xP6VRnJpvQvKbwzfdXGd3OMYqC5mtFJ275ZAMZPT8fpUYu0EYbC4x/q8DGaZIi3MW+MYlA6D+If4/zpA9UVz/AKrC9e9FMQ7csfpj1opMqykld2I80pZnYliSTRRVGYq4zzTy5XbsbBXnIoopdSk9GR5ooopkn//Z',
							},
							{
								type: 't',
								length: 1,
								offset: 1,
								cipher: '2data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDACgcHiMeGSgjISMtKygwPGRBPDc3PHtYXUlkkYCZlo+AjIqgtObDoKrarYqMyP/L2u71////m8H////6/+b9//j/2wBDASstLTw1PHZBQXb4pYyl+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj/wAARCAAoACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCpHljtXknpSyFRjbnOOc+tMjYoN4PParRjW5G7BE7D7vQE03qKK5V6kA96OKuNYA/ut7ebjPT5ah2LajzMEzIPu9QDU2udDqqOkUVn3IDkYYdRRTd5fcWOSaKNibtpO4rDoOwFXrWS2kPO6KQjBIPHv+dZe8lcE8VbUrawneCZXH3f7o/xP6VRnJpvQvKbwzfdXGd3OMYqC5mtFJ275ZAMZPT8fpUYu0EYbC4x/q8DGaZIi3MW+MYlA6D+If4/zpA9UVz/AKrC9e9FMQ7csfpj1opMqykld2I80pZnYliSTRRVGYq4zzTy5XbsbBXnIoopdSk9GR5ooopkn//Z',
							},
						],
					},
					photo: {
						id: '3438953743482627600',
						thumbnail: {
							width: 64,
							height: 88,
							dataUri:
								'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDACgcHiMeGSgjISMtKygwPGRBPDc3PHtYXUlkkYCZlo+AjIqgtObDoKrarYqMyP/L2u71////m8H////6/+b9//j/2wBDASstLTw1PHZBQXb4pYyl+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj/wAARCAAoACgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCpHljtXknpSyFRjbnOOc+tMjYoN4PParRjW5G7BE7D7vQE03qKK5V6kA96OKuNYA/ut7ebjPT5ah2LajzMEzIPu9QDU2udDqqOkUVn3IDkYYdRRTd5fcWOSaKNibtpO4rDoOwFXrWS2kPO6KQjBIPHv+dZe8lcE8VbUrawneCZXH3f7o/xP6VRnJpvQvKbwzfdXGd3OMYqC5mtFJ275ZAMZPT8fpUYu0EYbC4x/q8DGaZIi3MW+MYlA6D+If4/zpA9UVz/AKrC9e9FMQ7csfpj1opMqykld2I80pZnYliSTRRVGYq4zzTy5XbsbBXnIoopdSk9GR5ooopkn//Z',
						},
						sizes: [
							{
								width: 64,
								height: 88,
								type: 'y',
							},
						],
					},
				},
				date: 1679588708,
				isOutgoing: true,
				senderId: '623418',
				isForwardingAllowed: true,
				previousLocalId: 5035892082.000002,
			});
			msgObj.init('4001', '4002', false);
			await msgObj.genMsgId();
			payload.header = msgObj.getMsgHeader();
			await msgObj.save();
			payload.msgObj = msgObj;
			payload.msgObjFromCache = await Msg.getFromCache('4001', '4002', msgObj.chatMsgId!);
			break;
	}

	return ResponseJson({ action, payload });
}
