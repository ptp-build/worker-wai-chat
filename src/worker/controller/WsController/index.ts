import {genUserId} from "../AuthController";
import {randomize} from "worktop/utils";
import {getInitSystemBots, initSystemBot, uploadProfilePhotoReq,updateProfile,updateUsername} from "../UserController";
import {ENV, kv} from "../../helpers/env";
import Account from "../../share/Account";
import {ActionCommands, getActionCommandsName} from "../../../lib/ptp/protobuf/ActionCommands";
import {Pdu} from "../../../lib/ptp/protobuf/BaseMsg";
import {
  AuthLoginReq,
  AuthLoginRes,
  AuthPreLoginReq,
  AuthPreLoginRes,
  AuthStep1Req,
  AuthStep1Res,
  AuthStep2Req,
  AuthStep2Res
} from "../../../lib/ptp/protobuf/PTPAuth";
import {ERR} from "../../../lib/ptp/protobuf/PTPCommon/types";
import {LoadChatsReq, LoadChatsRes} from "../../../lib/ptp/protobuf/PTPChats";
import {OtherNotify} from "../../../lib/ptp/protobuf/PTPOther";
import {msgHandler} from "../MsgController";
import {User} from "../../share/model/User";

const accountIdStart = +(new Date());
export const UserIdAccountIdMap:Record<string, Account[]> = {}
export let TASK_EXE_USER_ID = "";

async function handleSession(websocket: WebSocket) {
  // @ts-ignore
  websocket.accept();
  Account.setKvStore(kv)
  const accountServer = new Account(accountIdStart + 1);
  accountServer.setMsgConn(websocket);
  accountServer.genEntropy();
  let captcha = undefined;
  let p: Buffer | undefined = undefined;
  let q: Buffer | undefined = undefined;
  let authLoginTs: number | undefined = 0;
  websocket.addEventListener('message', async ({ data }) => {
    try {
      if(data.length < 16) {
        return
      }
      let pdu = new Pdu(Buffer.from(data));
      console.log("[MESSAGE]",
        pdu.getSeqNum(),
        pdu.getCommandId(),
        getActionCommandsName(pdu.getCommandId())
      )
      let pduRsp:Pdu|undefined = undefined;
      switch (pdu.getCommandId()){
        case ActionCommands.CID_AuthStep1Req:
          await initSystemBot(getInitSystemBots());
          const authStep1Req = AuthStep1Req.parseMsg(pdu);
          p = Buffer.from(authStep1Req.p)
          captcha = Buffer.from(randomize(4))
          q = Buffer.from(randomize(16));
          const ts = +(new Date());
          const {sign}:{sign:Buffer} = await accountServer.signMessage(ts+Buffer.concat([p,q]).toString("hex"))
          const address = await accountServer.getAccountAddress();
          pduRsp = new AuthStep1Res({
            ts,
            q,
            sign,
            address,
            err:ERR.NO_ERROR
          }).pack();
          break
        case ActionCommands.CID_AuthStep2Req:
          const authStep2Req = AuthStep2Req.parseMsg(pdu);
          const res = accountServer.recoverAddressAndPubKey(
            authStep2Req.sign,authStep2Req.ts+Buffer.concat([p!,q!]).toString("hex"))
          await accountServer.initEcdh(res.pubKey,p!,q!);
          // console.log(authStep2Req.address,res.address)
          // console.log("shareKey",accountServer.getShareKey());
          pduRsp = new AuthStep2Res({
            err:ERR.NO_ERROR
          }).pack()
          break
        case ActionCommands.CID_AuthPreLoginReq:
          if(!accountServer.getIv()){
            pduRsp = new AuthPreLoginRes({
              uid:'',
              ts:0,
              err:ERR.ERR_AUTH_LOGIN
            }).pack()
            break;
          }
          const authPreLoginReq = AuthPreLoginReq.parseMsg(pdu);
          const res1 = accountServer.recoverAddressAndPubKey(
            authPreLoginReq.sign1,authPreLoginReq.ts.toString())

          if(res1.address !== authPreLoginReq.address1){
            pduRsp = new AuthPreLoginRes({
              uid:'',
              ts:0,
              err:ERR.ERR_AUTH_LOGIN
            }).pack()
            break;
          }

          const res2 = accountServer.recoverAddressAndPubKey(
            authPreLoginReq.sign2,
            authPreLoginReq.ts + authPreLoginReq.address1
          )

          if(res2.address !== authPreLoginReq.address2){
            pduRsp = new AuthPreLoginRes({
              uid:'',
              ts:0,
              err:ERR.ERR_AUTH_LOGIN
            }).pack()
            break;
          }
          let uid = await accountServer.getUidFromCacheByAddress(res2.address);
          if(!uid){
            uid = await genUserId();
          }
          authLoginTs = +(new Date)

          pduRsp = new AuthPreLoginRes({
            uid,
            ts:authLoginTs,
            err:ERR.NO_ERROR
          }).pack()
          break
        case ActionCommands.CID_AuthLoginReq:
          if(!accountServer.getIv()){
            pduRsp = new AuthLoginRes({
              err:ERR.ERR_AUTH_LOGIN
            }).pack()
            break;
          }
          const authLoginReq = AuthLoginReq.parseMsg(pdu);
          if(authLoginTs && authLoginTs !== authLoginReq.ts){
            pduRsp = new AuthLoginRes({
              err:ERR.ERR_AUTH_LOGIN,
            }).pack()
            break;
          }
          const resLogin = accountServer.recoverAddressAndPubKey(
            Buffer.from(authLoginReq.sign),authLoginReq.ts.toString() + authLoginReq.uid)

          if(resLogin.address !== authLoginReq.address){
            pduRsp = new AuthLoginRes({
              err:ERR.ERR_AUTH_LOGIN
            }).pack()
            break;
          }
          const uid_cache = await accountServer.getUidFromCacheByAddress(authLoginReq.address);
          // console.log("uid_cache => ",uid_cache,authLoginReq.uid)
          if(uid_cache && uid_cache !== authLoginReq.uid){
            pduRsp = new AuthLoginRes({
              err:ERR.ERR_AUTH_LOGIN
            }).pack()
            break;
          }
          await accountServer.afterServerLoginOk(authLoginReq);
          const user_id = accountServer.getUid()!;
          console.log("[LOGIN OK] ====>>>",user_id)
          const user = await User.init(user_id);
          const userInfo = user.getUserInfo();
          userInfo!.isSelf = true;
          pduRsp = new AuthLoginRes({
            err:ERR.NO_ERROR,
            payload:JSON.stringify({
              address:authLoginReq.address,
              currentUser:userInfo
            })
          }).pack()

          if(!UserIdAccountIdMap[user_id]){
            UserIdAccountIdMap[user_id] = [];
          }
          if(!ENV.IS_PROD){
            TASK_EXE_USER_ID = user_id;
          }else{
            TASK_EXE_USER_ID = ENV.TASK_EXE_USER_ID;
          }

          UserIdAccountIdMap[user_id].push(accountServer)
          break
        default:
          await _ApiMsg(pdu,accountServer)
          break
      }
      if(pduRsp){
        pduRsp.updateSeqNo(pdu.getSeqNum())
        accountServer.sendPdu(pduRsp);
      }
    }catch (e){
      console.error(e)
      accountServer.sendPdu(new OtherNotify({
        err:ERR.ERR_SYSTEM
      }).pack());
    }
  });

  websocket.addEventListener('close', async () => {
    console.log("[close]",{uid:accountServer.getUid()!,accountId:accountServer.getAccountId()});
    if(UserIdAccountIdMap[accountServer.getUid()!]){
      UserIdAccountIdMap[accountServer.getUid()!] = UserIdAccountIdMap[accountServer.getUid()!].filter(account=>{
        return account.getAccountId() !== accountServer.getAccountId()
      })
    }
  });
}

