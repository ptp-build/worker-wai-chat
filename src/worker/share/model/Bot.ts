import {PbBotInfo_Type} from "../../../lib/ptp/protobuf/PTPCommon/types";

export class Bot{
  private msg: PbBotInfo_Type
  constructor(bot:PbBotInfo_Type) {
    this.msg = bot
  }
  getBotInfo(){
    return this.msg;
  }

  setBotInfo(bot:PbBotInfo_Type){
    this.msg = bot;
  }
  static format(bot:{id:string,description:string,isChatGpt?:boolean,commands?:any[],menuButton:any}){
    return {
      "botId": bot.id,
      "description": bot.description,
      isChatGpt:bot.isChatGpt,
      menuButton:bot.menuButton,
      commands:bot.commands
    }
  }
}

