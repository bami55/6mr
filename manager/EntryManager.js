'use strict';

require('dotenv').config();
const matchConfig = require(__dirname + '/../config/match.json');
const db = require(__dirname + '/../database/models/index.js');
const _recruit_emoji = matchConfig.reaction_emoji;
const _event_type_add = 'MESSAGE_REACTION_ADD';

const discord = require('discord.js');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

class EntryManager {
  constructor() {
    throw new Error(`The ${this.constructor.name} class may not be instantiated.`);
  }

  /**
   * エントリー処理
   * @param {*} client
   * @param {*} type
   * @param {*} data
   */
  static async entry(client, type, data) {
    // bot or 指定絵文字以外は中断
    const user = client.users.get(data.user_id);
    if (user.bot) return;
    if (data.emoji.name !== _recruit_emoji) return;

    const guild = client.guilds.get(data.guild_id);
    if (!guild) return;

    const matchDiscoInfo = await db.match_discord_info.findOne({
      where: { message_id: data.message_id }
    });
    if (!matchDiscoInfo) return;

    // すでに募集が終了していたら中断
    if (await this.isRecruitClosed(data.message_id)) return;

    const channel = await client.channels.get(data.channel_id);
    const message = await channel.fetchMessage(data.message_id);
    const match = await db.matches.findOne({
      where: { match_id: matchDiscoInfo.match_id }
    });

    // エントリーチェック
    const reaction = message.reactions.find(r => r.emoji.name === data.emoji.name);
    if (type === _event_type_add) {
      const isEnabled = await this.entryEnabled(channel, user, match, match.match_tier);
      if (!isEnabled) {
        if (reaction) await reaction.remove(user);
        return;
      }
    }

    // リアクションユーザー全取得
    let entryUsers = await this.getReactionUsers(guild, reaction);

    // リアクションユーザーのDB登録
    await this.updateMatchUsers(match.match_id, entryUsers.id);

    // Embed Field 設定
    const embed = message.embeds.shift();
    if (!embed) return;
    const new_embed = new discord.RichEmbed(embed);

    // エントリー一覧
    let field_entry = new_embed.fields.find(f => f.name === matchConfig.embed_field.entry);
    if (entryUsers.name.length === 0) {
      field_entry.value = matchConfig.entry_none;
    } else {
      field_entry.value = entryUsers.name.join('\n');
    }

    // 残り人数
    const entrySize = matchConfig.entry_size;
    const remaining = entrySize - entryUsers.name.length;
    let field_remaining = new_embed.fields.find(f => f.name === matchConfig.embed_field.remaining);
    field_remaining.value = remaining;

    // 募集人数に達した場合
    if (remaining <= 0) {
      let new_field_status = new_embed.fields.find(f => f.name === matchConfig.embed_field.status);
      new_field_status.value = matchConfig.embed_status.closed;

      // チーム分け
      const teams = await this.chooseUpTeam(match.match_id);
      const blueFieldValue = this.getTeamPlayerFieldValue(guild, teams.blue);
      const orangeFieldValue = this.getTeamPlayerFieldValue(guild, teams.orange);

      // 試合情報、チーム情報のEmbedを作成
      const teamEmbed = new discord.RichEmbed()
        .setColor('#0099ff')
        .setTitle(embed.title)
        .addField(matchConfig.embed_field.team_blue, blueFieldValue, true)
        .addField(matchConfig.embed_field.team_orange, orangeFieldValue, true);

      // メンションでエントリーユーザーに通知
      // ${entryUsers.mention.join(' ')}\n
      channel.send(`${matchConfig.notification}`, {
        embed: teamEmbed
      });

      // 試合ステータス変更
      this.changeMatchStatus(match, entryUsers.id);

      // 部屋作成
      this.createMatchChannel(guild, match, entryUsers.id);
    }
    message.edit(new_embed);
  }