async function websocketHandler(req: Request) {
  const upgradeHeader = req.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected websocket', { status: 400 });
  }
  // @ts-ignore
  const [webSocket, server] = Object.values(new WebSocketPair());
  // @ts-ignore
  await handleSession(server);
  const status = 101;
  // @ts-ignore
  return new Response(null, {status,webSocket});
}

export default async function (event:FetchEvent){
  return await websocketHandler(event.request);
}

export async function _ApiMsg(pdu:Pdu,account:Account){
  let pduRsp:Pdu | undefined = undefined;

  switch (pdu.getCommandId()) {
    case ActionCommands.CID_UpdateProfileReq:
    case ActionCommands.CID_UpdateUsernameReq:
    case ActionCommands.CID_UploadProfilePhotoReq:
      if (!account.getUid()) {
        pduRsp = new OtherNotify({
            err:ERR.ERR_AUTH_NEED
        }).pack()
        pduRsp.updateSeqNo(pdu.getSeqNum())
      }
      break
  }
  if(!pduRsp){
    switch (pdu.getCommandId()){
      case ActionCommands.CID_UploadProfilePhotoReq:
        await uploadProfilePhotoReq(pdu,account)
        break
      case ActionCommands.CID_UpdateProfileReq:
        await updateProfile(pdu,account)
        break
      case ActionCommands.CID_UpdateUsernameReq:
        await updateUsername(pdu,account)
        break
      case ActionCommands.CID_MsgListReq:
      case ActionCommands.CID_MsgDeleteReq:
      case ActionCommands.CID_MsgUpdateReq:
      case ActionCommands.CID_SendReq:
        await msgHandler(pdu,account);
        break;
      case ActionCommands.CID_LoadChatsReq:
        await initSystemBot(getInitSystemBots());
        const loadChatsReq = LoadChatsReq.parseMsg(pdu);
        // console.log(">>>loadChatsReq",loadChatsReq)
        let user_id = account.getUid() || undefined;
        pduRsp = new LoadChatsRes({
          err:ERR.NO_ERROR,
          payload:JSON.stringify(await User.loadChats(user_id))
        }).pack();
        break
      default:
        break
    }
  }

  if(pduRsp){
    pduRsp.updateSeqNo(pdu.getSeqNum())
    account.sendPdu(pduRsp);
  }
}

