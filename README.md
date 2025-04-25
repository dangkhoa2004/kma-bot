# 🤖 Discord Bot Tích Hợp Gemini AI

Một Discord bot được xây dựng bằng Node.js, sử dụng `discord.js` v14+, có khả năng xử lý các lệnh dạng tiền tố (`!`) và trả lời câu hỏi bằng Gemini AI trong kênh chỉ định.

---

## 📌 Mục tiêu dự án

- Hỗ trợ người dùng tương tác tự nhiên với AI trên Discord
- Tổ chức các tính năng rõ ràng theo module
- Dễ mở rộng cho các lệnh mới hoặc tích hợp thêm API
- Hạn chế lệnh trong từng kênh riêng biệt (ví dụ: chỉ dùng `!q` trong kênh Hỏi-Đáp)

---

## 🚀 Tính năng chi tiết

### 🔷 1. Lệnh dạng tiền tố (`!`)

- Người dùng có thể sử dụng các lệnh như `!hello`, `!ping`, `!clear`, `!lich`, `!q`
- Mỗi file trong thư mục `commands/` đại diện cho một lệnh
- Các lệnh được tự động tải khi bot khởi động
- Có kiểm tra quyền hoạt động theo kênh (ví dụ: `!lich` chỉ hoạt động ở `CALEN_CHANNEL_ID`)

### 🤖 2. Tự động trả lời bằng AI (Gemini)

- Khi người dùng gửi tin nhắn vào kênh `QNA_CHANNEL_ID`, bot sử dụng Gemini AI để tạo phản hồi
- Hỗ trợ chia nhỏ phản hồi nếu vượt quá 2000 ký tự (giới hạn của Discord)

### 🛡️ 3. Kiểm soát theo kênh (Channel Restriction)

- Lệnh `!q` chỉ được dùng trong kênh QnA
- Lệnh `!lich` chỉ được dùng trong kênh Calendar
- Mọi yêu cầu sai kênh đều bị từ chối thân thiện

---

## 📁 Cấu trúc thư mục

```
.
├── commands/               # Các lệnh dạng tiền tố (!)
│   ├── calendar.js        # !lich
│   ├── clear.js           # !clear
│   ├── hello.js           # !hello
│   ├── ping.js            # !ping
│   ├── q.js               # !q (gọi AI)
│   └── su-kien.js         # lệnh tùy chỉnh khác
│
├── utils/
│   ├── gemini.js          # Hàm gọi Gemini API
│   └── channelRestrictions.js  # Giới hạn kênh sử dụng lệnh
│
├── .env                   # Biến môi trường
├── index.js               # Entry point chính của bot
├── package.json           # Khai báo dependency và script
├── package-lock.json      # Phiên bản chính xác các gói
└── README.md              # Tài liệu dự án (file này)
```

---

## 🔧 Cài đặt và khởi động

### 1. Clone repository

```bash
git clone https://github.com/dangkhoa2004/my-discord-bot.git
cd my-discord-bot
```

### 2. Cài đặt dependency

```bash
npm install @discordjs/opus@^0.10.0 \
            @discordjs/rest@^2.4.3 \
            @discordjs/voice@^0.18.0 \
            @google/generative-ai@^0.24.0 \
            canvas@^3.1.0 \
            discord.js@^14.18.0 \
            dotenv@^16.5.0 \
            ffmpeg-static@^5.2.0 \
            libsodium-wrappers@^0.7.15 \
            node-fetch@^3.3.2 \
            node-ical@^0.20.1 \
            opusscript@^0.0.8 \
            play-dl@^1.9.7 \
            ytdl-core-discord@^1.3.1

```

### 3. Tạo file `.env`

```env
DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
QNA_CHANNEL_ID=YOUR_QNA_CHANNEL_ID
CALEN_CHANNEL_ID=YOUR_CALEN_CHANNEL_ID
```

### 4. Khởi động bot

```bash
node index.js
```

---

## 📚 Hướng dẫn tạo lệnh mới

Để tạo lệnh mới (ví dụ `!sayhi`):

1. Tạo file `commands/sayhi.js`

```js
module.exports = {
  name: "sayhi",
  execute(message, args) {
    message.reply("Hi there! 👋");
  },
};
```

2. Bot sẽ tự động tải lệnh này khi khởi động lại

---

## 🔒 Bảo mật & giới hạn API

- Biến môi trường được lưu trong `.env` và KHÔNG push lên Git
- Nếu `GEMINI_API_KEY` không tồn tại, bot sẽ không chạy chức năng AI
- Các lệnh có thể giới hạn theo `channelId` để tránh lạm dụng

---

## 🛠 Công nghệ sử dụng

| Công nghệ     | Phiên bản |
| ------------- | --------- |
| Node.js       | >=18.x    |
| discord.js    | ^14.x     |
| dotenv        | ^16.x     |
| Google Gemini | API REST  |

---

## 🧪 Tính năng sắp phát triển

- [ ] Slash Commands (`/`) để phù hợp chuẩn Discord 2024
- [ ] Hệ thống phân quyền lệnh theo role
- [ ] Giao diện dashboard quản lý lệnh (qua web)
- [ ] Lưu log tương tác với AI để phân tích

---

## 💬 Ví dụ tương tác

```
👤 Người dùng: !hello
🤖 Bot: Xin chào! Tôi là bot hỗ trợ AI, gõ !q để hỏi tôi điều gì đó.

👤 Người dùng (trong kênh QnA): Tại sao trời xanh?
🤖 Bot: Trời có màu xanh vì sự tán xạ của ánh sáng mặt trời trong khí quyển Trái Đất...

👤 Người dùng (gửi !q trong sai kênh)
🤖 Bot: 🚫 Bạn chỉ có thể dùng !q trong kênh Hỏi-Đáp.
```

---

## 📬 Đóng góp

Mọi ý tưởng, báo lỗi hoặc tính năng mới xin vui lòng mở issue hoặc pull request tại GitHub repo.

---

## 📜 Giấy phép

Dự án phát hành theo [MIT License](https://opensource.org/licenses/MIT).

---

## ✨ Tác giả

- **Đăng Khoa** - _dev chính_
- Email: 04dkhoa04@gmail.com
- GitHub: [@yourgithub](https://github.com/dangkhoa2004)