  /**
   * 募集が終了しているか？
   * @param {*} message_id
   */
  static async isRecruitClosed(message_id) {
    const matchDiscoInfo = await db.match_discord_info.findOne({
      where: {
        message_id: message_id
      },
      raw: true,
      include: [
        {
          model: db.matches,
          required: true,
          where: { status: matchConfig.status.open }
        }
      ]
    });
    return !matchDiscoInfo;
  }

  /**
   * ユーザーがエントリー可能か？
   * @param {*} channel
   * @param {*} user
   * @param {*} match_id
   * @param {*} match_tier
   */
  static async entryEnabled(channel, user, match_id, match_tier) {
    const userInfo = await db.users.findOne({ where: { discord_id: user.id } });
    if (!userInfo) {
      await channel.send(`<@${user.id}> 先にユーザー登録してください`);
      return false;
    }

    if (userInfo.tier !== match_tier) {
      await channel.send(`<@${user.id}> Tierが違います`);
      return false;
    }

    const matchUsers = await db.match_users.findAll({
      where: {
        discord_id: user.id
      },
      raw: true,
      include: [
        {
          model: db.matches,
          required: true,
          where: {
            match_id: {
              [Op.ne]: match_id
            },
            status: matchConfig.status.open
          }
        }
      ]
    });
    if (matchUsers.length > 0) {
      const mentions = matchUsers.map(matchUser => `【${matchUser.match_id}】`);
      await channel.send(
        `<@${user.id}> 他の試合でエントリー中です\nエントリー中：${mentions.join()}`
      );
      return false;
    }
    return true;
  }

  /**
   * リアクションユーザ－情報取得
   * @param {*} guild
   * @param {*} reaction
   */
  static async getReactionUsers(guild, reaction) {
    let entryUsers = {
      user: [],
      id: [],
      name: [],
      mention: []
    };

    if (reaction) {
      const reactionUsers = await reaction.fetchUsers();
      reactionUsers.forEach(user => {
        if (!user.bot) {
          entryUsers.user.push(user);
          entryUsers.id.push(user.id);
          entryUsers.name.push(guild.member(user).displayName);
          entryUsers.mention.push(`<@${user.id}>`);
        }
      });
    }

    return entryUsers;
  }

  /**
   * リアクションのユーザー一覧をDBに反映
   * @param {*} matchId
   * @param {*} entryUserIds
   */
  static async updateMatchUsers(matchId, entryUserIds) {
    // リアクションが外れているユーザーを削除
    const matchUsers = await db.match_users.findAll({
      where: { match_id: matchId }
    });
    const deleteArray = matchUsers.filter(user => !entryUserIds.includes(user.discord_id));
    if (deleteArray) {
      for (let i = 0; i < deleteArray.length; i++) {
        await db.match_users.destroy({
          where: {
            match_id: matchId,
            discord_id: deleteArray[i].discord_id
          }
        });
      }
    }

    // リアクションがついたユーザーを登録
    for (let i = 0; i < entryUserIds.length; i++) {
      const matchUsers = await db.match_users.findOne({
        where: {
          match_id: matchId,
          discord_id: entryUserIds[i]
        }
      });
      if (!matchUsers) {
        await db.match_users.create({
          match_id: matchId,
          discord_id: entryUserIds[i],
          team: 0
        });
      }
    }
  }

