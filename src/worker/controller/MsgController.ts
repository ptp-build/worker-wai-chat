import {Pdu} from "../../lib/ptp/protobuf/BaseMsg";
import Account from "../share/Account";
import {
  MsgDeleteReq,
  MsgDeleteRes,
  MsgListReq,
  MsgListRes,
  MsgUpdateReq,
  MsgUpdateRes,
  SendReq
} from "../../lib/ptp/protobuf/PTPMsg";
import {Msg} from "../share/model/Msg";
import {User} from "../share/model/User";
import {ActionCommands} from "../../lib/ptp/protobuf/ActionCommands";
import {ERR} from "../../lib/ptp/protobuf/PTPCommon/types";
import BotMsg from "../share/model/Msg/BotMsg";
import UserMsg from "../share/model/UserMsg";

export async function msgHandler(pdu:Pdu,account:Account){
  switch (pdu.getCommandId()){
    case ActionCommands.CID_MsgListReq:
      const handleMsgListReq = async (pdu:Pdu)=>{
        const {lastMessageId,isUp,limit,chatId} = MsgListReq.parseMsg(pdu);
        // console.log(payload)
        console.log("CID_MsgListReq",{chatId})
        const user_id = account.getUid();
        const res = {
          users:[],
          chats:[],
          repliesThreadInfos:[],
          messages:[]
        }
        if(user_id){
          const rows = await Msg.getMsgList(user_id,chatId,lastMessageId,limit,isUp);
          rows.forEach((msg:any)=>{
            // @ts-ignore
            return res.messages.push(msg.msg);
          })
        }
        account.sendPdu(new MsgListRes({
          err:ERR.NO_ERROR,
          payload:JSON.stringify(res)
        }).pack(),pdu.getSeqNum())
      }
      await handleMsgListReq(pdu);
      return
    default:
      break
  }
  if(!account.getUid()){
    return;
  }
  switch (pdu.getCommandId()){
    case ActionCommands.CID_MsgUpdateReq:
      const msgUpdateReq = MsgUpdateReq.parseMsg(pdu);
      const userMsg = new UserMsg(msgUpdateReq.user_id,msgUpdateReq.chat_id);
      const rows = userMsg.getUserChatMsgIds()
      if(rows){
        const chatMsgId = rows.get(msgUpdateReq.msg_id.toString())
        if(chatMsgId){
          const msg = await Msg.getFromCache(msgUpdateReq.user_id,msgUpdateReq.chat_id,chatMsgId)
          if(msg){
            msg.chatMsgId = chatMsgId;
            msg.setMsgText(msgUpdateReq.text)
            await msg.save(true,true)
          }
        }
      }
      account.sendPdu(new MsgUpdateRes({
        err:ERR.NO_ERROR
      }).pack(),pdu.getSeqNum())
      return
    case ActionCommands.CID_MsgDeleteReq:
      const msgDeleteReq = MsgDeleteReq.parseMsg(pdu);
      await Msg.deleteMsg(msgDeleteReq.user_id,msgDeleteReq.chat_id,msgDeleteReq.msg_ids);
      account.sendPdu(new MsgDeleteRes({
        err:ERR.NO_ERROR
      }).pack(),pdu.getSeqNum())
      return
    default:
      break
  }

  const sendReq = SendReq.parseMsg(pdu);
  const seq_num = pdu.getSeqNum();
  const {payload} = sendReq;
  const {msg} = JSON.parse(payload)
  const {chatId,id} = msg;
  const user_id = account.getUid()!;
  const msgSendByUser = new Msg(msg);
  const chatIsNotGroupOrChannel = Msg.getChatIsNotGroupOrChannel(chatId)
  let botInfo;
  if(chatIsNotGroupOrChannel){
    const chatUser = await User.getFromCache(chatId);
    botInfo = chatUser?.isBot() ? chatUser?.getUserInfo()!.fullInfo?.botInfo! : null
  }
  msgSendByUser.init(user_id,chatId,!!botInfo,user_id)
  await msgSendByUser.send("updateMessageSendSucceeded",{localMsgId:id},seq_num)

  await msgSendByUser.save()
  if(botInfo){
    await new BotMsg(user_id,chatId,msgSendByUser,botInfo).process()
  }

}
