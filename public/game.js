const socket = io();
const canvas = document.getElementById('gameCanvas');
const context = canvas.getContext('2d');
const nameInput = document.getElementById('nameInput');
const startButton = document.getElementById('startButton');
const loginDiv = document.getElementById('login');
const scoreBoard = document.getElementById('scoreBoard');
const rankingList = document.getElementById('rankingList');
const myScore = document.getElementById('myScore');
const currentScore = document.getElementById('currentScore');

const controls = document.getElementById('controls');
const leftButton = document.getElementById('leftButton');
const rightButton = document.getElementById('rightButton');

const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');

let players = {};
let myId;
let myScoreValue = 0;
let scale, offsetX, offsetY;

// 이벤트 핸들러는 여기서 한 번만 등록
socket.on('state', (state) => {
    players = state.players;
    const apples = state.apples;
    const ranking = state.ranking;

    // 스코어보드 업데이트 (상위 3명)
    rankingList.innerHTML = '';
    ranking.slice(0, 3).forEach((player) => {
        let li = document.createElement('li');
        li.textContent = `${player.rank}위: ${player.name} - ${player.score}점`;
        rankingList.appendChild(li);
    });

    // 내 스코어 업데이트
    const currentPlayer = players[socket.id];
    if (currentPlayer) {
        currentScore.textContent = currentPlayer.score;
    }

    // 화면 갱신
    drawGame(players, apples);
});

socket.on('chatMessage', (data) => {
    appendChatMessage(data.name, data.message);
});

socket.on('chatHistory', (messages) => {
    chatMessages.innerHTML = '';
    for (let msg of messages) {
        appendChatMessage(msg.name, msg.message);
    }
});

startButton.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (name) {
        socket.emit('newPlayer', { name: name });
        loginDiv.style.display = 'none';
        canvas.style.display = 'block';
        scoreBoard.style.display = 'block';
        controls.style.display = 'flex';
        chatContainer.style.display = 'block';
        myScore.style.display = 'block';
    } else {
        alert('이름을 입력해주세요.');
    }
});

// 컨트롤 버튼 이벤트 처리
leftButton.addEventListener('mousedown', () => {
    socket.emit('changeDirection', { rotation: 'left' });
});
rightButton.addEventListener('mousedown', () => {
    socket.emit('changeDirection', { rotation: 'right' });
});

// 모바일 터치 대응
leftButton.addEventListener('touchstart', (e) => {
    e.preventDefault(); // 기본 터치 동작 방지
    socket.emit('changeDirection', { rotation: 'left' });
});
rightButton.addEventListener('touchstart', (e) => {
    e.preventDefault(); // 기본 터치 동작 방지
    socket.emit('changeDirection', { rotation: 'right' });
});
function changeDirection(newDirection) {
    const player = players[socket.id];
    if (player) {
        const oppositeDirections = {
            'up': 'down',
            'down': 'up',
            'left': 'right',
            'right': 'left'
        };

        if (newDirection !== oppositeDirections[player.direction]) {
            socket.emit('changeDirection', { direction: newDirection });
        }
    }
}

// 채팅 메시지 전송
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const message = chatInput.value.trim();
        if (message) {
            socket.emit('chatMessage', { message: message });
            chatInput.value = '';
        }
    }
});

function appendChatMessage(name, message) {
    const li = document.createElement('li');
    li.textContent = `${name}: ${message}`;
    chatMessages.appendChild(li);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 화면 크기 조정
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 150; // Adjust for controls and chat
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawGame(players, apples) {
    context.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / 800;
    const scaleY = canvas.height / 600;
    scale = Math.min(scaleX, scaleY);

    offsetX = (canvas.width - 800 * scale) / 2;
    offsetY = (canvas.height - 600 * scale) / 2;

    // 게임 영역 테두리 그리기
    context.strokeStyle = 'black';
    context.lineWidth = 2;
    context.strokeRect(offsetX, offsetY, 800 * scale, 600 * scale);

    // 사과 그리기
    context.fillStyle = 'red';
    for (let apple of apples) {
        context.beginPath();
        context.arc(offsetX + (apple.x + 10) * scale, offsetY + (apple.y + 10) * scale, 10 * scale, 0, 2 * Math.PI);
        context.fill();
    }

    // 지렁이 그리기
    for (let id in players) {
        const player = players[id];
        context.fillStyle = player.color;

        // 지렁이 꼬리 그리기
        for (let segment of player.tail) {
            context.beginPath();
            context.arc(offsetX + (segment.x + 10) * scale, offsetY + (segment.y + 10) * scale, 10 * scale, 0, 2 * Math.PI);
            context.fill();
        }

        // 지렁이 머리 그리기
        context.fillStyle = 'gold';
        context.beginPath();
        context.arc(offsetX + (player.x + 10) * scale, offsetY + (player.y + 10) * scale, 10 * scale, 0, 2 * Math.PI);
        context.fill();

        // 머리 앞의 삼각형 (입 및 방향 표시)
        context.fillStyle = 'black';
        drawTriangle(player);

        // 이름 표시
        context.fillStyle = id === socket.id ? 'green' : 'black';
        context.font = `${12 * scale}px Arial`;
        context.fillText(player.name, offsetX + player.x * scale, offsetY + (player.y - 5) * scale);
    }
}

// 지렁이의 머리 전방에 삼각형(입) 그리기
function drawTriangle(player) {
    const triangleSize = 10 * scale;
    let triangleX = offsetX + (player.x + 10) * scale;
    let triangleY = offsetY + (player.y + 10) * scale;

    context.beginPath();

    // 머리 방향에 따른 삼각형(입) 위치 조정
    if (player.direction === 'up') {
        triangleY -= 15 * scale; // 머리 위쪽으로
        context.moveTo(triangleX, triangleY); // 위쪽 꼭짓점
        context.lineTo(triangleX - triangleSize / 2, triangleY + triangleSize); // 왼쪽
        context.lineTo(triangleX + triangleSize / 2, triangleY + triangleSize); // 오른쪽
    } else if (player.direction === 'down') {
        triangleY += 15 * scale; // 머리 아래쪽으로
        context.moveTo(triangleX, triangleY); // 아래쪽 꼭짓점
        context.lineTo(triangleX - triangleSize / 2, triangleY - triangleSize); // 왼쪽
        context.lineTo(triangleX + triangleSize / 2, triangleY - triangleSize); // 오른쪽
    } else if (player.direction === 'left') {
        triangleX -= 15 * scale; // 머리 왼쪽으로
        context.moveTo(triangleX, triangleY); // 왼쪽 꼭짓점
        context.lineTo(triangleX + triangleSize, triangleY - triangleSize / 2); // 위쪽
        context.lineTo(triangleX + triangleSize, triangleY + triangleSize / 2); // 아래쪽
    } else if (player.direction === 'right') {
        triangleX += 15 * scale; // 머리 오른쪽으로
        context.moveTo(triangleX, triangleY); // 오른쪽 꼭짓점
        context.lineTo(triangleX - triangleSize, triangleY - triangleSize / 2); // 위쪽
        context.lineTo(triangleX - triangleSize, triangleY + triangleSize / 2); // 아래쪽
    }

    context.closePath();
    context.fill();
}
