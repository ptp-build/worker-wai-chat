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
export const SUPER_BOT_COMMANDS = [
	{
		command: 'start',
		description: '开始对话',
	},
	{
		command: 'clearHistory',
		description: '清空历史记录',
	},
	{
		command: 'avatar',
		description: '设置头像',
	},
	{
		command: 'name',
		description: '设置名称',
	},
	{
		command: 'copy_bot',
		description: '复制机器人',
	},
	{
		command: 'create_bot',
		description: '创建机器人',
	},
	{
		command: 'set_command',
		description: '设置',
	},
	{
		command: 'history',
		description: '获取当前有效Prompt和对话的历史记录',
	},
	{
		command: 'clear',
		description: '清除当前有效Prompt和对话的历史记录',
	},
	{
		command: 'get_init_msg',
		description: '查看初始化消息',
	},
	{
		command: 'set_init_msg',
		description: '设置初始化消息',
	},
	{
		command: 'get_api_key',
		description: '查看API密钥',
	},
	{
		command: 'set_api_key',
		description: '设置API密钥',
	},
	{
		command: 'reset_config',
		description: '初始化配置',
	},
];
