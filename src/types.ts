import { PbChat_Type, PbPhoto_Type, PbUser_Type } from './lib/ptp/protobuf/PTPCommon/types';
import { MsgType } from './worker/share/service/Msg';

export enum AiChatRole {
	USER,
	ASSISTANT,
}

export type RequestForm = {
	action: string;
	payload: any;
};

export type AiChatHistory = {
	role: 'system' | 'user' | 'assistant';
	content: string;
};

export type AuthForm = {
	email: string;
	password: string;
};

export type AuthTokenForm = {
	code: string;
};

export type AuthUser = {
	user_id: string;
	email: string;
	name?: string;
	avatar?: string;
	password?: string;
	salt: string;
	github_id?: string;
	google_id?: string;
};

export type AuthResponse = {
	err_msg?: string;
	token?: string;
	user?: {
		user_id: string;
		email: string;
		name?: string;
		avatar?: string;
	};
	password_empty?: boolean;
};

export type ReplaceMessageButtonType = {
	messageId: number;
	reply?: string;
	inlineButtons?: [];
};

export type BotWorkerResult = {
	reply?: string;
	aiReply?: boolean;
	photo?: PbPhoto_Type;
	users?: PbUser_Type[];
	chats?: PbChat_Type[];
	action?: MsgType;
	chatId?: string;
	inlineButtons?: [];
	removeMessageButton?: number;
	replaceMessageButton?: ReplaceMessageButtonType;
};
