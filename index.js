require("dotenv").config();

const { Client, GatewayIntentBits, Events, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { askGemini } = require("./utils/gemini");
const { checkAskCommandChannel, checkCalendarCommandChannel } = require("./utils/channelRestrictions");

// ===== Logger tiện ích =====
const logInfo = (msg) => console.log(`✅ [INFO] ${msg}`);
const logWarn = (msg) => console.warn(`⚠️ [WARN] ${msg}`);
const logError = (msg, error) => {
  console.error(`❌ [ERROR] ${msg}`);
  if (error) console.error(error);
};
// =============================

const discordToken = process.env.DISCORD_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY;
const qnaChannelId = process.env.QNA_CHANNEL_ID;
const calenChannelId = process.env.CALEN_CHANNEL_ID;

// ===== Kiểm tra biến môi trường =====
if (!discordToken) {
  logError("Biến môi trường DISCORD_TOKEN chưa được đặt.");
  process.exit(1);
}
if (!geminiApiKey) {
  logWarn("Biến môi trường GEMINI_API_KEY chưa được đặt. Chức năng AI QnA sẽ không hoạt động.");
}
if (!qnaChannelId) {
  logWarn("Biến môi trường QNA_CHANNEL_ID chưa được đặt. Chức năng AI QnA sẽ không hoạt động.");
}
if (!calenChannelId) {
  logWarn("Biến môi trường CALEN_CHANNEL_ID chưa được đặt. Chức năng Calendar sẽ không hoạt động.");
}
// ================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ===== Tải lệnh message ('!') =====
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));
  
  for (const file of commandFiles) {
    if (file === "q.js") continue; // Bỏ qua nếu là q.js

    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      if (command && typeof command.name === "string" && typeof command.execute === "function") {
        client.commands.set(command.name, command);
        logInfo(`Đã tải lệnh message: !${command.name}`);
      }
    } catch (error) {
      logError(`Lỗi khi tải lệnh ${file}:`, error);
    }
  }
} else {
  logWarn("Thư mục 'commands' không tồn tại. Bỏ qua việc tải lệnh.");
}
// =====================================

client.once(Events.ClientReady, (c) => {
  logInfo(`Bot đã đăng nhập với tên ${c.user.tag}`);
});

// ===== Xử lý tin nhắn =====
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();

  // --- Lệnh ! ---
  if (content.startsWith("!")) {
    const args = content.slice(1).split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);

    if (command) {
      logInfo(`[COMMAND] Thực thi lệnh !${commandName} bởi ${message.author.tag}`);
      try {
        if (await checkAskCommandChannel(message, commandName, qnaChannelId)) return;
        if (await checkCalendarCommandChannel(message, commandName, calenChannelId)) return;

        await command.execute(message, args, client);
      } catch (error) {
        logError(`Lỗi thực thi lệnh !${commandName}:`, error);
        await message.reply("❌ Có lỗi xảy ra khi thực thi lệnh này.").catch(() => {});
      }
    }
    return;
  }

  // --- AI QnA ---
  if (
    qnaChannelId &&
    geminiApiKey &&
    message.channel.id === qnaChannelId
  ) {
    logInfo(`[QnA] Tin nhắn từ ${message.author.tag}: "${content}"`);
    message.channel.sendTyping();
    try {
      const aiReply = await askGemini(content, geminiApiKey);
      if (aiReply) {
        const chunks = aiReply.match(/[\s\S]{1,2000}/g) || [];
        for (let i = 0; i < chunks.length; i++) {
          i === 0
            ? await message.reply(chunks[i]).catch(console.error)
            : await message.channel.send(chunks[i]).catch(console.error);
        }
      } else {
        logWarn("[QnA] Gemini không trả về nội dung.");
      }
    } catch (error) {
      logError("[QnA] Lỗi khi lấy câu trả lời từ Gemini:", error);
      await message.reply("❌ Đã có lỗi xảy ra khi lấy câu trả lời từ AI.").catch(() => {});
    }
  }
});
// ===========================

client.on(Events.Error, (error) => logError("Client Error:", error));
client.on(Events.Warn, (warning) => logWarn(`Client Warn: ${warning}`));

client.login(discordToken);
