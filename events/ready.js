// events/ready.js
const { Events, ChannelType, PermissionsBitField } = require("discord.js");
const { logInfo, logWarn, logError } = require("../utils/logger");
const { updateGitHubReposLogic } = require("../features/github/repoUpdater");
const { updateRecentCommits } = require("../features/github/commitUpdater");

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logInfo(`Bot đã đăng nhập với tên ${client.user.tag}`);

    const githubRepoChannelId = process.env.GITHUB_CHANNEL_ID;
    const githubCommitsChannelId = process.env.COMMITS_CHANNEL_ID;

    if (githubRepoChannelId) {
      try {
        const repoChannel = await client.channels.fetch(githubRepoChannelId);
        if (repoChannel && repoChannel.type === ChannelType.GuildText) {
          const perms = repoChannel.permissionsFor(client.user);
          const requiredPerms = [
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageMessages,
            PermissionsBitField.Flags.EmbedLinks,
          ];
          if (!perms || !perms.has(requiredPerms)) {
            logWarn(
              `Bot thiếu quyền cần thiết trong kênh danh sách Repo ${repoChannel.name}.`
            );
          } else {
            await updateGitHubReposLogic(client, repoChannel);
          }
        } else {
          logWarn(
            `Kênh danh sách Repo (${githubRepoChannelId}) không tìm thấy hoặc không phải là kênh văn bản.`
          );
        }
      } catch (error) {
        logError(
          `Lỗi khi xử lý kênh danh sách Repo (${githubRepoChannelId}) khi khởi động:`,
          error
        );
      }
    }

    if (githubCommitsChannelId) {
      try {
        const commitChannel = await client.channels.fetch(
          githubCommitsChannelId
        );
        if (commitChannel && commitChannel.type === ChannelType.GuildText) {
          const perms = commitChannel.permissionsFor(client.user);
          const requiredPerms = [
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ReadMessageHistory,
            PermissionsBitField.Flags.ManageMessages,
            PermissionsBitField.Flags.EmbedLinks,
          ];
          if (!perms || !perms.has(requiredPerms)) {
            logWarn(
              `Bot thiếu quyền cần thiết trong kênh Commits ${commitChannel.name}.`
            );
          } else {
            await updateRecentCommits(client, commitChannel);
          }
        } else {
          logWarn(
            `Kênh Commits (${githubCommitsChannelId}) không tìm thấy hoặc không phải là kênh văn bản.`
          );
        }
      } catch (error) {
        logError(
          `Lỗi khi xử lý kênh Commits (${githubCommitsChannelId}) khi khởi động:`,
          error
        );
      }
    }
  },
};
