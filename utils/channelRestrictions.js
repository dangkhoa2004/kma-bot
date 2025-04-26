// utils/channelRestrictions.js
const checkAskCommandChannel = async (message, commandName, qnaChannelId) => {
  console.log(
    `[KênhCheck] Đang kiểm tra: lệnh='${commandName}', kênhTinNhắn='${message.channel.id}', kênhHỏiĐápMongMuốn='${qnaChannelId}'`
  );
  const shouldBlock =
    commandName === "q" && qnaChannelId && message.channel.id !== qnaChannelId;
  console.log(
    `[KênhCheck] Điều kiện chặn (lệnh là 'q' && có kênh Hỏi Đáp && kênh hiện tại != kênh Hỏi Đáp): ${shouldBlock}`
  );

  if (shouldBlock) {
    console.log(
      `[KênhCheck] Lệnh '!q' bị chặn trong kênh ${message.channel.id}. Đang gửi cảnh báo...`
    );
    try {
      const qnaChannelLink = `<#${qnaChannelId}>`;
      await message.reply(
        `Lệnh \`!q\` chỉ có thể sử dụng trong kênh ${qnaChannelLink}. Vui lòng thử lại ở đó.`
      );
      console.log(`[KênhCheck] Đã gửi cảnh báo thành công.`);
    } catch (replyError) {
      console.error(
        `[KênhCheck] Lỗi khi gửi cảnh báo giới hạn kênh:`,
        replyError
      );
    }
    return true;
  }

  console.log(
    `[KênhCheck] Lệnh '${commandName}' được phép chạy trong kênh ${message.channel.id}.`
  );
  return false;
};

const checkCalendarCommandChannel = async (
  message,
  commandName,
  calenChannelId
) => {
  console.log(
    `[KênhCheck] Đang kiểm tra: lệnh='${commandName}', kênhTinNhắn='${message.channel.id}', kênhLịchMongMuốn='${calenChannelId}'`
  );

  const shouldBlock =
    commandName === "calendar" &&
    calenChannelId &&
    message.channel.id !== calenChannelId;
  console.log(
    `[KênhCheck] Điều kiện chặn (lệnh là 'calendar' && có kênh Lịch && kênh hiện tại != kênh Lịch): ${shouldBlock}`
  );

  if (shouldBlock) {
    console.log(
      `[KênhCheck] Lệnh '!lich' bị chặn trong kênh ${message.channel.id}. Đang gửi cảnh báo...`
    );
    try {
      const calenChannelLink = `<#${calenChannelId}>`;
      await message.reply(
        `Lệnh \`!lich\` chỉ có thể sử dụng trong kênh ${calenChannelLink}. Vui lòng thử lại ở đó.`
      );
      console.log(`[KênhCheck] Đã gửi cảnh báo thành công.`);
    } catch (replyError) {
      console.error(
        `[KênhCheck] Lỗi khi gửi cảnh báo giới hạn kênh:`,
        replyError
      );
    }
    return true;
  }

  console.log(
    `[KênhCheck] Lệnh '${commandName}' được phép chạy trong kênh ${message.channel.id}.`
  );
  return false;
};

module.exports = {
  checkAskCommandChannel,
  checkCalendarCommandChannel,
};
