const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const fs = require('fs').promises;
const simpleGit = require('simple-git');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const git = simpleGit();

const PORT = process.env.PORT || 8080;
const ISSUES_FILE = path.join(__dirname, 'issues.json');

app.use(express.static(path.join(__dirname, 'public')));


const readIssues = async () => {
    try {
        await fs.access(ISSUES_FILE);
        const data = await fs.readFile(ISSUES_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // If the file doesn't exist, return an empty array
        return [];
    }
};

// Write issues to the JSON file and commit the change alsooo push
const writeIssuesAndCommit = async (issues, commitMessage) => {
    await fs.writeFile(ISSUES_FILE, JSON.stringify(issues, null, 2));
    console.log('Issues file updated.');

    // Git versioning
    try {
        await git.add(ISSUES_FILE);
        await git.commit(commitMessage);

        await git.push('origin', 'main');

        console.log(`Git commit and push successful: "${commitMessage}"`);
    } catch (err) {
        console.error('Git operation failed:', err);
    }
};

// Broadcast data to all connected clients
const broadcast = (data) => {
    wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
};


// sockett
wss.on('connection', async (ws) => {
    console.log('🚀 Client connected');

    // Send the current list of issues to the newly connected client
    ws.send(JSON.stringify(await readIssues()));

    ws.on('message', async (message) => {
        const { type, payload } = JSON.parse(message);
        const issues = await readIssues();
        let commitMessage = '';

        switch (type) {
            case 'ADD_ISSUE':
                const newId = issues.length > 0 ? Math.max(...issues.map(i => i.id)) + 1 : 1;
                const newIssue = {
                    id: newId,
                    title: payload.title,
                    description: payload.description,
                    status: 'Open',
                    createdBy: payload.createdBy,
                    comments: []
                };
                issues.push(newIssue);
                commitMessage = `Issue #${newId}: "${payload.title}" created by ${payload.createdBy}`;
                break;

            case 'UPDATE_STATUS':
                const issueToUpdate = issues.find(i => i.id === payload.id);
                if (issueToUpdate) {
                    issueToUpdate.status = payload.status;
                    commitMessage = `Issue #${payload.id} status changed to "${payload.status}" by ${payload.user}`;
                }
                break;

            case 'ADD_COMMENT':
                const issueToComment = issues.find(i => i.id === payload.id);
                if (issueToComment) {
                    issueToComment.comments.push({ text: payload.comment, user: payload.user });
                    commitMessage = `Comment added to Issue #${payload.id} by ${payload.user}`;
                }
                break;

                // case 'DELETE_ISSUE':
                //   const indexToDelete = issues.findIndex(i => i.id === payload.id);
                //   if(indexToDelete != -i){
                //     const [deletedIssue] = issues.splice(indexToDelete, 1);
                //     commitMessage = `Issue #${payload.id} deleted by ${payload.user}`;
                //     break;
                //   }
        }

        if (commitMessage) {
            await writeIssuesAndCommit(issues, commitMessage);
            broadcast(issues); // Broadcast updated list to all clients
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});


server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});