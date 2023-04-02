import { BotWorkerResult } from '../../../../types';
import { PbBotInfo_Type, PbMsg_Type } from '../../../../lib/ptp/protobuf/PTPCommon/types';
import { AnswerCallbackButtonReq_Type } from '../../../../lib/ptp/protobuf/PTPMsg/types';

export default class {
	private msg: PbMsg_Type;
	private user_id: string;
	private botInfo: PbBotInfo_Type;
	private answerCallbackButtonReq: AnswerCallbackButtonReq_Type | undefined;
	constructor({
		botInfo,
		user_id,
		answerCallbackButtonReq,
		msg,
	}: {
		botInfo: PbBotInfo_Type;
		user_id: string;
		msg: PbMsg_Type;
		answerCallbackButtonReq: AnswerCallbackButtonReq_Type | undefined;
		callback?: AnswerCallbackButtonReq_Type;
	}) {
		this.answerCallbackButtonReq = answerCallbackButtonReq;
		this.msg = msg;
		this.user_id = user_id;
		this.botInfo = botInfo;
	}

	async process(): Promise<BotWorkerResult> {
		return {};
	}
}
