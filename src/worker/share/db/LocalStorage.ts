export default class LocalStorage {
  private db: any;
  constructor() {
    this.init()
  }
  init() {
    this.db = window.localStorage;
  }

  async put(key: string, value: any) {
    return this.db.setItem(key, value);
  }

  async get(key: string) {
    return this.db.getItem(key);
  }

  async delete(key: string) {
    return this.db.removeItem(key);
  }
}
