// utils/githubCommitsHelper.js
const axios = require("axios");
const { EmbedBuilder } = require("discord.js");
const { getAllUserRepos } = require('./githubHelper'); // Ensure correct path

const GITHUB_API_BASE_URL = "https://api.github.com";
const TARGET_USERNAME = "dangkhoa2004";
const EMBED_COLOR = 0x2ECC71; // Commit embed color (Green)

function getGitHubHeaders(token) {
    const headers = { Accept: "application/vnd.github.v3+json" };
    if (token) { headers["Authorization"] = `token ${token}`; }
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
            `❌ [ERROR][GitHub Commit Helper] Error calling ${url}: Status ${status || "N/A"} - ${message}`
        );
        if (status !== 404 && status !== 409) { // Also ignore 409 (Git Repository is empty)
             throw new Error(`GitHub API Error (Status ${status || "N/A"}): ${message}`);
        }
        return []; // Return empty array on 404 or 409
    }
}

async function getRepoCommits(owner, repoName, token, limit = 5) {
    const headers = getGitHubHeaders(token);
    const params = { per_page: limit };
    const commits = await makeGitHubRequest(`/repos/${owner}/${repoName}/commits`, headers, params);
    // Add repoName to each commit for later use
    return commits.map(c => ({ ...c, repoName: repoName }));
}

async function getAllRecentCommits(token, totalCommitLimit = 15, commitsPerRepo = 3) {
    const username = TARGET_USERNAME;
    const { repos: userRepos } = await getAllUserRepos(token); // Get repos (sorted by creation date, doesn't matter here)
    if (!userRepos || userRepos.length === 0) {
        console.log(`[GitHub Commit Helper] No repositories found for user ${username}.`);
        return [];
    }

    console.log(`[GitHub Commit Helper] Fetching latest ${commitsPerRepo} commits from ${userRepos.length} repositories...`);
    let allCommits = [];

    // Create an array of promises to fetch commits concurrently
    const commitPromises = userRepos.map(repo =>
        getRepoCommits(username, repo.name, token, commitsPerRepo)
            .catch(err => { // Catch errors for individual repos
                console.warn(`[GitHub Commit Helper] Error fetching commits for ${repo.name}: ${err.message}. Skipping repo.`);
                return []; // Return empty array on error to not break Promise.all
            })
    );

    const results = await Promise.all(commitPromises);

    // Flatten the array of arrays into a single commit list
    results.forEach(repoCommits => {
        allCommits = allCommits.concat(repoCommits);
    });

    console.log(`[GitHub Commit Helper] Fetched a total of ${allCommits.length} commits (unsorted).`);

    // Sort all collected commits by date descending (newest first)
    allCommits.sort((a, b) => {
        const dateA = new Date(a.commit?.author?.date || 0);
        const dateB = new Date(b.commit?.author?.date || 0);
        return dateB - dateA; // Sort descending
    });

    // Limit the final array to the desired total number of commits
    const finalCommits = allCommits.slice(0, totalCommitLimit);
    console.log(`[GitHub Commit Helper] Returning ${finalCommits.length} most recent commits.`);
    return finalCommits;
}

function createCommitEmbed(commitData) {
    if (!commitData || !commitData.commit) return null; // Basic validation

    const commitInfo = commitData.commit;
    const author = commitInfo.author; // Commit author (might differ from pusher)
    const repoName = commitData.repoName || 'N/A';
    const commitUrl = commitData.html_url || '#';
    const commitShaShort = commitData.sha?.substring(0, 7) || 'N/A';

    // Use first line of commit message as title
    const messageLines = commitInfo.message?.split('\n') || ['*No commit message*'];
    const title = messageLines[0].length > 250 ? messageLines[0].substring(0, 247) + '...' : messageLines[0];
    // Use the rest as description (if any)
    let description = messageLines.slice(1).join('\n').trim();
    if (description.length > 400) { description = description.substring(0, 397) + '...'; }
    // Don't add default text if there's no description part
    // if (!description) description = '*No additional details*';

    // Format date using Discord's relative timestamp
    const commitDate = author?.date ? `<t:${Math.floor(new Date(author.date).getTime() / 1000)}:R>` : 'N/A';

    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR) // Use defined color
        .setTitle(title)
        .setURL(commitUrl)
        // Add repo and author info clearly in the description
        .setDescription(`**Repo:** [${repoName}](https://github.com/${TARGET_USERNAME}/${repoName})\n**Author:** ${author?.name || 'Unknown'}${description ? `\n\n${description}` : ''}`)
        .addFields(
            { name: 'Commit', value: `[\`${commitShaShort}\`](${commitUrl})`, inline: true }, // Link the SHA
            { name: 'Date', value: commitDate, inline: true }
        )
        .setTimestamp(new Date(author?.date || Date.now())); // Use commit date for timestamp

    return embed;
}

async function generateCommitEmbedsArray(token, limit = 15) {
    const recentCommits = await getAllRecentCommits(token, limit); // Get sorted commits
    // Map commits to embeds and filter out any nulls (from createCommitEmbed validation)
    const embedsArray = recentCommits
                          .map(commit => createCommitEmbed(commit))
                          .filter(embed => embed !== null);
    return {
        embeds: embedsArray,
        displayCount: embedsArray.length,
        username: TARGET_USERNAME // Return username for the control message
    };
}

// --- Module Exports (Corrected) ---
module.exports = {
    generateCommitEmbedsArray,      // Ensure this function is exported
    COMMIT_EMBED_COLOR: EMBED_COLOR // Export color with the desired name
};