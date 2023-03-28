import {sha256} from "ethereum-cryptography/sha256";
import * as EthEcies from '../../lib/ptp/wallet/EthEcies';

import {ecdh} from "ethereum-cryptography/secp256k1";
import Mnemonic from "../../lib/ptp/wallet/Mnemonic";
import Wallet from "../../lib/ptp/wallet/Wallet";
import EcdsaHelper from "../../lib/ptp/wallet/EcdsaHelper";
import Aes256Gcm from "../../lib/ptp/wallet/Aes256Gcm";
import LocalStorage from "./db/LocalStorage";
import CloudFlareKv from "./db/CloudFlareKv";
import {Pdu} from "../../lib/ptp/protobuf/BaseMsg";
import {AuthLoginReq_Type} from "../../lib/ptp/protobuf/PTPAuth/types";
import {getActionCommandsName} from "../../lib/ptp/protobuf/ActionCommands";
import {decrypt, encrypt} from "ethereum-cryptography/aes";
import {hashSha256} from "./utils/helpers";

const KEY_PREFIX = "KEY_";
const SESSION_PREFIX = "SI_";

export type IMsgConn = {
  send?: (buf:Buffer|Uint8Array) => void,
  sendPduWithCallback?:  (pdu:Pdu,timeout: number) => Promise<Pdu>
}

export type ISession = {
  uid:string,ts:number,sign:Buffer,address:string
}

let currentAccountId: number;
let accountIds: number[] = [];
let accounts: Record<number, Account> = {};
let kvStore:LocalStorage | CloudFlareKv | undefined = undefined

export default class Account {
  private accountId: number;
  private uid?: string;
  private userInfo?: object;
  private shareKey?: Buffer;
  private iv?: Buffer;
  private aad?: Buffer;
  private entropy?:string;
  private address: string | undefined;
  private session: ISession | undefined;
  private msgConn?: WebSocket | IMsgConn;
  constructor(accountId: number) {
    this.accountId = accountId;
    this.address = undefined;
    this.uid = "";
    this.session = undefined;
  }
  static getKv(){
    return kvStore!;
  }
  static setKvStore(kv:LocalStorage | CloudFlareKv){
    kvStore = kv;
  }

  setSession(session?:ISession){
    this.session = session
  }

  getSession(){
    return this.session
  }

  async saveSession(){
    await Account.getKv().put(`${SESSION_PREFIX}${this.accountId}`,JSON.stringify({
      ...this.session,
      sign:this.session!.sign.toString('hex')
    }))
  }


  async delSession(){
    this.setSession(undefined);
    await Account.getKv().delete(`${SESSION_PREFIX}${this.accountId}`)
  }

  async loadSession(){
    const res = await Account.getKv().get(`${SESSION_PREFIX}${this.accountId}`);
    if(res){
      const data = JSON.parse(res);
      this.setSession({
        ...data,
        sign:Buffer.from(data.sign,"hex")
      })
      return this.getSession();
    } else {
      return null;
    }
  }

  async getUidFromCacheByAddress(address:string){
    const uid_cache = await Account.getKv().get(`ADR_UID_${address}`)
    return uid_cache || undefined;
  }
  async afterServerLoginOk({uid,sign,ts,address}:AuthLoginReq_Type){
    this.setUid(uid);
    this.setSession({uid,sign,ts,address});
    const uid_cache = await Account.getKv().get(`ADR_UID_${address}`)
    if(!uid_cache){
      await Account.getKv().put(`ADR_UID_${address}`,uid)
    }
  }

  getShareKey() {
    return this.shareKey!;
  }
  getIv() {
    return this.iv!;
  }
  getAad() {
    return this.aad!;
  }

  getAccountId() {
    return this.accountId;
  }
  getAddress() {
    return this.address;
  }
  setAddress(address: string) {
    this.address = address;
  }
  setUid(uid: string) {
    this.uid = uid;
  }

  setUserInfo(userInfo: object) {
    this.userInfo = userInfo;
  }

  getUserInfo() {
    return this.userInfo ;
  }

  getUid() {
    return this.uid;
  }

  async verifyPwd(pwd:string){
    const hash = hashSha256(pwd);
    const entropy = await this.getEntropy();
    const address = Account.getAddressFromEntropy(entropy,hash)
    return address === this.getAddress();
  }

  static getAddressFromEntropy(entropy:string,pasword?:string){
    let wallet = new Wallet(Mnemonic.fromEntropy(entropy),pasword);
    const ethWallet = wallet.getPTPWallet(0);
    return ethWallet.address;
  }
  async getAccountAddress() {
    const address = this.getAddress();
    if (!address) {
      const entropy = await this.getEntropy();
      this.address = Account.getAddressFromEntropy(entropy);
      return this.address!;
    } else {
      return address;
    }
  }
  genEntropy(){
    let mnemonic = new Mnemonic();
    this.entropy = mnemonic.toEntropy();
  }

  async encryptByPubKey(plain:Buffer,password?:string):Promise<Buffer>{
    const entropy = await this.getEntropy();
    let wallet = new Wallet(Mnemonic.fromEntropy(entropy),password);
    let { pubKey_,address } = wallet.getPTPWallet(0);
    return EthEcies.encrypt(pubKey_, plain)
  }

  async decryptByPrvKey(cipher:Buffer,password?:string ):Promise<Buffer>{
    const entropy = await this.getEntropy();
    let wallet = new Wallet(Mnemonic.fromEntropy(entropy),password);
    let { prvKey,address } = wallet.getPTPWallet(0);
    return EthEcies.decrypt(prvKey, cipher)
  }

