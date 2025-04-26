// features/github/commitUpdater.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { generateCommitEmbedsArray, COMMIT_EMBED_COLOR } = require('../../utils/githubCommitsHelper');
const { findOldBotEmbedMessages, clearOldMessages } = require('../../utils/channelCleaner');
const { logInfo, logWarn, logError } = require('../../utils/logger');

const COMMIT_REFRESH_BUTTON_ID = process.env.COMMIT_REFRESH_BUTTON_ID || 'refresh-github-commits';
const COMMIT_DISPLAY_LIMIT = parseInt(process.env.COMMIT_DISPLAY_LIMIT || '15');
const githubToken = process.env.GITHUB_TOKEN;

async function updateRecentCommits(client, channel) {
    if (!channel || channel.type !== ChannelType.GuildText) {
        logWarn(`[GitHub Commit] Kênh không hợp lệ được cung cấp.`);
        return;
    }
    logInfo(`[GitHub Commit] Bắt đầu cập nhật commit cho kênh: ${channel.name}`);
    try {
        const { messagesToDelete: oldCommitMessages } = await findOldBotEmbedMessages(client, channel, COMMIT_EMBED_COLOR, COMMIT_REFRESH_BUTTON_ID);
        await clearOldMessages(channel, oldCommitMessages);
        await new Promise(resolve => setTimeout(resolve, 500));

        const { embeds: commitEmbedsArray, displayCount, username } = await generateCommitEmbedsArray(githubToken, COMMIT_DISPLAY_LIMIT);

        logInfo(`[GitHub Commit] Đang gửi ${commitEmbedsArray.length} embed commit mới...`);
        for (let i = 0; i < commitEmbedsArray.length; i++) {
            try {
                await channel.send({ embeds: [commitEmbedsArray[i]] });
            } catch (sendErr) { logError(`[GitHub Commit] Lỗi gửi embed commit #${i + 1}:`, sendErr); }
            await new Promise(resolve => setTimeout(resolve, 350));
        }
        logInfo(`[GitHub Commit] Đã gửi ${commitEmbedsArray.length} embed commit.`);

        const refreshButton = new ButtonBuilder().setCustomId(COMMIT_REFRESH_BUTTON_ID).setLabel('Làm mới Commits').setStyle(ButtonStyle.Success).setEmoji('🔄');
        const row = new ActionRowBuilder().addComponents(refreshButton);
        const controlMessageContent = `Hiển thị ${displayCount} commit gần đây nhất của **${username}**.`;
        await channel.send({ content: controlMessageContent, components: [row] });
        logInfo(`[GitHub Commit] Đã gửi tin nhắn điều khiển commit mới.`);

    } catch (error) {
        logError(`[GitHub Commit] Lỗi cập nhật nghiêm trọng (${channel.id}):`, error);
        try { await channel.send(`❌ Lỗi cập nhật danh sách commit: ${error.message}`); }
        catch (sendError) { logError(`Không thể gửi lỗi đến kênh Commits ${channel.id}`, sendError); }
    }
}

module.exports = { updateRecentCommits };