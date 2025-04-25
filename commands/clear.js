// commands/clear.js (hoặc tên file lệnh của bạn)

module.exports = {
  name: 'clear',
  description: 'Xóa tối đa 100 tin nhắn gần đây trong kênh hiện tại.', // Thêm mô tả nếu muốn
  async execute(message) {
    // 1. Kiểm tra quyền của Bot
    if (!message.guild) {
        return message.reply("Lệnh này chỉ dùng được trong server."); // Không dùng được trong DM
    }
    if (!message.member.permissions.has("ManageMessages")) {
        return message.reply("❌ Bạn không có quyền quản lý tin nhắn để dùng lệnh này.");
    }
    if (!message.guild.members.me.permissions.has("ManageMessages")) {
      return message.reply("❌ Bot không có quyền quản lý tin nhắn.");
    }

    // 2. Đặt số lượng cố định là 100 (tối đa cho bulkDelete)
    const amountToDelete = 100;

    try {
      // 3. Thực hiện xóa hàng loạt
      // Tham số thứ hai `true` sẽ tự động lọc các tin nhắn cũ hơn 14 ngày
      const deleted = await message.channel.bulkDelete(amountToDelete, true);

      // 4. Gửi tin nhắn xác nhận (và tự xóa sau vài giây)
      // Thông báo số lượng thực tế đã xóa (có thể ít hơn 100)
      const confirmMsg = await message.channel.send(`🧹 Đã xóa ${deleted.size} tin nhắn gần đây (tối đa 100, không quá 14 ngày).`);
      setTimeout(() => {
          // Đảm bảo tin nhắn chưa bị xóa bởi tác nhân khác
          if (!confirmMsg.deleted) {
              confirmMsg.delete().catch(err => console.error("Lỗi khi xóa tin nhắn xác nhận clear:", err));
          }
      }, 3000); // Tự xóa sau 3 giây

      // Có thể bạn muốn xóa cả tin nhắn gốc đã gọi lệnh !clear
      // await message.delete().catch(err => console.error("Lỗi khi xóa tin nhắn gốc !clear:", err));
      // Tuy nhiên, việc này đôi khi gây khó hiểu nếu người dùng không thấy lệnh của mình

    } catch (error) {
      // 5. Xử lý lỗi
      console.error("Lỗi khi thực hiện lệnh !clear:", error);
      // Gửi tin nhắn lỗi chung chung hơn
      message.reply("⚠️ Có lỗi xảy ra khi cố gắng xóa tin nhắn. Có thể không có tin nhắn nào đủ mới để xóa.").catch(console.error);
    }
  },
};