// server.js
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const port = process.env.PORT || 3000;

app.use(express.static(__dirname + '/public'));

let players = {};
let pastPlayers = {}; // 이전 플레이어들을 저장하기 위한 객체
let apples = [];
let appleCount = 5; // 맵에 존재하는 사과의 수
let chatMessages = []; // 채팅 메시지 저장

// 랜덤 위치 생성 함수
function getRandomPosition() {
    return {
        x: Math.floor(Math.random() * 40) * 20,
        y: Math.floor(Math.random() * 30) * 20
    };
}

function getSafeRandomPosition() {
    let position;
    let isOccupied;
    do {
        position = getRandomPosition();
        isOccupied = false;

        // 다른 지렁이들과 충돌 여부 확인
        for (let id in players) {
            let player = players[id];

            // 지렁이의 머리와 충돌 확인
            if (player.x === position.x && player.y === position.y) {
                isOccupied = true;
                break;
            }

            // 지렁이의 꼬리와 충돌 확인
            for (let segment of player.tail) {
                if (segment.x === position.x && segment.y === position.y) {
                    isOccupied = true;
                    break;
                }
            }

            if (isOccupied) break;
        }

        // 사과와의 충돌 여부 확인
        for (let apple of apples) {
            if (apple.x === position.x && apple.y === position.y) {
                isOccupied = true;
                break;
            }
        }

    } while (isOccupied);
    return position;
}


// 임의의 색상 생성 함수
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// 초기 사과 생성
for (let i = 0; i < appleCount; i++) {
    let position = getSafeRandomPosition();
    let appleType = Math.random() < 0.1 ? 'golden' : 'normal'; // 10% 확률로 황금 사과 생성
    apples.push({
        x: position.x,
        y: position.y,
        type: appleType
    });
}


io.on('connection', (socket) => {
    console.log('사용자 연결됨:', socket.id, new Date().toLocaleString());

    // 기존 채팅 메시지 전송
    socket.emit('chatHistory', chatMessages);

    // 새로운 플레이어 추가
    socket.on('newPlayer', (data) => {
        players[socket.id] = {
            id: socket.id,
            x: 400,
            y: 300,
            direction: 'up',
            name: data.name,
            size: 3,
            tail: [],
            score: pastPlayers[socket.id]?.score || 0, // 이전 점수 유지
            initialSize: 3,
            color: getRandomColor(),
            moveCounter: 0
        };
    });

    socket.on('changeDirection', (data) => {
        const player = players[socket.id];
        if (player) {
            if (data.rotation === 'left') {
                player.direction = rotateLeft(player.direction);
            } else if (data.rotation === 'right') {
                player.direction = rotateRight(player.direction);
            }
        }
    });

    socket.on('chatMessage', (data) => {
        const messageData = {
            name: players[socket.id]?.name || '알 수 없음',
            message: data.message
        };
        chatMessages.push(messageData);
        if (chatMessages.length > 100) {
            chatMessages.shift(); // 오래된 메시지 삭제
        }
        io.sockets.emit('chatMessage', messageData);
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            pastPlayers[socket.id] = players[socket.id]; // 이전 플레이어로 저장
            delete players[socket.id];
        }
        console.log('사용자 연결 해제됨:', socket.id, new Date().toLocaleString());
    });
});

// 게임 상태 업데이트 로직
const BASE_UPDATE_INTERVAL = 100; // 기본 상태 업데이트 주기 (ms)