  async setEntropy(entropy:string) {
    this.entropy = entropy;
    const key = sha256(
      Buffer.from(`${KEY_PREFIX}${this.getAccountId()}`)
    ).toString('hex');
    let cipher = encrypt(
      Buffer.from(entropy, 'hex'),
      Buffer.from(key.substring(0, 16)),
      Buffer.from(key.substring(16, 32))
    );
    await Account.getKv().put(
      `${KEY_PREFIX}${key}`,
      cipher.toString('hex')
    );
  }

  async getEntropy() {
    if(this.entropy){
      return this.entropy
    }
    const key = sha256(
      Buffer.from(`${KEY_PREFIX}${this.getAccountId()}`)
    ).toString('hex');
    let entropy = await Account.getKv().get(`${KEY_PREFIX}${key}`);
    if (!entropy) {
      let mnemonic = new Mnemonic();
      entropy = mnemonic.toEntropy();
      let cipher = encrypt(
        Buffer.from(entropy, 'hex'),
        Buffer.from(key.substring(0, 16)),
        Buffer.from(key.substring(16, 32))
      );
      await Account.getKv().put(
        `${KEY_PREFIX}${key}`,
        cipher.toString('hex')
      );
    } else {
      const plain = decrypt(
        Buffer.from(entropy, 'hex'),
        Buffer.from(key.substring(0, 16)),
        Buffer.from(key.substring(16, 32))
      );
      entropy = plain.toString('hex');
    }
    this.entropy = entropy;
    return entropy;
  }

  async initEcdh(serverPubKey: Buffer, iv: Buffer, aad: Buffer) {
    const entropy = await this.getEntropy();
    let wallet = new Wallet(Mnemonic.fromEntropy(entropy));
    const ethWallet = wallet.getPTPWallet(0);
    this.shareKey = Buffer.from(ecdh(serverPubKey, ethWallet.prvKey));
    // console.log("shareKey",this.shareKey)
    this.aad = aad;
    this.iv = iv;
  }

  aesEncrypt(plainData: Buffer) {
    return Aes256Gcm.encrypt(
      plainData,
      this.getShareKey(),
      this.getIv(),
      this.getAad()
    );
  }

  aesDecrypt(cipherData: Buffer) {
    return Aes256Gcm.decrypt(
      cipherData,
      this.getShareKey(),
      this.getIv(),
      this.getAad()
    );
  }

  async signMessage(message: string,password?: string | undefined) {
    const entropy = await this.getEntropy();
    let wallet = new Wallet(Mnemonic.fromEntropy(entropy),password);
    const ethWallet = wallet.getPTPWallet(0);
    const ecdsa = new EcdsaHelper({
      pubKey: ethWallet.pubKey,
      prvKey: ethWallet.prvKey,
    });
    return {address:ethWallet.address,sign:ecdsa.sign(message)};
  }

  verifyRecoverAddress(sig: Buffer, message: string) {
    return EcdsaHelper.recoverAddress({ message, sig });
  }

  recoverAddressAndPubKey(sig: Buffer, message: string) {
    return EcdsaHelper.recoverAddressAndPubKey({ message, sig });
  }

  async addEntropy(entropy: string) {
    const key = sha256(
      Buffer.from(`${KEY_PREFIX}${this.getAccountId()}`)
    ).toString('hex');
    let cipher = encrypt(
      Buffer.from(entropy, 'hex'),
      Buffer.from(key.substring(0, 16)),
      Buffer.from(key.substring(16, 32))
    );
    await Account.getKv().put(
      `${KEY_PREFIX}` + key,
      cipher.toString('hex')
    );
  }

  setMsgConn(msgConn:WebSocket | IMsgConn){
    this.msgConn = msgConn
  }

  sendPdu(pdu: Pdu,seq_num:number = 0){
    if(seq_num > 0){
      pdu.updateSeqNo(seq_num)
    }
    console.log("[SEND]","seq_num",pdu.getSeqNum(),"cid:",getActionCommandsName(pdu.getCommandId()))
    this.msgConn?.send!(pdu.getPbData());
  }
  async sendPduWithCallback(pdu: Pdu){
    // @ts-ignore
    return this.msgConn?.sendPduWithCallback(pdu);
  }

  static getCurrentAccount() {
    if (currentAccountId) {
      return Account.getInstance(currentAccountId);
    } else {
      return null;
    }
  }
  static genAccountId(){
    return +(new Date())
  }
  static getCurrentAccountId() {
    if(currentAccountId){
      return currentAccountId;
    }else{
      let accountId:number | string | null = localStorage.getItem("CurrentAccountId");
      if(!accountId){
        accountId = Account.genAccountId();
      }else{
        accountId = parseInt(accountId)
        Account.getKv().put("CurrentAccountId",String(accountId));
      }
      Account.setCurrentAccountId(accountId);
      return accountId;
    }
  }

  static setCurrentAccountId(accountId: number) {
    const accountIdsStr =  localStorage.getItem("AccountIds");;
    accountIds = accountIdsStr ? JSON.parse(accountIdsStr) : []
    if(!accountIds.includes(accountId)){
      accountIds.push(accountId);
      Account.getKv().put("AccountIds",JSON.stringify(accountIds));
    }
    Account.getKv().put("CurrentAccountId",String(accountId));
    currentAccountId = accountId;
  }

  static getInstance(accountId: number) {
    if (!accounts[accountId]) {
      accounts[accountId] = new Account(accountId);
    }
    return accounts[accountId];
  }
}
