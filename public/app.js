const socket = new WebSocket(`ws://${window.location.host}`);

const addIssueForm = document.getElementById('addIssueForm');
const userNameInput = document.getElementById('userName');
const issueTitleInput = document.getElementById('issueTitle');
const issueDescInput = document.getElementById('issueDesc');
const issuesTableBody = document.querySelector('#issuesTable tbody');

// Function to get user's name, simple persistence
const getUserName = () => {
    let name = localStorage.getItem('issueTrackerUser');
    if (!name) {
        name = prompt('Please enter your name for this session:') || 'Anonymous';
        localStorage.setItem('issueTrackerUser', name);
    }
    userNameInput.value = name;
    return name;
};

const currentUser = getUserName();

// Listen for messages from the server
socket.onmessage = (event) => {
    const issues = JSON.parse(event.data);
    renderIssues(issues);
};

socket.onopen = () => console.log('WebSocket connection established.');
socket.onclose = () => console.log('WebSocket connection closed.');

// Function to render issues in the table
const renderIssues = (issues) => {
    issuesTableBody.innerHTML = ''; // Clear existing table
    if (!issues || issues.length === 0) {
        issuesTableBody.innerHTML = '<tr><td colspan="6">No issues found.</td></tr>';
        return;
    }

    issues.forEach(issue => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>#${issue.id}</td>
            <td>
                <strong>${issue.title}</strong>
                <p>${issue.description}</p>
            </td>
            <td><span class="status status-${issue.status.replace(' ', '-')}">${issue.status}</span></td>
            <td>${issue.createdBy}</td>
            <td>
                <ul class="comment-list">
                    ${issue.comments.map(c => `<li><strong>${c.user}:</strong> ${c.text}</li>`).join('')}
                </ul>
            </td>
            <td>
                <div class="actions">
                    <select class="status-select" data-id="${issue.id}">
                        <option value="Open" ${issue.status === 'Open' ? 'selected' : ''}>Open</option>
                        <option value="In Progress" ${issue.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                        <option value="Closed" ${issue.status === 'Closed' ? 'selected' : ''}>Closed</option>
                    </select>
                    <form class="comment-form" data-id="${issue.id}">
                        <input type="text" placeholder="Add a comment..." required>
                        <button type="submit">Post</button>
                    </form>
                </div>
            </td>
        `;
        issuesTableBody.appendChild(row);
    });
};

// Handle form submission to add a new issue
addIssueForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = {
        title: issueTitleInput.value,
        description: issueDescInput.value,
        createdBy: userNameInput.value
    };
    socket.send(JSON.stringify({ type: 'ADD_ISSUE', payload }));
    issueTitleInput.value = '';
    issueDescInput.value = '';
});

// Event delegation for status changes and comments
issuesTableBody.addEventListener('change', (e) => {
    if (e.target.classList.contains('status-select')) {
        const payload = {
            id: parseInt(e.target.dataset.id),
            status: e.target.value,
            user: currentUser
        };
        socket.send(JSON.stringify({ type: 'UPDATE_STATUS', payload }));
    }
});

issuesTableBody.addEventListener('submit', (e) => {
    if (e.target.classList.contains('comment-form')) {
        e.preventDefault();
        const input = e.target.querySelector('input');
        const payload = {
            id: parseInt(e.target.dataset.id),
            comment: input.value,
            user: currentUser
        };
        socket.send(JSON.stringify({ type: 'ADD_COMMENT', payload }));
        input.value = '';
    }
});