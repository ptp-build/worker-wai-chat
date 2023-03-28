import { ResponseJson } from '../helpers/network';
import * as utils from 'worktop/utils';
import { ENV } from '../helpers/env';
import { RequestForm } from '../../types';
import Account from '../share/Account';
import { Msg } from '../share/model/Msg';
import { TASK_EXE_USER_ID } from './WsController';
import Logger from "../share/utils/Logger";

type Task = {
	account: Account;
	msg: Msg;
	taskChatId: string;
	taskFetchCount: number;
	status: 'waiting' | 'process';
};

export const tasks: Record<string, Task> = {};

export async function creatTask(account: Account, modelMsg: Msg) {
	const taskText = modelMsg.getMsgText().replace('/task ', '');
	if (taskText) {
		const t = taskText.split(' ');
		let taskChatId, taskFetchCount;
		if (t.length > 1) {
			taskChatId = t[0];
			taskFetchCount = parseInt(t[1]);
		} else {
			taskChatId = t[0];
			taskFetchCount = 1;
		}
		const taskId = utils.uuid();
		tasks[taskId] = {
			account,
			taskChatId,
			taskFetchCount,
			msg: modelMsg,
			status: 'waiting',
		};
		const user_id = account.getUid()!;
		const chatId = user_id;
		const msgModelBotCmdReply = new Msg();
		msgModelBotCmdReply.init(user_id, chatId, true, user_id);
		await msgModelBotCmdReply.sendText(`${taskId} 【created】${taskText}`);
		Logger.log('task reply', msgModelBotCmdReply.msg);
	}
}

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
	Logger.log(action);
	const user_id = TASK_EXE_USER_ID;
	const chatId = ENV.USER_ID_BOT_DEV;
	const msgModelBotCmdReply = new Msg();
	msgModelBotCmdReply.init(user_id, chatId, true, user_id);
	Logger.log(JSON.stringify(payload, null, 2));
	switch (action) {
		case 'Send_User':
			const { user } = payload;
			const { fullInfo } = user;
			delete user['fullInfo'];
			await msgModelBotCmdReply.sendText(
				`\nuser ======\n\n` + '```\n' + JSON.stringify(user, null, 2) + '```'
			);
			if (fullInfo) {
				const { botInfo } = fullInfo;
				delete fullInfo['botInfo'];
				await msgModelBotCmdReply.sendText(
					`\nfullInfo ======\n\n` + '```\n' + JSON.stringify(fullInfo, null, 2) + '```'
				);
				if (botInfo) {
					await msgModelBotCmdReply.sendText(
						`\nbotInfo ======\n\n` + '```\n' + JSON.stringify(botInfo, null, 2) + '```'
					);
				}
			}
			break;
		case 'Send_Chat':
			await msgModelBotCmdReply.sendText(
				`\nCHAT ======\n\n` + '```\n' + JSON.stringify(payload.chat, null, 2) + '```'
			);
			break;
		case 'Send_Messages':
			for (let i = 0; i < payload.messages.length; i++) {
				const message = payload.messages[i];
				msgModelBotCmdReply.setMsg({
					...message,
					isOutgoing: false,
				});
				await msgModelBotCmdReply.send();
				await msgModelBotCmdReply.sendText(
					`\nMESSAGE ======\n\n` + '```\n' + JSON.stringify(message, null, 2) + '```'
				);
			}
			break;
		case 'task':
			const rows: Record<string, Task> = {};
			for (let i = 0; i < Object.keys(tasks).length; i++) {
				const id = Object.keys(tasks)[i];
				const task = tasks[id];
				if (task.status === 'waiting') {
					rows[id] = task;
					tasks[id].status = 'process';
				}
			}
			payload.tasks = rows;
			break;
	}

	return ResponseJson({ action, payload });
}