setInterval(() => {
    let sockets = Object.keys(players);

    // 모든 지렁이를 이동시키고 충돌 체크를 수행합니다.
    for (let id of sockets) {
        let player = players[id];

        let moveInterval = Math.max(1, Math.floor(player.size / player.initialSize));

        player.moveCounter++;

        if (player.moveCounter >= moveInterval) {
            player.moveCounter = 0;

            player.tail.unshift({ x: player.x, y: player.y });
            if (player.tail.length > player.size) {
                player.tail.pop();
            }

            switch (player.direction) {
                case 'up':
                    player.y -= 20;
                    break;
                case 'down':
                    player.y += 20;
                    break;
                case 'left':
                    player.x -= 20;
                    break;
                case 'right':
                    player.x += 20;
                    break;
            }

            if (player.x < 0) {
                player.x = 780;
            } else if (player.x >= 800) {
                player.x = 0;
            }

            if (player.y < 0) {
                player.y = 580;
            } else if (player.y >= 600) {
                player.y = 0;
            }

            // 자기 자신과의 충돌 체크
            for (let i = 1; i < player.tail.length; i++) {
                let segment = player.tail[i];
                if (segment.x === player.x && segment.y === player.y) {
                    player.size = player.initialSize;
                    player.tail = [];
                    let newPos = getRandomPosition();
                    player.x = newPos.x;
                    player.y = newPos.y;
                    io.to(player.id).emit('collision');
                    break;
                }
            }

            // 사과와의 충돌 체크
            for (let i = 0; i < apples.length; i++) {
                let apple = apples[i];
                if (player.x === apple.x && player.y === apple.y) {
                    if (apple.type === 'normal') {
                        player.size += 1;
                        player.score += 10;
                    } else if (apple.type === 'golden') {
                        player.size += 5;         // 황금 사과는 크기 5 증가
                        player.score += 50;       // 추가 점수 50점
                    }
                    apples.splice(i, 1);
                
                    // 새로운 사과 생성
                    let position = getSafeRandomPosition();
                    let appleType = Math.random() < 0.1 ? 'golden' : 'normal';
                    apples.push({
                        x: position.x,
                        y: position.y,
                        type: appleType
                    });
                    io.to(player.id).emit('appleEaten');
                    break;
                }
            }

            // 지렁이 간 충돌 체크
            let playerIds = Object.keys(players);
            for (let i = 0; i < playerIds.length; i++) {
                let player1 = players[playerIds[i]];
                for (let j = 0; j < playerIds.length; j++) {
                    let player2 = players[playerIds[j]];

                    if (player1 !== player2) {
                        for (let segment of [{ x: player2.x, y: player2.y }, ...player2.tail]) {
                            if (player1.x === segment.x && player1.y === segment.y) {
                                // 길이 비교
                                if (player1.size > player2.size) {
                                    // 긴 지렁이의 길이 감소
                                    player1.size = Math.max(player1.initialSize, player1.size - Math.floor(player2.size / 2));
                                    // 짧은 지렁이 소멸
                                    player2.size = player2.initialSize;
                                    player2.tail = [];
                                    let newPos = getSafeRandomPosition();
                                    player2.x = newPos.x;
                                    player2.y = newPos.y;
                                    player1.score += 10;

                                    // 음수 점수 방지
                                    if (player2.score > 0) {
                                        player2.score = Math.max(0, player2.score - 5);
                                    }

                                } else if (player1.size < player2.size) {
                                    // 긴 지렁이의 길이 감소
                                    player2.size = Math.max(player2.initialSize, player2.size - Math.floor(player1.size / 2));
                                    // 짧은 지렁이 소멸
                                    player1.size = player1.initialSize;
                                    player1.tail = [];
                                    let newPos = getSafeRandomPosition();
                                    player1.x = newPos.x;
                                    player1.y = newPos.y;
                                    player2.score += 10;

                                    if (player1.score > 0) {
                                        player1.score = Math.max(0, player1.score - 5);
                                    }

                                } else {
                                    // 동일한 길이의 지렁이 충돌 시 모두 소멸
                                    player1.size = player1.initialSize;
                                    player1.tail = [];
                                    let newPos1 = getRandomPosition();
                                    player1.x = newPos1.x;
                                    player1.y = newPos1.y;

                                    player2.size = player2.initialSize;
                                    player2.tail = [];
                                    let newPos2 = getRandomPosition();
                                    player2.x = newPos2.x;
                                    player2.y = newPos2.y;

                                    // 점수 변화 없음
                                }
                                io.to(player1.id).emit('collision');
                                io.to(player2.id).emit('collision');
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    // 아이템 추가 로직 (예: 속도 증가 아이템)
    // 여기에 아이템 생성 및 처리 코드를 추가할 수 있습니다.

    // 랭킹 업데이트
    let ranking = [
        ...Object.values(players),
        ...Object.values(pastPlayers)
    ]
        .sort((a, b) => b.score - a.score)
        .map((player, index) => {
            return {
                rank: index + 1,
                name: player.name,
                score: player.score
            };
        });

    io.sockets.emit('state', { players: players, apples: apples, ranking: ranking });
}, BASE_UPDATE_INTERVAL);

http.listen(port, () => {
    console.log(`서버가 ${port} 포트에서 실행 중입니다.`);
});

// 방향을 회전시키는 함수들
function rotateLeft(currentDirection) {
    const directions = ['up', 'left', 'down', 'right']; // 시계 반대 방향 회전 순서
    const index = directions.indexOf(currentDirection);
    return directions[(index + 1) % 4]; // 왼쪽으로 회전
}

function rotateRight(currentDirection) {
    const directions = ['up', 'left', 'down', 'right']; // 시계 방향 회전 순서
    const index = directions.indexOf(currentDirection);
    return directions[(index + 3) % 4]; // 오른쪽으로 회전
}