  /**
   * チーム分け
   * @param {*} matchId
   */
  static async chooseUpTeam(matchId) {
    let teams = {
      blue: [],
      orange: []
    };

    // プレイヤーをレートの降順、勝数の降順、負数の昇順でソートする
    const players = await db.match_users.findAll({
      where: {
        match_id: matchId
      },
      raw: true,
      include: [
        {
          model: db.users,
          required: true
        }
      ],
      order: [[db.users, 'rate', 'DESC'], [db.users, 'win', 'DESC'], [db.users, 'lose', 'ASC']]
    });

    // 上から順にプレイヤーを分配していく
    if (players) {
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        if (i % 2 === 0) {
          teams.blue.push(player);
          this.updateMatchPlayerTeam(player, matchConfig.team.blue);
        } else {
          teams.orange.push(player);
          this.updateMatchPlayerTeam(player, matchConfig.team.orange);
        }
      }
    }
    return teams;
  }

  /**
   * プレイヤーのチーム分け結果をDBに反映する
   * @param {*} player
   * @param {*} team
   */
  static updateMatchPlayerTeam(player, team) {
    db.match_users.update(
      {
        match_id: player.match_id,
        discord_id: player.discord_id,
        team: team
      },
      {
        where: {
          match_id: player.match_id,
          discord_id: player.discord_id
        }
      }
    );
  }

  /**
   * チームプレイヤーのフィールド出力値取得
   * @param {*} guild
   * @param {*} players
   */
  static getTeamPlayerFieldValue(guild, players) {
    if (players.length === 0) return '-';
    const mentions = players.map(player => `<@${player.discord_id}>`);
    return mentions.join('\n');
  }

  /**
   * 試合ステータス変更
   * @param {*} match
   * @param {*} entryUsersId
   */
  static async changeMatchStatus(match, entryUsersId) {
    // ステータス更新
    let updMatch = {
      match_id: match.match_id,
      match_tier: match.tier,
      status: matchConfig.status.in_progress
    };
    await db.matches.update(updMatch, {
      where: {
        match_id: match.match_id
      }
    });
  }

  /**
   * 試合用のチャンネルを作成する
   * @param {*} guild
   * @param {*} match
   * @param {*} entryUsersId
   */
  static async createMatchChannel(guild, match, entryUsersId) {
    const matchId = match.match_id;
    const tier = await db.tiers.findOne({ where: { tier: match.match_tier } });

    // カテゴリチャンネル作成
    const role = guild.roles.get(tier.role_id);
    const categoryChannel = await guild.createChannel(`${role.name}【${matchId}】`, {
      type: 'category',
      permissionOverwrites: [
        {
          id: guild.id,
          deny: ['VIEW_CHANNEL']
        }
      ]
    });

    // エントリーがあったプレイヤーの権限を設定する
    for (let i = 0; i < entryUsersId.length; i++) {
      const member = guild.members.get(entryUsersId[i]);
      await categoryChannel.overwritePermissions(member, {
        VIEW_CHANNEL: true
      });
    }

    // 試合用チャンネル情報を更新する
    let matchDiscordInfo = await db.match_discord_info.findOne({
      where: { match_id: matchId }
    });
    let updDiscordInfo = {
      match_id: matchDiscordInfo.match_id,
      message_id: matchDiscordInfo.id,
      category_id: categoryChannel.id
    };

    // 試合用チャンネルをカテゴリ内に作成
    let vc = null;

    // Waiting Room VoiceChannel
    vc = await this.createChannelInCategory(categoryChannel, `【${matchId}】WaitingRoom`);
    updDiscordInfo.waiting_voice_ch_id = vc.id;

    // Blue Team VoiceChannel
    vc = await this.createChannelInCategory(categoryChannel, `【${matchId}】Blue`);
    updDiscordInfo.team0_voice_ch_id = vc.id;

    // Orange Team VoiceChannel
    vc = await this.createChannelInCategory(categoryChannel, `【${matchId}】Orange`);
    updDiscordInfo.team1_voice_ch_id = vc.id;

    // DBに試合用チャンネル情報を登録
    await db.match_discord_info.update(updDiscordInfo, {
      where: {
        match_id: matchId
      }
    });
  }

  /**
   * カテゴリにボイスチャンネルを作成する
   * @param {*} categoryChannel
   * @param {*} channelName
   */
  static async createChannelInCategory(categoryChannel, channelName) {
    const voiceChannel = await categoryChannel.guild.createChannel(channelName, {
      type: 'voice'
    });
    await voiceChannel.setParent(categoryChannel);
    await voiceChannel.lockPermissions();
    return voiceChannel;
  }
}

module.exports = EntryManager;
