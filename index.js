require("dotenv").config();

const { Client, GatewayIntentBits, Events, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { askGemini } = require("./utils/gemini");

const discordToken = process.env.DISCORD_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY;
const qnaChannelId = process.env.QNA_CHANNEL_ID;
const calenChannelId = process.env.CALEN_CHANNEL_ID;

// --- BEGIN: Kiểm tra biến môi trường cần thiết ---
if (!discordToken) {
  console.error("Lỗi: Biến môi trường DISCORD_TOKEN chưa được đặt.");
  process.exit(1);
}
if (!geminiApiKey) {
  console.warn(
    "Cảnh báo: Biến môi trường GEMINI_API_KEY chưa được đặt. Chức năng AI QnA sẽ không hoạt động."
  );
}
if (!qnaChannelId) {
  console.warn(
    "Cảnh báo: Biến môi trường QNA_CHANNEL_ID chưa được đặt. Chức năng AI QnA sẽ không hoạt động."
  );
}
if (!calenChannelId) {
  console.warn(
    "Cảnh báo: Biến môi trường CALEN_CHANNEL_ID chưa được đặt. Chức năng Calendar sẽ không hoạt động."
  );
}
// --- END: Kiểm tra biến môi trường cần thiết ---

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");

// --- Logic tải lệnh message ('!') ---
// Giữ lại nếu bạn vẫn có các lệnh bắt đầu bằng '!' khác
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    // Bỏ qua file q.js nếu chưa xóa
    if (file === "q.js") continue;

    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      // Chỉ tải các lệnh message cũ (có name và execute)
      if (
        command &&
        typeof command.name === "string" &&
        typeof command.execute === "function"
      ) {
        client.commands.set(command.name, command);
        console.log(`✅ Đã tải lệnh message: !${command.name}`);
      }
      // Bỏ qua các file không đúng định dạng hoặc là slash command cũ
      // else {
      //   console.warn(`⚠️ File lệnh ${file} không phải định dạng lệnh message hợp lệ.`);
      // }
    } catch (error) {
      console.error(`❌ Lỗi khi tải lệnh ${file}:`, error);
    }
  }
} else {
  console.warn("⚠️ Thư mục 'commands' không tồn tại. Bỏ qua việc tải lệnh.");
}
// --- Kết thúc tải lệnh message ---

// --- Bỏ logic đăng ký Slash Command ---
// const rest = new REST...
// (async () => { ... })();

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot đã đăng nhập với tên ${c.user.tag}`);
});

// --- Bỏ trình xử lý InteractionCreate ---
// client.on(Events.InteractionCreate, async interaction => { ... });

// --- Xử lý tin nhắn ---
client.on(Events.MessageCreate, async (message) => {
  // Bỏ qua tin nhắn từ bot hoặc ngoài server (DM)
  if (message.author.bot || !message.guild) return;

  // --- Xử lý lệnh message ('!') ---
  // Giữ lại nếu bạn có các lệnh '!' khác cần hoạt động
  if (message.content.startsWith("!")) {
    const args = message.content.slice(1).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);

    if (command) {
      console.log(
        `[CMD] Thực thi lệnh !${commandName} bởi ${message.author.tag}`
      );
      try {
        // ⚡ BỔ SUNG KIỂM TRA CHANNEL Ở ĐÂY:
        const {
          checkAskCommandChannel,
          checkCalendarCommandChannel,
        } = require("./utils/channelRestrictions");

        // Nếu lệnh là !q thì kiểm tra channel QnA
        if (await checkAskCommandChannel(message, commandName, qnaChannelId))
          return;

        // Nếu lệnh là !lich thì kiểm tra channel Calendar
        if (
          await checkCalendarCommandChannel(
            message,
            commandName,
            calenChannelId
          )
        )
          return;

        // Nếu không bị chặn, thực thi lệnh
        await command.execute(message, args, client);
      } catch (error) {
        console.error(`Lỗi thực thi lệnh !${commandName}:`, error);
        try {
          await message.reply("❌ Có lỗi xảy ra khi thực thi lệnh này.");
        } catch (replyError) {
          console.error("Lỗi khi gửi thông báo lỗi thực thi lệnh:", replyError);
        }
      }
      return;
    }
  }

  // --- Xử lý AI QnA trong kênh chỉ định ---
  // Chỉ chạy nếu: có ID kênh, có API key, và tin nhắn nằm ĐÚNG kênh đó
  if (
    qnaChannelId &&
    geminiApiKey &&
    message.channel.id === qnaChannelId
    // Không cần check !message.content.startsWith('/') nữa vì không còn Interaction handler
  ) {
    console.log(
      `[QnA Channel] Tin nhắn từ ${message.author.tag} trong kênh QnA (${qnaChannelId}): "${message.content}"`
    );
    message.channel.sendTyping();
    try {
      const aiReply = await askGemini(message.content, geminiApiKey);
      if (aiReply) {
        // Chia nhỏ nếu cần
        if (aiReply.length > 2000) {
          const chunks = aiReply.match(/[\s\S]{1,2000}/g) || [];
          for (const chunk of chunks) {
            // Trả lời tin nhắn gốc cho phần đầu, các phần sau gửi thường
            if (chunks.indexOf(chunk) === 0) {
              await message.reply(chunk).catch(console.error);
            } else {
              await message.channel.send(chunk).catch(console.error);
            }
          }
        } else {
          await message.reply(aiReply).catch(console.error);
        }
      } else {
        console.warn("[QnA Channel] Gemini không trả về nội dung.");
        // await message.reply("😕 AI không có phản hồi cho việc này.").catch(console.error);
      }
    } catch (error) {
      console.error("[QnA Channel] Lỗi Gemini:", error);
      try {
        await message
          .reply("❌ Đã có lỗi xảy ra khi lấy câu trả lời từ AI.")
          .catch(console.error);
      } catch (replyError) {
        console.error(
          "[QnA Channel] Lỗi khi gửi thông báo lỗi Gemini:",
          replyError
        );
      }
    }
  }
  // Nếu tin nhắn không phải lệnh '!' và không ở trong kênh QnA, bot sẽ bỏ qua.
});

client.on(Events.Error, console.error);
client.on(Events.Warn, console.warn);

client.login(discordToken);
