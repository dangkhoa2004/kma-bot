// index.js
require("dotenv").config();

const { Client, GatewayIntentBits, Events, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { logInfo, logWarn, logError } = require("./utils/logger");

const discordToken = process.env.DISCORD_TOKEN;
if (!discordToken) {
  logError("Biến môi trường DISCORD_TOKEN chưa được đặt.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      if (
        command &&
        typeof command.name === "string" &&
        typeof command.execute === "function"
      ) {
        if (!["github", "repo", "khoarepos", "q"].includes(command.name)) {
          client.commands.set(command.name, command);
          logInfo(`Đã tải lệnh tin nhắn: !${command.name}`);
        }
      } else {
        logWarn(`Tệp lệnh ${file} thiếu thuộc tính 'name' hoặc hàm 'execute'.`);
      }
    } catch (error) {
      logError(`Lỗi khi tải lệnh ${file}:`, error);
    }
  }
} else {
  logWarn("Thư mục 'commands' không tồn tại, bỏ qua việc tải lệnh.");
}

const eventsPath = path.join(__dirname, "events");
if (!fs.existsSync(eventsPath)) {
  logError("Thư mục 'events' không tồn tại. Bot không thể xử lý sự kiện.");
} else {
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = require(filePath);
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
        logInfo(`Đã đăng ký trình xử lý sự kiện ONCE: ${event.name}`);
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
        logInfo(`Đã đăng ký trình xử lý sự kiện ON: ${event.name}`);
      }
    } catch (error) {
      logError(`Lỗi khi tải trình xử lý sự kiện ${file}:`, error);
    }
  }
}

client.on(Events.Error, (error) => logError("Lỗi Client:", error));
client.on(Events.Warn, (warning) => logWarn(`Cảnh báo Client: ${warning}`));

client.login(discordToken);
