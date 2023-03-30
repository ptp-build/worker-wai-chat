import { HS256 } from 'worktop/jwt';
import CloudFlareKv from '../share/db/CloudFlareKv';
import CloudFlareR2 from '../share/storage/CloudFlareR2';
import LocalStorage from '../share/db/LocalStorage';
import Logger from '../share/utils/Logger';

export const ENV: {
	IS_PROD: boolean;
	BOT_API: string;
	TASK_EXE_USER_ID: string;
	KV_NAMESPACE_KEY: string;
	TEST_TOKEN: string;
	USER_ID_START: string;
	USER_ID_BOT_FATHER: string;
	USER_ID_SUPER_ADMIN: string;
	TOKEN_EXPIRE_TIME_SEC: number;
	JWT_SECRET: string;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	GOOGLE_REDIRECT_PROD_URL: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	FRONTEND_URL: string;
	Access_Control_Allow_Origin: string;
	// OpenAI API Key
	OPENAI_API_KEY: string;
	// 为了避免4096字符限制，将消息删减
	AUTO_TRIM_HISTORY: boolean;
	// 最大历史记录长度
	MAX_HISTORY_LENGTH: number;
} = {
	IS_PROD: true,
	BOT_API: 'http://localhost:1236/api',
	KV_NAMESPACE_KEY: 'DATABASE_PROD',
	TASK_EXE_USER_ID: '',
	TEST_TOKEN: '',
	USER_ID_START: '623415',
	USER_ID_BOT_FATHER: '10000',
	USER_ID_SUPER_ADMIN: '',
	TOKEN_EXPIRE_TIME_SEC: 3600,
	JWT_SECRET: '',
	GITHUB_CLIENT_ID: '',
	GITHUB_CLIENT_SECRET: '',
	GOOGLE_REDIRECT_PROD_URL: 'http://localhost:1235/auth/google/callback',
	GOOGLE_CLIENT_ID: '',
	GOOGLE_CLIENT_SECRET: '',
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
//@ts-ignore
export let jwt = HS256({ key: global.JWT_SECRET });

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
