const { Events } = require('discord.js');
const { logInfo, logWarn, logError } = require('../utils/logger');
const { checkAskCommandChannel, checkCalendarCommandChannel } = require("../utils/channelRestrictions");
const { askGemini } = require("../utils/gemini");

module.exports = {
	name: Events.MessageCreate,
	async execute(message, client) {
		if (message.author.bot || !message.guild) return;

        const geminiApiKey = process.env.GEMINI_API_KEY;
        const qnaChannelId = process.env.QNA_CHANNEL_ID;
        const calenChannelId = process.env.CALEN_CHANNEL_ID;

        if (message.content.startsWith("!")) {
            const args = message.content.slice(1).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const command = client.commands.get(commandName);

            if (command) {
            try {
                if (qnaChannelId && await checkAskCommandChannel(message, commandName, qnaChannelId)) return;
                if (calenChannelId && await checkCalendarCommandChannel(message, commandName, calenChannelId)) return;

                await command.execute(message, args, client);
            } catch (error) {
                logError(`Lỗi thực thi lệnh !${commandName}:`, error);
                await message.reply("❌ Lỗi thực thi lệnh.").catch(() => {});
            }
            }
            return;
        }

        if ( qnaChannelId && geminiApiKey && message.channel.id === qnaChannelId ) {
            logInfo(`[QnA] Xử lý tin nhắn từ ${message.author.tag} trong kênh QnA.`);
            message.channel.sendTyping();
            try {
            const aiReply = await askGemini(message.content.trim(), geminiApiKey);
            if (aiReply) {
                const chunks = aiReply.match(/[\s\S]{1,2000}/g) || [];
                for (let i = 0; i < chunks.length; i++) {
                i === 0
                    ? await message.reply(chunks[i]).catch(console.error)
                    : await message.channel.send(chunks[i]).catch(console.error);
                }
            } else {
                logWarn("[QnA] Gemini không trả về nội dung.");
                await message.reply("😕 AI không có phản hồi.").catch(()=>{});
            }
            } catch (error) {
            logError("[QnA] Lỗi khi lấy phản hồi từ Gemini:", error);
            await message.reply("❌ Lỗi truy vấn AI.").catch(() => {});
            }
        }
	},
};