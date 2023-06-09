export enum ActionCommands {
  CID_AuthLoginReq = 1001,
  CID_AuthLoginRes = 1002,
  CID_AuthPreLoginReq = 1003,
  CID_AuthPreLoginRes = 1004,
  CID_AuthStep1Req = 1005,
  CID_AuthStep1Res = 1006,
  CID_AuthStep2Req = 1007,
  CID_AuthStep2Res = 1008,
  CID_UpdateProfileReq = 1009,
  CID_UpdateProfileRes = 1010,
  CID_UpdateUsernameReq = 1011,
  CID_UpdateUsernameRes = 1012,
  CID_UploadProfilePhotoReq = 1013,
  CID_UploadProfilePhotoRes = 1014,
  CID_LoadChatsReq = 2001,
  CID_LoadChatsRes = 2002,
  CID_DownloadReq = 3001,
  CID_DownloadRes = 3002,
  CID_UploadReq = 3003,
  CID_UploadRes = 3004,
  CID_MsgDeleteReq = 4001,
  CID_MsgDeleteRes = 4002,
  CID_MsgListReq = 4003,
  CID_MsgListRes = 4004,
  CID_MsgUpdateReq = 4005,
  CID_MsgUpdateRes = 4006,
  CID_SendReq = 4007,
  CID_SendRes = 4008,
  CID_OtherNotify = 5001,
}

export const ActionCommandsName = {
  1001: "CID_AuthLoginReq",
  1002: "CID_AuthLoginRes",
  1003: "CID_AuthPreLoginReq",
  1004: "CID_AuthPreLoginRes",
  1005: "CID_AuthStep1Req",
  1006: "CID_AuthStep1Res",
  1007: "CID_AuthStep2Req",
  1008: "CID_AuthStep2Res",
  1009: "CID_UpdateProfileReq",
  1010: "CID_UpdateProfileRes",
  1011: "CID_UpdateUsernameReq",
  1012: "CID_UpdateUsernameRes",
  1013: "CID_UploadProfilePhotoReq",
  1014: "CID_UploadProfilePhotoRes",
  2001: "CID_LoadChatsReq",
  2002: "CID_LoadChatsRes",
  3001: "CID_DownloadReq",
  3002: "CID_DownloadRes",
  3003: "CID_UploadReq",
  3004: "CID_UploadRes",
  4001: "CID_MsgDeleteReq",
  4002: "CID_MsgDeleteRes",
  4003: "CID_MsgListReq",
  4004: "CID_MsgListRes",
  4005: "CID_MsgUpdateReq",
  4006: "CID_MsgUpdateRes",
  4007: "CID_SendReq",
  4008: "CID_SendRes",
  5001: "CID_OtherNotify",
};

export const getActionCommandsName = (cid:ActionCommands)=>{
   return ActionCommandsName[cid] || cid.toString();
}

