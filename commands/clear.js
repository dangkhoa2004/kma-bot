// commands/clear.js
const { PermissionsBitField } = require("discord.js");

module.exports = {
  name: "clear",
  description: "Xóa tối đa 100 tin nhắn gần đây trong kênh hiện tại.",
  async execute(message) {
    if (!message.guild) {
      return message
        .reply("Lệnh này chỉ dùng được trong server.")
        .catch(console.error);
    }
    if (
      !message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)
    ) {
      return message
        .reply("❌ Bạn không có quyền quản lý tin nhắn để dùng lệnh này.")
        .catch(console.error);
    }
    if (
      !message.guild.members.me?.permissions.has(
        PermissionsBitField.Flags.ManageMessages
      )
    ) {
      return message
        .reply("❌ Bot không có quyền quản lý tin nhắn.")
        .catch(console.error);
    }

    const amountToDelete = 100;

    try {
      const deleted = await message.channel
        .bulkDelete(amountToDelete, true)
        .catch((err) => {
          console.error("Lỗi bulkDelete:", err);
          message
            .reply(
              "⚠️ Không thể xóa tin nhắn (có thể chúng đều cũ hơn 14 ngày hoặc có lỗi khác)."
            )
            .catch(console.error);
          return null;
        });

      if (deleted && deleted.size > 0) {
        const confirmMsg = await message.channel
          .send(`🧹 Đã xóa ${deleted.size} tin nhắn gần đây.`)
          .catch(console.error);
        if (confirmMsg) {
          setTimeout(() => {
            confirmMsg.delete().catch((err) => {
              if (err.code !== 10008) {
                console.error("Lỗi khi xóa tin nhắn xác nhận clear:", err);
              }
            });
          }, 3000);
        }
      } else if (deleted && deleted.size === 0) {
        const noMsgDeleted = await message.channel
          .send(
            `❎ Không tìm thấy tin nhắn nào phù hợp để xóa (trong vòng 14 ngày).`
          )
          .catch(console.error);
        if (noMsgDeleted) {
          setTimeout(() => noMsgDeleted.delete().catch(() => {}), 3000);
        }
      }
    } catch (error) {
      console.error("Lỗi không mong muốn khi thực hiện lệnh !clear:", error);
      message
        .reply("⚠️ Đã có lỗi không mong muốn xảy ra.")
        .catch(console.error);
    }
  },
};
