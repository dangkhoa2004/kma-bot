// utils/githubHelper.js
const axios = require("axios");
const { EmbedBuilder } = require("discord.js");

const GITHUB_API_BASE_URL = "https://api.github.com";
const TARGET_USERNAME = "dangkhoa2004";
const EMBED_COLOR = 0x5865f2;

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
      `❌ [LỖI][Trợ lý GitHub] Lỗi khi gọi ${url}: Trạng thái ${
        status || "N/A"
      } - ${message}`
    );
    throw new Error(
      `Lỗi API GitHub (Trạng thái ${status || "N/A"}): ${message}`
    );
  }
}

async function getAllUserRepos(token) {
  let allRepos = [];
  let page = 1;
  const perPage = 100;
  let keepFetching = true;
  const headers = getGitHubHeaders(token);
  const username = TARGET_USERNAME;

  while (keepFetching) {
    try {
      const params = {
        type: "owner",
        sort: "created",
        direction: "asc",
        per_page: perPage,
        page: page,
      };
      const currentPageRepos = await makeGitHubRequest(
        `/users/${username}/repos`,
        headers,
        params
      );

      if (currentPageRepos.length === 0) {
        keepFetching = false;
      } else {
        allRepos = allRepos.concat(currentPageRepos);
        if (currentPageRepos.length < perPage) {
          keepFetching = false;
        } else {
          page++;
        }
      }
    } catch (error) {
      console.error(
        `❌ [LỖI][Trợ lý GitHub] Lỗi khi lấy trang ${page} kho lưu trữ cho ${username}:`,
        error
      );
      throw new Error(
        `Không thể lấy toàn bộ kho lưu trữ cho ${username}. ${error.message}`
      );
    }
  }
  return { repos: allRepos, username: username };
}

function createSingleRepoEmbed(repo) {
  const stars = repo.stargazers_count ?? 0;
  const repoName = repo.name.replace(/([_*~`|])/g, "\\$1");
  let description = repo.description || "*Không có mô tả*";
  if (description.length > 200) {
    description = description.substring(0, 197) + "...";
  }
  const createdAt = repo.created_at
    ? `<t:${Math.floor(new Date(repo.created_at).getTime() / 1000)}:D>`
    : "N/A";
  const pushedAt = repo.pushed_at
    ? `<t:${Math.floor(new Date(repo.pushed_at).getTime() / 1000)}:R>`
    : "N/A";
  const languageText = repo.language || "N/A";
  const repoIcon = repo.fork ? "🍴" : "📦";

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(`${repoIcon} ${repoName}`)
    .setURL(repo.html_url)
    .setDescription(description)
    .addFields(
      { name: "⭐ Stars", value: stars.toString(), inline: true },
      { name: "💻 Ngôn ngữ", value: languageText, inline: true },
      { name: "📅 Tạo lúc", value: createdAt, inline: true },
      { name: "⏱️ Push cuối", value: pushedAt, inline: true }
    );
  return embed;
}

module.exports = {
  getAllUserRepos,
  createSingleRepoEmbed,
};
