// features/github/repoUpdater.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { getAllUserRepos, createSingleRepoEmbed } = require('../../utils/githubHelper');
const { findOldBotEmbedMessages, clearOldMessages } = require('../../utils/channelCleaner');
const { logInfo, logWarn, logError } = require('../../utils/logger');

const REPO_EMBED_COLOR = parseInt(process.env.REPO_EMBED_COLOR || '0x5865f2');
const REPO_REFRESH_BUTTON_ID = process.env.REPO_REFRESH_BUTTON_ID || 'refresh-github-repos';
const REPO_DISPLAY_LIMIT = parseInt(process.env.REPO_DISPLAY_LIMIT || '10');
const githubToken = process.env.GITHUB_TOKEN;

async function updateGitHubReposLogic(client, channel) {
    if (!channel || channel.type !== ChannelType.GuildText) {
        logWarn(`[GitHub Repo] Kênh không hợp lệ.`);
        return;
    }
    logInfo(`[GitHub Repo] Bắt đầu cập nhật Edit/Add/Delete cho kênh: ${channel.name}`);
    let createdCount = 0, editedCount = 0;
    const delayMs = 600;

    try {
        const { messagesToDelete: oldRepoEmbedMessages } = await findOldBotEmbedMessages(client, channel, REPO_EMBED_COLOR);
        const existingMessagesMap = new Map();
        oldRepoEmbedMessages.forEach(msg => {
            if(msg.embeds[0]?.url) existingMessagesMap.set(msg.embeds[0].url, msg);
        });

        const { repos: allNewRepos, username: targetUsername } = await getAllUserRepos(githubToken);
        const totalRepos = allNewRepos.length;
        const reposToProcess = allNewRepos.slice(0, REPO_DISPLAY_LIMIT);

        for (const repo of reposToProcess) {
            if (!repo || !repo.html_url) continue;
            const newEmbed = createSingleRepoEmbed(repo);
            const repoUrl = repo.html_url;
            const existingMessage = existingMessagesMap.get(repoUrl);

            if (existingMessage) {
                try {
                    await existingMessage.edit({ embeds: [newEmbed] });
                    editedCount++;
                    existingMessagesMap.delete(repoUrl);
                } catch (editError) { logError(`[GitHub Repo] Lỗi chỉnh sửa ${repo.name}:`, editError); }
            } else {
                try {
                    await channel.send({ embeds: [newEmbed] });
                    createdCount++;
                } catch (sendError) { logError(`[GitHub Repo] Lỗi gửi ${repo.name}:`, sendError); }
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        logInfo(`[GitHub Repo] Đã xử lý ${reposToProcess.length} repo (Tạo: ${createdCount}, Sửa: ${editedCount}).`);

        const messagesToDeleteDirectly = Array.from(existingMessagesMap.values());
        if (messagesToDeleteDirectly.length > 0) {
            await clearOldMessages(channel, messagesToDeleteDirectly);
        }

        const { messagesToDelete: oldControlButtons } = await findOldBotEmbedMessages(client, channel, null, REPO_REFRESH_BUTTON_ID);
        await clearOldMessages(channel, oldControlButtons);

        await new Promise(resolve => setTimeout(resolve, 300));

        const refreshButton = new ButtonBuilder().setCustomId(REPO_REFRESH_BUTTON_ID).setLabel('Làm mới Repositories').setStyle(ButtonStyle.Primary).setEmoji('🔄');
        const row = new ActionRowBuilder().addComponents(refreshButton);
        let controlMessageContent = `Hiển thị ${reposToProcess.length}/${totalRepos} repositories của **${targetUsername}** (sắp xếp theo ngày tạo, cũ nhất trước).`;
        if (totalRepos > REPO_DISPLAY_LIMIT) {
             const userReposUrl = `https://github.com/${targetUsername}?tab=repositories`;
             controlMessageContent += `\n🔗 **[Xem tất cả ${totalRepos} repositories trên GitHub](${userReposUrl})**`;
        }
        await channel.send({ content: controlMessageContent, components: [row] });
        logInfo(`[GitHub Repo] Đã gửi tin nhắn điều khiển repo mới.`);

    } catch (error) {
        logError(`[GitHub Repo] Lỗi cập nhật nghiêm trọng (${channel.id}):`, error);
        try { await channel.send(`❌ Lỗi cập nhật danh sách repo: ${error.message}`); }
        catch (sendError) { logError(`Không thể gửi lỗi vào kênh Repo ${channel.id}`, sendError); }
    }
}

module.exports = { updateGitHubReposLogic };