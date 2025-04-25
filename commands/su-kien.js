const { GuildScheduledEventPrivacyLevel, GuildScheduledEventEntityType } = require('discord.js');
const ical = require('node-ical');
const ICS_URL = "https://calendar.google.com/calendar/ical/vi.vietnamese%23holiday%40group.v.calendar.google.com/public/basic.ics";

module.exports = {
  name: "sukien",
  description: "Tạo sự kiện Discord từ lịch Việt Nam (ngăn trùng sự kiện)",
  async execute(message, args, client) {
    try {
      const guild = message.guild;
      if (!guild) {
        await message.reply('❌ Không thể tạo sự kiện ngoài server.');
        return;
      }

      const response = await fetch(ICS_URL);
      const data = await response.text();
      const events = ical.parseICS(data);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 6);

      const upcomingEvents = [];

      for (let k in events) {
        const ev = events[k];
        if (ev.type === 'VEVENT') {
          const eventStartDate = new Date(ev.start);
          const eventEndDate = new Date(ev.end);

          eventStartDate.setHours(9, 0, 0, 0);
          eventEndDate.setHours(17, 0, 0, 0);

          if (eventStartDate > nextWeek || eventEndDate < today) {
            continue;
          }

          upcomingEvents.push({
            startDate: eventStartDate,
            endDate: eventEndDate,
            summary: ev.summary,
          });
        }
      }

      if (upcomingEvents.length === 0) {
        await message.reply("📅 Không có sự kiện nào trong 7 ngày tới để tạo.");
        return;
      }

      // 🧠 Lấy danh sách sự kiện hiện có trong server
      const existingEvents = await guild.scheduledEvents.fetch();

      let createdCount = 0;
      let skippedCount = 0;

      for (const ev of upcomingEvents) {
        const alreadyExists = existingEvents.some(existing => {
          const sameName = existing.name === ev.summary;
          const sameDay = new Date(existing.scheduledStartTimestamp).toDateString() === ev.startDate.toDateString();
          return sameName && sameDay;
        });

        if (alreadyExists) {
          skippedCount++;
          continue;
        }

        await guild.scheduledEvents.create({
          name: ev.summary,
          scheduledStartTime: ev.startDate.toISOString(),
          scheduledEndTime: ev.endDate.toISOString(),
          privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
          entityType: GuildScheduledEventEntityType.External,
          entityMetadata: {
            location: "Việt Nam 🇻🇳",
          },
          description: `Sự kiện: ${ev.summary}\nTừ: ${ev.startDate.toLocaleDateString('vi-VN')}\nĐến: ${ev.endDate.toLocaleDateString('vi-VN')}`,
        });

        createdCount++;
      }

      await message.reply(`✅ Đã tạo ${createdCount} sự kiện mới.\n⚠️ Bỏ qua ${skippedCount} sự kiện đã tồn tại.`);

    } catch (err) {
      console.error("❌ Lỗi khi tạo sự kiện:", err);
      await message.reply("❌ Có lỗi xảy ra khi tạo sự kiện.");
    }
  },
};
