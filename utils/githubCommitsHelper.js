// utils/githubCommitsHelper.js
const axios = require("axios");
const { EmbedBuilder } = require("discord.js");
const { getAllUserRepos } = require("./githubHelper");

const GITHUB_API_BASE_URL = "https://api.github.com";
const TARGET_USERNAME = "dangkhoa2004";
const EMBED_COLOR = 0x2ecc71;

function getGitHubHeaders(token) {
  const headers = { Accept: "application/vnd.github.v3+json" };
  if (token) {
    headers["Authorization"] = `token ${token}`;
  }
  return headers;
}

async function makeGitHubRequest(endpoint, headers, params = {}) {
  const url = `${GITHUB_API_BASE_URL}${endpoint}`;
  try {
    const response = await axios.get(url, { headers, params });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    console.error(
      `❌ [LỖI][Trợ lý GitHub Commit] Lỗi khi gọi ${url}: Trạng thái ${
        status || "N/A"
      } - ${message}`
    );
    if (status !== 404 && status !== 409) {
      throw new Error(
        `Lỗi API GitHub (Trạng thái ${status || "N/A"}): ${message}`
      );
    }
    return [];
  }
}

async function getRepoCommits(owner, repoName, token, limit = 5) {
  const headers = getGitHubHeaders(token);
  const params = { per_page: limit };
  const commits = await makeGitHubRequest(
    `/repos/${owner}/${repoName}/commits`,
    headers,
    params
  );
  return commits.map((c) => ({ ...c, repoName: repoName }));
}

async function getAllRecentCommits(
  token,
  totalCommitLimit = 15,
  commitsPerRepo = 3
) {
  const username = TARGET_USERNAME;
  const { repos: userRepos } = await getAllUserRepos(token);
  if (!userRepos || userRepos.length === 0) {
    console.log(
      `[Trợ lý GitHub Commit] Không tìm thấy kho lưu trữ nào cho người dùng ${username}.`
    );
    return [];
  }

  console.log(
    `[Trợ lý GitHub Commit] Đang lấy ${commitsPerRepo} commit mới nhất từ ${userRepos.length} kho lưu trữ...`
  );
  let allCommits = [];

  const commitPromises = userRepos.map((repo) =>
    getRepoCommits(username, repo.name, token, commitsPerRepo).catch((err) => {
      console.warn(
        `[Trợ lý GitHub Commit] Lỗi khi lấy commit cho ${repo.name}: ${err.message}. Đang bỏ qua kho lưu trữ này.`
      );
      return [];
    })
  );

  const results = await Promise.all(commitPromises);

  results.forEach((repoCommits) => {
    allCommits = allCommits.concat(repoCommits);
  });

  console.log(
    `[Trợ lý GitHub Commit] Đã lấy tổng cộng ${allCommits.length} commit (chưa sắp xếp).`
  );

  allCommits.sort((a, b) => {
    const dateA = new Date(a.commit?.author?.date || 0);
    const dateB = new Date(b.commit?.author?.date || 0);
    return dateB - dateA;
  });

  const finalCommits = allCommits.slice(0, totalCommitLimit);
  console.log(
    `[Trợ lý GitHub Commit] Trả về ${finalCommits.length} commit gần đây nhất.`
  );
  return finalCommits;
}

function createCommitEmbed(commitData) {
  if (!commitData || !commitData.commit) return null;

  const commitInfo = commitData.commit;
  const author = commitInfo.author;
  const repoName = commitData.repoName || "N/A";
  const commitUrl = commitData.html_url || "#";
  const commitShaShort = commitData.sha?.substring(0, 7) || "N/A";

  const messageLines = commitInfo.message?.split("\n") || [
    "*Không có thông điệp commit*",
  ];
  const title =
    messageLines[0].length > 250
      ? messageLines[0].substring(0, 247) + "..."
      : messageLines[0];
  let description = messageLines.slice(1).join("\n").trim();
  if (description.length > 400) {
    description = description.substring(0, 397) + "...";
  }

  const commitDate = author?.date
    ? `<t:${Math.floor(new Date(author.date).getTime() / 1000)}:R>`
    : "N/A";

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(title)
    .setURL(commitUrl)
    .setDescription(
      `**Repo:** [${repoName}](https://github.com/${TARGET_USERNAME}/${repoName})\n**Tác giả:** ${
        author?.name || "Không rõ"
      }${description ? `\n\n${description}` : ""}`
    )
    .addFields(
      {
        name: "Commit",
        value: `[\`${commitShaShort}\`](${commitUrl})`,
        inline: true,
      },
      { name: "Ngày", value: commitDate, inline: true }
    )
    .setTimestamp(new Date(author?.date || Date.now()));

  return embed;
}

async function generateCommitEmbedsArray(token, limit = 15) {
  const recentCommits = await getAllRecentCommits(token, limit);
  const embedsArray = recentCommits
    .map((commit) => createCommitEmbed(commit))
    .filter((embed) => embed !== null);
  return {
    embeds: embedsArray,
    displayCount: embedsArray.length,
    username: TARGET_USERNAME,
  };
}

module.exports = {
  generateCommitEmbedsArray,
  COMMIT_EMBED_COLOR: EMBED_COLOR,
};
