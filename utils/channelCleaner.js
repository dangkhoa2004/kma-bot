// utils/channelCleaner.js
const { ChannelType } = require('discord.js');
const { logInfo, logWarn, logError } = require('./logger');

async function findOldBotEmbedMessages(client, channel, embedColor, buttonId = null) {
    const messagesToDelete = [];
    if (!channel || channel.type !== ChannelType.GuildText) return { messagesToDelete };

    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        messages.forEach(msg => {
            let isTargetEmbed =
                msg.author.id === client.user.id &&
                msg.embeds.length > 0 &&
                msg.embeds[0].color === embedColor;

            let isTargetButton =
                buttonId &&
                msg.author.id === client.user.id &&
                msg.components.length > 0 &&
                msg.components[0]?.components[0]?.customId === buttonId;

            if (isTargetEmbed || isTargetButton) {
                messagesToDelete.push(msg);
            }
        });
    } catch (error) {
        logError(`[Dọn Kênh] Lỗi khi tìm tin nhắn cũ trong kênh ${channel.id}:`, error);
    }
    return { messagesToDelete };
}

async function clearOldMessages(channel, messagesToDelete) {
    let deletedCount = 0;
    if (!channel || !messagesToDelete || messagesToDelete.length === 0) return deletedCount;
    logInfo(`[Dọn Kênh] Đang xóa ${messagesToDelete.length} tin nhắn cũ trong kênh ${channel.name}...`);
    try {
        const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        const recentMessages = messagesToDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);
        const oldMessages = messagesToDelete.filter(msg => msg.createdTimestamp <= twoWeeksAgo);

        if (recentMessages.length > 0) {
            await channel.bulkDelete(recentMessages, true).catch(err => {
                if (err.code !== 10008) {
                    logWarn(`[Dọn Kênh] Xóa hàng loạt thất bại: ${err.message}`);
                }
            });
            deletedCount += recentMessages.length;
        }

        if (oldMessages.length > 0) {
             for (const msg of oldMessages) {
                 try {
                    await msg.delete();
                    deletedCount++;
                 } catch (e) {
                    if (e.code !== 10008) {
                        logWarn(`[Dọn Kênh] Không thể xóa tin nhắn cũ ${msg.id}: ${e.message}`);
                    }
                 }
                 await new Promise(resolve => setTimeout(resolve, 350));
            }
        }
        logInfo(`[Dọn Kênh] Đã cố gắng xóa ${messagesToDelete.length}, đã xóa thành công ${deletedCount} tin nhắn cũ.`);
    } catch (error) {
        if (error.code === 50034) {
             logWarn(`[Dọn Kênh] Xóa hàng loạt thất bại (cũ hơn 14 ngày) trong kênh ${channel.name}. Đã thử xóa riêng lẻ.`);
        } else if (error.code !== 50013) {
             logError(`[Dọn Kênh] Lỗi khi dọn dẹp tin nhắn trong kênh ${channel.id}:`, error);
        }
    }
    return deletedCount;
}

module.exports = { findOldBotEmbedMessages, clearOldMessages };