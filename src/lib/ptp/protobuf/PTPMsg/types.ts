// DO NOT EDIT
import type * as PTPCommon from '../PTPCommon/types';

export interface MsgDeleteReq_Type {
  user_id: string;
  chat_id: string;
  msg_ids?: number[];
  revoke?: boolean[];
}
export interface MsgDeleteRes_Type {
  err: PTPCommon.ERR;
}
export interface MsgListReq_Type {
  chatId: string;
  lastMessageId: number;
  limit: number;
  isUp?: boolean;
}
export interface MsgListRes_Type {
  payload: string;
  err: PTPCommon.ERR;
}
export interface MsgUpdateReq_Type {
  user_id: string;
  chat_id: string;
  msg_id: number;
  text: string;
}
export interface MsgUpdateRes_Type {
  err: PTPCommon.ERR;
}
export interface SendReq_Type {
  payload: string;
}
export interface SendRes_Type {
  action: string;
  payload: string;
  err: PTPCommon.ERR;
}
