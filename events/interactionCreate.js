// events/interactionCreate.js
const { Events } = require("discord.js");
const { logInfo, logError } = require("../utils/logger");
const { updateGitHubReposLogic } = require("../features/github/repoUpdater");
const { updateRecentCommits } = require("../features/github/commitUpdater");

const REPO_REFRESH_BUTTON_ID =
  process.env.REPO_REFRESH_BUTTON_ID || "refresh-github-repos";
const COMMIT_REFRESH_BUTTON_ID =
  process.env.COMMIT_REFRESH_BUTTON_ID || "refresh-github-commits";
const githubRepoChannelId = process.env.GITHUB_CHANNEL_ID;
const githubCommitsChannelId = process.env.COMMITS_CHANNEL_ID;

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction.isButton()) return;

    if (
      interaction.customId === REPO_REFRESH_BUTTON_ID &&
      interaction.channelId === githubRepoChannelId
    ) {
      logInfo(
        `[TƯƠNG TÁC] Nút làm mới REPO được nhấn bởi ${interaction.user.tag}`
      );
      try {
        await interaction.reply({
          content: "🔄 Đang làm mới danh sách repositories...",
          ephemeral: true,
        });
        await updateGitHubReposLogic(client, interaction.channel);
        logInfo(`[TƯƠNG TÁC] Hoàn tất làm mới REPO qua nút.`);
        await interaction
          .editReply({ content: "✅ Danh sách repositories đã được làm mới!" })
          .catch(() => {});
      } catch (error) {
        logError(`[TƯƠNG TÁC] Lỗi nút làm mới REPO:`, error);
        try {
          await interaction
            .editReply({ content: `❌ Lỗi làm mới Repo: ${error.message}` })
            .catch(() => {});
        } catch (e) {
          console.error("Không thể gửi phản hồi lỗi tương tác Repo");
        }
      }
      return;
    }

    if (
      interaction.customId === COMMIT_REFRESH_BUTTON_ID &&
      interaction.channelId === githubCommitsChannelId
    ) {
      logInfo(
        `[TƯƠNG TÁC] Nút làm mới COMMIT được nhấn bởi ${interaction.user.tag}`
      );
      try {
        await interaction.reply({
          content: "🔄 Đang làm mới danh sách commits...",
          ephemeral: true,
        });
        await updateRecentCommits(client, interaction.channel);
        logInfo(`[TƯƠNG TÁC] Hoàn tất làm mới COMMIT qua nút.`);
        await interaction
          .editReply({ content: "✅ Danh sách commits đã được làm mới!" })
          .catch(() => {});
      } catch (error) {
        logError(`[TƯƠNG TÁC] Lỗi nút làm mới COMMIT:`, error);
        try {
          await interaction
            .editReply({ content: `❌ Lỗi làm mới Commit: ${error.message}` })
            .catch(() => {});
        } catch (e) {
          console.error("Không thể gửi phản hồi lỗi tương tác Commit");
        }
      }
      return;
    }
  },
};
