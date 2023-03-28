import {Pdu} from "../../lib/ptp/protobuf/BaseMsg";
import {getCorsHeader} from "../helpers/network";
import {ActionCommands} from "../../lib/ptp/protobuf/ActionCommands";
import {Download, Upload} from "./FileController";

export default class ProtoController{
  static async dispatch(request:Request){
    try {
      const arrayBuffer = await request.arrayBuffer();
      let pdu = new Pdu(Buffer.from(arrayBuffer));
      switch (pdu.getCommandId()){
        case ActionCommands.CID_UploadReq:
          return Upload(pdu)
        case ActionCommands.CID_DownloadReq:
          return Download(pdu)
        default:
          break
      }}
    catch (e){
      console.error(e)
      return new Response(
        "", {
          status: 500,
          headers: {
            ...getCorsHeader()
          }
        }
      )
    }
  }
}
