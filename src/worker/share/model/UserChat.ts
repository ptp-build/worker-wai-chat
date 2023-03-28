import {kv} from "../../helpers/env";

export default class UserChat {
  private readonly user_id: string;
  static userChatIds:Map<string,string[]> = new Map();
  constructor(user_id:string){
    this.user_id = user_id;
  }

  async init(){
    let chatIds = this.getUserChatIds();
    if(!chatIds){
      chatIds = await this.getUserChatIdsFromKv();
      this.setUserChatIds(chatIds)
    }
    return this;
  }

  async saveUserChatIdsToKv(){
    const chatIds = this.getUserChatIds();
    if(chatIds){
      await kv.put(`U_C_${this.user_id}`,chatIds.join(','))
    }
  }

  async getUserChatIdsFromKv():Promise<string[]>{
    const str = await kv.get(`U_C_${this.user_id}`);
    if(str){
      return str.split(',').map(Number)
    }else{
      return []
    }
  }

  getUserChatIds(){
    return UserChat.userChatIds.get(this.user_id)
  }

  setUserChatIds(chatIds:string[]){
    UserChat.userChatIds.set(this.user_id, chatIds);
  }

  addUserChatIds(chatId:string){
    const chatIds = this.getUserChatIds();
    if(chatIds){
      if(chatIds.includes(chatId)){
        chatIds.push(chatId);
        this.setUserChatIds(chatIds);
        this.saveUserChatIdsToKv().catch(console.error);
      }
    }
  }
}
