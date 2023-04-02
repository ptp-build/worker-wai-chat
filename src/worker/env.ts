import CloudFlareKv from './share/db/CloudFlareKv';
import CloudFlareR2 from './share/storage/CloudFlareR2';
import LocalStorage from './share/db/LocalStorage';
import Logger from './share/utils/Logger';

export const ENV: {
	IS_PROD: boolean;
	BOT_WORKER_API: string;
	TASK_EXE_USER_ID: string;
	KV_NAMESPACE_KEY: string;
	WAI_WORKER_API_TOKEN: string;
	USER_ID_START: string;
	USER_ID_BOT_FATHER: string;
	USER_ID_SUPER_ADMIN: string;
	FRONTEND_URL: string;
	Access_Control_Allow_Origin: string;
	// OpenAI API Key
	OPENAI_API_KEY: string;
	// 为了避免4096字符限制，将消息删减
	AUTO_TRIM_HISTORY: boolean;
	// 最大历史记录长度
	MAX_HISTORY_LENGTH: number;
	SYSTEM_INIT_MESSAGE: string;
	OPENAI_API_EXTRA_PARAMS: Record<string, any>;
} = {
	IS_PROD: true,
	BOT_WORKER_API: '',
	// 系统初始化消息
	SYSTEM_INIT_MESSAGE: '你是一个得力的助手,请使用中文进行我们的交流。',
	// OpenAI API 额外参数
	OPENAI_API_EXTRA_PARAMS: {},
	WAI_WORKER_API_TOKEN: '',
	KV_NAMESPACE_KEY: 'DATABASE_PROD',
	TASK_EXE_USER_ID: '',
	USER_ID_START: '623415',
	USER_ID_BOT_FATHER: '10000',
	USER_ID_SUPER_ADMIN: '',
	FRONTEND_URL: 'http://localhost:1234/',
	Access_Control_Allow_Origin: '*',
	// OpenAI API Key
	OPENAI_API_KEY: '',
	// 为了避免4096字符限制，将消息删减
	AUTO_TRIM_HISTORY: false,
	// 最大历史记录长度
	MAX_HISTORY_LENGTH: 20,
};

export let kv: CloudFlareKv;
export let storage: CloudFlareR2;

export function initEnv(env: Record<string, any>) {
	for (const key in ENV) {
		if (env[key] !== undefined) {
			// @ts-ignore
			ENV[key] = env[key];
		}
	}
	// Logger.setLevel(ENV.IS_PROD ? 'info' : 'debug');
	Logger.setLevel(ENV.IS_PROD ? 'debug' : 'debug');
	kv = new CloudFlareKv();
	kv.init(env[ENV.KV_NAMESPACE_KEY]);
	storage = new CloudFlareR2();
	storage.init(env.STORAGE);
}

export function initKvTest() {
	//@ts-ignore
	kv = new LocalStorage();
	//@ts-ignore
	kv.init();
}
