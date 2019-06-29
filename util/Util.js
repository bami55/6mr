'use strict';

class Util {
  constructor() {
    throw new Error(`The ${this.constructor.name} class may not be instantiated.`);
  }

  /**
   * カテゴリにチャンネルを作成する
   * @param {*} categoryChannel
   * @param {*} channelName
   * @param {*} type
   */
  static async createChannelInCategory(categoryChannel, channelName, type) {
    const channel = await categoryChannel.guild.createChannel(channelName, {
      type: type
    });
    await channel.setParent(categoryChannel);
    await channel.lockPermissions();
    return channel;
  }

  /**
   * カテゴリのチャンネルを削除する
   * @param {*} guild
   * @param {*} categoryId
   */
  static async deleteCategory(guild, categoryId) {
    const category = guild.channels.get(categoryId);
    if (category) {
      await category.children.forEach(ch => ch.delete());
      await this.sleep(1000);
      category.delete();
    }
  }

  /**
   * スリープ
   * @param {*} t
   */
  static async sleep(t) {
    return await new Promise(r => {
      setTimeout(() => {
        r();
      }, t);
    });
  }

  /**
   * Color Hex を Int に変換
   * @param {*} color
   */
  static convertColorInt(color) {
    return parseInt(color.replace(/#/gi, ''), 16);
  }
}

module.exports = Util;
