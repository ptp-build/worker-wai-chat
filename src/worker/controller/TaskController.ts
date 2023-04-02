import * as utils from 'worktop/utils';
import { ENV } from '../helpers/env';
import Account from '../share/Account';
import { Msg } from '../share/model/Msg';
import { TASK_EXE_USER_ID } from './WsController';
import { OpenAPIRoute } from '@cloudflare/itty-router-openapi';

type Task = {
	account: Account;
	msg: Msg;
	taskChatId: string;
	taskFetchCount: number;
	status: 'waiting' | 'process';
};

export const tasks: Record<string, Task> = {};

async function creatTask(account: Account, modelMsg: Msg) {
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
		console.log('task reply', msgModelBotCmdReply.msg);
	}
}

export class TaskApi extends OpenAPIRoute {
	static schema = {
		tags: ['Task'],
		responses: {
			'200': {
				schema: {},
			},
		},
	};

	async handle(request: Request, data: Record<string, any>) {
		const { action, payload } = await request.json();

		console.log(action);
		const user_id = TASK_EXE_USER_ID;
		const chatId = ENV.USER_ID_SUPER_ADMIN;
		const msgModelBotCmdReply = new Msg();
		msgModelBotCmdReply.init(user_id, chatId, true, chatId);
		console.log(JSON.stringify(payload, null, 2));
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
						`\nfullInfo ======\n\n` +
							'```\n' +
							JSON.stringify(fullInfo, null, 2) +
							'```'
					);
					if (botInfo) {
						await msgModelBotCmdReply.sendText(
							`\nbotInfo ======\n\n` +
								'```\n' +
								JSON.stringify(botInfo, null, 2) +
								'```'
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

		return { payload };
	}
}
