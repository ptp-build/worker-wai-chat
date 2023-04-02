export const TEXT_AI_THINKING = '...';
export const SWAGGER_DOC = {
	schema: {
		info: {
			title: 'Worker Wai Chat',
			version: '1.0',
		},
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
				},
			},
		},
		security: [
			{
				bearerAuth: [],
			},
		],
	},
};

export const BOT_FATHER_COMMANDS = [
	{
		command: 'start',
		description: '开始对话',
	},
	{
		command: 'createBot',
		description: '创建机器人',
	},
	{
		command: 'clearHistory',
		description: '清空历史记录',
	},
];

export const SUPER_BOT_COMMANDS = [
	{
		command: 'start',
		description: '开始对话',
	},
	{
		command: 'setBotFatherAvatar',
		description: 'setBotFatherAvatar',
	},
	{
		command: 'setBotFatherCmd',
		description: 'setBotFatherCmd',
	},
	{
		command: 'createBot',
		description: '创建机器人',
	},
	{
		command: 'superAdmin',
		description: 'Super Admin',
	},
	{
		command: 'setting',
		description: 'setting',
	},

	{
		command: 'clearHistory',
		description: '清空历史记录',
	},
];
